// Sequencer tracks: plain arrays so they travel as JSON. Randomising and slow evolution live here.
import { NSTEP, clamp } from './params.js';

export const FIELDS = ['on', 'vel', 'prob', 'note', 'rat', 'mix'];   // mix: -1 = the channel's MIX knob, 0…1 = this step's own mix
export const newTrack = () => ({
  on: new Array(NSTEP).fill(0), vel: new Array(NSTEP).fill(0.75), prob: new Array(NSTEP).fill(1),
  note: new Array(NSTEP).fill(0), rat: new Array(NSTEP).fill(1), mix: new Array(NSTEP).fill(-1),
});
export const cloneTrack = (t) => Object.fromEntries(FIELDS.map((f) => [f, t[f].slice()]));
export const sameStep = (a, b, i) => a.on[i] === b.on[i] && (!a.on[i] || FIELDS.every((f) => a[f][i] === b[f][i]));
const copyStep = (to, j, from, i) => { for (const f of FIELDS) to[f][j] = from[f][i]; };

// 'x' hit, 'X' accent, 'o' ghost (quiet and only sometimes), '.' rest
export function fromString(str, notes) {
  const t = newTrack();
  [...str.replace(/\s/g, '')].slice(0, NSTEP).forEach((c, i) => {
    if (c === '.') return;
    t.on[i] = 1;
    t.vel[i] = c === 'X' ? 1 : c === 'o' ? 0.4 : 0.75;
    if (c === 'o') t.prob[i] = 0.6;
    if (c >= '2' && c <= '4') t.rat[i] = +c;
  });
  if (notes) notes.forEach((v, i) => { if (i < NSTEP) t.note[i] = v; });
  return t;
}

const SCALE = [0, 3, 5, 7, 10, 12, -2, -5];
const pick = (a, rnd) => a[Math.floor(rnd() * a.length)];

// A new pattern: an evenly spread (Euclidean) figure, rotated, with accents, ghosts and uneven odds
export function randomTrack(rnd, len, melodic, density = rnd() * rnd()) {
  const t = newTrack(), hits = clamp(Math.round(1 + density * (len - 1) * 0.75), 1, len), rot = Math.floor(rnd() * len);
  for (let i = 0; i < len; i++) {
    if (Math.floor(((i + 1) * hits) / len) === Math.floor((i * hits) / len)) continue;
    const j = (i + rot) % len;
    t.on[j] = 1;
    t.vel[j] = rnd() < 0.3 ? 1 : 0.55 + rnd() * 0.3;
    t.prob[j] = rnd() < 0.7 ? 1 : 0.5 + rnd() * 0.4;
    if (rnd() < 0.06) t.rat[j] = 2 + Math.floor(rnd() * 2);
    if (melodic) t.note[j] = pick(SCALE, rnd);
  }
  for (let i = 0; i < len; i++) {
    if (!t.on[i] && rnd() < 0.08) { t.on[i] = 1; t.vel[i] = 0.3 + rnd() * 0.2; t.prob[i] = 0.3 + rnd() * 0.4; if (melodic) t.note[i] = pick(SCALE, rnd); }
  }
  return t;
}

// One round of evolution. amt (0…1) is the chance of each of three small changes; the further the
// track has drifted from its base, the more likely a change is to put a step back as it was.
export function mutate(t, base, rnd, amt, melodic, len) {
  let changed = false;
  for (let k = 0; k < 3; k++) {
    if (rnd() >= amt) continue;
    const diff = [], on = [], off = [];
    for (let i = 0; i < len; i++) { if (!sameStep(t, base, i)) diff.push(i); (t.on[i] ? on : off).push(i); }
    if (diff.length > 2 + amt * 6 || (diff.length && rnd() < 0.3)) {
      const i = pick(diff, rnd); copyStep(t, i, base, i); changed = true; continue;
    }
    const kind = rnd();
    if (kind < 0.25 && on.length && off.length) {            // slide a hit to a free neighbour
      const i = pick(on, rnd), j = (i + (rnd() < 0.5 ? 1 : len - 1)) % len;
      if (!t.on[j]) { copyStep(t, j, t, i); t.on[i] = 0; changed = true; }
    } else if (kind < 0.45 && off.length) {                  // add a ghost note
      const j = pick(off, rnd);
      t.on[j] = 1; t.vel[j] = 0.3 + rnd() * 0.3; t.prob[j] = 0.4 + rnd() * 0.4; t.rat[j] = 1;
      t.note[j] = melodic && on.length ? t.note[pick(on, rnd)] : 0; t.mix[j] = -1; changed = true;
    } else if (kind < 0.58 && on.length > 1) {               // drop a hit
      t.on[pick(on, rnd)] = 0; changed = true;
    } else if (kind < 0.74 && on.length) {                   // change the odds of a hit
      const i = pick(on, rnd); t.prob[i] = clamp(Math.round((t.prob[i] + (rnd() - 0.5) * 0.5) * 20) / 20, 0.2, 1); changed = true;
    } else if (kind < 0.88 && on.length) {                   // change how hard it hits
      const i = pick(on, rnd); t.vel[i] = clamp(Math.round((t.vel[i] + (rnd() - 0.5) * 0.5) * 20) / 20, 0.2, 1); changed = true;
    } else if (on.length) {                                  // move a note, or add / remove a roll
      const i = pick(on, rnd);
      if (melodic) t.note[i] = clamp(t.note[i] + pick([-7, -5, -3, -2, 2, 3, 5, 7], rnd), -24, 24);
      else t.rat[i] = t.rat[i] > 1 ? 1 : 2;
      changed = true;
    }
  }
  return changed;
}
