// Minimal WAV reader (PCM 8/16/24/32 bit and 32-bit float), mixed down to mono.
export function parseWav(buf) {
  const dv = new DataView(buf instanceof ArrayBuffer ? buf : buf.buffer, buf.byteOffset || 0, buf.byteLength);
  const tag = (o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file');
  let fmt = null, o = 12;
  while (o + 8 <= dv.byteLength) {
    const id = tag(o), size = dv.getUint32(o + 4, true), at = o + 8;
    if (id === 'fmt ') fmt = { format: dv.getUint16(at, true), ch: dv.getUint16(at + 2, true), sr: dv.getUint32(at + 4, true), bits: dv.getUint16(at + 14, true) };
    else if (id === 'data') {
      if (!fmt) throw new Error('WAV without format');
      const bytes = fmt.bits / 8, n = Math.floor(Math.min(size, dv.byteLength - at) / (bytes * fmt.ch)), out = new Float32Array(n);
      const float = fmt.format === 3 || (fmt.format === 65534 && fmt.bits === 32 && dv.getUint16(at - 8 - 16, true) === 3);
      for (let i = 0, q = at; i < n; i++) {
        let s = 0;
        for (let c = 0; c < fmt.ch; c++, q += bytes) {
          s += float ? dv.getFloat32(q, true)
            : bytes === 1 ? (dv.getUint8(q) - 128) / 128
            : bytes === 2 ? dv.getInt16(q, true) / 32768
            : bytes === 3 ? ((dv.getInt8(q + 2) << 16) | (dv.getUint8(q + 1) << 8) | dv.getUint8(q)) / 8388608
            : dv.getInt32(q, true) / 2147483648;
        }
        out[i] = s / fmt.ch;
      }
      return { data: out, sr: fmt.sr };
    }
    o = at + size + (size & 1);
  }
  throw new Error('WAV without data');
}

// Bring a sample up to a common peak level (the kits come recorded at very different levels)
export function normalise(data, peak = 0.9) {
  let m = 0;
  for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); if (a > m) m = a; }
  if (m > 1e-4) { const g = peak / m; for (let i = 0; i < data.length; i++) data[i] *= g; }
  return data;
}
