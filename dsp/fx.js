// Send effects: ping-pong delay, a small feedback-delay-network reverb and a crusher.

export class Delay {
  constructor(sr) {
    this.sr = sr; this.n = Math.ceil(sr * 2.5);
    this.bl = new Float32Array(this.n); this.br = new Float32Array(this.n);
    this.w = 0; this.ll = 0; this.lr = 0;
  }
  process(inL, inR, outL, outR, n, time, fb, tone, lvl = 1) {
    const N = this.n, d = Math.max(1, Math.min(N - 1, Math.round(time))), c = 0.05 + tone * tone * 0.9;
    const bl = this.bl, br = this.br;
    let w = this.w, ll = this.ll, lr = this.lr;
    for (let i = 0; i < n; i++) {
      let r = w - d; if (r < 0) r += N;
      ll += (bl[r] - ll) * c; lr += (br[r] - lr) * c;
      bl[w] = (inL[i] + inR[i]) * 0.7 + lr * fb;
      br[w] = ll * fb;
      outL[i] += ll * lvl; outR[i] += lr * lvl;
      if (++w >= N) w = 0;
    }
    this.w = w; this.ll = Math.abs(ll) < 1e-20 ? 0 : ll; this.lr = Math.abs(lr) < 1e-20 ? 0 : lr;
  }
}

const LENS = [1487, 1601, 1867, 2053, 2251, 2399, 2617, 2797];
export class Reverb {
  constructor(sr) {
    this.bufs = LENS.map((l) => new Float32Array(Math.round(l * sr / 48000)));
    this.idx = new Int32Array(8); this.lp = new Float64Array(8);
    this.pre = [new Float32Array(Math.round(0.011 * sr)), new Float32Array(Math.round(0.017 * sr))];
    this.pi = [0, 0];
  }
  process(inL, inR, outL, outR, n, size, damp, lvl = 1) {
    lvl *= 0.3;
    const fb = 0.72 + size * 0.265, c = 1 - (0.05 + damp * 0.7), bufs = this.bufs, idx = this.idx, lp = this.lp, pre = this.pre, pi = this.pi;
    for (let i = 0; i < n; i++) {
      // one all-pass per side smears the input before it enters the network
      let b = pre[0], d = b[pi[0]], x = inL[i] + d * 0.5;
      b[pi[0]] = x; const xl = d - x * 0.5;
      if (++pi[0] >= b.length) pi[0] = 0;
      b = pre[1]; d = b[pi[1]]; x = inR[i] + d * 0.5;
      b[pi[1]] = x; const xr = d - x * 0.5;
      if (++pi[1] >= b.length) pi[1] = 0;
      let sum = 0, oL = 0, oR = 0;
      for (let j = 0; j < 8; j++) {
        const o = bufs[j][idx[j]];
        lp[j] += (o - lp[j]) * c; sum += lp[j];
        if (j & 1) oR += o; else oL += o;
      }
      sum *= 0.25;
      for (let j = 0; j < 8; j++) {
        bufs[j][idx[j]] = (j & 1 ? xr : xl) * 0.5 + (lp[j] - sum) * fb;
        if (++idx[j] >= bufs[j].length) idx[j] = 0;
      }
      outL[i] += oL * lvl; outR[i] += oR * lvl;
    }
    for (let j = 0; j < 8; j++) if (Math.abs(lp[j]) < 1e-20) lp[j] = 0;
  }
}

// Crusher: sample-and-hold (lower sample rate), hard saturation and a low-pass to tame it
export class Crush {
  constructor(sr) { this.sr = sr; this.hl = 0; this.hr = 0; this.count = 0; this.ll = 0; this.lr = 0; }
  process(inL, inR, outL, outR, n, drive, rate, tone, lvl) {
    const hold = 1 + rate * rate * 48 * this.sr / 48000, k = 1 + drive * drive * 30, nrm = lvl * 0.6 / Math.sqrt(k);
    const c = 1 - Math.exp(-2 * Math.PI * Math.min(400 * Math.pow(40, tone), this.sr * 0.45) / this.sr);
    let { hl, hr, count, ll, lr } = this;
    for (let i = 0; i < n; i++) {
      if (--count <= 0) { count += hold; hl = Math.tanh(inL[i] * k); hr = Math.tanh(inR[i] * k); }
      ll += (hl - ll) * c; lr += (hr - lr) * c;
      outL[i] += ll * nrm; outR[i] += lr * nrm;
    }
    this.hl = hl; this.hr = hr; this.count = count; this.ll = Math.abs(ll) < 1e-20 ? 0 : ll; this.lr = Math.abs(lr) < 1e-20 ? 0 : lr;
  }
}
