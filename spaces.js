/* G.E.N.I.S — espaces de travail (multitâche). Chaque espace possède sa conversation et son état ; plusieurs peuvent tourner en parallèle.
   On passe de l'un à l'autre sans perdre le contexte (aperçu « mission control » dans l'interface). */
import { store } from './storage.js';
import { bus, uid } from './util.js';
import { createChat, getChat } from './memory.js';
export const SPACE_KINDS = { home: ['Accueil', 'home'], chat: ['Conversation', 'chat'], travel: ['Voyage', 'plane'], media: ['Média', 'music'], mail: ['Messagerie', 'mail'], shopping: ['Achats', 'bag'], research: ['Recherche', 'search'], sopp: ['SOPP', 'layers'] };
export const MAX_SPACES = 8;
const state = () => store.get('spaces', { list: [], active: '' });
const save = s => { store.set('spaces', s); bus.emit('spaces'); };
export const listSpaces = () => state().list;
export const getSpace = id => state().list.find(s => s.id === id) || null;
export const activeSpace = () => getSpace(state().active) || state().list[0] || null;
export function ensureSpaces() {
  const s = state();
  s.list = s.list.filter(x => getChat(x.chatId));
  if (!s.list.length) { const chat = createChat('Accueil'); s.list = [{ id: uid('sp'), title: 'Accueil', kind: 'home', chatId: chat.id, status: 'idle', createdAt: Date.now(), updatedAt: Date.now(), pinned: true }]; }
  if (!s.list.some(x => x.id === s.active)) s.active = s.list[0].id;
  save(s); return s.list;
}
export function openSpace({ title = 'Nouvelle conversation', kind = 'chat', chatId = '', activate = true } = {}) {
  const s = state(), existing = chatId && s.list.find(x => x.chatId === chatId);
  if (existing) { if (activate) activateSpace(existing.id); return existing; }
  if (s.list.length >= MAX_SPACES) { const victim = s.list.find(x => !x.pinned && x.status === 'idle' && x.id !== s.active); if (!victim) throw new Error(`Maximum de ${MAX_SPACES} espaces ouverts : fermez-en un.`); s.list = s.list.filter(x => x.id !== victim.id); }
  const chat = chatId ? getChat(chatId) : createChat(title);
  const sp = { id: uid('sp'), title: chat?.title || title, kind: SPACE_KINDS[kind] ? kind : 'chat', chatId: chat.id, status: 'idle', createdAt: Date.now(), updatedAt: Date.now(), pinned: false };
  s.list.push(sp); if (activate) s.active = sp.id; save(s); return sp;
}
export function activateSpace(id) { const s = state(); if (s.list.some(x => x.id === id)) { s.active = id; save(s); } }
export function closeSpace(id) {
  const s = state(), sp = s.list.find(x => x.id === id); if (!sp || sp.kind === 'home') return;
  s.list = s.list.filter(x => x.id !== id); if (s.active === id) s.active = s.list[0]?.id || ''; save(s);
}
export function patchSpace(id, patch) { const s = state(); s.list = s.list.map(x => (x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x)); save(s); }
export const setSpaceStatus = (id, status, detail = '') => patchSpace(id, { status, detail });
export const pinSpace = id => patchSpace(id, { pinned: !getSpace(id)?.pinned });
