// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
// struct.mjs: the big-endian subset of Python's struct.pack that the font writers use, so the port can
// follow the source table by table. Codes: B b (1 byte), H h (2), L l I (4), Q (8, BigInt-safe), Ns (N raw
// bytes from a string or a byte array). A count before a code repeats it, as in Python ('3H').

const SIZE = { B: 1, b: 1, H: 2, h: 2, L: 4, l: 4, I: 4, Q: 8 };

function codes(fmt) {
  if (fmt[0] !== '>') throw new Error(`struct: only big-endian formats, got ${fmt}`);
  const out = [];
  for (const [, n, c] of fmt.slice(1).matchAll(/(\d*)([BbHhLlIQs])/g)) {
    if (c === 's') out.push(['s', n === '' ? 1 : Number(n)]);
    else for (let i = 0; i < (n === '' ? 1 : Number(n)); i++) out.push([c, SIZE[c]]);
  }
  return out;
}

export function pack(fmt, ...vals) {
  const cs = codes(fmt);
  if (cs.length !== vals.length) throw new Error(`struct: ${fmt} takes ${cs.length} values, got ${vals.length}`);
  const buf = new Uint8Array(cs.reduce((a, [, n]) => a + n, 0)), dv = new DataView(buf.buffer);
  let o = 0;
  cs.forEach(([c, n], i) => {
    const v = vals[i];
    if (c === 's') { const b = typeof v === 'string' ? Uint8Array.from(v, ch => ch.charCodeAt(0)) : v; buf.set(b.subarray(0, n), o); }
    else if (c === 'Q') dv.setBigUint64(o, BigInt(v));
    else {
      const x = Number(v);
      if (!Number.isInteger(x)) throw new TypeError(`struct: ${c} needs an integer, got ${v}`);
      ({ B: () => dv.setUint8(o, x), b: () => dv.setInt8(o, x), H: () => dv.setUint16(o, x), h: () => dv.setInt16(o, x),
        L: () => dv.setUint32(o, x), I: () => dv.setUint32(o, x), l: () => dv.setInt32(o, x) })[c]();
    }
    o += n;
  });
  return buf;
}

// concat(a, b, ...) for byte arrays, the port's stand-in for Python's bytes +.
export function concat(...parts) {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// A growing byte buffer for loops that append many small pieces.
export class Bytes {
  constructor() { this.parts = []; this.length = 0; }
  push(...bs) { for (const b of bs) { this.parts.push(b); this.length += b.length; } return this; }
  bytes() { return concat(...this.parts); }
}
