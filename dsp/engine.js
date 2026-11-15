// TextureDrums engine: ten identical channels (each a drum, a granular sampler or a synth), the step sequencer
// and the send effects. Runs inside the AudioWorklet and, for the tests, in Node.
import { NCH, NSTEP, CH_PARAMS, GL_PARAMS, CK, GK, PMAP, EVO_BARS, rng } from './params.js';
import { Drum } from './drums.js';
import { Granular } from './grain.js';
import { Synth } from './synth.js';
import { Delay, Reverb, Crush } from './fx.js';
import { newTrack, cloneTrack, mutate, FIELDS } from './pattern.js';

const BLOCK = 128;

class Channel {
  constructor(sr, rnd) {
    this.sr = sr;
    this.p = Float64Array.from(CH_PARAMS.map((d) => d.def));
    this.drum = new Drum(sr, rnd); this.gr = new Granular(sr, rnd); this.syn = new Synth(sr);
    this.gL = new Float32Array(BLOCK); this.gR = new Float32Array(BLOCK);
    this.d = new Float32Array(BLOCK); this.fm = new Float32Array(BLOCK);
    this.f1l = 0; this.f2l = 0; this.f1r = 0; this.f2r = 0;
    this.pl = 0; this.pr = 0; this.level = 0;
    this.gsrc = -1; this.dsrc = -1; this.muted = false;
  }
  // GRAIN mode: only the grains sound. DRUM and SYNTH: the main voice sounds, and the grains can modulate it.
  trigger(vel, note, dur = this.sr * 0.125) {
    const p = this.p, mode = p[CK.mode] | 0;
    if (mode === 2) this.syn.trigger(vel, note, p, dur); else if (mode === 0) this.drum.trigger(vel, note, p);
    if (mode === 1 || p[CK.mod_type] > 0) this.gr.trigger(vel, note, p);
  }
  choke() { this.drum.choke(); this.syn.choke(); this.gr.choke(); }

  // Adds n samples to the dry mix and to the three send buses (delay, reverb, crusher).
  render(n, L, R, dL, dR, rL, rR, cL, cR) {
    const p = this.p, sr = this.sr, mode = p[CK.mode] | 0, grain = mode === 1, mod = grain ? 0 : p[CK.mod_type] | 0, amt = p[CK.mod_amt];
    const voice = mode === 2 ? this.syn : this.drum;
    const gL = this.gL, gR = this.gR, d = this.d;
    let live = false;
    for (let i = 0; i < n; i++) { gL[i] = 0; gR[i] = 0; }
    if ((grain || mod > 0) && (this.gr.active || (p[CK.g_env] >= 0.5 && this.gr.hold))) { this.gr.render(gL, gR, n, p); live = true; }
    if (!grain) {
      let fmr = null;
      if (mod === 2 && live) {       // FM: the grains bend the voice's pitch
        fmr = this.fm;
        for (let i = 0; i < n; i++) fmr[i] = Math.exp((gL[i] + gR[i]) * amt * 2.2);
      } else if (mod === 3) for (let i = 0; i < n; i++) this.fm[i] = gL[i] + gR[i];
      if (voice.active) { voice.render(d, n, p, fmr); live = true; } else for (let i = 0; i < n; i++) d[i] = 0;
      if (mod === 1) for (let i = 0; i < n; i++) d[i] *= (1 - amt) + amt * 5 * (gL[i] + gR[i]);   // ring: the grains multiply the voice
      for (let i = 0; i < n; i++) gL[i] = gR[i] = d[i] * 0.7071;                                   // only the voice is heard
    }
    const ftype = mod === 3 && (p[CK.f_type] | 0) === 0 ? 1 : p[CK.f_type] | 0;
    if (!live && Math.abs(this.f1l) + Math.abs(this.f1r) < 1e-7) { this.level *= 0.9; this.f1l = this.f2l = this.f1r = this.f2r = 0; return; }

    if (ftype > 0) {                       // state-variable filter; in FILTER mode the grains move the cutoff
      const k = 2 - 1.92 * p[CK.f_res], fc = p[CK.f_cut], lim = sr * 0.3;
      const fmod = mod === 3;
      let g = Math.tan(Math.PI * Math.min(fc, lim) / sr), a1 = 1 / (1 + g * (g + k));
      let s1 = this.f1l, s2 = this.f2l, s3 = this.f1r, s4 = this.f2r;
      for (let i = 0; i < n; i++) {
        if (fmod) {
          const x = Math.PI * Math.min(lim, fc * Math.exp(this.fm[i] * amt * 9)) / sr, x2 = x * x;
          g = x * (1 + x2 * (0.3333 + x2 * 0.1333)); a1 = 1 / (1 + g * (g + k));
        }
        let x = gL[i], v3 = x - s2, v1 = a1 * s1 + g * a1 * v3, v2 = s2 + g * a1 * s1 + g * g * a1 * v3;
        s1 = 2 * v1 - s1; s2 = 2 * v2 - s2;
        gL[i] = ftype === 1 ? v2 : ftype === 2 ? x - k * v1 - v2 : v1 * Math.max(k, 0.6);
        x = gR[i]; v3 = x - s4; v1 = a1 * s3 + g * a1 * v3; v2 = s4 + g * a1 * s3 + g * g * a1 * v3;
        s3 = 2 * v1 - s3; s4 = 2 * v2 - s4;
        gR[i] = ftype === 1 ? v2 : ftype === 2 ? x - k * v1 - v2 : v1 * Math.max(k, 0.6);
      }
      const z = (v) => (Math.abs(v) < 1e-12 ? 0 : v);
      this.f1l = z(s1); this.f2l = z(s2); this.f1r = z(s3); this.f2r = z(s4);
    }
    const drive = p[CK.drive];
    if (drive > 0) {
      const k = 1 + drive * 9, nrm = 1 / Math.sqrt(k);
      for (let i = 0; i < n; i++) { gL[i] = Math.tanh(gL[i] * k) * nrm; gR[i] = Math.tanh(gR[i] * k) * nrm; }
    }
    const vol = this.muted ? 0 : p[CK.vol] * p[CK.vol] * 1.3, pan = (p[CK.pan] + 1) * Math.PI / 4;
    const tl = vol * Math.cos(pan) * 1.414, tr = vol * Math.sin(pan) * 1.414, sd = p[CK.dly], sv = p[CK.rev], sc = p[CK.crs];
    let cl = this.pl, cr = this.pr, peak = 0;
    const il = (tl - cl) / n, ir = (tr - cr) / n;
    for (let i = 0; i < n; i++) {
      cl += il; cr += ir;
      const l = gL[i] * cl, r = gR[i] * cr;
      L[i] += l; R[i] += r; dL[i] += l * sd; dR[i] += r * sd; rL[i] += l * sv; rR[i] += r * sv; cL[i] += l * sc; cR[i] += r * sc;
      const a = l < 0 ? -l : l; if (a > peak) peak = a;
    }
    this.pl = tl; this.pr = tr;
    this.level = Math.max(peak, this.level * 0.9);
  }
}

export class Engine {
  constructor(sr, seed = 7) {
    this.sr = sr; this.rnd = rng(seed);
    this.g = Float64Array.from(GL_PARAMS.map((d) => d.def));
    this.ch = Array.from({ length: NCH }, () => new Channel(sr, this.rnd));
    this.pool = [];
    this.pat = Array.from({ length: NCH }, newTrack); this.base = this.pat.map(cloneTrack);
    this.running = false; this.step = -1; this.toNext = 0;
    this.rc = new Int32Array(NCH); this.rt = new Float64Array(NCH); this.ri = new Float64Array(NCH);
    this.rv = new Float64Array(NCH); this.rn = new Float64Array(NCH);
    this.pos = new Int8Array(NCH).fill(-1);
    this.events = []; this.view = 0; this.peak = 0;
    this.delay = new Delay(sr); this.reverb = new Reverb(sr); this.crush = new Crush(sr);
    const b = () => new Float32Array(BLOCK);
    this.mL = b(); this.mR = b(); this.dL = b(); this.dR = b(); this.rL = b(); this.rR = b(); this.cL = b(); this.cR = b();
  }

  setParam(id, v) {
    const d = PMAP.get(id);
    if (!d) return;
    if (d.ch < 0) this.g[d.idx] = v; else this.ch[d.ch].p[d.idx] = v;
  }
  setSample(idx, data, sr) {
    this.pool[idx] = { data, sr };
    this.ch.forEach((c, i) => { if (c.gsrc === idx) this.setSource(i, 'g', idx); if (c.dsrc === idx) this.setSource(i, 'd', idx); });
  }
  setSource(c, which, idx) {
    const ch = this.ch[c], s = this.pool[idx];
    if (which === 'g') { ch.gsrc = idx; ch.gr.setBuffer(s ? s.data : null, s ? s.sr : this.sr); }
    else { ch.dsrc = idx; ch.drum.setSample(s ? s.data : null, s ? s.sr : this.sr); }
  }
  // Pattern editing. Edits from the panel go to the live pattern and to the base it evolves around.
  setTrack(c, t, base = t) { this.pat[c] = cloneTrack(t); this.base[c] = cloneTrack(base); }
  setStep(c, i, s) { for (const f of FIELDS) if (f in s) { this.pat[c][f][i] = s[f]; this.base[c][f][i] = s[f]; } }
  revert() { this.pat = this.base.map(cloneTrack); }
  keep() { this.base = this.pat.map(cloneTrack); }

  start() {
    this.running = true; this.step = -1; this.toNext = 0; this.rc.fill(0);
    for (const c of this.ch) c.gr.hold = true;
  }
  stop() {
    this.running = false; this.pos.fill(-1); this.rc.fill(0);
    for (const c of this.ch) c.gr.hold = false;
  }
  trig(c, vel = 0.8, note = 0, dur = this.sr * 0.125) {
    const ch = this.ch[c], grp = ch.p[CK.choke] | 0;
    if (grp) for (const o of this.ch) if (o !== ch && (o.p[CK.choke] | 0) === grp) o.choke();
    ch.trigger(vel, note, dur);
  }

  advance() {
    const g = this.g, step = ++this.step;
    const base = this.sr * 60 / g[GK.bpm] / 4, sw = g[GK.swing] * 0.5;
    const dur = base * (step & 1 ? 1 - sw : 1 + sw);
    this.toNext += dur;
    const every = EVO_BARS[g[GK.evo_bars] | 0] * NSTEP;
    if (step > 0 && step % every === 0 && g[GK.evo_on] >= 0.5) this.evolve();
    let solo = false;
    for (const c of this.ch) if (c.p[CK.solo] >= 0.5) solo = true;
    for (let c = 0; c < NCH; c++) {
      const p = this.ch[c].p, t = this.pat[c], i = step % (p[CK.len] | 0);
      this.pos[c] = i;
      if (!t.on[i] || p[CK.mute] >= 0.5 || (solo && p[CK.solo] < 0.5)) continue;
      if (this.rnd() >= t.prob[i] * p[CK.prob]) continue;
      this.trig(c, t.vel[i], t.note[i], dur / Math.max(1, t.rat[i] | 0));
      const rat = t.rat[i] | 0;
      if (rat > 1) { this.rc[c] = rat - 1; this.ri[c] = dur / rat; this.rt[c] = dur / rat; this.rv[c] = t.vel[i] * 0.8; this.rn[c] = t.note[i]; }
      else this.rc[c] = 0;
    }
  }
  evolve() {
    for (let c = 0; c < NCH; c++) {
      const p = this.ch[c].p, amt = p[CK.evo];
      if (amt <= 0) continue;
      if (mutate(this.pat[c], this.base[c], this.rnd, amt, p[CK.mode] > 0, p[CK.len] | 0)) this.events.push({ type: 'pattern', c, track: cloneTrack(this.pat[c]) });
    }
  }

  process(L, R) {
    const N = L.length, g = this.g;
    // mute and solo silence the channel itself (drones and tails included), not just its steps
    let solo = false;
    for (const c of this.ch) if (c.p[CK.solo] >= 0.5) solo = true;
    for (const c of this.ch) c.muted = c.p[CK.mute] >= 0.5 || (solo && c.p[CK.solo] < 0.5);
    let o = 0;
    while (o < N) {
      let n = Math.min(BLOCK, N - o);
      if (this.running) {
        if (this.toNext <= 0) this.advance();
        n = Math.min(n, Math.max(1, Math.ceil(this.toNext)));
        for (let c = 0; c < NCH; c++) {
          if (!this.rc[c]) continue;
          if (this.rt[c] <= 0) { this.trig(c, this.rv[c], this.rn[c], this.ri[c]); this.rc[c]--; this.rt[c] += this.ri[c]; }
          if (this.rc[c]) n = Math.min(n, Math.max(1, Math.ceil(this.rt[c])));
        }
      }
      const { mL, mR, dL, dR, rL, rR, cL, cR } = this;
      for (let i = 0; i < n; i++) { mL[i] = mR[i] = dL[i] = dR[i] = rL[i] = rR[i] = cL[i] = cR[i] = 0; }
      for (const c of this.ch) c.render(n, mL, mR, dL, dR, rL, rR, cL, cR);
      this.delay.process(dL, dR, mL, mR, n, g[GK.dly_time] * this.sr * 15 / g[GK.bpm], g[GK.dly_fb], g[GK.dly_tone], g[GK.dly_lvl]);
      this.reverb.process(rL, rR, mL, mR, n, g[GK.rv_size], g[GK.rv_damp], g[GK.rv_lvl]);
      this.crush.process(cL, cR, mL, mR, n, g[GK.cr_drive], g[GK.cr_rate], g[GK.cr_tone], g[GK.cr_lvl]);
      const vol = g[GK.vol] * g[GK.vol] * 1.2;
      let peak = this.peak * 0.999;
      for (let i = 0; i < n; i++) {
        const l = mL[i] * vol, r = mR[i] * vol, a = Math.abs(l);
        if (a > peak) peak = a;
        L[o + i] = Math.tanh(l); R[o + i] = Math.tanh(r);
      }
      this.peak = peak;
      if (this.running) { this.toNext -= n; for (let c = 0; c < NCH; c++) if (this.rc[c]) this.rt[c] -= n; }
      o += n;
    }
  }

  state() {
    return {
      running: this.running, step: this.step, pos: Array.from(this.pos), peak: this.peak,
      levels: this.ch.map((c) => c.level), view: this.ch[this.view].gr.view(),
    };
  }
}
