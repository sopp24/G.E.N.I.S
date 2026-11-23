// Test de fumée : démarre l'application complète dans un DOM simulé (jsdom) et exerce l'interface réelle. `npm run smoke` (nécessite jsdom et fake-indexeddb).
import 'fake-indexeddb/auto';
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync('index.html', 'utf8').replace(/<script type="module"[^>]*><\/script>/, '');
const dom = new JSDOM(html, { url: 'https://sopp24.github.io/G.E.N.I.S/?from=sopp-agents', pretendToBeVisual: true, runScripts: 'outside-only' }), w = dom.window;
const noop = () => {}, ctx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : t[k] ?? noop), set: () => true });
w.HTMLCanvasElement.prototype.getContext = () => ctx;
w.matchMedia = () => ({ matches: false, addEventListener: noop, removeEventListener: noop });
for (const [k, v] of Object.entries({ window: w, document: w.document, location: w.location, history: w.history, localStorage: w.localStorage, matchMedia: w.matchMedia, addEventListener: w.addEventListener.bind(w), removeEventListener: w.removeEventListener.bind(w), requestAnimationFrame: cb => setTimeout(() => cb(performance.now()), 16), cancelAnimationFrame: clearTimeout, ResizeObserver: class { observe() {} disconnect() {} }, Path2D: class { moveTo() {} quadraticCurveTo() {} closePath() {} }, KeyboardEvent: w.KeyboardEvent, Event: w.Event }))
  Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true });
class MockSR { static all = []; constructor() { MockSR.all.push(this); this.started = false; } start() { this.started = true; if (globalThis.__srMode === 'deny') setTimeout(() => this.onerror?.({ error: 'not-allowed' }), 10); } abort() { this.started = false; } stop() { this.started = false; } say(t) { this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true })] }); } }
const spoken = []; class MockUtterance { constructor(t) { this.text = t; } }
Object.defineProperty(globalThis, 'SpeechRecognition', { value: MockSR, configurable: true }); Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', { value: MockUtterance, configurable: true });
Object.defineProperty(globalThis, 'speechSynthesis', { value: { getVoices: () => [], cancel() {}, speak(u) { if (u.text) spoken.push(u.text); setTimeout(() => { u.onstart?.(); u.onboundary?.(); setTimeout(() => u.onend?.(), 5); }, 5); } }, configurable: true });
const errors = []; const origErr = console.error; console.error = (...a) => { errors.push(a.map(String).join(' ')); };
const $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)], wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, label, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = fn(); if (v) return v; } catch {} await wait(25); } assert.fail('délai dépassé : ' + label); };
await import('./app.js');
await until(() => $$('#dock .dock-item').length === 7 && $$('#spaceTabs .tab').length >= 2, 'démarrage de l’interface');
assert.equal($('.brand').textContent, 'G.E.N.I.S'); assert.equal(w.document.title, 'G.E.N.I.S'); assert.ok($('.sopp-home-float'), 'le raccourci SOPP Agents est conservé');
assert.equal($('#micChip').textContent, 'Micro coupé'); assert.match($('#stateLabel').textContent, /En veille/); assert.equal($('#app').dataset.mic, 'off');
// 1. une commande locale de bout en bout : saisie → orchestrateur → exécuteur → minuteur réel → légende, fil et rail d'actions
$('#prompt').value = 'Mets un minuteur de 10 minutes'; $('#prompt').dispatchEvent(new w.Event('input')); $('#composer').requestSubmit();
await until(() => /Minuteur de 10 min/.test($('#caption').textContent), 'réponse au minuteur');
await until(() => $$('#log .msg.genis').length >= 1 && $$('#log .msg.user').length >= 1, 'fil de conversation');
const { activeTimers } = await import('./scheduler.js'); assert.equal(activeTimers().length, 1, 'le minuteur existe réellement');
// 2. tous les panneaux du dock s'ouvrent sans erreur
for (const id of ['apps', 'memory', 'automations', 'notifications', 'settings']) { $(`.dock-item[data-id="${id}"]`).click(); await until(() => !$('#drawer').hidden && $('#drawerBody').children.length, `panneau ${id}`); assert.equal($('#drawerTitle').textContent.length > 0, true); }
assert.ok($$('#drawerBody details.acc').length >= 9, 'réglages complets'); assert.ok($$('#drawerBody .switch').length >= 5);
$('.dock-item[data-id="apps"]').click(); await until(() => $$('#drawerBody .tile').length >= 20, 'catalogue des connecteurs'); $$('#drawerBody .tile').find(t => /Google/.test(t.textContent)).click(); await until(() => /OAuth 2\.0/.test($('#drawerBody').textContent), 'détail d’un connecteur');
$('#historyBtn').click(); await until(() => $('#drawerTitle').textContent === 'Historique', 'historique'); $('#drawerClose').click(); assert.equal($('#drawer').hidden, true);
// 3. espaces : nouvel espace, vue d'ensemble
$('#newSpaceBtn').click(); await until(() => $$('#spaceTabs .tab').length >= 3, 'nouvel espace'); $('#overviewBtn').click(); await until(() => $$('#overviewGrid .space-card').length >= 3, 'vue d’ensemble'); $('#overviewClose').click();
// 4. confirmation modale : « oublie… » est une action de niveau 3 → il faut l'accord de l'utilisateur
const { addMemory, listMemories } = await import('./memory.js'); addMemory({ text: 'souvenir fumée à oublier' });
$('#prompt').value = 'Oublie souvenir fumée'; $('#composer').requestSubmit();
await until(() => $('.modal-back .modal h2'), 'fenêtre de confirmation'); assert.match($('.modal').textContent, /Supprimer 1 souvenir/); assert.equal(listMemories().length, 1, 'rien n’est supprimé avant l’accord');
$$('.modal .btn').find(b => b.textContent === 'Autoriser').click(); await until(() => !$('.modal-back') && listMemories().length === 0, 'exécution après accord');
// 5. authentification forte : sans configuration, la configuration s'ouvre d'abord ; annuler bloque l'action
const { requestStrongAuth } = await import('./modals.js'); const pending = requestStrongAuth({ title: 'Test', connector: 'x', summary: 's', actionId: 'a', level: 4 });
await until(() => /Authentification forte/.test($('.modal h2')?.textContent || ''), 'configuration de l’authentification forte'); $$('.modal .btn').find(b => b.textContent === 'Annuler').click(); assert.deepEqual(await pending, { ok: false });
// 6. micro refusé par le navigateur : G.E.N.I.S le dit et ne fait jamais semblant d'écouter
globalThis.__srMode = 'deny'; $('#micBtn').click(); await until(() => $$('#toasts .toast').some(t => /refusé l’accès au microphone/i.test(t.textContent)), 'message honnête sur le micro');
await until(() => $('#micChip').textContent === 'Micro coupé' && $('#micBtn').getAttribute('aria-pressed') === 'false', 'micro coupé après refus');
// 7. parcours vocal complet : micro actif → écoute → compréhension → exécution → réponse parlée → retour à l'écoute
globalThis.__srMode = 'ok'; $('#micBtn').click(); await until(() => $('#micChip').textContent === 'Micro actif' && $('#app').dataset.mic === 'on', 'micro actif'); assert.match($('#stateLabel').textContent, /À l’écoute/);
const rec = MockSR.all.at(-1); assert.equal(rec.started, true, 'la reconnaissance tourne'); rec.say('Quelle heure est-il ?');
await until(() => /Il est \d\d:\d\d/.test($('#caption').textContent), 'réponse à la voix'); await until(() => spoken.some(t => /Il est/.test(t)), 'réponse parlée'); assert.equal(spoken.some(t => /Génis|G\.E\.N\.I\.S/.test(t)), false);
await until(() => /À l’écoute/.test($('#stateLabel').textContent) && MockSR.all.at(-1).started, 'retour à l’écoute après la réponse');
$('#micBtn').click(); await until(() => $('#micChip').textContent === 'Micro coupé' && !MockSR.all.at(-1).started, 'micro réellement coupé'); assert.match($('#stateLabel').textContent, /En veille/);
// 8. authentification forte complète (phrase + deux pastilles tactiles maintenues) : aucun jeton sans la bonne phrase
const SA = await import('./strong-auth.js'); await SA.configure({ passphrase: 'ma phrase pour le test de fumée', iter: 1000 });
const tryAuth = async phrase => { const p = requestStrongAuth({ title: 'Paiement test', connector: 'Banque', summary: 'Payer 10 €', actionId: 'pay1', level: 4 }); await until(() => $('.modal.strong, .modal .strong') || /Paiement test/.test($('.modal h2')?.textContent || ''), 'fenêtre d’authentification forte'); $('.modal input[type=password]').value = phrase; SA.padDown('A'); SA.padDown('B'); const r = await Promise.race([p, wait(1900).then(() => 'timeout')]); SA.padUp('A'); SA.padUp('B'); if (r === 'timeout') $$('.modal .btn').find(b => b.textContent === 'Annuler').click(); return r === 'timeout' ? await p : r; };
assert.equal((await tryAuth('une mauvaise phrase tout à fait fausse')).ok, false, 'mauvaise phrase : refusée');
const ok = await tryAuth('Ma phrase, pour le test de FUMÉE !'); assert.equal(ok.ok, true, 'bonne phrase + deux pastilles maintenues : acceptée'); assert.equal(SA.consumeToken(ok.token, 'pay1'), true); assert.equal(SA.consumeToken(ok.token, 'pay1'), false);
// 9. sans IA configurée, une demande ouverte reçoit une réponse honnête
$('#prompt').value = 'Raconte-moi une histoire de pirates'; $('#composer').requestSubmit(); await until(() => /Connectez une IA/.test($('#caption').textContent), 'réponse sans IA');
const fatal = errors.filter(e => !/Not implemented|navigation|Could not parse CSS/i.test(e)); console.error = origErr;
assert.deepEqual(fatal, [], 'erreurs inattendues : ' + fatal.join(' | '));
console.log('smoke OK : application démarrée, interface exercée de bout en bout'); process.exit(0);
