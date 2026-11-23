/* Connecteur « Deezer » : recherche via l'API publique (relayée par la passerelle, sans clé) et lecture dans le lecteur officiel Deezer intégré.
   Limites assumées : pas d'accès à la bibliothèque personnelle ni de pilotage du lecteur depuis l'extérieur ; extraits de 30 s hors connexion Deezer. */
import { ok, fail, manual } from './connectors.js';
import * as gateway from './gateway.js';
import { SERVICES, serviceUrl } from './services.js';
const DEEZER = SERVICES.find(s => s.id === 'deezer');
export const widgetUrl = (type, id) => `https://widget.deezer.com/widget/dark/${type}/${encodeURIComponent(id)}?tracklist=true&autoplay=true&radius=true`;
const titleOf = (type, h) => (type === 'track' ? `${h.title} — ${h.artist?.name || ''}`.replace(/ — $/, '') : type === 'artist' ? h.name : h.title);
const find = async (kind, q, signal, limit = 5) => (await gateway.deezer(`search/${kind}`, { q, limit }, signal)).data || [];
const offline = q => manual('Sans la passerelle, je ne peux pas chercher dans Deezer : voici la recherche.', { url: serviceUrl(DEEZER, q), label: 'Chercher sur Deezer' });
export default {
  id: 'deezer', name: 'Deezer', icon: 'music', category: 'Musique', agent: 'media', auth: { type: 'none', note: 'API publique de recherche ; lecture via le widget officiel.' }, status: 'ready',
  limits: ['Pas d’accès à vos playlists personnelles ni de pilotage du lecteur (suivant, volume) depuis G.E.N.I.S : le lecteur intégré se commande lui-même.', 'Sans connexion à Deezer dans ce navigateur, le widget ne joue que des extraits de 30 secondes.', 'La recherche passe par la passerelle (l’API Deezer n’autorise pas les appels directs du navigateur).'],
  capabilities: {
    play: { label: 'Lancer de la musique', progress: 'Recherche sur Deezer…', description: 'Cherche puis charge une playlist, un artiste, un titre, un album ou un genre dans le lecteur officiel Deezer intégré.', level: 1, permission: 'media.control', params: { query: { type: 'string' }, type: { type: 'string', enum: ['playlist', 'artist', 'track', 'album'] }, mine: { type: 'boolean', description: 'L’utilisateur parle de SA playlist personnelle.' } }, required: ['query'],
      run: async ({ query, type, mine }, ctx) => {
        if (!gateway.isConfigured()) return offline(query);
        let found = null;
        if (type === 'artist') { const a = (await find('artist', query, ctx.signal, 1))[0]; const top = a ? (await gateway.deezer(`artist/${a.id}/top`, { limit: 10 }, ctx.signal)).data || [] : []; if (top[0]) found = { type: 'track', hit: top[0] }; }
        else for (const k of type ? [type] : ['playlist', 'track']) { const h = (await find(k, query, ctx.signal))[0]; if (h) { found = { type: k, hit: h }; break; } }
        if (!found) return fail('NOT_FOUND', `Je n’ai rien trouvé sur Deezer pour « ${query} ».`);
        const title = titleOf(found.type, found.hit);
        return ok(`Lecteur Deezer chargé : ${title}.${mine ? ' Je n’ai pas accès à votre bibliothèque : j’ai pris une playlist publique de ce nom.' : ''} Si le son ne démarre pas, appuyez sur lecture (le navigateur peut bloquer l’autoplay).`, { type: found.type, id: found.hit.id, title }, { ui: { cards: [{ type: 'player', provider: 'deezer', embedUrl: widgetUrl(found.type, found.hit.id), title, link: found.hit.link }] }, observe: [{ key: 'music_service', value: 'Deezer', label: 'Service de musique préféré' }] });
      } },
    search: { label: 'Chercher sur Deezer', progress: 'Recherche sur Deezer…', description: 'Liste des résultats Deezer (titres, artistes, playlists, albums) sans les lancer.', level: 1, permission: 'media.control', params: { query: { type: 'string' }, type: { type: 'string', enum: ['track', 'artist', 'playlist', 'album'] } }, required: ['query'],
      run: async ({ query, type = 'track' }, ctx) => {
        if (!gateway.isConfigured()) return offline(query);
        const l = await find(type, query, ctx.signal, 8); if (!l.length) return fail('NOT_FOUND', `Aucun résultat Deezer pour « ${query} ».`);
        return ok(`${l.length} résultat(s) sur Deezer, par exemple ${titleOf(type, l[0])}.`, { results: l.map(h => ({ id: h.id, title: titleOf(type, h) })) }, { ui: { cards: [{ type: 'list', title: 'Deezer', items: l.map(h => ({ title: titleOf(type, h), subtitle: h.album?.title || h.nb_tracks ? `${h.nb_tracks} titres` : '', url: h.link })) }] } });
      } },
    control: { label: 'Commander la lecture', description: 'Suivant, pause, volume : non réalisable depuis l’extérieur du lecteur Deezer intégré (limite technique du widget).', level: 1, permission: 'media.control', params: { action: { type: 'string', enum: ['next', 'prev', 'pause', 'play', 'volume_up', 'volume_down'] } }, required: ['action'],
      run: () => ({ status: 'needs_manual', verified: false, summary: 'Le lecteur Deezer intégré ne peut pas être piloté depuis G.E.N.I.S : utilisez ses boutons. Je peux en revanche lancer une autre sélection.' }) }
  }
};
