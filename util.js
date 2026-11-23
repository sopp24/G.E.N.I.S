/* G.E.N.I.S — utilitaires partagés : bus d'événements, DOM sûr, texte, temps. Aucun effet de bord à l'import. */
const listeners = new Map();
export const bus = {
  on(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); return () => listeners.get(type)?.delete(fn); },
  emit(type, detail) { for (const fn of [...(listeners.get(type) || [])]) { try { fn(detail); } catch (e) { console.error('[G.E.N.I.S bus]', type, e); } } }
};
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const sleep = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('Interrompu', 'AbortError')); }, { once: true });
});
export const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const STOP = new Set('le la les un une des de du d l et ou a au aux en dans sur pour par avec sans que qui quoi dont ce cet cette ces mon ma mes ton ta tes son sa ses notre votre leur nos vos je tu il elle on nous vous ils elles me te se y ne pas plus est es suis sont etait avait ai as avons avez ont fait faire peux peut veux veut cherche trouve mets met donne dis moi toi lui si au'.split(' '));
export const tokens = s => norm(s).split(/[^a-z0-9]+/).filter(t => t.length > 1 && !STOP.has(t));
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function safeUrl(u) { try { const x = new URL(u); return x.protocol === 'https:' ? x.href : ''; } catch { return ''; } }
export function withTimeout(p, ms, message = 'Le service met trop de temps à répondre.') {
  let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error(message), { code: 'TIMEOUT' })), ms); })]).finally(() => clearTimeout(t));
}
const SENSITIVE = /token|secret|passw|passphrase|authorization|api[-_]?key|cookie|bearer|credential/i;
/** Retire tout ce qui ressemble à un identifiant avant d'envoyer des données à un modèle d'IA. */
export function sanitizeForModel(v, depth = 0) {
  if (v == null || depth > 6) return v ?? null;
  if (typeof v === 'string') return v.length > 6000 ? v.slice(0, 6000) + '…[tronqué]' : v;
  if (typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.slice(0, 40).map(x => sanitizeForModel(x, depth + 1));
  const out = {};
  for (const [k, x] of Object.entries(v)) if (!SENSITIVE.test(k)) out[k] = sanitizeForModel(x, depth + 1);
  return out;
}
export const fmt = {
  time: d => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  date: d => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
  dateTime: d => new Date(d).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
  money: (n, cur = 'EUR') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(Number(n) || 0),
  bytes: n => n > 1e6 ? (n / 1e6).toFixed(1) + ' Mo' : n > 1e3 ? Math.round(n / 1e3) + ' Ko' : n + ' o',
  left: ms => { const s = Math.max(0, Math.round(ms / 1000)); return s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}` : s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`; }
};
const PROPS = new Set(['value', 'checked', 'disabled', 'hidden', 'selected', 'open', 'textContent']);
/** Création DOM sans innerHTML : h('button', {class:'btn', onclick}, 'Texte'). */
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (PROPS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) { if (kid == null || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); }
  return el;
}
export function icon(name, cls = '') {
  const NS = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', ('i ' + cls).trim()); s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#i-' + name); s.append(u); return s;
}
export function download(filename, content, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: type + ';charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const coded = (code, message) => Object.assign(new Error(message || code), { code, ...(message ? { userMessage: message } : {}) });
/** fetch JSON avec délai, erreurs typées (NETWORK, TIMEOUT, RATE_LIMIT, NOT_FOUND, FAILED). */
export async function getJson(url, { signal, timeout = 15000, method = 'GET', body, headers } = {}) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), timeout);
  signal?.addEventListener('abort', () => ctrl.abort(), { once: true });
  try {
    const r = await fetch(url, { method, body, headers, signal: ctrl.signal });
    if (r.status === 429) throw coded('RATE_LIMIT');
    if (!r.ok) throw coded(r.status === 404 ? 'NOT_FOUND' : 'FAILED', `Le service a répondu avec une erreur (${r.status}).`);
    return await r.json();
  } catch (e) { if (signal?.aborted) throw e; if (e.code) throw e; throw coded(ctrl.signal.aborted ? 'TIMEOUT' : 'NETWORK'); } finally { clearTimeout(t); }
}
/** Fichier calendrier .ics (avec alarme native optionnelle) : le moyen fiable de déclencher un réveil sur n'importe quel appareil. */
export function toIcs(events) {
  const z = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''), e2 = s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//G.E.N.I.S//FR', 'CALSCALE:GREGORIAN'];
  for (const e of events) L.push('BEGIN:VEVENT', `UID:${uid('ics')}@genis`, `DTSTAMP:${z(Date.now())}`, `DTSTART:${z(e.start)}`, `DTEND:${z(e.end || new Date(+new Date(e.start) + 36e5))}`, `SUMMARY:${e2(e.title)}`, ...(e.location ? [`LOCATION:${e2(e.location)}`] : []), ...(e.description ? [`DESCRIPTION:${e2(e.description)}`] : []), ...(e.alarm ? ['BEGIN:VALARM', 'TRIGGER:PT0S', 'ACTION:DISPLAY', `DESCRIPTION:${e2(e.title)}`, 'END:VALARM'] : []), 'END:VEVENT');
  return [...L, 'END:VCALENDAR'].join('\r\n');
}
export const toast = (message, kind = 'info') => bus.emit('toast', { message, kind });
