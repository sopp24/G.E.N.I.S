/* G.E.N.I.S — migration unique depuis la v0.2 (localStorage en clair → IndexedDB + coffre). Les anciennes données restent en place (retour arrière possible),
   sauf le secret de la passerelle qui est déplacé dans le coffre chiffré puis supprimé du stockage en clair. Ce fichier peut être supprimé plus tard. */
import { store, patchSettings } from './storage.js';
import { vaultSet } from './vault.js';
import { addMemory } from './memory.js';
import { saveRule } from './automations.js';
import { setPerm } from './permissions.js';
const read = k => { try { const v = localStorage.getItem('genis:' + k); return v == null ? undefined : JSON.parse(v); } catch { return undefined; } };
export async function migrateLegacy() {
  if (store.get('meta:migrated', false)) return 0;
  let n = 0;
  const s = read('settings');
  if (s) {
    const pick = {}; for (const k of ['gatewayUrl', 'provider', 'voiceEnabled', 'speechRate', 'volume', 'voiceName', 'defaultCity']) if (s[k] !== undefined && s[k] !== '') pick[k] = s[k];
    if (s.model) pick.modelFast = s.model; patchSettings(pick);
    if (s.gatewaySecret) { await vaultSet('gatewaySecret', s.gatewaySecret); try { const { gatewaySecret, ...rest } = s; localStorage.setItem('genis:settings', JSON.stringify(rest)); } catch {} n++; }
  }
  const idx = store.get('chats:index', []);
  for (const c of read('chats') || []) {
    if (!c?.id || idx.some(i => i.id === c.id)) continue;
    const msgs = (c.messages || []).map(m => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt || c.updatedAt || Date.now(), meta: {} }));
    store.set('chat:' + c.id, { id: c.id, title: c.title || 'Conversation', createdAt: c.createdAt || c.updatedAt || Date.now(), updatedAt: c.updatedAt || Date.now(), messages: msgs });
    idx.push({ id: c.id, title: c.title || 'Conversation', createdAt: c.createdAt || 0, updatedAt: c.updatedAt || 0, count: msgs.length }); n++;
  }
  store.set('chats:index', idx.sort((a, b) => b.updatedAt - a.updatedAt));
  for (const m of read('memories') || []) { try { if (m?.text) { addMemory({ text: m.text, kind: 'fact' }); n++; } } catch {} }
  const toTool = a => (a.kind === 'say' ? { tool: 'genis_say', args: { text: String(a.value || '') } } : a.kind === 'open' ? { tool: 'system_open_service', args: { service: String(a.value || '') } } : a.kind === 'timer' ? { tool: 'system_timer_start', args: { minutes: parseFloat(a.value) || 1 } } : null);
  for (const a of read('automations') || []) { try { const actions = (a.actions || []).map(toTool).filter(Boolean); if (a.trigger && actions.length) { saveRule({ name: `Quand je dis « ${a.trigger} »`, enabled: a.enabled !== false, trigger: { type: 'phrase', phrases: [String(a.trigger)] }, actions }); n++; } } catch {} }
  const p = read('permissions') || {}, map = { location: 'location.read', notifications: 'notifications.send', files: 'files.read', microphone: 'microphone.use' };
  for (const [k, id] of Object.entries(map)) if (p[k] === true) setPerm(id, 'granted');
  store.set('meta:migrated', true); return n;
}
