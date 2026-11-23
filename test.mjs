// Tests de G.E.N.I.S : `node --test test.mjs` (aucune dépendance). Ils vérifient la logique métier, la sécurité et la passerelle avec des simulations réseau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const real = globalThis.fetch;
const iso = d => d && new Date(d).toISOString().slice(0, 10);

test('dates, heures et durées en français', async () => {
  const D = await import('./datetime-fr.js'), now = new Date(2026, 10, 16, 10, 0), day = d => d && D.isoDay(d);
  assert.equal(D.parseDuration('mets un minuteur de 10 minutes'), 10); assert.equal(D.parseDuration('dans 1h30'), 90); assert.equal(D.parseDuration('2 heures et demie'), 150); assert.equal(D.parseDuration('bonjour'), null);
  assert.deepEqual(D.parseTimeOfDay('réveille-moi à 7h30'), { h: 7, m: 30 }); assert.deepEqual(D.parseTimeOfDay('à 8h ce soir'), { h: 20, m: 0 }); assert.equal(D.parseTimeOfDay('dans 2 heures'), null);
  assert.equal(day(D.parseDate('demain', now)), '2026-11-17'); assert.equal(day(D.parseDate('vendredi prochain', now)), '2026-11-20'); assert.equal(day(D.parseDate('le 12 décembre', now)), '2026-12-12'); assert.equal(D.parseDate('31 février', now), null);
  const r = D.parseRange('du 12 au 15 décembre', now); assert.equal(day(r.from), '2026-12-12'); assert.equal(day(r.to), '2026-12-15');
  const r2 = D.parseRange('je pars vendredi prochain pour quatre jours', now); assert.equal(day(r2.from), '2026-11-20'); assert.equal(day(r2.to), '2026-11-23');
  assert.equal(day(D.dayRange('hier', now).from), '2026-11-15'); assert.equal(day(D.dayRange('jeudi dernier', now).from), '2026-11-12');
});

test('authentification forte : phrase, verrouillage, jetons à usage unique', async () => {
  const S = await import('./strong-auth.js');
  assert.ok(S.weakness('court')); assert.equal(S.weakness('mon chat mange du poisson'), '');
  const { recoveryCode } = await S.configure({ passphrase: 'mon chat mange du poisson', iter: 1000 });
  assert.match(recoveryCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal((await S.verify('Mon chat, mange du POISSON !')).ok, true, 'la dictée (casse, ponctuation) est tolérée');
  assert.equal((await S.verify('une autre phrase secrète ici')).ok, false);
  const t = S.issueToken('a1'); assert.equal(S.consumeToken(t, 'a2'), false); const t2 = S.issueToken('a1'); assert.equal(S.consumeToken(t2, 'a1'), true); assert.equal(S.consumeToken(t2, 'a1'), false, 'jeton à usage unique');
  for (let i = 0; i < 3; i++) await S.verify('encore faux ici');
  assert.equal((await S.verify('mon chat mange du poisson')).reason, 'locked', 'verrouillage après 3 échecs');
  const raw = JSON.stringify((await import('./storage.js')).store.get('secure')); assert.equal(raw.includes('poisson'), false, 'la phrase n’est jamais stockée');
  await S.recover(recoveryCode, 'une nouvelle phrase bien longue').catch(e => assert.fail(e.message));
});

test('mémoire : recherche pondérée, rappel, quotas, habitudes', async () => {
  const M = await import('./memory.js'), { patchSettings } = await import('./storage.js');
  M.addMemory({ text: 'Je préfère les pulls noirs en coton', kind: 'preference' }); M.addMemory({ text: 'Budget habituel voyage : 1500 euros', kind: 'habit' });
  assert.match(M.searchMemories('pulls coton')[0].text, /pulls noirs/); assert.match(M.searchMemories('quel budget pour le voyage')[0].text, /Budget/);
  assert.throws(() => M.addMemory({ text: '  ' })); assert.equal(M.addMemory({ text: 'je préfère les PULLS noirs en coton' }).id, M.listMemories().find(m => /pulls/.test(m.text)).id, 'pas de doublon');
  const c = M.createChat(); M.appendMessage(c, { role: 'user', content: 'Cherche-moi un hôtel à Londres pour vendredi' }); M.appendMessage(c, { role: 'assistant', content: 'Voici des hôtels proches du centre de Londres.' });
  assert.match(M.recallContext("tu te rappelles de l'hôtel à Londres ?"), /Londres/); assert.equal(M.recallContext('quelle heure est-il'), '');
  patchSettings({ learnHabits: 'ask' }); for (let i = 0; i < 3; i++) M.observe('music_service', 'Deezer', 'Service de musique préféré');
  assert.equal(M.listSuggestions().length, 1, 'une habitude vue 3 fois est proposée, jamais retenue sans accord'); assert.equal(M.listMemories().some(m => /Deezer/.test(m.text)), false);
  M.resolveSuggestion(M.listSuggestions()[0].id, true); assert.equal(M.listMemories().some(m => /Deezer/.test(m.text)), true);
});

test('registre des connecteurs : cohérence des manifestes', async () => {
  const R = await import('./connectors.js'), P = await import('./permissions.js'); const failed = await R.loadConnectors(); assert.deepEqual(failed, []);
  const names = new Set();
  for (const c of R.allConnectors()) {
    assert.ok(c.id && c.name && c.category, `manifeste incomplet : ${c.id}`); assert.ok(c.limits || c.how, `limites manquantes : ${c.id}`);
    for (const [id, cap] of Object.entries(c.capabilities || {})) {
      const n = R.toolName(c.id, id); assert.ok(!names.has(n), `doublon ${n}`); names.add(n); assert.match(n, /^[a-zA-Z0-9_-]{1,64}$/);
      assert.ok(cap.label && cap.description && typeof cap.run === 'function', `capacité incomplète : ${n}`); assert.ok([1, 2, 3, 4].includes(cap.level), `niveau invalide : ${n}`);
      if (cap.level >= 3) assert.ok(cap.permission, `permission requise pour ${n}`); if (cap.permission) assert.ok(P.PERMISSIONS[cap.permission], `permission inconnue ${cap.permission} (${n})`);
      assert.ok(Math.max(cap.level, P.PERMISSIONS[cap.permission]?.level || 1) === (cap.level >= 4 || P.PERMISSIONS[cap.permission]?.level >= 4 ? 4 : Math.max(cap.level, P.PERMISSIONS[cap.permission]?.level || 1)));
    }
  }
  const specs = R.toolSpecs(); assert.ok(specs.length > 40); assert.equal(specs.some(s => s.name === 'genis_data_erase'), false, 'les capacités cachées ne sont jamais proposées à l’IA');
  assert.ok(R.toolSpecs(new Set(['genis', 'system'])).length < specs.length / 2, 'le routage par agents réduit les outils envoyés');
  for (const id of ['bank', 'home', 'health', 'school', 'outlook']) assert.deepEqual(Object.keys(R.getConnector(id).capabilities), [], `${id} est préparé : aucun outil exposé`);
});

test('compréhension locale : phrases courantes → bons outils', async () => {
  const { parseLocal } = await import('./nlu-local.js'), R = await import('./connectors.js'), now = new Date(2026, 10, 16, 10, 0);
  const cases = { 'Mets un minuteur de 10 minutes': 'system_timer_start', 'Quelle est la météo à Lyon demain ?': 'weather_get', 'Tu peux regarder s’il va pleuvoir demain matin': 'weather_get', 'Mets du R&B': 'deezer_play', 'Mets ma playlist de travail sur Deezer': 'deezer_play', 'Lance YouTube': 'system_open_service', 'Ouvre mon agenda': 'system_open_service', 'Réveille-moi à 7h30': 'system_alarm_set', 'Rappelle-moi de sortir le linge dans 20 minutes': 'system_reminder_set', 'Combien font 12 fois 7 ?': 'system_calc_eval', 'Quelle heure est-il ?': 'system_time_now', 'Souviens-toi que je préfère les pulls noirs': 'genis_memory_remember', 'Itinéraire de Paris à Lyon en voiture': 'maps_route', 'Cherche-moi un restaurant japonais à Lyon': 'booking_restaurants', 'Qu’est-ce que j’ai demain dans mon agenda ?': 'google_calendar_list', 'Ajoute dentiste à mon agenda demain à 14h': 'google_calendar_create', 'C’est quoi la photosynthèse ?': 'knowledge_wikipedia', 'Change de chanson': 'deezer_control', 'Tu te rappelles du voyage dont on parlait ?': 'genis_history_search' };
  for (const [p, tool] of Object.entries(cases)) { const r = parseLocal(p, { now }); assert.equal(r?.calls?.[0]?.name, tool, `« ${p} » → ${JSON.stringify(r)}`); assert.ok(R.find(tool), `outil inexistant ${tool}`); }
  assert.deepEqual(parseLocal('Ouvre mon agenda, donne-moi la météo et mets ma playlist de travail sur Deezer', { now }).calls.map(c => c.name), ['system_open_service', 'weather_get', 'deezer_play']);
  const shop = parseLocal('Fais-moi une sélection de pulls noirs sans capuche, en coton, taille M, entre 20 et 30 €, sur Vinted', { now }).calls[0].args;
  assert.deepEqual(shop, { marketplace: 'vinted', query: 'pulls noirs', price_min: 20, price_max: 30, size: 'M', color: 'noir', material: 'coton', exclude: ['capuche'] });
  assert.equal(parseLocal('Raconte-moi une blague sur les pirates', { now }), null, 'une demande ouverte est laissée à l’IA');
});

test('écoute : sans reconnaissance vocale ni passerelle, le micro refuse honnêtement', async () => {
  const V = await import('./voice.js'), l = new V.Listener({}); assert.equal(V.sttMode(), 'none');
  await assert.rejects(l.start(), e => e.code === 'STT_UNSUPPORTED' && /écrivez/.test(e.message)); assert.equal(l.active, false);
});

test('onde : réactive au spectre, bornée dans tous les états, sourde quand le micro est coupé', async () => {
  globalThis.Path2D ??= class { moveTo() {} quadraticCurveTo() {} closePath() {} };
  const ctx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : t[k] ?? (() => {})), set: () => true });
  const { Waveform } = await import('./waveform.js'), w = new Waveform({ getContext: () => ctx, parentElement: { clientWidth: 600, clientHeight: 700 }, style: {}, width: 0, height: 0 });
  const run = (n = 200) => { for (let i = 0; i < n; i++) { w.time += 0.016; w.step(0.016); } }, energy = () => w.r.reduce((s, v) => s + Math.abs(v), 0) / w.r.length;
  for (const st of ['idle', 'listening', 'understanding', 'thinking', 'speaking', 'error', 'confirm']) { w.setState(st); w.setSource(o => o.fill(255)); run(150); w.draw(); assert.ok(w.r.every(v => Number.isFinite(v) && Math.abs(v) < 1.3), `valeurs hors bornes en état ${st}`); }
  w.setState('speaking'); w.setSource(o => o.fill(0)); run(); const quiet = energy(); w.setSource(o => o.fill(230)); run(); const loud = energy(); assert.ok(loud > quiet * 2.5, `la voix doit déformer l'onde (${quiet.toFixed(3)} → ${loud.toFixed(3)})`);
  w.setState('idle'); w.setSource(o => o.fill(255)); run(); assert.ok(energy() < 0.06, 'en veille (micro coupé), l’onde ne réagit pas au son : elle ne feint jamais d’écouter');
  w.setState('error'); const before = w.kick; assert.ok(before >= 0);
});

test('calculatrice sûre', async () => {
  const { calculate } = await import('./connector-system.js');
  assert.equal(calculate('12*7'), 84); assert.equal(calculate('(2+3)^2/5'), 5); assert.equal(calculate('20% * 150'), 30); assert.equal(calculate('sqrt(16)+max(1,2)'), 6);
  for (const bad of ['process.exit()', 'globalThis', '1/0', '2+', 'a'.repeat(300)]) assert.throws(() => calculate(bad), bad);
});

test('boutiques : URL de recherche et honnêteté des critères', async () => {
  const { buildSearchUrl } = await import('./connector-shopping.js'), b = buildSearchUrl('vinted', { query: 'pulls noirs', color: 'noir', material: 'coton', size: 'M', price_min: 20, price_max: 30, exclude: ['capuche'] });
  assert.match(b.url, /search_text=pulls%20noirs%20coton%20taille%20M/); assert.match(b.url, /price_from=20&price_to=30/); assert.deepEqual(b.manual, ['sans capuche']);
  assert.match(buildSearchUrl('leboncoin', { query: 'guitare', price_max: 300 }).url, /price=min-300/); assert.match(buildSearchUrl('amazon', { query: 'câble', price_min: 5, price_max: 20 }).url, /rh=p_36%3A500-2000/);
});

test('voyages : planning validé et budget comparé avec alertes', async () => {
  const T = await import('./connector-travel.js'), trip = { start: '2026-11-20', end: '2026-11-23', travelers: 2, budgetLimit: 1500, currency: 'EUR' };
  assert.equal(T.tripDays(trip), 4);
  const n = T.normalizeItinerary(trip, [{ date: '2026-11-21', items: [{ title: 'Musée', time: '14:00', cost: 20 }, { title: 'Petit-déjeuner', time: '9:00' }, { title: 'Visite', time: '14:00' }] }, { date: '2027-01-01', items: [{ title: 'Hors voyage' }] }]);
  assert.deepEqual(n.days[0].items.map(i => i.time), ['09:00', '14:00', '14:00']); assert.equal(n.warnings.filter(w => /hors du voyage|deux activités/.test(w)).length, 2);
  const b = T.computeBudget({ ...trip, budgetLines: [{ category: 'transport', label: 'Train', amount: 400, option: 'A', source: 'estimate' }, { category: 'logement', label: 'Hôtel', amount: 1200, option: 'A' }, { category: 'transport', label: 'Avion', amount: 250, option: 'B' }, { category: 'logement', label: 'Appartement', amount: 700, option: 'B' }] });
  assert.equal(b.options.find(o => o.name === 'A').over, 100); assert.equal(b.options.find(o => o.name === 'B').remaining, 550); assert.equal(b.options[0].perDay, 400); assert.ok(b.alerts.some(a => /dépassement de/.test(a)));
});

test('exécuteur : permissions, confirmations, niveau 4, arrière-plan', async () => {
  const R = await import('./connectors.js'), E = await import('./executor.js'), P = await import('./permissions.js'), S = await import('./strong-auth.js'), M = await import('./memory.js'), N = await import('./notifications.js');
  const c = { confirm: 0, strong: 0, permission: 0 }; let answer = 'allow', strongOk = false;
  E.setHooks({ confirm: async () => { c.confirm++; return answer; }, permission: async () => { c.permission++; return 'always'; }, strong: async v => { c.strong++; return strongOk ? { ok: true, token: S.issueToken(v.actionId) } : { ok: false }; } });
  let r = await E.execute({ name: 'system_time_now', args: {} }, { interactive: true }); assert.equal(r.status, 'done'); assert.equal(c.confirm, 0, 'lecture : aucune confirmation');
  r = await E.execute({ name: 'system_timer_start', args: { minutes: 10 } }, {}); assert.equal(r.status, 'done'); assert.equal(r.verified, true); assert.equal(r.brief, true);
  r = await E.execute({ name: 'system_timer_start', args: {} }, {}); assert.equal(r.status, 'failed'); r = await E.execute({ name: 'outil_inconnu', args: {} }, {}); assert.equal(r.status, 'failed');
  M.addMemory({ text: 'souvenir à oublier un' });
  answer = 'deny'; r = await E.execute({ name: 'genis_memory_forget', args: { query: 'souvenir oublier' } }, { interactive: true }); assert.equal(r.status, 'cancelled'); assert.ok(M.listMemories().some(m => /oublier un/.test(m.text)), 'refus : rien supprimé');
  answer = 'allow'; r = await E.execute({ name: 'genis_memory_forget', args: { query: 'souvenir oublier' } }, { interactive: true }); assert.equal(r.status, 'done'); assert.equal(r.verified, true);
  M.addMemory({ text: 'souvenir à oublier deux' }); r = await E.execute({ name: 'genis_memory_forget', args: { query: 'souvenir oublier deux' } }, { interactive: false });
  assert.equal(r.status, 'needs_confirmation'); assert.ok(M.listMemories().some(m => /oublier deux/.test(m.text))); assert.ok(N.listPending().length >= 1, 'en arrière-plan, l’action attend l’utilisateur');
  P.setPerm('memory.write', 'ask'); r = await E.execute({ name: 'genis_memory_remember', args: { text: 'avec permission' } }, { interactive: true }); assert.equal(c.permission, 1); assert.equal(P.permState('memory.write'), 'granted');
  P.setPerm('memory.write', 'denied'); r = await E.execute({ name: 'genis_memory_remember', args: { text: 'x' } }, { interactive: true }); assert.equal(r.status, 'denied'); P.setPerm('memory.write', 'granted');
  R.register({ id: 'bank_test', name: 'Banque test', status: 'ready', capabilities: { pay: { label: 'Payer', description: 'x', level: 4, permission: 'payment.make', params: { amount: { type: 'number' } }, required: ['amount'], run: async () => ({ status: 'done', verified: true, summary: 'payé (test)' }) } } });
  P.setPerm('payment.make', 'granted'); await S.configure({ passphrase: 'phrase de test assez longue', iter: 1000 });
  r = await E.execute({ name: 'bank_test_pay', args: { amount: 10 } }, { interactive: true }); assert.equal(r.status, 'cancelled', 'sans authentification forte : bloqué'); assert.equal(c.strong, 1);
  strongOk = true; r = await E.execute({ name: 'bank_test_pay', args: { amount: 10 } }, { interactive: true }); assert.equal(r.status, 'done'); assert.equal(c.strong, 2);
  r = await E.execute({ name: 'bank_test_pay', args: { amount: 10 } }, { interactive: false }); assert.equal(r.status, 'needs_confirmation', 'jamais de niveau 4 en arrière-plan');
  E.setHooks({ strong: async () => ({ ok: true, token: 'jeton-forgé' }) }); r = await E.execute({ name: 'bank_test_pay', args: { amount: 10 } }, { interactive: true }); assert.equal(r.status, 'failed', 'un jeton non émis par le flux fort est refusé');
  R.register({ id: 'liar', name: 'Menteur', status: 'ready', capabilities: { send: { label: 'Envoyer', description: 'x', level: 3, permission: 'mail.send', params: {}, run: async () => ({ status: 'done', summary: 'envoyé !' }) } } });
  P.setPerm('mail.send', 'granted'); r = await E.execute({ name: 'liar_send', args: {} }, { interactive: true }); assert.equal(r.status, 'unverified', 'succès non vérifié à niveau 3 : rétrogradé');
  const mv = E.modelView({ status: 'done', verified: true, summary: 's', data: { token: 'abc', api_key: 'k', nested: { password: 'p', ok: 1 } } }); assert.equal(/abc|"k"|"p"/.test(JSON.stringify(mv)), false); assert.equal(mv.data.nested.ok, 1);
});

test('orchestrateur : boucle d’outils avec IA simulée, garde d’affirmations', async () => {
  const { patchSettings } = await import('./storage.js'), G = await import('./gateway.js'), B = await import('./brain.js'), Sp = await import('./spaces.js'), M = await import('./memory.js');
  patchSettings({ gatewayUrl: 'https://gw.test' }); await G.setGatewaySecret('secret-de-test'); Sp.ensureSpaces();
  const seen = []; let script = [];
  globalThis.fetch = async (url, init) => { const b = JSON.parse(init.body); seen.push({ url, secret: init.headers['x-app-secret'], b }); const out = script.shift(); return new Response(JSON.stringify(out), { status: 200, headers: { 'content-type': 'application/json' } }); };
  try {
    script = [{ text: '', toolCalls: [{ id: 'c1', name: 'system_time_now', args: {} }] }, { text: 'Il est bien l’heure du café.', toolCalls: [] }];
    let out = await B.runRequest('Raconte-moi quelque chose de gentil', { spaceId: Sp.activeSpace().id }); assert.equal(out.text, 'Il est bien l’heure du café.'); assert.equal(seen.length, 2); assert.equal(seen[0].secret, 'secret-de-test');
    assert.ok(seen[0].b.tools.some(t => t.name === 'system_time_now') && seen[0].b.tools.some(t => t.name === 'announce_plan')); assert.match(seen[0].b.system, /N’invente JAMAIS/);
    const tool = seen[1].b.messages.at(-1); assert.equal(tool.role, 'tool'); assert.equal(JSON.parse(tool.content).status, 'done', 'le résultat réel de l’outil est renvoyé au modèle');
    assert.equal(seen.some(s => JSON.stringify(s.b).includes('secret-de-test')), false, 'le secret ne va jamais dans le prompt');
    script = [{ text: 'J’ai réservé le restaurant pour 20 h.', toolCalls: [] }]; out = await B.runRequest('Réserve-moi un restaurant ce soir pour deux', { spaceId: Sp.activeSpace().id });
    assert.match(out.text, /Précision : je n’ai reçu aucune confirmation réelle de une réservation/); assert.equal(out.style, 'error');
    script = [{ text: 'D’accord.', toolCalls: [{ id: 'x', name: 'google_calendar_list', args: {} }] }, { text: 'Je n’ai pas accès à votre agenda.', toolCalls: [] }];
    const before = seen.length; out = await B.runRequest('Aide-moi à organiser ma semaine prochaine', { spaceId: Sp.activeSpace().id }); assert.equal(seen.length, before + 2);
    assert.equal(JSON.parse(seen.at(-1).b.messages.at(-1).content).status, 'needs_auth', 'compte non connecté : statut honnête, pas de simulation');
    out = await B.runRequest('Qu’est-ce que j’ai demain dans mon agenda ?', { spaceId: Sp.activeSpace().id }); assert.equal(seen.length, before + 2, 'commande locale : aucun appel réseau'); assert.match(out.text, /non connecté/);
    script = []; out = await B.runRequest('Mets un minuteur de 5 minutes', { spaceId: Sp.activeSpace().id }); assert.equal(out.speech, 'C’est fait.'); assert.equal(seen.length, before + 2);
    assert.ok(M.getChat(Sp.activeSpace().chatId).messages.length >= 10);
  } finally { globalThis.fetch = real; }
});

test('garde d’affirmations et vue modèle', async () => {
  const { claimGuard } = await import('./brain.js');
  assert.equal(claimGuard("J'ai réservé le restaurant pour 20h.", []).guarded, true); assert.equal(claimGuard('Le mail a été envoyé.', [{ status: 'done', verified: true, tool: 'google_mail_send' }]).guarded, false);
  assert.equal(claimGuard("J'ai ajouté la réunion à votre agenda.", [{ status: 'unverified', verified: false, tool: 'google_calendar_create' }]).guarded, true); assert.equal(claimGuard('Voici trois restaurants près de vous.', []).guarded, false);
});

test('passerelle : sécurité, CORS, normalisation des fournisseurs', async () => {
  const W = await import('./worker.js'), gw = W.default, env = { APP_SECRET: 's3cret', ALLOWED_ORIGIN: 'https://sopp24.github.io', ANTHROPIC_API_KEY: 'sk-ant', OPENAI_API_KEY: 'sk-oa' };
  const call = (path, o = {}) => gw.fetch(new Request('https://gw.test' + path, { method: o.method || 'GET', headers: { origin: 'https://sopp24.github.io', 'x-app-secret': 's3cret', ...(o.body ? { 'content-type': 'application/json' } : {}), ...o.headers }, body: o.body ? JSON.stringify(o.body) : undefined }), env);
  assert.equal(W.constantTimeEqual('a', 'a'), true); assert.equal(W.constantTimeEqual('a', 'ab'), false);
  const pre = await gw.fetch(new Request('https://gw.test/chat', { method: 'OPTIONS', headers: { origin: 'https://sopp24.github.io' } }), env); assert.equal(pre.status, 204); assert.equal(pre.headers.get('access-control-allow-origin'), 'https://sopp24.github.io'); assert.match(pre.headers.get('access-control-allow-headers'), /x-app-secret/);
  assert.equal((await gw.fetch(new Request('https://gw.test/', { headers: { origin: 'https://evil.example' } }), env)).status, 403);
  let r = await gw.fetch(new Request('https://gw.test/', { headers: { origin: 'https://sopp24.github.io' } }), env), j = await r.json(); assert.equal(j.appSecretAccepted, false); assert.equal(j.providers, undefined, 'configuration non révélée sans secret');
  r = await gw.fetch(new Request('https://gw.test/', { headers: { origin: 'https://sopp24.github.io', 'x-app-secret': 's3cret' } }), env); j = await r.json(); assert.equal(j.api, 3); assert.deepEqual(j.providers, { anthropic: true, openai: true, gemini: false });
  assert.equal((await gw.fetch(new Request('https://gw.test/chat', { method: 'POST', headers: { origin: 'https://sopp24.github.io', 'x-app-secret': 'faux' }, body: '{}' }), env)).status, 401);
  assert.equal((await gw.fetch(new Request('https://gw.test/chat', { method: 'POST', body: '{}' }), { ...env, APP_SECRET: '' })).status, 503);
  const sent = []; globalThis.fetch = async (url, init) => { const b = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : init?.body; sent.push({ url: String(url), init, b }); if (String(url).includes('anthropic')) return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Je regarde.' }, { type: 'tool_use', id: 'tu1', name: 'weather_get', input: { city: 'Lyon' } }], usage: {} }));
    if (String(url).includes('openai.com/v1/chat')) return new Response(JSON.stringify({ choices: [{ message: { content: 'ok', tool_calls: [{ id: 'oc1', type: 'function', function: { name: 'weather_get', arguments: '{"city":"Paris"}' } }] } }] }));
    if (String(url).includes('audio/speech')) return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mpeg' } }); return new Response('{}', { status: 404 }); };
  try {
    const body = { system: 'SYS', tier: 'smart', tools: [{ name: 'weather_get', description: 'd', input_schema: { type: 'object', properties: { city: { type: 'string' } } } }, { name: 'mauvais nom!', description: 'x' }], messages: [{ role: 'assistant', content: 'orphelin' }, { role: 'user', content: 'Météo ?' }, { role: 'assistant', content: '', toolCalls: [{ id: 'a', name: 'weather_get', args: {} }, { id: 'b', name: 'weather_get', args: {} }] }, { role: 'tool', toolCallId: 'a', name: 'weather_get', content: '{"status":"done"}' }, { role: 'tool', toolCallId: 'b', name: 'weather_get', content: '{"status":"done"}' }] };
    j = await (await call('/chat', { method: 'POST', body })).json(); const a = sent.at(-1);
    assert.equal(a.url, 'https://api.anthropic.com/v1/messages'); assert.equal(a.init.headers['x-api-key'], 'sk-ant'); assert.equal(a.b.model, 'claude-sonnet-5-5'); assert.match(a.b.system, /^SYS[\s\S]*données non fiables/); assert.equal(a.b.tools.length, 1, 'noms d’outils invalides écartés');
    assert.equal(a.b.messages[0].role, 'user', 'l’historique commence par un message utilisateur'); const last = a.b.messages.at(-1); assert.equal(last.content.filter(x => x.type === 'tool_result').length, 2, 'résultats d’outils fusionnés dans un seul message');
    assert.deepEqual(j.toolCalls, [{ id: 'tu1', name: 'weather_get', args: { city: 'Lyon' } }]); assert.equal(j.provider, 'anthropic');
    j = await (await call('/chat', { method: 'POST', body: { ...body, provider: 'openai', tier: 'fast' } })).json(); const o = sent.at(-1);
    assert.equal(o.b.model, 'gpt-4.1-mini'); assert.equal(o.b.messages[0].role, 'system'); assert.ok(o.b.messages.some(m => m.role === 'tool' && m.tool_call_id === 'a')); assert.deepEqual(j.toolCalls[0], { id: 'oc1', name: 'weather_get', args: { city: 'Paris' } }); assert.ok(o.b.max_completion_tokens);
    assert.equal((await call('/chat', { method: 'POST', body: { ...body, provider: 'gemini' } })).status, 503, 'fournisseur sans clé : erreur claire');
    assert.equal((await gw.fetch(new Request('https://gw.test/chat', { method: 'POST', headers: { 'x-app-secret': 's3cret' }, body: JSON.stringify(body) }), { APP_SECRET: 's3cret' })).status, 503, 'aucune clé d’IA');
    const t = await call('/tts', { method: 'POST', body: { text: 'Bonjour G.E.N.I.S', style: 'success' } }); assert.equal(t.headers.get('content-type'), 'audio/mpeg'); assert.match(sent.at(-1).b.instructions, /Génis/); assert.match(sent.at(-1).b.instructions, /satisfait/); assert.equal(sent.at(-1).init.headers.authorization, 'Bearer sk-oa');
    assert.equal((await gw.fetch(new Request('https://gw.test/tts', { method: 'POST', headers: { 'x-app-secret': 's3cret' }, body: '{"text":"x"}' }), { APP_SECRET: 's3cret' })).status, 503);
  } finally { globalThis.fetch = real; }
  const m = W.toAnthropic([{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }]); assert.equal(m.length, 1); assert.equal(m[0].content.length, 2);
  const g = W.toGemini([{ role: 'user', content: 'a' }, { role: 'assistant', content: '', toolCalls: [{ id: 'x', name: 'f', args: { q: 1 } }] }, { role: 'tool', name: 'f', toolCallId: 'x', content: '{"ok":true}' }]); assert.equal(g[1].role, 'model'); assert.deepEqual(g[2].parts[0].functionResponse.response, { ok: true });
  assert.equal(W.pickModel('anthropic', 'fast', '', { MODEL_ANTHROPIC_FAST: 'custom-1' }), 'custom-1'); assert.equal(W.pickModel('openai', 'smart', 'rm -rf /', {}), 'gpt-4.1');
});

test('passerelle : proxys en liste blanche, flux RSS, e-mails', async () => {
  const W = await import('./worker.js'), gw = W.default, env = { APP_SECRET: 's', ALLOWED_ORIGIN: '*' }, req = p => gw.fetch(new Request('https://gw.test' + p, { headers: { 'x-app-secret': 's', origin: 'https://x.test' } }), env);
  assert.equal((await req('/proxy/deezer?path=../../secret')).status, 400); assert.equal((await req('/proxy/deezer?path=user/me/playlists')).status, 400);
  const urls = []; globalThis.fetch = async u => { urls.push(String(u)); if (String(u).includes('deezer')) return new Response('{"data":[]}'); return new Response(`<rss><channel><item><title><![CDATA[Titre &amp; « un »]]></title><link>https://exemple.fr/a</link><description>&lt;p&gt;Résumé &amp;amp; suite&lt;/p&gt;</description><pubDate>Mon, 16 Nov 2026 08:00:00 GMT</pubDate></item><item><title>Sans lien sûr</title><link>javascript:alert(1)</link></item></channel></rss>`); };
  try {
    const d = await req('/proxy/deezer?path=search/playlist&q=r%26b&limit=999&evil=1'); assert.equal(d.status, 200); assert.equal(urls[0], 'https://api.deezer.com/search/playlist?q=r%26b&limit=25', 'paramètres filtrés et bornés');
    const f = await (await req('/proxy/feed?source=lemonde')).json(); assert.equal(f.items.length, 1, 'liens non https écartés'); assert.equal(f.items[0].title, 'Titre & « un »'); assert.equal(f.items[0].summary, 'Résumé & suite'); assert.equal(f.items[0].published, '2026-11-16T08:00:00.000Z');
    assert.equal((await req('/proxy/feed?source=inconnue')).status, 400);
  } finally { globalThis.fetch = real; }
  const raw = W.rfc822({ to: 'thomas@exemple.fr', subject: 'Disponibilité mardi\r\nBcc: pirate@evil.fr', body: 'Je serai disponible mardi. Éric' });
  assert.equal(/\r\nBcc:/i.test(raw), false, 'pas d’injection d’en-tête'); assert.match(raw, /^To: thomas@exemple.fr\r\nSubject: =\?UTF-8\?B\?/); assert.throws(() => W.rfc822({ to: 'a@b.c, evil', subject: 's', body: 'b' })); assert.throws(() => W.rfc822({ to: 'a@b.fr\r\nBcc: x@y.fr', subject: 's', body: 'b' }));
  const p = W.parseRss('<item><title>A</title><link>https://a.fr</link></item>'); assert.equal(p.length, 1);
});

test('passerelle : OAuth Google, jetons chiffrés, actions Agenda/Gmail', async () => {
  const W = await import('./worker.js'), gw = W.default, store = new Map(), KV = { get: async k => store.get(k) ?? null, put: async (k, v) => void store.set(k, v), delete: async k => void store.delete(k) };
  const env = { APP_SECRET: 's', ALLOWED_ORIGIN: 'https://sopp24.github.io', GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'csec', TOKEN_ENC_KEY: 'clé-de-chiffrement-de-test', GENIS_KV: KV };
  const call = (path, o = {}) => gw.fetch(new Request('https://gw.test' + path, { method: o.method || 'GET', headers: { origin: 'https://sopp24.github.io', 'x-app-secret': 's', ...(o.body ? { 'content-type': 'application/json' } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }), env);
  const cal = 'https://www.googleapis.com/auth/calendar.events', mail = 'https://www.googleapis.com/auth/gmail.readonly';
  assert.equal((await (await call('/accounts')).json()).google.connected, false);
  assert.equal((await call('/oauth/google/start', { method: 'POST', body: { scopes: ['https://evil.example/all'] } })).status, 400, 'portées non autorisées refusées');
  const start = await (await call('/oauth/google/start', { method: 'POST', body: { scopes: [cal] } })).json(), u = new URL(start.url), state = u.searchParams.get('state');
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth'); assert.equal(u.searchParams.get('access_type'), 'offline'); assert.equal(u.searchParams.get('redirect_uri'), 'https://gw.test/oauth/google/callback'); assert.ok(store.has(`oauth:state:${state}`));
  assert.equal((await gw.fetch(new Request('https://gw.test/oauth/google/callback?code=x&state=inconnu'), env)).status, 400, 'state inconnu refusé');
  const calls = []; globalThis.fetch = async (url, init) => { url = String(url); calls.push({ url, init }); if (url.endsWith('/token')) { const f = new URLSearchParams(init.body); return new Response(JSON.stringify(f.get('grant_type') === 'authorization_code' ? { access_token: 'AT-secret', refresh_token: 'RT-secret', expires_in: 3600, scope: cal } : { access_token: 'AT2', expires_in: 3600, scope: cal })); }
    if (url.includes('/calendar/v3/calendars/primary/events') && (init?.method || 'GET') === 'GET') return new Response(JSON.stringify({ items: [{ id: 'e1', summary: 'Dentiste', start: { dateTime: '2026-11-17T14:00:00Z' }, end: { dateTime: '2026-11-17T15:00:00Z' }, htmlLink: 'https://calendar.google.com/e1' }] }));
    if (url.includes('/calendar/v3/calendars/primary/events') && init.method === 'POST') return new Response(JSON.stringify({ id: 'new1', summary: JSON.parse(init.body).summary, start: JSON.parse(init.body).start, end: JSON.parse(init.body).end })); if (url.endsWith('/revoke')) return new Response('{}'); return new Response('{}', { status: 404 }); };
  try {
    const cb = await gw.fetch(new Request(`https://gw.test/oauth/google/callback?code=abc&state=${state}`), env); assert.equal(cb.status, 200); assert.equal(store.has(`oauth:state:${state}`), false, 'state à usage unique'); assert.match(await cb.text(), /genis:oauth/);
    const sealed = store.get('google:tokens'); assert.ok(sealed && !/AT-secret|RT-secret/.test(sealed), 'jetons chiffrés au repos'); assert.deepEqual(await W.unseal(env, sealed).then(t => [t.refresh_token, t.scope]), ['RT-secret', cal]);
    assert.deepEqual((await (await call('/accounts')).json()).google.scopes, [cal]);
    let r = await (await call('/action', { method: 'POST', body: { connector: 'google', action: 'calendar.list', params: {} } })).json(); assert.equal(r.ok, true); assert.equal(r.data.events[0].title, 'Dentiste'); assert.equal(calls.at(-1).init.headers.authorization, 'Bearer AT-secret');
    r = await (await call('/action', { method: 'POST', body: { connector: 'google', action: 'calendar.create', params: { title: 'Dîner', start: '2026-11-20T19:00:00Z' } } })).json(); assert.equal(r.data.event.id, 'new1'); assert.equal(JSON.parse(calls.at(-1).init.body).end.dateTime, '2026-11-20T20:00:00.000Z');
    const miss = await call('/action', { method: 'POST', body: { connector: 'google', action: 'mail.search', params: { query: 'from:thomas' } } }); assert.equal(miss.status, 403); assert.deepEqual((await miss.json()).error.code, 'MISSING_SCOPE');
    assert.equal((await call('/action', { method: 'POST', body: { connector: 'slack', action: 'x' } })).status, 400); assert.equal((await call('/action', { method: 'POST', body: { connector: 'google', action: 'calendar.drop_all' } })).status, 400);
    await call('/oauth/google/revoke', { method: 'POST', body: {} }); assert.equal(store.has('google:tokens'), false); assert.equal((await (await call('/accounts')).json()).google.connected, false);
    assert.equal((await call('/action', { method: 'POST', body: { connector: 'google', action: 'calendar.list', params: {} } })).status, 401);
  } finally { globalThis.fetch = real; }
  const s1 = await W.seal(env, { a: 1 }); await assert.rejects(W.unseal({ ...env, TOKEN_ENC_KEY: 'autre' }, s1));
});

test('PWA : le précache couvre tout le graphe d’imports, les fichiers référencés existent, l’empreinte CSP correspond', () => {
  const files = readdirSync('.').filter(f => f.endsWith('.js') && !['sw.js', 'worker.js'].includes(f)), sw = readFileSync('sw.js', 'utf8'), shell = JSON.parse(sw.match(/const SHELL = (\[.*?\]);/s)[1]);
  for (const f of files) { const src = readFileSync(f, 'utf8'); for (const m of src.matchAll(/(?:from|import\()\s*['"]\.\/([\w.-]+\.js)['"]/g)) { assert.ok(existsSync(m[1]), `${f} importe ${m[1]} (absent)`); assert.ok(shell.includes(m[1]), `${m[1]} manque au précache du service worker`); } }
  for (const m of readFileSync('connectors.js', 'utf8').matchAll(/'\.\/([\w.-]+\.js)'/g)) assert.ok(shell.includes(m[1]), `connecteur ${m[1]} manque au précache`);
  for (const f of shell.filter(x => x !== './')) assert.ok(existsSync(f), `précache : ${f} absent`);
  const imported = new Set(); for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/['"]\.\/([\w.-]+\.js)['"]/g)) imported.add(m[1]);
  for (const f of files) if (f !== 'app.js') assert.ok(imported.has(f), `fichier orphelin (importé par personne) : ${f}`);
  assert.ok(files.every(f => shell.includes(f)), 'tout module .js doit être dans le précache');
  const man = JSON.parse(readFileSync('manifest.webmanifest', 'utf8')); for (const i of man.icons) assert.ok(existsSync(i.src), i.src); assert.equal(man.name, 'G.E.N.I.S'); assert.equal(man.display, 'standalone');
  const html = readFileSync('index.html', 'utf8'); for (const m of html.matchAll(/(?:href|src)="([\w.-]+\.(?:css|js|svg|png|webmanifest))"/g)) assert.ok(existsSync(m[1]), `index.html référence ${m[1]}`);
  const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1], hash = createHash('sha256').update(inline).digest('base64'); assert.ok(html.includes(`'sha256-${hash}'`), 'l’empreinte CSP du bouton SOPP Agents doit correspondre au script en ligne');
  assert.match(html, /<title>G\.E\.N\.I\.S<\/title>/); assert.ok(html.includes('sopp-home-float'), 'le raccourci SOPP Agents est conservé');
  for (const id of [...html.matchAll(/id="([\w-]+)"/g)].map(m => m[1])) assert.equal([...html.matchAll(new RegExp(`id="${id}"`, 'g'))].length, 1, `id dupliqué : ${id}`);
  const ui = readFileSync('ui.js', 'utf8') + readFileSync('app.js', 'utf8'); for (const m of ui.matchAll(/\$\('([\w-]+)'\)/g)) assert.ok(html.includes(`id="${m[1]}"`), `ui.js attend l’élément #${m[1]}`);
  const svg = html.match(/<svg class="sprite"[\s\S]*?<\/svg>/)[0]; for (const m of (readFileSync('panels.js', 'utf8') + ui + readFileSync('cards.js', 'utf8') + readFileSync('modals.js', 'utf8')).matchAll(/icon\('([\w-]+)'\)/g)) assert.ok(svg.includes(`id="i-${m[1]}"`), `icône manquante : ${m[1]}`);
});
