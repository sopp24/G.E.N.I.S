/* G.E.N.I.S — coffre de secrets. AES-GCM, clé d'appareil NON exportable conservée dans IndexedDB.
   Limite honnête : protège contre la copie/l'export du stockage, pas contre un appareil compromis ou un script injecté. */
import { store } from './storage.js';
let keyPromise = null;
const b64 = u8 => btoa(String.fromCharCode(...u8));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('genis-vault', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const wrap = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
function deviceKey() {
  keyPromise ??= (async () => {
    let db = null;
    try { db = await idb(); const k = await wrap(db.transaction('k').objectStore('k').get('device')); if (k) return k; } catch {}
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    try { if (db) await wrap(db.transaction('k', 'readwrite').objectStore('k').put(key, 'device')); } catch { /* clé de session seulement */ }
    return key;
  })();
  return keyPromise;
}
export async function vaultSet(name, value) {
  const key = await deviceKey(), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(value))));
  store.update('vault', v => ({ ...v, [name]: { iv: b64(iv), ct: b64(ct) } }), {});
}
export async function vaultGet(name) {
  const rec = store.get('vault', {})[name]; if (!rec) return '';
  try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv) }, await deviceKey(), unb64(rec.ct))); } catch { return ''; }
}
export const vaultHas = name => !!store.get('vault', {})[name];
export const vaultDelete = name => store.update('vault', v => { const { [name]: _, ...rest } = v; return rest; }, {});
