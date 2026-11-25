/* G.E.N.I.S — l'onde centrale. Contour organique de type ferrofluide : N points reliés par des ressorts amortis, déformés par le spectre audio réel
   (micro ou voix de synthèse) ou par une enveloppe simulée. Canvas 2D, un seul tracé Path2D par image, qualité adaptative sur mobile. */
const N = 112, TAU = Math.PI * 2;
const PROFILE = { idle: { gain: 0, k: 70, d: 9, breathe: 0.022, swirl: 0 }, listening: { gain: 1, k: 170, d: 12, breathe: 0.016, swirl: 0 }, understanding: { gain: 0.6, k: 200, d: 14, breathe: 0.01, swirl: 0 }, thinking: { gain: 0, k: 110, d: 10, breathe: 0.012, swirl: 1 }, speaking: { gain: 1.2, k: 150, d: 10.5, breathe: 0.016, swirl: 0 }, error: { gain: 0, k: 220, d: 8, breathe: 0, swirl: 0 }, confirm: { gain: 0, k: 90, d: 8, breathe: 0.03, swirl: 0 } };
const RING = { listening: '155,215,255', confirm: '242,196,109', error: '242,118,109' };
export class Waveform {
  constructor(canvas) {
    this.c = canvas; this.x = canvas.getContext('2d'); this.state = 'idle'; this.micOn = false; this.source = null; this.intensity = 1; this.reduced = false;
    this.r = new Float32Array(N); this.v = new Float32Array(N); this.t = new Float32Array(N); this.spec = new Uint8Array(64);
    this.time = 0; this.rot = 0; this.enter = 0; this.level = 0; this.bass = 0; this.hi = 0; this.kick = 0; this.running = false; this.low = false; this.frames = 0; this.acc = 0; this.last = 0;
    this.dpr = 1; this.w = 0; this.h = 0;
    this.loop = this.loop.bind(this);
    this.ro = globalThis.ResizeObserver ? new ResizeObserver(() => this.resize()) : null; this.ro?.observe(canvas.parentElement || canvas);
    globalThis.document?.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.start()));
    this.resize();
  }
  setState(s) { if (s !== this.state && PROFILE[s]) { this.state = s; this.enter = this.time; if (s === 'error') this.kick = 1; } }
  setMic(on) { this.micOn = !!on; }
  setSource(fn) { this.source = fn; }
  setIntensity(v) { this.intensity = Math.max(0.3, Math.min(1.6, v)); }
  setReduced(v) { this.reduced = !!v; }
  pulse(a = 1) { this.kick = Math.max(this.kick, a); }
  resize() {
    const p = this.c.parentElement || this.c, w = Math.max(1, p.clientWidth), h = Math.max(1, p.clientHeight);
    this.dpr = this.low ? 1 : Math.min(globalThis.devicePixelRatio || 1, 2); this.w = w; this.h = h;
    this.c.width = Math.round(w * this.dpr); this.c.height = Math.round(h * this.dpr); this.c.style.width = w + 'px'; this.c.style.height = h + 'px';
  }
  start() { if (this.running) return; this.running = true; this.last = performance.now(); cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(this.loop); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  bands() {
    const s = this.spec, avg = (a, b) => { let t = 0; for (let i = a; i < b; i++) t += s[i]; return t / ((b - a) * 255); };
    this.bass = avg(0, 6); this.hi = avg(24, 64); this.level = this.bass * 0.5 + avg(6, 24) * 0.35 + this.hi * 0.15;
  }
  step(dt) {
    const P = PROFILE[this.state], t = this.time, amp = (this.reduced ? 0.35 : 1) * this.intensity, cold = !this.micOn && this.state === 'idle';
    if (this.source && P.gain) this.source(this.spec); else for (let i = 0; i < 64; i++) this.spec[i] *= 0.85;
    this.bands(); this.kick *= Math.pow(0.04, dt);
    const age = t - this.enter, rot = this.reduced ? 0 : (this.rot += dt * (P.swirl ? 0.5 : 0.06)), shift = Math.floor(t * 5) % N;
    for (let i = 0; i < N; i++) {
      const th = i / N * TAU, folded = (i + shift) % N, idx = Math.min(63, Math.floor((folded < N / 2 ? folded : N - folded) / (N / 2) * 46));
      let tg = Math.pow(this.spec[idx] / 255, 1.45) * 0.62 * P.gain * amp;
      tg += (0.03 * Math.sin(3 * th + t * 0.7) + 0.02 * Math.sin(5 * th - t * 1.1) + 0.014 * Math.sin(2 * th + t * 0.4)) * amp * (cold ? 0.5 : 1);
      tg += P.breathe * Math.sin(t * (this.state === 'confirm' ? 3 : 0.9)) * amp;
      if (P.swirl) tg += (Math.pow(Math.max(0, Math.cos(th - t * 2.2)), 5) * 0.17 + Math.pow(Math.max(0, Math.cos(th - t * 2.2 + Math.PI)), 5) * 0.09) * amp;
      if (this.state === 'understanding') tg -= 0.1 * Math.max(0, 1 - age * 2.2) * amp;
      if (this.state === 'error') tg += (Math.random() - 0.5) * 0.11 * Math.max(0, 1 - age * 1.6) * amp;
      tg += this.kick * 0.05 * Math.sin(th * 9 + t * 12);
      this.t[i] = tg;
    }
    const sub = dt > 0.034 ? 2 : 1, h = dt / sub;
    for (let s = 0; s < sub; s++) for (let i = 0; i < N; i++) { const a = (this.t[i] - this.r[i]) * P.k - this.v[i] * P.d; this.v[i] += a * h; this.r[i] += this.v[i] * h; }
    const d = 0.1 + 0.14 * (1 - Math.min(1, this.hi * 3)), tmp = this.t; // diffusion : lisse les aiguilles quand les aigus sont faibles
    for (let i = 0; i < N; i++) tmp[i] = this.r[i] * (1 - 2 * d) + (this.r[(i + N - 1) % N] + this.r[(i + 1) % N]) * d;
    this.r.set(tmp); this.rotNow = rot;
  }
  draw() {
    const { x, w, h, dpr } = this, reserve = h < 330 ? 36 : 250, free = Math.max(120, h - reserve); // la zone basse est réservée à la légende et au micro
    const base = Math.min(Math.min(w, h) * 0.27, free * 0.4) * (this.micOn || this.state !== 'idle' ? 1 : 0.9) * (1 + this.bass * 0.06), cx = w / 2, cy = Math.max(base * 1.3, free / 2 + (reserve > 100 ? 20 : 0));
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    const pts = new Array(N);
    for (let i = 0; i < N; i++) { const a = i / N * TAU + this.rotNow, rr = base * (1 + this.r[i]); pts[i] = [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; }
    const path = new Path2D(), mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], m0 = mid(pts[N - 1], pts[0]);
    path.moveTo(m0[0], m0[1]);
    for (let i = 0; i < N; i++) { const p = pts[i], m = mid(p, pts[(i + 1) % N]); path.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
    path.closePath();
    const alpha = !this.micOn && this.state === 'idle' ? 0.5 : 1, ring = RING[this.state] || (this.micOn && this.state === 'idle' ? RING.listening : '');
    if (ring) { x.strokeStyle = `rgba(${ring},${0.22 + this.level * 0.35})`; x.lineWidth = 1.5; x.beginPath(); x.arc(cx, cy, base * (1.36 + this.level * 0.12 + (this.state === 'confirm' ? 0.03 * Math.sin(this.time * 3) : 0)), 0, TAU); x.stroke(); }
    if (!this.low) for (const [s, a] of [[1.16, 0.035], [1.08, 0.06]]) { x.save(); x.translate(cx, cy); x.scale(s, s); x.translate(-cx, -cy); x.globalAlpha = a * alpha; x.fillStyle = '#fff'; x.fill(path); x.restore(); }
    const g = x.createRadialGradient(cx - base * 0.25, cy - base * 0.32, base * 0.05, cx, cy, base * 1.45);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#e9eef1'); g.addColorStop(1, '#9ea8b0');
    x.globalAlpha = alpha; x.fillStyle = g; x.fill(path);
    const hl = x.createRadialGradient(cx - base * 0.3, cy - base * 0.38, 0, cx - base * 0.3, cy - base * 0.38, base * 0.42);
    hl.addColorStop(0, 'rgba(255,255,255,.75)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = hl; x.fill(path);
    if (this.state === 'error') { x.strokeStyle = 'rgba(242,118,109,.7)'; x.lineWidth = 2; x.stroke(path); }
    x.globalAlpha = 1;
  }
  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016); this.last = now; this.time += dt;
    this.step(dt); this.draw();
    this.acc += dt; this.frames++;
    if (this.frames === 90) { if (this.acc / 90 > 0.026 && !this.low) { this.low = true; this.resize(); } this.frames = 0; this.acc = 0; }
    this.raf = requestAnimationFrame(this.loop);
  }
}
