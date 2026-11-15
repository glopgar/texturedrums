// Granular sampler: a loop that travels through the sample (forward, reverse or ping-pong, with an LFO
// on each loop point) and up to four notes, each a stream of grains read from its own offset and pitch.
import { CK, NVOICE } from './params.js';

export const MAXG = 48;
const NKEY = [CK.g_n1, CK.g_n2, CK.g_n3, CK.g_n4], OKEY = [CK.g_o1, CK.g_o2, CK.g_o3, CK.g_o4];

export class Granular {
  constructor(sr, rnd) {
    this.sr = sr; this.rnd = rnd;
    this.buf = null; this.blen = 0; this.bsr = sr;
    this.gon = new Uint8Array(MAXG); this.gat = new Int32Array(MAXG);
    this.gpos = new Float64Array(MAXG); this.grate = new Float64Array(MAXG);
    this.gph = new Float64Array(MAXG); this.ginc = new Float64Array(MAXG);
    this.gl = new Float64Array(MAXG); this.gr = new Float64Array(MAXG);
    this.gls = new Float64Array(MAXG); this.gle = new Float64Array(MAXG);
    this.st = Array.from({ length: NVOICE }, () => ({ on: 0, stage: 0, env: 0, vel: 0.8, next: 0 }));
    this.note = 0; this.phase = 0; this.eff = 0; this.ls = 0; this.le = 1; this.count = 0;
    this.hold = false;               // true while the sequencer runs: drone notes sustain
    this.lfo = [{ ph: 0, a: 0, b: 0 }, { ph: 0.25, a: 0, b: 0 }];
  }
  setBuffer(buf, bsr) {
    this.buf = buf; this.blen = buf ? buf.length : 0; this.bsr = bsr;
    this.gon.fill(0); this.count = 0;
  }
  trigger(vel, note, p) {
    this.note = note;
    const voices = p[CK.g_voices] | 0;
    for (let v = 0; v < voices; v++) {
      const s = this.st[v];
      s.on = 1; s.stage = 1; s.vel = vel; s.next = 0;
    }
    if (p[CK.g_sync] >= 0.5) this.phase = 0;
  }
  choke() { for (const s of this.st) if (s.on) { s.stage = 2; s.env *= 0.05; } this.gon.fill(0); this.count = 0; }
  get active() { return this.count > 0 || this.st.some((s) => s.on); }

  lfoVal(l, rate, shape, n) {
    l.ph += rate * n / this.sr;
    if (l.ph >= 1) { l.ph -= Math.floor(l.ph); l.a = l.b; l.b = this.rnd() * 2 - 1; }
    if (shape === 0) return Math.sin(2 * Math.PI * l.ph);
    if (shape === 1) return l.ph < 0.5 ? 4 * l.ph - 1 : 3 - 4 * l.ph;
    const x = l.ph * l.ph * (3 - 2 * l.ph);
    return l.a + (l.b - l.a) * x;
  }

  // Adds n stereo samples to L and R; returns the number of grains sounding.
  render(L, R, n, p) {
    const b = this.buf;
    if (!b || this.blen < 64) return 0;
    const sr = this.sr, blen = this.blen, rnd = this.rnd;
    // loop points, each moved by its LFO
    const shape = p[CK.g_lfoShape] | 0;
    const m1 = this.lfoVal(this.lfo[0], p[CK.g_lsRate], shape, n), m2 = this.lfoVal(this.lfo[1], p[CK.g_leRate], shape, n);
    let a = p[CK.g_start] + p[CK.g_lsDepth] * m1 * 0.5, e = p[CK.g_end] + p[CK.g_leDepth] * m2 * 0.5;
    a = a < 0 ? 0 : a > 1 ? 1 : a; e = e < 0 ? 0 : e > 1 ? 1 : e;
    if (e < a) { const q = a; a = e; e = q; }
    let ls = a * blen, le = e * blen;
    if (le - ls < 32) { le = Math.min(blen, ls + 32); ls = le - 32; }
    this.ls = ls; this.le = le;
    const span = le - ls;
    // loop playhead
    this.phase += p[CK.g_speed] * n * this.bsr / (sr * span);
    if (this.phase >= 2) this.phase -= 2 * Math.floor(this.phase / 2);
    const mode = p[CK.g_mode] | 0, fr = this.phase - Math.floor(this.phase);
    const eff = this.eff = mode === 0 ? fr : mode === 1 ? 1 - fr : this.phase < 1 ? this.phase : 2 - this.phase;
    // note envelopes and grain scheduling
    const voices = p[CK.g_voices] | 0, drone = p[CK.g_env] >= 0.5;
    const sizeS = p[CK.g_size] * 0.001, size = sizeS * sr, dens = p[CK.g_dens], interval = sr / dens;
    const jit = p[CK.g_jit], pj = p[CK.g_pjit], spread = p[CK.g_spread], prev = p[CK.g_rev], pitch = p[CK.g_pitch] + this.note;
    const norm = 1.5 / Math.sqrt(Math.max(1, dens * sizeS) * voices);
    for (let v = 0; v < NVOICE; v++) {
      const s = this.st[v];
      if (drone && this.hold && v < voices && !s.on) { s.on = 1; s.stage = 1; s.next = 0; }
      if (!s.on) continue;
      if (v >= voices || (s.stage === 3 && !(drone && this.hold))) s.stage = 2;
      if (s.stage === 1) {
        s.env += n / (p[CK.g_atk] * sr);
        if (s.env >= 1) { s.env = 1; s.stage = drone && this.hold ? 3 : 2; }
      } else if (s.stage === 2) {
        s.env *= Math.exp(-6.9 * n / (p[CK.g_dec] * sr));
        if (s.env < 0.001) { s.on = 0; s.env = 0; continue; }
      }
      let at = s.next;
      while (at < n) {
        let g = 0;
        while (g < MAXG && this.gon[g]) g++;
        if (g < MAXG) {
          let f = eff + p[OKEY[v]] + (rnd() - 0.5) * jit; f -= Math.floor(f);
          const semis = pitch + p[NKEY[v]] + (pj > 0 ? (rnd() * 2 - 1) * pj * pj * 12 : 0);
          let rate = Math.pow(2, semis / 12) * this.bsr / sr, pos = ls + f * span;
          if (rnd() < prev) { pos = ls + (pos - ls + size * rate) % span; rate = -rate; }
          const pan = (1 + (rnd() * 2 - 1) * spread) * Math.PI / 4, amp = s.env * s.vel * norm;
          this.gon[g] = 1; this.gat[g] = at | 0; this.gpos[g] = pos; this.grate[g] = rate;
          this.gph[g] = 0; this.ginc[g] = 1 / size;
          this.gl[g] = Math.cos(pan) * amp; this.gr[g] = Math.sin(pan) * amp;
          this.gls[g] = ls; this.gle[g] = le;
        }
        at += Math.max(8, interval * (1 + (rnd() - 0.5) * jit));
      }
      s.next = at - n;
    }
    // grains
    const wa = 0.02 + p[CK.g_shape] * 0.96, ia = 1 / wa, ib = 1 / (1 - wa);
    let count = 0;
    for (let g = 0; g < MAXG; g++) {
      if (!this.gon[g]) continue;
      let pos = this.gpos[g], ph = this.gph[g];
      const rate = this.grate[g], inc = this.ginc[g], gl = this.gl[g], gr = this.gr[g], s0 = this.gls[g], s1 = this.gle[g], sp = s1 - s0;
      let alive = true;
      for (let i = this.gat[g]; i < n; i++) {
        let w = ph < wa ? ph * ia : (1 - ph) * ib;
        w = w * w * (3 - 2 * w);
        const i0 = pos | 0, x0 = b[i0], x = (x0 + ((i0 + 1 < blen ? b[i0 + 1] : x0) - x0) * (pos - i0)) * w;
        L[i] += x * gl; R[i] += x * gr;
        pos += rate;
        if (pos >= s1) { pos -= sp; if (pos >= s1) pos = s0; } else if (pos < s0) { pos += sp; if (pos < s0) pos = s0; }
        ph += inc;
        if (ph >= 1) { alive = false; break; }
      }
      this.gat[g] = 0;
      if (alive) { this.gpos[g] = pos; this.gph[g] = ph; count++; } else this.gon[g] = 0;
    }
    return this.count = count;
  }

  // What the display needs: loop points, playhead and where each grain is reading (all 0…1)
  view() {
    const n = this.blen || 1, pos = [];
    for (let g = 0; g < MAXG; g++) if (this.gon[g]) pos.push(this.gpos[g] / n);
    return { ls: this.ls / n, le: this.le / n, ph: (this.ls + this.eff * (this.le - this.ls)) / n, grains: pos };
  }
}
