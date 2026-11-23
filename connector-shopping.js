/* Connecteur « Achats » : construit des recherches filtrées sur Vinted, Leboncoin, Amazon, Thomann, Zalando, Nike, E.Leclerc et tient une liste de souhaits G.E.N.I.S.
   Aucune de ces plateformes n'offre d'API publique de lecture : G.E.N.I.S ne lit pas les résultats, ne remplit aucun panier et n'achète jamais (niveau 4). */
import { ok, fail, manual } from './connectors.js';
import { store } from './storage.js';
import { uid, bus, norm } from './util.js';
import { SERVICES } from './services.js';
const enc = encodeURIComponent, CLOTHES = ['vinted', 'zalando', 'nike', 'leboncoin'];
export const MARKETS = ['vinted', 'leboncoin', 'amazon', 'thomann', 'zalando', 'nike', 'leclerc'];
/** URL de recherche + critères réellement encodés dans l'URL (applied) et critères que l'utilisateur doit vérifier (manual). */
export function buildSearchUrl(market, c) {
  const words = [c.query, c.color && !norm(c.query).includes(norm(c.color)) ? c.color : '', c.material].filter(Boolean).join(' '), text = CLOTHES.includes(market) && c.size ? `${words} taille ${c.size}` : words;
  const applied = ['mots-clés'], hand = [];
  let url;
  if (market === 'vinted') { url = `https://www.vinted.fr/catalog?search_text=${enc(text)}&order=newest_first&currency=EUR`; if (c.price_min != null) url += `&price_from=${c.price_min}`; if (c.price_max != null) url += `&price_to=${c.price_max}`; if (c.price_min != null || c.price_max != null) applied.push('prix'); }
  else if (market === 'leboncoin') { url = `https://www.leboncoin.fr/recherche?text=${enc(text)}`; if (c.price_min != null || c.price_max != null) { url += `&price=${c.price_min ?? 'min'}-${c.price_max ?? 'max'}`; applied.push('prix'); } }
  else if (market === 'amazon') { url = `https://www.amazon.fr/s?k=${enc(text)}`; if (c.price_min != null || c.price_max != null) { url += `&rh=p_36%3A${c.price_min != null ? c.price_min * 100 : ''}-${c.price_max != null ? c.price_max * 100 : ''}`; applied.push('prix'); } }
  else if (market === 'thomann') url = `https://www.thomann.de/fr/search_dir.html?sw=${enc(text)}`;
  else if (market === 'zalando') url = `https://www.zalando.fr/catalogue/?q=${enc(text)}`;
  else if (market === 'nike') url = `https://www.nike.com/fr/w?q=${enc(text)}`;
  else url = 'https://www.e.leclerc/';
  if (!applied.includes('prix') && (c.price_min != null || c.price_max != null)) hand.push(`prix ${c.price_min ?? 0}–${c.price_max ?? '∞'} €`);
  if (c.size) applied.push('taille (dans les mots-clés)'); if (c.color) applied.push('couleur (dans les mots-clés)'); if (c.material) applied.push('matière (dans les mots-clés)');
  for (const x of c.exclude || []) hand.push(`sans ${x}`);
  if (market === 'leclerc') hand.push('recherche du produit (choisir un magasin Drive)');
  return { url, text, applied, manual: hand };
}
const list = () => store.get('wishlist', []);
export default {
  id: 'shopping', name: 'Achats', icon: 'bag', category: 'Vie pratique', agent: 'shopping', auth: { type: 'none' }, status: 'ready',
  limits: ['Vinted, Leboncoin, Amazon, Thomann, Zalando, Nike, E.Leclerc : pas d’API publique de lecture. G.E.N.I.S prépare la recherche filtrée ; vous parcourez les résultats.', 'La liste de souhaits est celle de G.E.N.I.S (locale), pas celle du site marchand.', 'Aucun achat automatique : acheter est une action de niveau 4 (authentification forte) et n’est pas disponible.'],
  capabilities: {
    search: { label: 'Préparer une recherche d’achat', progress: 'Préparation de la recherche…', description: 'Construit une recherche filtrée sur une marketplace (prix, taille, couleur, matière dans les mots-clés ; exclusions à vérifier à la main). Ne lit pas les résultats.', level: 2, permission: 'shopping.prepare',
      params: { marketplace: { type: 'string', enum: MARKETS }, query: { type: 'string', description: 'Article (ex. « pull »).' }, price_min: { type: 'number' }, price_max: { type: 'number' }, size: { type: 'string' }, color: { type: 'string' }, material: { type: 'string' }, exclude: { type: 'array', items: { type: 'string' }, description: 'Caractéristiques à exclure (ex. capuche).' } }, required: ['marketplace', 'query'],
      run: c => {
        const b = buildSearchUrl(c.marketplace, c), name = SERVICES.find(s => s.id === c.marketplace)?.name || c.marketplace;
        const r = manual(`J’ai préparé la recherche ${name} (« ${b.text} »${c.price_min != null || c.price_max != null ? `, ${c.price_min ?? 0}–${c.price_max ?? '∞'} €` : ''}). ${name} n’a pas d’API publique : je ne peux pas lire les résultats${b.manual.length ? `, ni appliquer : ${b.manual.join(', ')}` : ''}, ni ajouter à une liste de souhaits du site. Veux-tu que j’ouvre la page ?`, { url: b.url, label: `Ouvrir ${name}` });
        r.data = { marketplace: c.marketplace, url: b.url, applied: b.applied, to_check_manually: b.manual };
        r.ui.cards.unshift({ type: 'kv', title: 'Critères', items: [...b.applied.map(a => ({ label: 'Appliqué', value: a })), ...b.manual.map(a => ({ label: 'À vérifier', value: a }))] });
        r.observe = [{ key: 'marketplace', value: name, label: 'Marketplace préférée' }]; return r;
      } },
    wishlist_add: { label: 'Ajouter à la liste de souhaits', description: 'Ajoute un article (titre, lien, prix) à la liste de souhaits G.E.N.I.S.', level: 2, permission: 'shopping.prepare', params: { title: { type: 'string' }, url: { type: 'string' }, price: { type: 'number' }, note: { type: 'string' } }, required: ['title'],
      run: ({ title, url, price, note }) => { const it = { id: uid('wish'), title, url: /^https:\/\//.test(url || '') ? url : '', price, note, createdAt: Date.now() }; if (list().length >= 200) return fail('FAILED', 'La liste de souhaits est pleine (200 articles).'); store.set('wishlist', [it, ...list()]); bus.emit('wishlist'); return list().some(x => x.id === it.id) ? { ...ok(`« ${title} » ajouté à votre liste de souhaits G.E.N.I.S.`, { id: it.id }), brief: true } : fail('FAILED', 'L’ajout n’a pas pu être confirmé.'); } },
    wishlist_list: { label: 'Voir la liste de souhaits', description: 'Liste les articles de la liste de souhaits G.E.N.I.S.', level: 1, params: {}, run: () => ok(list().length ? `${list().length} article(s) dans la liste de souhaits.` : 'La liste de souhaits est vide.', { items: list() }, list().length ? { ui: { cards: [{ type: 'list', title: 'Liste de souhaits', items: list().map(i => ({ title: i.title, subtitle: i.price ? `${i.price} €` : '', url: i.url })) }] } } : {}) },
    wishlist_remove: { label: 'Retirer de la liste de souhaits', description: 'Retire un article de la liste de souhaits par titre.', level: 2, permission: 'shopping.prepare', params: { title: { type: 'string' } }, required: ['title'],
      run: ({ title }) => { const hit = list().find(i => i.title.toLowerCase().includes(title.toLowerCase())); if (!hit) return fail('NOT_FOUND', 'Aucun article correspondant.'); store.set('wishlist', list().filter(i => i.id !== hit.id)); return ok(`« ${hit.title} » retiré de la liste.`); } }
  }
};
