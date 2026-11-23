/* G.E.N.I.S — registre des connecteurs. Un connecteur = un module indépendant qui déclare :
   id, name, icon, category, agent, auth, limits[], status(), capabilities{ <id>: { label, description, level, permission, params, required, preview?, run, … } }.
   Ajouter un service (ex. Spotify) = créer connector-spotify.js + ajouter son chemin dans MODULES. Rien d'autre à réécrire. */
export const MODULES = ['./connector-genis.js', './connector-system.js', './connector-weather.js', './connector-maps.js', './connector-knowledge.js', './connector-deezer.js', './connector-media.js', './connector-google.js', './connector-travel.js', './connector-booking.js', './connector-shopping.js', './connector-files.js', './connector-sopp.js', './connectors-prepared.js'];
const connectors = new Map(), tools = new Map(), loadErrors = [];
/* Résultats normalisés : status = done | unverified | needs_manual | needs_config | needs_auth | needs_confirmation | denied | cancelled | failed.
   « verified » n'est vrai que si l'action est confirmée par le service ou mesurable localement. G.E.N.I.S n'annonce jamais une réussite sans cela. */
export const ok = (summary, data = {}, extra = {}) => ({ status: 'done', verified: true, summary, data, ...extra });
export const unverified = (summary, data = {}, extra = {}) => ({ status: 'unverified', verified: false, summary, data, ...extra });
export const fail = (code, message, extra = {}) => ({ status: 'failed', verified: false, summary: message, error: { code, message }, ...extra });
export const manual = (summary, link, extra = {}) => ({ status: 'needs_manual', verified: false, summary, next: { kind: 'open_url', url: link.url, label: link.label || 'Ouvrir la page' }, ui: { cards: [{ type: 'links', links: [{ label: link.label || 'Ouvrir la page', url: link.url, primary: true }] }] }, ...extra });
export const needsConfig = (summary, label = 'Ouvrir les réglages') => ({ status: 'needs_config', verified: false, summary, error: { code: 'NO_CONFIG', message: summary }, next: { kind: 'configure', label } });
export const needsAuth = (summary, label = 'Connecter le compte') => ({ status: 'needs_auth', verified: false, summary, error: { code: 'AUTH_REQUIRED', message: summary }, next: { kind: 'accounts', label } });
export const ERRORS = {
  AUTH_REQUIRED: 'Je n’ai pas accès à ce compte. Connectez-le dans Réglages › Comptes connectés.',
  NO_CONFIG: 'Ce service n’est pas encore configuré.', UNSUPPORTED: 'Ce service ne permet pas cette action.', NETWORK: 'Impossible de joindre le service. Vérifiez la connexion.',
  TIMEOUT: 'Le service met trop de temps à répondre.', RATE_LIMIT: 'Trop de requêtes : réessayez dans un instant.', NOT_FOUND: 'Je n’ai rien trouvé correspondant à la demande.',
  BAD_INPUT: 'La demande est incomplète ou invalide.', FAILED: 'L’action a échoué.', MISSING_SCOPE: 'L’autorisation accordée ne couvre pas cette action : reconnectez le compte en acceptant les permissions demandées.'
};
export const toolName = (cid, capId) => `${cid}_${capId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
export function register(c) {
  connectors.set(c.id, c);
  for (const [capId, cap] of Object.entries(c.capabilities || {})) tools.set(toolName(c.id, capId), { name: toolName(c.id, capId), connector: c, capId, cap });
}
export async function loadConnectors(modules = MODULES) {
  for (const path of modules) {
    try { for (const c of [].concat((await import(path)).default)) register(c); }
    catch (e) { loadErrors.push(path); console.error('[G.E.N.I.S] connecteur non chargé :', path, e); }
  }
  return loadErrors;
}
/** Ouvre une page dans un nouvel onglet ; si le navigateur bloque (pas de geste utilisateur), propose un lien à toucher. Jamais de faux succès. */
export function openExternal(url, name = 'la page') {
  let w = null; try { w = globalThis.open(url, '_blank'); if (w) w.opener = null; } catch {}
  return w ? { ...ok(`${name} est ouvert dans un nouvel onglet.`, { url }), brief: true } : manual(`Le navigateur a bloqué l’ouverture automatique : voici le lien vers ${name}.`, { url, label: `Ouvrir ${name}` });
}
export const allConnectors = () => [...connectors.values()];
export const getConnector = id => connectors.get(id);
export const find = name => tools.get(name) || null;
export const allTools = () => [...tools.values()];
export const failedModules = () => [...loadErrors];
export function statusOf(c) { const s = typeof c.status === 'function' ? c.status() : c.status || 'ready'; return typeof s === 'string' ? { state: s } : s; }
export const STATE_LABEL = { ready: 'Disponible', needs_config: 'Configuration requise', needs_auth: 'Connexion requise', prepared: 'Préparé', planned: 'Prévu' };
/** Outils exposés au modèle : uniquement les connecteurs actifs (ou activables), filtrés par agents. */
export function toolSpecs(connectorIds) {
  const out = [];
  for (const t of tools.values()) {
    if (t.cap.hidden || (connectorIds && !connectorIds.has(t.connector.id))) continue;
    const st = statusOf(t.connector).state; if (st === 'planned' || st === 'prepared') continue;
    out.push({ name: t.name, description: `${t.cap.description || t.cap.label} [niveau ${t.cap.level || 1}${st !== 'ready' ? ', ' + STATE_LABEL[st].toLowerCase() : ''}]`, input_schema: { type: 'object', properties: t.cap.params || {}, required: t.cap.required || [] } });
  }
  return out;
}
