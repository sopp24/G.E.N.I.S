/* G.E.N.I.S — authentification forte (paiements et actions sensibles).
   Principe : phrase secrète (saisie OU dictée) + deux touches/pastilles maintenues ensemble ≥ 1,2 s, avec événements « de confiance » uniquement.
   La phrase n'est jamais stockée ni affichée ni transmise à une IA : seul un dérivé PBKDF2 salé est conservé.
   C'est une couche de sécurité supplémentaire, pas une garantie absolue : pour un vrai paiement, l'authentification native de la banque reste requise. */
import { store } from './storage.js';
import { norm } from './util.js';
const ITER = 310000, TOKEN_TTL = 90000, HOLD_MS = 1200;
const enc = new TextEncoder();
const b64 = u8 => btoa(String.fromCharCode(...u8));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const normalizeSecret = s => norm(s).replace(/[^a-z0-9]+/g, '');
async function derive(secret, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(normalizeSecret(secret)), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
}
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };
export const isConfigured = () => !!store.get('secure', null)?.hash;
export const holdMs = HOLD_MS;
export const chordKeys = () => store.get('secure', null)?.chord || ['ControlLeft', 'ShiftLeft'];
export function weakness(p) {
  if (normalizeSecret(p).length < 14) return 'Utilisez au moins 14 caractères (une phrase de 3 mots ou plus).';
  if (String(p).trim().split(/\s+/).length < 3) return 'Utilisez une phrase d’au moins 3 mots.';
  return '';
}
const makeRecovery = () => [...crypto.getRandomValues(new Uint8Array(12))].map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('').match(/.{4}/g).join('-');
export async function configure({ passphrase, chord = ['ControlLeft', 'ShiftLeft'], iter = ITER }) {
  const problem = weakness(passphrase); if (problem) throw new Error(problem);
  const salt = crypto.getRandomValues(new Uint8Array(16)), rsalt = crypto.getRandomValues(new Uint8Array(16)), recovery = makeRecovery();
  store.set('secure', { v: 1, iter, salt: b64(salt), hash: b64(await derive(passphrase, salt, iter)), rsalt: b64(rsalt), rhash: b64(await derive(recovery, rsalt, iter)), chord, fails: 0, until: 0, createdAt: Date.now() });
  return { recoveryCode: recovery };
}
export const lockRemaining = () => Math.max(0, (store.get('secure', null)?.until || 0) - Date.now());
export async function verify(passphrase) {
  const s = store.get('secure', null); if (!s) return { ok: false, reason: 'not_configured' };
  const wait = lockRemaining(); if (wait > 0) return { ok: false, reason: 'locked', wait };
  if (same(await derive(passphrase, unb64(s.salt), s.iter), unb64(s.hash))) { store.set('secure', { ...s, fails: 0, until: 0 }); return { ok: true }; }
  const fails = (s.fails || 0) + 1, until = fails >= 3 ? Date.now() + Math.min(900000, 30000 * 2 ** (fails - 3)) : 0;
  store.set('secure', { ...s, fails, until }); return { ok: false, reason: 'wrong', fails, wait: until ? until - Date.now() : 0 };
}
export async function recover(code, newPassphrase) {
  const s = store.get('secure', null); if (!s) throw new Error('Aucun secret configuré.');
  if (!same(await derive(code, unb64(s.rsalt), s.iter), unb64(s.rhash))) throw new Error('Code de récupération incorrect.');
  return configure({ passphrase: newPassphrase, chord: s.chord, iter: s.iter });
}
export const resetSecure = () => store.remove('secure');
export function setChord(chord) { store.update('secure', s => (s ? { ...s, chord } : s), null); }
/* Jetons à usage unique, liés à une action précise : seul le flux d'authentification forte peut en émettre. */
const tokens = new Map();
export function issueToken(actionId) {
  const t = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  tokens.set(t, { actionId, exp: Date.now() + TOKEN_TTL }); return t;
}
export function consumeToken(token, actionId) { const r = tokens.get(token); tokens.delete(token); return !!r && r.actionId === actionId && r.exp > Date.now(); }
/* Suivi des deux touches : seuls les événements isTrusted (clavier réel) comptent ; les pastilles tactiles sont alimentées par l'interface. */
const held = new Set(), pads = new Set(); let tracking = false;
export function trackChord() {
  if (tracking) return; tracking = true;
  addEventListener('keydown', e => { if (e.isTrusted) held.add(e.code); }, true);
  addEventListener('keyup', e => held.delete(e.code), true);
  addEventListener('blur', () => { held.clear(); pads.clear(); });
  document.addEventListener('visibilitychange', () => { held.clear(); pads.clear(); });
}
export const padDown = id => pads.add(id), padUp = id => pads.delete(id);
export const chordHeld = () => chordKeys().every(k => held.has(k)) || pads.size >= 2;
