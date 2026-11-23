/* Connecteur « Vidéo et streaming » : ouvre ou prépare la page du service. Aucun de ces services n'offre de contrôle de lecture ouvert. */
import { openExternal } from './connectors.js';
import { SERVICES, serviceUrl } from './services.js';
const VIDEO = ['youtube', 'twitch', 'netflix', 'disney', 'prime', 'canalplus'];
export default {
  id: 'media', name: 'Vidéo et streaming', icon: 'play', category: 'Divertissement', agent: 'media', auth: { type: 'none' }, status: 'ready',
  limits: ['YouTube, Twitch, Netflix, Disney+, Prime Video et Canal+ n’offrent pas de contrôle ouvert : G.E.N.I.S ouvre ou prépare la page, mais ne lance pas un épisode à votre place.'],
  capabilities: {
    open: { label: 'Ouvrir un service vidéo', progress: 'Ouverture du service…', description: 'Ouvre YouTube, Twitch, Netflix, Disney+, Prime Video ou Canal+, sur une recherche quand le service le permet.', level: 2, permission: 'web.open', params: { service: { type: 'string', enum: VIDEO }, query: { type: 'string' } }, required: ['service'],
      run: ({ service, query }) => {
        const svc = SERVICES.find(s => s.id === service), r = openExternal(serviceUrl(svc, query), svc.name), note = query && !svc.search ? ` Ce service n’a pas de recherche par lien : cherchez « ${query} » sur place.` : '';
        return { ...r, brief: false, summary: `${r.summary}${note} Je ne peux pas lancer le contenu moi-même.` };
      } }
  }
};
