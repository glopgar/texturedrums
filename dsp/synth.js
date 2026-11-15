// Synth voice for basses and leads: two oscillators and a sub into a 4-pole low-pass, with its own
// filter and amplitude envelopes. Monophonic: a note that starts while the previous one is still
// held (GATE over 100%) is played legato, sliding to the new pitch without restarting the envelopes.
import { CK } from './params.js';

const TAU = 2 * Math.PI, C3 = 130.813;
const blep = (t, dt) => {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
};
function osc(w, ph, inc, pw) {
  if (w === 0) return 2 * ph - 1 - blep(ph, inc);
  if (w === 1) { let q = ph + 1 - pw; if (q >= 1) q -= 1; return (ph < pw ? 1 : -1) + blep(ph, inc) - blep(q, inc); }
  if (w === 2) return 1 - 4 * Math.abs(ph - 0.5);
  return Math.sin(TAU * ph);
}

export class Synth {
  constructor(sr) {
    this.sr = sr; this.stage = 0;      // 0 off, 1 attack, 2 decay/sustain, 3 release
    this.ph1 = 0; this.ph2 = 0; this.phs = 0; this.f = C3; this.target = C3;
    this.env = 0; this.fenv = 0; this.gate = 0; this.vel = 0; this.kill = 0;
    this.y1 = 0; this.y2 = 0; this.y3 = 0; this.y4 = 0; this.g = 0.1;
  }
  trigger(vel, note, p, stepDur) {
    const f = C3 * Math.pow(2, (note + p[CK.y_oct] * 12) / 12), legato = this.stage === 1 || this.stage === 2;
    this.target = f; this.vel = vel; this.gate = p[CK.y_gate] * stepDur; this.kill = 0;
    if (!legato) { this.f = f; this.stage = 1; this.fenv = 1; }
  }
  choke() { if (this.stage) this.kill = 1; }
  get active() { return this.stage !== 0; }

  // Writes n mono samples. fmr is an optional per-sample frequency ratio (the granular modulator).
  render(out, n, p, fmr) {
    const sr = this.sr, w1 = p[CK.y_w1] | 0, w2 = p[CK.y_w2] | 0, pw = 0.5 - p[CK.y_pw] * 0.45;
    const r2 = Math.pow(2, (p[CK.y_semi] + p[CK.y_det] * 0.5) / 12), m2 = p[CK.y_mix], sub = p[CK.y_sub];
    const cut = p[CK.y_cut], res = p[CK.y_res], fb = res * 3.8, eamt = p[CK.y_env] * 6 * (0.6 + 0.4 * this.vel), kf = Math.exp(-1 / (p[CK.y_fdec] * sr));
    const ai = 1 / (p[CK.y_atk] * sr), sus = p[CK.y_sus], kd = Math.exp(-1 / (p[CK.y_dec] * 0.3 * sr)), kr = Math.exp(-1 / (p[CK.y_rel] * 0.2 * sr));
    const gl = p[CK.y_glide], kg = gl <= 0 ? 1 : 1 - Math.exp(-1 / ((0.005 + gl * gl * 0.5) * sr));
    const amp = (0.35 + 0.65 * this.vel) * 0.8, fmax = sr * 0.2;
    let { ph1, ph2, phs, f, env, fenv, gate, stage, y1, y2, y3, y4, g } = this;
    for (let i = 0; i < n; i++) {
      if (stage === 0) { out[i] = 0; continue; }
      if (stage < 3 && --gate <= 0) stage = 3;
      if (stage === 1) { env += ai; if (env >= 1) { env = 1; stage = 2; } }
      else if (stage === 2) env = sus + (env - sus) * kd;
      else { env *= kr; if (env < 1e-4) { stage = 0; env = 0; out[i] = 0; continue; } }
      fenv *= kf; f += (this.target - f) * kg;
      if ((i & 15) === 0) {             // filter cutoff follows its envelope and, half-way, the pitch
        const fc = cut * Math.pow(2, eamt * fenv) * Math.sqrt(f / C3);
        g = 1 - Math.exp(-TAU * Math.min(fmax, Math.max(20, fc)) / sr);
      }
      const inc = Math.min(0.45, (fmr ? f * fmr[i] : f) / sr), inc2 = Math.min(0.45, inc * r2);
      ph1 += inc; if (ph1 >= 1) ph1 -= 1;
      ph2 += inc2; if (ph2 >= 1) ph2 -= 1;
      phs += inc * 0.5; if (phs >= 1) phs -= 1;
      const x = (osc(w1, ph1, inc, pw) * (1 - m2 * 0.5) + osc(w2, ph2, inc2, pw) * m2 + (phs < 0.5 ? sub : -sub)) * 0.5;
      const u = Math.tanh(x * 1.2 - fb * y4);
      y1 += g * (u - y1); y2 += g * (y1 - y2); y3 += g * (y2 - y3); y4 += g * (y3 - y4);
      out[i] = y4 * (1 + res * 0.8) * env * amp;
    }
    if (stage === 0) { y1 = y2 = y3 = y4 = 0; }
    Object.assign(this, { ph1, ph2, phs, f, env, fenv, gate, stage, y1, y2, y3, y4, g });
    if (this.kill > 0) {
      const kc = Math.exp(-1 / (0.003 * sr));
      let k = this.kill;
      for (let i = 0; i < n; i++) { out[i] *= k; k *= kc; }
      this.kill = k;
      if (k < 1e-3) { this.stage = 0; this.env = 0; this.kill = 0; this.y1 = this.y2 = this.y3 = this.y4 = 0; }
    }
  }
}
