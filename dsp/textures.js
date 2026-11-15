// Built-in sources for the granular sampler, computed from formulas (no third-party audio).
import { rng } from './params.js';

const TAU = 2 * Math.PI;
const normalise = (x, rms = 0.2) => {
  let m = 0, e = 0;
  for (let i = 0; i < x.length; i++) { m = Math.max(m, Math.abs(x[i])); e += x[i] * x[i]; }
  const g = Math.min(rms / Math.sqrt(e / x.length || 1), 0.95 / (m || 1));
  for (let i = 0; i < x.length; i++) x[i] *= g;
  return x;
};

export const TEXTURES = [
  { id: 'tex/glass', name: 'Glass', secs: 6, make(x, sr, rnd) {          // inharmonic partials that swell independently
    for (let k = 0; k < 22; k++) {
      const f = 220 * Math.pow(1 + k, 1.17) * (1 + (rnd() - 0.5) * 0.01), a = 1 / (1 + k * 0.6), lf = 0.08 + rnd() * 0.5, lp = rnd() * TAU, p0 = rnd() * TAU;
      if (f > sr * 0.45) break;
      for (let i = 0; i < x.length; i++) { const t = i / sr; x[i] += a * Math.sin(TAU * f * t + p0) * (0.55 + 0.45 * Math.sin(TAU * lf * t + lp)); }
    }
  } },
  { id: 'tex/strings', name: 'Strings', secs: 6, make(x, sr, rnd) {      // detuned saw chord through a slowly moving low-pass
    for (const semi of [0, 7, 12, 15, 19]) for (let d = 0; d < 3; d++) {
      const f = 110 * Math.pow(2, (semi + (d - 1) * 0.09) / 12), inc = f / sr;
      let ph = rnd();
      for (let i = 0; i < x.length; i++) {
        ph += inc; if (ph >= 1) ph -= 1;
        let s = 2 * ph - 1;
        if (ph < inc) { const q = ph / inc; s -= q + q - q * q - 1; } else if (ph > 1 - inc) { const q = (ph - 1) / inc; s -= q * q + q + q + 1; }
        x[i] += s;
      }
    }
    let l1 = 0, l2 = 0;
    for (let i = 0; i < x.length; i++) {
      const c = 1 - Math.exp(-TAU * (700 + 1800 * (0.5 - 0.5 * Math.cos(TAU * i / x.length))) / sr);
      l1 += (x[i] - l1) * c; l2 += (l1 - l2) * c; x[i] = l2;
    }
  } },
  { id: 'tex/vox', name: 'Vox', secs: 6, make(x, sr) {                    // pulse train through three formants: a-e-i-o-u
    const V = [[730, 1090, 2440], [530, 1840, 2480], [270, 2290, 3010], [570, 840, 2410], [300, 870, 2240], [730, 1090, 2440]];
    const st = [0, 0, 0, 0, 0, 0];
    let ph = 0;
    for (let i = 0; i < x.length; i++) {
      const t = i / x.length, pos = t * 5, a = Math.floor(pos), fr = pos - a, f0 = 110 * (1 + 0.012 * Math.sin(TAU * 5.2 * i / sr));
      ph += f0 / sr;
      let src = 0;
      if (ph >= 1) { ph -= 1; src = 1; }
      let o = 0;
      for (let k = 0; k < 3; k++) {
        const fc = V[a][k] + (V[a + 1][k] - V[a][k]) * fr, g = Math.tan(Math.PI * fc / sr), kq = 0.08, a1 = 1 / (1 + g * (g + kq));
        const v3 = src - st[2 * k + 1], v1 = a1 * st[2 * k] + g * a1 * v3, v2 = st[2 * k + 1] + g * a1 * st[2 * k] + g * g * a1 * v3;
        st[2 * k] = 2 * v1 - st[2 * k]; st[2 * k + 1] = 2 * v2 - st[2 * k + 1];
        o += v1 / (1 + k);
      }
      x[i] = o;
    }
  } },
  { id: 'tex/bells', name: 'Bells', secs: 8, make(x, sr, rnd) {           // FM bells on a pentatonic scale
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19];
    for (let h = 0; h < 26; h++) {
      const at = Math.floor(rnd() * (x.length - sr * 2.5)), f = 330 * Math.pow(2, scale[Math.floor(rnd() * scale.length)] / 12), a = 0.4 + rnd() * 0.6, idx = 2 + rnd() * 4;
      for (let i = 0, n = Math.floor(sr * 2.5); i < n; i++) {
        const t = i / sr, e = Math.exp(-t * 2.2);
        x[at + i] += a * e * Math.sin(TAU * f * t + idx * e * Math.sin(TAU * f * 3.51 * t));
      }
    }
  } },
  { id: 'tex/wind', name: 'Wind', secs: 6, make(x, sr, rnd) {             // noise through a resonant filter that wanders
    let s1 = 0, s2 = 0, w = 0.5, target = 0.5;
    for (let i = 0; i < x.length; i++) {
      if (i % 4096 === 0) target = rnd();
      w += (target - w) * 0.00008;
      const g = Math.tan(Math.PI * (250 * Math.pow(14, w)) / sr), kq = 0.12, a1 = 1 / (1 + g * (g + kq));
      const v3 = (rnd() * 2 - 1) - s2, v1 = a1 * s1 + g * a1 * v3, v2 = s2 + g * a1 * s1 + g * g * a1 * v3;
      s1 = 2 * v1 - s1; s2 = 2 * v2 - s2;
      x[i] = v1;
    }
  } },
  { id: 'tex/radio', name: 'Radio', secs: 5, make(x, sr, rnd) {           // chirps, blips and clicks, like a short-wave scan
    let at = 0;
    while (at < x.length - sr * 0.4) {
      const len = Math.floor(sr * (0.02 + rnd() * rnd() * 0.35)), f0 = 150 * Math.pow(30, rnd()), f1 = 150 * Math.pow(30, rnd()), kind = rnd(), mr = 0.5 + rnd() * 7, mi = rnd() * 6;
      let ph = 0, mp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len, f = f0 * Math.pow(f1 / f0, t), e = Math.min(1, t * 40) * Math.min(1, (1 - t) * 20);
        ph += f / sr; mp += f * mr / sr;
        x[at + i] += e * (kind < 0.4 ? Math.sin(TAU * ph + mi * Math.sin(TAU * mp)) : kind < 0.7 ? (ph % 1 < 0.5 ? 0.6 : -0.6) : Math.sin(TAU * ph) * (rnd() < 0.5 ? 1 : 0.2));
      }
      at += len + Math.floor(sr * rnd() * 0.08);
    }
  } },
];

export function buildTexture(def, sr = 44100) {
  const x = new Float32Array(Math.floor(def.secs * sr));
  def.make(x, sr, rng(def.id.length * 977 + def.secs));
  return { data: normalise(x), sr };
}
