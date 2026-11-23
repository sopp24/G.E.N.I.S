/* Connecteur « Cartes » : lieux (OpenStreetMap/Nominatim) et itinéraires (OSRM). Les transports en commun passent par un lien Google Maps officiel. */
import { ok, manual } from './connectors.js';
import { searchPlaces, geocode, devicePosition, route, link, fmtDuration } from './geo.js';
const MODE = { driving: 'en voiture, sans trafic', walking: 'à pied', cycling: 'à vélo' };
export default {
  id: 'maps', name: 'Cartes et itinéraires', icon: 'map', category: 'Déplacements', agent: 'travel', auth: { type: 'none' }, status: 'ready',
  limits: ['Durées OSRM : sans trafic ni horaires. Transports en commun : lien Google Maps (aucune API ouverte).', 'Géocodage Nominatim : 1 requête par seconde.'],
  capabilities: {
    places_search: { label: 'Rechercher un lieu', progress: 'Recherche du lieu…', description: 'Recherche un lieu, une adresse ou un site (OpenStreetMap).', level: 1, params: { query: { type: 'string' }, near: { type: 'string', description: 'Ville ou quartier pour préciser.' } }, required: ['query'],
      run: async ({ query, near }, ctx) => {
        const hits = await searchPlaces(near ? `${query}, ${near}` : query, 5, ctx.signal);
        if (!hits.length) return { status: 'failed', verified: false, summary: `Je ne trouve rien pour « ${query} ».`, error: { code: 'NOT_FOUND', message: '' } };
        return ok(`${hits.length} lieu(x) trouvé(s) : ${hits[0].name}…`, { places: hits }, { ui: { cards: [{ type: 'list', title: 'Lieux', items: hits.map(h => ({ title: h.name, subtitle: h.full, url: link.search(`${h.lat},${h.lon}`) })) }] } });
      } },
    route: { label: 'Itinéraire', progress: 'Calcul de l’itinéraire…', description: 'Distance et durée entre deux lieux (voiture, vélo, marche). Transports en commun : prépare le lien Google Maps. Sans « from » : position de l’appareil.', level: 1,
      permissionFor: a => (a.from && !/^ma position$/i.test(a.from) ? undefined : 'location.read'), params: { from: { type: 'string' }, to: { type: 'string' }, mode: { type: 'string', enum: ['driving', 'walking', 'cycling', 'transit'] } }, required: ['to'],
      run: async ({ from, to, mode = 'driving' }, ctx) => {
        const a = from && !/^ma position$/i.test(from) ? await geocode(from, ctx.signal) : await devicePosition(), b = await geocode(to, ctx.signal);
        const origin = a.name === 'ma position' ? `${a.lat},${a.lon}` : a.name, url = link.dir(origin, b.name, mode);
        if (mode === 'transit') return manual(`Les horaires de transports en commun ne sont pas lisibles sans API dédiée : voici l’itinéraire de ${a.name} à ${b.name}.`, { url, label: 'Voir l’itinéraire' });
        const r = await route(a, b, mode, ctx.signal);
        return ok(`${a.name} → ${b.name} : ${r.km.toFixed(r.km < 10 ? 1 : 0)} km, environ ${fmtDuration(r.minutes)} ${MODE[mode]}.`, { from: a.name, to: b.name, km: +r.km.toFixed(1), minutes: Math.round(r.minutes), mode }, { ui: { cards: [{ type: 'route', from: a.name, to: b.name, km: r.km, minutes: r.minutes, mode, url }] } });
      } }
  }
};
