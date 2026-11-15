// Parameter list shared by the engine, the panel and the tests.
export const NCH = 10, NSTEP = 16, NMACRO = 8, NVOICE = 4;

export const MODELS = ['BD 808', 'BD 909', 'SD 808', 'SD 909', 'CLAP', 'HAT', 'CYMBAL', 'TOM', 'COWBELL', 'RIM', 'NOISE', 'FM'];
export const MODS = ['OFF', 'RING', 'FM', 'FILTER', 'GATE'];

// [id, min, max, default, kind]   kind: lin (default) | exp | i (integer)
const C = [
  ['mix', 0, 1, 0],                 // 0 = drum only, 0.5 = both, 1 = grains only
  ['mod.type', 0, 4, 0, 'i'],       // how the grains modulate the drum
  ['mod.amt', 0, 1, 0.5],
  // drum: analog model + sample layer
  ['d.model', 0, MODELS.length - 1, 0, 'i'],
  ['d.tune', -24, 24, 0],
  ['d.decay', 0, 1, 0.5],
  ['d.tone', 0, 1, 0.5],
  ['d.snap', 0, 1, 0.5],
  ['d.smix', 0, 1, 0],              // 0 = analog only, 0.5 = both, 1 = sample only
  ['s.tune', -24, 24, 0],
  ['s.decay', 0, 1, 1],
  ['s.start', 0, 0.95, 0],
  // granular sampler: loop
  ['g.start', 0, 1, 0],
  ['g.end', 0, 1, 1],
  ['g.mode', 0, 2, 0, 'i'],         // forward, reverse, ping-pong
  ['g.speed', 0, 4, 1],
  ['g.sync', 0, 1, 0, 'i'],         // a trigger restarts the loop
  ['g.lsRate', 0.02, 20, 0.2, 'exp'],
  ['g.lsDepth', 0, 1, 0],
  ['g.leRate', 0.02, 20, 0.31, 'exp'],
  ['g.leDepth', 0, 1, 0],
  ['g.lfoShape', 0, 2, 0, 'i'],     // sine, triangle, random
  // granular sampler: grains
  ['g.size', 5, 800, 90, 'exp'],
  ['g.dens', 1, 120, 24, 'exp'],
  ['g.jit', 0, 1, 0.05],
  ['g.pjit', 0, 1, 0],
  ['g.spread', 0, 1, 0.6],
  ['g.shape', 0, 1, 0.5],
  ['g.rev', 0, 1, 0],
  ['g.pitch', -24, 24, 0, 'i'],
  ['g.voices', 1, NVOICE, 1, 'i'],
  ['g.n1', -24, 24, 0, 'i'], ['g.n2', -24, 24, 7, 'i'], ['g.n3', -24, 24, 12, 'i'], ['g.n4', -24, 24, -12, 'i'],
  ['g.o1', 0, 1, 0], ['g.o2', 0, 1, 0.25], ['g.o3', 0, 1, 0.5], ['g.o4', 0, 1, 0.75],
  ['g.env', 0, 1, 0, 'i'],          // trig (attack/decay) or drone (holds while the sequencer runs)
  ['g.atk', 0.001, 2, 0.005, 'exp'],
  ['g.dec', 0.02, 10, 0.6, 'exp'],
  // channel strip
  ['f.type', 0, 3, 0, 'i'],         // off, LP, HP, BP
  ['f.cut', 30, 18000, 18000, 'exp'],
  ['f.res', 0, 1, 0.2],
  ['drive', 0, 1, 0],
  ['vol', 0, 1, 0.8],
  ['pan', -1, 1, 0],
  ['dly', 0, 1, 0],
  ['rev', 0, 1, 0],
  ['crs', 0, 1, 0],                 // sends to the three effects: delay, reverb, crusher
  ['choke', 0, 4, 0, 'i'],
  // sequencer track
  ['len', 1, NSTEP, NSTEP, 'i'],
  ['prob', 0, 1, 1],
  ['evo', 0, 1, 0],
  ['mute', 0, 1, 0, 'i'],
  ['solo', 0, 1, 0, 'i'],
];
const G = [
  ['bpm', 40, 240, 120],
  ['swing', 0, 0.6, 0],
  ['vol', 0, 1, 0.8],
  ['evo.on', 0, 1, 1, 'i'],
  ['evo.bars', 0, 3, 1, 'i'],       // evolve every 1, 2, 4 or 8 bars
  ['dly.time', 1, 8, 3, 'i'],       // in 16th notes
  ['dly.fb', 0, 0.95, 0.45],
  ['dly.tone', 0, 1, 0.5],
  ['dly.lvl', 0, 1, 1],
  ['rv.size', 0, 1, 0.6],
  ['rv.damp', 0, 1, 0.5],
  ['rv.lvl', 0, 1, 1],
  ['cr.drive', 0, 1, 0.5],
  ['cr.rate', 0, 1, 0.3],           // sample-rate reduction
  ['cr.tone', 0, 1, 0.7],
  ['cr.lvl', 0, 1, 0.7],
];
export const EVO_BARS = [1, 2, 4, 8];

const mk = ([id, min, max, def, kind = 'lin']) => ({ id, min, max, def, kind });
export const CH_PARAMS = C.map(mk), GL_PARAMS = G.map(mk);
const keys = (list) => Object.fromEntries(list.map((d, i) => [d.id.replace(/\./g, '_'), i]));
export const CK = keys(CH_PARAMS), GK = keys(GL_PARAMS);

// Flat list: globals, then every channel parameter as "c<n>.<id>" (n = 0…9)
export const PARAMS = [
  ...GL_PARAMS.map((d, i) => ({ ...d, ch: -1, idx: i, key: d.id })),
  ...Array.from({ length: NCH }, (_, c) => CH_PARAMS.map((d, i) => ({ ...d, id: `c${c}.${d.id}`, ch: c, idx: i, key: d.id }))).flat(),
];
export const PMAP = new Map(PARAMS.map((d) => [d.id, d]));
export const defaults = () => Object.fromEntries(PARAMS.map((d) => [d.id, d.def]));

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export function toNorm(d, v) {
  if (d.kind === 'exp') return Math.log(v / d.min) / Math.log(d.max / d.min);
  return (v - d.min) / (d.max - d.min);
}
export function fromNorm(d, x) {
  x = clamp(x, 0, 1);
  if (d.kind === 'exp') return d.min * Math.pow(d.max / d.min, x);
  const v = d.min + x * (d.max - d.min);
  return d.kind === 'i' ? Math.round(v) : v;
}

// Small seeded generator, so the engine and the tests are repeatable
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
