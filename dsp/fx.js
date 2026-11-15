// Send effects: ping-pong delay and a small feedback-delay-network reverb.

export class Delay {
  constructor(sr) {
    this.sr = sr; this.n = Math.ceil(sr * 2.5);
    this.bl = new Float32Array(this.n); this.br = new Float32Array(this.n);
    this.w = 0; this.ll = 0; this.lr = 0;
  }
  process(inL, inR, outL, outR, n, time, fb, tone) {
    const N = this.n, d = Math.max(1, Math.min(N - 1, Math.round(time))), c = 0.05 + tone * tone * 0.9;
    const bl = this.bl, br = this.br;
    let w = this.w, ll = this.ll, lr = this.lr;
    for (let i = 0; i < n; i++) {
      let r = w - d; if (r < 0) r += N;
      ll += (bl[r] - ll) * c; lr += (br[r] - lr) * c;
      bl[w] = (inL[i] + inR[i]) * 0.7 + lr * fb;
      br[w] = ll * fb;
      outL[i] += ll; outR[i] += lr;
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
  process(inL, inR, outL, outR, n, size, damp) {
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
      outL[i] += oL * 0.3; outR[i] += oR * 0.3;
    }
    for (let j = 0; j < 8; j++) if (Math.abs(lp[j]) < 1e-20) lp[j] = 0;
  }
}
