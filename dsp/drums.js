// Drum voice: models of the classic analog circuits plus a one-shot sample layer.
// The resonant drums (kicks, toms, snare shells, rim) are damped resonators pinged by the trigger,
// as in the bridged-T circuits; hats, cymbal and cowbell start from the six square oscillators of the 808.
import { CK } from './params.js';

const TAU = 2 * Math.PI;
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];

export class Drum {
  constructor(sr, rnd) {
    this.sr = sr; this.rnd = rnd;
    this.on = false; this.model = 0; this.t = 0; this.vel = 0; this.ratio = 1;
    this.x1 = 0; this.y1 = 0; this.x2 = 0; this.y2 = 0;
    this.ph = 0; this.ph2 = 0; this.e1 = 0; this.e2 = 0; this.e3 = 0;
    this.z1 = 0; this.z2 = 0; this.s1 = 0; this.s2 = 0; this.s3 = 0; this.s4 = 0;
    this.mph = new Float64Array(6);
    this.buf = null; this.bsr = sr; this.sOn = false; this.sPos = 0; this.sRate = 1; this.sEnv = 0; this.sVel = 0;
    this.kill = 0;
  }
  setSample(buf, bsr) { this.buf = buf; this.bsr = bsr; this.sOn = false; }

  trigger(vel, note, p) {
    const m = this.model = p[CK.d_model] | 0;
    this.ratio = Math.pow(2, (p[CK.d_tune] + note) / 12);
    this.vel = vel; this.t = 0; this.on = p[CK.d_smix] < 1; this.kill = 0;
    this.e1 = this.e2 = this.e3 = 1;
    if (m === 0 || m === 7 || m === 2 || m === 9) { this.x1 = 1; this.y1 = 0; this.x2 = 1; this.y2 = 0; }
    if (m === 1 || m === 3 || m === 11) { this.ph = 0; this.ph2 = 0; }
    if (this.buf && p[CK.d_smix] > 0) {
      this.sOn = true; this.sEnv = 1; this.sVel = vel;
      this.sPos = p[CK.s_start] * (this.buf.length - 1);
      this.sRate = Math.pow(2, (p[CK.s_tune] + note) / 12) * this.bsr / this.sr;
    }
  }
  choke() { if (this.on || this.sOn) this.kill = 1; }
  get active() { return this.on || this.sOn; }

  // Writes n mono samples. fmr is an optional per-sample frequency ratio (the granular modulator).
  render(out, n, p, fmr) {
    for (let i = 0; i < n; i++) out[i] = 0;
    const smix = p[CK.d_smix], ga = Math.min(1, 2 * (1 - smix)), gs = Math.min(1, 2 * smix);
    if (this.on) this.analog(out, n, p, fmr, ga);
    if (this.sOn) this.sample(out, n, p, fmr, gs);
    if (this.kill > 0) {
      const kc = Math.exp(-1 / (0.003 * this.sr));
      let g = this.kill;
      for (let i = 0; i < n; i++) { out[i] *= g; g *= kc; }
      this.kill = g;
      if (g < 1e-3) { this.on = this.sOn = false; this.kill = 0; }
    }
  }

  sample(out, n, p, fmr, g) {
    const b = this.buf, last = b.length - 1, sd = p[CK.s_decay];
    const kd = sd >= 0.999 ? 1 : Math.exp(-1 / ((0.01 + sd * sd * 1.5) * this.sr));
    let pos = this.sPos, env = this.sEnv;
    const a = g * this.sVel, rate = this.sRate;
    for (let i = 0; i < n; i++) {
      const i0 = pos | 0;
      if (i0 >= last) { this.sOn = false; break; }
      out[i] += (b[i0] + (b[i0 + 1] - b[i0]) * (pos - i0)) * env * a;
      pos += fmr ? rate * fmr[i] : rate;
      env *= kd;
    }
    if (env < 1e-4) this.sOn = false;
    this.sPos = pos; this.sEnv = env;
  }

  analog(out, n, p, fmr, g) {
    const sr = this.sr, dec = p[CK.d_decay], tone = p[CK.d_tone], snap = p[CK.d_snap];
    const R = this.ratio, v = this.vel * g, rnd = this.rnd;
    const k = (tau) => Math.exp(-1 / (tau * sr));
    const lpc = (f) => 1 - Math.exp(-TAU * Math.min(f, sr * 0.45) / sr);
    const W = (f) => Math.min(3, TAU * f / sr);
    let life = 1, t = this.t;
    switch (this.model) {
      case 0: { // BD 808: one resonator; the trigger pulse also pushes the pitch up for a few ms
        const tau = 0.04 + dec * dec * 0.8, r = k(tau), ks = k(0.012), kc = k(0.0012), w0 = TAU * 49 * R / sr;
        let x = this.x1, y = this.y1, sw = this.e1, ck = this.e2, lp = this.z1;
        for (let i = 0; i < n; i++) {
          const w = Math.min(3, w0 * (1 + snap * 2.2 * sw) * (fmr ? fmr[i] : 1));
          const c = Math.cos(w), s = Math.sin(w), nx = r * (x * c - y * s);
          y = r * (x * s + y * c); x = nx;
          sw *= ks; ck *= kc; lp += (ck - lp) * 0.3;
          out[i] += v * Math.tanh((y + lp * tone * 0.7) * 1.4) * 0.85;
        }
        this.x1 = x; this.y1 = y; this.e1 = sw; this.e2 = ck; this.z1 = lp; life = tau * 9;
        break;
      }
      case 1: { // BD 909: swept oscillator into a saturator, plus a noise click
        const tau = 0.04 + dec * dec * 0.9, ka = k(tau), kp = k(0.018), kn = k(0.004), f0 = 52 * R / sr;
        const dr = 1 + tone * 4, nrm = 1 / Math.tanh(dr);
        let ph = this.ph, a = this.e1, pe = this.e2, ne = this.e3;
        for (let i = 0; i < n; i++) {
          ph += Math.min(0.45, f0 * (1 + snap * 7 * pe * pe) * (fmr ? fmr[i] : 1)); ph -= Math.floor(ph);
          out[i] += v * 0.85 * (Math.tanh(Math.sin(TAU * ph) * dr) * nrm * a + (rnd() * 2 - 1) * ne * 0.25 * (0.3 + tone));
          a *= ka; pe *= kp; ne *= kn;
        }
        this.ph = ph; this.e1 = a; this.e2 = pe; this.e3 = ne; life = tau * 9;
        break;
      }
      case 2: { // SD 808: two shell resonators and high-passed noise for the snares
        const r1 = k(0.05 + dec * 0.12), r2 = k(0.035 + dec * 0.08), tn = 0.03 + dec * dec * 0.4, kn = k(tn);
        const w1 = W(180 * R), w2 = W(335 * R), c = lpc(1200 + tone * 2500);
        let x1 = this.x1, y1 = this.y1, x2 = this.x2, y2 = this.y2, ne = this.e1, lp = this.z1;
        for (let i = 0; i < n; i++) {
          const f = fmr ? fmr[i] : 1, wa = Math.min(3, w1 * f), wb = Math.min(3, w2 * f);
          let cs = Math.cos(wa), sn = Math.sin(wa), nx = r1 * (x1 * cs - y1 * sn); y1 = r1 * (x1 * sn + y1 * cs); x1 = nx;
          cs = Math.cos(wb); sn = Math.sin(wb); nx = r2 * (x2 * cs - y2 * sn); y2 = r2 * (x2 * sn + y2 * cs); x2 = nx;
          const nz = rnd() * 2 - 1; lp += (nz - lp) * c;
          out[i] += v * ((y1 * (1 - tone * 0.5) + y2 * (0.35 + tone * 0.5)) * 0.55 + (nz - lp) * ne * snap * 0.7);
          ne *= kn;
        }
        this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2; this.e1 = ne; this.z1 = lp; life = Math.max(tn, 0.2) * 9;
        break;
      }
      case 3: { // SD 909: two swept oscillators and band-limited noise
        const ka = k(0.045 + dec * 0.1), kp = k(0.012), tn = 0.035 + dec * dec * 0.4, kn = k(tn);
        const f0 = 185 * R / sr, c1 = lpc(7500), c2 = lpc(300 + tone * 2500);
        let ph = this.ph, ph2 = this.ph2, a = this.e1, pe = this.e2, ne = this.e3, l1 = this.z1, l2 = this.z2;
        for (let i = 0; i < n; i++) {
          const f = Math.min(0.3, f0 * (1 + 0.9 * pe) * (fmr ? fmr[i] : 1));
          ph += f; ph -= Math.floor(ph); ph2 += f * 1.62; ph2 -= Math.floor(ph2);
          const nz = rnd() * 2 - 1; l1 += (nz - l1) * c1; l2 += (l1 - l2) * c2;
          out[i] += v * ((Math.sin(TAU * ph) * 0.6 + Math.sin(TAU * ph2) * 0.27) * a + (l1 - l2) * ne * snap * 0.95);
          a *= ka; pe *= kp; ne *= kn;
        }
        this.ph = ph; this.ph2 = ph2; this.e1 = a; this.e2 = pe; this.e3 = ne; this.z1 = l1; this.z2 = l2; life = Math.max(tn, 0.15) * 9;
        break;
      }
      case 4: { // CLAP: band-passed noise, three quick bursts and a tail
        const gap = 0.007 + snap * 0.009, tail = 0.02 + dec * dec * 0.5, fc = (900 + tone * 900) * R, kq = 0.35;
        let s1 = this.s1, s2 = this.s2;
        for (let i = 0; i < n; i++) {
          const ts = (t + i) / sr;
          const e = ts < 3 * gap ? Math.exp(-(ts % gap) / 0.0028) : Math.exp(-(ts - 3 * gap) / tail);
          const gg = Math.tan(Math.PI * Math.min(fc * (fmr ? fmr[i] : 1), sr * 0.4) / sr), a1 = 1 / (1 + gg * (gg + kq));
          const x = rnd() * 2 - 1, v3 = x - s2, v1 = a1 * s1 + gg * a1 * v3, v2 = s2 + gg * a1 * s1 + gg * gg * a1 * v3;
          s1 = 2 * v1 - s1; s2 = 2 * v2 - s2;
          out[i] += v * v1 * kq * e * 2.8;
        }
        this.s1 = s1; this.s2 = s2; life = 3 * gap + tail * 9;
        break;
      }
      case 5: case 6: { // HAT / CYMBAL: six detuned squares through band-pass and high-pass filters
        const cym = this.model === 6, mph = this.mph;
        const tauA = cym ? 0.15 + dec * 1.6 : 0.012 + dec * dec * dec * 1.2, tauB = cym ? 0.06 + dec * 0.6 : 0.004;
        const ka = k(tauA), kb = k(tauB), kq = cym ? 0.5 : 0.7;
        const fc = (cym ? 3440 : 6500 + tone * 5000), hc = lpc(cym ? 7000 : 5200);
        const gg = Math.tan(Math.PI * Math.min(fc, sr * 0.42) / sr), a1 = 1 / (1 + gg * (gg + kq));
        let s1 = this.s1, s2 = this.s2, lp = this.z1, a = this.e1, b = this.e2;
        const inc = METAL.map((f) => f * R / sr);
        for (let i = 0; i < n; i++) {
          const f = fmr ? fmr[i] : 1;
          let x = 0;
          for (let j = 0; j < 6; j++) { let q = mph[j] + Math.min(0.49, inc[j] * f); if (q >= 1) q -= 1; mph[j] = q; x += q < 0.5 ? 1 : -1; }
          x *= 0.17;
          const v3 = x - s2, v1 = a1 * s1 + gg * a1 * v3, v2 = s2 + gg * a1 * s1 + gg * gg * a1 * v3;
          s1 = 2 * v1 - s1; s2 = 2 * v2 - s2;
          lp += (x - lp) * hc;
          const hp = x - lp;
          out[i] += v * (cym ? v1 * kq * a * (1.5 - tone) * 1.6 + hp * (b * (0.5 + tone) + a * 0.35) * 1.3 + hp * snap * b * b * 1.5
            : (v1 * kq * 0.9 + hp * 0.9) * a * (1 + snap * 2 * b) * 0.75);
          a *= ka; b *= kb;
        }
        this.s1 = s1; this.s2 = s2; this.z1 = lp; this.e1 = a; this.e2 = b; life = tauA * 9;
        break;
      }
      case 7: { // TOM / conga: resonator with a short pitch bend and a little skin noise
        const tau = 0.06 + dec * dec * 0.9, r = k(tau), ks = k(0.03), kn = k(0.02), w0 = TAU * 110 * R / sr, c = lpc(900);
        let x = this.x1, y = this.y1, sw = this.e1, ne = this.e2, lp = this.z1;
        for (let i = 0; i < n; i++) {
          const w = Math.min(3, w0 * (1 + snap * sw) * (fmr ? fmr[i] : 1));
          const cs = Math.cos(w), sn = Math.sin(w), nx = r * (x * cs - y * sn);
          y = r * (x * sn + y * cs); x = nx;
          lp += ((rnd() * 2 - 1) - lp) * c;
          out[i] += v * (y * 0.85 + lp * ne * tone * 1.2);
          sw *= ks; ne *= kn;
        }
        this.x1 = x; this.y1 = y; this.e1 = sw; this.e2 = ne; this.z1 = lp; life = tau * 9;
        break;
      }
      case 8: { // COWBELL: two squares through a band-pass, two-stage envelope
        const ka = k(0.012), kb = k(0.03 + dec * 0.35), kq = 0.3, fc = 800 * R * (1 + tone), mph = this.mph;
        const gg = Math.tan(Math.PI * Math.min(fc, sr * 0.42) / sr), a1 = 1 / (1 + gg * (gg + kq));
        const i1 = 540 * R / sr, i2 = 800 * R / sr;
        let s1 = this.s1, s2 = this.s2, a = this.e1, b = this.e2;
        for (let i = 0; i < n; i++) {
          const f = fmr ? fmr[i] : 1;
          let q = mph[0] + Math.min(0.49, i1 * f); if (q >= 1) q -= 1; mph[0] = q;
          let x = q < 0.5 ? 0.5 : -0.5;
          q = mph[1] + Math.min(0.49, i2 * f); if (q >= 1) q -= 1; mph[1] = q;
          x += q < 0.5 ? 0.5 : -0.5;
          const v3 = x - s2, v1 = a1 * s1 + gg * a1 * v3, v2 = s2 + gg * a1 * s1 + gg * gg * a1 * v3;
          s1 = 2 * v1 - s1; s2 = 2 * v2 - s2;
          out[i] += v * v1 * kq * (a * (0.3 + snap) + b * 0.5) * 2.4;
          a *= ka; b *= kb;
        }
        this.s1 = s1; this.s2 = s2; this.e1 = a; this.e2 = b; life = (0.03 + dec * 0.35) * 9;
        break;
      }
      case 9: { // RIM / clave: two short resonators and a click
        const t1 = 0.006 + dec * dec * 0.12, r1 = k(t1), r2 = k(0.01 + dec * 0.05), kc = k(0.0006);
        const w1 = W(1667 * R), w2 = W(470 * R);
        let x1 = this.x1, y1 = this.y1, x2 = this.x2, y2 = this.y2, ck = this.e1;
        for (let i = 0; i < n; i++) {
          const f = fmr ? fmr[i] : 1, wa = Math.min(3, w1 * f), wb = Math.min(3, w2 * f);
          let cs = Math.cos(wa), sn = Math.sin(wa), nx = r1 * (x1 * cs - y1 * sn); y1 = r1 * (x1 * sn + y1 * cs); x1 = nx;
          cs = Math.cos(wb); sn = Math.sin(wb); nx = r2 * (x2 * cs - y2 * sn); y2 = r2 * (x2 * sn + y2 * cs); x2 = nx;
          out[i] += v * (y1 * (0.35 + tone * 0.55) + y2 * (1 - tone) * 0.6 + ck * snap * 0.6);
          ck *= kc;
        }
        this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2; this.e1 = ck; life = Math.max(t1, 0.06) * 9;
        break;
      }
      case 10: { // NOISE: high-passed noise (maracas with a slow attack, or a noise snap)
        const tau = 0.008 + dec * dec * 0.6, ka = k(tau), atk = 1 / (1 + snap * 0.03 * sr), fc = (1500 + tone * 8000) * R, kq = 1.2;
        let s1 = this.s1, s2 = this.s2, a = this.e1, up = t === 0 ? 0 : this.z2;
        for (let i = 0; i < n; i++) {
          const gg = Math.tan(Math.PI * Math.min(fc * (fmr ? fmr[i] : 1), sr * 0.42) / sr), a1 = 1 / (1 + gg * (gg + kq));
          const x = rnd() * 2 - 1, v3 = x - s2, v1 = a1 * s1 + gg * a1 * v3, v2 = s2 + gg * a1 * s1 + gg * gg * a1 * v3;
          s1 = 2 * v1 - s1; s2 = 2 * v2 - s2;
          let e;
          if (up < 0.999) { up += atk; e = Math.min(1, up); } else { e = a; a *= ka; }
          out[i] += v * (x - kq * v1 - v2) * e * 0.7;
        }
        this.s1 = s1; this.s2 = s2; this.e1 = a; this.z2 = up; life = snap * 0.03 + tau * 9;
        break;
      }
      default: { // FM: two-operator percussion
        const tau = 0.03 + dec * dec * 1.2, ka = k(tau), ki = k(0.02 + dec * 0.12), f0 = 180 * R / sr, ratio = 0.5 + tone * 6.5;
        let ph = this.ph, ph2 = this.ph2, a = this.e1, ie = this.e2;
        for (let i = 0; i < n; i++) {
          const f = Math.min(0.25, f0 * (fmr ? fmr[i] : 1));
          ph += f; ph -= Math.floor(ph); ph2 += f * ratio; ph2 -= Math.floor(ph2);
          out[i] += v * 0.8 * a * Math.sin(TAU * ph + snap * 8 * ie * Math.sin(TAU * ph2));
          a *= ka; ie *= ki;
        }
        this.ph = ph; this.ph2 = ph2; this.e1 = a; this.e2 = ie; life = tau * 9;
      }
    }
    this.t = t + n;
    if (this.t > life * sr) this.on = false;
  }
}
