/* G.E.N.I.S — mémoire structurée et historique. Rien n'est « magique » : quotas explicites, catégories, tout est visible et modifiable.
   Souvenirs (préférences, projets, habitudes…) + conversations (une clé par conversation) + recherche pondérée (BM25 simplifié). */
import { store, getSettings } from './storage.js';
import { bus, uid, norm, tokens } from './util.js';
import { dayRange, fmtDay } from './datetime-fr.js';
export const KINDS = { preference: 'Préférence', fact: 'Information', project: 'Projet', task: 'Tâche', habit: 'Habitude', place: 'Lieu', important: 'Important', style: 'Style d’écriture' };
export const LIMITS = { memories: 300, memoryChars: 1200, chats: 400, messages: 600 };

/* ---------- Pondération des documents ---------- */
function rank(docs, query) {
  const q = [...new Set(tokens(query))]; if (!q.length || !docs.length) return [];
  const toks = docs.map(d => tokens(d.text)), df = new Map();
  toks.forEach(ts => new Set(ts).forEach(t => df.set(t, (df.get(t) || 0) + 1)));
  const avg = toks.reduce((a, t) => a + t.length, 0) / docs.length || 1;
  return docs.map((doc, i) => {
    let s = 0;
    for (const t of q) {
      let tf = 0; for (const x of toks[i]) if (x === t || (t.length > 3 && x.length > 3 && (x.startsWith(t) || t.startsWith(x)))) tf++;
      if (!tf) continue;
      const n = df.get(t) || 1; s += Math.log(1 + (docs.length - n + 0.5) / (n + 0.5)) * (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * toks[i].length / avg));
    }
    return { doc, score: s * (doc.boost || 1) };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
}

/* ---------- Souvenirs ---------- */
export const listMemories = () => store.get('memories', []);
export function addMemory({ text, kind = 'fact', tags = [], importance = 3, source = 'user', pinned = false }) {
  text = String(text || '').trim().slice(0, LIMITS.memoryChars); if (!text) throw new Error('Le souvenir est vide.');
  const list = listMemories(), dup = list.find(m => norm(m.text) === norm(text));
  if (dup) return updateMemory(dup.id, { updatedAt: Date.now() });
  if (list.length >= LIMITS.memories) throw new Error(`Limite de ${LIMITS.memories} souvenirs atteinte : supprimez-en avant d’en ajouter.`);
  const item = { id: uid('mem'), text, kind: KINDS[kind] ? kind : 'fact', tags, importance, source, pinned, createdAt: Date.now(), updatedAt: Date.now(), lastUsedAt: 0, uses: 0 };
  store.set('memories', [item, ...list]); bus.emit('memory'); return item;
}
export function updateMemory(id, patch) {
  let out = null;
  store.update('memories', l => l.map(m => (m.id === id ? (out = { ...m, ...patch, updatedAt: Date.now() }) : m)), []); bus.emit('memory'); return out;
}
export function removeMemory(id) { store.update('memories', l => l.filter(m => m.id !== id), []); bus.emit('memory'); }
export function clearMemories() { store.set('memories', []); bus.emit('memory'); }
export function searchMemories(query, { limit = 6, kinds } = {}) {
  const day = 864e5, docs = listMemories().filter(m => !kinds || kinds.includes(m.kind)).map(m => ({ ...m, boost: (0.7 + m.importance * 0.15) * (m.pinned ? 1.5 : 1) * (1 + Math.max(0, 1 - (Date.now() - m.updatedAt) / (90 * day)) * 0.3) }));
  return rank(docs, query).slice(0, limit).map(r => r.doc);
}

/* ---------- Conversations ---------- */
export const chatIndex = () => store.get('chats:index', []);
export const getChat = id => store.get('chat:' + id, null);
export function createChat(title = 'Nouvelle conversation') {
  const chat = { id: uid('chat'), title, createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
  store.set('chat:' + chat.id, chat); store.set('chats:index', [{ id: chat.id, title, createdAt: chat.createdAt, updatedAt: chat.updatedAt, count: 0 }, ...chatIndex()]); bus.emit('chats'); return chat;
}
export function saveChat(chat) {
  chat.updatedAt = Date.now(); store.set('chat:' + chat.id, chat);
  store.update('chats:index', idx => idx.map(i => (i.id === chat.id ? { ...i, title: chat.title, updatedAt: chat.updatedAt, count: chat.messages.length } : i)), []); bus.emit('chats');
}
export function appendMessage(chat, msg) {
  const m = { id: uid('msg'), createdAt: Date.now(), meta: {}, ...msg }; chat.messages.push(m);
  if (chat.messages.length > LIMITS.messages) chat.messages.splice(0, chat.messages.length - LIMITS.messages);
  if (msg.role === 'user' && /^Nouvelle conversation$/.test(chat.title)) chat.title = String(msg.content).replace(/\s+/g, ' ').slice(0, 48);
  saveChat(chat); return m;
}
export function deleteChat(id) { store.remove('chat:' + id); store.update('chats:index', i => i.filter(c => c.id !== id), []); bus.emit('chats'); }
export const historyStats = () => ({ chats: chatIndex().length, memories: listMemories().length, limits: LIMITS });
export function searchHistory(query, { limit = 8, excludeChatId = '' } = {}) {
  const docs = [];
  for (const { id } of chatIndex()) {
    if (id === excludeChatId) continue; const c = getChat(id); if (!c) continue;
    for (const m of c.messages) docs.push({ text: `${c.title} ${m.content}`, chatId: id, title: c.title, role: m.role, content: String(m.content), createdAt: m.createdAt || c.updatedAt, boost: 1 + Math.max(0, 1 - (Date.now() - (m.createdAt || 0)) / (30 * 864e5)) * 0.25 });
  }
  return rank(docs, query).slice(0, limit).map(r => ({ ...r.doc, score: r.score }));
}
/** « On avait parlé de quoi hier ? » → conversations d'un jour donné (recherche purement locale). */
export function recallByDay(text, now = new Date()) {
  const range = dayRange(text, now); if (!range) return null;
  const chats = chatIndex().map(i => getChat(i.id)).filter(Boolean).map(c => ({ c, msgs: c.messages.filter(m => m.createdAt >= range.from.getTime() && m.createdAt <= range.to.getTime()) })).filter(x => x.msgs.length)
    .map(({ c, msgs }) => ({ id: c.id, title: c.title, count: msgs.length, topics: msgs.filter(m => m.role === 'user').slice(0, 3).map(m => String(m.content).slice(0, 90)) }));
  return { range, label: fmtDay(range.from), chats };
}
export const RECALL_CUES = /(tu te rappelles|tu te souviens|tu m['’]avais (dit|conseill)|on avait (parl|discut|dit)|on en etait|reprends|ressors|comme (la )?derni[eè]re fois|la derni[eè]re fois|celui dont|mon (trajet|budget) habituel|comme d['’]habitude|hier)/i;
export function recallContext(text, { excludeChatId = '', budget = 3500 } = {}) {
  if (!RECALL_CUES.test(norm(text)) && !RECALL_CUES.test(text)) return '';
  let out = '', left = budget;
  for (const r of searchHistory(text, { limit: 6, excludeChatId })) {
    const line = `[${new Date(r.createdAt).toLocaleDateString('fr-FR')} · ${r.title} · ${r.role === 'assistant' ? 'G.E.N.I.S' : 'Utilisateur'}] ${r.content.slice(0, 600)}\n`;
    if (line.length > left) break; out += line; left -= line.length;
  }
  return out;
}
export function memoryContext(text, { budget = 1800 } = {}) {
  const hits = [...new Map([...listMemories().filter(m => m.pinned), ...searchMemories(text, { limit: 6 })].map(m => [m.id, m])).values()];
  let left = budget; const out = [];
  for (const m of hits) { const line = `(${KINDS[m.kind]}) ${m.text}`.slice(0, 400); if (line.length > left) break; out.push(line); left -= line.length; }
  return out;
}

/* ---------- Habitudes : observées, proposées, jamais mémorisées sans accord (sauf mode « auto ») ---------- */
export const listSuggestions = () => store.get('suggestions', []);
export function observe(key, value, label) {
  const mode = getSettings().learnHabits; if (mode === 'off' || !value) return;
  const all = store.get('habits', {}), rec = all[key] || { counts: {}, done: [] };
  rec.counts[value] = (rec.counts[value] || 0) + 1; all[key] = rec; store.set('habits', all);
  if (rec.counts[value] < 3 || rec.done.includes(value)) return;
  rec.done.push(value); store.set('habits', all);
  const text = `${label} : ${value}`;
  if (mode === 'auto') { try { addMemory({ text, kind: 'habit', source: 'auto' }); } catch {} return; }
  store.set('suggestions', [{ id: uid('sug'), text, createdAt: Date.now() }, ...listSuggestions()].slice(0, 10)); bus.emit('memory');
}
export function resolveSuggestion(id, accept) {
  const s = listSuggestions().find(x => x.id === id);
  if (s && accept) addMemory({ text: s.text, kind: 'habit', source: 'auto' });
  store.set('suggestions', listSuggestions().filter(x => x.id !== id)); bus.emit('memory');
}
