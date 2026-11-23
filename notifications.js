/* G.E.N.I.S — notifications : journal local, alerte à l'écran, notification système si l'application est masquée, file de confirmations en attente. */
import { store } from './storage.js';
import { bus, uid } from './util.js';
import { permState, setPerm } from './permissions.js';
import { chime } from './audio.js';
export const listNotifications = () => store.get('notifications', []);
export function notify({ title, body = '', kind = 'info', sound = false, action = null }) {
  const entry = { id: uid('n'), title, body, kind, action, createdAt: Date.now(), read: false };
  store.set('notifications', [entry, ...listNotifications()].slice(0, 100));
  bus.emit('notify', entry);
  if (sound) chime(kind === 'error' ? 'error' : kind === 'success' ? 'success' : 'info');
  if (globalThis.document?.hidden && globalThis.Notification?.permission === 'granted' && permState('notifications.send') === 'granted') {
    const opts = { body, tag: entry.id, icon: 'genis-192.png' };
    navigator.serviceWorker?.ready.then(r => r.showNotification(title, opts)).catch(() => { try { new Notification(title, opts); } catch {} });
  }
  return entry;
}
export const unreadCount = () => listNotifications().filter(n => !n.read).length;
export function markAllRead() { store.set('notifications', listNotifications().map(n => ({ ...n, read: true }))); bus.emit('notify'); }
export function clearNotifications() { store.set('notifications', []); bus.emit('notify'); }
export async function requestSystemPermission() {
  if (!('Notification' in globalThis)) return 'unsupported';
  const p = await Notification.requestPermission(); setPerm('notifications.send', p === 'granted' ? 'granted' : 'denied'); return p;
}
export const listPending = () => store.get('pending', []);
export const addPending = item => { store.set('pending', [{ id: uid('pend'), createdAt: Date.now(), ...item }, ...listPending()].slice(0, 30)); bus.emit('notify'); };
export const removePending = id => { store.set('pending', listPending().filter(p => p.id !== id)); bus.emit('notify'); };
