/* G.E.N.I.S — fenêtres modales : confirmation, permission, authentification forte (paiements), formulaires. Piège de focus, Échap, retour du focus. */
import { h, icon, bus } from './util.js';
import { LEVELS } from './security.js';
import { getSettings } from './storage.js';
import * as SA from './strong-auth.js';
const host = () => document.getElementById('modals') || document.body;
let open = 0, pendingVoice = null;
export const modalOpen = () => open > 0;
export function modal(build, { label, dismissible = true, onClose, wide = false } = {}) {
  const prev = document.activeElement, back = h('div', { class: 'modal-back' }), box = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': label || 'Fenêtre' }, build());
  let closed = false;
  const close = () => { if (closed) return; closed = true; open--; back.remove(); removeEventListener('keydown', onKey, true); try { prev?.focus?.(); } catch {} onClose?.(); };
  const focusables = () => [...box.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(e => !e.disabled && e.offsetParent !== null);
  const onKey = e => {
    if (e.key === 'Escape' && dismissible) { e.stopPropagation(); close(); }
    else if (e.key === 'Tab') { const f = focusables(); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
  };
  back.append(box); host().append(back); open++; addEventListener('keydown', onKey, true);
  if (dismissible) back.addEventListener('pointerdown', e => { if (e.target === back) close(); });
  setTimeout(() => (box.querySelector('[autofocus]') || focusables()[0])?.focus(), 30);
  return { close, box };
}
const actions = (...b) => h('div', { class: 'modal-actions' }, b);
const btn = (label, fn, cls = '') => h('button', { type: 'button', class: `btn ${cls}`.trim(), onclick: fn }, label);
const warns = w => (w?.length ? h('ul', { class: 'warn' }, w.map(x => h('li', {}, icon('alert'), x))) : null);

export function confirmAction(v) {
  return new Promise(resolve => {
    let m; const done = val => { pendingVoice = null; resolve(val); m.close(); };
    m = modal(() => h('div', { class: 'modal-body' }, h('p', { class: 'modal-sub' }, `${v.connector} · ${LEVELS[v.level]}`), h('h2', {}, v.title), h('p', { class: 'lead' }, v.summary), warns(v.warnings),
      v.details?.length ? h('dl', { class: 'kv' }, v.details.flatMap(d => [h('dt', {}, d.label), h('dd', {}, d.value)])) : null, h('p', { class: 'why' }, v.why),
      getSettings().voiceConfirm && v.level < 4 ? h('p', { class: 'why' }, 'Vous pouvez aussi dire « oui » ou « non ».') : null,
      actions(btn('Annuler', () => done('deny'), 'ghost'), v.offerAlways ? btn('Toujours autoriser', () => done('always')) : null, h('button', { type: 'button', class: 'btn primary', autofocus: true, onclick: () => done('allow') }, 'Autoriser'))), { label: v.title, onClose: () => resolve('deny') });
    pendingVoice = { level: v.level, done }; bus.emit('visual', { state: 'confirm' }); bus.emit('confirm:ask', v);
  });
}
/** Réponse vocale à une confirmation en cours. Retourne true si l'énoncé est absorbé (aucune autre commande ne doit être lancée pendant une confirmation). */
export function voiceAnswer(text) {
  if (!pendingVoice) return false;
  if (!getSettings().voiceConfirm || pendingVoice.level >= 4) return true;
  if (/^(oui|ok|d['’]accord|vas-y|confirme|allez|c['’]est bon)\b/i.test(text.trim())) pendingVoice.done('allow');
  else if (/^(non|annule|stop|laisse|surtout pas)\b/i.test(text.trim())) pendingVoice.done('deny');
  return true;
}
export function askPermission(v) {
  return new Promise(resolve => {
    let m; const done = val => { resolve(val); m.close(); };
    m = modal(() => h('div', { class: 'modal-body' }, h('h2', {}, 'Autorisation requise'), h('p', { class: 'lead' }, `G.E.N.I.S souhaite utiliser ${v.connector} : ${v.capability.toLowerCase()}.`), h('p', { class: 'why' }, v.why),
      actions(btn('Refuser', () => done('deny'), 'ghost'), btn('Cette fois', () => done('once')), h('button', { type: 'button', class: 'btn primary', autofocus: true, onclick: () => done('always') }, 'Toujours autoriser'))), { label: 'Autorisation requise', onClose: () => resolve('deny') });
  });
}
export const confirmSimple = ({ title, text, confirmLabel = 'Confirmer', danger = false }) => new Promise(resolve => {
  let m; const done = v => { resolve(v); m.close(); };
  m = modal(() => h('div', { class: 'modal-body' }, h('h2', {}, title), h('p', { class: 'lead' }, text), actions(btn('Annuler', () => done(false), 'ghost'), h('button', { type: 'button', class: `btn ${danger ? 'danger' : 'primary'}`, autofocus: true, onclick: () => done(true) }, confirmLabel))), { label: title, onClose: () => resolve(false) });
});
export function formDialog({ title, intro = '', fields, submitLabel = 'Enregistrer', validate }) {
  return new Promise(resolve => {
    let m; const els = {}, err = h('p', { class: 'form-err', role: 'alert' });
    const build = f => {
      const common = { id: 'f_' + f.name, name: f.name, 'aria-label': f.label };
      const el = f.type === 'textarea' ? h('textarea', { ...common, rows: 3, placeholder: f.placeholder || '' }) : f.type === 'select' ? h('select', common, f.options.map(([v, l]) => h('option', { value: v }, l))) : f.type === 'checkbox' ? h('input', { ...common, type: 'checkbox' }) : h('input', { ...common, type: f.type || 'text', placeholder: f.placeholder || '', autocomplete: 'off' });
      if (f.type === 'checkbox') el.checked = !!f.value; else if (f.value != null) el.value = f.value;
      els[f.name] = el; return h('label', { class: 'field', for: common.id }, h('span', {}, f.label), el, f.help ? h('small', {}, f.help) : null);
    };
    const submit = e => {
      e?.preventDefault(); const v = {}; for (const f of fields) v[f.name] = f.type === 'checkbox' ? els[f.name].checked : els[f.name].value.trim();
      const msg = validate?.(v); if (msg) { err.textContent = msg; return; } resolve(v); m.close();
    };
    m = modal(() => h('form', { class: 'modal-body', onsubmit: submit }, h('h2', {}, title), intro ? h('p', { class: 'why' }, intro) : null, fields.map(build), err, actions(btn('Annuler', () => { resolve(null); m.close(); }, 'ghost'), h('button', { type: 'submit', class: 'btn primary' }, submitLabel))), { label: title, onClose: () => resolve(null) });
  });
}
const KEYNAMES = { ControlLeft: 'Ctrl gauche', ControlRight: 'Ctrl droite', ShiftLeft: 'Maj gauche', ShiftRight: 'Maj droite', AltLeft: 'Alt gauche', AltRight: 'Alt droite', MetaLeft: 'Cmd gauche', MetaRight: 'Cmd droite', Space: 'Espace' };
export const keyName = c => KEYNAMES[c] || c.replace(/^Key/, '').replace(/^Digit/, '');
/** Configuration : phrase secrète (min. 14 caractères, 3 mots), deux touches à maintenir, code de récupération affiché une seule fois. */
export function setupStrongAuth() {
  return new Promise(resolve => {
    let m, chord = ['ControlLeft', 'ShiftLeft'], capturing = false, got = [];
    const p1 = h('input', { type: 'password', autocomplete: 'new-password', 'aria-label': 'Phrase secrète', placeholder: 'Une phrase de 3 mots ou plus' }), p2 = h('input', { type: 'password', autocomplete: 'new-password', 'aria-label': 'Confirmer la phrase secrète', placeholder: 'Confirmer la phrase' });
    const err = h('p', { class: 'form-err', role: 'alert' }), chordLbl = h('b', {}, chord.map(keyName).join(' + '));
    const capBtn = btn('Choisir deux autres touches', () => { capturing = true; got = []; capBtn.textContent = 'Appuyez sur les deux touches…'; }, 'ghost');
    const onKey = e => { if (!capturing || !e.isTrusted) return; e.preventDefault(); if (!got.includes(e.code)) got.push(e.code); if (got.length === 2) { chord = got.slice(); capturing = false; chordLbl.textContent = chord.map(keyName).join(' + '); capBtn.textContent = 'Choisir deux autres touches'; } };
    addEventListener('keydown', onKey, true);
    const finish = ok => { removeEventListener('keydown', onKey, true); m.close(); resolve(ok); };
    const save = async () => {
      if (p1.value !== p2.value) { err.textContent = 'Les deux phrases ne sont pas identiques.'; return; }
      try {
        const { recoveryCode } = await SA.configure({ passphrase: p1.value, chord }); p1.value = p2.value = '';
        const ok = h('input', { type: 'checkbox', id: 'rc_ok' }), done = h('button', { type: 'button', class: 'btn primary', disabled: true, onclick: () => finish(true) }, 'Terminer');
        ok.addEventListener('change', () => (done.disabled = !ok.checked));
        box.replaceChildren(h('h2', {}, 'Code de récupération'), h('p', { class: 'lead' }, 'Notez ce code hors de cet appareil : il est affiché une seule fois et permet de redéfinir la phrase si vous l’oubliez.'), h('p', { class: 'recovery' }, recoveryCode), h('label', { class: 'check' }, ok, h('span', {}, 'J’ai noté ce code en lieu sûr')), actions(btn('Copier', () => navigator.clipboard?.writeText(recoveryCode), 'ghost'), done));
      } catch (e) { err.textContent = e.message; }
    };
    m = modal(() => h('div', { class: 'modal-body' }, h('h2', {}, 'Authentification forte'), h('p', { class: 'lead' }, 'Requise pour les actions sensibles (paiement, suppression définitive). La phrase n’est jamais enregistrée ni envoyée à une IA : seul un dérivé salé est conservé sur cet appareil.'),
      h('label', { class: 'field' }, h('span', {}, 'Phrase secrète'), p1), h('label', { class: 'field' }, h('span', {}, 'Confirmation'), p2),
      h('div', { class: 'field' }, h('span', {}, 'Touches à maintenir ensemble'), h('p', {}, chordLbl), capBtn, h('small', {}, 'Choisissez des touches modificatrices (Ctrl, Maj, Alt) : elles n’écrivent pas dans la phrase.')), err,
      actions(btn('Annuler', () => finish(false), 'ghost'), btn('Enregistrer', save, 'primary'))), { label: 'Configurer l’authentification forte', dismissible: false });
    const box = m.box.firstChild?.parentElement || m.box;
  });
}
/** Demande d'authentification forte : phrase (saisie ou dictée) + deux touches maintenues 1,2 s (touches réelles uniquement ; pastilles tactiles sur mobile). */
export function requestStrongAuth(v) {
  return new Promise(async resolve => {
    if (!SA.isConfigured() && !(await setupStrongAuth())) return resolve({ ok: false });
    SA.trackChord();
    const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    let spoken = '', rec = null, raf = 0, hold = 0, busy = false, closed = false, m;
    const input = h('input', { type: 'password', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Phrase secrète', placeholder: 'Phrase secrète', autofocus: true }), status = h('p', { class: 'status', role: 'status' }), bar = h('div', { class: 'hold' }, h('i'));
    const end = r => { if (closed) return; closed = true; cancelAnimationFrame(raf); try { rec?.abort(); } catch {} spoken = ''; input.value = ''; m.close(); resolve(r); };
    const attempt = async () => {
      if (busy) return; const secret = spoken || input.value; if (!secret) { status.textContent = 'Saisissez ou dictez d’abord votre phrase, puis maintenez les deux touches.'; hold = 0; return; }
      busy = true; const r = await SA.verify(secret); busy = false;
      if (r.ok) return end({ ok: true, token: SA.issueToken(v.actionId) });
      input.value = ''; spoken = ''; hold = 0; status.textContent = r.reason === 'locked' ? `Trop d’essais : patientez ${Math.ceil(r.wait / 1000)} s.` : `Phrase incorrecte${r.wait ? ` : patientez ${Math.ceil(r.wait / 1000)} s` : ''}.`;
    };
    const tick = () => {
      if (closed) return;
      if (SA.chordHeld()) { hold ||= performance.now(); const p = Math.min(1, (performance.now() - hold) / SA.holdMs); bar.firstChild.style.width = p * 100 + '%'; if (p >= 1 && (input.value || spoken)) { hold = 0; attempt(); } } else { hold = 0; bar.firstChild.style.width = '0%'; }
      raf = requestAnimationFrame(tick);
    };
    const dictBtn = SR ? btn('Dicter', () => {
      if (rec) { try { rec.abort(); } catch {} rec = null; dictBtn.textContent = 'Dicter'; return; }
      rec = new SR(); rec.lang = getSettings().lang || 'fr-FR'; rec.interimResults = false; rec.continuous = false;
      rec.onresult = e => { spoken = e.results[0][0].transcript; status.textContent = 'Phrase dictée reçue (non affichée). Maintenez les deux touches.'; };
      rec.onend = () => { rec = null; dictBtn.textContent = 'Dicter'; }; dictBtn.textContent = 'Écoute… (touchez pour arrêter)'; try { rec.start(); } catch { rec = null; }
    }, 'ghost') : null;
    const pad = id => h('button', { type: 'button', class: 'pad', 'aria-label': `Pastille ${id}`, onpointerdown: e => { if (e.isTrusted) SA.padDown(id); }, onpointerup: () => SA.padUp(id), onpointercancel: () => SA.padUp(id), onpointerleave: () => SA.padUp(id) }, id);
    m = modal(() => h('div', { class: 'modal-body strong' }, h('p', { class: 'modal-sub' }, `${v.connector} · ${LEVELS[4]}`), h('h2', {}, v.title), h('p', { class: 'lead' }, v.summary), warns(v.warnings),
      v.details?.length ? h('dl', { class: 'kv' }, v.details.flatMap(d => [h('dt', {}, d.label), h('dd', {}, d.value)])) : null,
      h('div', { class: 'field' }, h('span', {}, '1. Votre phrase secrète'), input, dictBtn),
      h('div', { class: 'field' }, h('span', {}, `2. Maintenez ensemble ${SA.chordKeys().map(keyName).join(' + ')} pendant 1 seconde`), bar, matchMedia('(pointer: coarse)').matches ? h('div', { class: 'pads' }, pad('A'), pad('B')) : null, h('small', {}, 'Sur mobile : maintenez les deux pastilles avec deux doigts. Les événements simulés par un programme sont ignorés.')),
      status, actions(btn('Annuler', () => end({ ok: false }), 'ghost'))), { label: 'Authentification forte', dismissible: true, onClose: () => end({ ok: false }) });
    bus.emit('visual', { state: 'confirm' }); raf = requestAnimationFrame(tick);
  });
}
