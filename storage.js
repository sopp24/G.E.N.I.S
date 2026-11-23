/* G.E.N.I.S — stockage local. Cache mémoire synchrone adossé à IndexedDB (repli : mémoire seule).
   Les valeurs lues doivent être traitées comme immuables : utiliser store.update() ou store.set(). */
import { bus } from './util.js';
const DB = 'genis', STORE = 'kv';
const cache = new Map(), dirty = new Set();
let db = null, timer = 0, mode = 'memory', lastError = '';

const openDb = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked'));
});
export async function initStorage() {
  try {
    db = await openDb();
    await new Promise((res, rej) => {
      const rq = db.transaction(STORE).objectStore(STORE).openCursor();
      rq.onsuccess = () => { const c = rq.result; if (c) { cache.set(c.key, c.value); c.continue(); } else res(); };
      rq.onerror = () => rej(rq.error);
    });
    mode = 'indexeddb';
  } catch (e) { db = null; mode = 'memory'; lastError = e?.name || 'IndexedDB'; }
  globalThis.addEventListener?.('pagehide', flush);
  globalThis.document?.addEventListener?.('visibilitychange', () => { if (document.hidden) flush(); });
  return mode;
}
const schedule = () => { clearTimeout(timer); timer = setTimeout(flush, 250); };
export async function flush() {
  clearTimeout(timer);
  if (!dirty.size || !db) return;
  const keys = [...dirty]; dirty.clear();
  try {
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite'), st = tx.objectStore(STORE);
      for (const k of keys) cache.has(k) ? st.put(cache.get(k), k) : st.delete(k);
      tx.oncomplete = res; tx.onerror = tx.onabort = () => rej(tx.error);
    });
    lastError = '';
  } catch (e) { lastError = e?.name || 'WriteError'; keys.forEach(k => dirty.add(k)); }
}
export const store = {
  get: (k, fb) => (cache.has(k) ? cache.get(k) : fb),
  set(k, v) { cache.set(k, v); dirty.add(k); schedule(); return v; },
  update(k, fn, fb) { const next = fn(cache.has(k) ? cache.get(k) : fb); if (next !== undefined) store.set(k, next); return cache.get(k); },
  remove(k) { cache.delete(k); dirty.add(k); schedule(); },
  keys: (prefix = '') => [...cache.keys()].filter(k => k.startsWith(prefix)),
  get mode() { return mode; },
  get warning() { return mode === 'memory' ? 'Stockage persistant indisponible : les données seront perdues à la fermeture.' : lastError ? 'Écriture locale impossible (espace plein ?).' : ''; }
};
export const DEFAULT_SETTINGS = {
  gatewayUrl: '', provider: 'auto', modelFast: '', modelSmart: '',
  userName: '', defaultCity: '', lang: 'fr-FR',
  voiceEnabled: true, speakReplies: 'voice', ttsEngine: 'auto', voiceName: '', speechRate: 1, speechPitch: 1, volume: 1, emotion: true,
  listenMode: 'conversation', wakeWord: false, micVisualizer: 'auto', voiceConfirm: false,
  learnHabits: 'ask', accent: 'white', motion: 'full', waveIntensity: 1, fontScale: 1,
  soppLanguageUrl: '', soppPharmaUrl: ''
};
export const getSettings = () => ({ ...DEFAULT_SETTINGS, ...store.get('settings', {}) });
export function patchSettings(p) { store.set('settings', { ...store.get('settings', {}), ...p }); bus.emit('settings', getSettings()); }
export async function usage() {
  try { const e = await navigator.storage.estimate(); return { used: e.usage || 0, quota: e.quota || 0, mode }; } catch { return { used: 0, quota: 0, mode }; }
}
export const requestPersistence = async () => { try { return await navigator.storage.persist(); } catch { return false; } };
const SECRET_KEYS = new Set(['vault', 'secure']);
export function exportAll({ secrets = false } = {}) {
  const data = {};
  for (const [k, v] of cache) if (!k.startsWith('meta:') && (secrets || !SECRET_KEYS.has(k))) data[k] = v;
  return { app: 'G.E.N.I.S', version: 3, exportedAt: new Date().toISOString(), data };
}
const IMPORTABLE = /^(settings|permissions|chats:index|chat:|memories|automations|timers|notifications|spaces|trips|wishlist|actions|habits|suggestions)/;
export function importAll(obj) {
  if (obj?.app !== 'G.E.N.I.S' || typeof obj.data !== 'object') throw new Error('Fichier de sauvegarde non reconnu.');
  let n = 0;
  for (const [k, v] of Object.entries(obj.data)) if (IMPORTABLE.test(k)) { store.set(k, v); n++; }
  return n;
}
export async function wipe() {
  cache.clear(); dirty.clear(); clearTimeout(timer);
  try { if (db) await new Promise((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).clear(); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); } catch {}
  try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith('genis:')) localStorage.removeItem(k); } } catch {}
  try { indexedDB.deleteDatabase('genis-vault'); } catch {}
}
