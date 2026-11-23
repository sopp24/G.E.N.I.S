/* G.E.N.I.S — compréhension locale (sans IA, hors ligne). Reconnaît les demandes courantes et les convertit en appels d'outils
   passant par le même exécuteur sécurisé que l'IA. Si la demande est complexe ou ambiguë, l'orchestrateur laisse la main au modèle. */
import { norm } from './util.js';
import { findService } from './services.js';
import { parseDuration, parseTimeOfDay, parseDate, isoDay, withTime, startOfDay, addDays } from './datetime-fr.js';
const COLORS = 'noir blanc gris bleu rouge vert jaune rose beige marron violet orange kaki bordeaux marine'.split(' ');
const MATERIALS = 'coton laine cuir lin polyester jean soie cachemire velours'.split(' ');
const CUISINES = { japonais: 'japanese', italien: 'italian', chinois: 'chinese', indien: 'indian', francais: 'french', libanais: 'lebanese', mexicain: 'mexican', thai: 'thai', coreen: 'korean', turc: 'turkish', pizza: 'pizza', sushi: 'sushi', burger: 'burger', vegetarien: 'vegetarian', grec: 'greek', espagnol: 'spanish', vietnamien: 'vietnamese', marocain: 'moroccan' };
const MARKETS = ['vinted', 'leboncoin', 'amazon', 'thomann', 'zalando', 'nike', 'leclerc'];
const CITY = /(?:\bà|\ba|\bau|\ben|\bpour|\bvers|\bautour de|\bpres de|\bprès de)\s+((?:[A-ZÀ-ÖØ-Ý][\p{L}'’-]+)(?:[\s-][A-ZÀ-ÖØ-Ý][\p{L}'’-]+)*)/u;
const call = (name, args = {}) => ({ name, args });
const hit = (calls, confidence = 0.9, extra = {}) => ({ calls, confidence, kind: 'tools', ...extra });
const money = t => { let m = t.match(/entre\s+(\d+)\s*(?:€|euros?)?\s*(?:et|a)\s*(\d+)/); if (m) return { min: +m[1], max: +m[2] }; m = t.match(/(?:moins de|max(?:imum)?|jusqu'a)\s*(\d+)/); return m ? { max: +m[1] } : {}; };
export function parseCalc(raw) {
  let e = norm(raw).replace(/(?:combien (?:font|fait|ca fait|vaut)|calcule(?:r)?|quel est le (?:resultat|total) de|ca fait combien)/g, '').replace(/\?/g, '');
  e = e.replace(/(\d+(?:[.,]\d+)?)\s*%\s*de\s*(\d+(?:[.,]\d+)?)/g, '($1/100)*$2').replace(/\bplus\b/g, '+').replace(/\bmoins\b/g, '-').replace(/\bfois\b/g, '*').replace(/\bdivise(?:e)? par\b/g, '/').replace(/\bau carre\b/g, '^2').replace(/(\d)\s*[x×]\s*(\d)/g, '$1*$2').replace(/÷/g, '/').trim();
  return /\d/.test(e) && /[-+*/^%]|sqrt|racine/.test(e) && /^[\d\s+\-*/^().,%a-z]+$/.test(e) ? e.replace(/racine/g, 'sqrt') : '';
}
function single(raw, now) {
  const text = raw.trim().replace(/^(?:g\.?e\.?n\.?i\.?s|g[ée]nis)[\s,:]+/i, '').replace(/^(?:s'il (?:te|vous) pla[iî]t|peux-tu|pourrais-tu|tu peux|est-ce que tu peux|je voudrais|j'aimerais)[\s,]+/i, '');
  const t = norm(text).replace(/[’]/g, "'");
  let m;
  if (/^(?:merci|super merci|ok merci|parfait merci)/.test(t)) return { kind: 'reply', text: 'Avec plaisir.', confidence: 0.95, calls: [] };
  if (/^(?:bonjour|salut|coucou|hello|bonsoir)\b\s*(?:g[ée]nis)?[!. ]*$/.test(t)) return { kind: 'reply', text: 'Bonjour. Que puis-je faire pour vous ?', confidence: 0.95, calls: [] };
  if (/^(?:quand|lorsque)\s+je\s+dis\b/.test(t)) return { kind: 'automation', text, confidence: 0.9, calls: [] };
  if (/(?:minuteur|compte a rebours|chrono)/.test(t)) { const d = parseDuration(text); return d ? hit([call('system_timer_start', { minutes: d, label: (text.match(/pour\s+(.+)$/i) || [])[1] || '' })], 0.95) : null; }
  if ((m = text.match(/rappelle(?:r)?(?:-| )?moi\s+(?:de |d'|que )?(.+)/i))) {
    const d = parseDuration(text.match(/dans\s+.+/i)?.[0] || ''), tod = parseTimeOfDay(text), date = parseDate(text, now);
    const label = m[1].replace(/\s+(?:dans|à|a|demain|ce soir|apr[eè]s-demain)\b.*$/i, '').trim() || m[1];
    if (d) return hit([call('system_reminder_set', { text: label, minutes: d })], 0.9);
    if (tod) return hit([call('system_reminder_set', { text: label, at: withTime(date || startOfDay(now), tod).toISOString() })], 0.9);
    return null;
  }
  if (/(reveil|reveille[- ]moi|alarme)/.test(t)) { const tod = parseTimeOfDay(text), date = parseDate(text, now); return tod ? hit([call('system_alarm_set', { time: `${String(tod.h).padStart(2, '0')}:${String(tod.m).padStart(2, '0')}`, ...(date ? { date: isoDay(date) } : {}), label: 'Réveil' })], 0.92) : null; }
  if (/quelle heure|quel jour (?:est-on|sommes-nous)|on est quel jour|quelle est la date|on est le combien/.test(t)) return hit([call('system_time_now')], 0.95);
  if ((/combien (font|fait|ca fait|vaut)|calcule|ca fait combien/.test(t) || /^\s*[\d(][\d\s+\-*/x×÷^().,%]+$/.test(t)) && (m = parseCalc(text))) return hit([call('system_calc_eval', { expression: m })], 0.9);
  if (/chanson suivante|change de (?:chanson|musique)|passe (?:la chanson|au suivant)|(?:monte|baisse|augmente) le (?:volume|son)|mets? (?:en )?pause|(?:stop|arrete)(?:s)? la musique|reprends la musique/.test(t)) return hit([call('deezer_control', { action: /monte|augmente/.test(t) ? 'volume_up' : /baisse/.test(t) ? 'volume_down' : /pause|stop|arrete/.test(t) ? 'pause' : /reprends/.test(t) ? 'play' : 'next' })], 0.9);
  if (/meteo|pleuvoir|va-t-il pleuvoir|il pleut|temperature|quel temps|parapluie|neige|il fait (?:froid|chaud|beau)/.test(t)) { const city = (text.match(CITY) || [])[1], date = parseDate(text, now); return hit([call('weather_get', { ...(city ? { city } : {}), ...(date ? { date: isoDay(date) } : {}) })], 0.9); }
  if ((m = t.match(/(?:souviens[- ]toi|retiens|memorise|n'oublie pas)\s+(?:que\s+)?(.+)/))) { const body = text.slice(text.toLowerCase().indexOf(m[1].slice(0, 6))) || m[1]; return hit([call('genis_memory_remember', { text: body.replace(/^que\s+/i, ''), kind: /prefere|aime|deteste|adore/.test(t) ? 'preference' : /habitude|toujours|d'habitude/.test(t) ? 'habit' : 'fact' })], 0.93); }
  if ((m = t.match(/^(?:oublie|supprime de ta memoire|efface de ta memoire)\s+(?:que\s+)?(.+)/))) return hit([call('genis_memory_forget', { query: m[1] })], 0.8);
  if (/que sais[- ]tu de moi|qu'est-ce que tu sais (?:sur|de) moi|montre(?:-moi)? ta memoire/.test(t)) return { kind: 'ui', panel: 'memory', text: 'Voici ce que je retiens.', confidence: 0.95, calls: [] };
  if (/^(?:ouvre|lance|demarre|va sur|affiche|ouvrir)\s+(?:un )?(?:nouvel? espace|nouvelle conversation)/.test(t)) return hit([call('genis_space_open', { title: 'Nouvelle conversation' })], 0.9);
  if (/(?:tu te rappelles|tu te souviens|on en etait ou|on avait parle de quoi|tu m'avais dit|ressors|reprends la recherche)/.test(t)) return hit([call('genis_history_search', { query: text })], 0.7);
  if ((m = text.match(/^(?:ouvre|lance|démarre|demarre|va sur|affiche)\s+(.+)/i)) && findService(m[1])) return hit([call('system_open_service', { service: findService(m[1]).id })], 0.95);
  const market = MARKETS.find(k => new RegExp(`\\b(?:sur|chez)\\s+${k}\\b`).test(t));
  if (market && /(cherche|trouve|recherche|selection|propose|montre)/.test(t)) {
    const p = money(t), size = t.match(/taille\s+([a-z0-9]{1,3})\b/)?.[1], color = COLORS.find(c => t.includes(c)), mat = (t.match(/en\s+(\w+)/g) || []).map(x => x.slice(3)).find(x => MATERIALS.includes(x));
    const excl = [...t.matchAll(/sans\s+(\w+)/g)].map(x => x[1]);
    const item = text.replace(/\b(?:sur|chez)\s+\w+/gi, ' ').replace(/entre\s+\d+\s*(?:€|euros?)?\s*(?:et|a|à)\s*\d+\s*(?:€|euros?)?/gi, ' ').replace(/(?:moins de|max(?:imum)?|jusqu['’]à)\s*\d+\s*(?:€|euros?)?/gi, ' ').replace(/taille\s+\w{1,3}\b/gi, ' ').replace(/sans\s+\w+/gi, ' ').replace(new RegExp(`\\ben\\s+(?:${MATERIALS.join('|')})\\b`, 'gi'), ' ')
      .replace(/^\s*(?:cherche|trouve|recherche|fais|propose|montre)(?:-moi|\s+moi)?\s+(?:une?\s+)?(?:s[ée]lection\s+(?:de|d['’])\s*)?(?:des?\s+|du\s+|un\s+|une\s+)?/i, '').replace(/[,;.]/g, ' ').replace(/\s+/g, ' ').trim();
    return hit([call('shopping_search', { marketplace: market, query: item || text, ...(p.min != null ? { price_min: p.min } : {}), ...(p.max != null ? { price_max: p.max } : {}), ...(size ? { size: size.toUpperCase() } : {}), ...(color ? { color } : {}), ...(mat ? { material: mat } : {}), ...(excl.length ? { exclude: excl } : {}) })], 0.85);
  }
  if ((m = t.match(/(?:ajoute|mets?|rajoute)\s+(.+?)\s+(?:a|sur)\s+ma\s+liste\s+de\s+souhaits?/))) return hit([call('shopping_wishlist_add', { title: m[1] })], 0.9);
  if (/restaurant/.test(t) && /(cherche|trouve|propose|ou manger)/.test(t) && !/reserve/.test(t)) { const cu = Object.keys(CUISINES).find(k => t.includes(k)), city = (text.match(CITY) || [])[1]; return hit([call('booking_restaurants', { ...(cu ? { cuisine: CUISINES[cu] } : {}), ...(city ? { near: city } : {}) })], 0.75); }
  if (/(itineraire|trajet|route|comment aller|combien de temps|distance)/.test(t) && (m = text.match(/\b(?:de|depuis)\s+(.+?)\s+(?:à|a|vers|jusqu['’]à)\s+([^?!.]+?)(?:\s+(?:en|par|à)\s+(voiture|vélo|velo|pied|train|bus|métro|metro|transports?).*)?[?!.]*$/i))) {
    const mode = /voiture|auto/.test(norm(text)) ? 'driving' : /velo/.test(norm(text)) ? 'cycling' : /pied|marche/.test(norm(text)) ? 'walking' : /train|bus|metro|transport/.test(norm(text)) ? 'transit' : 'driving';
    return hit([call('maps_route', { from: m[1].trim(), to: m[2].trim(), mode })], 0.85);
  }
  if (/(?:mon agenda|qu'est-ce que j'ai|j'ai quoi|mes (?:rendez-vous|evenements|reunions)|suis-je libre|planning)/.test(t) && !/ajoute|cree|supprime|annule/.test(t)) {
    const day = parseDate(text, now) || startOfDay(now); return hit([call('google_calendar_list', { from: day.toISOString(), to: addDays(day, 1).toISOString() })], 0.85);
  }
  if ((m = text.match(/^(?:ajoute|cr[ée]e|programme|mets?)\s+(.+?)\s+(?:dans|sur|à|a)\s+mon\s+agenda\s*(.*)$/i))) {
    const rest = `${m[2]} ${m[1]}`, date = parseDate(rest, now), tod = parseTimeOfDay(rest);
    if (date && tod) { const start = withTime(date, tod); return hit([call('google_calendar_create', { title: m[1].replace(/\s+(?:demain|ce soir|à \d.*|a \d.*)$/i, '').trim() || m[1], start: start.toISOString(), end: new Date(start.getTime() + 36e5).toISOString() })], 0.8); }
    return null;
  }
  if (/(actualit|dernieres nouvelles|les news|franceinfo|les infos)/.test(t)) return hit([call('knowledge_news', { topic: (t.match(/sur\s+(.+)$/) || [])[1] || '' })], 0.8);
  if ((m = text.match(/^(?:c['’]est quoi|qu['’]est-ce que|qui est|qui était|qui etait|parle-moi de|parle moi de|explique-moi)\s+(.+?)\s*\??$/i))) return hit([call('knowledge_wikipedia', { query: m[1].replace(/^(?:un|une|le|la|les|l['’])\s*/i, '') })], 0.65);
  if ((m = text.match(/^(?:mets|met|joue|lance|passe|écouter|ecouter|je veux écouter|je veux ecouter)\s+(?:moi\s+)?(?:du |de la |des |un peu de |de l['’]|ma |mon |la |le |l['’])?(.+)$/i)) && !/minuteur|reveil/.test(t)) {
    const q = m[1].replace(/\s+sur\s+deezer\s*$/i, '').trim();
    if (q && !findService(q)) return hit([call('deezer_play', { query: q, ...(/\b(?:ma|mon)\s/i.test(text) ? { mine: true } : {}) })], 0.8);
  }
  return null;
}
/** Retourne { kind, calls, confidence, text? } ou null. Gère aussi les demandes composées (« … et … »). */
export function parseLocal(raw, ctx = {}) {
  const now = ctx.now || new Date();
  const parts = raw.split(/\s*(?:,|;|\bet puis\b|\bpuis\b|\bet\b(?=\s+(?:mets|met|donne|ouvre|lance|dis|cherche|quel|quelle|joue|règle|regle|programme)))\s*/i).filter(Boolean);
  if (parts.length >= 2 && parts.length <= 5) {
    const parsed = parts.map(p => single(p, now));
    if (parsed.every(p => p?.kind === 'tools')) return { kind: 'tools', calls: parsed.flatMap(p => p.calls), confidence: Math.min(...parsed.map(p => p.confidence)), composed: true };
  }
  return single(raw, now);
}
