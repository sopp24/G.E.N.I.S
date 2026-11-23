/* G.E.N.I.S — interface principale : état visuel, onde, légende, rail d'actions, fil de conversation, espaces (onglets + vue d'ensemble), dock, tiroir, lecteur, alertes.
   La logique métier est ailleurs : ce module ne fait qu'afficher et relayer les gestes de l'utilisateur. */
import { bus, h, icon, fmt, safeUrl, uid } from './util.js';
import { Waveform } from './waveform.js';
import { renderCard } from './cards.js';
import { activeSpace, listSpaces, openSpace, activateSpace, closeSpace, pinSpace, SPACE_KINDS } from './spaces.js';
import { getChat } from './memory.js';
import { unreadCount, listPending } from './notifications.js';
import { getSettings } from './storage.js';
import { renderPanel, PANEL_TITLES, PANEL_EVENTS } from './panels.js';
const $ = id => document.getElementById(id);
const LABELS = { idle: 'En veille', listening: 'À l’écoute', understanding: 'Je comprends', thinking: 'Je réfléchis', speaking: 'Je réponds', error: 'Une erreur est survenue', confirm: 'Confirmation requise' };
const STEP_ICON = { running: 'clock', waiting: 'clock', done: 'check', unverified: 'alert', manual: 'external', failed: 'x', cancelled: 'x', blocked: 'lock', pending: 'clock' };
const DOCK = [['home', 'Accueil', 'home'], ['thread', 'Conversation', 'chat'], ['apps', 'Applications', 'dots'], ['memory', 'Mémoire', 'layers'], ['automations', 'Automatisations', 'bolt'], ['notifications', 'Notifications', 'bell'], ['settings', 'Réglages', 'sliders']];
const HINTS = ['Prépare ma journée de demain', 'Quelle est la météo demain ?', 'Mets du R&B', 'Minuteur de 10 minutes', 'Organise-moi un week-end à Lyon'];
export const S = { state: 'idle', mic: false, thread: false, panel: '', overview: false, busy: false, attachments: [], sources: {} };
let wave, cb = {}, railSteps = new Map(), railPlan = [], railTimer = 0, raf = 0, panelTimer = 0;

export function initUI(callbacks) {
  cb = callbacks; wave = new Waveform($('wave'));
  wave.setSource(out => (S.state === 'speaking' ? S.sources.speech : S.sources.mic)?.(out)); wave.start();
  buildDock(); wireComposer(); wireTopbar(); wireKeys(); wireBus(); applyAppearance(); renderTabs(); renderThread(); setVisual(baseState()); updateBadges(); clock(); setInterval(clock, 30000);
}
export const setSources = s => Object.assign(S.sources, s);
export const baseState = () => (S.mic ? 'listening' : 'idle');
export function setVisual(state) {
  if (state) S.state = state; const app = $('app'); app.dataset.state = S.state; $('stateLabel').textContent = LABELS[S.state] || ''; wave.setState(S.state);
  $('wave').setAttribute('aria-label', `G.E.N.I.S : ${LABELS[S.state].toLowerCase()}${S.mic ? ', micro actif' : ', micro coupé'}`);
}
export function setMic(on, note = '') {
  S.mic = !!on; const app = $('app'); app.dataset.mic = on ? 'on' : 'off'; wave.setMic(on);
  const b = $('micBtn'); b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Couper le microphone' : 'Activer le microphone'); b.replaceChildren(icon(on ? 'mic' : 'mic-off'));
  $('micChip').replaceChildren(h('i', { class: 'dot' }), on ? 'Micro actif' : 'Micro coupé'); $('micChip').dataset.on = on;
  if (note) toast(note, 'warn'); if (['idle', 'listening'].includes(S.state)) setVisual(baseState());
}
export const settle = () => setVisual(S.busy ? 'thinking' : baseState());
export function setBusy(on) { S.busy = on; const s = $('sendBtn'); s.dataset.mode = on ? 'stop' : 'send'; s.setAttribute('aria-label', on ? 'Interrompre' : 'Envoyer'); s.replaceChildren(icon(on ? 'stop' : 'send')); updateSend(); }
export function setCaption(text, kind = 'genis') { const c = $('caption'); c.dataset.kind = kind; c.textContent = String(text || '').length > 260 ? String(text).slice(0, 257) + '…' : text || ''; }
export function setGateway(state, text) { const c = $('gwChip'); c.dataset.state = state; c.replaceChildren(h('i', { class: 'dot' }), text); }
export const toast = (message, kind = 'info') => bus.emit('toast', { message, kind });
const clock = () => { const d = new Date(); $('clock').textContent = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '  ' + d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }); };

/* ---------- Rail d'actions (ce que G.E.N.I.S fait en ce moment) ---------- */
function renderRail() {
  const r = $('rail'); r.replaceChildren(); r.dataset.show = railSteps.size || railPlan.length ? '1' : '0';
  const done = [...railSteps.values()].filter(s => ['done', 'unverified', 'manual'].includes(s.status)).length;
  railPlan.forEach((p, i) => r.append(h('li', { class: 'plan', dataset: { s: i < done ? 'done' : 'pending' } }, icon(i < done ? 'check' : 'clock'), p)));
  if (!railPlan.length) for (const s of railSteps.values()) r.append(h('li', { dataset: { s: s.status } }, icon(STEP_ICON[s.status] || 'clock'), s.label, s.detail ? h('em', {}, s.detail) : null));
}
function fadeRail() { clearTimeout(railTimer); railTimer = setTimeout(() => { railSteps.clear(); railPlan = []; renderRail(); }, 6000); }

/* ---------- Fil de conversation ---------- */
const para = t => String(t).split(/\n{2,}/).map(p => h('p', {}, p));
function msgEl(m) {
  if (m.role === 'user') return h('div', { class: 'msg user' }, h('p', {}, m.content), m.meta?.files?.length ? h('p', { class: 'files' }, icon('clip'), m.meta.files.join(', ')) : null);
  const meta = m.meta || {};
  return h('div', { class: 'msg genis', dataset: { style: meta.style || 'info' } }, para(m.content),
    meta.trace?.length ? h('details', { class: 'trace' }, h('summary', {}, `${meta.trace.length} action${meta.trace.length > 1 ? 's' : ''}`), h('ul', {}, meta.trace.map(t => h('li', { dataset: { s: t.status } }, icon(STEP_ICON[t.status] || 'clock'), h('span', {}, t.label), t.summary ? h('em', {}, t.summary) : null)))) : null,
    (meta.cards || []).map(c => renderCard(c, { openPlayer })), h('time', {}, fmt.time(m.createdAt)));
}
export function renderThread() {
  const sp = activeSpace(), chat = sp && getChat(sp.chatId), log = $('log'); if (!chat) return;
  const near = log.scrollHeight - log.scrollTop - log.clientHeight < 140; log.replaceChildren();
  $('threadTitle').textContent = sp.title;
  if (!chat.messages.length) log.append(h('p', { class: 'empty' }, 'Dites ou écrivez ce que vous voulez faire. Je m’en occupe.'));
  chat.messages.slice(-120).forEach(m => log.append(msgEl(m)));
  if (sp.status === 'running') log.append(h('div', { class: 'msg genis running' }, h('span', { class: 'dots' }, h('i'), h('i'), h('i'))));
  if (near || sp.status === 'running') log.scrollTop = log.scrollHeight;
  const chips = $('chips'); chips.replaceChildren(); chips.hidden = chat.messages.length > 0 || S.busy;
  if (!chips.hidden) HINTS.forEach(t => chips.append(h('button', { type: 'button', class: 'chip', onclick: () => cb.submit(t, 'text') }, t)));
}
const scheduleThread = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { renderThread(); renderTabs(); if (S.overview) renderOverview(); }); };
export function openThread(on = !S.thread) { S.thread = on; $('app').dataset.thread = on ? 'open' : 'closed'; if (on) { $('log').scrollTop = $('log').scrollHeight; } syncDock(); }

/* ---------- Espaces : onglets et vue d'ensemble ---------- */
export function renderTabs() {
  const nav = $('spaceTabs'), act = activeSpace(); nav.replaceChildren();
  listSpaces().forEach(sp => nav.append(h('button', { type: 'button', class: 'tab', 'aria-current': act?.id === sp.id, dataset: { s: sp.status }, title: sp.title, onclick: () => { activateSpace(sp.id); }, onauxclick: e => { if (e.button === 1) closeSpace(sp.id); } }, icon(SPACE_KINDS[sp.kind]?.[1] || 'chat'), h('span', {}, sp.title), h('i', { class: 'st' }))));
  nav.append(h('button', { type: 'button', class: 'tab add', 'aria-label': 'Nouvel espace', title: 'Nouvel espace', onclick: () => { try { openSpace({}); openThread(true); } catch (e) { toast(e.message, 'warn'); } } }, icon('plus')));
}
export function renderOverview() {
  const o = $('overview'), grid = $('overviewGrid'); grid.replaceChildren();
  for (const sp of listSpaces()) {
    const last = getChat(sp.chatId)?.messages.at(-1);
    grid.append(h('article', { class: 'space-card', dataset: { s: sp.status }, 'aria-current': activeSpace()?.id === sp.id },
      h('header', {}, h('span', { class: 'ic' }, icon(SPACE_KINDS[sp.kind]?.[1] || 'chat')), h('b', {}, sp.title), h('i', { class: 'st' })),
      h('p', {}, last ? String(last.content).slice(0, 110) : 'Espace vide'),
      h('footer', {}, h('button', { type: 'button', class: 'btn', onclick: () => { activateSpace(sp.id); toggleOverview(false); openThread(true); } }, 'Ouvrir'), h('button', { type: 'button', class: 'btn ghost', 'aria-label': sp.pinned ? 'Désépingler' : 'Épingler', onclick: () => pinSpace(sp.id) }, icon('pin')), sp.kind !== 'home' ? h('button', { type: 'button', class: 'btn ghost', 'aria-label': 'Fermer l’espace', onclick: () => closeSpace(sp.id) }, icon('x')) : null)));
  }
  grid.append(h('button', { type: 'button', class: 'space-card new', onclick: () => { try { openSpace({}); toggleOverview(false); openThread(true); } catch (e) { toast(e.message, 'warn'); } } }, icon('plus'), 'Nouvel espace'));
  o.hidden = false;
}
export function toggleOverview(on = !S.overview) { S.overview = on; if (on) renderOverview(); else $('overview').hidden = true; }

/* ---------- Dock ---------- */
function buildDock() {
  const d = $('dock'); d.replaceChildren(...DOCK.map(([id, label, ic]) => h('button', { type: 'button', class: 'dock-item', dataset: { id, label }, 'aria-label': label, onclick: () => dockAction(id) }, icon(ic), h('span', { class: 'badge', hidden: true }))));
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches; if (!fine) return;
  d.addEventListener('pointermove', e => { for (const b of d.children) { const r = b.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2); b.style.setProperty('--s', (1 + 0.42 * Math.exp(-((dx / 78) ** 2))).toFixed(3)); } });
  d.addEventListener('pointerleave', () => { for (const b of d.children) b.style.removeProperty('--s'); });
}
function dockAction(id) {
  if (id === 'home') { closePanel(); openThread(false); toggleOverview(false); return; }
  if (id === 'thread') { closePanel(); openThread(!S.thread); return; }
  S.panel === id ? closePanel() : openPanel(id);
}
function syncDock() { for (const b of $('dock').children) b.setAttribute('aria-current', String(b.dataset.id === S.panel || (b.dataset.id === 'thread' && S.thread && !S.panel) || (b.dataset.id === 'home' && !S.panel && !S.thread))); }
export function updateBadges() {
  const n = unreadCount() + listPending().length, b = $('dock').querySelector('[data-id="notifications"] .badge'); if (!b) return;
  b.hidden = !n; b.textContent = n > 9 ? '9+' : n;
}

/* ---------- Tiroir de panneaux ---------- */
export const api = { closePanel: () => closePanel(), openPanel: n => openPanel(n), openThread, submit: (t, s) => cb.submit(t, s), toggleMic: () => cb.toggleMic(), refreshGateway: () => cb.refreshGateway?.(), testVoice: () => cb.testVoice?.(), pickFiles: () => $('fileInput').click() };
export function openPanel(name) {
  S.panel = name; $('app').dataset.panel = name; $('drawer').hidden = false; $('drawerTitle').textContent = PANEL_TITLES[name] || ''; refreshPanel(true); syncDock(); setTimeout(() => $('drawerClose').focus(), 40);
}
export function closePanel() { S.panel = ''; $('app').dataset.panel = ''; $('drawer').hidden = true; syncDock(); }
function refreshPanel(force) {
  if (!S.panel) return; const body = $('drawerBody'), top = body.scrollTop;
  renderPanel(S.panel, body, api); if (!force) body.scrollTop = top;
}
const scheduleRefresh = () => { clearTimeout(panelTimer); panelTimer = setTimeout(() => refreshPanel(false), 90); };

/* ---------- Lecteur multimédia (liste blanche : widget officiel Deezer uniquement) ---------- */
export function openPlayer(c) {
  const u = safeUrl(c.embedUrl); if (!u || !/^https:\/\/widget\.deezer\.com\//.test(u)) return;
  const m = $('media'); m.hidden = false; $('mediaTitle').textContent = c.title; $('mediaFrame').src = u;
}
export function closePlayer() { $('mediaFrame').removeAttribute('src'); $('media').hidden = true; }

/* ---------- Composer ---------- */
const updateSend = () => { $('sendBtn').disabled = !S.busy && !$('prompt').value.trim() && !S.attachments.length; };
export function addAttachment(a) { S.attachments.push(a); renderAttachments(); }
export const getAttachments = () => S.attachments.slice();
export function clearAttachments() { S.attachments = []; renderAttachments(); }
function renderAttachments() {
  const el = $('attachments'); el.replaceChildren(...S.attachments.map((a, i) => h('span', { class: 'att' }, icon('clip'), a.name, h('button', { type: 'button', 'aria-label': `Retirer ${a.name}`, onclick: () => { S.attachments.splice(i, 1); renderAttachments(); } }, icon('x'))))); el.hidden = !S.attachments.length; updateSend();
}
export const prefill = t => { const p = $('prompt'); p.value = t; p.dispatchEvent(new Event('input')); p.focus(); };
function wireComposer() {
  const p = $('prompt'), form = $('composer');
  p.addEventListener('input', () => { p.style.height = 'auto'; p.style.height = Math.min(p.scrollHeight, 130) + 'px'; updateSend(); });
  p.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', e => { e.preventDefault(); if (S.busy) return cb.stop(); const t = p.value.trim(); if (!t && !S.attachments.length) return; p.value = ''; p.style.height = 'auto'; updateSend(); cb.submit(t, 'text'); });
  $('attachBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', async e => { const files = [...e.target.files]; e.target.value = ''; if (files.length) cb.attachFiles(files); });
  $('micBtn').addEventListener('click', () => cb.toggleMic());
  $('wave').addEventListener('click', () => cb.interrupt?.());
  updateSend();
}
function wireTopbar() {
  $('micChip').addEventListener('click', () => cb.toggleMic()); $('gwChip').addEventListener('click', () => openPanel('settings'));
  $('overviewBtn').addEventListener('click', () => toggleOverview()); $('overviewClose').addEventListener('click', () => toggleOverview(false));
  $('threadClose').addEventListener('click', () => openThread(false)); $('historyBtn').addEventListener('click', () => openPanel('history'));
  $('newSpaceBtn').addEventListener('click', () => { try { openSpace({}); } catch (e) { toast(e.message, 'warn'); } });
  $('drawerClose').addEventListener('click', closePanel); $('mediaClose').addEventListener('click', closePlayer);
  $('mediaToggle').addEventListener('click', () => $('media').classList.toggle('min'));
}
function wireKeys() {
  addEventListener('keydown', e => {
    const typing = /^(input|textarea|select)$/i.test(document.activeElement?.tagName || '');
    if (e.key === 'Escape' && !document.querySelector('.modal-back')) { if (S.overview) toggleOverview(false); else if (S.panel) closePanel(); else if (S.busy || S.state === 'speaking') cb.interrupt?.(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); toggleOverview(); }
    else if (e.altKey && e.code === 'KeyM') { e.preventDefault(); cb.toggleMic(); }
    else if (e.altKey && /^Digit[1-8]$/.test(e.code)) { const sp = listSpaces()[+e.code.slice(5) - 1]; if (sp) { e.preventDefault(); activateSpace(sp.id); } }
    else if (e.key === '/' && !typing && !document.querySelector('.modal-back')) { e.preventDefault(); $('prompt').focus(); }
  });
}
function wireBus() {
  bus.on('visual', e => { if (e.spaceId && e.spaceId !== activeSpace()?.id) return; if (['confirm', 'error', 'speaking', 'thinking', 'understanding', 'listening', 'idle'].includes(e.state)) setVisual(e.state); });
  bus.on('step', s => { if (s.spaceId && s.spaceId !== activeSpace()?.id) return; railSteps.set(s.id, { ...railSteps.get(s.id), ...s, label: s.label || railSteps.get(s.id)?.label, detail: s.detail || railSteps.get(s.id)?.detail }); renderRail(); fadeRail(); });
  bus.on('plan', p => { if (p.spaceId !== activeSpace()?.id) return; railPlan = p.steps; renderRail(); });
  bus.on('chats', scheduleThread); bus.on('spaces', () => { scheduleThread(); syncDock(); });
  bus.on('toast', ({ message, kind }) => { const t = h('div', { class: 'toast', dataset: { kind } }, message); $('toasts').append(t); setTimeout(() => t.classList.add('out'), kind === 'error' ? 8000 : 4500); setTimeout(() => t.remove(), kind === 'error' ? 8400 : 4900); });
  bus.on('notify', e => { updateBadges(); if (e?.title) bus.emit('toast', { message: e.body ? `${e.title} — ${e.body}` : e.title, kind: e.kind === 'warn' ? 'warn' : 'info' }); });
  bus.on('settings', applyAppearance);
  for (const ev of new Set(Object.values(PANEL_EVENTS).flat())) bus.on(ev, e => { if (S.panel && (PANEL_EVENTS[S.panel] || []).includes(ev)) scheduleRefresh(); });
}
export function applyAppearance(s = getSettings()) {
  const root = document.documentElement; root.dataset.accent = s.accent; root.dataset.motion = s.motion; root.style.setProperty('--fs', s.fontScale);
  wave?.setIntensity(s.waveIntensity); wave?.setReduced(s.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches);
}
