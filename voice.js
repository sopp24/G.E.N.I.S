/* G.E.N.I.S — écoute. Reconnaissance vocale du navigateur (Web Speech API) ; repli : enregistrement + transcription par la passerelle (Firefox, Brave…).
   Le microphone n'est ouvert que lorsque l'utilisateur l'active ; stop() ferme réellement le flux (voyant du navigateur éteint). */
import { audioContext, makeAnalyser } from './audio.js';
import { getSettings } from './storage.js';
import { isIOS, coded } from './util.js';
import * as gateway from './gateway.js';
const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
export const sttMode = () => (SR ? 'browser' : gateway.isConfigured() && globalThis.MediaRecorder ? 'gateway' : 'none');
export class Listener {
  constructor(h) { this.h = h; this.wanted = false; this.paused = false; this.rec = null; this.stream = null; this.an = null; this.src = null; this.buf = null; this.synth = 0; this.timer = 0; this.gw = null; this.starting = false; this.gen = 0; }
  get active() { return this.wanted; }
  async openMeter(required) {
    const s = getSettings(); if (!required && (s.micVisualizer === 'off' || (s.micVisualizer === 'auto' && isIOS()))) return; // iOS : reconnaissance et capture simultanées instables
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const ctx = audioContext(); if (!ctx) return; if (ctx.state === 'suspended') await ctx.resume();
    this.an = makeAnalyser(256); this.src = ctx.createMediaStreamSource(this.stream); this.src.connect(this.an); this.buf = new Uint8Array(this.an.frequencyBinCount);
  }
  async start() {
    if (this.wanted || this.starting) return; const mode = sttMode(), gen = this.gen;
    if (mode === 'none') throw coded('STT_UNSUPPORTED', 'Ce navigateur ne propose pas la reconnaissance vocale : écrivez votre demande, ou connectez la passerelle pour la transcription.');
    this.starting = true;
    try { await this.openMeter(mode === 'gateway'); }
    catch (e) { this.starting = false; if (mode === 'gateway' || e?.name === 'NotAllowedError' || e?.name === 'SecurityError') { this.teardown(); throw coded('MIC_DENIED', 'Le navigateur a refusé l’accès au microphone : autorisez-le dans les réglages du site.'); } this.teardown(); /* l’analyseur est facultatif avec la reconnaissance du navigateur */ }
    this.starting = false; if (gen !== this.gen) { this.teardown(); return; } // stop() appelé pendant l’ouverture du micro : on ne le rouvre pas
    this.wanted = true; this.paused = false; mode === 'browser' ? this.startBrowser() : this.startGateway(); this.h.onEvent?.('start');
  }
  startBrowser() {
    const rec = new SR(); rec.lang = getSettings().lang || 'fr-FR'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onresult = e => {
      let interim = '', fin = '';
      for (let i = e.resultIndex; i < e.results.length; i++) (e.results[i].isFinal ? (fin += e.results[i][0].transcript) : (interim += e.results[i][0].transcript));
      if (interim) { this.synth = 0.9; this.h.onInterim?.(interim.trim()); }
      if (fin.trim()) { this.synth = 0.5; this.h.onFinal?.(fin.trim()); }
    };
    rec.onerror = e => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') return this.fail('Le navigateur a refusé l’accès au microphone.');
      if (e.error === 'audio-capture') return this.fail('Aucun microphone détecté.');
      if (e.error === 'network') return this.fail('La reconnaissance vocale du navigateur est injoignable (réseau).');
      this.h.onEvent?.('error', e.error);
    };
    rec.onend = () => { if (this.wanted && !this.paused) setTimeout(() => { if (!this.wanted || this.paused || this.rec !== rec) return; try { rec.start(); } catch { this.fail('Touchez le micro pour reprendre l’écoute (limite du navigateur).'); } }, 250); };
    this.rec = rec; try { rec.start(); } catch { this.fail('Impossible de démarrer la reconnaissance vocale.'); }
  }
  startGateway() {
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || '';
    let rec = null, chunks = [], speaking = false, lastVoice = 0, since = Date.now();
    const begin = () => { chunks = []; since = Date.now(); rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined); rec.ondataavailable = e => e.data.size && chunks.push(e.data); rec.start(); };
    const finish = send => new Promise(res => { if (!rec || rec.state === 'inactive') return res(null); rec.onstop = () => res(send ? new Blob(chunks, { type: rec.mimeType }) : null); rec.stop(); });
    this.gw = { begin, end: () => finish(false) }; begin();
    this.timer = setInterval(async () => {
      if (!this.wanted || this.paused) return;
      try {
      const lvl = this.rms(), now = Date.now();
      if (lvl > 0.04) { lastVoice = now; if (!speaking) { speaking = true; this.synth = 0.8; this.h.onInterim?.('…'); } }
      if (speaking && now - lastVoice > 900) {
        speaking = false; const blob = await finish(true); begin();
        if (blob?.size > 2000) try { const r = await gateway.stt(blob); if (r?.text?.trim()) this.h.onFinal?.(r.text.trim()); } catch (e) { this.h.onEvent?.('error', e.userMessage || 'Transcription indisponible.'); }
      } else if (!speaking && now - since > 12000) { await finish(false); begin(); }
      } catch { this.fail('L’enregistrement audio a été interrompu : touchez le micro pour reprendre.'); }
    }, 80);
  }
  rms() { if (!this.an) return 0; const b = new Uint8Array(this.an.fftSize); this.an.getByteTimeDomainData(b); let s = 0; for (const x of b) s += ((x - 128) / 128) ** 2; return Math.sqrt(s / b.length); }
  /** Remplit le spectre (64 valeurs 0–255) pour l'onde : flux réel si disponible, sinon enveloppe simulée à partir des résultats. */
  fillSpectrum(out) {
    if (this.an && !this.paused) { this.an.getByteFrequencyData(this.buf); for (let i = 0; i < 64; i++) out[i] = this.buf[i]; return; }
    this.synth *= 0.94; for (let i = 0; i < 64; i++) out[i] = Math.max(0, 255 * this.synth * Math.exp(-i / 24) * (0.6 + 0.4 * Math.random()));
  }
  pause() { if (!this.wanted || this.paused) return; this.paused = true; if (this.rec && this.rec.abort) { this.rec.onend = null; try { this.rec.abort(); } catch {} } this.gw?.end(); }
  resume() { if (!this.wanted || !this.paused) return; this.paused = false; sttMode() === 'browser' ? this.startBrowser() : this.gw?.begin(); }
  fail(msg) { this.stop(msg); this.h.onEvent?.('fatal', msg); }
  teardown() { clearInterval(this.timer); try { this.rec?.abort?.(); } catch {} this.rec = null; this.stream?.getTracks().forEach(t => t.stop()); this.stream = null; try { this.src?.disconnect(); } catch {} this.src = null; this.an = null; this.gw?.end?.(); this.gw = null; }
  stop(reason = '') { const was = this.wanted; this.gen++; this.wanted = false; this.paused = false; this.teardown(); if (was) this.h.onEvent?.('stop', reason); }
}
