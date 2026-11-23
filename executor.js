/* G.E.N.I.S — exécuteur d'actions : validation → politique de sécurité → confirmation → exécution → vérification → trace.
   Tout appel d'outil, qu'il vienne de l'IA, du moteur local ou d'une automatisation, passe par ici. Le modèle ne peut ni sauter la confirmation ni émettre de jeton d'authentification forte. */
import { bus, uid, withTimeout, sanitizeForModel } from './util.js';
import { find, statusOf, fail, ERRORS } from './connectors.js';
import { evaluate } from './security.js';
import { setPerm, setConfirmMode } from './permissions.js';
import { consumeToken } from './strong-auth.js';
import { store } from './storage.js';
import { addPending } from './notifications.js';

const hooks = { confirm: async () => 'deny', permission: async () => 'deny', strong: async () => ({ ok: false }) };
export const setHooks = h => Object.assign(hooks, h);

export function validateArgs(cap, args = {}) {
  const out = { ...args }, props = cap.params || {};
  for (const k of cap.required || []) if (out[k] === undefined || out[k] === null || out[k] === '') return { error: `Il manque l’information « ${k} ».` };
  for (const [k, spec] of Object.entries(props)) {
    if (out[k] === undefined || out[k] === null) { delete out[k]; continue; }
    if (spec.type === 'number' || spec.type === 'integer') {
      const n = typeof out[k] === 'string' ? Number(out[k].replace(',', '.')) : out[k];
      if (!Number.isFinite(n)) return { error: `« ${k} » doit être un nombre.` }; out[k] = spec.type === 'integer' ? Math.round(n) : n;
    } else if (spec.type === 'boolean') out[k] = out[k] === true || out[k] === 'true' || out[k] === 'oui';
    else if (spec.type === 'string') out[k] = String(out[k]).slice(0, spec.maxLength || 4000);
    else if (spec.type === 'array' && !Array.isArray(out[k])) return { error: `« ${k} » doit être une liste.` };
    if (spec.enum && !spec.enum.includes(out[k])) return { error: `« ${k} » doit valoir : ${spec.enum.join(', ')}.` };
  }
  return { args: out };
}
const SECRETISH = /token|secret|passw|key|cookie|authorization/i;
export const summarizeArgs = args => Object.entries(args || {}).filter(([k]) => !SECRETISH.test(k)).map(([label, v]) => ({ label, value: (typeof v === 'string' ? v : JSON.stringify(v)).slice(0, 240) }));
function fromError(e) {
  if (e?.name === 'AbortError') return { status: 'cancelled', verified: false, summary: 'Interrompu.' };
  const code = e?.code && ERRORS[e.code] ? e.code : e instanceof TypeError ? 'NETWORK' : 'FAILED';
  return fail(code, e?.userMessage || (code === 'FAILED' && e?.message && !/^[A-Z_]+$/.test(e.message) ? e.message : ERRORS[code]));
}
const STEP_STATUS = { done: 'done', unverified: 'unverified', needs_manual: 'manual', failed: 'failed', cancelled: 'cancelled', denied: 'cancelled' };
export const listActions = () => store.get('actions', []);
export const clearActions = () => store.set('actions', []);
export async function execute(call, ctx = {}) {
  const callId = call.id || uid('call'), t0 = Date.now(), entry = find(call.name);
  const emit = (status, extra = {}) => bus.emit('step', { id: callId, runId: ctx.runId, spaceId: ctx.spaceId, status, ...extra });
  const finish = (res, level = 1) => {
    res = { verified: false, data: {}, summary: '', ...res, callId, tool: call.name, level, ms: Date.now() - t0 };
    if (res.status === 'done' && level >= 3 && res.verified !== true) res.status = 'unverified';
    if (res.status === 'done' && level < 3 && res.verified === false) res.verified = true;
    emit(STEP_STATUS[res.status] || 'blocked', { label: entry?.cap.label || call.name, summary: res.summary });
    const rec = { id: callId, at: Date.now(), tool: call.name, connector: entry?.connector.name || '?', label: entry?.cap.label || call.name, status: res.status, verified: !!res.verified, summary: String(res.summary || '').slice(0, 300), args: JSON.stringify(sanitizeForModel(call.args || {})).slice(0, 500), level, space: ctx.spaceId || '', source: ctx.source || 'user' };
    store.set('actions', [rec, ...listActions()].slice(0, 400)); bus.emit('action', rec);
    return res;
  };
  if (!entry) return finish(fail('UNKNOWN_TOOL', `Je ne connais pas l’outil « ${call.name} ».`));
  const { connector, cap } = entry, label = cap.progress || cap.label || call.name;
  emit('running', { label, connector: connector.name, level: cap.level || 1 });
  const v = validateArgs(cap, call.args); if (v.error) return finish(fail('BAD_INPUT', v.error), cap.level);
  const args = v.args, st = statusOf(connector);
  if (st.state === 'needs_config') return finish({ status: 'needs_config', summary: st.detail || `${connector.name} n’est pas encore configuré.`, error: { code: 'NO_CONFIG', message: st.detail || '' }, next: { kind: 'configure', label: 'Ouvrir les réglages' } }, cap.level);
  if (st.state === 'needs_auth') return finish({ status: 'needs_auth', summary: st.detail || ERRORS.AUTH_REQUIRED, error: { code: 'AUTH_REQUIRED', message: ERRORS.AUTH_REQUIRED }, next: { kind: 'accounts', label: 'Comptes connectés' } }, cap.level);
  if (st.state === 'prepared' || st.state === 'planned') return finish({ status: 'needs_config', summary: `${connector.name} est ${st.state === 'planned' ? 'prévu' : 'préparé'} mais pas encore actif.`, error: { code: 'NO_CONFIG', message: '' } }, cap.level);

  const eff = cap.permissionFor ? { ...cap, permission: cap.permissionFor(args) } : cap, ev = { ambiguous: ctx.ambiguous, escalate: cap.escalate?.(args) || 0 };
  let decision = evaluate(eff, args, ev);
  if (decision.decision === 'ask_permission') {
    if (ctx.interactive === false) return finish({ status: 'denied', summary: `Permission requise (« ${decision.reason} ») : ouvrez G.E.N.I.S pour l’accorder.` }, decision.level);
    emit('waiting', { label: 'Autorisation requise' });
    const ans = await hooks.permission({ permission: decision.permission, connector: connector.name, capability: cap.label, why: decision.reason });
    if (ans === 'deny') return finish({ status: 'denied', summary: 'Permission refusée.' }, decision.level);
    if (ans === 'always') setPerm(decision.permission, 'granted');
    decision = evaluate(eff, args, { ...ev, permissionGranted: true });
  }
  if (decision.decision === 'deny') return finish({ status: 'denied', summary: decision.reason, error: { code: 'DENIED', message: decision.reason } }, decision.level);
  let authToken = null;
  if (decision.decision === 'confirm' || decision.decision === 'strong') {
    if (ctx.interactive === false) {
      addPending({ call: { name: call.name, args }, label, connector: connector.name, ruleId: ctx.ruleId });
      return finish({ status: 'needs_confirmation', summary: `« ${label} » attend votre confirmation (voir Notifications).` }, decision.level);
    }
    let preview = null; try { preview = await cap.preview?.(args, ctx); } catch {}
    emit('waiting', { label: 'En attente de votre confirmation' });
    const view = { title: cap.label, connector: connector.name, summary: preview?.summary || label, details: preview?.details || summarizeArgs(args), warnings: preview?.warnings || [], level: decision.level, permission: eff.permission, why: decision.reason };
    if (decision.decision === 'confirm') {
      const ans = await hooks.confirm({ ...view, offerAlways: decision.level === 3 && !!eff.permission });
      if (ans === 'deny') return finish({ status: 'cancelled', summary: 'Action annulée.' }, decision.level);
      if (ans === 'always' && eff.permission) setConfirmMode(eff.permission, 'auto');
    } else {
      const r = await hooks.strong({ ...view, actionId: callId });
      if (!r?.ok) return finish({ status: 'cancelled', summary: 'Authentification refusée ou annulée : rien n’a été fait.' }, decision.level);
      authToken = r.token;
    }
  }
  if (decision.level >= 4 && !consumeToken(authToken, callId)) return finish(fail('AUTH_REQUIRED', 'Authentification forte absente : action bloquée.'), decision.level);
  let res;
  try { res = await withTimeout(Promise.resolve(cap.run(args, { ...ctx, callId, step: detail => emit('running', { label, detail }) })), cap.timeout || 30000); }
  catch (e) { res = fromError(e); }
  return finish(res || fail('FAILED', ERRORS.FAILED), decision.level);
}
/** Vue envoyée au modèle : statut, vérification, résumé et données nettoyées (jamais de jeton ni de secret). */
export const modelView = r => ({ status: r.status, verified: !!r.verified, summary: r.summary, data: sanitizeForModel(r.data), error: r.error ? { code: r.error.code, message: r.error.message } : undefined, next: r.next ? { kind: r.next.kind, label: r.next.label, url: r.next.url } : undefined });
