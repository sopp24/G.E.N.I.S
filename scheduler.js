/* G.E.N.I.S — minuteurs, rappels, réveils internes. Limite assumée : une PWA ne peut pas se réveiller seule quand elle est fermée.
   Au retour dans l'application, les échéances dépassées sont signalées (« manqué ») et non rejouées en silence. Pour une alarme fiable, utiliser l'export calendrier (.ics). */
import { store } from './storage.js';
import { bus, uid } from './util.js';
import { notify } from './notifications.js';
export const listTimers = () => store.get('timers', []);
export const activeTimers = () => listTimers().filter(t => t.status === 'running').sort((a, b) => a.dueAt - b.dueAt);
export function addTimer({ kind = 'timer', label = '', dueAt, repeatDaily = false }) {
  const t = { id: uid('tm'), kind, label, dueAt, createdAt: Date.now(), status: 'running', repeatDaily };
  store.set('timers', [t, ...listTimers()].slice(0, 100)); schedule(); bus.emit('timers'); return t;
}
export function cancelTimer(id) { store.update('timers', l => l.map(t => (t.id === id && t.status === 'running' ? { ...t, status: 'cancelled' } : t)), []); schedule(); bus.emit('timers'); }
export function clearFinishedTimers() { store.update('timers', l => l.filter(t => t.status === 'running'), []); bus.emit('timers'); }
const tickers = new Set(); let loop = 0, started = false;
export const onTick = fn => { tickers.add(fn); return () => tickers.delete(fn); };
function fire(t, late = false) {
  store.update('timers', l => l.map(x => (x.id === t.id ? { ...x, status: late ? 'missed' : 'done', firedAt: Date.now() } : x)), []);
  const title = t.kind === 'alarm' ? 'Réveil' : t.kind === 'reminder' ? 'Rappel' : 'Minuteur terminé';
  notify({ title: late ? `${title} manqué` : title, body: t.label || (late ? 'Échéance dépassée pendant que G.E.N.I.S était fermé.' : ''), kind: late ? 'warn' : 'success', sound: !late });
  bus.emit('timer:fired', { ...t, late });
  if (t.repeatDaily) addTimer({ kind: t.kind, label: t.label, dueAt: t.dueAt + 864e5, repeatDaily: true });
}
function sweep(initial = false) {
  const now = Date.now();
  for (const t of activeTimers()) if (t.dueAt <= now) fire(t, initial ? now - t.dueAt > 90000 : false);
}
function schedule() {
  clearTimeout(loop); if (!started) return;
  const next = activeTimers()[0]?.dueAt ?? Infinity;
  loop = setTimeout(tick, Math.min(15000, Math.max(250, next - Date.now())));
}
function tick() { sweep(); const now = new Date(); for (const fn of tickers) { try { fn(now); } catch (e) { console.error(e); } } schedule(); }
export function startScheduler() {
  if (started) return; started = true; sweep(true); schedule();
  globalThis.document?.addEventListener('visibilitychange', () => { if (!document.hidden) { sweep(true); schedule(); } });
}
export function stopScheduler() { started = false; clearTimeout(loop); }
