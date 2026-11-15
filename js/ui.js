// Panel widgets (knob, switch, list, number) and the upper areas: channel and effect tabs, their panels, macros.
import { PMAP, NCH, NMACRO, NVOICE, MODELS, MODS, toNorm, fromNorm, clamp } from '../dsp/params.js';
import { pool, index, peaks } from './samples.js';
import { t } from './i18n.js';

export const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const k of kids.flat(Infinity)) if (k != null) el.append(k);
  return el;
};
export const MCOL = ['#ff6b6b', '#ffa94d', '#ffd43b', '#a9e34b', '#63e6be', '#4dabf7', '#b197fc', '#f783ac'];

const pct = (v) => `${Math.round(v * 100)}%`, st = (v) => `${v > 0 ? '+' : ''}${Number.isInteger(v) ? v : v.toFixed(1)} st`;
const bal = (a, b) => (v) => (v <= 0.005 ? a : v >= 0.995 ? b : `${Math.round((1 - v) * 100)}:${Math.round(v * 100)}`);
const hz = (v) => `${v < 10 ? v.toFixed(2) : v.toFixed(0)} Hz`, secs = (v) => (v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(1)} s`);
const FMT = {
  mix: bal('DRUM', 'GRAIN'), 'd.smix': bal('ANALOG', 'SAMPLE'), 'd.tune': st, 's.tune': st, 'g.pitch': st,
  'g.n1': st, 'g.n2': st, 'g.n3': st, 'g.n4': st,
  'g.size': (v) => `${Math.round(v)} ms`, 'g.dens': hz, 'g.lsRate': hz, 'g.leRate': hz, 'g.speed': (v) => `${v.toFixed(2)}×`,
  'g.atk': secs, 'g.dec': secs, 'f.cut': (v) => (v < 1000 ? `${Math.round(v)} Hz` : `${(v / 1000).toFixed(1)} k`),
  pan: (v) => (Math.abs(v) < 0.02 ? 'C' : `${v < 0 ? 'L' : 'R'}${Math.round(Math.abs(v) * 100)}`),
  bpm: (v) => `${Math.round(v)}`, 'dly.time': (v) => `${v}/16`, len: (v) => `${v}`,
};
export const fmt = (d, v) => (FMT[d.key] || pct)(v);
const OPTS = {
  'g.mode': ['FWD', 'REV', 'PING'], 'g.lfoShape': ['SIN', 'TRI', 'RND'], 'g.env': ['TRIG', 'DRONE'], 'g.sync': ['FREE', 'SYNC'],
  'g.voices': ['1', '2', '3', '4'], 'f.type': ['OFF', 'LP', 'HP', 'BP'], 'mod.type': MODS, 'd.model': MODELS,
  choke: ['–', 'A', 'B', 'C', 'D'], 'evo.bars': ['1', '2', '4', '8'],
};

export function buildUI(app) {
  const S = app.S;
  const reg = (c) => { app.controls.push(c); return c.el; };
  const pid = (o) => o.id || `c${S.sel}.${o.key}`;
  const arc = (a0, a1, r = 15) => {
    const p = (a) => `${(20 + r * Math.sin(a)).toFixed(2)} ${(20 - r * Math.cos(a)).toFixed(2)}`;
    return Math.abs(a1 - a0) < 0.01 ? '' : `M${p(a0)}A${r} ${r} 0 ${Math.abs(a1 - a0) > Math.PI ? 1 : 0} ${a1 > a0 ? 1 : 0} ${p(a1)}`;
  };

  // drag / wheel / double-click behaviour shared by knobs and number boxes
  function draggable(el, o, range = 160) {
    let y0 = 0, x0 = 0, v0 = 0, wheelFrom = null, wheelTimer = 0;
    el.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      const d = PMAP.get(pid(o));
      el.setPointerCapture(e.pointerId); y0 = e.clientY; v0 = S.params[d.id]; x0 = toNorm(d, v0); el.classList.add('drag');
      const move = (ev) => app.setParam(d.id, fromNorm(d, x0 + (y0 - ev.clientY) / (ev.shiftKey ? range * 5 : range)));
      const up = (ev) => {
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
        el.classList.remove('drag'); app.touched(d.id, v0, S.params[d.id], ev.altKey);
      };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const d = PMAP.get(pid(o)), dir = e.deltaY < 0 ? 1 : -1, v = S.params[d.id];
      if (wheelFrom == null) wheelFrom = v;
      app.setParam(d.id, d.kind === 'i' ? clamp(v + dir, d.min, d.max) : fromNorm(d, toNorm(d, v) + dir * (e.shiftKey ? 0.004 : 0.02)));
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => { app.touched(d.id, wheelFrom, S.params[d.id], e.altKey); wheelFrom = null; }, 400);
    }, { passive: false });
    el.addEventListener('dblclick', () => { const d = PMAP.get(pid(o)); app.setParam(d.id, d.def); });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); app.paramMenu(e, pid(o)); });
  }
  const markMacro = (el, id) => {
    const m = S.macros.findIndex((mac) => mac.targets.some((x) => x.id === id));
    el.classList.toggle('mac', m >= 0); el.style.setProperty('--mc', m >= 0 ? MCOL[m] : 'transparent');
  };

  function knob(o) {
    const el = h('div', { class: `knob ${o.cls || ''}`, title: o.tip || '' });
    el.innerHTML = `<span class="kl">${o.label}</span><svg viewBox="0 0 40 40"><path class="kt" d="${arc(-2.35, 2.35)}"/><path class="kv"/><circle class="kb" cx="20" cy="20" r="10.5"/><line class="kp" x1="20" y1="20" x2="20" y2="10"/><circle class="km" cx="33" cy="7" r="3.2"/></svg><span class="kval"></span>`;
    const kv = el.querySelector('.kv'), kp = el.querySelector('.kp'), val = el.querySelector('.kval');
    o.el = el;
    o.draw = () => {
      const d = PMAP.get(pid(o)), v = S.params[d.id], x = toNorm(d, v), a = -2.35 + x * 4.7;
      kv.setAttribute('d', d.min < 0 ? arc(0, a) : arc(-2.35, a));
      kp.setAttribute('transform', `rotate(${(a * 180 / Math.PI).toFixed(1)} 20 20)`);
      val.textContent = fmt(d, v); markMacro(el, d.id);
    };
    draggable(el, o);
    return reg(o);
  }
  function num(o) {           // small number box, dragged like a knob (sequencer rows, tempo)
    const el = h('div', { class: `num ${o.cls || ''}`, title: o.tip || '' });
    o.el = el;
    o.draw = () => { const d = PMAP.get(pid(o)), v = S.params[d.id]; el.textContent = fmt(d, v); el.style.setProperty('--x', toNorm(d, v)); markMacro(el, d.id); };
    draggable(el, o, o.range || 120);
    return reg(o);
  }
  function seg(o) {           // row of buttons for a parameter with a few named values
    const names = OPTS[o.key || o.id], el = h('div', { class: `seg ${o.cls || ''}` });
    if (o.label) el.append(h('span', { class: 'kl' }, o.label));
    const row = h('div', { class: 'segrow' }); el.append(row);
    const btns = names.map((n, i) => h('button', { onclick: () => { const d = PMAP.get(pid(o)); app.setParam(d.id, d.min + i); } }, n));
    row.append(...btns);
    o.el = el;
    o.draw = () => { const d = PMAP.get(pid(o)), v = S.params[d.id] - d.min; btns.forEach((b, i) => b.classList.toggle('on', i === v)); };
    return reg(o);
  }
  function list(o) {          // drop-down for a parameter with many named values
    const sel = h('select', { onchange: () => { const d = PMAP.get(pid(o)); app.setParam(d.id, d.min + sel.selectedIndex); } }, OPTS[o.key].map((n) => h('option', {}, n)));
    o.el = h('div', { class: 'seg' }, h('span', { class: 'kl' }, o.label), sel);
    o.draw = () => { const d = PMAP.get(pid(o)); sel.selectedIndex = S.params[d.id] - d.min; };
    return reg(o);
  }
  function toggle(o) {
    const el = h('button', { class: `tgl ${o.cls || ''}`, title: o.tip || '', onclick: () => { const d = PMAP.get(pid(o)); app.setParam(d.id, S.params[d.id] ? 0 : 1); } }, o.label);
    o.el = el; o.draw = () => el.classList.toggle('on', S.params[pid(o)] >= 0.5);
    return reg(o);
  }
  function source(which, stacked) {    // sample picker for the granular sampler ('g') or the drum's sample layer ('d')
    const sel = h('select', { class: 'src', onchange: () => app.setSource(S.sel, which, sel.value) });
    const o = { src: which, el: h('div', { class: `srcrow${stacked ? ' stacked' : ''}` }, sel, h('button', { title: t('loadTip'), onclick: () => app.loadFile(which) }, t('load'))) };
    o.fill = () => {
      sel.textContent = '';
      const groups = new Map();
      for (const e of pool) { if (!groups.has(e.group)) groups.set(e.group, h('optgroup', { label: e.group })); groups.get(e.group).append(h('option', { value: e.id }, e.name)); }
      sel.append(...groups.values()); o.draw();
    };
    o.draw = () => { sel.value = S[which === 'g' ? 'gsrc' : 'dsrc'][S.sel]; };
    app.sources.push(o);
    return o.el;
  }
  const box = (title, cls, ...kids) => h('section', { class: `box ${cls}` }, h('h3', {}, title), h('div', { class: 'boxin' }, kids));
  const col = (...kids) => h('div', { class: 'col' }, kids), row = (...kids) => h('div', { class: 'row' }, kids);
  const K = (key, label, extra) => knob({ key, label, ...extra });
  // the ten channels' sends to one effect, side by side on that effect's page
  const sendNames = [];
  function sendsBox(key) {
    return box('SENDS FROM EACH CHANNEL', 'strip wide', row(Array.from({ length: NCH }, (_, c) => {
      const el = knob({ id: `c${c}.${key}`, label: '' }); sendNames.push({ c, el: el.firstChild }); return el;
    })));
  }

  // ---- tabs ----
  const tabs = document.getElementById('tabs');
  const tabEls = Array.from({ length: NCH }, (_, c) => h('button', {
    class: 'tab', onclick: () => app.select(c), ondblclick: () => app.rename(c),
  }, h('i', { class: 'led' }), h('b', {}, `${c + 1}`), h('span')));
  const FX = [['dly', 'DELAY'], ['rev', 'REVERB'], ['crs', 'CRUSHER']];
  const fxTabs = FX.map(([id, name]) => h('button', { class: 'tab fx', onclick: () => app.selectFx(id) }, h('b', {}, 'FX'), h('span', {}, name)));
  tabs.append(...tabEls, ...fxTabs);

  // ---- channel panel ----
  const wave = h('canvas', { class: 'wave' });
  const panel = document.getElementById('panel');
  const voices = Array.from({ length: NVOICE }, (_, i) => col(K(`g.n${i + 1}`, `PITCH ${i + 1}`), K(`g.o${i + 1}`, `OFFSET ${i + 1}`)));
  const chPanel = h('div', { class: 'pages' }), G = (id, label) => knob({ id, label });
  chPanel.append(
    h('div', { class: 'prow' },
      box('GRANULAR SAMPLER', 'grain wide', col(source('g'), wave)),
      box('LOOP', 'grain', col(
        row(K('g.start', 'START'), K('g.end', 'END'), K('g.speed', 'SPEED'), col(seg({ key: 'g.mode' }), seg({ key: 'g.sync' }))),
        row(K('g.lsRate', 'LFO▸START'), K('g.lsDepth', 'DEPTH'), K('g.leRate', 'LFO▸END'), K('g.leDepth', 'DEPTH'), seg({ key: 'g.lfoShape', cls: 'vert' })))),
      box('GRAINS', 'grain', col(
        row(K('g.size', 'SIZE'), K('g.dens', 'DENSITY'), K('g.jit', 'SCATTER'), K('g.pjit', 'P.SCATTER')),
        row(K('g.spread', 'STEREO'), K('g.shape', 'SHAPE'), K('g.rev', 'REVERSE'), K('g.pitch', 'PITCH')))),
      box('NOTES', 'grain', col(seg({ key: 'g.voices', label: 'VOICES' }), row(voices))),
      box('ENVELOPE', 'grain', col(seg({ key: 'g.env' }), row(K('g.atk', 'ATTACK'), K('g.dec', 'DECAY')))),
      box('SENDS', 'master', row(K('dly', 'DELAY'), K('rev', 'REVERB'), K('crs', 'CRUSHER')))),
    h('div', { class: 'prow' },
      box('DRUM', 'drum', row(list({ key: 'd.model', label: 'CIRCUIT' }), K('d.tune', 'TUNE'), K('d.decay', 'DECAY'), K('d.tone', 'TONE'), K('d.snap', 'SNAP'))),
      box('DRUM SAMPLE', 'drum', row(source('d', true), K('d.smix', 'ANA ↔ SMP'), K('s.tune', 'TUNE'), K('s.decay', 'DECAY'), K('s.start', 'START'))),
      box('MIX · MOD', 'mixbox', row(K('mix', 'DRUM ↔ GRAIN', { cls: 'big' }), col(seg({ key: 'mod.type', label: 'GRAINS MODULATE DRUM' }), row(K('mod.amt', 'AMOUNT'), h('button', { class: 'audition', title: t('trigTip'), onpointerdown: () => app.trig(S.sel) }, `▶ ${t('trig')}`))))),
      box('FILTER · OUT', 'strip', row(seg({ key: 'f.type', cls: 'vert' }), K('f.cut', 'CUTOFF'), K('f.res', 'RESO'), K('drive', 'DRIVE'), h('span', { class: 'vsep' }),
        K('vol', 'LEVEL'), K('pan', 'PAN'), seg({ key: 'choke', label: 'CHOKE', cls: 'vert2' })))),
  );
  // one page per effect; every channel has a send to each
  const fxPages = [
    h('div', { class: 'prow fxpage' }, box('DELAY', 'master', row(G('dly.time', 'TIME'), G('dly.fb', 'FEEDBACK'), G('dly.tone', 'TONE'), G('dly.lvl', 'LEVEL'))), sendsBox('dly')),
    h('div', { class: 'prow fxpage' }, box('REVERB', 'master', row(G('rv.size', 'SIZE'), G('rv.damp', 'DAMPING'), G('rv.lvl', 'LEVEL'))), sendsBox('rev')),
    h('div', { class: 'prow fxpage' }, box('CRUSHER', 'master', row(G('cr.drive', 'DRIVE'), G('cr.rate', 'DOWNSAMPLE'), G('cr.tone', 'TONE'), G('cr.lvl', 'LEVEL'))), sendsBox('crs')),
  ];
  panel.append(chPanel, ...fxPages);
  document.getElementById('fx').append(h('label', {}, 'VOL'), num({ id: 'vol', tip: 'Master', cls: 'bar' }));

  // ---- macros ----
  const macros = document.getElementById('macros'), macEls = [];
  for (let m = 0; m < NMACRO; m++) {
    const el = h('div', { class: 'macro', style: `--mc:${MCOL[m]}` });
    el.innerHTML = `<svg viewBox="0 0 40 40"><path class="kt" d="${arc(-2.35, 2.35)}"/><path class="kv"/><circle class="kb" cx="20" cy="20" r="10.5"/><line class="kp" x1="20" y1="20" x2="20" y2="10"/></svg>`;
    const name = h('span', { class: 'mname', ondblclick: () => app.renameMacro(m) }), count = h('span', { class: 'mcount' });
    const btn = h('button', { class: 'massign', title: t('assignTip'), onclick: () => app.learn(m) }, t('assign'));
    el.append(h('div', { class: 'minfo' }, name, count, btn));
    const svg = el.querySelector('svg'), kv = el.querySelector('.kv'), kp = el.querySelector('.kp');
    let y0, v0;
    svg.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      svg.setPointerCapture(e.pointerId); y0 = e.clientY; v0 = S.macros[m].value;
      const move = (ev) => app.setMacro(m, clamp(v0 + (y0 - ev.clientY) / (ev.shiftKey ? 800 : 160), 0, 1));
      const up = () => { svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerup', up); };
      svg.addEventListener('pointermove', move); svg.addEventListener('pointerup', up);
    });
    svg.addEventListener('wheel', (e) => { e.preventDefault(); app.setMacro(m, clamp(S.macros[m].value + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 0.004 : 0.02), 0, 1)); }, { passive: false });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); app.macroMenu(e, m); });
    macros.append(el);
    macEls.push({ draw() {
      const mac = S.macros[m], a = -2.35 + mac.value * 4.7;
      kv.setAttribute('d', arc(-2.35, a)); kp.setAttribute('transform', `rotate(${(a * 180 / Math.PI).toFixed(1)} 20 20)`);
      name.textContent = mac.name; count.textContent = mac.targets.length ? t('targets', mac.targets.length) : '';
      el.classList.toggle('learn', S.learn === m); el.classList.toggle('empty', !mac.targets.length);
    } });
  }
  const hint = h('div', { class: 'mhint' }); macros.append(hint);

  // ---- waveform: loop points, playhead and grains ----
  let view = null, dragPt = null;
  const xOf = (e) => clamp((e.clientX - wave.getBoundingClientRect().left) / wave.clientWidth, 0, 1);
  wave.addEventListener('pointerdown', (e) => {
    const x = xOf(e), a = S.params[`c${S.sel}.g.start`], b = S.params[`c${S.sel}.g.end`];
    dragPt = Math.abs(x - a) <= Math.abs(x - b) ? 'g.start' : 'g.end';
    wave.setPointerCapture(e.pointerId);
    const id = `c${S.sel}.${dragPt}`, v0 = S.params[id];
    app.setParam(id, x);
    const move = (ev) => app.setParam(id, xOf(ev));
    const up = (ev) => { wave.removeEventListener('pointermove', move); wave.removeEventListener('pointerup', up); app.touched(id, v0, S.params[id], ev.altKey); };
    wave.addEventListener('pointermove', move); wave.addEventListener('pointerup', up);
  });
  wave.addEventListener('dragover', (e) => e.preventDefault());
  wave.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) app.addFile(e.dataTransfer.files[0], 'g'); });
  function drawWave() {
    const dpr = window.devicePixelRatio || 1, w = Math.max(50, Math.round(wave.clientWidth * dpr)), hh = Math.round(wave.clientHeight * dpr);
    if (wave.width !== w || wave.height !== hh) { wave.width = w; wave.height = hh; }
    const g = wave.getContext('2d'), mid = hh / 2, e = pool[index.get(S.gsrc[S.sel])];
    const a = S.params[`c${S.sel}.g.start`], b = S.params[`c${S.sel}.g.end`];
    const live = view || { ls: Math.min(a, b), le: Math.max(a, b), ph: -1, grains: [] };
    g.fillStyle = '#0b0f10'; g.fillRect(0, 0, w, hh);
    g.fillStyle = 'rgba(63,208,192,.13)'; g.fillRect(live.ls * w, 0, (live.le - live.ls) * w, hh);
    if (e) {
      const pk = peaks(e, w);
      for (let x = 0; x < w; x++) {
        const inside = x >= live.ls * w && x <= live.le * w;
        g.fillStyle = inside ? '#3fd0c0' : '#31524f';
        g.fillRect(x, mid - pk.hi[x] * mid * 0.95, 1, Math.max(1, (pk.hi[x] - pk.lo[x]) * mid * 0.95));
      }
    }
    g.fillStyle = '#fff';
    for (const [v, top] of [[a, true], [b, false]]) {
      const x = Math.round(v * (w - 1));
      g.fillRect(x, 0, 1.5 * dpr, hh);
      g.beginPath(); g.moveTo(x, top ? 0 : hh); g.lineTo(x + (top ? 9 : -9) * dpr, top ? 0 : hh); g.lineTo(x, top ? 9 * dpr : hh - 9 * dpr); g.fill();
    }
    g.fillStyle = 'rgba(255,214,102,.9)';
    for (const p of live.grains) g.fillRect(p * w - dpr, mid - hh * 0.3, 2 * dpr, hh * 0.6);
    if (live.ph >= 0) { g.fillStyle = '#ff6b6b'; g.fillRect(live.ph * w, 0, 1.5 * dpr, hh); }
  }

  return {
    num,
    refresh(id) {             // redraw the controls showing parameter id (or everything)
      for (const c of app.controls) if (!id || c.id === id || (c.key && id === `c${S.sel}.${c.key}`)) c.draw();
    },
    refreshTabs() {
      fxTabs.forEach((el, k) => el.classList.toggle('on', S.tab === FX[k][0]));
      chPanel.hidden = S.tab !== 'ch'; fxPages.forEach((el, k) => { el.hidden = S.tab !== FX[k][0]; });
      for (const s of sendNames) s.el.textContent = `${s.c + 1} ${S.names[s.c]}`;
      tabEls.forEach((el, c) => {
        el.classList.toggle('on', S.tab === 'ch' && c === S.sel); el.lastChild.textContent = S.names[c];
        el.style.setProperty('--mix', S.params[`c${c}.mix`]);
      });
      panel.style.setProperty('--mix', S.params[`c${S.sel}.mix`]);
    },
    refreshMacros() { macEls.forEach((m) => m.draw()); hint.textContent = S.learn >= 0 ? t('learning', S.macros[S.learn].name) : ''; document.body.classList.toggle('learning', S.learn >= 0); },
    refreshSources(fill) { for (const s of app.sources) if (fill) s.fill(); else s.draw(); },
    setView(v) { view = v; },
    frame(levels) { drawWave(); if (levels) tabEls.forEach((el, c) => el.firstChild.style.opacity = Math.min(1, 0.15 + levels[c] * 4)); },
  };
}
