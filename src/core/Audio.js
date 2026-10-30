// Procedural Web Audio: no sound files. Crowd bed, kicks, net, post, whistle,
// roar, groan and the shot-freeze whoosh. iOS needs unlock() from a user gesture.

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.crowdLevel = 0.25;
    this._crowdTarget = 0.25;
    try { this.muted = localStorage.getItem('am_muted') === '1'; } catch (_) { /* ignore */ }
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this._build();
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('am_muted', m ? '1' : '0'); } catch (_) { /* ignore */ }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  _build() {
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(c.destination);

    // Shared noise buffers
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Brown-ish noise for the crowd bed
    this.brown = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const b = this.brown.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        b[i] = last * 3.5;
      }
    }

    // Crowd bed: brown + band-passed noise with slow swells
    const src = c.createBufferSource();
    src.buffer = this.brown; src.loop = true;
    const src2 = c.createBufferSource();
    src2.buffer = this.noise; src2.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.7;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1600;
    const n2g = c.createGain(); n2g.gain.value = 0.06;
    this.crowdGain = c.createGain();
    this.crowdGain.gain.value = 0;
    src.connect(lp); src2.connect(bp).connect(n2g).connect(lp);
    lp.connect(this.crowdGain).connect(this.master);
    // Slow swell LFO
    const lfo = c.createOscillator(); lfo.frequency.value = 0.13;
    const lfoG = c.createGain(); lfoG.gain.value = 0.05;
    lfo.connect(lfoG).connect(this.crowdGain.gain);
    src.start(); src2.start(); lfo.start();
    this.crowdFilter = lp;
  }

  /** 0..1 excitement: rises as the attack nears the box. */
  setCrowd(level) {
    this._crowdTarget = level;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.crowdGain.gain.setTargetAtTime(0.16 + level * 0.32, t, 0.6);
    this.crowdFilter.frequency.setTargetAtTime(1200 + level * 1600, t, 0.6);
  }

  _env(gainNode, t, a, peak, decay) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + a);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
  }

  _noiseBurst({ type = 'bandpass', freq = 1000, q = 1, peak = 0.5, attack = 0.005, decay = 0.2, sweepTo = null, dur = null }) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + (dur || attack + decay));
    const g = c.createGain();
    this._env(g, t, attack, peak, decay);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 1.5);
    s.stop(t + attack + decay + 0.05);
  }

  _tone({ freq = 440, to = null, type = 'sine', peak = 0.3, attack = 0.005, decay = 0.2, delay = 0 }) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
    const g = c.createGain();
    this._env(g, t, attack, peak, decay);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + attack + decay + 0.05);
  }

  kick(power = 0.5) {
    const p = Math.max(0.1, Math.min(1, power));
    this._tone({ freq: 140 + p * 60, to: 45, peak: 0.25 + p * 0.45, decay: 0.09 + p * 0.06 });
    this._noiseBurst({ type: 'lowpass', freq: 1800 + p * 2500, peak: 0.12 + p * 0.25, decay: 0.05 + p * 0.04 });
  }

  touch() {
    this._tone({ freq: 120, to: 60, peak: 0.08, decay: 0.05 });
  }

  net() {
    this._noiseBurst({ type: 'highpass', freq: 2500, q: 0.5, peak: 0.35, attack: 0.02, decay: 0.45, sweepTo: 900 });
  }

  post() {
    [523, 1187, 1793, 2650].forEach((f, i) =>
      this._tone({ freq: f, type: i === 0 ? 'triangle' : 'sine', peak: 0.22 / (i + 1), decay: 0.9 - i * 0.15 }));
    this._noiseBurst({ type: 'bandpass', freq: 3000, peak: 0.2, decay: 0.05 });
  }

  whistle(long = false) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const dur = long ? 0.9 : 0.35;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 2900;
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 3150;
    const lfo = c.createOscillator(); lfo.frequency.value = 38;
    const lg = c.createGain(); lg.gain.value = 140;
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    g.gain.setValueAtTime(0.16, t + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o2.connect(g); g.connect(this.master);
    [o, o2, lfo].forEach((n) => { n.start(t); n.stop(t + dur + 0.05); });
  }

  roar() {
    this._noiseBurst({ type: 'bandpass', freq: 600, q: 0.6, peak: 0.7, attack: 0.25, decay: 3.2, sweepTo: 1100, dur: 1.2 });
    this._noiseBurst({ type: 'bandpass', freq: 1800, q: 1.2, peak: 0.25, attack: 0.3, decay: 2.5 });
  }

  groan() {
    this._noiseBurst({ type: 'bandpass', freq: 900, q: 1.5, peak: 0.4, attack: 0.15, decay: 1.4, sweepTo: 280, dur: 1.4 });
  }

  ooh() {
    this._noiseBurst({ type: 'bandpass', freq: 500, q: 2, peak: 0.35, attack: 0.2, decay: 1.0, sweepTo: 800, dur: 0.5 });
  }

  whoosh() {
    this._noiseBurst({ type: 'bandpass', freq: 1400, q: 1.2, peak: 0.3, attack: 0.06, decay: 0.45, sweepTo: 180, dur: 0.5 });
  }

  click() { this._tone({ freq: 900, to: 600, type: 'triangle', peak: 0.08, decay: 0.04 }); }
}
