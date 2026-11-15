// Panel test in a real browser (optional): start the server, then
//   PLAYWRIGHT_DIR=/path/to/node_modules node test/browser.mjs [screenshot.png]
const PAGE = process.env.TD_URL || 'http://localhost:8057/';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_DIR ? process.env.PLAYWRIGHT_DIR + '/' : import.meta.url);
const { chromium } = require('playwright-core');
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
const errs = []; let fail = 0;
const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fail++; };
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Mi preset' : undefined));
await p.goto(PAGE, { waitUntil: 'networkidle' });
await p.evaluate(() => { localStorage.clear(); }); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
const S = (f, a) => p.evaluate(f, a);
ok(await S(() => __app.S.name) === '808 + Strings', 'starts on the first factory preset');
ok(await S(() => document.querySelector('.src').options.length) === 78, 'sample list has 78 entries');
// audio
await p.click('#play'); await p.waitForTimeout(1500);
ok(await S(() => __td.ctx.state) === 'running', 'audio context running');
// measure output through an analyser
const level = () => S(async () => { const a = __td.ctx.createAnalyser(); __td.node.connect(a); await new Promise((r) => setTimeout(r, 700)); const x = new Float32Array(2048); let m = 0; for (let k = 0; k < 8; k++) { a.getFloatTimeDomainData(x); for (const v of x) m = Math.max(m, Math.abs(v)); await new Promise((r) => setTimeout(r, 120)); } __td.node.disconnect(a); return m; });
const lv = await level(); ok(lv > 0.1 && lv <= 1, `sound comes out (peak ${lv.toFixed(2)})`);
ok(await S(() => document.querySelectorAll('.cell.ph').length) === 10, 'playhead shown on the 10 tracks');
// step editing: click toggles, shift accent, other layers by drag
const cell = (c, i) => p.locator(`.cell[data-c="${c}"][data-i="${i}"]`);
await cell(5, 1).click(); ok(await S(() => __app.S.live[5].on[1] === 1 && __app.S.pat[5].on[1] === 1), 'click turns a step on');
await cell(5, 1).click(); ok(await S(() => __app.S.live[5].on[1] === 0), 'click again turns it off');
await cell(5, 2).click({ modifiers: ['Shift'] }); ok(await S(() => __app.S.live[5].vel[2] === 1 && __app.S.live[5].on[2] === 1), 'shift+click accents');
const bb = await cell(6, 0).boundingBox(), b3 = await cell(6, 3).boundingBox();
await p.mouse.move(bb.x + 5, bb.y + 5); await p.mouse.down(); await p.mouse.move(b3.x + 5, b3.y + 5, { steps: 8 }); await p.mouse.up();
ok(await S(() => __app.S.live[6].on.slice(0, 4).join('') === '1111'), 'drag paints steps');
await p.click('.modes button:nth-child(3)');
const c0 = await cell(0, 0).boundingBox();
await p.mouse.move(c0.x + 10, c0.y + 10); await p.mouse.down(); await p.mouse.move(c0.x + 10, c0.y + 55, { steps: 5 }); await p.mouse.up();
ok(await S(() => __app.S.live[0].prob[0]) === 0.5, 'PROB layer: drag down sets 50%');
await p.click('.modes button:nth-child(4)');
await p.mouse.move(c0.x + 10, c0.y + 10); await p.mouse.down(); await p.mouse.move(c0.x + 10, c0.y - 25, { steps: 5 }); await p.mouse.up();
ok(await S(() => __app.S.live[0].note[0]) === 7, 'NOTE layer: drag up sets +7');
await p.click('.modes button:nth-child(1)');
// knob drag + tab switch shows the other channel's value
const kb = await p.locator('.pages .knob', { hasText: 'SIZE' }).boundingBox();
await p.mouse.move(kb.x + 20, kb.y + 30); await p.mouse.down(); await p.mouse.move(kb.x + 20, kb.y - 50, { steps: 5 }); await p.mouse.up();
const sz = await S(() => __app.S.params['c0.g.size']); ok(sz > 200, `knob drag changes the parameter (size ${Math.round(sz)} ms)`);
await p.click('.tab:nth-child(3)');
ok(await S(() => __app.S.sel === 2 && document.querySelector('.tab.on span').textContent === 'CP'), 'tab selects the channel');
ok((await p.locator('.pages .knob', { hasText: 'SIZE' }).locator('.kval').textContent()) === '40 ms', 'panel shows the selected channel values');
// channel modes: the panel shows the chosen mode's controls
const vis = () => S(() => [...document.querySelectorAll('.pages > .prow')].map((r) => (r.hidden ? 0 : 1)).join(''));
await S(() => { __app.select(5); __app.setParam('c5.mod.type', 0); });
ok(await vis() === '1100', `DRUM mode shows the drum row only (${await vis()})`);
await p.locator('.pages .seg button', { hasText: /^SYNTH$/ }).click();
ok(await S(() => __app.S.params['c5.mode']) === 2 && await vis() === '1010', `SYNTH mode shows the synth row (${await vis()})`);
await p.locator('.pages .seg button', { hasText: /^FM$/ }).click(); ok(await vis() === '1011', 'turning a grain modulation on reveals the granular row');
ok(await S(() => document.querySelectorAll('.pages .knob.big').length) === 0 && await S(() => document.querySelectorAll('.modes button').length) === 5, 'no MIX knob and no MIX layer');
await p.locator('.pages .seg button', { hasText: /^GRAIN$/ }).click();
ok(await vis() === '1001' && await S(() => document.querySelector('.pages .prow .box:nth-child(2)').hidden), `GRAIN mode shows the granular row and hides GRAIN MOD (${await vis()})`);
{ const lv = await level(); ok(lv > 0.05, `still sounds after switching modes (peak ${lv.toFixed(2)})`); }
await p.locator('.pages .seg button', { hasText: /^DRUM$/ }).click(); await S(() => { __app.setParam('c5.mod.type', 0); __app.select(2); });
// effect tabs: each effect has its own page, with the ten channel sends
for (const [k, name, id] of [[11, 'DELAY', 'dly'], [12, 'REVERB', 'rev'], [13, 'CRUSHER', 'crs']]) {
  await p.click(`.tab:nth-child(${k})`);
  ok(await S(() => document.querySelector('.pages').hidden && document.querySelectorAll('.fxpage:not([hidden])').length === 1), `${name} tab shows only its page`);
  ok(await p.locator('.fxpage:not([hidden]) .knob').count() >= 13, `${name} page has its controls and 10 sends`);
  const k3 = await p.locator('.fxpage:not([hidden]) .box.wide .knob').nth(2).boundingBox();
  await p.mouse.move(k3.x + 25, k3.y + 35); await p.mouse.down(); await p.mouse.move(k3.x + 25, k3.y - 300, { steps: 5 }); await p.mouse.up();
  ok(await S((id) => __app.S.params[`c2.${id}`], id) === 1, `${name}: channel 3 send goes to 100%`);
}
await p.click('.tab:nth-child(3)');
ok(await S(() => !document.querySelector('.pages').hidden && document.querySelectorAll('.fxpage:not([hidden])').length === 0), 'channel tab brings the channel panel back');
ok((await p.locator('.pages .knob', { hasText: 'CRUSHER' }).locator('.kval').textContent()) === '100%', 'channel panel shows its three sends');
await S(() => { for (const k of ['dly', 'rev', 'crs']) __app.setParam(`c2.${k}`, 0); });
// macro: assign two knobs, then the macro moves both between the learned ends
await p.click('.macro:nth-child(5) .massign');
for (const name of ['CUTOFF', 'RESO']) { const k = await p.locator('.pages .knob', { hasText: name }).boundingBox(); await p.mouse.move(k.x + 20, k.y + 30); await p.mouse.down(); await p.mouse.move(k.x + 20, k.y + (name === 'CUTOFF' ? 110 : -40), { steps: 5 }); await p.mouse.up(); }
await p.click('.macro:nth-child(5) .massign');
const mac = await S(() => __app.S.macros[4]); ok(mac.targets.length === 2 && mac.targets[0].id === 'c2.f.cut', `macro learned 2 controls (${mac.targets.map((x) => x.id)})`);
const hi = await S(() => [__app.S.params['c2.f.cut'], __app.S.params['c2.f.res']]);
await S(() => __app.setMacro(4, 0)); const lo = await S(() => [__app.S.params['c2.f.cut'], __app.S.params['c2.f.res']]);
ok(lo[0] === 18000 && Math.abs(lo[1] - 0.2) < 1e-6 && hi[0] < 9000 && hi[1] > 0.3, `macro sweeps both: ${lo.map((v) => +v.toFixed(2))} -> ${hi.map((v) => +v.toFixed(2))}`);
ok(await S(() => document.querySelectorAll('#panel .knob.mac').length) >= 2, 'assigned knobs are marked');
// alt = same control on all channels
await p.click('.macro:nth-child(6) .massign');
{ const k = await p.locator('.pages .knob', { hasText: 'LEVEL' }).boundingBox(); await p.keyboard.down('Alt'); await p.mouse.move(k.x + 20, k.y + 30); await p.mouse.down(); await p.mouse.move(k.x + 20, k.y + 70, { steps: 5 }); await p.mouse.up(); await p.keyboard.up('Alt'); }
await p.click('.macro:nth-child(6) .massign');
ok(await S(() => __app.S.macros[5].targets.length) === 10, 'Alt assigns the control on all 10 channels');
// random, clear, evolve events, revert
await p.click('.trow:nth-of-type(4) .dice'); ok(await S(() => __app.S.live[2].on.some(Boolean)), 'dice makes a pattern');
await S(() => { for (let c = 0; c < 10; c++) __app.setParam(`c${c}.evo`, 1); __app.setParam('evo.bars', 0); __app.setParam('bpm', 240); });
await p.locator('.seqbar button', { hasText: /^(Revert|Volver)$/ }).click();
const before = await S(() => JSON.stringify(__app.S.live)); ok(before === await S(() => JSON.stringify(__app.S.pat)), 'after revert live = base'); await p.waitForTimeout(4500);
const after = await S(() => JSON.stringify(__app.S.live)); ok(before !== after, 'evolution changes the live pattern');
ok(await S(() => JSON.stringify(__app.S.pat)) === before, 'the base pattern is untouched');
await p.locator('.seqbar button', { hasText: /^(Revert|Volver)$/ }).click(); ok(await S(() => JSON.stringify(__app.S.live)) === before, 'revert restores it');
// load a user sample into the granular sampler
await S(async () => { const r = await fetch('samples/LM-2/crash.wav'); const f = new File([await r.blob()], 'mi crash.wav', { type: 'audio/wav' }); await __app.addFile(f, 'g'); });
ok(await S(() => __app.S.gsrc[__app.S.sel]) === 'user/mi crash', 'user sample loaded and selected');
// preset save / reload persistence / factory switch
await p.click('#save'); await p.waitForTimeout(300);
ok(await S(() => Object.keys(JSON.parse(localStorage.getItem('texturedrums.presets')))[0]) === 'Mi preset', 'preset saved');
await p.selectOption('#preset', { label: 'Marciano' }); await p.waitForTimeout(600);
await p.selectOption('#preset', { label: 'Acid Clouds' }); await p.waitForTimeout(900);
{ const lv = await level(); ok(await S(() => __app.S.params['c5.mode']) === 2 && lv > 0.1, `synth preset loads and sounds (peak ${lv.toFixed(2)})`); }
await p.selectOption('#preset', { label: 'Marciano' }); await p.waitForTimeout(600);
ok(await S(() => __app.S.name === 'Marciano' && __app.S.params.bpm === 104 && __app.S.macros[0].name === 'Martian'), 'factory preset loads');
const lv2 = await level(); ok(lv2 > 0.1, `Marciano sounds (peak ${lv2.toFixed(2)})`);
await p.waitForTimeout(1000); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
ok(await S(() => __app.S.name) === 'Marciano', 'state survives a reload');
ok(await S(() => [...document.querySelector('.src').options].some((o) => o.value === 'user/mi crash')), 'user sample survives a reload');
await p.selectOption('#preset', { label: 'Mi preset' }); await p.waitForTimeout(300);
ok(await S(() => __app.S.gsrc[2]) === 'user/mi crash' && (await S(() => __app.S.macros[5].targets.length)) === 10, 'saved preset restores sample and macros');
// keyboard
await p.keyboard.press('Space'); await p.waitForTimeout(800); ok(await S(() => __app.S.running), 'space starts');
await p.keyboard.press('5'); ok(await S(() => __app.S.sel) === 4, 'number key selects a channel');
if (process.argv[2]) await p.screenshot({ path: process.argv[2], fullPage: true });
console.log(errs.length ? 'CONSOLE:\n' + errs.join('\n') : 'no console errors', fail ? `\n${fail} FAILED` : '\nall ok');
await b.close();
process.exit(fail || errs.length ? 1 : 0);
