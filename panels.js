/* G.E.N.I.S — panneaux du tiroir : historique, applications, mémoire, automatisations, notifications, réglages.
   Tout est construit avec h() (aucun innerHTML). Chaque panneau lit et modifie directement les modules métier : l'interface ne garde aucun état caché. */
import { h, icon, fmt, download, bus, toast } from './util.js';
import { getSettings, patchSettings, store, usage, requestPersistence, exportAll, importAll } from './storage.js';
import { allConnectors, statusOf, STATE_LABEL, find, openExternal } from './connectors.js';
import { LEVELS } from './security.js';
import { allPermissions, setPerm, setConfirmMode, resetPermissions } from './permissions.js';
import { KINDS, LIMITS, listMemories, addMemory, updateMemory, removeMemory, clearMemories, historyStats, chatIndex, searchHistory, deleteChat, listSuggestions, resolveSuggestion } from './memory.js';
import { listRules, saveRule, deleteRule, toggleRule, runRule, eligibleTools, describeTrigger, describeAction, TRIGGERS, EVENTS } from './automations.js';
import { activeTimers, cancelTimer } from './scheduler.js';
import { listActions, clearActions, execute } from './executor.js';
import { listNotifications, markAllRead, clearNotifications, requestSystemPermission, listPending, removePending } from './notifications.js';
import { runPending } from './brain.js';
import { openSpace } from './spaces.js';
import { SERVICES, serviceUrl } from './services.js';
import { modal, formDialog, confirmSimple, setupStrongAuth, requestStrongAuth, keyName } from './modals.js';
import * as SA from './strong-auth.js';
import * as gateway from './gateway.js';
import { SCOPES, googleAccount, refreshGoogle, connectGoogle, disconnectGoogle } from './connector-google.js';
import { filesSupported, pickFolder, forgetFolder, folderName } from './connector-files.js';
import { tts } from './tts.js';
import { sttMode } from './voice.js';
export const PANEL_TITLES = { history: 'Historique', apps: 'Applications', memory: 'Mémoire', automations: 'Automatisations', notifications: 'Notifications', settings: 'Réglages' };
export const PANEL_EVENTS = { history: ['chats'], apps: ['accounts', 'permissions'], memory: ['memory'], automations: ['automations', 'timers', 'action'], notifications: ['notify'], settings: ['accounts'] };
const sec = (title, ...k) => h('section', { class: 'sec' }, title ? h('h3', {}, title) : null, ...k);
const row = (label, desc, ctrl) => h('div', { class: 'row' }, h('div', { class: 'row-l' }, h('b', {}, label), desc ? h('small', {}, desc) : null), ctrl);
const btn = (label, fn, cls = '', ic) => h('button', { type: 'button', class: `btn ${cls}`.trim(), onclick: fn }, ic ? icon(ic) : null, label);
const pill = (t, s = '') => h('span', { class: 'pill', dataset: { s } }, t);
const empty = t => h('p', { class: 'empty' }, t);
const toggle = (get, set, label) => { const b = h('button', { type: 'button', role: 'switch', class: 'switch', 'aria-checked': String(!!get()), 'aria-label': label, onclick: () => { const v = !get(); set(v); b.setAttribute('aria-checked', String(v)); } }, h('i')); return b; };
const select = (opts, get, set, label) => { const s = h('select', { 'aria-label': label }, opts.map(([v, l]) => h('option', { value: v }, l))); s.value = get(); s.addEventListener('change', () => set(s.value)); return s; };
const range = (min, max, step, get, set, label) => h('input', { type: 'range', min, max, step, value: get(), 'aria-label': label, oninput: e => set(+e.target.value) });
const field = (get, set, { type = 'text', placeholder = '', label } = {}) => { const i = h('input', { type, placeholder, autocomplete: 'off', spellcheck: 'false', 'aria-label': label || placeholder }); i.value = get() ?? ''; i.addEventListener('change', () => set(i.value.trim())); return i; };
const S = k => getSettings()[k], P = (k, v) => patchSettings({ [k]: v });
const day = t => new Date(t).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

/* ---------- Historique ---------- */
function history(body, api) {
  const q = h('input', { type: 'search', placeholder: 'Rechercher dans les conversations', 'aria-label': 'Rechercher dans les conversations' }), list = h('div', { class: 'list' });
  const open = (id, title) => { openSpace({ chatId: id, title }); api.closePanel(); api.openThread(true); };
  const item = (t, sub, fn, del) => h('div', { class: 'item' }, h('button', { type: 'button', class: 'item-main', onclick: fn }, h('b', {}, t), h('small', {}, sub)), del ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Supprimer ${t}`, onclick: del }, icon('trash')) : null);
  const draw = () => {
    list.replaceChildren(); const term = q.value.trim();
    if (term) { const hits = searchHistory(term, { limit: 20 }); if (!hits.length) list.append(empty('Aucun résultat.')); hits.forEach(r => list.append(item(r.title, `${new Date(r.createdAt).toLocaleDateString('fr-FR')} — ${r.content.slice(0, 120)}`, () => open(r.chatId, r.title)))); return; }
    const idx = chatIndex(); if (!idx.length) list.append(empty('Aucune conversation enregistrée.'));
    idx.forEach(c => list.append(item(c.title, `${day(c.updatedAt)} · ${c.count} message(s)`, () => open(c.id, c.title), async () => { if (await confirmSimple({ title: 'Supprimer la conversation ?', text: `« ${c.title} » sera supprimée définitivement de cet appareil.`, confirmLabel: 'Supprimer', danger: true })) { deleteChat(c.id); draw(); } })));
  };
  q.addEventListener('input', draw); draw();
  body.append(sec('', q, list), sec('Sauvegarde', row('Exporter', 'Toutes les données locales en JSON (sans secrets).', btn('Exporter', exportData)), row('Importer', 'Restaure un fichier exporté.', btn('Importer', importData))));
}
function exportData() { download(`genis-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportAll(), null, 2), 'application/json'); }
function importData() {
  const i = h('input', { type: 'file', accept: 'application/json' });
  i.addEventListener('change', async () => { try { const n = importAll(JSON.parse(await i.files[0].text())); toast(`${n} éléments importés. Rechargez l’application pour tout appliquer.`, 'info'); } catch (e) { toast(e.message || 'Fichier invalide.', 'error'); } }); i.click();
}

/* ---------- Applications : connecteurs et lanceur ---------- */
function apps(body, api) {
  let sel = '';
  const view = h('div'); body.append(view);
  const detail = c => {
    const st = statusOf(c), caps = Object.entries(c.capabilities || {});
    return h('div', {}, btn('Retour', () => { sel = ''; draw(); }, 'ghost', 'chevron-left'), h('h3', { class: 'big-h' }, c.name), h('p', {}, pill(STATE_LABEL[st.state] || st.state, st.state), ' ', h('small', {}, c.category)), st.detail ? h('p', { class: 'why' }, st.detail) : null,
      st.state === 'needs_auth' || st.state === 'needs_config' ? btn('Ouvrir les réglages', () => api.openPanel('settings'), 'primary') : null,
      sec('Authentification', h('p', {}, c.auth?.type === 'oauth2' ? `OAuth 2.0 (${c.auth.provider}). Jetons côté serveur, jamais dans le navigateur.` : c.auth?.type === 'none' ? 'Aucune : fonctionne sans compte ni clé.' : `${c.auth?.type || '—'}${c.auth?.provider ? ` (${c.auth.provider})` : ''}${c.auth?.note ? ` — ${c.auth.note}` : ''}`)),
      caps.length ? sec('Actions', h('ul', { class: 'rows' }, caps.filter(([, x]) => !x.hidden).map(([, x]) => h('li', {}, h('span', { class: 'row-title' }, x.label, ' ', pill(LEVELS[x.level || 1], 'l' + (x.level || 1))), h('span', { class: 'row-sub' }, x.description))))) : null,
      c.plannedCapabilities?.length ? sec('Actions prévues', h('ul', { class: 'bul' }, c.plannedCapabilities.map(x => h('li', {}, x)))) : null,
      c.services?.length ? sec('Services', h('p', {}, c.services.join(', '))) : null,
      c.limits?.length ? sec('Limites connues', h('ul', { class: 'bul' }, c.limits.map(x => h('li', {}, x)))) : null,
      c.how ? sec('Pour l’activer', h('p', {}, c.how)) : null);
  };
  const draw = () => {
    view.replaceChildren(); if (sel) return view.append(detail(allConnectors().find(c => c.id === sel)));
    const groups = {}; allConnectors().forEach(c => (groups[c.category] ||= []).push(c));
    Object.entries(groups).sort().forEach(([cat, list]) => view.append(sec(cat, h('div', { class: 'grid' }, list.map(c => { const st = statusOf(c); return h('button', { type: 'button', class: 'tile', onclick: () => { sel = c.id; draw(); } }, h('span', { class: 'ic' }, icon(c.icon || 'dots')), h('b', {}, c.name), pill(STATE_LABEL[st.state] || st.state, st.state)); })))));
    view.append(sec('Lanceur', h('div', { class: 'chips wrap' }, SERVICES.map(s => h('button', { type: 'button', class: 'chip', onclick: () => { const u = serviceUrl(s); u ? openExternal(u, s.name) : toast(`${s.name} : adresse à renseigner dans Réglages › Écosystème SOPP.`, 'warn'); } }, s.name)))));
  };
  draw();
}

/* ---------- Mémoire ---------- */
function memory(body) {
  let filter = ''; const view = h('div'); body.append(view);
  const edit = async m => { const v = await formDialog({ title: m ? 'Modifier le souvenir' : 'Nouveau souvenir', fields: [{ name: 'text', label: 'Souvenir', type: 'textarea', value: m?.text || '', required: true }, { name: 'kind', label: 'Catégorie', type: 'select', options: Object.entries(KINDS), value: m?.kind || 'fact' }], validate: v => (v.text ? '' : 'Le souvenir est vide.') }); if (!v) return; try { m ? updateMemory(m.id, v) : addMemory(v); } catch (e) { toast(e.message, 'error'); } };
  const draw = () => {
    view.replaceChildren(); const st = historyStats(), all = listMemories(), list = filter ? all.filter(m => m.kind === filter) : all;
    view.append(sec('', h('p', { class: 'why' }, `${st.memories} / ${LIMITS.memories} souvenirs · ${st.chats} conversation(s). La mémoire a des limites : rien n’est retenu sans que vous puissiez le voir, le modifier ou le supprimer.`), row('Apprentissage des habitudes', 'Propose de retenir ce que vous refaites souvent.', select([['ask', 'Me demander'], ['auto', 'Retenir automatiquement'], ['off', 'Désactivé']], () => S('learnHabits'), v => P('learnHabits', v), 'Apprentissage des habitudes'))));
    const sug = listSuggestions(); if (sug.length) view.append(sec('Suggestions', ...sug.map(s => h('div', { class: 'item' }, h('div', { class: 'item-main' }, h('b', {}, s.text), h('small', {}, 'Observé plusieurs fois')), btn('Retenir', () => resolveSuggestion(s.id, true), 'primary'), btn('Non', () => resolveSuggestion(s.id, false), 'ghost')))));
    view.append(h('div', { class: 'chips wrap' }, btn('Tout', () => { filter = ''; draw(); }, filter ? 'ghost' : ''), ...Object.entries(KINDS).map(([k, l]) => btn(l, () => { filter = k; draw(); }, filter === k ? '' : 'ghost'))), h('div', { class: 'btn-row' }, btn('Ajouter', () => edit(null), 'primary', 'plus'), all.length ? btn('Tout effacer', async () => { if (await confirmSimple({ title: 'Effacer toute la mémoire ?', text: 'Tous les souvenirs seront supprimés (les conversations sont conservées).', confirmLabel: 'Effacer', danger: true })) clearMemories(); }, 'ghost') : null));
    view.append(list.length ? h('div', { class: 'list' }, list.map(m => h('div', { class: 'item' }, h('div', { class: 'item-main' }, h('b', {}, m.text), h('small', {}, `${KINDS[m.kind]} · ${day(m.updatedAt)}${m.source === 'auto' ? ' · appris' : ''}`)), h('button', { type: 'button', class: 'icon-btn', 'aria-label': m.pinned ? 'Désépingler' : 'Épingler', 'aria-pressed': !!m.pinned, onclick: () => updateMemory(m.id, { pinned: !m.pinned }) }, icon('pin')), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Modifier', onclick: () => edit(m) }, icon('edit')), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Supprimer', onclick: () => removeMemory(m.id) }, icon('trash'))))) : empty('Aucun souvenir.'));
  };
  draw();
}

/* ---------- Automatisations ---------- */
const DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
function paramInput(spec, key, a) {
  const set = v => { v === '' || v == null ? delete a.args[key] : (a.args[key] = v); };
  if (spec.enum) { const s = h('select', { 'aria-label': key }, h('option', { value: '' }, `${key}…`), spec.enum.map(v => h('option', { value: v }, v))); s.value = a.args[key] ?? ''; s.addEventListener('change', () => set(s.value)); return s; }
  if (spec.type === 'boolean') { const c = h('input', { type: 'checkbox', 'aria-label': key }); c.checked = !!a.args[key]; c.addEventListener('change', () => set(c.checked || undefined)); return h('label', { class: 'check' }, c, h('span', {}, key)); }
  if (spec.type === 'array' || spec.type === 'object') { const t = h('textarea', { rows: 2, placeholder: `${key} (JSON)`, 'aria-label': key }); t.value = a.args[key] != null ? JSON.stringify(a.args[key]) : ''; t.addEventListener('change', () => { try { set(t.value.trim() ? JSON.parse(t.value) : ''); t.classList.remove('bad'); } catch { t.classList.add('bad'); } }); return t; }
  const i = h('input', { type: spec.type === 'number' || spec.type === 'integer' ? 'number' : 'text', placeholder: `${key}${spec.description ? ' : ' + spec.description : ''}`.slice(0, 80), 'aria-label': key, step: 'any' }); i.value = a.args[key] ?? ''; i.addEventListener('change', () => set(spec.type === 'number' || spec.type === 'integer' ? (i.value === '' ? '' : Number(i.value)) : i.value.trim())); return i;
}
function ruleEditor(rule) {
  const r = rule ? structuredClone(rule) : { name: '', trigger: { type: 'phrase', phrases: [] }, actions: [] }, tools = eligibleTools(), err = h('p', { class: 'form-err', role: 'alert' }), trig = h('div'), acts = h('div');
  const name = field(() => r.name, v => (r.name = v), { placeholder: 'Nom de l’automatisation', label: 'Nom' }), type = select(Object.entries(TRIGGERS), () => r.trigger.type, v => { r.trigger = { type: v, ...(v === 'phrase' ? { phrases: [] } : v === 'event' ? { event: 'app_open' } : { time: '07:30' }) }; drawTrig(); }, 'Déclencheur');
  const drawTrig = () => {
    const t = r.trigger; trig.replaceChildren();
    if (t.type === 'phrase') trig.append(field(() => (t.phrases || []).join(', '), v => (t.phrases = v.split(',').map(x => x.trim()).filter(Boolean)), { placeholder: 'Phrase(s), séparées par des virgules', label: 'Phrases' }), h('small', {}, 'Ex. : « je pars travailler », « bonne nuit »'));
    if (t.type === 'time' || t.type === 'date') {
      trig.append(field(() => t.time, v => (t.time = v), { type: 'time', label: 'Heure' }));
      if (t.type === 'date') trig.append(field(() => t.date, v => (t.date = v), { type: 'date', label: 'Date' }));
      else trig.append(h('div', { class: 'days' }, DAYS.map((d, i) => { const c = h('input', { type: 'checkbox', 'aria-label': ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][i] }); c.checked = !t.days?.length || t.days.includes(i); c.addEventListener('change', () => { const set = new Set(t.days?.length ? t.days : [0, 1, 2, 3, 4, 5, 6]); c.checked ? set.add(i) : set.delete(i); t.days = [...set].sort(); }); return h('label', { class: 'day-chk' }, c, h('span', {}, d)); })));
    }
    if (t.type === 'event') trig.append(select(Object.entries(EVENTS), () => t.event, v => (t.event = v), 'Événement'));
  };
  const drawActs = () => {
    acts.replaceChildren();
    r.actions.forEach((a, i) => {
      const cap = find(a.tool)?.cap, params = acts.appendChild(h('div', { class: 'act' }));
      const sel = h('select', { 'aria-label': `Action ${i + 1}` }, h('option', { value: '' }, 'Choisir une action…'), ...Object.entries(Object.groupBy ? Object.groupBy(tools, t => t.connector.name) : tools.reduce((m, t) => ((m[t.connector.name] ||= []).push(t), m), {})).map(([n, l]) => h('optgroup', { label: n }, l.map(t => h('option', { value: t.name }, t.cap.label)))));
      sel.value = a.tool || ''; sel.addEventListener('change', () => { a.tool = sel.value; a.args = {}; drawActs(); });
      params.append(h('div', { class: 'act-head' }, sel, h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Retirer l’action', onclick: () => { r.actions.splice(i, 1); drawActs(); } }, icon('trash'))));
      if (cap) { params.append(h('small', {}, `${cap.description} [${LIVELS(cap.level)}]`)); Object.entries(cap.params || {}).forEach(([k, spec]) => params.append(paramInput(spec, k, a))); }
    });
    acts.append(btn('Ajouter une action', () => { r.actions.push({ tool: '', args: {} }); drawActs(); }, 'ghost', 'plus'));
  };
  const LIVELS = l => LEVELS[l || 1];
  return new Promise(resolve => {
    let m; const done = v => { resolve(v); m.close(); };
    const save = () => { try { saveRule(r); done(true); } catch (e) { err.textContent = e.message; } };
    m = modal(() => h('div', { class: 'modal-body' }, h('h2', {}, rule ? 'Modifier l’automatisation' : 'Nouvelle automatisation'), h('label', { class: 'field' }, h('span', {}, 'Nom'), name), h('label', { class: 'field' }, h('span', {}, 'Déclencheur'), type), trig, h('h3', {}, 'Actions'), h('p', { class: 'why' }, 'Niveaux 1 à 3 uniquement. Si vous êtes absent, une action qui exige une confirmation attend dans les notifications.'), acts, err, h('div', { class: 'modal-actions' }, btn('Annuler', () => done(false), 'ghost'), btn('Enregistrer', save, 'primary'))), { label: 'Automatisation', wide: true, onClose: () => resolve(false) });
    drawTrig(); drawActs();
  });
}
const STATUS_IC = { done: 'check', unverified: 'alert', needs_manual: 'external', failed: 'x', cancelled: 'x', denied: 'lock', needs_config: 'alert', needs_auth: 'lock', needs_confirmation: 'clock' };
function automations(body) {
  const view = h('div'); body.append(view);
  const draw = () => {
    view.replaceChildren(); const rules = listRules(), timers = activeTimers(), acts = listActions().slice(0, 25);
    view.append(sec('Règles « quand… alors… »', btn('Nouvelle règle', async () => { await ruleEditor(null); }, 'primary', 'plus'),
      rules.length ? h('div', { class: 'list' }, rules.map(r => h('div', { class: 'rule', dataset: { off: !r.enabled } }, h('div', { class: 'rule-h' }, h('b', {}, r.name), toggle(() => r.enabled, v => toggleRule(r.id, v), `Activer ${r.name}`)), h('small', {}, describeTrigger(r)), h('ul', { class: 'bul' }, r.actions.map(a => h('li', {}, describeAction(a)))), h('small', {}, r.runs ? `${r.runs} exécution(s), dernière : ${day(r.lastRunAt)}` : 'Jamais exécutée'),
        h('div', { class: 'btn-row' }, btn('Lancer', async () => { const res = await runRule(r, { interactive: true }); toast(res.map(x => x.summary).filter(Boolean).join(' ') || 'Exécutée.', res.every(x => x.status === 'done') ? 'info' : 'warn'); }, 'ghost', 'play'), btn('Modifier', () => ruleEditor(r), 'ghost', 'edit'), btn('Supprimer', async () => { if (await confirmSimple({ title: 'Supprimer l’automatisation ?', text: `« ${r.name} » sera supprimée.`, confirmLabel: 'Supprimer', danger: true })) deleteRule(r.id); }, 'ghost', 'trash')))) ) : empty('Aucune règle. Dites par exemple : « Quand je dis bonne nuit, mets ma playlist de nuit ».')));
    view.append(sec('Minuteurs, rappels et réveils', timers.length ? h('div', { class: 'list' }, timers.map(t => h('div', { class: 'item' }, h('div', { class: 'item-main' }, h('b', {}, t.label || ({ timer: 'Minuteur', alarm: 'Réveil', reminder: 'Rappel' }[t.kind])), h('small', {}, `${fmt.time(t.dueAt)}${t.repeatDaily ? ' · chaque jour' : ''} · dans ${fmt.left(t.dueAt - Date.now())}`)), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Annuler', onclick: () => cancelTimer(t.id) }, icon('x'))))) : empty('Aucun minuteur en cours.')));
    view.append(sec('Activité', acts.length ? h('ul', { class: 'rows' }, acts.map(a => h('li', { dataset: { s: a.status } }, icon(STATUS_IC[a.status] || 'clock'), h('span', { class: 'row-title' }, `${a.label} `, h('em', {}, a.connector)), h('span', { class: 'row-sub' }, `${day(a.at)} · ${a.summary}${a.status === 'done' && !a.verified ? '' : ''}`)))) : empty('Aucune action effectuée pour le moment.'), acts.length ? btn('Effacer l’historique', () => { clearActions(); draw(); }, 'ghost') : null));
  };
  draw(); const id = setInterval(() => { if (!body.isConnected) return clearInterval(id); if (!body.querySelector('.modal-back') && activeTimers().length) draw(); }, 15000);
}

/* ---------- Notifications ---------- */
function notifications(body, api) {
  markAllRead(); const pend = listPending(), list = listNotifications();
  body.append(sec(pend.length ? 'À confirmer' : '', ...pend.map(p => h('div', { class: 'item' }, h('div', { class: 'item-main' }, h('b', {}, p.label), h('small', {}, `${p.connector} · ${day(p.createdAt)}`)), btn('Examiner', async () => { const r = await runPending(p); removePending(p.id); toast(r.summary || 'Terminé.', r.status === 'done' ? 'info' : 'warn'); }, 'primary'), btn('Ignorer', () => removePending(p.id), 'ghost')))));
  if (globalThis.Notification && Notification.permission !== 'granted') body.append(sec('', row('Notifications du système', 'Pour être prévenu même si G.E.N.I.S est en arrière-plan.', btn('Activer', async () => { const p = await requestSystemPermission(); toast(p === 'granted' ? 'Notifications activées.' : 'Notifications refusées par le navigateur.', p === 'granted' ? 'info' : 'warn'); }))));
  body.append(sec('Récentes', list.length ? h('ul', { class: 'rows' }, list.map(n => h('li', { dataset: { s: n.kind } }, h('span', { class: 'row-title' }, n.title), h('span', { class: 'row-sub' }, `${day(n.createdAt)}${n.body ? ' · ' + n.body : ''}`)))) : empty('Rien de nouveau.'), list.length ? btn('Tout effacer', () => clearNotifications(), 'ghost') : null));
}

function permissionRow(p) {
  const control = h('div', { class: 'perm' }, select([['granted', 'Autorisé'], ['ask', 'Demander'], ['denied', 'Refusé']], () => p.state, v => setPerm(p.id, v), p.label),
    p.level === 3 ? h('label', { class: 'check mini' }, toggle(() => p.confirm === 'auto', v => setConfirmMode(p.id, v ? 'auto' : 'confirm'), `Sans confirmation : ${p.label}`), h('span', {}, 'sans confirmation')) : null);
  return row(p.label, `${LEVELS[p.level]}${p.sensitive ? ' · donnée sensible' : ''}`, control);
}
function permissionGroups() {
  const by = {}; allPermissions().forEach(p => (by[p.group] ||= []).push(p));
  return Object.entries(by).map(([group, list]) => sec(group, ...list.map(permissionRow)));
}
/* ---------- Réglages ---------- */
function settings(body, api) {
  const A = (t, ...k) => h('details', { class: 'acc' }, h('summary', {}, t), h('div', { class: 'acc-b' }, ...k));
  const gwStatus = h('p', { class: 'why', role: 'status' }), st = getSettings();
  const testGw = async () => {
    gwStatus.textContent = 'Test en cours…';
    try { const d = await gateway.health(); const on = Object.entries(d.providers || {}).filter(([, v]) => v).map(([k]) => k); gwStatus.textContent = d.appSecretAccepted === false ? 'Passerelle joignable, mais le secret est refusé.' : (d.api || 0) < gateway.API_VERSION ? 'Passerelle trop ancienne : redéployez la dernière version de worker.js.' : `Connectée. IA : ${on.join(', ') || 'aucune clé configurée'}. Voix : ${d.tts?.openai || d.tts?.elevenlabs ? 'oui' : 'non'}. Google : ${d.google?.configured ? 'configuré' : 'non configuré'}.`; api.refreshGateway(); } catch (e) { gwStatus.textContent = e.userMessage || 'Échec du test.'; }
  };
  const g = googleAccount(), chosen = new Set(['calendar.read', 'mail.read']);
  const secInfo = () => (SA.isConfigured() ? 'Configurée' : 'Non configurée');
  body.append(
    A('Profil', row('Prénom', 'Utilisé pour vous nommer.', field(() => S('userName'), v => P('userName', v), { placeholder: 'Prénom' })), row('Ville par défaut', 'Météo, restaurants, trajets.', field(() => S('defaultCity'), v => P('defaultCity', v), { placeholder: 'Ville' }))),
    A('Passerelle IA', h('p', { class: 'why' }, 'La passerelle (worker.js sur Cloudflare) garde les clés des fournisseurs d’IA, relaie la voix neuronale et les actualités, et gère OAuth. Aucune clé n’est jamais stockée dans ce navigateur.'),
      row('Adresse', 'https://…workers.dev', field(() => S('gatewayUrl'), v => { P('gatewayUrl', v.replace(/\/+$/, '')); api.refreshGateway(); }, { type: 'url', placeholder: 'https://genis-gateway.exemple.workers.dev' })),
      row('Secret d’application', 'Chiffré dans le coffre local. Jamais affiché.', field(() => '', async v => { if (v) { await gateway.setGatewaySecret(v); toast('Secret enregistré dans le coffre.', 'info'); } }, { type: 'password', placeholder: '••••••••' })),
      row('Fournisseur', 'Automatique : le premier configuré.', select([['auto', 'Automatique'], ['anthropic', 'Claude (Anthropic)'], ['openai', 'ChatGPT (OpenAI)'], ['gemini', 'Gemini (expérimental)']], () => S('provider'), v => P('provider', v), 'Fournisseur')),
      row('Modèle rapide', 'Vide = défaut de la passerelle.', field(() => S('modelFast'), v => P('modelFast', v), { placeholder: 'ex. claude-haiku-5-5' })), row('Modèle avancé', 'Tâches complexes et multi-agents.', field(() => S('modelSmart'), v => P('modelSmart', v), { placeholder: 'ex. claude-sonnet-5-5' })), btn('Tester la connexion', testGw, 'primary'), gwStatus),
    A('Voix', row('Réponses vocales', '', toggle(() => S('voiceEnabled'), v => P('voiceEnabled', v), 'Réponses vocales')), row('Quand parler', '', select([['voice', 'Quand je parle'], ['always', 'Toujours'], ['never', 'Jamais']], () => S('speakReplies'), v => P('speakReplies', v), 'Quand parler')),
      row('Moteur', 'Neuronal via la passerelle si disponible.', select([['auto', 'Automatique'], ['browser', 'Navigateur'], ['gateway', 'Passerelle (voix neuronale)']], () => S('ttsEngine'), v => P('ttsEngine', v), 'Moteur de voix')),
      row('Voix du navigateur', 'Les voix « naturelles » sont bien plus expressives.', select([['', 'Automatique'], ...tts.voices().map(v => [v.name, v.name])], () => S('voiceName'), v => P('voiceName', v), 'Voix')),
      row('Vitesse', '', range(0.7, 1.4, 0.05, () => S('speechRate'), v => P('speechRate', v), 'Vitesse')), row('Hauteur', '', range(0.7, 1.3, 0.05, () => S('speechPitch'), v => P('speechPitch', v), 'Hauteur')), row('Volume', '', range(0.2, 1, 0.05, () => S('volume'), v => P('volume', v), 'Volume')),
      row('Émotion et pauses', 'Intonation selon le contexte.', toggle(() => S('emotion'), v => P('emotion', v), 'Émotion')), btn('Écouter un exemple', () => api.testVoice(), 'ghost', 'play')),
    A('Microphone', h('p', { class: 'why' }, sttMode() === 'browser' ? 'Reconnaissance vocale du navigateur. Sur Chrome, l’audio est traité par le service du navigateur.' : sttMode() === 'gateway' ? 'Transcription par la passerelle (ce navigateur n’a pas de reconnaissance vocale).' : 'Aucune reconnaissance vocale disponible : écrivez vos demandes ou connectez la passerelle.'),
      row('Mode d’écoute', '', select([['conversation', 'Conversation continue'], ['single', 'Une commande, puis coupure']], () => S('listenMode'), v => P('listenMode', v), 'Mode d’écoute')), row('Mot d’appel « Génis »', 'N’agit que sur les phrases commençant par Génis.', toggle(() => S('wakeWord'), v => P('wakeWord', v), 'Mot d’appel')),
      row('Visualisation du micro', 'Désactivée sur iOS par défaut.', select([['auto', 'Automatique'], ['on', 'Toujours'], ['off', 'Jamais']], () => S('micVisualizer'), v => P('micVisualizer', v), 'Visualisation'))),
    A('Comptes connectés', sec('Google (Agenda, Gmail)', h('p', {}, pill(g.connected ? 'Connecté' : !gateway.isConfigured() ? 'Passerelle requise' : g.configured === false ? 'Non configuré côté serveur' : 'Non connecté', g.connected ? 'ready' : 'needs_auth'), g.email ? ` ${g.email}` : ''), g.error ? h('p', { class: 'form-err' }, g.error) : null,
      g.connected ? h('p', { class: 'why' }, `Permissions accordées : ${g.scopes.map(s => s.split('/').pop()).join(', ') || 'aucune'}.`) : null,
      h('div', { class: 'checks' }, Object.entries(SCOPES).map(([k, v]) => { const c = h('input', { type: 'checkbox', 'aria-label': v.label }); c.checked = chosen.has(k); c.addEventListener('change', () => (c.checked ? chosen.add(k) : chosen.delete(k))); return h('label', { class: 'check' }, c, h('span', {}, v.label)); })),
      h('div', { class: 'btn-row' }, btn(g.connected ? 'Reconnecter' : 'Connecter Google', async () => { try { const u = await connectGoogle([...chosen]); if (u) location.href = u; else toast('Terminez l’autorisation dans le nouvel onglet, puis revenez ici.', 'info'); } catch (e) { toast(e.userMessage || e.message, 'error'); } }, 'primary'), btn('Actualiser', () => refreshGoogle(), 'ghost', 'refresh'), g.connected ? btn('Révoquer', async () => { if (await confirmSimple({ title: 'Révoquer Google ?', text: 'Les jetons seront supprimés de la passerelle.', confirmLabel: 'Révoquer', danger: true })) { await disconnectGoogle(); } }, 'ghost') : null)),
      sec('Fichiers', h('p', { class: 'why' }, filesSupported() ? (folderName() ? `Dossier autorisé : ${folderName()} (durée de la session).` : 'Aucun dossier autorisé. G.E.N.I.S ne lit que ce que vous choisissez.') : 'Ce navigateur ne permet pas l’accès à un dossier (Chrome ou Edge sur ordinateur). Les pièces jointes restent disponibles.'), filesSupported() ? h('div', { class: 'btn-row' }, btn(folderName() ? 'Changer de dossier' : 'Choisir un dossier', async () => { try { await pickFolder(); } catch (e) { if (e.name !== 'AbortError') toast('Accès au dossier refusé.', 'error'); } }, 'primary', 'folder'), folderName() ? btn('Oublier', () => forgetFolder(), 'ghost') : null) : null)),
    A('Permissions', h('p', { class: 'why' }, 'Chaque capacité dépend d’une permission. Niveau 1 lecture · 2 préparation · 3 action (confirmation) · 4 action sensible (authentification forte, toujours).'), ...permissionGroups(),
      btn('Réinitialiser les permissions', async () => { if (await confirmSimple({ title: 'Réinitialiser ?', text: 'Toutes les permissions reviennent à leur valeur par défaut.', confirmLabel: 'Réinitialiser' })) resetPermissions(); }, 'ghost')),
    A('Sécurité', row('Authentification forte', `${secInfo()}. Phrase secrète + deux touches maintenues, pour les paiements et suppressions.`, h('div', { class: 'btn-row' }, btn(SA.isConfigured() ? 'Modifier' : 'Configurer', async () => { await setupStrongAuth(); }, 'primary'), SA.isConfigured() ? btn('Tester', () => requestStrongAuth({ title: 'Test', connector: 'G.E.N.I.S', summary: 'Test de l’authentification forte : aucune action ne sera effectuée.', actionId: 'test', level: 4 }).then(r => toast(r.ok ? 'Authentification réussie.' : 'Test annulé.', r.ok ? 'info' : 'warn')), 'ghost') : null)),
      SA.isConfigured() ? row('Touches maintenues', SA.chordKeys().map(keyName).join(' + '), btn('Désactiver', async () => { if (await confirmSimple({ title: 'Désactiver l’authentification forte ?', text: 'Les actions sensibles seront bloquées tant qu’elle n’est pas reconfigurée.', confirmLabel: 'Désactiver', danger: true })) { SA.resetSecure(); bus.emit('accounts'); } }, 'ghost')) : null,
      row('Confirmer à la voix', 'Dire « oui » ou « non » pour les actions de niveau 3 (jamais pour le niveau 4).', toggle(() => S('voiceConfirm'), v => P('voiceConfirm', v), 'Confirmer à la voix')),
      h('p', { class: 'why' }, 'Pour un vrai paiement, l’authentification native de la banque ou du service reste indispensable : G.E.N.I.S prépare, la banque valide.')),
    A('Données', h('p', { class: 'why' }, `Stockage : ${store.mode === 'indexeddb' ? 'IndexedDB (persistant)' : 'mémoire seulement (non persistant)'}. ${store.warning}`), row('Sauvegarde', '', h('div', { class: 'btn-row' }, btn('Exporter', exportData, 'ghost'), btn('Importer', importData, 'ghost'))), row('Stockage durable', 'Évite que le navigateur efface les données.', btn('Demander', async () => toast((await requestPersistence()) ? 'Stockage durable accordé.' : 'Stockage durable refusé par le navigateur.', 'info'), 'ghost')),
      row('Effacer toutes les données', 'Action sensible : authentification forte.', btn('Effacer', async () => { const r = await execute({ name: 'genis_data_erase', args: {} }, { interactive: true }); toast(r.summary, r.status === 'done' ? 'info' : 'warn'); }, 'danger'))),
    A('Apparence', row('Accent', '', select([['white', 'Blanc'], ['ice', 'Glace'], ['amber', 'Ambre'], ['mint', 'Menthe']], () => S('accent'), v => P('accent', v), 'Accent')), row('Animations', '', select([['full', 'Complètes'], ['reduced', 'Réduites']], () => S('motion'), v => P('motion', v), 'Animations')), row('Intensité de l’onde', '', range(0.4, 1.6, 0.1, () => S('waveIntensity'), v => P('waveIntensity', v), 'Intensité')), row('Taille du texte', '', range(0.9, 1.3, 0.05, () => S('fontScale'), v => P('fontScale', v), 'Taille du texte'))),
    A('Écosystème SOPP', row('SOPP Language', 'Adresse de l’application.', field(() => S('soppLanguageUrl'), v => P('soppLanguageUrl', v), { type: 'url', placeholder: 'https://…' })), row('Pharma SOPP', 'Adresse de l’application.', field(() => S('soppPharmaUrl'), v => P('soppPharmaUrl', v), { type: 'url', placeholder: 'https://…' }))),
    A('Application', globalThis.__installPrompt ? btn('Installer G.E.N.I.S', async () => { globalThis.__installPrompt.prompt(); await globalThis.__installPrompt.userChoice; globalThis.__installPrompt = null; }, 'primary') : h('p', { class: 'why' }, 'Installation : menu du navigateur › « Installer l’application » (Chrome, Edge) ou Partager › « Sur l’écran d’accueil » (iPhone, iPad).'), h('p', { class: 'why' }, 'G.E.N.I.S v3 · PWA · données locales · passerelle optionnelle.')));
  if (!body.dataset.opened) { body.dataset.opened = '1'; body.querySelector('details')?.setAttribute('open', ''); }
}
const RENDER = { history, apps, memory, automations, notifications, settings };
export function renderPanel(name, body, api) { body.replaceChildren(); delete body.dataset.opened; RENDER[name]?.(body, api); }
