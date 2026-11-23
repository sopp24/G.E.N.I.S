/* G.E.N.I.S — catalogue des services externes (lanceur et ouverture de pages). Données pures, aucune API.
   {q} est remplacé par la recherche encodée. Un service sans url est « à configurer » : on ne devine jamais une adresse. */
import { norm, safeUrl } from './util.js';
import { getSettings } from './storage.js';
const S = (id, name, cat, url, search = '', aliases = []) => ({ id, name, cat, url, search, aliases });
export const SERVICES = [
  S('deezer', 'Deezer', 'Musique', 'https://www.deezer.com/fr/', 'https://www.deezer.com/fr/search/{q}'),
  S('youtube', 'YouTube', 'Vidéo', 'https://www.youtube.com/', 'https://www.youtube.com/results?search_query={q}'),
  S('twitch', 'Twitch', 'Vidéo', 'https://www.twitch.tv/', 'https://www.twitch.tv/search?term={q}'),
  S('netflix', 'Netflix', 'Vidéo', 'https://www.netflix.com/', 'https://www.netflix.com/search?q={q}'),
  S('disney', 'Disney+', 'Vidéo', 'https://www.disneyplus.com/', '', ['disney plus', 'disney']),
  S('prime', 'Prime Video', 'Vidéo', 'https://www.primevideo.com/', '', ['amazon prime video', 'prime']),
  S('canalplus', 'Canal+', 'Vidéo', 'https://www.canalplus.com/', '', ['canal plus', 'canal']),
  S('gmail', 'Gmail', 'Messagerie', 'https://mail.google.com/', '', ['mails', 'mes mails', 'boite mail']),
  S('outlook', 'Outlook', 'Messagerie', 'https://outlook.live.com/mail/'),
  S('agenda', 'Google Agenda', 'Agenda', 'https://calendar.google.com/', '', ['agenda', 'mon agenda', 'calendrier']),
  S('maps', 'Google Maps', 'Cartes', 'https://www.google.com/maps', 'https://www.google.com/maps/search/?api=1&query={q}', ['maps', 'google maps']),
  S('docs', 'Google Docs', 'Documents', 'https://docs.google.com/document/', '', ['docs']),
  S('sheets', 'Google Sheets', 'Documents', 'https://docs.google.com/spreadsheets/', '', ['sheets']),
  S('slides', 'Google Slides', 'Documents', 'https://docs.google.com/presentation/', '', ['slides']),
  S('drive', 'Google Drive', 'Documents', 'https://drive.google.com/', '', ['drive']),
  S('slack', 'Slack', 'Travail', 'https://app.slack.com/'),
  S('discord', 'Discord', 'Travail', 'https://discord.com/app'),
  S('teams', 'Microsoft Teams', 'Travail', 'https://teams.microsoft.com/', '', ['teams']),
  S('vinted', 'Vinted', 'Achats', 'https://www.vinted.fr/', 'https://www.vinted.fr/catalog?search_text={q}'),
  S('leboncoin', 'Leboncoin', 'Achats', 'https://www.leboncoin.fr/', 'https://www.leboncoin.fr/recherche?text={q}', ['le bon coin']),
  S('amazon', 'Amazon', 'Achats', 'https://www.amazon.fr/', 'https://www.amazon.fr/s?k={q}'),
  S('thomann', 'Thomann', 'Achats', 'https://www.thomann.de/fr/', 'https://www.thomann.de/fr/search_dir.html?sw={q}'),
  S('zalando', 'Zalando', 'Achats', 'https://www.zalando.fr/', 'https://www.zalando.fr/catalogue/?q={q}'),
  S('nike', 'Nike', 'Achats', 'https://www.nike.com/fr/', 'https://www.nike.com/fr/w?q={q}'),
  S('leclerc', 'E.Leclerc Drive', 'Achats', 'https://www.e.leclerc/', '', ['leclerc', 'leclerc drive']),
  S('sncf', 'SNCF Connect', 'Transport', 'https://www.sncf-connect.com/', '', ['sncf', 'train']),
  S('uber', 'Uber', 'Transport', 'https://m.uber.com/'),
  S('ubereats', 'Uber Eats', 'Transport', 'https://www.ubereats.com/fr', '', ['uber eats']),
  S('doctolib', 'Doctolib', 'Santé', 'https://www.doctolib.fr/'),
  S('ameli', 'Ameli', 'Santé', 'https://www.ameli.fr/', '', ['assurance maladie']),
  S('bnp', 'BNP Paribas', 'Banque', 'https://mabanque.bnpparibas/', '', ['bnp', 'ma banque']),
  S('franceinfo', 'Franceinfo', 'Infos', 'https://www.franceinfo.fr/', '', ['france info']),
  S('meteoradar', 'Météo&Radar', 'Météo', '', '', ['meteo et radar', 'meteo radar']),
  S('sopp-agents', 'SOPP Agents', 'SOPP', 'https://sopp24.github.io/SOPP-agents/', '', ['sopp agents']),
  S('sopp-language', 'SOPP Language', 'SOPP', '', '', ['sopp language']),
  S('pharma-sopp', 'Pharma SOPP', 'SOPP', '', '', ['pharma sopp'])
];
/** Résout l'URL réelle (certains services SOPP viennent des réglages). Chaîne vide = à configurer. */
export function serviceUrl(svc, query = '') {
  const s = getSettings();
  const base = svc.id === 'sopp-language' ? s.soppLanguageUrl : svc.id === 'pharma-sopp' ? s.soppPharmaUrl : svc.url;
  if (query && svc.search) return svc.search.replace('{q}', encodeURIComponent(query));
  return safeUrl(base || '');
}
export function findService(text) {
  const t = ` ${norm(text).replace(/[^a-z0-9+& ]+/g, ' ')} `;
  let best = null;
  for (const svc of SERVICES) for (const name of [svc.name, ...svc.aliases]) {
    const n = ` ${norm(name).replace(/[^a-z0-9+& ]+/g, ' ').trim()} `;
    if (t.includes(n) && (!best || n.length > best.len)) best = { svc, len: n.length };
  }
  return best?.svc || null;
}
