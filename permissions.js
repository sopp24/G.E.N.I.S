/* G.E.N.I.S — catalogue central des permissions. Chaque capacité de connecteur référence une permission.
   États : granted | ask | denied. Les actions de niveau 3 ont un mode de confirmation (confirm | auto). Le niveau 4 est toujours « fort ». */
import { store } from './storage.js';
import { bus } from './util.js';
const P = (label, level, group, def, extra = {}) => ({ label, level, group, def, ...extra });
export const PERMISSIONS = {
  'microphone.use': P('Utiliser le microphone', 1, 'Appareil', 'ask'),
  'location.read': P('Lire ma position', 1, 'Appareil', 'ask'),
  'notifications.send': P('Envoyer des notifications', 1, 'Appareil', 'ask'),
  'web.open': P('Ouvrir des sites et applications', 2, 'Appareil', 'granted'),
  'media.control': P('Contrôler musique et vidéos', 1, 'Médias', 'granted'),
  'memory.write': P('Écrire dans ma mémoire', 2, 'Mémoire', 'granted'),
  'memory.delete': P('Supprimer des souvenirs', 3, 'Mémoire', 'granted'),
  'automation.manage': P('Créer et modifier des automatisations', 2, 'Automatisations', 'granted'),
  'calendar.read': P('Lire l’agenda', 1, 'Agenda et messagerie', 'ask'),
  'calendar.write': P('Modifier l’agenda', 3, 'Agenda et messagerie', 'ask'),
  'mail.read': P('Lire les e-mails', 1, 'Agenda et messagerie', 'ask', { sensitive: true }),
  'mail.draft': P('Préparer des brouillons d’e-mail', 2, 'Agenda et messagerie', 'ask'),
  'mail.send': P('Envoyer des e-mails', 3, 'Agenda et messagerie', 'ask'),
  'files.read': P('Lire des fichiers', 1, 'Fichiers', 'ask'),
  'files.write': P('Modifier des fichiers', 3, 'Fichiers', 'ask'),
  'files.delete': P('Supprimer des fichiers', 4, 'Fichiers', 'ask'),
  'travel.plan': P('Préparer des voyages', 2, 'Vie pratique', 'granted'),
  'shopping.prepare': P('Préparer des recherches d’achat', 2, 'Vie pratique', 'granted'),
  'shopping.purchase': P('Effectuer des achats', 4, 'Vie pratique', 'ask'),
  'booking.prepare': P('Préparer des réservations', 2, 'Vie pratique', 'granted'),
  'booking.make': P('Effectuer des réservations', 3, 'Vie pratique', 'ask'),
  'health.read': P('Consulter la santé et l’administratif', 1, 'Données sensibles', 'ask', { sensitive: true }),
  'school.read': P('Consulter la scolarité', 1, 'Données sensibles', 'ask', { sensitive: true }),
  'bank.read': P('Consulter les comptes bancaires', 1, 'Données sensibles', 'ask', { sensitive: true }),
  'bank.transfer': P('Effectuer un virement', 4, 'Données sensibles', 'denied'),
  'payment.make': P('Effectuer un paiement', 4, 'Données sensibles', 'ask'),
  'home.control': P('Contrôler la maison', 3, 'Maison connectée', 'ask'),
  'home.sensitive': P('Serrures, alarme, caméras, portails', 4, 'Maison connectée', 'ask'),
  'data.erase': P('Effacer définitivement les données de G.E.N.I.S', 4, 'Données', 'granted')
};
const state = () => store.get('permissions', { states: {}, confirm: {} });
export const permState = id => PERMISSIONS[id] ? (state().states[id] ?? PERMISSIONS[id].def) : 'granted';
export const confirmMode = id => state().confirm[id] ?? 'confirm';
export function setPerm(id, value) {
  if (!PERMISSIONS[id] || !['granted', 'ask', 'denied'].includes(value)) return;
  store.update('permissions', s => ({ ...s, states: { ...s.states, [id]: value } }), { states: {}, confirm: {} }); bus.emit('permissions', id);
}
export function setConfirmMode(id, value) {
  if (!PERMISSIONS[id] || PERMISSIONS[id].level !== 3 || !['confirm', 'auto'].includes(value)) return;
  store.update('permissions', s => ({ ...s, confirm: { ...s.confirm, [id]: value } }), { states: {}, confirm: {} }); bus.emit('permissions', id);
}
export const allPermissions = () => Object.entries(PERMISSIONS).map(([id, p]) => ({ id, ...p, state: permState(id), confirm: confirmMode(id) }));
export function resetPermissions() { store.set('permissions', { states: {}, confirm: {} }); bus.emit('permissions'); }
