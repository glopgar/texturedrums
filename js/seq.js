// The step sequencer grid: ten tracks shown at once, one editing layer at a time.
import { NCH, NSTEP, clamp } from '../dsp/params.js';
import { h } from './ui.js';
import { t } from './i18n.js';

const MODES = [['trig', 'TRIG', 'mTrig'], ['vel', 'VEL', 'mVel'], ['prob', 'PROB', 'mProb'], ['note', 'NOTE', 'mNote'], ['rat', 'ROLL', 'mRoll']];
const DEF = { vel: 0.75, prob: 1, note: 0, rat: 1 };

export function buildSeq(app, ui) {
  const S = app.S, root = document.getElementById('seq');
  const modeBtns = MODES.map(([m, label, tip]) => h('button', { title: t(tip), onclick: () => { S.mode = m; drawAll(); } }, label));
  const evoBtn = h('button', { class: 'tgl', title: t('evolveTip'), onclick: () => app.setParam('evo.on', S.params['evo.on'] ? 0 : 1) }, t('evolve'));
  const bars = h('select', { onchange: () => app.setParam('evo.bars', bars.selectedIndex) }, ['1', '2', '4', '8'].map((n) => h('option', {}, n)));
  app.controls.push({ id: 'evo.on', draw: () => evoBtn.classList.toggle('on', S.params['evo.on'] >= 0.5) }, { id: 'evo.bars', draw: () => { bars.selectedIndex = S.params['evo.bars']; } });
  root.append(h('div', { class: 'seqbar' },
    h('div', { class: 'seg' }, h('div', { class: 'segrow modes' }, modeBtns)),
    h('button', { onclick: () => app.randomAll() }, t('rndAll')),
    h('button', { onclick: () => app.clearAll() }, t('clear')),
    h('span', { class: 'sep' }),
    evoBtn, h('span', { class: 'dim' }, t('every')), bars, h('span', { class: 'dim' }, t('bars')),
    h('button', { title: t('revertTip'), onclick: () => app.revert() }, t('revert')),
    h('button', { title: t('keepTip'), onclick: () => app.keep() }, t('keep'))),
    h('div', { class: 'trow head' }, h('span'), h('span'), h('span'), h('span'), h('span', { title: t('len') }, 'LEN'), h('span', { title: t('prob') }, 'PROB'), h('span', { title: t('evo') }, 'EVO'), h('span')));

  const rows = [], cells = [];
  const dice = (c) => { const b = h('button', { class: 'dice', title: t('rndTip'), onclick: () => app.randomTrack(c) }); b.innerHTML = '<svg viewBox="0 0 14 14"><rect x="1.5" y="1.5" width="11" height="11" rx="2.5"/><circle cx="4.6" cy="4.6" r="1.1"/><circle cx="7" cy="7" r="1.1"/><circle cx="9.4" cy="9.4" r="1.1"/></svg>'; return b; };
  for (let c = 0; c < NCH; c++) {
    const name = h('button', { class: 'tname', onclick: () => app.select(c), ondblclick: () => app.rename(c) }, h('i', { class: 'led' }), h('b', {}, `${c + 1}`), h('span'));
    const mk = (key, label, tip) => { const b = h('button', { class: `tgl sm ${key}`, title: tip, onclick: () => app.setParam(`c${c}.${key}`, S.params[`c${c}.${key}`] ? 0 : 1) }, label); app.controls.push({ id: `c${c}.${key}`, draw: () => { b.classList.toggle('on', S.params[`c${c}.${key}`] >= 0.5); } }); return b; };
    const grid = h('div', { class: 'cells' });
    cells[c] = Array.from({ length: NSTEP }, (_, i) => { const el = h('div', { class: `cell${i % 4 === 0 ? ' beat' : ''}` }, h('i'), h('span')); el.dataset.c = c; el.dataset.i = i; return el; });
    grid.append(...cells[c]);
    const r = h('div', { class: 'trow' }, name, mk('mute', 'M', t('mute')), mk('solo', 'S', t('solo')),
      dice(c),
      ui.num({ id: `c${c}.len`, tip: t('len'), range: 90 }), ui.num({ id: `c${c}.prob`, tip: t('prob'), cls: 'bar' }), ui.num({ id: `c${c}.evo`, tip: t('evo'), cls: 'bar evo' }), grid);
    app.controls.push({ id: `c${c}.len`, draw: () => drawTrack(c) }, { id: `c${c}.mix`, draw: () => r.style.setProperty('--mix', S.params[`c${c}.mix`]) });
    rows.push({ el: r, name }); root.append(r);
  }

  function drawCell(c, i) {
    const tr = S.live[c], el = cells[c][i], on = !!tr.on[i], m = S.mode;
    el.classList.toggle('on', on); el.classList.toggle('out', i >= S.params[`c${c}.len`]); el.classList.toggle('acc', on && tr.vel[i] >= 0.95);
    const v = m === 'prob' ? tr.prob[i] : m === 'note' ? 0.5 + tr.note[i] / 48 : m === 'rat' ? tr.rat[i] / 4 : tr.vel[i];
    el.style.setProperty('--v', v.toFixed(3)); el.style.setProperty('--p', (m === 'trig' ? 0.35 + 0.65 * tr.prob[i] : 1).toFixed(2));
    let txt = '';
    if (on || m !== 'trig') {
      if (m === 'trig') txt = (tr.note[i] ? (tr.note[i] > 0 ? '+' : '') + tr.note[i] : '') + (tr.rat[i] > 1 ? `×${tr.rat[i]}` : '');
      else if (m === 'vel') txt = on ? Math.round(tr.vel[i] * 100) : '';
      else if (m === 'prob') txt = on ? Math.round(tr.prob[i] * 100) : '';
      else if (m === 'note') txt = on || tr.note[i] ? (tr.note[i] > 0 ? '+' : '') + tr.note[i] : '';
      else txt = on || tr.rat[i] > 1 ? `×${tr.rat[i]}` : '';
    }
    el.lastChild.textContent = txt;
  }
  function drawTrack(c) { for (let i = 0; i < NSTEP; i++) drawCell(c, i); }
  function drawAll() {
    root.dataset.mode = S.mode;
    modeBtns.forEach((b, k) => b.classList.toggle('on', MODES[k][0] === S.mode));
    for (let c = 0; c < NCH; c++) { drawTrack(c); rows[c].name.lastChild.textContent = S.names[c]; rows[c].el.classList.toggle('sel', c === S.sel); }
  }

  // editing: click / paint in TRIG, vertical drag in the other layers, right-click resets the step
  root.addEventListener('contextmenu', (e) => {
    const el = e.target.closest('.cell'); if (!el) return;
    e.preventDefault();
    const c = +el.dataset.c, i = +el.dataset.i;
    app.setStep(c, i, S.mode === 'trig' ? { on: 0, ...DEF } : { [S.mode]: DEF[S.mode] });
  });
  root.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.cell'); if (!el || e.button) return;
    e.preventDefault();
    const c = +el.dataset.c, i = +el.dataset.i, tr = S.live[c], m = S.mode;
    let move;
    if (m === 'trig') {
      if (e.shiftKey) { app.setStep(c, i, { on: 1, vel: tr.on[i] && tr.vel[i] >= 0.95 ? 0.75 : 1 }); return; }
      const on = tr.on[i] ? 0 : 1;
      app.setStep(c, i, { on });
      move = (ev) => { const o = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.cell'); if (o && +o.dataset.c === c && S.live[c].on[+o.dataset.i] !== on) app.setStep(c, +o.dataset.i, { on }); };
    } else {
      const y0 = e.clientY, v0 = tr[m][i];
      if (m === 'vel' && !tr.on[i]) app.setStep(c, i, { on: 1 });
      move = (ev) => {
        const dy = y0 - ev.clientY;
        const v = m === 'note' ? clamp(Math.round(v0 + dy / 5), -24, 24) : m === 'rat' ? clamp(Math.round(v0 + dy / 14), 1, 4) : clamp(Math.round((v0 + dy / 90) * 20) / 20, m === 'vel' ? 0.05 : 0, 1);
        if (v !== S.live[c][m][i]) app.setStep(c, i, { [m]: v });
      };
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });

  const last = new Array(NCH).fill(-1);
  return {
    drawAll, drawTrack, drawCell,
    frame(pos, levels) {      // playhead and track activity
      for (let c = 0; c < NCH; c++) {
        const p = pos ? pos[c] : -1;
        if (p !== last[c]) { if (last[c] >= 0) cells[c][last[c]].classList.remove('ph'); if (p >= 0) cells[c][p].classList.add('ph'); last[c] = p; }
        if (levels) rows[c].name.firstChild.style.opacity = Math.min(1, 0.15 + levels[c] * 4);
      }
    },
  };
}
