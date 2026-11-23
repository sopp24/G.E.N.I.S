/* G.E.N.I.S — voix. Trois couches indépendantes :
   1. cleanForSpeech + planProsody : texte → segments avec rythme, hauteur et pauses selon le contexte (info, réussite, confirmation, erreur, urgence) ;
   2. moteurs interchangeables : « browser » (SpeechSynthesis) ou « gateway » (voix neuronale côté serveur : OpenAI / ElevenLabs) ;
   3. spectre de sortie pour l'onde : réel (AnalyserNode) avec la passerelle, simulé à partir des événements de mots avec le navigateur.
   Changer de moteur = ajouter une fonction speakXxx et une ligne dans pickEngine(). */
import { getSettings } from './storage.js';
import { audioContext, makeAnalyser } from './audio.js';
import * as gateway from './gateway.js';
import { bus, clamp, sleep } from './util.js';
export const STYLES = {
  chat: { rate: 1.0, pitch: 1.0, pause: 280, instr: 'ton calme, naturel et chaleureux, rythme posé avec de légères pauses' },
  info: { rate: 0.98, pitch: 1.0, pause: 300, instr: 'ton clair et posé, informatif, articulation nette' },
  success: { rate: 1.04, pitch: 1.06, pause: 240, instr: 'ton léger et satisfait, un peu plus vif, sourire dans la voix' },
  confirm: { rate: 0.94, pitch: 1.04, pause: 340, instr: 'ton attentif et légèrement interrogatif, courte pause avant la question' },
  error: { rate: 0.92, pitch: 0.92, pause: 340, instr: 'ton sobre et désolé, plus lent, sans dramatiser' },
  urgent: { rate: 1.12, pitch: 1.04, pause: 150, instr: 'ton net et soutenu, plus rapide, sans panique' }
};
export function cleanForSpeech(t) {
  return String(t).replace(/G\.E\.N\.I\.S/gi, 'Génis').replace(/\bGENIS\b/g, 'Génis').replace(/```[\s\S]*?```/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, 'lien')
    .replace(/(\d+)\s*°C/g, '$1 degrés').replace(/(\d+)\s*€/g, '$1 euros').replace(/(\d+)\s*km\/h/g, '$1 kilomètres par heure').replace(/(\d+)\s*km\b/g, '$1 kilomètres').replace(/(\d+)\s*%/g, '$1 pour cent')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/[*_#>`~|]+/g, ' ').replace(/\s+/g, ' ').trim();
}
export function planProsody(text, style = 'info', base = {}, expressive = true) {
  const st = STYLES[style] || STYLES.info, out = [];
  (text.match(/[^.!?…]+[.!?…]*/g) || [text]).map(s => s.trim()).filter(Boolean).forEach((s, si) => {
    const parts = s.length > 110 ? s.match(/[^,;:]+[,;:]?/g).map(p => p.trim()).filter(Boolean) : [s];
    parts.forEach((p, pi) => {
      const last = pi === parts.length - 1, q = last && /\?$/.test(p), ex = last && /!$/.test(p);
      out.push(expressive
        ? { text: p, rate: st.rate * (si + pi === 0 ? 0.97 : 1) * (q ? 0.96 : 1) * (ex ? 1.04 : 1), pitch: st.pitch + (q ? 0.1 : 0) + (ex ? 0.05 : 0) - Math.min(pi, 3) * 0.012, pause: last ? st.pause * (q ? 1.2 : 1) : 130 }
        : { text: p, rate: 1, pitch: 1, pause: last ? 220 : 90 });
    });
  });
  if (out.length) out[out.length - 1].pause = 0;
  return out.map(s => ({ ...s, rate: clamp(s.rate * (base.rate || 1), 0.6, 1.6), pitch: clamp(s.pitch * (base.pitch || 1), 0.5, 1.6) }));
}
export function scoreVoice(v, lang = 'fr') {
  if (!String(v.lang || '').toLowerCase().startsWith(lang)) return -1;
  const n = `${v.name} ${v.voiceURI}`.toLowerCase(); let s = 0;
  if (/natural|neural|online|enhanced|premium|siri|wavenet/.test(n)) s += 5; if (/google/.test(n)) s += 2; if (v.localService === false) s += 1;
  if (/denise|eloise|vivienne|hortense|am[ée]lie|audrey|aur[ée]lie|marie|julie|claire|l[ée]a\b|female|femme/.test(n)) s += 2; if (/fr[-_]fr/i.test(v.lang)) s += 1;
  return s;
}
let ctrl = null, speaking = false, gatewayOk = false, playing = null, talk = false;
const synth = { kick: 0, lvl: 0, t: 0 }, keep = [];
const synthFill = out => {
  synth.t += 0.016; synth.kick *= 0.9; synth.lvl += ((talk ? 0.28 + 0.55 * synth.kick : 0.04) - synth.lvl) * 0.25;
  const osc = 0.65 + 0.35 * Math.sin(synth.t * 31);
  for (let i = 0; i < 64; i++) out[i] = clamp(255 * synth.lvl * osc * Math.exp(-i / 26) * (0.7 + 0.3 * Math.sin(synth.t * 9 + i * 1.7)), 0, 255);
};
function pickVoice(s) { const vs = globalThis.speechSynthesis?.getVoices?.() || []; return vs.find(v => v.name === s.voiceName) || vs.map(v => [v, scoreVoice(v)]).filter(x => x[1] >= 0).sort((a, b) => b[1] - a[1])[0]?.[0] || null; }
async function speakBrowser(text, style, sig, s) {
  if (!globalThis.speechSynthesis) return;
  const voice = pickVoice(s);
  for (const seg of planProsody(text, style, { rate: s.speechRate, pitch: s.speechPitch }, s.emotion)) {
    if (sig.aborted) return;
    await new Promise(res => {
      const u = new SpeechSynthesisUtterance(seg.text); keep.push(u); if (keep.length > 8) keep.shift();
      u.lang = s.lang || 'fr-FR'; u.rate = seg.rate; u.pitch = seg.pitch; u.volume = s.volume; if (voice) u.voice = voice;
      u.onstart = () => { talk = true; synth.kick = 1; }; u.onboundary = () => { synth.kick = 1; }; u.onend = u.onerror = () => { talk = false; res(); };
      sig.addEventListener('abort', () => { speechSynthesis.cancel(); talk = false; res(); }, { once: true }); speechSynthesis.speak(u);
    });
    if (seg.pause) await sleep(seg.pause, sig).catch(() => {});
  }
}
const chunks = (t, max = 900) => { const out = []; let cur = ''; for (const s of t.match(/[^.!?…]+[.!?…]*/g) || [t]) { if ((cur + s).length > max && cur) { out.push(cur.trim()); cur = ''; } cur += s; } if (cur.trim()) out.push(cur.trim()); return out; };
async function speakGateway(text, style, sig, s) {
  const ctx = audioContext(); if (!ctx) throw new Error('Pas de contexte audio.'); if (ctx.state === 'suspended') await ctx.resume();
  const fetchBuf = async c => { const ab = await gateway.tts({ text: c, style, signal: sig }); return new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)); };
  const parts = chunks(text); let next = fetchBuf(parts[0]);
  for (let i = 0; i < parts.length; i++) {
    const buf = await next; if (sig.aborted) return; if (i + 1 < parts.length) next = fetchBuf(parts[i + 1]);
    await new Promise(res => {
      const src = ctx.createBufferSource(), gain = ctx.createGain(), an = makeAnalyser(256); src.buffer = buf; src.playbackRate.value = clamp(s.speechRate, 0.7, 1.4); gain.gain.value = s.volume;
      src.connect(gain).connect(an).connect(ctx.destination); playing = { an, buf: new Uint8Array(an.frequencyBinCount) };
      src.onended = () => { playing = null; res(); }; sig.addEventListener('abort', () => { try { src.stop(); } catch {} }, { once: true }); src.start();
    });
  }
}
const pickEngine = s => (s.ttsEngine === 'gateway' ? 'gateway' : s.ttsEngine === 'browser' ? 'browser' : gateway.isConfigured() && gatewayOk ? 'gateway' : 'browser');
export const tts = {
  get speaking() { return speaking; },
  setGatewayAvailable(v) { gatewayOk = !!v; },
  voices: () => (globalThis.speechSynthesis?.getVoices?.() || []).filter(v => /^fr/i.test(v.lang)).sort((a, b) => scoreVoice(b) - scoreVoice(a)),
  stop() { ctrl?.abort(); try { globalThis.speechSynthesis?.cancel(); } catch {} speaking = false; talk = false; },
  fillSpectrum(out) { if (playing) { playing.an.getByteFrequencyData(playing.buf); for (let i = 0; i < 64; i++) out[i] = playing.buf[i]; } else synthFill(out); },
  async speak(text, { style = 'info' } = {}) {
    const s = getSettings(), clean = cleanForSpeech(text); if (!clean) return;
    this.stop(); ctrl = new AbortController(); const sig = ctrl.signal; speaking = true; bus.emit('visual', { state: 'speaking' });
    try {
      if (pickEngine(s) === 'gateway') { try { await speakGateway(clean, style, sig, s); } catch (e) { if (sig.aborted) return; gatewayOk = false; bus.emit('toast', { message: 'Voix de la passerelle indisponible : voix du navigateur utilisée.', kind: 'warn' }); await speakBrowser(clean, style, sig, s); } }
      else await speakBrowser(clean, style, sig, s);
    } finally { speaking = false; talk = false; bus.emit('speech:end'); }
  }
};
