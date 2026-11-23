/* Connecteur « Réservations » : recherche réelle de restaurants (OpenStreetMap/Overpass) et préparation des réservations (restaurant, coiffeur, cinéma, VTC, livraison).
   Aucune disponibilité n'est vérifiable ni aucune réservation effectuable sans API partenaire : G.E.N.I.S le dit et prépare la page. */
import { ok, fail, manual } from './connectors.js';
import { geocode, devicePosition, pois, link } from './geo.js';
import { getSettings } from './storage.js';
import { clamp } from './util.js';
const permFor = a => (a.near || getSettings().defaultCity ? undefined : 'location.read');
const place = (near, signal) => (near ? geocode(near, signal) : getSettings().defaultCity ? geocode(getSettings().defaultCity, signal) : devicePosition());
const LABEL = { restaurant: 'restaurant', hairdresser: 'coiffeur', cinema: 'séances de cinéma', taxi: 'taxi ou VTC', food_delivery: 'livraison de repas' };
export default {
  id: 'booking', name: 'Réservations', icon: 'fork', category: 'Vie pratique', agent: 'booking', auth: { type: 'none' }, status: 'ready',
  limits: ['Restaurants : données OpenStreetMap (nom, cuisine, adresse, horaires si connus). Ni prix, ni avis, ni disponibilités.', 'Réserver, vérifier un créneau ou commander : impossible sans API partenaire (TheFork, Planity, Uber…). G.E.N.I.S prépare la recherche et vous renvoie vers la page.'],
  capabilities: {
    restaurants: { label: 'Chercher un restaurant', progress: 'Recherche de restaurants…', description: 'Restaurants proches d’un lieu (OpenStreetMap). Ne donne ni prix, ni avis, ni disponibilité.', level: 1, permissionFor: permFor,
      params: { cuisine: { type: 'string', description: 'Tag OSM anglais : japanese, italian, chinese, indian, french, lebanese, pizza, sushi, burger…' }, near: { type: 'string' }, radius: { type: 'integer', description: 'Mètres (500–8000).' }, limit: { type: 'integer' } },
      run: async ({ cuisine, near, radius = 2500, limit = 8 }, ctx) => {
        const p = await place(near, ctx.signal), cu = /^[a-z_;]{3,30}$/.test(cuisine || '') ? cuisine : '';
        const list = await pois(p.lat, p.lon, { filters: [cu ? `["amenity"="restaurant"]["cuisine"~"${cu}",i]` : '["amenity"="restaurant"]'], radius: clamp(radius, 500, 8000), limit: clamp(limit, 1, 15) }, ctx.signal);
        if (!list.length) return fail('NOT_FOUND', `Je n’ai trouvé aucun restaurant${cu ? ` (${cu})` : ''} autour de ${p.name} dans la base OpenStreetMap.`);
        const items = list.map(r => ({ name: r.name, cuisine: r.tags.cuisine || '', address: [r.tags['addr:housenumber'], r.tags['addr:street'], r.tags['addr:city']].filter(Boolean).join(' '), km: +r.km.toFixed(1), hours: r.tags.opening_hours || '', phone: r.tags.phone || r.tags['contact:phone'] || '', website: r.tags.website || '' }));
        return ok(`${items.length} restaurant(s) près de ${p.name}, dont ${items[0].name} (${items[0].km} km). Je ne vois ni prix ni disponibilités.`, { near: p.name, restaurants: items }, { ui: { cards: [{ type: 'list', title: `Restaurants près de ${p.name}`, items: items.map((r, i) => ({ title: r.name, subtitle: [r.cuisine, r.address, `${r.km} km`, r.hours].filter(Boolean).join(' · '), url: r.website || link.search(`${r.name} ${p.name}`) })) }] } });
      } },
    prepare: { label: 'Préparer une réservation', progress: 'Préparation de la réservation…', description: 'Prépare une réservation (restaurant, coiffeur, cinéma, taxi/VTC, livraison) : construit la recherche ou le lien profond. Ne réserve jamais et ne vérifie aucune disponibilité.', level: 2, permission: 'booking.prepare',
      params: { kind: { type: 'string', enum: Object.keys(LABEL) }, query: { type: 'string', description: 'Nom du lieu, type de cuisine, film, destination…' }, near: { type: 'string' }, when: { type: 'string', description: 'Date et heure souhaitées, en texte.' }, party: { type: 'integer' } }, required: ['kind'],
      run: ({ kind, query, near, when, party }) => {
        const where = near || getSettings().defaultCity || '', enc = encodeURIComponent;
        const url = kind === 'cinema' ? `https://www.google.com/search?q=${enc(`séances cinéma ${query || ''} ${where} ${when || ''}`.trim())}` : kind === 'taxi' ? `https://m.uber.com/ul/?action=setPickup&pickup=my_location${query ? `&dropoff[formatted_address]=${enc(query)}` : ''}` : kind === 'food_delivery' ? 'https://www.ubereats.com/fr' : link.search(`${query || LABEL[kind]} ${where}`.trim());
        const r = manual(`J’ai préparé la recherche (${LABEL[kind]}${query ? ` : ${query}` : ''}${when ? `, ${when}` : ''}${party ? `, ${party} personne(s)` : ''}). Aucune API de réservation n’est disponible ici : je ne peux ni vérifier un créneau ni réserver à votre place. Veux-tu que j’ouvre la page ?`, { url, label: 'Ouvrir la page' });
        r.data = { kind, query, near: where, when, party, url }; return r;
      } }
  }
};
