/* G.E.N.I.S — client de la passerelle (Cloudflare Worker). Le navigateur ne détient jamais de clé d'API de fournisseur :
   seul le secret d'application (coffre chiffré) circule, et il n'est jamais affiché ni transmis à un modèle. */
import { getSettings } from './storage.js';
import { vaultGet, vaultSet, vaultDelete } from './vault.js';
export class GatewayError extends Error {
  constructor(code, message, status = 0) { super(message); this.name = 'GatewayError'; this.code = code; this.userMessage = message; this.status = status; }
}
const FRIENDLY = {
  401: 'Le secret de la passerelle est refusé : vérifiez-le dans Réglages › Passerelle IA.',
  403: 'Cette origine n’est pas autorisée par la passerelle (variable ALLOWED_ORIGIN).',
  404: 'La passerelle ne connaît pas cette route : redéployez la dernière version de worker.js.',
  413: 'La requête est trop volumineuse.', 429: 'Trop de requêtes : réessayez dans un instant.',
  502: 'Le fournisseur d’IA a renvoyé une erreur.', 503: 'Ce service n’est pas configuré côté passerelle.'
};
let secretCache = null;
export const isConfigured = () => !!getSettings().gatewayUrl;
export async function setGatewaySecret(v) { secretCache = v || ''; if (v) await vaultSet('gatewaySecret', v); else vaultDelete('gatewaySecret'); }
export async function hasGatewaySecret() { secretCache ??= await vaultGet('gatewaySecret'); return !!secretCache; }
async function conf() {
  const s = getSettings();
  if (!s.gatewayUrl) throw new GatewayError('NO_CONFIG', 'Aucune passerelle IA n’est configurée : ouvrez Réglages › Passerelle IA.');
  secretCache ??= await vaultGet('gatewaySecret');
  return { url: s.gatewayUrl.replace(/\/+$/, ''), secret: secretCache, s };
}
async function call(path, { method = 'POST', body, signal, raw = false, headers = {}, timeout = 60000 } = {}) {
  const { url, secret } = await conf(), ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), timeout);
  signal?.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true });
  let res;
  try {
    res = await fetch(url + path, { method, signal: ctrl.signal, headers: { ...(raw ? {} : body != null ? { 'content-type': 'application/json' } : {}), 'x-app-secret': secret, ...headers }, body: body == null ? undefined : raw ? body : JSON.stringify(body) });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new GatewayError(e?.name === 'TimeoutError' || ctrl.signal.aborted ? 'TIMEOUT' : 'NETWORK', e?.name === 'TimeoutError' || ctrl.signal.aborted ? 'La passerelle met trop de temps à répondre.' : 'Impossible de joindre la passerelle : vérifiez l’URL, la connexion et le CORS.');
  } finally { clearTimeout(timer); }
  if (!res.ok) {
    let data = null; try { data = await res.json(); } catch {}
    const msg = data?.error?.message || (typeof data?.error === 'string' ? data.error : '');
    throw new GatewayError(res.status === 401 ? 'AUTH' : data?.error?.code || 'GATEWAY', FRIENDLY[res.status] && !msg ? FRIENDLY[res.status] : msg || FRIENDLY[res.status] || `Erreur de la passerelle (${res.status}).`, res.status);
  }
  return res;
}
export const API_VERSION = 3;
export async function health() { const r = await call('/', { method: 'GET', timeout: 12000 }); return r.json(); }
export async function chat({ system, messages, tools, tier = 'fast', signal }) {
  const { s } = await conf();
  const r = await call('/chat', { signal, body: { system, messages, tools, tier, provider: s.provider === 'auto' ? undefined : s.provider, model: (tier === 'smart' ? s.modelSmart : s.modelFast) || undefined } });
  return r.json();
}
export async function tts({ text, style, signal }) { return (await call('/tts', { signal, body: { text, style }, timeout: 30000 })).arrayBuffer(); }
export async function stt(blob, signal) { return (await call('/stt', { signal, raw: true, body: blob, headers: { 'content-type': blob.type || 'audio/webm' }, timeout: 30000 })).json(); }
export async function action(connector, name, params, signal) {
  const r = await call('/action', { signal, body: { connector, action: name, params }, timeout: 30000 }), d = await r.json();
  if (!d.ok) throw Object.assign(new GatewayError(d.error?.code || 'FAILED', d.error?.message || 'L’action a échoué.'), { scope: d.error?.scope });
  return d.data;
}
export const accounts = async () => (await call('/accounts', { method: 'GET', timeout: 12000 })).json();
export const oauthStart = async scopes => (await call('/oauth/google/start', { body: { scopes }, timeout: 12000 })).json();
export const oauthRevoke = async () => (await call('/oauth/google/revoke', { body: {}, timeout: 15000 })).json();
export const feed = async (source, signal) => (await call(`/proxy/feed?source=${encodeURIComponent(source)}`, { method: 'GET', signal, timeout: 20000 })).json();
export const deezer = async (path, params = {}, signal) => (await call(`/proxy/deezer?${new URLSearchParams({ path, ...params })}`, { method: 'GET', signal, timeout: 15000 })).json();
