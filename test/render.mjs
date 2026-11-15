// Offline engine tests: node test/render.mjs
import { readFileSync } from 'node:fs';
import { Engine } from '../dsp/engine.js';
import { PARAMS, PMAP, MODELS, MODS, NCH, CK, rng } from '../dsp/params.js';
import { Drum } from '../dsp/drums.js';
import { Granular } from '../dsp/grain.js';
import { Synth } from '../dsp/synth.js';
import { parseWav, normalise } from '../dsp/wav.js';
import { TEXTURES, buildTexture } from '../dsp/textures.js';
import { fromString, newTrack, randomTrack, mutate, cloneTrack, sameStep } from '../dsp/pattern.js';
import { FACTORY, expand } from '../js/presets.js';

let fail = 0;
const ok = (c, msg) => { if (!c) { fail++; console.log('  FAIL', msg); } };
const SR = 48000, root = new URL('..', import.meta.url);
const rms = (x, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / (b - a)); };
const peak = (x) => { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); return m; };
const finite = (x) => { for (const v of x) if (v !== v || Math.abs(v) > 100) return false; return true; };
const chp = (o = {}) => { const p = new Engine(SR).ch[0].p; for (const [k, v] of Object.entries(o)) p[CK[k.replace(/\./g, '_')]] = v; return p; };
function render(en, secs) {
  const n = Math.round(secs * SR / 128) * 128, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i += 128) en.process(L.subarray(i, i + 128), R.subarray(i, i + 128));
  return [L, R];
}

// 1. parameters
{
  ok(new Set(PARAMS.map((d) => d.id)).size === PARAMS.length, 'duplicate parameter ids');
  for (const d of PARAMS) ok(d.def >= d.min && d.def <= d.max, `${d.id}: default out of range`);
  console.log(PARAMS.length, 'parameters');
}

// 2. sample pool: every listed WAV parses; the built-in textures are sane
const pool = [], ids = new Map();
{
  const man = JSON.parse(readFileSync(new URL('samples/manifest.json', root)));
  for (const kit of man.kits) for (const f of kit.files) {
    const b = readFileSync(new URL(`samples/${kit.id}/${f}.wav`, root));
    const s = parseWav(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    ok(s.data.length > 500 && finite(s.data) && peak(s.data) > 0.02 && peak(s.data) <= 1, `${kit.id}/${f}: bad sample`);
    normalise(s.data);
    ids.set(`${kit.id}/${f}`, pool.length); pool.push(s);
  }
  for (const t of TEXTURES) {
    const s = buildTexture(t);
    ok(finite(s.data) && Math.abs(rms(s.data) - 0.2) < 0.08 && peak(s.data) <= 0.96, `${t.id}: level`);
    ids.set(t.id, pool.length); pool.push(s);
  }
  console.log(pool.length, 'samples in the pool');
}
function load(st, seed) {
  const en = new Engine(SR, seed);
  pool.forEach((s, i) => en.setSample(i, s.data, s.sr));
  for (const [id, v] of Object.entries(st.params)) en.setParam(id, v);
  for (let c = 0; c < NCH; c++) {
    ok(ids.has(st.gsrc[c]) && ids.has(st.dsrc[c]), `${st.name} ch ${c}: unknown sample`);
    en.setSource(c, 'g', ids.get(st.gsrc[c])); en.setSource(c, 'd', ids.get(st.dsrc[c]));
    en.setTrack(c, st.pat[c]);
  }
  return en;
}

// 3. drum models: each sounds, stays in range, dies away, survives extreme settings and FM
{
  const out = new Float32Array(SR * 12), fm = new Float32Array(128).map((_, i) => Math.exp(Math.sin(i) * 2));
  MODELS.forEach((name, m) => {
    const d = new Drum(SR, rng(3)), p = chp({ 'd.model': m });
    d.trigger(1, 0, p);
    for (let i = 0; i < out.length; i += 128) d.render(out.subarray(i, i + 128), 128, p);
    const pk = peak(out);
    ok(finite(out) && pk > 0.25 && pk < 1.3, `${name}: peak ${pk.toFixed(2)}`);
    ok(rms(out, SR * 11) < 1e-3 && !d.active, `${name}: does not die away`);
    for (const [dec, tone, snap, tune] of [[0, 0, 0, -24], [1, 1, 1, 24], [1, 0, 1, 24], [0, 1, 0, 0]]) {
      const q = chp({ 'd.model': m, 'd.decay': dec, 'd.tone': tone, 'd.snap': snap, 'd.tune': tune });
      d.trigger(1, 0, q);
      for (let i = 0; i < SR; i += 128) d.render(out.subarray(i, i + 128), 128, q, fm);
      ok(finite(out.subarray(0, SR)) && peak(out.subarray(0, SR)) < 4, `${name}: unstable at decay ${dec} tone ${tone} snap ${snap} tune ${tune} (peak ${peak(out.subarray(0, SR)).toFixed(1)})`);
    }
    console.log(`  ${name.padEnd(8)} peak ${pk.toFixed(2)} rms(50ms) ${rms(out, 0, SR * 0.05).toFixed(3)}`);
  });
  // sample layer: plays the sample at pitch, start offset and decay
  const d = new Drum(SR, rng(1)), s = pool[ids.get('LM-2/kick')];
  d.setSample(s.data, s.sr);
  const p = chp({ 'd.smix': 1 });
  d.trigger(1, 0, p); out.fill(0);
  for (let i = 0; i < SR; i += 128) d.render(out.subarray(i, i + 128), 128, p);
  ok(Math.abs(peak(out) - peak(s.data)) < 0.05 && !d.active, 'sample layer: level or length');
  d.trigger(1, 12, p);
  let n = 0; while (d.active) { d.render(out.subarray(0, 128), 128, p); n += 128; }
  ok(Math.abs(n / SR - s.data.length / s.sr / 2) < 0.01, 'sample layer: an octave up should last half as long');
}

// 4. granular sampler
{
  const sine = new Float32Array(SR * 2).map((_, i) => 0.5 * Math.sin(2 * Math.PI * 440 * i / SR));
  const run = (o, secs = 1, hold = false, note = 0) => {
    const g = new Granular(SR, rng(5)), p = chp(o), L = new Float32Array(SR * secs), R = new Float32Array(SR * secs);
    g.setBuffer(sine, SR); g.hold = hold; g.trigger(1, note, p);
    let lo = 1, hi = 0;
    for (let i = 0; i + 128 <= L.length; i += 128) {
      g.render(L.subarray(i, i + 128), R.subarray(i, i + 128), 128, p);
      const v = g.view(); for (const q of v.grains) { lo = Math.min(lo, q); hi = Math.max(hi, q); }
    }
    return { L, R, lo, hi, g };
  };
  const freq = (x, a, b) => { let c = 0; for (let i = a + 1; i < b; i++) if (x[i - 1] < 0 && x[i] >= 0) c++; return c * SR / (b - a); };
  // pitch: frozen loop, no jitter -> every grain reads the same spot, so the output keeps the sample's pitch
  for (const [semi, f] of [[0, 440], [12, 880], [-12, 220], [7, 659.3]]) {
    const r = run({ 'g.env': 1, 'g.speed': 0, 'g.jit': 0, 'g.pitch': semi, 'g.size': 200, 'g.dens': 20, 'g.spread': 0 }, 1, true);
    const got = freq(r.L, SR * 0.3, SR * 0.9);
    ok(Math.abs(got / f - 1) < 0.03, `grain pitch ${semi}: ${got.toFixed(1)} Hz, expected ${f}`);
  }
  const viaNote = run({ 'g.env': 1, 'g.speed': 0, 'g.jit': 0, 'g.size': 200, 'g.dens': 40 }, 1, true, 12);
  ok(Math.abs(freq(viaNote.L, SR * 0.3, SR * 0.9) / 880 - 1) < 0.03, 'grain pitch from the step note');
  // loop: grains stay between the loop points in every mode, also with reversed grains and LFOs
  for (const mode of [0, 1, 2]) {
    const r = run({ 'g.env': 1, 'g.mode': mode, 'g.start': 0.3, 'g.end': 0.6, 'g.jit': 1, 'g.rev': 0.5, 'g.pjit': 1, 'g.speed': 3, 'g.voices': 4 }, 2, true);
    ok(r.lo >= 0.3 - 1e-6 && r.hi <= 0.6 + 1e-6 && r.hi - r.lo > 0.25, `loop mode ${mode}: grains at ${r.lo.toFixed(3)}…${r.hi.toFixed(3)}`);
    ok(finite(r.L) && rms(r.L) > 0.01, `loop mode ${mode}: silent or broken`);
  }
  const lfo = run({ 'g.env': 1, 'g.start': 0.4, 'g.end': 0.5, 'g.lsDepth': 1, 'g.leDepth': 1, 'g.lsRate': 3, 'g.leRate': 5, 'g.jit': 1 }, 3, true);
  ok(lfo.lo < 0.1 && lfo.hi > 0.8 && lfo.lo >= 0 && lfo.hi <= 1, `loop LFOs should move the loop points (${lfo.lo.toFixed(2)}…${lfo.hi.toFixed(2)})`);
  // direction: forward and reverse loops travel opposite ways
  const dir = (mode) => { const g = new Granular(SR, rng(1)), p = chp({ 'g.mode': mode, 'g.env': 1 }), b = new Float32Array(128); g.setBuffer(sine, SR); g.render(b, b, 128, p); const a = g.eff; for (let i = 0; i < 20; i++) g.render(b, b, 128, p); return g.eff - a; };
  ok(dir(0) > 0 && dir(1) < 0, 'loop direction');
  const pp = (() => { const g = new Granular(SR, rng(1)), p = chp({ 'g.mode': 2, 'g.speed': 4 }), b = new Float32Array(128); g.setBuffer(sine, SR); let up = 0, down = 0, last = 0; for (let i = 0; i < 750; i++) { g.render(b, b, 128, p); if (g.eff > last) up++; else down++; last = g.eff; } return [up, down]; })();
  ok(Math.abs(pp[0] - pp[1]) < 40, `ping-pong should spend equal time each way (${pp})`);
  // notes: each voice has its own offset and pitch
  const g = new Granular(SR, rng(2)), p = chp({ 'g.voices': 4, 'g.speed': 0, 'g.jit': 0, 'g.o1': 0.1, 'g.o2': 0.3, 'g.o3': 0.5, 'g.o4': 0.7, 'g.n1': 0, 'g.n2': 12, 'g.n3': -12, 'g.n4': 7, 'g.size': 500 });
  g.setBuffer(sine, SR); g.trigger(1, 0, p);
  g.render(new Float32Array(16), new Float32Array(16), 16, p);
  const starts = [...g.gpos].filter((_, i) => g.gon[i]).map((v) => +(v / sine.length).toFixed(2)), rates = [...g.grate].filter((_, i) => g.gon[i]).map((v) => +v.toFixed(3));
  ok(starts.join() === '0.1,0.3,0.5,0.7' && rates.join() === '1,2,0.5,1.498', `voices: offsets ${starts} rates ${rates}`);
  // envelopes: a triggered note dies away, a drone holds until the sequencer stops
  const trig = run({ 'g.dec': 0.3 }, 2);
  ok(rms(trig.L, 0, SR * 0.2) > 0.02 && rms(trig.L, SR * 1.5) < 1e-4 && !trig.g.active, 'trig envelope should decay');
  const drone = run({ 'g.env': 1 }, 2, true);
  ok(rms(drone.L, SR * 1.5) > 0.02, 'drone should hold');
  // level: denser, longer or more voices should not get much louder
  const lv = [[10, 50, 1], [80, 50, 1], [30, 400, 1], [30, 100, 4], [100, 600, 4]].map(([dens, size, voices]) => rms(run({ 'g.env': 1, 'g.dens': dens, 'g.size': size, 'g.voices': voices, 'g.jit': 1, 'g.pjit': 0.3 }, 2, true).L, SR * 0.5));
  ok(Math.max(...lv) / Math.min(...lv) < 3.5, `grain loudness varies too much: ${lv.map((v) => v.toFixed(3))}`);
  console.log('  grain levels', lv.map((v) => v.toFixed(3)).join(' '));
}

// 4b. synth voice
{
  const freq = (x, a, b) => { let c = 0; for (let i = a + 1; i < b; i++) if (x[i - 1] < 0 && x[i] >= 0) c++; return c * SR / (b - a); };
  const play = (o, notes, secs = 1, step = SR / 8) => {      // notes: [time in steps, note]
    const s = new Synth(SR), p = chp({ 'y.w1': 3, 'y.w2': 3, 'y.mix': 0, 'y.sub': 0, 'y.cut': 18000, 'y.res': 0, 'y.env': 0, ...o }), out = new Float32Array(SR * secs);
    let k = 0;
    for (let i = 0; i + 16 <= out.length; i += 16) { while (k < notes.length && notes[k][0] * step <= i) { s.trigger(1, notes[k][1], p, step); k++; } s.render(out.subarray(i, i + 16), 16, p); }
    return { out, s };
  };
  for (const [note, oct, f] of [[0, 0, 130.81], [9, 1, 440], [0, -2, 32.7], [-12, 2, 261.63]]) {
    const got = freq(play({ 'y.oct': oct, 'y.gate': 4, 'y.sus': 1 }, [[0, note]]).out, SR * 0.1, SR * 0.4);
    ok(Math.abs(got / f - 1) < 0.02, `synth pitch note ${note} octave ${oct}: ${got.toFixed(1)} Hz, expected ${f}`);
  }
  for (const w of [0, 1, 2, 3]) {
    const { out } = play({ 'y.w1': w, 'y.oct': 0, 'y.gate': 4, 'y.sus': 1 }, [[0, 0]]);
    ok(finite(out) && peak(out) > 0.2 && peak(out) < 1.1 && Math.abs(freq(out, SR * 0.1, SR * 0.4) / 130.81 - 1) < 0.02, `synth wave ${w}: peak ${peak(out).toFixed(2)}`);
  }
  // a note ends after its gate and the voice goes quiet
  const short = play({ 'y.gate': 0.5, 'y.rel': 0.05 }, [[0, 0]]);
  ok(rms(short.out, 0, SR / 16) > 0.1 && rms(short.out, SR * 0.4) < 1e-4 && !short.s.active, 'synth: gate and release');
  // separate notes restart the envelope; tied notes (gate over 100%) do not, and slide to the new pitch
  const sep = play({ 'y.oct': 0, 'y.gate': 0.5, 'y.atk': 0.02, 'y.rel': 0.01 }, [[0, 0], [1, 12]]), tie = play({ 'y.oct': 0, 'y.gate': 4, 'y.atk': 0.02, 'y.glide': 0.25, 'y.sus': 1 }, [[0, 0], [1, 12]]);
  const at = SR / 8;
  ok(rms(sep.out, at, at + 200) < 0.05 && rms(tie.out, at, at + 200) > 0.3, 'synth: tied notes play legato');
  const early = freq(tie.out, at + 480, at + 2400), late = freq(tie.out, at + SR * 0.25, at + SR * 0.35);
  ok(early > 135 && early < 240 && Math.abs(late / 261.63 - 1) < 0.03, `synth: glide on tied notes (${early.toFixed(0)} Hz then ${late.toFixed(0)} Hz)`);
  // the filter closes with its envelope, and survives full resonance
  const bright = play({ 'y.w1': 0, 'y.cut': 200, 'y.env': 1, 'y.fdec': 0.1, 'y.gate': 4, 'y.sus': 1 }, [[0, 0]]).out;
  const hf = (x, a, b) => { let s = 0; for (let i = a + 1; i < b; i++) s += (x[i] - x[i - 1]) ** 2; return Math.sqrt(s / (b - a)); };
  ok(hf(bright, 200, 2000) > hf(bright, SR * 0.5, SR * 0.5 + 4000) * 3, 'synth: filter envelope');
  for (const [cut, res, env] of [[30, 1, 1], [18000, 1, 1], [18000, 1, 0], [500, 1, 1]]) {
    const { out } = play({ 'y.w1': 0, 'y.w2': 1, 'y.mix': 1, 'y.sub': 1, 'y.pw': 1, 'y.cut': cut, 'y.res': res, 'y.env': env, 'y.oct': 3, 'y.gate': 4 }, [[0, 24]]);
    ok(finite(out) && peak(out) < 2.5, `synth: unstable at cutoff ${cut} resonance ${res} (peak ${peak(out).toFixed(2)})`);
  }
}

// 5. channel: the three modes and the ways the grains can modulate the voice
{
  const one = (o) => {
    const st = expand(FACTORY.find((f) => f.name === 'Init'));
    st.params['c0.d.model'] = 11;
    for (const [k, v] of Object.entries(o)) st.params[`c0.${k}`] = v;
    st.gsrc[0] = 'tex/radio';
    const en = load(st, 11); en.trig(0, 1, 0);
    return render(en, 1.5)[0];
  };
  const dry = one({}), grain = one({ mode: 1 });
  ok(rms(dry) > 0.02 && rms(grain) > 0.005, 'DRUM and GRAIN modes both sound');
  const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return Math.sqrt(s / a.length); };
  MODS.forEach((name, m) => {
    if (!m) return;
    const x = one({ 'mod.type': m, 'mod.amt': 1, 'g.dens': 60, 'g.size': 40 }), ref = dry;
    ok(finite(x) && rms(x) > 0.005 && peak(x) < 1, `mod ${name}: broken (rms ${rms(x).toFixed(3)})`);
    ok(diff(x, ref) > 0.005, `mod ${name}: no audible effect`);
    const zero = one({ 'mod.type': m, 'mod.amt': 0, 'f.cut': 18000 });
    if (m !== 3) ok(diff(zero, ref) < 1e-4, `mod ${name}: amount 0 should leave the sound alone`);
    console.log(`  mod ${name.padEnd(6)} rms ${rms(x).toFixed(3)} (unmodulated ${rms(ref).toFixed(3)})`);
  });
  // the three sends: each adds its effect, and an effect's level at 0 removes it again
  const fxs = [['dly', 'dly.lvl'], ['rev', 'rv.lvl'], ['crs', 'cr.lvl']].map(([send, lvl]) => {
    const mk = (level) => { const st = expand(FACTORY.find((f) => f.name === 'Init')); st.params[`c0.${send}`] = 1; st.params[lvl] = level; const en = load(st, 11); en.trig(0, 1, 0); return render(en, 1.5)[0]; };
    const wet = mk(1), off = mk(0), plain = one({ 'd.model': 0 });
    ok(finite(wet) && diff(wet, plain) > 0.005 && peak(wet) < 1, `send ${send}: no effect heard`);
    ok(diff(off, plain) < 1e-6, `send ${send}: level 0 should leave only the dry sound`);
    return diff(wet, plain).toFixed(3);
  });
  console.log('  sends (delay, reverb, crusher) add', fxs.join(' '));
  // channel modes: GRAIN ignores the drum and its modulation; SYNTH plays the synth, and the grains can modulate it too
  const asGrain = one({ mode: 1, 'mod.type': 1 });
  ok(diff(asGrain, grain) < 1e-6, 'GRAIN mode should sound like the grains alone');
  const syn = one({ mode: 2 }), synFm = one({ mode: 2, 'mod.type': 2, 'mod.amt': 1 });
  ok(finite(syn) && rms(syn) > 0.02 && diff(syn, dry) > 0.01, 'SYNTH mode plays the synth');
  ok(finite(synFm) && diff(synFm, syn) > 0.005, 'SYNTH mode: the grains modulate the synth');
  // in DRUM mode the grains are never heard on their own: with nothing to modulate the channel is silent
  const st0 = expand(FACTORY.find((f) => f.name === 'Init')); st0.params['c0.mod.type'] = 1; st0.params['c0.mod.amt'] = 1; st0.params['c0.g.env'] = 1; st0.gsrc[0] = 'tex/radio';
  const e0 = load(st0, 3); e0.start(); ok(rms(render(e0, 1)[0]) < 1e-6, 'grains used as modulator are not heard by themselves');
  for (const ft of [1, 2, 3]) { const x = one({ 'f.type': ft, 'f.cut': 800, 'f.res': 1, drive: 1 }); ok(finite(x) && peak(x) < 1, `filter ${ft} at full resonance`); }
}

// 6. sequencer
{
  const base = () => { const st = expand(FACTORY.find((f) => f.name === 'Init')); st.params.bpm = 120; return st; };
  const count = (st, secs, seed = 1, prep) => {
    const en = load(st, seed), hits = new Array(NCH).fill(0), times = [], orig = en.trig.bind(en);
    let t = 0;
    en.trig = (c, v, n) => { hits[c]++; if (c === 0) times.push(t + (128 - 0)); orig(c, v, n); };
    if (prep) prep(en);
    en.start();
    const L = new Float32Array(128), R = new Float32Array(128);
    for (; t < secs * SR; t += 128) en.process(L, R);
    return { hits, times, en };
  };
  let st = base(); st.pat[0] = fromString('x...x...x...x...');
  let r = count(st, 8);
  ok(r.hits[0] === 16, `four on the floor for 8 s at 120 bpm: ${r.hits[0]} hits`);
  st = base(); st.pat[0] = fromString('xxxxxxxxxxxxxxxx'); st.pat[0].prob.fill(0.5);
  r = count(st, 30);
  ok(Math.abs(r.hits[0] / 240 - 0.5) < 0.1, `probability 50%: ${r.hits[0]} of 240`);
  st.params['c0.prob'] = 0.5; r = count(st, 30);
  ok(Math.abs(r.hits[0] / 240 - 0.25) < 0.08, `step and track probability multiply: ${r.hits[0]} of 240`);
  st = base(); st.pat[0] = fromString('x...............'); st.pat[1] = fromString('x...............'); st.params['c0.len'] = 5; st.params['c1.len'] = 16;
  r = count(st, 10);
  ok(r.hits[0] === 16 && r.hits[1] === 5, `track length 5 against 16: ${r.hits.slice(0, 2)}`);
  st = base(); st.pat[0] = fromString('x...x...x...x...'); st.pat[0].rat.fill(3);
  r = count(st, 8);
  ok(r.hits[0] === 48, `ratchet x3: ${r.hits[0]} hits`);
  st = base(); st.pat[0] = fromString('xxxxxxxxxxxxxxxx'); st.pat[1] = fromString('xxxxxxxxxxxxxxxx'); st.params['c0.mute'] = 1;
  r = count(st, 2); ok(r.hits[0] === 0 && r.hits[1] === 16, 'mute');
  st.params['c0.mute'] = 0; st.params['c0.solo'] = 1;
  r = count(st, 2); ok(r.hits[0] === 16 && r.hits[1] === 0, 'solo');
  // mute and solo also silence a drone, which sounds without any step
  st = base(); st.params['c8.g.env'] = 1; st.params.vol = 1;
  const dr = load(st, 1); dr.start();
  ok(rms(render(dr, 1)[0], SR / 2) > 0.01, 'drone sounds while running');
  dr.setParam('c8.mute', 1); ok(rms(render(dr, 1)[0], SR / 2) < 1e-5, 'mute silences a drone');
  dr.setParam('c8.mute', 0); ok(rms(render(dr, 1)[0], SR / 2) > 0.01, 'unmute brings the drone back');
  dr.setParam('c0.solo', 1); ok(rms(render(dr, 1)[0], SR / 2) < 1e-5, 'solo on another channel silences the drone');
  // swing delays every second 16th
  st = base(); st.pat[0] = fromString('xxxxxxxxxxxxxxxx'); st.params.swing = 0.5;
  const en = load(st, 1), at = []; en.start();
  { const o = en.trig.bind(en); let t = 0; en.trig = (c, v, n) => { at.push(t); o(c, v, n); }; const L = new Float32Array(1), R = new Float32Array(1); for (; t < SR; t++) en.process(L, R); }
  ok(Math.abs((at[1] - at[0]) / (at[2] - at[1]) - 1.25 / 0.75) < 0.01 && Math.abs(at[2] - at[0] - SR / 4) < 2, `swing timing: ${at.slice(0, 3)}`);
  // choke group: the closed hat cuts the open one
  st = base(); st.params['c4.d.decay'] = 1; st.params['c3.choke'] = 1; st.params['c4.choke'] = 1; st.params['c3.vol'] = 0;
  const e2 = load(st, 1); e2.trig(4, 1, 0); render(e2, 0.1); e2.trig(3, 1, 0);
  ok(rms(render(e2, 0.3)[0], SR * 0.1) < 1e-4, 'choke group');
}

// 7. randomising and evolution
{
  const rnd = rng(9);
  for (let i = 0; i < 200; i++) {
    const len = 1 + Math.floor(rnd() * 16), t = randomTrack(rnd, len, i & 1);
    ok(t.on.slice(0, len).some(Boolean) && t.on.slice(len).every((v) => !v), 'random track: empty or outside its length');
    ok(t.prob.every((v) => v > 0 && v <= 1) && t.vel.every((v) => v > 0 && v <= 1) && t.rat.every((v) => v >= 1 && v <= 4) && t.note.every((v) => Math.abs(v) <= 24), 'random track: value out of range');
  }
  const st = expand(FACTORY.find((f) => f.name === '808 + Strings'));
  st.params.bpm = 240; st.params['evo.bars'] = 0;
  for (let c = 0; c < NCH; c++) st.params[`c${c}.evo`] = c < 5 ? 0.5 : 0;
  const en = load(st, 4), before = en.pat.map(cloneTrack);
  en.start();
  const dist = (c) => { let d = 0; for (let i = 0; i < 16; i++) if (!sameStep(en.pat[c], en.base[c], i)) d++; return d; };
  let maxd = 0, changes = 0, seen = new Set();
  for (let bar = 0; bar < 200; bar++) {
    render(en, 1);
    for (let c = 0; c < 5; c++) { maxd = Math.max(maxd, dist(c)); seen.add(JSON.stringify(en.pat[c].on)); }
    changes += en.events.length; en.events.length = 0;
  }
  ok(changes > 60 && seen.size > 40, `evolution should keep changing the pattern (${changes} changes, ${seen.size} variants)`);
  ok(maxd >= 2 && maxd <= 7, `evolution should stay near the base pattern (max ${maxd} steps away)`);
  for (let c = 5; c < NCH; c++) ok(JSON.stringify(en.pat[c]) === JSON.stringify(before[c]), `track ${c} with evolve 0 changed`);
  for (let c = 0; c < NCH; c++) ok(en.pat[c].on.slice(0, 16).some(Boolean) || !before[c].on.some(Boolean), `track ${c} evolved into silence`);
  ok(JSON.stringify(en.base) === JSON.stringify(before), 'evolution must not touch the base pattern');
  en.revert(); ok(JSON.stringify(en.pat) === JSON.stringify(before), 'revert');
  console.log(`  evolution: ${changes} changes in 200 bars, at most ${maxd} steps from the base`);
  const t = fromString('x...x...x...x...'), b = cloneTrack(t); let any = false;
  for (let i = 0; i < 50; i++) any = mutate(t, b, rnd, 0, false, 16) || any;
  ok(!any && JSON.stringify(t) === JSON.stringify(b), 'mutate with amount 0');
}

// 8. factory presets: valid, audible, not clipping, affordable
for (const f of FACTORY) {
  const st = expand(f);
  for (const [id, v] of Object.entries(st.params)) {
    const d = PMAP.get(id);
    ok(d, `${f.name}: unknown parameter ${id}`);
    if (d) ok(v >= d.min - 1e-9 && v <= d.max + 1e-9 && (d.kind !== 'i' || Number.isInteger(v)), `${f.name}: ${id} = ${v} out of range`);
  }
  for (const m of st.macros) for (const t of m.targets) ok(PMAP.has(t.id) && t.from >= -1e-9 && t.from <= 1 + 1e-9 && t.to >= 0 && t.to <= 1, `${f.name}: macro ${m.name} target ${t.id}`);
  if (f.name === 'Init') continue;
  const en = load(st, 21); en.start();
  const t0 = performance.now(), [L, R] = render(en, 16), cpu = (performance.now() - t0) / 16000;
  const per = en.ch.map((c, i) => i).filter((i) => st.pat[i].on.some(Boolean));
  console.log(`${f.name.padEnd(20)} rms ${rms(L).toFixed(3)}/${rms(R).toFixed(3)} peak ${peak(L).toFixed(2)} pre-limiter ${en.peak.toFixed(2)} cpu ${(cpu * 100).toFixed(1)}% tracks ${per.length}`);
  ok(finite(L) && finite(R), `${f.name}: NaN in output`);
  ok(rms(L) > 0.05 && rms(L) < 0.35 && rms(R) > 0.05, `${f.name}: level`);
  ok(cpu < 0.35, `${f.name}: too expensive`);
  // every macro at both ends still sounds and stays finite
  for (const end of [0, 1]) {
    for (const m of st.macros) for (const t of m.targets) { const d = PMAP.get(t.id); en.setParam(t.id, d.kind === 'exp' ? d.min * Math.pow(d.max / d.min, end ? t.to : t.from) : d.min + (end ? t.to : t.from) * (d.max - d.min)); }
    const x = render(en, 4)[0];
    ok(finite(x) && rms(x) > 0.02 && rms(x) < 0.4, `${f.name}: macros at ${end} -> rms ${rms(x).toFixed(3)}`);
  }
  en.stop();
  for (let c = 0; c < NCH; c++) { en.setParam(`c${c}.dly`, 0); en.setParam(`c${c}.rev`, 0); }
  en.setParam('dly.fb', 0); en.setParam('rv.size', 0);
  const tail = render(en, 20)[0];
  ok(rms(tail, SR * 19) < 1e-4, `${f.name}: does not fall silent after stop (${rms(tail, SR * 19).toExponential(1)})`);
}

console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
