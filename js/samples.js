// The sample pool: built-in textures, the public-domain drum machine kits and whatever the user loads.
// A sample's position in the pool is its number in the engine.
import { parseWav, normalise } from '../dsp/wav.js';
import { TEXTURES, buildTexture } from '../dsp/textures.js';

export const pool = [], index = new Map();
function add(entry) {
  const at = index.has(entry.id) ? index.get(entry.id) : pool.length;
  pool[at] = entry; index.set(entry.id, at); entry.peaks = null;
  return at;
}

export async function loadFactory() {
  for (const t of TEXTURES) add({ id: t.id, name: t.name, group: 'Textures', ...buildTexture(t) });
  const man = await (await fetch('samples/manifest.json')).json();
  await Promise.all(man.kits.flatMap((kit) => kit.files.map(async (f) => {
    try {
      const s = parseWav(await (await fetch(`samples/${kit.id}/${f}.wav`)).arrayBuffer());
      return { id: `${kit.id}/${f}`, name: f, group: kit.name, data: normalise(s.data), sr: s.sr };
    } catch (e) { console.warn('sample', kit.id, f, e); return null; }
  }))).then((list) => list.forEach((e) => e && add(e)));
}

// User samples are kept in IndexedDB so presets that use them still work after a reload
const db = () => new Promise((res, rej) => {
  const r = indexedDB.open('texturedrums', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('samples', { keyPath: 'id' });
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const tx = async (mode, fn) => {
  const d = await db();
  return new Promise((res, rej) => { const t = d.transaction('samples', mode), q = fn(t.objectStore('samples')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); });
};
export async function loadUser() {
  try { for (const e of await tx('readonly', (s) => s.getAll())) add({ ...e, group: 'User' }); } catch (e) { console.warn('user samples', e); }
}
export async function addUser(file) {
  const ac = new OfflineAudioContext(1, 1, 44100), buf = await ac.decodeAudioData(await file.arrayBuffer());
  const data = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) { const x = buf.getChannelData(c); for (let i = 0; i < data.length; i++) data[i] += x[i] / buf.numberOfChannels; }
  const name = file.name.replace(/\.[^.]+$/, ''), entry = { id: `user/${name}`, name, group: 'User', data, sr: buf.sampleRate };
  const at = add(entry);
  let stored = true;
  try { await tx('readwrite', (s) => s.put({ id: entry.id, name, data, sr: entry.sr })); } catch (e) { stored = false; console.warn('could not store sample', e); }
  return { at, entry, stored };
}
export async function removeUser(id) { try { await tx('readwrite', (s) => s.delete(id)); } catch (e) { console.warn(e); } }

// Min/max per column for the waveform display
export function peaks(entry, w) {
  if (entry.peaks && entry.peaks.w === w) return entry.peaks;
  const lo = new Float32Array(w), hi = new Float32Array(w), d = entry.data, n = d.length;
  for (let x = 0; x < w; x++) {
    const a = Math.floor(x * n / w), b = Math.max(a + 1, Math.floor((x + 1) * n / w)), step = Math.max(1, Math.floor((b - a) / 400));
    let mn = 1, mx = -1;
    for (let i = a; i < b; i += step) { const v = d[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    lo[x] = mn; hi[x] = mx;
  }
  return entry.peaks = { w, lo, hi };
}
