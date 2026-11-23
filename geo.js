/* G.E.N.I.S — géographie sans clé d'API : géocodage Nominatim (OpenStreetMap), itinéraires OSRM, lieux Overpass, liens Google Maps officiels.
   Politique Nominatim respectée : 1 requête/seconde maximum, résultats mis en cache. */
import { getJson, coded, norm } from './util.js';
let last = 0; const cache = new Map();
const wait = ms => new Promise(r => setTimeout(r, ms));
async function nominatim(text, limit, signal) {
  const gap = Date.now() - last; if (gap < 1100) await wait(1100 - gap); last = Date.now();
  return getJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=0&limit=${limit}&accept-language=fr&q=${encodeURIComponent(text)}`, { signal });
}
const short = r => String(r.display_name).split(',').slice(0, 2).join(',').trim();
export async function geocode(text, signal) {
  const key = norm(text).trim(); if (cache.has(key)) return cache.get(key);
  const d = await nominatim(text, 1, signal);
  if (!d.length) throw coded('NOT_FOUND', `Je ne trouve pas « ${text} ».`);
  const out = { name: short(d[0]), lat: +d[0].lat, lon: +d[0].lon }; cache.set(key, out); return out;
}
export async function searchPlaces(text, limit = 5, signal) { return (await nominatim(text, limit, signal)).map(r => ({ name: short(r), full: r.display_name, type: r.type, lat: +r.lat, lon: +r.lon })); }
export const devicePosition = () => new Promise((res, rej) => {
  if (!navigator.geolocation) return rej(coded('LOCATION', 'Votre appareil ne fournit pas la position.'));
  navigator.geolocation.getCurrentPosition(p => res({ name: 'ma position', lat: p.coords.latitude, lon: p.coords.longitude }), () => rej(coded('LOCATION', 'Je n’ai pas pu lire votre position (autorisation du navigateur ou GPS).')), { timeout: 10000, maximumAge: 300000 });
});
export const haversine = (a, b) => { const r = x => x * Math.PI / 180, dLa = r(b.lat - a.lat), dLo = r(b.lon - a.lon), h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const OSRM = { driving: 'https://router.project-osrm.org/route/v1/driving', walking: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot', cycling: 'https://routing.openstreetmap.de/routed-bike/route/v1/bike' };
export async function route(a, b, mode = 'driving', signal) {
  const base = OSRM[mode]; if (!base) throw coded('UNSUPPORTED', 'Ce mode de transport n’est pas calculable sans service dédié.');
  const d = await getJson(`${base}/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`, { signal });
  const r = d.routes?.[0]; if (!r) throw coded('NOT_FOUND', 'Aucun itinéraire trouvé entre ces deux lieux.');
  return { km: r.distance / 1000, minutes: r.duration / 60 };
}
export async function pois(lat, lon, { filters, radius = 3000, limit = 15 }, signal) {
  const q = `[out:json][timeout:20];(${filters.map(f => `nwr${f}(around:${radius},${lat},${lon});`).join('')});out center ${limit * 4};`;
  const d = await getJson('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal, timeout: 25000 });
  const seen = new Set(), here = { lat, lon };
  return (d.elements || []).filter(e => e.tags?.name && (e.lat ?? e.center?.lat) != null).map(e => ({ name: e.tags.name, lat: e.lat ?? e.center.lat, lon: e.lon ?? e.center.lon, tags: e.tags }))
    .filter(p => { const k = norm(p.name); if (seen.has(k)) return false; seen.add(k); return true; })
    .map(p => ({ ...p, km: haversine(here, p) })).sort((x, y) => x.km - y.km).slice(0, limit);
}
export const link = {
  search: q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
  dir: (o, d, mode = 'driving') => `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}&travelmode=${mode === 'cycling' ? 'bicycling' : mode}`
};
export const fmtDuration = m => m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}` : `${Math.max(1, Math.round(m))} min`;
