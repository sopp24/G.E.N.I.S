/* Connecteur « Météo » : Open-Meteo (gratuit, sans clé). Météo&Radar n'expose pas d'API publique connue : il reste accessible via l'ouverture de service. */
import { ok } from './connectors.js';
import { getJson, coded } from './util.js';
import { getSettings } from './storage.js';
import { devicePosition } from './geo.js';
import { isoDay, addDays, startOfDay } from './datetime-fr.js';
const WMO = { 0: 'ciel dégagé', 1: 'plutôt dégagé', 2: 'partiellement nuageux', 3: 'couvert', 45: 'brouillard', 48: 'brouillard givrant', 51: 'bruine légère', 53: 'bruine', 55: 'bruine dense', 56: 'bruine verglaçante', 57: 'bruine verglaçante', 61: 'pluie faible', 63: 'pluie', 65: 'pluie forte', 66: 'pluie verglaçante', 67: 'pluie verglaçante', 71: 'neige faible', 73: 'neige', 75: 'neige forte', 77: 'grains de neige', 80: 'averses faibles', 81: 'averses', 82: 'fortes averses', 85: 'averses de neige', 86: 'fortes averses de neige', 95: 'orage', 96: 'orage avec grêle', 99: 'orage avec forte grêle' };
export const wmo = c => WMO[c] ?? 'conditions variables';
export function tips(d) {
  const t = [];
  if ((d.pop ?? 0) >= 50 || (d.rain ?? 0) >= 1) t.push('Prenez un parapluie.');
  if (d.max <= 5) t.push('Il fera froid : couvrez-vous.'); if (d.max >= 29) t.push('Forte chaleur : pensez à vous hydrater.');
  if (d.code >= 71 && d.code <= 77) t.push('Neige possible : prévoyez plus de temps de trajet.'); if (d.code >= 95) t.push('Orage possible : prudence en extérieur.');
  return t;
}
async function locate(city, signal) {
  if (city) { const d = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`, { signal }), r = d.results?.[0]; if (!r) throw coded('NOT_FOUND', `Je ne trouve pas la ville « ${city} ».`); return { name: r.name, lat: r.latitude, lon: r.longitude }; }
  const def = getSettings().defaultCity; return def ? locate(def, signal) : devicePosition();
}
const rel = (iso, now = new Date()) => { const d = startOfDay(new Date(iso + 'T12:00')), t = startOfDay(now), n = Math.round((d - t) / 864e5); return n === 0 ? 'Aujourd’hui' : n === 1 ? 'Demain' : n === 2 ? 'Après-demain' : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); };
export default {
  id: 'weather', name: 'Météo', icon: 'cloud', category: 'Informations', agent: 'research', auth: { type: 'none' }, status: 'ready',
  limits: ['Données Open-Meteo (gratuites, sans clé), prévisions jusqu’à 7 jours.', 'Météo&Radar n’a pas d’API publique connue : G.E.N.I.S utilise Open-Meteo pour les données.'],
  capabilities: {
    get: { label: 'Météo', progress: 'Consultation de la météo…', description: 'Météo actuelle et prévisions (7 jours) d’une ville ; sans ville : ville par défaut ou position de l’appareil. Donne température, conditions, risque de pluie.', level: 1,
      permissionFor: a => (a.city || getSettings().defaultCity ? undefined : 'location.read'), params: { city: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD, optionnel (aujourd’hui par défaut).' } },
      run: async ({ city, date }, ctx) => {
        const loc = await locate(city, ctx.signal);
        const d = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=auto&forecast_days=7`, { signal: ctx.signal });
        const days = d.daily.time.map((t, i) => ({ date: t, label: rel(t), code: d.daily.weather_code[i], text: wmo(d.daily.weather_code[i]), min: Math.round(d.daily.temperature_2m_min[i]), max: Math.round(d.daily.temperature_2m_max[i]), pop: d.daily.precipitation_probability_max[i], rain: d.daily.precipitation_sum[i] }));
        const today = isoDay(new Date()), target = days.find(x => x.date === (date || today)) || (date ? null : days[0]);
        if (!target) return { status: 'failed', verified: false, summary: 'Les prévisions couvrent 7 jours à partir d’aujourd’hui.', error: { code: 'BAD_INPUT', message: 'Date hors prévisions.' } };
        const advice = tips(target).join(' '), cur = d.current;
        const summary = target.date === today ? `Actuellement ${Math.round(cur.temperature_2m)} °C à ${loc.name} (${wmo(cur.weather_code)}), ressenti ${Math.round(cur.apparent_temperature)} °C. Aujourd’hui : ${target.min} à ${target.max} °C, ${target.pop ?? 0} % de risque de pluie. ${advice}`.trim()
          : `${target.label} à ${loc.name} : ${target.min} à ${target.max} °C, ${target.text}, ${target.pop ?? 0} % de risque de pluie. ${advice}`.trim();
        return ok(summary, { place: loc.name, current: { temp: cur.temperature_2m, feels: cur.apparent_temperature, text: wmo(cur.weather_code), wind_kmh: cur.wind_speed_10m }, days }, { ui: { cards: [{ type: 'weather', place: loc.name, current: { temp: Math.round(cur.temperature_2m), text: wmo(cur.weather_code) }, days: days.slice(0, 5) }] }, ...(city ? { observe: [{ key: 'city', value: loc.name, label: 'Ville habituelle pour la météo' }] } : {}) });
      } }
  }
};
