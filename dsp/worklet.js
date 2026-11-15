import { Engine } from './engine.js';

class TextureDrumsProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.engine = new Engine(sampleRate, (Math.random() * 1e9) | 0);
    this.frames = 0;
    this.port.onmessage = (e) => {
      const d = e.data, en = this.engine;
      switch (d.type) {
        case 'param': en.setParam(d.id, d.v); break;
        case 'params': for (const [id, v] of d.list) en.setParam(id, v); break;
        case 'sample': en.setSample(d.idx, d.data, d.sr); break;
        case 'source': en.setSource(d.c, d.which, d.idx); break;
        case 'track': en.setTrack(d.c, d.track, d.base); break;
        case 'step': en.setStep(d.c, d.i, d.s); break;
        case 'revert': en.revert(); break;
        case 'keep': en.keep(); break;
        case 'run': if (d.on) en.start(); else en.stop(); break;
        case 'trig': en.trig(d.c, d.vel, d.note); break;
        case 'view': en.view = d.c; break;
      }
    };
  }
  process(inputs, outputs) {
    const out = outputs[0], en = this.engine;
    en.process(out[0], out[1] || new Float32Array(out[0].length));
    while (en.events.length) this.port.postMessage(en.events.shift());
    this.frames += out[0].length;
    if (this.frames >= sampleRate / 30) {
      this.frames = 0;
      this.port.postMessage({ type: 'state', state: en.state() });
    }
    return true;
  }
}
registerProcessor('texturedrums', TextureDrumsProcessor);
