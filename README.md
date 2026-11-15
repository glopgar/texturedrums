# TextureDrums — granular drum machine for the browser

![TextureDrums: channel tabs and controls on top, macros in the middle, the 10-track step sequencer below](screen.png)

Ten identical channels, each working as a **drum** (a modelled analog circuit plus a sample), a **granular sampler** or a **synth** for basses and leads, driven by a 10-track XOX sequencer with probabilities, randomising and slow pattern evolution. Eight macros move groups of controls at once. Static web app with no dependencies and no build step (AudioWorklet + Web MIDI).

**Try it online: <https://glopgar.github.io/texturedrums/>**

## Running it

```bash
python3 serve.py
```

Then open <http://localhost:8057/> in Chrome, Edge or Firefox. Audio needs `localhost` or HTTPS, so opening `index.html` as a file does not work.

```bash
node test/render.mjs
```

Offline engine tests: every drum circuit, the synth (tuning, waves, gate, legato and glide, filter), the granular sampler (pitch, loop modes, loop LFOs, voices), the modulation modes, sequencer timing, probabilities, rolls, choke groups, evolution, and every factory preset (each must sound, not clip, stay affordable and fall silent). `test/browser.mjs` drives the real panel in a headless browser if Playwright is available.

## Using it

- **Channel tabs** (top): the ten channels have the same controls. CHANNEL chooses the mode — DRUM, GRAIN or SYNTH — and the panel shows that mode's controls. The colour shows what the channel is: amber = drum, blue = synth, teal = grains.
- **Granular sampler**: pick a source (built-in textures, any drum machine sample, or your own file with *Load…* or by dropping it on the waveform). The loop runs from START to END — forward, reverse or ping-pong, at SPEED (0 freezes it) — and each loop point has its own LFO. Drag the markers on the waveform. Up to four **notes** sound at once, each a stream of grains read from its own OFFSET into the loop and at its own PITCH. ENV on TRIG gives plucked notes; on DRONE the texture holds while the sequencer runs and the steps only change its pitch.
- **Drum**: twelve circuits (808 and 909 kick and snare, clap, hat, cymbal, tom, cowbell, rim, noise, FM) and a sample layer, blended with ANA ↔ SMP.
- **Synth**: two oscillators (saw, square with pulse width, triangle, sine) with detune, a sub-oscillator, a resonant 4-pole low-pass with its own envelope, and an ADSR. It is monophonic and plays the note of each step. GATE is the note length in steps: over 100% a note ties into the next one, which then plays legato and slides to the new pitch at the GLIDE rate — acid-style slides come from two adjacent steps.
- **Grain mod** (DRUM and SYNTH modes): the channel's granular sampler, unheard, modulates the voice to make it alien: RING (grains multiply it), FM (grains bend its pitch) or FILTER (grains move the filter cutoff). The granular controls appear when a modulation is on.
- **Effects**: three send effects — ping-pong delay, reverb and a crusher (downsampling and saturation) — each on its own FX tab with its controls and the sends of all ten channels side by side. Every channel also has its three sends (0–100%) in its own panel.
- **Sequencer**: 10 tracks of up to 16 steps, all visible. TRIG / VEL / PROB / NOTE / ROLL choose the layer being edited: click and paint in TRIG (Shift+click = accent), drag up/down in the others, right-click resets a step. Each track has its own length (polymeters), probability and EVO amount, plus mute, solo and a dice for a random pattern.
- **Evolution**: with *Evolve* on, every 1–8 bars each track with EVO above zero changes a little (a hit slides, a ghost note appears, odds or notes shift) while staying close to the pattern you wrote. *Revert* brings your pattern back; *Keep* adopts the evolved one.
- **Macros**: press *Assign* on a macro and move controls — where each starts is the macro's minimum, where you leave it the maximum. Hold Alt to assign the same control on all ten channels. Right-click a control to remove it.
- **Controls**: drag up/down or use the wheel; Shift for fine adjustment; double-click resets. Keys: Space = play, `1…0` = select channel, `Q…P` = trigger channel. MIDI notes 36–45 trigger the channels, CC 70–77 move the macros.
- **Presets**: seven factory presets plus save, export and import as JSON. The current state is restored on reload. Interface in Spanish or English.

## Structure

| File | Contents |
| --- | --- |
| `dsp/params.js` | The parameter list shared by engine, panel and tests |
| `dsp/drums.js` | Drum circuits and the one-shot sample layer |
| `dsp/grain.js` | Granular sampler: loop, loop LFOs, notes, grains |
| `dsp/synth.js` | Synth voice: oscillators, ladder filter, envelopes, legato and glide |
| `dsp/engine.js` | Channels (mode, modulation, filter, sends), sequencer, master |
| `dsp/pattern.js` | Tracks, random patterns, evolution |
| `dsp/fx.js` | Ping-pong delay, reverb and crusher |
| `dsp/textures.js` | Built-in granular sources, computed from formulas |
| `dsp/wav.js` | WAV reader |
| `dsp/worklet.js` | AudioWorklet wrapper |
| `js/ui.js` | Widgets, tabs, channel panel, macros, waveform display |
| `js/seq.js` | Sequencer grid |
| `js/samples.js` | Sample pool; user samples are kept in IndexedDB |
| `js/presets.js` | Factory presets |
| `js/main.js` | Application state, audio start-up, presets, keyboard, MIDI |
| `samples/` | Drum machine samples and their credits |

## Samples

The CR-78, LinnDrum LM-2, Maestro Rhythm King MRK-2 and TR-505 kits are published as public domain in the [oramics/sampled](https://github.com/oramics/sampled) collection; sources are listed in `samples/README.md`. The textures (Glass, Strings, Vox, Bells, Wind, Radio) are generated by the app.
