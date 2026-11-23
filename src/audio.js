// ---------------------------------------------------------------------------
// Audio: all sound is synthesized with Web Audio. No external files.
// ---------------------------------------------------------------------------
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.noiseBuffer = null;
    this.enabled = true;
    this.music = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.started = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.85 : 0;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.6;
      this.sfxGain.connect(this.master);
      this.noiseBuffer = this._makeNoise();
      this.started = true;
      if (this.music) this._startScheduler();
    } catch {
      this.ctx = null;
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.03);
    if (!on) this._stopScheduler();
    else if (this.music) this._startScheduler();
  }

  setMusic(mode) {
    if (this.music === mode) return;
    this.music = mode;
    if (!this.ctx || !this.enabled) return;
    this._stopScheduler();
    if (mode) this._startScheduler();
  }

  _makeNoise() {
    const len = Math.floor(this.ctx.sampleRate * 1.5);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) * 0.995;
      data[i] = white * 0.7 + last * 2.2;
    }
    return buf;
  }

  // ---- low-level helpers -------------------------------------------------
  _env(gain, time, attack, hold, release, peak = 1) {
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + attack);
    gain.gain.setValueAtTime(Math.max(0.0002, peak), time + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + hold + release);
  }

  tone({ freq = 440, type = 'sine', dur = 0.16, gain = 0.25, slide = 1, delay = 0, dest = null, attack = 0.006 }) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest || this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  noise({ dur = 0.2, gain = 0.2, freq = 900, q = 0.8, type = 'bandpass', delay = 0, slide = null, dest = null }) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(freq, t);
    if (slide) filt.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    filt.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(dest || this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  // ---- game sounds -------------------------------------------------------
  hit(damage = 8, heavy = false) {
    if (!this.ctx) return;
    const d = Math.min(1, 0.4 + damage / 26);
    this.tone({ freq: heavy ? 130 : 190, slide: heavy ? 0.42 : 0.55, type: 'triangle', dur: 0.16 + d * 0.12, gain: 0.34 * d });
    this.noise({ dur: 0.12 + d * 0.1, gain: 0.27 * d, freq: heavy ? 700 : 1400, q: 0.7, slide: heavy ? 160 : 420 });
    this.tone({ freq: heavy ? 60 : 90, slide: 0.5, type: 'sine', dur: 0.2, gain: 0.24 * d });
    if (heavy) this.noise({ dur: 0.45, gain: 0.14, freq: 2600, q: 0.5, type: 'highpass' });
  }
  whiff() { this.noise({ dur: 0.1, gain: 0.08, freq: 1200, slide: 3200, q: 1.4, type: 'bandpass' }); }
  shieldHit() {
    this.tone({ freq: 620, slide: 1.35, type: 'sine', dur: 0.18, gain: 0.22 });
    this.noise({ dur: 0.14, gain: 0.11, freq: 3200, q: 2, type: 'bandpass' });
  }
  shieldBreak() {
    this.tone({ freq: 900, slide: 0.25, type: 'sawtooth', dur: 0.5, gain: 0.2 });
    this.noise({ dur: 0.5, gain: 0.24, freq: 2400, slide: 300, q: 0.9 });
  }
  jump() { this.tone({ freq: 300, slide: 1.9, type: 'sine', dur: 0.12, gain: 0.12 }); }
  doubleJump() {
    this.tone({ freq: 460, slide: 1.8, type: 'triangle', dur: 0.18, gain: 0.14 });
    this.noise({ dur: 0.18, gain: 0.05, freq: 2600, slide: 5200, q: 1.6 });
  }
  land(force = 1) {
    this.noise({ dur: 0.14, gain: 0.11 * Math.min(1.6, force), freq: 320, slide: 100, type: 'lowpass' });
  }
  dodge() { this.noise({ dur: 0.16, gain: 0.1, freq: 900, slide: 2400, q: 1.2 }); }
  ko() {
    this.noise({ dur: 1.1, gain: 0.34, freq: 1200, slide: 70, q: 0.6, type: 'lowpass' });
    this.tone({ freq: 170, slide: 0.22, type: 'sawtooth', dur: 0.9, gain: 0.26 });
    this.tone({ freq: 70, slide: 0.3, type: 'sine', dur: 1.2, gain: 0.32 });
    this.noise({ dur: 1.4, gain: 0.1, freq: 2200, q: 0.4, delay: 0.12 });
    this.tone({ freq: 880, slide: 1.5, type: 'square', dur: 0.35, gain: 0.07, delay: 0.05 });
  }
  rise() {
    this.tone({ freq: 220, slide: 2.8, type: 'triangle', dur: 0.35, gain: 0.16 });
    this.noise({ dur: 0.35, gain: 0.1, freq: 800, slide: 3000, q: 1.1 });
  }
  projectile(kind) {
    if (kind === 'fireball') {
      this.noise({ dur: 0.3, gain: 0.16, freq: 900, slide: 240, q: 0.8 });
      this.tone({ freq: 330, slide: 0.7, type: 'sawtooth', dur: 0.2, gain: 0.08 });
    } else if (kind === 'bolt') {
      this.tone({ freq: 1400, slide: 0.32, type: 'square', dur: 0.2, gain: 0.1 });
      this.noise({ dur: 0.12, gain: 0.09, freq: 4200, q: 2 });
    } else if (kind === 'ice') {
      this.tone({ freq: 1100, slide: 1.5, type: 'sine', dur: 0.25, gain: 0.1 });
      this.tone({ freq: 1650, slide: 1.2, type: 'triangle', dur: 0.18, gain: 0.06 });
    } else if (kind === 'seed') {
      this.tone({ freq: 520, slide: 1.7, type: 'triangle', dur: 0.16, gain: 0.13 });
    }
  }
  counter() {
    this.tone({ freq: 760, slide: 1.4, type: 'square', dur: 0.22, gain: 0.12 });
    this.tone({ freq: 1520, slide: 1.2, type: 'sine', dur: 0.3, gain: 0.08 });
    this.noise({ dur: 0.25, gain: 0.12, freq: 1800, slide: 4200, q: 2 });
  }
  charge(level = 0) {
    this.tone({ freq: 200 + level * 6, slide: 1.25, type: 'triangle', dur: 0.1, gain: 0.045 + level * 0.001 });
  }
  beep(final = false) {
    this.tone({ freq: final ? 700 : 440, type: 'sine', dur: final ? 0.3 : 0.1, gain: 0.15 });
    this.tone({ freq: final ? 1050 : 660, type: 'triangle', dur: final ? 0.32 : 0.1, gain: 0.06 });
  }
  announce() {
    this.tone({ freq: 260, slide: 1.5, type: 'sawtooth', dur: 0.3, gain: 0.12 });
    this.tone({ freq: 520, slide: 1.4, type: 'square', dur: 0.35, gain: 0.05, delay: 0.03 });
  }
  click() {
    this.tone({ freq: 640, slide: 1.25, type: 'sine', dur: 0.06, gain: 0.08 });
  }
  hover() {
    this.tone({ freq: 880, type: 'sine', dur: 0.035, gain: 0.028 });
  }
  win() {
    [0, 4, 7, 12, 16].forEach((n, i) => {
      this.tone({ freq: NOTE(69 + n), type: 'triangle', dur: 0.35, gain: 0.15, delay: i * 0.1 });
      this.tone({ freq: NOTE(57 + n), type: 'sine', dur: 0.5, gain: 0.09, delay: i * 0.1 });
    });
  }

  // ---- music -------------------------------------------------------------
  _startScheduler() {
    if (this.timer) return;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.step = 0;
    this.timer = setInterval(() => this._pump(), 60);
  }
  _stopScheduler() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  _pump() {
    if (!this.ctx || !this.enabled || !this.music) return;
    const tempo = this.music === 'battle' ? 152 : 96;
    const stepDur = 60 / tempo / 2; // eighth notes
    while (this.nextTime < this.ctx.currentTime + 0.22) {
      this._playStep(this.step, this.nextTime, this.music, stepDur);
      this.nextTime += stepDur;
      this.step++;
      if (this.step > 9999) this.step = 0;
    }
  }

  _playStep(step, t, mode, dur) {
    if (!this.ctx) return;
    const dest = this.musicGain;
    const note = (freq, type, len, gain, when = t, slide = 1) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, when);
      if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(freq * slide, when + len);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(gain, when + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, when + len);
      osc.connect(g); g.connect(dest); osc.start(when); osc.stop(when + len + 0.02);
    };
    const drum = (kind, when) => {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const f = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      if (kind === 'kick') {
        f.type = 'lowpass'; f.frequency.value = 180;
        g.gain.setValueAtTime(0.25, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.13);
      } else if (kind === 'hat') {
        f.type = 'highpass'; f.frequency.value = 6500;
        g.gain.setValueAtTime(0.035, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
      } else {
        f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7;
        g.gain.setValueAtTime(0.1, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
      }
      src.connect(f); f.connect(g); g.connect(dest);
      src.start(when); src.stop(when + 0.16);
    };

    if (mode === 'menu') {
      const bar = Math.floor(step / 8) % 4;
      const roots = [45, 41, 48, 43]; // Am F C G
      const chords = [[69, 72, 76], [65, 69, 72], [72, 76, 79], [67, 71, 74]];
      if (step % 8 === 0) {
        note(NOTE(roots[bar] - 12), 'triangle', dur * 7.4, 0.075);
        note(NOTE(chords[bar][0] - 12), 'sine', dur * 7.4, 0.035);
      }
      if (step % 2 === 0) {
        const arp = chords[bar][(step / 2) % 3];
        note(NOTE(arp), 'sine', 0.55, 0.028);
        note(NOTE(arp + 12), 'triangle', 0.5, 0.011);
      }
      if (step % 16 === 0) note(NOTE(roots[bar] + 12), 'sine', 1.1, 0.045);
    } else {
      const bar = Math.floor(step / 8) % 4;
      const roots = [45, 45, 43, 41];
      const lead = [69, 72, 76, 74, 76, 79, 76, 72];
      const bassPattern = [0, 0, 12, 0, 0, 7, 0, 12];
      if (step % 8 === 0 || step % 8 === 4) drum('kick', t);
      if (step % 2 === 1) drum('hat', t);
      if (step % 8 === 3 || step % 8 === 7) drum('snare', t);
      const b = roots[bar] + bassPattern[step % 8];
      note(NOTE(b - 12), 'sawtooth', dur * 0.8, 0.07);
      if (step % 2 === 0) {
        const l = lead[(step + bar * 3) % lead.length];
        note(NOTE(l), 'square', dur * 0.65, 0.025);
        note(NOTE(l + 12), 'triangle', dur * 0.4, 0.012);
      }
      if (step % 8 === 0) note(NOTE(roots[bar] + 24), 'triangle', dur * 2.2, 0.02);
    }
  }
}

export const audio = new AudioEngine();
