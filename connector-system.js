/* Connecteur « Système » : minuteurs, rappels, réveils, heure, calcul, ouverture de services. Tout fonctionne sans compte ni clé. */
import { ok, fail, needsConfig, openExternal } from './connectors.js';
import { addTimer, activeTimers, cancelTimer } from './scheduler.js';
import { findService, serviceUrl, SERVICES } from './services.js';
import { fmt, safeUrl, toIcs } from './util.js';
import { fmtDay } from './datetime-fr.js';
/** Calculatrice sûre (descente récursive, aucun eval) : + - * / ^ % ( ) sqrt abs round floor ceil min max sin cos tan ln log exp pi e. */
export function calculate(input) {
  let s = String(input).toLowerCase().replace(/×/g, '*').replace(/÷/g, '/').replace(/(\d)\s*x\s*(\d)/g, '$1*$2');
  if (!/\b(?:min|max)\b/.test(s)) s = s.replace(/(\d),(\d)/g, '$1.$2');
  if (s.length > 200 || !/^[\d\s+\-*/^().,%a-z]+$/.test(s)) throw new Error('Expression non comprise.');
  const T = s.match(/\d+(?:\.\d+)?|[a-z]+|[-+*/^%(),]/g) || []; let i = 0;
  const FN = { sqrt: Math.sqrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, sin: Math.sin, cos: Math.cos, tan: Math.tan, ln: Math.log, log: Math.log10, exp: Math.exp, min: Math.min, max: Math.max };
  const peek = () => T[i], eat = x => { if (T[i] === x) { i++; return true; } return false; }, need = x => { if (!eat(x)) throw new Error('Expression non comprise.'); };
  function expr() { let v = term(); for (;;) { if (eat('+')) v += term(); else if (eat('-')) v -= term(); else return v; } }
  function term() { let v = unary(); for (;;) { if (eat('*')) v *= unary(); else if (eat('/')) { const d = unary(); if (d === 0) throw new Error('Division par zéro.'); v /= d; } else return v; } }
  function unary() { if (eat('-')) return -unary(); if (eat('+')) return unary(); return power(); }
  function power() { let b = post(); if (eat('^')) b = Math.pow(b, unary()); return b; }
  function post() { let v = primary(); while (eat('%')) v /= 100; return v; }
  function primary() {
    const t = T[i++]; if (t == null) throw new Error('Expression non comprise.');
    if (/^\d/.test(t)) return parseFloat(t);
    if (t === '(') { const v = expr(); need(')'); return v; }
    if (t === 'pi') return Math.PI; if (t === 'e') return Math.E;
    if (FN[t]) { need('('); const a = [expr()]; while (eat(',')) a.push(expr()); need(')'); return FN[t](...a); }
    throw new Error('Expression non comprise.');
  }
  const v = expr(); if (i < T.length || !Number.isFinite(v)) throw new Error('Expression non comprise.');
  return Math.round(v * 1e10) / 1e10;
}
const hhmm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const dur = m => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + Math.round(m % 60) : ''}` : m < 1 ? `${Math.round(m * 60)} s` : `${+m.toFixed(1)} min`);
const LIMIT = 'Ce minuteur sonne tant que G.E.N.I.S reste ouvert : les navigateurs ne permettent pas de réveiller une application fermée.';
export default {
  id: 'system', name: 'Système', icon: 'clock', category: 'Appareil', agent: 'core', auth: { type: 'none' }, status: 'ready',
  limits: ['Minuteurs et réveils : actifs tant que l’application est ouverte (limite des navigateurs). Pour un réveil fiable, exportez-le vers l’agenda de l’appareil (.ics).', 'Ouverture de pages : peut être bloquée par le navigateur sans geste utilisateur.'],
  capabilities: {
    timer_start: { label: 'Minuteur', progress: 'Lancement du minuteur…', description: 'Lance un minuteur (durée en minutes, décimales possibles).', level: 1, params: { minutes: { type: 'number', description: 'Durée en minutes.' }, label: { type: 'string' } }, required: ['minutes'],
      run: ({ minutes, label }) => { if (minutes <= 0 || minutes > 1440) return fail('BAD_INPUT', 'La durée doit être comprise entre quelques secondes et 24 heures.'); const t = addTimer({ kind: 'timer', label, dueAt: Date.now() + minutes * 60000 }); if (!activeTimers().some(x => x.id === t.id)) return fail('FAILED', 'Le minuteur n’a pas pu être enregistré.'); return { ...ok(`Minuteur de ${dur(minutes)} lancé${label ? ` pour « ${label} »` : ''}, il sonnera à ${fmt.time(t.dueAt)}.`, { id: t.id, dueAt: t.dueAt }, minutes > 30 ? { ui: { cards: [{ type: 'note', text: LIMIT }] } } : {}), brief: true }; } },
    timer_list: { label: 'Minuteurs en cours', description: 'Liste les minuteurs, rappels et réveils actifs.', level: 1, params: {}, run: () => { const l = activeTimers(); return ok(l.length ? l.map(t => `${t.label || t.kind} à ${fmt.time(t.dueAt)}`).join(', ') + '.' : 'Aucun minuteur en cours.', { timers: l.map(t => ({ id: t.id, kind: t.kind, label: t.label, dueAt: new Date(t.dueAt).toISOString() })) }); } },
    timer_cancel: { label: 'Annuler un minuteur', description: 'Annule un minuteur par id ou libellé, ou tous.', level: 1, params: { id: { type: 'string' }, label: { type: 'string' }, all: { type: 'boolean' } },
      run: ({ id, label, all }) => { const l = activeTimers().filter(t => all || t.id === id || (label && (t.label || '').toLowerCase().includes(label.toLowerCase()))); if (!l.length) return fail('NOT_FOUND', 'Aucun minuteur correspondant.'); l.forEach(t => cancelTimer(t.id)); return activeTimers().some(t => l.some(x => x.id === t.id)) ? fail('FAILED', 'L’annulation n’a pas pu être confirmée.') : { ...ok(`${l.length} minuteur(s) annulé(s).`), brief: true }; } },
    reminder_set: { label: 'Rappel', progress: 'Programmation du rappel…', description: 'Programme un rappel : soit dans N minutes, soit à une date-heure ISO précise.', level: 1, params: { text: { type: 'string' }, minutes: { type: 'number' }, at: { type: 'string', description: 'Date-heure ISO 8601 locale.' } }, required: ['text'],
      run: ({ text, minutes, at }) => { const due = minutes ? Date.now() + minutes * 60000 : at ? new Date(at).getTime() : NaN; if (!Number.isFinite(due) || due < Date.now() - 1000) return fail('BAD_INPUT', 'Précisez quand je dois vous le rappeler (dans combien de temps, ou à quelle heure).'); const t = addTimer({ kind: 'reminder', label: text, dueAt: due }); return { ...ok(`Je vous le rappellerai à ${fmt.time(due)} : ${text}.`, { id: t.id }, { ui: { cards: [{ type: 'note', text: LIMIT.replace('Ce minuteur sonne', 'Ce rappel sonne') }] } }), brief: true }; } },
    alarm_set: { label: 'Réveil', progress: 'Programmation du réveil…', description: 'Programme un réveil à HH:MM (date optionnelle). Propose aussi un fichier agenda pour une alarme native fiable.', level: 2, params: { time: { type: 'string', description: 'HH:MM' }, date: { type: 'string', description: 'YYYY-MM-DD, optionnel.' }, label: { type: 'string' }, repeat_daily: { type: 'boolean' } }, required: ['time'],
      run: ({ time, date, label, repeat_daily }) => {
        const m = /^(\d{1,2}):(\d{2})$/.exec(time); if (!m || +m[1] > 23 || +m[2] > 59) return fail('BAD_INPUT', 'L’heure du réveil doit être au format HH:MM.');
        const d = date ? new Date(`${date}T00:00`) : new Date(); d.setHours(+m[1], +m[2], 0, 0); if (!date && d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
        const t = addTimer({ kind: 'alarm', label: label || 'Réveil', dueAt: d.getTime(), repeatDaily: !!repeat_daily });
        return ok(`Réveil programmé ${fmtDay(d)} à ${hhmm(d)} dans G.E.N.I.S. Il ne sonnera que si l’application reste ouverte : pour une alarme fiable, ajoutez-le à l’agenda de l’appareil.`, { id: t.id, dueAt: d.toISOString() }, { ui: { cards: [{ type: 'ics', filename: 'reveil-genis.ics', label: 'Ajouter à l’agenda de l’appareil (alarme native)', content: toIcs([{ title: label || 'Réveil', start: d, end: new Date(d.getTime() + 600000), alarm: true }]) }] } });
      } },
    time_now: { label: 'Heure et date', description: 'Donne l’heure et la date actuelles.', level: 1, params: {}, run: () => { const d = new Date(); return ok(`Il est ${hhmm(d)}, ${fmtDay(d)} ${d.getFullYear()}.`, { iso: d.toISOString() }); } },
    calc_eval: { label: 'Calcul', description: 'Évalue une expression mathématique (+ - * / ^ % parenthèses, sqrt, abs, round, min, max, sin, cos, ln, pi…).', level: 1, params: { expression: { type: 'string' } }, required: ['expression'],
      run: ({ expression }) => { try { const v = calculate(expression); return ok(`${expression.trim()} = ${v.toLocaleString('fr-FR')}`, { result: v }); } catch (e) { return fail('BAD_INPUT', e.message); } } },
    open_service: { label: 'Ouvrir un service', progress: 'Ouverture de la page…', description: 'Ouvre un service connu (Deezer, YouTube, Netflix, Gmail, Doctolib, Vinted, SOPP…) ou une adresse https, éventuellement sur une recherche.', level: 2, permission: 'web.open', params: { service: { type: 'string', description: 'Identifiant ou nom du service.' }, query: { type: 'string' }, url: { type: 'string', description: 'Adresse https.' } },
      run: ({ service, query, url }) => {
        const svc = service ? SERVICES.find(s => s.id === service) || findService(service) : null, target = url ? safeUrl(url) : svc ? serviceUrl(svc, query) : '';
        if (!target) return svc ? needsConfig(`${svc.name} n’a pas d’adresse configurée${svc.cat === 'SOPP' || svc.cat === 'Météo' ? ' : renseignez-la dans Réglages › Écosystème SOPP.' : '.'}`) : fail('NOT_FOUND', 'Je ne connais pas ce service, et l’adresse doit commencer par https.');
        return openExternal(target, svc?.name || new URL(target).hostname);
      } }
  }
};
