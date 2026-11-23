/* Connecteur « Voyages » : le voyage ENTIER (transport, logement, activités, repas, temps libre, budget), pas seulement un vol.
   Réel : création du voyage, lieux (OpenStreetMap), validation et stockage du planning, calcul/suivi du budget et comparaison d'options, export agenda .ics.
   Préparé : liens de recherche transport/hébergement. Les PRIX ne sont lisibles par aucune API ouverte : toute somme non fournie par l'utilisateur est une estimation, marquée comme telle. */
import { ok, fail, manual } from './connectors.js';
import { store, getSettings } from './storage.js';
import { uid, bus, fmt, toIcs, clamp } from './util.js';
import { geocode, pois, link } from './geo.js';
import { addDays, isoDay } from './datetime-fr.js';
const enc = encodeURIComponent, round = n => Math.round(n * 100) / 100, isoOk = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s));
export const listTrips = () => store.get('trips', []);
const saveTrip = t => { const l = listTrips(); store.set('trips', l.some(x => x.id === t.id) ? l.map(x => (x.id === t.id ? t : x)) : [t, ...l].slice(0, 30)); bus.emit('trips'); return t; };
const pick = id => (id ? listTrips().find(t => t.id === id) : listTrips()[0]) || null;
const noTrip = () => fail('NOT_FOUND', 'Aucun voyage en cours : créez-le d’abord (destination et dates).');
export const tripDays = t => Math.round((new Date(t.end + 'T12:00') - new Date(t.start + 'T12:00')) / 864e5) + 1;
const dayList = t => Array.from({ length: tripDays(t) }, (_, i) => isoDay(addDays(new Date(t.start + 'T12:00'), i)));
export function computeBudget(t) {
  const days = tripDays(t), limit = t.budgetLimit || 0, opts = {};
  for (const l of t.budgetLines || []) {
    const o = (opts[l.option || 'Principal'] ||= { total: 0, actual: 0, hasActual: false, byCat: {} }), a = Number(l.amount) || 0;
    o.total += a; o.byCat[l.category] = (o.byCat[l.category] || 0) + a; if (l.actual != null) { o.actual += Number(l.actual) || 0; o.hasActual = true; }
  }
  const options = Object.entries(opts).map(([name, o]) => ({ name, total: round(o.total), perDay: round(o.total / days), perPerson: round(o.total / (t.travelers || 1)), byCat: o.byCat, actual: o.hasActual ? round(o.actual) : null, over: limit && o.total > limit ? round(o.total - limit) : 0, remaining: limit ? round(limit - o.total) : null, pct: limit ? Math.round(o.total / limit * 100) : null }));
  const alerts = [];
  for (const o of options) {
    if (o.over) alerts.push(`Option « ${o.name} » : dépassement de ${fmt.money(o.over, t.currency)} (${o.pct} % du budget).`); else if (o.pct >= 90) alerts.push(`Option « ${o.name} » : ${o.pct} % du budget est déjà prévu.`);
    if (o.actual != null && limit && o.actual > limit) alerts.push(`Option « ${o.name} » : dépenses réelles (${fmt.money(o.actual, t.currency)}) au-dessus du budget.`);
  }
  return { currency: t.currency || 'EUR', limit, days, options, alerts, lines: t.budgetLines || [] };
}
export function normalizeItinerary(t, days = []) {
  const valid = new Set(dayList(t)), warnings = [], out = [];
  for (const d of days) {
    if (!valid.has(d.date)) { warnings.push(`Le ${d.date} est hors du voyage : ignoré.`); continue; }
    const items = (d.items || []).filter(i => i?.title).map(i => ({ time: /^\d{1,2}:\d{2}$/.test(i.time || '') ? i.time.padStart(5, '0') : '', title: String(i.title).slice(0, 120), category: i.category || 'activité', place: i.place || '', cost: Number.isFinite(+i.cost) && i.cost !== '' && i.cost != null ? +i.cost : null, notes: i.notes || '' }));
    items.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    items.forEach((x, k) => { if (k && x.time && x.time === items[k - 1].time) warnings.push(`Le ${d.date}, deux activités sont prévues à ${x.time}.`); });
    out.push({ date: d.date, items });
  }
  return { days: out, warnings };
}
const tripCard = t => ({ type: 'trip', name: t.name, destination: t.destination, start: t.start, end: t.end, days: tripDays(t), travelers: t.travelers, limit: t.budgetLimit, currency: t.currency, planned: (t.itinerary || []).filter(d => d.items.length).length, total: computeBudget(t).options[0]?.total ?? null });
const PRM = 'travel.plan', ID = { trip_id: { type: 'string', description: 'Identifiant du voyage (le plus récent par défaut).' } };
const CAT = { sights: ['["tourism"~"attraction|viewpoint|artwork"]', '["historic"~"monument|castle|memorial|ruins|archaeological_site"]'], museum: ['["tourism"="museum"]'], park: ['["leisure"~"park|garden"]'], restaurant: ['["amenity"="restaurant"]'], cafe: ['["amenity"="cafe"]'], nightlife: ['["amenity"~"bar|pub|nightclub"]'] };
export default {
  id: 'travel', name: 'Voyages', icon: 'plane', category: 'Vie pratique', agent: 'travel', auth: { type: 'none' }, status: 'ready',
  limits: ['Aucun prix de vol, train ou logement n’est lisible (pas d’API ouverte) : les recherches sont préparées, les montants retenus viennent de vous ou sont des estimations marquées.', 'Aucune réservation n’est effectuée.', 'Lieux : OpenStreetMap (nom, distance, horaires si connus).'],
  capabilities: {
    create: { label: 'Créer un voyage', progress: 'Création du voyage…', description: 'Crée un voyage (destination, dates ISO, voyageurs, budget, centres d’intérêt). Point de départ de tout le module.', level: 2, permission: PRM,
      params: { destination: { type: 'string' }, start: { type: 'string', description: 'YYYY-MM-DD' }, end: { type: 'string', description: 'YYYY-MM-DD (inclus)' }, origin: { type: 'string' }, travelers: { type: 'integer' }, budget: { type: 'number', description: 'Budget global.' }, currency: { type: 'string' }, interests: { type: 'array', items: { type: 'string' } }, name: { type: 'string' } }, required: ['destination', 'start', 'end'],
      run: async (p, ctx) => {
        if (!isoOk(p.start) || !isoOk(p.end) || p.end < p.start) return fail('BAD_INPUT', 'Les dates du voyage sont invalides (début avant fin, format AAAA-MM-JJ).');
        const t = { id: uid('trip'), name: p.name || p.destination, destination: p.destination, origin: p.origin || '', start: p.start, end: p.end, travelers: clamp(p.travelers || 1, 1, 20), budgetLimit: p.budget || null, currency: p.currency || 'EUR', interests: p.interests || [], itinerary: [], budgetLines: [], links: {}, createdAt: Date.now() };
        if (tripDays(t) > 60) return fail('BAD_INPUT', 'Un voyage est limité à 60 jours.');
        try { const g = await geocode(p.destination, ctx.signal); t.lat = g.lat; t.lon = g.lon; } catch {}
        saveTrip(t);
        return ok(`Voyage « ${t.name} » créé : ${tripDays(t)} jour(s) du ${fmt.date(t.start + 'T12:00')} au ${fmt.date(t.end + 'T12:00')}, ${t.travelers} voyageur(s)${t.budgetLimit ? `, budget ${fmt.money(t.budgetLimit, t.currency)}` : ''}.`, { trip_id: t.id, days: tripDays(t) }, { ui: { cards: [tripCard(t)], space: { title: `Voyage : ${t.name}`, kind: 'travel' } } });
      } },
    places: { label: 'Lieux à visiter ou où manger', progress: 'Recherche de lieux…', description: 'Lieux près de la destination du voyage (sites, musées, parcs, restaurants, cafés, bars). Données OpenStreetMap.', level: 1, params: { ...ID, destination: { type: 'string' }, category: { type: 'string', enum: Object.keys(CAT) }, radius: { type: 'integer' }, limit: { type: 'integer' } }, required: ['category'],
      run: async ({ trip_id, destination, category, radius = 4000, limit = 10 }, ctx) => {
        const t = pick(trip_id), c = t?.lat != null && !destination ? { lat: t.lat, lon: t.lon, name: t.destination } : await geocode(destination || t?.destination || '', ctx.signal);
        const l = await pois(c.lat, c.lon, { filters: CAT[category], radius: clamp(radius, 500, 15000), limit: clamp(limit, 1, 20) }, ctx.signal);
        if (!l.length) return fail('NOT_FOUND', `Je n’ai trouvé aucun lieu de cette catégorie près de ${c.name}.`);
        const items = l.map(x => ({ name: x.name, km: +x.km.toFixed(1), hours: x.tags.opening_hours || '', website: x.tags.website || '' }));
        return ok(`${items.length} lieu(x) près de ${c.name} : ${items.slice(0, 4).map(i => i.name).join(', ')}…`, { center: c.name, places: items }, { ui: { cards: [{ type: 'list', title: `${category} · ${c.name}`, items: items.map(i => ({ title: i.name, subtitle: [`${i.km} km du centre`, i.hours].filter(Boolean).join(' · '), url: i.website || link.search(`${i.name} ${c.name}`) })) }] } });
      } },
    transport_links: { label: 'Préparer les transports', description: 'Prépare les recherches de transport (avion, train, voiture, tous modes). Ne lit aucun prix.', level: 2, permission: PRM, params: { ...ID, origin: { type: 'string' } },
      run: ({ trip_id, origin }) => {
        const t = pick(trip_id); if (!t) return noTrip(); const from = origin || t.origin || getSettings().defaultCity; if (!from) return fail('BAD_INPUT', 'D’où partez-vous ? Indiquez la ville de départ.');
        const links = [{ label: 'Vols : Google Flights', url: `https://www.google.com/travel/flights?q=${enc(`Flights from ${from} to ${t.destination} on ${t.start} through ${t.end}`)}` }, { label: 'Trains : SNCF Connect', url: 'https://www.sncf-connect.com/' }, { label: 'Tous modes : Rome2rio', url: `https://www.rome2rio.com/map/${enc(from)}/${enc(t.destination)}` }, { label: 'En voiture : Google Maps', url: link.dir(from, t.destination, 'driving') }];
        saveTrip({ ...t, origin: from, links: { ...t.links, transport: links } });
        const r = manual(`J’ai préparé les recherches de transport ${from} → ${t.destination} (${t.start} → ${t.end}). Aucune API ouverte ne me donne les prix : comparez sur ces pages, puis donnez-moi les montants retenus pour que je construise le budget.`, links[0]);
        r.ui.cards = [{ type: 'links', title: 'Transports', links: links.map((l, i) => ({ ...l, primary: i === 0 })) }]; r.data = { trip_id: t.id, links }; return r;
      } },
    lodging_links: { label: 'Préparer le logement', description: 'Prépare les recherches d’hébergement (hôtel, appartement, camping) aux dates du voyage. Ne lit aucun prix.', level: 2, permission: PRM, params: { ...ID, type: { type: 'string', enum: ['hotel', 'apartment', 'camping', 'any'] } },
      run: ({ trip_id, type = 'any' }) => {
        const t = pick(trip_id); if (!t) return noTrip();
        const n = t.travelers || 1, ls = [];
        if (type !== 'camping' && type !== 'apartment') ls.push({ label: 'Hôtels : Booking.com', url: `https://www.booking.com/searchresults.html?ss=${enc(t.destination)}&checkin=${t.start}&checkout=${t.end}&group_adults=${n}` });
        if (type !== 'camping' && type !== 'hotel') ls.push({ label: 'Appartements : Airbnb', url: `https://www.airbnb.fr/s/${enc(t.destination)}/homes?checkin=${t.start}&checkout=${t.end}&adults=${n}` });
        if (type === 'camping' || type === 'any') ls.push({ label: 'Campings : Google Maps', url: link.search(`camping ${t.destination}`) });
        ls.push({ label: 'Hébergements proches du centre : Google Maps', url: link.search(`hébergement ${t.destination}`) });
        saveTrip({ ...t, links: { ...t.links, lodging: ls } });
        const r = manual(`J’ai préparé les recherches de logement à ${t.destination} (${t.start} → ${t.end}, ${n} voyageur(s)). Je ne peux pas lire les prix ni réserver : choisissez sur ces pages et donnez-moi le tarif retenu pour le budget.`, ls[0]);
        r.ui.cards = [{ type: 'links', title: 'Logements', links: ls.map((l, i) => ({ ...l, primary: i === 0 })) }]; r.data = { trip_id: t.id, links: ls }; return r;
      } },
    itinerary: { label: 'Enregistrer le planning', progress: 'Construction du planning…', description: 'Enregistre le planning jour par jour (activités, déplacements, repas, temps libre) : horaires HH:MM, catégorie, lieu, coût estimé. Valide les dates et signale les jours vides ou les doublons horaires.', level: 2, permission: PRM,
      params: { ...ID, days: { type: 'array', items: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD' }, items: { type: 'array', items: { type: 'object', properties: { time: { type: 'string' }, title: { type: 'string' }, category: { type: 'string', enum: ['transport', 'logement', 'activité', 'repas', 'temps libre', 'réservation'] }, place: { type: 'string' }, cost: { type: 'number' }, notes: { type: 'string' } }, required: ['title'] } } }, required: ['date', 'items'] } } }, required: ['days'],
      run: ({ trip_id, days }) => {
        const t = pick(trip_id); if (!t) return noTrip();
        const n = normalizeItinerary(t, days), merged = [...(t.itinerary || []).filter(d => !n.days.some(x => x.date === d.date)), ...n.days].sort((a, b) => a.date.localeCompare(b.date));
        const all = dayList(t), empty = all.filter(d => !merged.some(x => x.date === d && x.items.length)), warnings = [...n.warnings, ...empty.map(d => `Le ${d} : aucun programme.`)];
        saveTrip({ ...t, itinerary: merged }); const items = merged.reduce((s, d) => s + d.items.length, 0), cost = merged.reduce((s, d) => s + d.items.reduce((a, i) => a + (i.cost || 0), 0), 0);
        return ok(`Planning enregistré : ${merged.length} jour(s), ${items} activité(s)${cost ? `, coûts estimés ${fmt.money(cost, t.currency)}` : ''}.${warnings.length ? ` À corriger : ${warnings.slice(0, 3).join(' ')}` : ''}`, { trip_id: t.id, days: merged.length, items, warnings }, { ui: { cards: [{ type: 'itinerary', title: `Planning : ${t.name}`, days: merged, currency: t.currency, warnings }] } });
      } },
    budget: { label: 'Budget du voyage', progress: 'Calcul du budget…', description: 'Ajoute ou met à jour des lignes de budget (catégorie, libellé, montant, option à comparer, source estimate|user|quote, dépense réelle) puis calcule totaux, répartition, par jour, par personne et dépassements. Sans prix lu par un outil, source = estimate.', level: 2, permission: PRM,
      params: { ...ID, limit: { type: 'number', description: 'Budget maximum global.' }, replace: { type: 'boolean', description: 'Remplace toutes les lignes.' }, lines: { type: 'array', items: { type: 'object', properties: { category: { type: 'string', enum: ['transport', 'logement', 'repas', 'activités', 'transports sur place', 'divers'] }, label: { type: 'string' }, amount: { type: 'number' }, option: { type: 'string' }, source: { type: 'string', enum: ['estimate', 'user', 'quote'] }, actual: { type: 'number' } }, required: ['category', 'label', 'amount'] } } },
      run: ({ trip_id, limit, replace, lines = [] }) => {
        const t = pick(trip_id); if (!t) return noTrip(); const key = l => `${l.option || 'Principal'}|${l.category}|${String(l.label).toLowerCase()}`;
        const map = new Map((replace ? [] : t.budgetLines || []).map(l => [key(l), l])); for (const l of lines) if (Number.isFinite(+l.amount)) map.set(key(l), { ...l, source: l.source || 'estimate' });
        const next = { ...t, budgetLines: [...map.values()], ...(limit ? { budgetLimit: limit } : {}) }; saveTrip(next); const b = computeBudget(next), main = b.options[0];
        if (!main) return ok('Aucune ligne de budget pour le moment.', b);
        const est = b.lines.filter(l => l.source === 'estimate').length;
        return ok(`Budget ${b.options.length > 1 ? 'comparé' : 'global'} : ${b.options.map(o => `${o.name} ${fmt.money(o.total, b.currency)}`).join(' / ')} pour ${b.days} jour(s), soit ${fmt.money(main.perDay, b.currency)} par jour${b.limit ? ` (plafond ${fmt.money(b.limit, b.currency)})` : ''}.${est ? ` ${est} ligne(s) sont des estimations.` : ''} ${b.alerts.join(' ')}`.trim(), b, { ui: { cards: [{ type: 'budget', ...b }] } });
      } },
    status: { label: 'Point sur le voyage', description: 'Résume l’avancement du voyage : planning, budget prévu vs plafond, alertes.', level: 1, params: ID,
      run: ({ trip_id }) => { const t = pick(trip_id); if (!t) return noTrip(); const b = computeBudget(t), planned = (t.itinerary || []).filter(d => d.items.length).length; return ok(`${t.name} : planning sur ${planned}/${tripDays(t)} jour(s)${b.options[0] ? `, budget prévu ${fmt.money(b.options[0].total, b.currency)}${b.limit ? ` sur ${fmt.money(b.limit, b.currency)}` : ''}` : ', budget non renseigné'}. ${b.alerts.join(' ')}`.trim(), { trip: t, budget: b }, { ui: { cards: [tripCard(t)] } }); } },
    export_ics: { label: 'Exporter vers l’agenda', description: 'Exporte les activités horodatées du planning en fichier calendrier .ics (importable dans n’importe quel agenda).', level: 2, permission: PRM, params: ID,
      run: ({ trip_id }) => {
        const t = pick(trip_id); if (!t) return noTrip();
        const ev = (t.itinerary || []).flatMap(d => d.items.filter(i => i.time).map(i => { const s = new Date(`${d.date}T${i.time}`); return { title: i.title, start: s, end: new Date(s.getTime() + 36e5), location: i.place, description: i.notes }; }));
        return ev.length ? ok(`${ev.length} activité(s) prêtes à importer dans votre agenda.`, { count: ev.length }, { ui: { cards: [{ type: 'ics', filename: `voyage-${t.name.replace(/\W+/g, '-').toLowerCase()}.ics`, label: 'Télécharger le fichier agenda (.ics)', content: toIcs(ev) }] } }) : fail('NOT_FOUND', 'Aucune activité horodatée dans le planning : ajoutez des horaires (HH:MM).');
      } }
  }
};
