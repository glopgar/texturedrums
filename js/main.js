// Application state, audio start-up, presets, macros and keyboard / MIDI input.
import { NCH, NMACRO, PMAP, defaults, toNorm, clamp } from '../dsp/params.js';
import { cloneTrack, newTrack, randomTrack, FIELDS } from '../dsp/pattern.js';
import { FACTORY, expand, emptyMacros, macroValue, DEF_G, DEF_D } from './presets.js';
import { pool, index, loadFactory, loadUser, addUser } from './samples.js';
import { buildUI, h } from './ui.js';
import { buildSeq } from './seq.js';
import { t, getLang, setLang } from './i18n.js';

const LS_STATE = 'texturedrums.state', LS_PRESETS = 'texturedrums.presets';
const S = { name: '', params: defaults(), names: [], gsrc: [], dsrc: [], pat: [], live: [], macros: emptyMacros(), sel: 0, tab: 'ch', mode: 'trig', learn: -1, running: false };
const app = { S, controls: [], sources: [] };
let ctx = null, node = null, ui, seq, engineState = null, saveTimer = 0;
const $ = (id) => document.getElementById(id);
const post = (m) => { if (node) node.port.postMessage(m); };
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* full or private */ } } };

// ---- state ----
const snapshot = () => ({ name: S.name, params: { ...S.params }, names: [...S.names], gsrc: [...S.gsrc], dsrc: [...S.dsrc], pat: S.pat.map(cloneTrack), macros: JSON.parse(JSON.stringify(S.macros)) });
const autosave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => store.set(LS_STATE, snapshot()), 800); };

function loadState(st) {
  const d = defaults();
  S.name = st.name || '';
  for (const id of Object.keys(d)) { const v = st.params?.[id], def = PMAP.get(id); S.params[id] = typeof v === 'number' && v === v ? clamp(v, def.min, def.max) : d[id]; }
  for (let c = 0; c < NCH; c++) {
    S.names[c] = st.names?.[c] || `CH ${c + 1}`;
    S.gsrc[c] = index.has(st.gsrc?.[c]) ? st.gsrc[c] : DEF_G; S.dsrc[c] = index.has(st.dsrc?.[c]) ? st.dsrc[c] : DEF_D;
    const tr = newTrack(), src = st.pat?.[c];
    if (src) for (const f of FIELDS) if (Array.isArray(src[f])) src[f].forEach((v, i) => { if (i < tr[f].length && typeof v === 'number') tr[f][i] = v; });
    S.pat[c] = tr; S.live[c] = cloneTrack(tr);
  }
  // states saved when channels still had a MIX control: mostly grains becomes a GRAIN channel; the GATE modulation is gone
  for (let c = 0; c < NCH; c++) {
    const mix = st.params?.[`c${c}.mix`];
    if (typeof mix === 'number') { if (st.params[`c${c}.mod.type`] === 4) S.params[`c${c}.mod.type`] = 0; if (mix >= 0.5 && !st.params[`c${c}.mode`]) S.params[`c${c}.mode`] = 1; }
  }
  S.macros = emptyMacros();
  (st.macros || []).slice(0, NMACRO).forEach((m, i) => {
    S.macros[i] = { name: m.name || `Macro ${i + 1}`, value: clamp(+m.value || 0, 0, 1), targets: (m.targets || []).filter((x) => PMAP.has(x.id)).map((x) => ({ id: x.id, from: clamp(+x.from || 0, 0, 1), to: clamp(+x.to || 0, 0, 1) })) };
  });
  S.learn = -1;
  pushAll(); refreshAll(); autosave();
}
function pushAll() {
  if (!node) return;
  post({ type: 'params', list: Object.entries(S.params) });
  for (let c = 0; c < NCH; c++) {
    post({ type: 'source', c, which: 'g', idx: index.get(S.gsrc[c]) }); post({ type: 'source', c, which: 'd', idx: index.get(S.dsrc[c]) });
    post({ type: 'track', c, track: S.live[c], base: S.pat[c] });
  }
  post({ type: 'view', c: S.sel });
}
function refreshAll() { ui.refresh(); ui.refreshTabs(); ui.refreshMacros(); ui.refreshSources(); seq.drawAll(); $('bpm').value = Math.round(S.params.bpm); $('swing').value = Math.round(S.params.swing * 100); }

app.setParam = (id, v) => {
  const d = PMAP.get(id);
  v = clamp(d.kind === 'i' ? Math.round(v) : v, d.min, d.max);
  if (S.params[id] === v) return;
  S.params[id] = v; post({ type: 'param', id, v });
  ui.refresh(id); if (d.key === 'mode' || d.key === 'mod.type') ui.refreshTabs();
  autosave();
};
app.selectFx = (id) => { S.tab = id; ui.refreshTabs(); };
app.select = (c) => { S.sel = c; S.tab = 'ch'; post({ type: 'view', c }); ui.setView(null); ui.refresh(); ui.refreshTabs(); ui.refreshSources(); seq.drawAll(); };
app.rename = (c) => { const n = prompt(t('newName'), S.names[c]); if (n) { S.names[c] = n.slice(0, 10).toUpperCase(); ui.refreshTabs(); seq.drawAll(); autosave(); } };
app.trig = async (c, vel = 0.9) => { await power(); post({ type: 'trig', c, vel, note: 0 }); };

// ---- samples ----
app.setSource = (c, which, id) => {
  if (!index.has(id)) return;
  S[which === 'g' ? 'gsrc' : 'dsrc'][c] = id; post({ type: 'source', c, which, idx: index.get(id) });
  ui.refreshSources(); autosave();
};
app.addFile = async (file, which) => {
  try {
    const r = await addUser(file);
    post({ type: 'sample', idx: r.at, data: r.entry.data, sr: r.entry.sr });
    ui.refreshSources(true); app.setSource(S.sel, which, r.entry.id);
    if (!r.stored) alert(t('noStore'));
  } catch (e) { alert(t('badFile') + file.name); }
};
app.loadFile = (which) => { const f = $('audiofile'); f.onchange = () => { if (f.files[0]) app.addFile(f.files[0], which); f.value = ''; }; f.click(); };

// ---- patterns ----
app.setStep = (c, i, s) => {
  for (const [f, v] of Object.entries(s)) { S.pat[c][f][i] = v; S.live[c][f][i] = v; }
  post({ type: 'step', c, i, s }); seq.drawCell(c, i); autosave();
};
const setTrack = (c, tr) => { S.pat[c] = cloneTrack(tr); S.live[c] = cloneTrack(tr); post({ type: 'track', c, track: tr, base: tr }); seq.drawTrack(c); autosave(); };
app.randomTrack = (c) => setTrack(c, randomTrack(Math.random, S.params[`c${c}.len`], S.params[`c${c}.mode`] > 0));
app.randomAll = () => { for (let c = 0; c < NCH; c++) app.randomTrack(c); };
app.clearAll = () => { for (let c = 0; c < NCH; c++) setTrack(c, newTrack()); };
app.revert = () => { S.live = S.pat.map(cloneTrack); post({ type: 'revert' }); seq.drawAll(); };
app.keep = () => { S.pat = S.live.map(cloneTrack); post({ type: 'keep' }); autosave(); };

// ---- macros ----
app.setMacro = (m, v) => {
  const mac = S.macros[m];
  mac.value = v;
  for (const x of mac.targets) app.setParam(x.id, macroValue(PMAP.get(x.id), x, v));
  ui.refreshMacros(); autosave();
};
app.learn = (m) => { S.learn = S.learn === m ? -1 : m; if (S.learn >= 0) app.setMacro(m, 1); else ui.refreshMacros(); };
// A control was moved from v0 to v1. While a macro is learning, that becomes its range for the control.
app.touched = (id, v0, v1, alt) => {
  if (S.learn < 0 || v0 === v1) return;
  const mac = S.macros[S.learn], d = PMAP.get(id);
  const ids = alt && d.ch >= 0 ? Array.from({ length: NCH }, (_, c) => `c${c}.${d.key}`) : [id];
  const dx = toNorm(d, v1) - toNorm(d, v0);
  for (const one of ids) {
    for (const other of S.macros) if (other !== mac) other.targets = other.targets.filter((x) => x.id !== one);
    const from = one === id ? toNorm(d, v0) : toNorm(d, S.params[one]), had = mac.targets.find((x) => x.id === one);
    if (had) had.to = clamp(one === id ? toNorm(d, v1) : had.to + dx, 0, 1); else mac.targets.push({ id: one, from, to: clamp(from + dx, 0, 1) });
  }
  app.setMacro(S.learn, 1);      // while learning the macro sits at its maximum, so controls stay where they are left
  ui.refresh();
};
app.renameMacro = (m) => { const n = prompt(t('newName'), S.macros[m].name); if (n) { S.macros[m].name = n.slice(0, 16); ui.refreshMacros(); autosave(); } };

function menu(e, items) {
  const el = $('menu');
  el.textContent = '';
  for (const [label, fn] of items) el.append(h('button', { onclick: () => { el.hidden = true; fn(); } }, label));
  el.hidden = false;
  el.style.left = `${Math.min(e.clientX, innerWidth - 220)}px`; el.style.top = `${Math.min(e.clientY, innerHeight - items.length * 30 - 10)}px`;
}
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#menu')) $('menu').hidden = true; });
app.paramMenu = (e, id) => {
  const items = [[t('reset'), () => app.setParam(id, PMAP.get(id).def)]];
  S.macros.forEach((mac) => { if (mac.targets.some((x) => x.id === id)) items.push([t('removeFrom', mac.name), () => { mac.targets = mac.targets.filter((x) => x.id !== id); ui.refresh(); ui.refreshMacros(); autosave(); }]); });
  menu(e, items);
};
app.macroMenu = (e, m) => menu(e, [
  [t('rename'), () => app.renameMacro(m)],
  [t('clearMacro'), () => { S.macros[m].targets = []; ui.refresh(); ui.refreshMacros(); autosave(); }],
]);

// ---- audio ----
let powering = null;
function power() {
  if (node) return ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
  return powering ||= (async () => {
    ctx = new AudioContext({ latencyHint: 'interactive' });
    await ctx.audioWorklet.addModule('dsp/worklet.js?v=1');
    node = new AudioWorkletNode(ctx, 'texturedrums', { numberOfInputs: 0, outputChannelCount: [2] });
    node.connect(ctx.destination);
    node.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'state') { engineState = d.state; ui.setView(d.state.view); }
      else if (d.type === 'pattern') { S.live[d.c] = d.track; seq.drawTrack(d.c); }
    };
    pool.forEach((s, idx) => post({ type: 'sample', idx, data: s.data, sr: s.sr }));
    pushAll();
    window.__td = { ctx, node };
  })();
}
async function run(on) {
  await power();
  S.running = on; post({ type: 'run', on });
  $('play').classList.toggle('on', on); $('play').lastChild.textContent = on ? t('stop') : t('play');
  if (!on) engineState = null;
}

// ---- presets ----
function fillPresets() {
  const sel = $('preset'), user = store.get(LS_PRESETS) || {};
  sel.textContent = '';
  sel.append(h('optgroup', { label: t('factory') }, FACTORY.map((f, i) => h('option', { value: `f${i}` }, f.name))));
  if (Object.keys(user).length) sel.append(h('optgroup', { label: t('user') }, Object.keys(user).sort().map((n) => h('option', { value: `u${n}` }, n))));
  const cur = [...sel.options].find((o) => o.textContent === S.name);
  if (cur) sel.value = cur.value; else sel.selectedIndex = -1;
}
function initBar() {
  $('play').onclick = () => run(!S.running);
  $('preset').onchange = (e) => { const v = e.target.value; loadState(v[0] === 'f' ? expand(FACTORY[+v.slice(1)]) : (store.get(LS_PRESETS) || {})[v.slice(1)]); };
  $('save').onclick = () => { const n = prompt(t('saveAs'), S.name); if (!n) return; S.name = n; const all = store.get(LS_PRESETS) || {}; all[n] = snapshot(); store.set(LS_PRESETS, all); fillPresets(); autosave(); };
  $('del').onclick = () => { const v = $('preset').value; if (!v || v[0] !== 'u' || !confirm(t('delAsk', v.slice(1)))) return; const all = store.get(LS_PRESETS) || {}; delete all[v.slice(1)]; store.set(LS_PRESETS, all); fillPresets(); };
  $('export').onclick = () => { const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify({ texturedrums: 1, ...snapshot() }, null, 1)], { type: 'application/json' })), download: `${S.name || 'texturedrums'}.json` }); a.click(); URL.revokeObjectURL(a.href); };
  $('import').onclick = () => $('file').click();
  $('file').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const st = JSON.parse(await f.text()); if (!st.texturedrums || !st.params) throw 0; loadState(st); fillPresets(); } catch (err) { alert(t('badPreset')); }
  };
  const bind = (el, id, scale) => { el.onchange = () => { app.setParam(id, (+el.value || 0) / scale); el.value = Math.round(S.params[id] * scale); }; app.controls.push({ id, draw: () => { if (document.activeElement !== el) el.value = Math.round(S.params[id] * scale); } }); };
  bind($('bpm'), 'bpm', 1); bind($('swing'), 'swing', 100);
  $('help').onclick = () => { const d = $('dlg'); d.innerHTML = `${t('helpText')}<form method="dialog"><button>OK</button></form>`; d.showModal(); };
  $('lang').value = getLang();
  $('lang').onchange = (e) => { setLang(e.target.value); store.set(LS_STATE, snapshot()); location.reload(); };
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
}

// ---- keyboard and MIDI ----
const TRIG_KEYS = 'qwertyuiop', SEL_KEYS = '1234567890';
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (e.code === 'Space') { e.preventDefault(); run(!S.running); }
  else if (TRIG_KEYS.includes(k) && !e.repeat) app.trig(TRIG_KEYS.indexOf(k));
  else if (SEL_KEYS.includes(k)) app.select(SEL_KEYS.indexOf(k));
  else if (e.key === 'Escape' && S.learn >= 0) app.learn(S.learn);
});
async function initMidi() {
  if (!navigator.requestMIDIAccess) return;
  try {
    const acc = await navigator.requestMIDIAccess();
    const hook = () => { for (const inp of acc.inputs.values()) inp.onmidimessage = (e) => {
      const [st, a, b] = e.data, cmd = st & 0xf0;
      if (cmd === 0x90 && b > 0 && a >= 36 && a < 36 + NCH) app.trig(a - 36, b / 127);
      else if (cmd === 0xb0 && a >= 70 && a < 70 + NMACRO) app.setMacro(a - 70, b / 127);
    }; };
    hook(); acc.onstatechange = hook;
  } catch (e) { /* MIDI refused: carry on without it */ }
}

// ---- start ----
async function init() {
  ui = buildUI(app); seq = buildSeq(app, ui);
  initBar();
  $('status').textContent = t('loading');
  await loadFactory(); await loadUser();
  $('status').textContent = '';
  ui.refreshSources(true);
  loadState(store.get(LS_STATE) || expand(FACTORY[0]));
  fillPresets();
  initMidi();
  const frame = () => { ui.frame(engineState?.levels); seq.frame(S.running ? engineState?.pos : null, engineState?.levels); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  window.__app = app;
}
init();
