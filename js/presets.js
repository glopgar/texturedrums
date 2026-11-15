// Factory presets, written compactly and expanded into the full state the app works with:
// { name, params: {id: value}, names[10], gsrc[10], dsrc[10], pat[10], macros[8] }
import { NCH, NMACRO, PMAP, defaults, toNorm, fromNorm } from '../dsp/params.js';
import { fromString, newTrack } from '../dsp/pattern.js';

const M = { BD8: 0, BD9: 1, SD8: 2, SD9: 3, CP: 4, HH: 5, CY: 6, TOM: 7, CB: 8, RIM: 9, NZ: 10, FM: 11 };
const LP = 1, HP = 2, BP = 3, RING = 1, FMOD = 2, FILT = 3, GRAIN = 1, SYNTH = 2, SQR = 1, TRI = 2;

// channel: [name, pattern, params, { g: granular source, d: drum sample, notes }]
const kit808 = [
  ['BD', 'X...x...X...x.o.', { 'd.model': M.BD8, 'd.decay': 0.5, 'd.snap': 0.55, vol: 0.9 }],
  ['SD', '....X.......X..o', { 'd.model': M.SD8, 'd.decay': 0.45, 'd.snap': 0.7, rev: 0.12 }],
  ['CP', '....x.......x...', { 'd.model': M.CP, 'd.decay': 0.5, vol: 0.6, rev: 0.25 }],
  ['CH', 'x.x.x.x.x.x.x.xo', { 'd.model': M.HH, 'd.decay': 0.12, vol: 0.5, choke: 1, pan: 0.2 }],
  ['OH', '..x...x...x...x.', { 'd.model': M.HH, 'd.decay': 0.6, vol: 0.45, choke: 1, pan: 0.2, prob: 0.8 }],
  ['TOM', '.......x..o.....', { 'd.model': M.TOM, 'd.tune': -3, 'd.decay': 0.45, vol: 0.7, dly: 0.3, pan: -0.3 }],
  ['CB', '..........x..x..', { 'd.model': M.CB, vol: 0.4, prob: 0.6, pan: 0.35 }],
  ['RIM', '..x....x.x......', { 'd.model': M.RIM, vol: 0.6, pan: -0.25, dly: 0.15 }],
];
const pad = (src, extra = {}) => ({ mode: GRAIN, 'g.env': 1, 'g.voices': 3, 'g.size': 240, 'g.dens': 16, 'g.jit': 0.35, 'g.speed': 0.4, 'g.spread': 0.9, 'f.type': LP, 'f.cut': 3500, vol: 0.55, rev: 0.5, ...extra });
const all = (key, from, to, list = [...Array(NCH).keys()]) => list.map((c) => ({ id: `c${c}.${key}`, from, to }));

export const FACTORY = [
  {
    name: '808 + Strings', g: { bpm: 122 },
    ch: [
      ...kit808,
      ['PAD', 'x...............', pad(), { g: 'tex/strings' }],
      ['BELL', 'x..x..x...x..x..', { mode: GRAIN, 'g.voices': 2, 'g.n2': 12, 'g.size': 120, 'g.dens': 30, 'g.dec': 0.9, 'g.sync': 1, 'g.speed': 1, vol: 0.55, dly: 0.45, rev: 0.3, prob: 0.8, evo: 0.4 },
        { g: 'tex/bells', notes: [0, 0, 0, 3, 0, 0, 7, 0, 0, 0, 5, 0, 0, 10, 0, 0] }],
    ],
    macros: [
      ['Filter', all('f.cut', 18000, 250, [0, 1, 2, 3, 4, 5, 6, 7]), { 'f.type': LP }],
      ['Long', all('d.decay', null, 0.95, [0, 1, 2, 3, 4, 5, 6, 7])],
      ['Space', [...all('rev', null, 0.7), ...all('dly', null, 0.5, [1, 2, 5, 7])]],
      ['Martian', all('mod.amt', 0, 1, [0, 1, 2, 3, 4, 5, 6, 7]), { 'mod.type': RING }, 0],
    ],
    gdef: 'tex/radio', set: { 'mod.amt': 0, 'g.dens': 60, 'g.size': 40, 'g.dec': 0.4, 'g.pitch': 0 }, setOn: [0, 1, 2, 3, 4, 5, 6, 7],
  },
  {
    name: 'Marciano', g: { bpm: 104, swing: 0.15, 'dly.time': 3, 'dly.fb': 0.55, 'evo.bars': 1 },
    ch: [
      ['BD~', 'X..x..x.X...x...', { 'd.model': M.BD9, 'd.decay': 0.6, 'd.tone': 0.6, 'mod.type': FMOD, 'mod.amt': 0.55, 'g.dens': 90, 'g.size': 30, 'g.dec': 0.5, 'g.sync': 1, vol: 0.9, evo: 0.3 }, { g: 'tex/vox' }],
      ['SD~', '....X..o....X.o.', { 'd.model': M.SD9, 'mod.type': RING, 'mod.amt': 0.8, 'g.dens': 70, 'g.size': 25, 'g.pitch': 7, 'g.dec': 0.35, rev: 0.2, evo: 0.4 }, { g: 'tex/radio' }],
      ['ZAP', '..x......x...3..', { 'd.model': M.FM, 'd.tone': 0.35, 'd.snap': 0.8, 'd.decay': 0.4, 'mod.type': FILT, 'mod.amt': 0.6, 'f.cut': 1200, 'f.res': 0.7, 'g.dens': 40, 'g.size': 60, 'g.dec': 0.6, vol: 0.6, dly: 0.4, pan: -0.4, evo: 0.6 },
        { g: 'tex/radio', notes: [0, 0, 5, 0, 0, 0, 0, 0, 0, -7, 0, 0, 0, 12, 0, 0] }],
      ['HH~', 'x.xxx.x.x.xxx.xo', { 'd.model': M.HH, 'd.decay': 0.1, 'mod.type': RING, 'mod.amt': 0.6, 'g.dens': 100, 'g.size': 12, 'g.dec': 0.15, 'g.pjit': 0.6, vol: 0.5, choke: 1, pan: 0.3, evo: 0.5 }, { g: 'tex/wind' }],
      ['OH~', '......x.......x.', { 'd.model': M.CY, 'd.decay': 0.15, 'mod.type': FMOD, 'mod.amt': 0.4, 'g.dens': 50, 'g.size': 40, 'g.dec': 0.5, vol: 0.4, choke: 1, rev: 0.3, prob: 0.7 }, { g: 'tex/bells' }],
      ['VOX', 'x.....x...x.....', { mode: GRAIN, 'g.env': 1, 'g.size': 70, 'g.dens': 45, 'g.speed': 0.25, 'g.jit': 0.02, 'g.pitch': -12, 'g.lsDepth': 0.5, 'g.lsRate': 0.11, vol: 0.7, rev: 0.25, evo: 0.5 }, { g: 'tex/vox' }],
      ['BLIP', '...x..x..x..x...', { mode: GRAIN, 'g.sync': 1, 'g.speed': 2, 'g.start': 0.1, 'g.end': 0.3, 'g.mode': 2, 'g.size': 45, 'g.dens': 30, 'g.dec': 0.25, 'g.leDepth': 0.4, 'g.leRate': 0.7, 'g.lfoShape': 2, vol: 0.6, dly: 0.5, pan: 0.4, prob: 0.7, evo: 0.7, len: 12 },
        { g: 'tex/radio', notes: [0, 0, 0, 12, 0, 0, 7, 0, 0, 0, 0, 0, -5] }],
      ['RIM', '..x.......x..x..', { 'd.model': M.RIM, 'd.decay': 0.4, 'mod.type': FMOD, 'mod.amt': 0.3, 'g.dens': 80, 'g.size': 20, 'g.dec': 0.2, vol: 0.55, pan: -0.3, len: 14 }, { g: 'tex/glass' }],
      ['DRONE', 'x...............', pad({ 'g.voices': 2, 'g.n2': -12, 'g.pitch': -12, 'g.rev': 0.5, 'g.lsDepth': 0.6, 'g.leDepth': 0.6, 'f.cut': 1800, 'f.res': 0.5, vol: 0.5 }), { g: 'tex/radio' }],
      ['GLASS', '....x.......x...', { mode: GRAIN, 'g.voices': 3, 'g.n2': 3, 'g.n3': 10, 'g.size': 180, 'g.dens': 22, 'g.dec': 1.6, 'g.atk': 0.05, 'g.jit': 0.4, 'g.pjit': 0.15, vol: 0.5, rev: 0.6, dly: 0.3, prob: 0.6 }, { g: 'tex/glass', notes: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -2] }],
    ],
    macros: [
      ['Martian', all('mod.amt', 0, 1, [0, 1, 2, 3, 4, 7]), null, 0.6],
      ['Grain size', all('g.size', null, 400)],
      ['Loop wobble', [...all('g.lsDepth', null, 1), ...all('g.leDepth', null, 1)]],
      ['Filter', all('f.cut', null, 300, [0, 1, 3, 4, 6, 7, 9]), { 'f.type': LP }],
    ],
  },
  {
    name: 'Glass Clouds', g: { bpm: 84, 'rv.size': 0.85, 'rv.damp': 0.35, 'dly.time': 6, 'dly.fb': 0.6, 'evo.bars': 2 },
    ch: [
      ['BD', 'x.........x.....', { 'd.model': M.BD8, 'd.decay': 0.7, 'd.snap': 0.3, 'd.tone': 0.2, vol: 0.8, evo: 0.2 }],
      ['RIM', '....x.......x..o', { 'd.model': M.RIM, 'd.decay': 0.3, vol: 0.5, rev: 0.5, dly: 0.4, prob: 0.8, evo: 0.4 }],
      ['SHK', 'o.x.o.x.o.x.o.xo', { 'd.model': M.NZ, 'd.decay': 0.15, 'd.snap': 0.6, 'd.tone': 0.7, vol: 0.4, pan: 0.3, prob: 0.7, evo: 0.5 }],
      ['TOM', '......x......x..', { 'd.model': M.TOM, 'd.tune': 5, 'd.decay': 0.5, vol: 0.5, rev: 0.5, dly: 0.5, prob: 0.5, pan: -0.4, evo: 0.6, len: 11 }, { notes: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -5] }],
      ['GLASS', 'x...............', pad({ 'g.n2': 7, 'g.n3': 16, 'g.size': 400, 'g.dens': 10, 'g.lsDepth': 0.4, 'g.leDepth': 0.4, 'f.cut': 5000, rev: 0.7 }), { g: 'tex/glass' }],
      ['BELLS', 'x....x....x..x..', { mode: GRAIN, 'g.voices': 2, 'g.n2': 12, 'g.o2': 0.03, 'g.size': 160, 'g.dens': 20, 'g.dec': 2.2, 'g.jit': 0.5, vol: 0.5, rev: 0.7, dly: 0.5, prob: 0.7, evo: 0.7, len: 14 },
        { g: 'tex/bells', notes: [0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 3, 0, 0, 10] }],
      ['VOX', 'x.......x.......', { mode: GRAIN, 'g.env': 1, 'g.voices': 2, 'g.n2': 7, 'g.pitch': -12, 'g.size': 300, 'g.dens': 14, 'g.speed': 0.1, 'g.mode': 2, 'g.jit': 0.1, 'g.spread': 1, 'f.type': LP, 'f.cut': 2500, vol: 0.45, rev: 0.6 },
        { g: 'tex/vox', notes: [0, 0, 0, 0, 0, 0, 0, 0, -2] }],
      ['WIND', 'x...............', pad({ 'g.voices': 1, 'g.size': 500, 'g.dens': 8, 'g.pjit': 0.3, 'f.type': BP, 'f.cut': 1400, 'f.res': 0.6, vol: 0.4 }), { g: 'tex/wind' }],
      ['SPARK', '..x....x...x...x', { mode: GRAIN, 'g.pitch': 12, 'g.size': 25, 'g.dens': 60, 'g.dec': 0.3, 'g.pjit': 0.7, 'g.jit': 1, 'g.rev': 0.5, 'f.type': HP, 'f.cut': 2000, vol: 0.4, dly: 0.6, rev: 0.4, prob: 0.5, evo: 0.8, pan: 0.5 }, { g: 'tex/glass' }],
      ['SUB', 'x.......x..x....', { mode: SYNTH, 'y.w1': TRI, 'y.w2': TRI, 'y.oct': -2, 'y.sub': 0.5, 'y.cut': 300, 'y.res': 0.2, 'y.env': 0.3, 'y.fdec': 0.6, 'y.dec': 1.5, 'y.sus': 0.6, 'y.rel': 1.2, 'y.gate': 3, 'y.glide': 0.5, vol: 0.7 },
        { g: 'tex/strings', notes: [0, 0, 0, 0, 0, 0, 0, 0, -2, 0, 0, 3] }],
    ],
    macros: [
      ['Clouds', [...all('g.size', null, 700, [4, 5, 6, 7, 8]), ...all('g.jit', null, 1, [4, 5, 6, 7])]],
      ['Shimmer', [...all('g.pjit', null, 0.9, [4, 5, 8]), ...all('g.rev', null, 1, [4, 5, 6])]],
      ['Freeze', all('g.speed', null, 0, [4, 5, 6, 7])],
      ['Dark', all('f.cut', null, 300, [4, 5, 6, 8, 9])],
    ],
  },
  {
    name: 'Linn Dust', g: { bpm: 96, swing: 0.28 },
    ch: [
      ['KICK', 'X.....x.X..x....', { 'd.model': M.BD9, 'd.smix': 0.6, 'd.decay': 0.35, 'd.snap': 0.3, vol: 0.9 }, { d: 'LM-2/kick' }],
      ['SNARE', '....X.......X...', { 'd.model': M.SD9, 'd.smix': 0.75, 'd.decay': 0.3, rev: 0.15 }, { d: 'LM-2/snare-m' }],
      ['CLAP', '....x..o....x...', { 'd.model': M.CP, 'd.smix': 0.6, vol: 0.55, rev: 0.25 }, { d: 'LM-2/clap' }],
      ['HAT', 'x.x.x.x.x.x.x.x.', { 'd.smix': 1, vol: 0.5, choke: 1, pan: 0.25, evo: 0.3 }, { d: 'LM-2/hihat-closed' }],
      ['OPEN', '.......x......x.', { 'd.smix': 1, vol: 0.45, choke: 1, pan: 0.25, prob: 0.8 }, { d: 'LM-2/hihat-open' }],
      ['CONGA', '..x..x....x..x.o', { 'd.smix': 1, vol: 0.6, pan: -0.35, dly: 0.2, evo: 0.5 }, { d: 'LM-2/conga-m', notes: [0, 0, 0, 0, 0, -4, 0, 0, 0, 0, 3, 0, 0, -4, 0, 3] }],
      ['CABASA', 'o.xxo.xxo.xxo.xx', { 'd.smix': 1, vol: 0.35, pan: 0.4, prob: 0.85 }, { d: 'LM-2/cabasa' }],
      ['STICK', '..x.......x.....', { 'd.model': M.RIM, 'd.smix': 0.7, vol: 0.5, pan: -0.2, rev: 0.2 }, { d: 'LM-2/stick-m' }],
      ['RIDE~', 'x...............', pad({ 'g.voices': 2, 'g.n2': -5, 'g.pitch': -7, 'g.size': 150, 'g.dens': 25, 'g.rev': 0.5, 'g.speed': 0.2, 'f.type': BP, 'f.cut': 3000, 'f.res': 0.4, vol: 0.45 }), { g: 'LM-2/ride' }],
      ['TOM~', 'x.....x..x......', { mode: GRAIN, 'g.sync': 1, 'g.speed': 0, 'g.start': 0.02, 'g.voices': 2, 'g.n2': 7, 'g.size': 90, 'g.dens': 35, 'g.dec': 0.7, 'g.jit': 0.03, vol: 0.6, dly: 0.3, rev: 0.3, evo: 0.5 },
        { g: 'LM-2/tom-l', notes: [0, 0, 0, 0, 0, 0, 3, 0, 0, -2] }],
    ],
    macros: [
      ['Analog/Sample', all('d.smix', 0, 1, [0, 1, 2, 7]), null, 0.65],
      ['Tune', all('s.tune', -12, 12, [0, 1, 2, 3, 4, 5, 6, 7]), null, 0.5],
      ['Dust', [...all('drive', null, 0.7, [0, 1, 2, 3, 5]), ...all('f.cut', null, 2500, [0, 1, 2, 3, 5])], { 'f.type': LP }],
      ['Space', all('rev', null, 0.7)],
    ],
  },
  {
    name: 'CR-78 Garden', g: { bpm: 112, 'dly.time': 3, vol: 0.95 },
    ch: [
      ['KICK', 'x..x..x.x..x..x.', { 'd.smix': 1, vol: 0.9 }, { d: 'CR-78/kick' }],
      ['SNARE', '....x.......x...', { 'd.smix': 1, rev: 0.2 }, { d: 'CR-78/snare' }],
      ['RIM', '..x..x....x..x..', { 'd.smix': 1, vol: 0.6, pan: -0.3, dly: 0.25, evo: 0.4 }, { d: 'CR-78/rim' }],
      ['HAT', 'x.xxx.xxx.xxx.xx', { 'd.smix': 1, vol: 0.6, pan: 0.2 }, { d: 'CR-78/hihat' }],
      ['METAL', '......x.......x.', { 'd.smix': 1, vol: 0.5, pan: 0.2, prob: 0.8 }, { d: 'CR-78/hihat-metal' }],
      ['BONGO', '.x..x..x.o..x...', { 'd.smix': 1, vol: 0.6, pan: -0.4, evo: 0.6 }, { d: 'CR-78/bongo-h', notes: [0, 0, 0, 0, -5, 0, 0, 0, 0, 0, 0, 0, -5] }],
      ['GUIRO', '........x.......', { 'd.smix': 1, vol: 0.45, pan: 0.4, prob: 0.6 }, { d: 'CR-78/guiro-short' }],
      ['TAMB', '..x...x...x...x.', { 'd.smix': 1, vol: 0.4, pan: 0.3, rev: 0.2 }, { d: 'CR-78/tamb-short' }],
      ['BELLS', 'x..x..x.x..x.x..', { mode: GRAIN, 'g.sync': 1, 'g.speed': 1, 'g.voices': 2, 'g.n2': 12, 'g.size': 110, 'g.dens': 28, 'g.dec': 0.8, vol: 0.55, dly: 0.45, rev: 0.35, evo: 0.5 },
        { g: 'tex/bells', notes: [0, 0, 0, 7, 0, 0, 3, 0, 5, 0, 0, 10, 0, 7, 0, 0] }],
      ['COWB~', 'x.......x.......', { mode: GRAIN, 'g.speed': 0.3, 'g.voices': 3, 'g.n2': 4, 'g.n3': 7, 'g.pitch': -12, 'g.size': 200, 'g.dens': 18, 'g.dec': 2.5, 'g.atk': 0.2, 'g.jit': 0.3, vol: 0.5, rev: 0.6 },
        { g: 'CR-78/cowbell', notes: [0, 0, 0, 0, 0, 0, 0, 0, -4] }],
    ],
    macros: [
      ['Tune', all('s.tune', -12, 12, [0, 1, 2, 3, 4, 5, 6, 7]), null, 0.5],
      ['Short', all('s.decay', null, 0.05, [0, 1, 2, 3, 4, 5, 6, 7])],
      ['Garden', [...all('g.size', null, 500, [8, 9]), ...all('g.pjit', null, 0.6, [8, 9])]],
      ['Space', [...all('rev', null, 0.7), ...all('dly', null, 0.5, [2, 5, 8])]],
    ],
  },
  {
    name: 'Polymeter Evolver', g: { bpm: 128, 'evo.bars': 0, 'dly.time': 3, 'dly.fb': 0.5 },
    ch: [
      ['BD', 'x...x...x...x...', { 'd.model': M.BD9, 'd.decay': 0.4, 'd.smix': 0.4, vol: 0.9 }, { d: 'TR-505/kick' }],
      ['SD', '....x.......x...', { 'd.model': M.SD9, 'd.smix': 0.5, rev: 0.15, evo: 0.3 }, { d: 'TR-505/snare' }],
      ['CLAVE', 'x..x..x...x.', { 'd.smix': 1, vol: 0.55, pan: -0.3, dly: 0.3, evo: 0.5, len: 12 }, { d: 'MRK-2/clave' }],
      ['HAT', 'x.xx.x.xx.', { 'd.model': M.HH, 'd.decay': 0.1, 'd.smix': 0.4, vol: 0.45, pan: 0.25, evo: 0.6, len: 10 }, { d: 'TR-505/hihat-closed' }],
      ['BLOCK', 'x..x.x.', { 'd.smix': 1, vol: 0.5, pan: 0.4, evo: 0.6, len: 7 }, { d: 'MRK-2/block', notes: [0, 0, 0, 5, 0, -3] }],
      ['TIMBAL', 'x.x..', { 'd.smix': 1, vol: 0.45, pan: -0.45, dly: 0.35, prob: 0.7, evo: 0.7, len: 5 }, { d: 'TR-505/timbal', notes: [0, 0, 7] }],
      ['COWB', '..x...x.x', { 'd.model': M.CB, 'd.smix': 0.5, vol: 0.35, pan: 0.3, prob: 0.6, evo: 0.7, len: 9 }, { d: 'TR-505/cowb-h' }],
      ['FM', 'x.....x...x..', { 'd.model': M.FM, 'd.tune': -12, 'd.tone': 0.2, 'd.snap': 0.5, 'd.decay': 0.35, vol: 0.6, evo: 0.8, len: 13, 'f.type': LP, 'f.cut': 2500, 'f.res': 0.5 }, { notes: [0, 0, 0, 0, 0, 0, 3, 0, 0, 0, -2, 0, 0] }],
      ['GRAIN', 'x..x..x.x..', { mode: GRAIN, 'g.sync': 1, 'g.speed': 1, 'g.voices': 2, 'g.n2': 7, 'g.size': 50, 'g.dens': 40, 'g.dec': 0.3, 'g.leDepth': 0.5, 'g.leRate': 0.3, vol: 0.55, dly: 0.4, rev: 0.25, evo: 0.9, len: 11 },
        { g: 'tex/glass', notes: [0, 0, 0, 3, 0, 0, 7, 0, 10, 0, 0] }],
      ['PAD', 'x...............', pad({ 'g.n2': 3, 'g.n3': 7, vol: 0.4 }), { g: 'tex/strings' }],
    ],
    macros: [
      ['Evolve', all('evo', 0, 1), null, 0.6],
      ['Chance', all('prob', null, 0.3, [2, 3, 4, 5, 6, 7, 8])],
      ['Filter', all('f.cut', null, 300, [0, 1, 2, 3, 4, 5, 6]), { 'f.type': LP }],
      ['Space', [...all('rev', null, 0.7), ...all('dly', null, 0.6, [2, 4, 5, 8])]],
    ],
  },
  {
    name: 'Acid Clouds', g: { bpm: 126, 'dly.time': 3, 'dly.fb': 0.5, 'evo.bars': 1 },
    ch: [
      ['BD', 'x...x...x...x...', { 'd.model': M.BD9, 'd.decay': 0.4, 'd.snap': 0.45, vol: 0.9 }],
      ['CP', '....x.......x...', { 'd.model': M.CP, vol: 0.55, rev: 0.25 }],
      ['CH', 'xx.xxx.xxx.xxx.x', { 'd.model': M.HH, 'd.decay': 0.08, vol: 0.4, choke: 1, pan: 0.2, evo: 0.3 }],
      ['OH', '..x...x...x...x.', { 'd.model': M.HH, 'd.decay': 0.5, vol: 0.4, choke: 1, pan: 0.2 }],
      ['RIM', '...x..x....x..x.', { 'd.model': M.RIM, vol: 0.5, dly: 0.3, pan: -0.3, evo: 0.5 }],
      ['BASS', 'x.xx.x.xx.x.xx.x', { mode: SYNTH, 'y.oct': -1, 'y.mix': 0, 'y.sub': 0.4, 'y.cut': 350, 'y.res': 0.75, 'y.env': 0.6, 'y.fdec': 0.18, 'y.gate': 1.1, 'y.glide': 0.25, vol: 0.75, evo: 0.3 },
        { notes: [0, 0, 0, 12, 0, 0, 0, 3, 0, 0, 7, 0, 0, 12, 0, -2] }],
      ['LEAD', 'x.....x...x..x..', { mode: SYNTH, 'y.w1': SQR, 'y.w2': SQR, 'y.pw': 0.5, 'y.semi': 12, 'y.mix': 0.4, 'y.sub': 0, 'y.oct': 1, 'y.cut': 1800, 'y.res': 0.3, 'y.env': 0.4, 'y.fdec': 0.5,
        'y.dec': 1.2, 'y.sus': 0.3, 'y.rel': 0.8, 'y.gate': 1.6, 'y.glide': 0.45, vol: 0.45, dly: 0.45, rev: 0.3, pan: 0.2, prob: 0.85, evo: 0.5 },
        { notes: [7, 0, 0, 0, 0, 0, 10, 0, 0, 0, 12, 0, 0, 3, 0, 0] }],
      ['ALIEN', '....x.....x.....', { mode: SYNTH, 'y.w1': TRI, 'y.w2': TRI, 'y.oct': 0, 'y.cut': 3000, 'y.res': 0.5, 'y.gate': 2, 'y.rel': 0.5, 'mod.type': FMOD, 'mod.amt': 0.5, 'g.dens': 70, 'g.size': 30, 'g.dec': 0.5,
        vol: 0.45, crs: 0.4, pan: -0.3, evo: 0.6 }, { g: 'tex/radio', notes: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5] }],
      ['PAD', 'x...............', pad({ 'g.n2': 3, 'g.n3': 7, vol: 0.4 }), { g: 'tex/strings' }],
      ['BELL', '..x....x..x....x', { mode: GRAIN, 'g.sync': 1, 'g.voices': 2, 'g.n2': 12, 'g.size': 110, 'g.dens': 28, 'g.dec': 0.8, vol: 0.45, dly: 0.45, rev: 0.35, prob: 0.7, evo: 0.6 },
        { g: 'tex/bells', notes: [0, 0, 3, 0, 0, 0, 0, 7, 0, 0, 10, 0, 0, 0, 0, 5] }],
    ],
    macros: [
      ['Acid', [{ id: 'c5.y.cut', from: null, to: 5000 }, { id: 'c5.y.res', from: null, to: 0.92 }]],
      ['Env', all('y.env', null, 1, [5, 6])],
      ['Glide', all('y.glide', 0, 1, [5, 6]), null, 0.3],
      ['Space', [...all('rev', null, 0.7), ...all('dly', null, 0.5, [4, 6, 9])]],
    ],
  },
  { name: 'Init', g: {}, ch: kit808.map(([n, , p]) => [n, '', p]).concat([['TEX 1', '', { mode: GRAIN }, { g: 'tex/glass' }], ['TEX 2', '', { mode: GRAIN }, { g: 'tex/bells' }]]), macros: [] },
];

export const DEF_G = 'tex/glass', DEF_D = 'CR-78/kick';
export const emptyMacros = () => Array.from({ length: NMACRO }, (_, i) => ({ name: `Macro ${i + 1}`, value: 0, targets: [] }));

export function expand(f) {
  const params = defaults(), st = { name: f.name, params, names: [], gsrc: [], dsrc: [], pat: [], macros: emptyMacros() };
  for (const [k, v] of Object.entries(f.g || {})) params[k] = v;
  f.ch.forEach(([name, pat, p, x = {}], c) => {
    st.names[c] = name; st.gsrc[c] = x.g || f.gdef || DEF_G; st.dsrc[c] = x.d || DEF_D;
    st.pat[c] = pat ? fromString(pat, x.notes) : newTrack();
    if (f.set && f.setOn.includes(c)) for (const [k, v] of Object.entries(f.set)) params[`c${c}.${k}`] = v;
    for (const [k, v] of Object.entries(p)) params[`c${c}.${k}`] = v;
    if (pat && !('len' in p)) params[`c${c}.len`] = Math.max(1, Math.min(16, pat.replace(/\s/g, '').length));
  });
  // macro: [name, targets (real values), {param: value set on every target's channel}, starting value]
  (f.macros || []).forEach(([name, targets, also, value = 0], m) => {
    const mac = st.macros[m];
    mac.name = name; mac.value = value;
    for (const t of targets) {
      const d = PMAP.get(t.id);
      if (also) for (const [k, v] of Object.entries(also)) params[`c${d.ch}.${k}`] = v;
      mac.targets.push({ id: t.id, from: toNorm(d, t.from ?? params[t.id]), to: toNorm(d, t.to) });   // from null = as the channel is set
      params[t.id] = macroValue(d, mac.targets[mac.targets.length - 1], value);
    }
  });
  return st;
}

export const macroValue = (d, t, m) => fromNorm(d, t.from + (t.to - t.from) * m);
