/* Connecteur « SOPP » : l'écosystème (SOPP Language, Pharma SOPP, SOPP Agents) appelé comme n'importe quel autre outil.
   Pont par postMessage entre origines (contrat documenté dans INTEGRATIONS.md) ; si l'application SOPP ne répond pas, G.E.N.I.S le dit et ouvre la page. */
import { ok, fail, manual, needsConfig, openExternal } from './connectors.js';
import { getSettings } from './storage.js';
import { uid, coded, safeUrl } from './util.js';
import { SERVICES, serviceUrl } from './services.js';
const originOf = u => { try { return new URL(u).origin; } catch { return ''; } };
/** G.E.N.I.S → SOPP : { type:'genis:request', id, action, payload } ; SOPP → G.E.N.I.S : { type:'sopp:response', id, ok, result | error }. */
export function bridgeRequest(url, action, payload, timeout = 8000) {
  return new Promise((resolve, reject) => {
    url = safeUrl(url); const origin = originOf(url); if (!origin) return reject(coded('NO_CONFIG', 'Adresse SOPP invalide : elle doit commencer par https.'));
    const id = uid('br'), f = document.createElement('iframe'); f.hidden = true; f.src = url;
    const end = (fn, v) => { clearTimeout(t); removeEventListener('message', on); f.remove(); fn(v); };
    const on = e => { if (e.origin !== origin || e.data?.type !== 'sopp:response' || e.data.id !== id) return; e.data.ok ? end(resolve, e.data.result) : end(reject, coded('FAILED', e.data.error || 'SOPP a signalé une erreur.')); };
    const t = setTimeout(() => end(reject, coded('TIMEOUT', 'Pas de réponse du pont SOPP.')), timeout);
    addEventListener('message', on); f.onload = () => f.contentWindow?.postMessage({ type: 'genis:request', id, action, payload }, origin); document.body.append(f);
  });
}
const svc = id => SERVICES.find(s => s.id === id);
export default {
  id: 'sopp', name: 'Écosystème SOPP', icon: 'layers', category: 'SOPP', agent: 'sopp', auth: { type: 'none' },
  status: () => (getSettings().soppLanguageUrl || getSettings().soppPharmaUrl ? 'ready' : { state: 'needs_config', detail: 'Renseignez les adresses de SOPP Language et Pharma SOPP dans Réglages › Écosystème SOPP.' }),
  limits: ['Le pont postMessage doit être implémenté côté SOPP (voir INTEGRATIONS.md) ; sans lui, G.E.N.I.S ouvre l’application avec le texte en paramètre.', 'Les adresses viennent de vos réglages : G.E.N.I.S ne les devine jamais.'],
  capabilities: {
    language_translate: { label: 'Traduire avec SOPP Language', progress: 'Appel de SOPP Language…', description: 'Traduit un texte avec SOPP Language (pont postMessage ; repli : ouverture de l’application).', level: 1, params: { text: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' } }, required: ['text'],
      run: async ({ text, from, to }) => {
        const url = safeUrl(getSettings().soppLanguageUrl); if (!url) return needsConfig('L’adresse de SOPP Language n’est pas renseignée : Réglages › Écosystème SOPP.');
        try { const r = await bridgeRequest(url, 'translate', { text, from, to }); return r?.text ? ok(r.text, { text: r.text }) : fail('FAILED', 'SOPP Language n’a renvoyé aucun texte.'); }
        catch (e) { if (e.code !== 'TIMEOUT') throw e; const u = new URL(url); u.searchParams.set('text', text); if (from) u.searchParams.set('from', from); if (to) u.searchParams.set('to', to); u.searchParams.set('source', 'genis'); return manual('SOPP Language n’a pas répondu au pont G.E.N.I.S (il n’est peut-être pas encore implémenté côté SOPP). Veux-tu que j’ouvre l’application avec ce texte ?', { url: u.href, label: 'Ouvrir SOPP Language' }); }
      } },
    language_open: { label: 'Ouvrir SOPP Language', description: 'Ouvre SOPP Language.', level: 2, permission: 'web.open', params: { query: { type: 'string' } }, run: ({ query }) => { const u = serviceUrl(svc('sopp-language'), query); return u ? openExternal(u, 'SOPP Language') : needsConfig('L’adresse de SOPP Language n’est pas renseignée : Réglages › Écosystème SOPP.'); } },
    pharma_open: { label: 'Ouvrir Pharma SOPP', description: 'Ouvre Pharma SOPP. Aucun avis médical : G.E.N.I.S ne fait que l’ouvrir.', level: 2, permission: 'web.open', params: {}, run: () => { const u = serviceUrl(svc('pharma-sopp')); return u ? openExternal(u, 'Pharma SOPP') : needsConfig('L’adresse de Pharma SOPP n’est pas renseignée : Réglages › Écosystème SOPP.'); } },
    agents_open: { label: 'Ouvrir SOPP Agents', description: 'Ouvre SOPP Agents.', level: 2, permission: 'web.open', params: {}, run: () => openExternal(svc('sopp-agents').url, 'SOPP Agents') }
  }
};
