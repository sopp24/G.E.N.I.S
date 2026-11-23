/* G.E.N.I.S — rendu des cartes de résultat (météo, itinéraire, agenda, planning de voyage, budget…). Aucun innerHTML : tout passe par h()/textContent.
   Les liens externes sont filtrés (https uniquement) car ils peuvent provenir de flux ou de pages non fiables. */
import { h, icon, fmt, download, safeUrl } from './util.js';
const A = (url, label, cls = 'lnk') => { const u = safeUrl(url); return u ? h('a', { class: cls, href: u, target: '_blank', rel: 'noopener noreferrer' }, label, icon('external')) : null; };
const head = c => (c.title ? h('h4', { class: 'card-title' }, c.title) : null);
const day = d => new Date(d + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const money = (n, c) => fmt.money(n, c || 'EUR');
const R = {
  text: c => h('article', { class: 'card' }, head(c), h('p', { class: 'card-text' }, c.text), c.url ? A(c.url, c.urlLabel || 'Ouvrir') : null),
  note: c => h('p', { class: 'note' }, icon('info'), c.text),
  kv: c => h('article', { class: 'card' }, head(c), h('dl', { class: 'kv' }, (c.items || []).flatMap(i => [h('dt', {}, i.label), h('dd', {}, i.value)]))),
  list: c => h('article', { class: 'card' }, head(c), h('ul', { class: 'rows' }, (c.items || []).map(i => h('li', {}, i.url && safeUrl(i.url) ? A(i.url, i.title, 'row-title') : h('span', { class: 'row-title' }, i.title), i.subtitle ? h('span', { class: 'row-sub' }, i.subtitle) : null)))),
  links: c => h('article', { class: 'card' }, head(c), h('div', { class: 'btn-row' }, (c.links || []).map(l => A(l.url, l.label, l.primary ? 'btn primary' : 'btn')))),
  weather: c => h('article', { class: 'card weather' }, h('div', { class: 'wx-now' }, h('strong', {}, `${c.current.temp}°`), h('span', {}, `${c.place}, ${c.current.text}`)),
    h('div', { class: 'wx-days' }, c.days.map(d => h('div', { class: 'wx-day' }, h('span', {}, d.label.replace(/^(\p{L}{3})\p{L}*/u, '$1')), h('b', {}, `${d.max}°`), h('i', {}, `${d.min}°`), h('em', {}, d.pop != null ? `${d.pop} %` : ''))))),
  route: c => h('article', { class: 'card' }, h('h4', { class: 'card-title' }, `${c.from} → ${c.to}`), h('p', { class: 'big' }, `${c.km.toFixed(c.km < 10 ? 1 : 0)} km`, h('span', {}, ` · ${c.minutes >= 60 ? Math.floor(c.minutes / 60) + ' h ' + String(Math.round(c.minutes % 60)).padStart(2, '0') : Math.round(c.minutes) + ' min'}`)), A(c.url, 'Ouvrir dans Google Maps')),
  events: c => h('article', { class: 'card' }, h('h4', { class: 'card-title' }, 'Agenda'), h('ul', { class: 'rows' }, (c.items || []).map(e => h('li', {}, h('span', { class: 'row-title' }, e.title), h('span', { class: 'row-sub' }, [e.allDay ? 'toute la journée' : fmt.dateTime(e.start), e.location].filter(Boolean).join(' · ')), e.link ? A(e.link, 'Voir') : null)))),
  mail: c => h('article', { class: 'card' }, h('h4', { class: 'card-title' }, 'Messages'), h('ul', { class: 'rows' }, (c.items || []).map(m => h('li', {}, h('span', { class: 'row-title' }, m.subject || '(sans objet)'), h('span', { class: 'row-sub' }, `${m.from} · ${fmt.dateTime(m.date)}`), m.snippet ? h('span', { class: 'row-snip' }, m.snippet) : null)))),
  itinerary: c => h('article', { class: 'card wide' }, head(c), c.warnings?.length ? h('ul', { class: 'warn' }, c.warnings.slice(0, 4).map(w => h('li', {}, icon('alert'), w))) : null,
    (c.days || []).map(d => h('section', { class: 'day' }, h('h5', {}, day(d.date)), h('ul', { class: 'rows' }, d.items.map(i => h('li', {}, h('span', { class: 'time' }, i.time || '—'), h('span', { class: 'row-title' }, i.title, i.place ? h('em', {}, ` ${i.place}`) : null), h('span', { class: 'pill' }, i.category), i.cost != null ? h('span', { class: 'row-sub' }, `≈ ${money(i.cost, c.currency)}`) : null)))))),
  budget: c => h('article', { class: 'card wide' }, h('h4', { class: 'card-title' }, 'Budget du voyage'),
    c.alerts?.length ? h('ul', { class: 'warn' }, c.alerts.map(a => h('li', {}, icon('alert'), a))) : null,
    c.options.map(o => h('section', { class: 'opt' }, h('div', { class: 'opt-head' }, h('b', {}, o.name), h('span', {}, `${money(o.total, c.currency)} · ${money(o.perDay, c.currency)}/jour`)),
      c.limit ? h('div', { class: `meter${o.over ? ' over' : ''}` }, h('i', { style: { width: Math.min(100, o.pct) + '%' } })) : null,
      h('p', { class: 'row-sub' }, Object.entries(o.byCat).map(([k, v]) => `${k} ${money(v, c.currency)}`).join(' · '), c.limit ? ` — plafond ${money(c.limit, c.currency)}${o.remaining != null ? `, reste ${money(o.remaining, c.currency)}` : ''}` : ''))),
    h('ul', { class: 'rows' }, c.lines.map(l => h('li', {}, h('span', { class: 'row-title' }, `${l.label}${l.option ? ` (${l.option})` : ''}`), h('span', { class: 'row-sub' }, `${l.source === 'estimate' ? '≈ ' : ''}${money(l.amount, c.currency)} · ${l.category}`))))),
  trip: c => h('article', { class: 'card' }, h('h4', { class: 'card-title' }, c.name), h('p', { class: 'row-sub' }, `${c.destination} · ${day(c.start)} → ${day(c.end)} · ${c.days} jour(s) · ${c.travelers} voyageur(s)`), h('p', { class: 'row-sub' }, `Planning : ${c.planned}/${c.days} jour(s)${c.limit ? ` · budget ${money(c.limit, c.currency)}` : ''}${c.total != null ? ` · prévu ${money(c.total, c.currency)}` : ''}`)),
  player: (c, ctx) => h('article', { class: 'card' }, h('h4', { class: 'card-title' }, h('span', { class: 'ic' }, icon('music')), c.title), h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: () => ctx.openPlayer?.(c) }, icon('play'), 'Lecteur'), c.link ? A(c.link, 'Ouvrir sur Deezer') : null), h('p', { class: 'row-sub' }, 'Extraits de 30 s si vous n’êtes pas connecté à Deezer dans ce navigateur.')),
  ics: c => h('article', { class: 'card' }, h('button', { class: 'btn', onclick: () => download(c.filename, c.content, 'text/calendar') }, icon('download'), c.label || 'Télécharger'))
};
export function renderCard(c, ctx = {}) {
  try { if (R[c.type]) return R[c.type](c, ctx); } catch (e) { console.error('[G.E.N.I.S] carte', c.type, e); }
  return h('details', { class: 'card' }, h('summary', {}, 'Résultat'), h('pre', {}, JSON.stringify(c, null, 2).slice(0, 2000)));
}
