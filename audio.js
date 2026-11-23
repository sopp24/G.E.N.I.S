/* G.E.N.I.S — audio partagé : un seul AudioContext, déverrouillage mobile (geste utilisateur), carillons. */
let ctx = null;
export function audioContext() {
  if (!ctx) { const C = globalThis.AudioContext || globalThis.webkitAudioContext; if (!C) return null; ctx = new C(); }
  return ctx;
}
/** À appeler lors d'un geste utilisateur : iOS/Android n'autorisent la lecture audio qu'après une interaction. */
export async function unlockAudio() {
  const c = audioContext();
  try { if (c) { if (c.state === 'suspended') await c.resume(); const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0); } } catch {}
  try { const u = new SpeechSynthesisUtterance(''); u.volume = 0; speechSynthesis.speak(u); } catch {}
}
export function makeAnalyser(fft = 256) { const c = audioContext(); if (!c) return null; const a = c.createAnalyser(); a.fftSize = fft; a.smoothingTimeConstant = 0.78; return a; }
export function chime(kind = 'info') {
  const c = audioContext(); if (!c || c.state !== 'running') return;
  const notes = kind === 'error' ? [330, 247] : kind === 'success' ? [587, 880] : [523, 659];
  notes.forEach((f, i) => {
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * 0.14;
    o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.4);
  });
}
