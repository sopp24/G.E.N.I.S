/* G.E.N.I.S — dates, heures et durées en français naturel (sans dépendance). */
import { norm } from './util.js';
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const NUM = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, quinze: 15, vingt: 20, trente: 30, quarante: 40, cinquante: 50 };
const W = Object.keys(NUM).join('|'), MON = MONTHS.join('|'), DAY = DAYS.join('|');
const num = s => (/^\d+$/.test(s) ? +s : NUM[s]);
export const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** « 10 minutes », « 1h30 », « un quart d'heure » → minutes (ou null). */
export function parseDuration(text) {
  const t = norm(text).replace(/,/g, '.'); let total = 0, found = false;
  if (/quart d.?heure/.test(t)) { total += 15; found = true; }
  if (/demi.?heure/.test(t)) { total += 30; found = true; }
  const re = new RegExp(`(\\d+(?:\\.\\d+)?|${W})\\s*(secondes?|sec|minutes?|min|heures?|h)(?![a-z])\\s*(?:et\\s*)?(demie?|quart|\\d{1,2})?`, 'g');
  for (const m of t.matchAll(re)) {
    const n = m[1] in NUM ? NUM[m[1]] : parseFloat(m[1]), u = m[2];
    if (/^s/.test(u)) total += n / 60;
    else if (/^m/.test(u)) total += n;
    else { total += n * 60; if (m[3]) total += /^dem/.test(m[3]) ? 30 : m[3] === 'quart' ? 15 : +m[3]; }
    found = true;
  }
  return found ? total : null;
}
/** « à 8h », « 19:45 », « midi », « 8h ce soir » → {h, m} (ou null). */
export function parseTimeOfDay(text) {
  const t = norm(text);
  if (/\bmidi\b/.test(t)) return { h: 12, m: 0 };
  if (/\bminuit\b/.test(t)) return { h: 0, m: 0 };
  let h, mi = 0, m = t.match(/\b(\d{1,2})\s*(?:h|:)(?![a-z])\s*(\d{2})?(?!\d)/);
  if (m) { h = +m[1]; mi = +(m[2] || 0); }
  else if ((m = t.match(new RegExp(`\\b(${W})\\s*heures?\\s*(?:(et\\s*demie?|et\\s*quart|moins\\s*le\\s*quart)|(\\d{2}))?`)))) {
    h = NUM[m[1]]; if (m[2]) { if (/demi/.test(m[2])) mi = 30; else if (/moins/.test(m[2])) { h -= 1; mi = 45; } else mi = 15; } else if (m[3]) mi = +m[3];
  } else return null;
  if (h > 23 || mi > 59) return null;
  if (h <= 11 && /(soir|apres[- ]midi|\bpm\b)/.test(t) && !/matin/.test(t)) h += 12;
  return { h, m: mi };
}
function resolveDMY(d, mon, y, today) {
  const month = mon ?? today.getMonth(), year = y ?? today.getFullYear();
  let date = new Date(year, month, d);
  if (y == null && date < today) date = mon == null ? new Date(year, month + 1, d) : new Date(year + 1, month, d);
  return date.getDate() === d ? date : null;
}
/** Date (minuit local) évoquée dans le texte : demain, vendredi prochain, le 12 décembre, dans 3 jours… */
export function parseDate(text, now = new Date()) {
  const t = norm(text), today = startOfDay(now); let m;
  if (/apres[- ]demain/.test(t)) return addDays(today, 2);
  if (/\bdemain\b/.test(t)) return addDays(today, 1);
  if (/aujourd.?hui|\bce (soir|matin|midi)\b|cet apres[- ]midi|tout a l.?heure/.test(t)) return today;
  if ((m = t.match(new RegExp(`\\bdans\\s+(\\d+|${W})\\s+(jours?|semaines?|mois)\\b`)))) {
    const n = num(m[1]); return /^j/.test(m[2]) ? addDays(today, n) : /^s/.test(m[2]) ? addDays(today, 7 * n) : new Date(today.getFullYear(), today.getMonth() + n, today.getDate());
  }
  if ((m = t.match(new RegExp(`\\b(\\d{1,2})\\s+(${MON})(?:\\s+(\\d{4}))?`)))) return resolveDMY(+m[1], MONTHS.indexOf(m[2]), m[3] ? +m[3] : null, today);
  if ((m = t.match(/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/))) return resolveDMY(+m[1], +m[2] - 1, m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null, today);
  if ((m = t.match(new RegExp(`\\b(${DAY})(?:\\s+(prochain|dernier))?`)))) {
    const target = DAYS.indexOf(m[1]); let diff = (target - today.getDay() + 7) % 7;
    if (m[2] === 'prochain' && diff === 0) diff = 7;
    if (m[2] === 'dernier') diff = -(((today.getDay() - target + 7) % 7) || 7);
    return addDays(today, diff);
  }
  if ((m = t.match(/\ble\s+(\d{1,2})\b/))) return resolveDMY(+m[1], null, null, today);
  return null;
}
/** « du 12 au 15 », « vendredi prochain pour quatre jours » → {from, to} (jours inclus). */
export function parseRange(text, now = new Date()) {
  const t = norm(text), today = startOfDay(now); let m;
  if ((m = t.match(new RegExp(`\\bdu\\s+(\\d{1,2})(?:\\s+(${MON}))?\\s+au\\s+(\\d{1,2})(?:\\s+(${MON}))?(?:\\s+(\\d{4}))?`)))) {
    const mon2 = m[4] ? MONTHS.indexOf(m[4]) : m[2] ? MONTHS.indexOf(m[2]) : null, mon1 = m[2] ? MONTHS.indexOf(m[2]) : mon2, y = m[5] ? +m[5] : null;
    const from = resolveDMY(+m[1], mon1, y, today); if (!from) return null;
    let to = resolveDMY(+m[3], mon2, from.getFullYear(), startOfDay(from)); if (!to) return null;
    if (to < from) to = new Date(to.getFullYear(), to.getMonth() + 1, to.getDate());
    return { from, to };
  }
  const start = parseDate(text, now);
  if (start && (m = t.match(new RegExp(`\\b(?:pendant|pour|durant|de)\\s+(\\d+|${W})\\s+(jours?|nuits?|semaines?)\\b`)))) {
    const n = num(m[1]), days = /^s/.test(m[2]) ? 7 * n : n; return { from: start, to: addDays(start, Math.max(0, days - 1)) };
  }
  return null;
}
/** Jour(s) évoqué(s) au passé pour retrouver une conversation : hier, lundi dernier, la semaine dernière… */
export function dayRange(text, now = new Date()) {
  const t = norm(text), today = startOfDay(now), span = (a, b = a) => ({ from: a, to: new Date(addDays(b, 1).getTime() - 1) });
  if (/avant[- ]hier/.test(t)) return span(addDays(today, -2));
  if (/\bhier\b/.test(t)) return span(addDays(today, -1));
  if (/semaine (derniere|passee)/.test(t)) { const mon = addDays(today, -((today.getDay() + 6) % 7) - 7); return span(mon, addDays(mon, 6)); }
  if (/aujourd.?hui|ce matin|ce soir/.test(t)) return span(today);
  const m = t.match(new RegExp(`\\b(${DAY})(?:\\s+(?:dernier|passe))?`));
  if (m) return span(addDays(today, -(((today.getDay() - DAYS.indexOf(m[1]) + 7) % 7) || 7)));
  const d = parseDate(text, now);
  return d ? span(d > today ? new Date(d.getFullYear() - 1, d.getMonth(), d.getDate()) : d) : null;
}
export const fmtDay = d => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
export const isoDay = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
export function withTime(date, tod) { const x = new Date(date); x.setHours(tod.h, tod.m, 0, 0); return x; }
