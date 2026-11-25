/* G.E.N.I.S — automatisations : déclencheur → une ou plusieurs actions.
   Déclencheurs : phrase, heure (jours choisis), date, événement (ouverture de l'app, fin de minuteur). Les actions sont des appels d'outils
   exécutés par le même exécuteur sécurisé : une automatisation ne contourne jamais les confirmations (niveau 4 interdit, niveau 3 mis en attente si l'utilisateur est absent). */
import { store } from './storage.js';
import { bus, uid, norm } from './util.js';
import { execute } from './executor.js';
import { find, allTools, statusOf } from './connectors.js';
import { parseLocal } from './nlu-local.js';
import { onTick } from './scheduler.js';
import { notify } from './notifications.js';
import { isoDay } from './datetime-fr.js';
export const TRIGGERS = { phrase: 'Quand je dis…', time: 'À une heure précise', date: 'À une date précise', event: 'Quand un événement se produit' };
export const EVENTS = { app_open: 'À l’ouverture de G.E.N.I.S', timer_done: 'À la fin d’un minuteur' };
export const listRules = () => store.get('automations', []);
const norm2 = s => norm(s).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
/** Outils autorisés dans une automatisation : niveaux 1 à 3 (jamais d'action sensible), connecteurs actifs. */
export const eligibleTools = () => allTools().filter(t => (t.cap.level || 1) <= 3 && !['planned', 'prepared'].includes(statusOf(t.connector).state));
export function validateRule(r) {
  if (!r.name?.trim()) return 'Donnez un nom à l’automatisation.';
  const t = r.trigger || {};
  if (t.type === 'phrase' && !(t.phrases || []).some(p => norm2(p).length >= 3)) return 'Indiquez au moins une phrase déclencheuse (3 caractères minimum).';
  if ((t.type === 'time' || t.type === 'date') && !/^\d{2}:\d{2}$/.test(t.time || '')) return 'Indiquez une heure au format HH:MM.';
  if (t.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(t.date || '')) return 'Indiquez une date valide.';
  if (t.type === 'event' && !EVENTS[t.event]) return 'Choisissez un événement.';
  if (!TRIGGERS[t.type]) return 'Choisissez un type de déclencheur.';
  if (!r.actions?.length) return 'Ajoutez au moins une action.';
  for (const a of r.actions) { const e = find(a.tool); if (!e) return `Action inconnue : ${a.tool}.`; if ((e.cap.level || 1) > 3) return `« ${e.cap.label} » est une action sensible : interdite dans une automatisation.`; }
  return '';
}
export function saveRule(rule) {
  const err = validateRule(rule); if (err) throw new Error(err);
  const r = { enabled: true, createdAt: Date.now(), runs: 0, lastRunAt: 0, ...rule, id: rule.id || uid('auto'), name: rule.name.trim(), updatedAt: Date.now() };
  const list = listRules(); store.set('automations', list.some(x => x.id === r.id) ? list.map(x => (x.id === r.id ? { ...x, ...r } : x)) : [r, ...list]); bus.emit('automations'); return r;
}
export const deleteRule = id => { store.set('automations', listRules().filter(r => r.id !== id)); bus.emit('automations'); };
export const toggleRule = (id, enabled) => { store.set('automations', listRules().map(r => (r.id === id ? { ...r, enabled: enabled ?? !r.enabled } : r))); bus.emit('automations'); };
export function matchPhrase(text) {
  const t = norm2(text); if (!t) return null;
  return listRules().find(r => r.enabled && r.trigger.type === 'phrase' && r.trigger.phrases.some(p => { const n = norm2(p); return n && (t === n || t.startsWith(n + ' ') || t.endsWith(' ' + n) || (n.includes(' ') && t.includes(` ${n} `))); })) || null;
}
export async function runRule(rule, { interactive = true, spaceId = '', runId = uid('run') } = {}) {
  const results = [];
  for (const a of rule.actions) results.push(await execute({ name: a.tool, args: a.args || {} }, { interactive, spaceId, runId, source: 'automation', ruleId: rule.id }));
  store.set('automations', listRules().map(r => (r.id === rule.id ? { ...r, runs: (r.runs || 0) + 1, lastRunAt: Date.now() } : r))); bus.emit('automations');
  return results;
}
async function runBackground(rule) {
  const results = await runRule(rule, { interactive: false });
  const body = results.map(r => r.summary).filter(Boolean).join('\n');
  notify({ title: rule.name, body, kind: results.every(r => r.status === 'done') ? 'success' : 'warn', sound: true });
  bus.emit('automation:ran', { rule, results });
}
const fired = new Set();
export function startAutomations() {
  onTick(now => {
    const day = isoDay(now), hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    for (const r of listRules()) {
      if (!r.enabled) continue; const t = r.trigger; if (t.type !== 'time' && t.type !== 'date') continue;
      if (t.time !== hm || (t.type === 'time' && t.days?.length && !t.days.includes(now.getDay())) || (t.type === 'date' && t.date !== day)) continue;
      if (fired.size > 300) fired.clear();
      const key = `${r.id}|${day}|${hm}`; if (fired.has(key)) continue; fired.add(key);
      runBackground(r).then(() => { if (t.type === 'date') toggleRule(r.id, false); }).catch(e => console.error('[G.E.N.I.S] automatisation', e));
    }
  });
}
export function emitEvent(name) { for (const r of listRules()) if (r.enabled && r.trigger.type === 'event' && r.trigger.event === name) runBackground(r).catch(e => console.error('[G.E.N.I.S] automatisation', e)); }
export function describeTrigger(r) {
  const t = r.trigger;
  if (t.type === 'phrase') return `Quand je dis « ${t.phrases.join(' » ou « ')} »`;
  if (t.type === 'time') return `À ${t.time}${t.days?.length && t.days.length < 7 ? ' (' + t.days.map(d => 'dim lun mar mer jeu ven sam'.split(' ')[d]).join(', ') + ')' : ' chaque jour'}`;
  if (t.type === 'date') return `Le ${new Date(t.date + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${t.time}`;
  return EVENTS[t.event] || t.event;
}
export function describeAction(a) { const e = find(a.tool); const args = Object.entries(a.args || {}).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join(', '); return `${e?.cap.label || a.tool}${args ? ` (${args})` : ''}`; }
/** « Quand je dis X, fais A, B et C » → brouillon d'automatisation (à confirmer par l'utilisateur) ou null. */
export function parseRuleFromSpeech(text) {
  const m = text.match(/^(?:quand|lorsque)\s+je\s+dis\s+["«“']?(.+?)["»”']?\s*[,:]\s*(?:alors\s+)?(.+)$/i); if (!m) return null;
  const clauses = m[2].split(/\s*(?:,|\bet puis\b|\bpuis\b|\bet\b(?=\s+(?:mets|met|donne|ouvre|lance|dis|joue|baisse|ferme|programme)))\s*/i).filter(Boolean);
  const actions = []; const unknown = [];
  for (const c of clauses) { const p = parseLocal(c); if (p?.kind === 'tools') p.calls.forEach(x => actions.push({ tool: x.name, args: x.args })); else unknown.push(c); }
  if (!actions.length) return null;
  return { name: `Quand je dis « ${m[1].trim()} »`, trigger: { type: 'phrase', phrases: [m[1].trim()] }, actions, unknown };
}
