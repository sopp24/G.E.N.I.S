/* Connecteur « Savoir » : Wikipédia (direct) et actualités (flux RSS lus par la passerelle : les médias n'autorisent pas l'accès direct du navigateur). */
import { ok, manual, fail } from './connectors.js';
import { getJson, norm, tokens } from './util.js';
import * as gateway from './gateway.js';
export const NEWS_SOURCES = { franceinfo: 'Franceinfo', lemonde: 'Le Monde', france24: 'France 24', bbc: 'BBC News' };
const firstSentences = (t, n = 2) => (String(t).match(/[^.!?]+[.!?]+/g) || [t]).slice(0, n).join(' ').trim();
export default {
  id: 'knowledge', name: 'Savoir et actualités', icon: 'book', category: 'Informations', agent: 'research', auth: { type: 'none' }, status: 'ready',
  limits: ['Actualités : titres et résumés des flux RSS (Franceinfo, Le Monde, France 24, BBC) lus via la passerelle ; lien vers l’article source.', 'Wikipédia : résumé de l’article le plus pertinent.'],
  capabilities: {
    wikipedia: { label: 'Wikipédia', progress: 'Recherche sur Wikipédia…', description: 'Cherche et résume un sujet sur Wikipédia (explication, définition, personne, lieu).', level: 1, params: { query: { type: 'string' }, lang: { type: 'string', enum: ['fr', 'en'] } }, required: ['query'],
      run: async ({ query, lang = 'fr' }, ctx) => {
        const s = await getJson(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`, { signal: ctx.signal });
        const hit = s.query?.search?.[0]; if (!hit) return fail('NOT_FOUND', `Je ne trouve pas d’article Wikipédia sur « ${query} ».`);
        const p = await getJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`, { signal: ctx.signal });
        const url = p.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`;
        return ok(firstSentences(p.extract || hit.snippet.replace(/<[^>]+>/g, ''), 3), { title: p.title, extract: p.extract, url }, { ui: { cards: [{ type: 'text', title: p.title, text: p.extract, url, urlLabel: 'Lire sur Wikipédia' }] } });
      } },
    news: { label: 'Actualités', progress: 'Lecture des actualités…', description: 'Titres et résumés d’actualité depuis plusieurs médias (comparaison possible), filtrables par sujet. Ne copie jamais les articles : cite et renvoie vers la source.', level: 1,
      params: { topic: { type: 'string', description: 'Mot-clé optionnel.' }, sources: { type: 'array', items: { type: 'string', enum: Object.keys(NEWS_SOURCES) } } },
      run: async ({ topic, sources }, ctx) => {
        if (!gateway.isConfigured()) return manual('Je ne peux lire les actualités qu’avec la passerelle (les flux RSS refusent l’accès direct du navigateur). Voici la page Franceinfo.', { url: 'https://www.franceinfo.fr/', label: 'Ouvrir Franceinfo' });
        const ids = (sources?.length ? sources : Object.keys(NEWS_SOURCES)).filter(k => NEWS_SOURCES[k]);
        const got = await Promise.allSettled(ids.map(id => gateway.feed(id, ctx.signal))), q = tokens(topic || ''), bySource = [];
        got.forEach((r, i) => { if (r.status !== 'fulfilled') return; let items = r.value.items || []; if (q.length) items = items.filter(it => q.some(t => norm(`${it.title} ${it.summary}`).includes(t))); if (items.length) bySource.push({ source: NEWS_SOURCES[ids[i]], items: items.slice(0, 4) }); });
        if (!bySource.length) return got.every(r => r.status === 'rejected') ? fail('NETWORK', 'Les flux d’actualité sont injoignables pour l’instant.') : ok(topic ? `Aucun titre récent ne correspond à « ${topic} ».` : 'Aucun titre disponible.', { sources: [] });
        const total = bySource.reduce((n, s) => n + s.items.length, 0);
        return ok(`${total} titre(s) de ${bySource.length} source(s)${topic ? ` sur « ${topic} »` : ''}. À la une : ${bySource[0].items[0].title}.`, { sources: bySource.map(s => ({ source: s.source, items: s.items.map(it => ({ title: it.title, summary: String(it.summary || '').slice(0, 220), published: it.published, url: it.link })) })) }, { ui: { cards: bySource.map(s => ({ type: 'list', title: s.source, items: s.items.map(it => ({ title: it.title, subtitle: new Date(it.published || Date.now()).toLocaleDateString('fr-FR'), url: it.link })) })) } });
      } }
  }
};
