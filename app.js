/* G.E.N.I.S — point d'entrée. Démarre les modules et câble : voix ⇄ orchestrateur ⇄ interface. Aucune règle métier ici. */
import { initStorage, getSettings } from './storage.js';
import { bus, toast, sleep } from './util.js';
import { loadConnectors } from './connectors.js';
import { ensureSpaces, activeSpace } from './spaces.js';
import { startScheduler } from './scheduler.js';
import { startAutomations, emitEvent } from './automations.js';
import { setHooks } from './executor.js';
import { confirmAction, askPermission, requestStrongAuth, voiceAnswer } from './modals.js';
import { runRequest, cancelRun, isRunning } from './brain.js';
import { Listener } from './voice.js';
import { tts } from './tts.js';
import { unlockAudio } from './audio.js';
import { setPerm } from './permissions.js';
import { notify } from './notifications.js';
import { extractFile } from './files.js';
import { refreshGoogle } from './connector-google.js';
import { trackChord } from './strong-auth.js';
import { migrateLegacy } from './legacy.js';
import * as gateway from './gateway.js';
import * as UI from './ui.js';

const listener = new Listener({
  onInterim: t => { if (t && t !== '…') UI.setCaption(t, 'user'); },
  onFinal: t => onVoice(t),
  onEvent: (kind, detail) => { if (kind === 'fatal') UI.setMic(false, detail); else if (kind === 'stop') UI.setMic(false); else if (kind === 'error' && detail) toast(String(detail), 'warn'); }
});
function onVoice(raw) {
  let text = raw.trim(); if (!text || voiceAnswer(text)) return; // pendant une confirmation, l'énoncé lui est réservé
  if (getSettings().wakeWord) {
    const m = text.match(/^(?:dis |hey |ok |salut )?(?:g[ée]nis|jenis|g\.e\.n\.i\.s)[\s,:]*(.*)$/i); if (!m) return;
    text = m[1].trim(); if (!text) return UI.setCaption('Je vous écoute.', 'genis');
  }
  submit(text, 'voice');
}
async function toggleMic(force) {
  const want = force ?? !listener.active;
  if (!want) { listener.stop(); UI.setMic(false); return; }
  try { await unlockAudio(); await listener.start(); setPerm('microphone.use', 'granted'); UI.setMic(true); UI.setCaption('Je vous écoute…', 'hint'); }
  catch (e) { UI.setMic(false); toast(e.message || 'Microphone indisponible.', 'error'); }
}
function interrupt() { tts.stop(); const sp = activeSpace(); if (sp) cancelRun(sp.id); UI.settle(); }
async function submit(text, source = 'text') {
  const sp = activeSpace(); if (!sp) return;
  if (isRunning(sp.id)) return toast('Une demande est déjà en cours dans cet espace : interrompez-la ou ouvrez un autre espace.', 'warn');
  const attachments = UI.getAttachments(); UI.clearAttachments(); tts.stop(); listener.pause();
  UI.setCaption(text, 'user'); UI.setBusy(true);
  let out = null;
  try { out = await runRequest(text, { spaceId: sp.id, source, attachments }); } catch (e) { UI.setCaption(e.message, 'genis'); }
  const here = activeSpace()?.id === sp.id; UI.setBusy(isRunning(activeSpace()?.id));
  if (!out) { UI.setVisual('error'); await sleep(1200); UI.settle(); return afterTurn(); }
  if (!here) { notify({ title: `${sp.title} : terminé`, body: out.text.slice(0, 120), kind: out.style === 'error' ? 'warn' : 'success', sound: true }); return afterTurn(); }
  UI.setCaption(out.text, 'genis'); out.cards.filter(c => c.type === 'player').forEach(UI.openPlayer);
  if (out.cards.length || out.text.length > 200 || out.trace.length > 1) UI.openThread(true);
  const s = getSettings(), speak = s.voiceEnabled && (s.speakReplies === 'always' || (s.speakReplies === 'voice' && source === 'voice'));
  if (out.style === 'error') { UI.setVisual('error'); await sleep(speak ? 600 : 1500); }
  if (speak) await tts.speak(out.speech || out.text, { style: out.style });
  UI.settle(); afterTurn();
}
function afterTurn() { if (!listener.active) return; if (getSettings().listenMode === 'single') toggleMic(false); else listener.resume(); }
async function attachFiles(files) {
  for (const f of files) { try { toast(`Lecture de « ${f.name} »…`, 'info'); UI.addAttachment(await extractFile(f)); } catch (e) { toast(e.message || 'Fichier illisible.', 'error'); } }
}
async function refreshGateway() {
  if (!gateway.isConfigured()) { UI.setGateway('off', 'IA non configurée'); tts.setGatewayAvailable(false); return; }
  try {
    const d = await gateway.health(), fresh = (d.api || 0) >= gateway.API_VERSION, any = Object.values(d.providers || {}).some(Boolean);
    UI.setGateway(fresh && d.appSecretAccepted !== false && any ? 'ok' : 'warn', d.appSecretAccepted === false ? 'Secret refusé' : !fresh ? 'Passerelle à mettre à jour' : any ? 'IA connectée' : 'Aucune clé IA');
    tts.setGatewayAvailable(fresh && !!(d.tts?.openai || d.tts?.elevenlabs)); refreshGoogle();
  } catch { UI.setGateway('error', 'Passerelle injoignable'); tts.setGatewayAvailable(false); }
}
async function testVoice() { await unlockAudio(); await tts.speak('Bonjour, je suis Génis. Voici ma voix.', { style: 'chat' }); UI.settle(); }

function wireEvents() {
  const speakNow = (text, style) => { const s = getSettings(); if (s.voiceEnabled && s.speakReplies !== 'never' && !document.hidden) { listener.pause(); tts.speak(text, { style }).then(() => { UI.settle(); afterTurn(); }); } };
  bus.on('say', ({ text }) => { UI.setCaption(text, 'genis'); speakNow(text, 'info'); });
  bus.on('timer:fired', t => { if (!t.late) { UI.setCaption(t.label || 'Minuteur terminé', 'genis'); speakNow(t.kind === 'alarm' ? `C'est l'heure. ${t.label || ''}` : t.label ? `Rappel : ${t.label}` : 'Votre minuteur est terminé.', 'urgent'); } });
  bus.on('automation:ran', ({ rule, results }) => { const t = results.map(r => r.summary).filter(Boolean).join(' '); UI.setCaption(`${rule.name} : ${t}`, 'genis'); });
  bus.on('ui:open', ({ panel }) => UI.openPanel(panel));
  bus.on('confirm:ask', v => { const s = getSettings(); if (s.voiceEnabled && listener.active && s.speakReplies !== 'never') { listener.pause(); tts.speak(`${v.summary}. Souhaitez-vous continuer ?`, { style: 'confirm' }).then(() => { if (getSettings().voiceConfirm && v.level < 4) listener.resume(); }); } });
  bus.on('spaces', () => UI.setBusy(isRunning(activeSpace()?.id)));
  bus.on('accounts', () => UI.updateBadges());
  addEventListener('message', e => { try { if (e.data?.type === 'genis:oauth' && e.origin === new URL(getSettings().gatewayUrl).origin) refreshGoogle(); } catch {} });
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); globalThis.__installPrompt = e; });
  addEventListener('unhandledrejection', e => console.error('[G.E.N.I.S]', e.reason));
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => unlockAudio(), { once: true, capture: true });
}
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then(reg => reg.addEventListener('updatefound', () => { const w = reg.installing; w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Une mise à jour de G.E.N.I.S est prête : rechargez la page.', 'info'); }); })).catch(() => {});
}
function handleLaunchParams() {
  const p = new URLSearchParams(location.search), text = [p.get('title'), p.get('text'), p.get('url')].filter(Boolean).join(' ') || p.get('q');
  if (text) UI.prefill(text); if (['history', 'apps', 'memory', 'automations', 'notifications', 'settings'].includes(p.get('panel'))) UI.openPanel(p.get('panel'));
  for (const k of ['title', 'text', 'url', 'q', 'panel', 'source']) p.delete(k); history.replaceState(null, '', location.pathname + (p.toString() ? `?${p}` : ''));
}
async function main() {
  await initStorage(); trackChord(); await loadConnectors(); await migrateLegacy().catch(e => console.error('[G.E.N.I.S] migration', e));
  ensureSpaces();
  UI.initUI({ submit, toggleMic, interrupt, stop: interrupt, attachFiles, refreshGateway, testVoice });
  UI.setSources({ mic: out => listener.fillSpectrum(out), speech: out => tts.fillSpectrum(out) });
  setHooks({ confirm: async v => { const r = await confirmAction(v); UI.settle(); return r; }, permission: askPermission, strong: async v => { const r = await requestStrongAuth(v); UI.settle(); return r; } });
  wireEvents(); startScheduler(); startAutomations(); emitEvent('app_open'); refreshGateway(); registerSW(); handleLaunchParams();
  if (!getSettings().defaultCity && !getSettings().gatewayUrl) UI.setCaption('Dites ou écrivez ce que vous voulez faire.', 'hint');
}
main().catch(e => { console.error('[G.E.N.I.S] démarrage', e); document.getElementById('boot-error')?.removeAttribute('hidden'); });
