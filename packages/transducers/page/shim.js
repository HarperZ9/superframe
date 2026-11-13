/* What the field type asks of Node, in a page: a small Buffer and a synchronous sha256, so the ledger hashes the same bytes
   here as in Node. RECONCILE.md asks the field package to take this over. */
(function (g) {
  "use strict";
  const enc = new TextEncoder();
  const concat = (list) => { let n = 0; for (const b of list) n += b.length; const o = new Uint8Array(n); let p = 0; for (const b of list) { o.set(b, p); p += b.length; } return o; };
  g.Buffer = g.Buffer || {
    from: (d, a, b) => (typeof d === "string" ? enc.encode(d) : d instanceof ArrayBuffer ? new Uint8Array(d, a || 0, b === undefined ? undefined : b) : Uint8Array.from(d)),
    concat,
  };
  const K = []; (() => { const isP = (n) => { for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; }; for (let c = 2; K.length < 64; c++) if (isP(c)) K.push(Math.floor((Math.cbrt(c) % 1) * 4294967296) >>> 0); })();
  const rr = (x, n) => (x >>> n) | (x << (32 - n));
  g.sha256hex = (data) => {
    const m = typeof data === "string" ? enc.encode(data) : data, L = m.length, n = (((L + 9 + 63) >> 6) << 6), b = new Uint8Array(n), dv = new DataView(b.buffer);
    b.set(m); b[L] = 128; dv.setUint32(n - 4, L * 8 >>> 0); dv.setUint32(n - 8, Math.floor(L / 536870912));
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = new Uint32Array(64);
    for (let o = 0; o < n; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + 4 * i);
      for (let i = 16; i < 64; i++) { const a = w[i - 15], c = w[i - 2]; w[i] = (w[i - 16] + (rr(a, 7) ^ rr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rr(c, 17) ^ rr(c, 19) ^ (c >>> 10))) >>> 0; }
      let [a, b2, c, d, e, f, g2, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g2)) + K[i] + w[i]) >>> 0, t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b2) ^ (a & c) ^ (b2 & c))) >>> 0;
        h = g2; g2 = f; f = e; e = (d + t1) >>> 0; d = c; c = b2; b2 = a; a = (t1 + t2) >>> 0;
      }
      [a, b2, c, d, e, f, g2, h].forEach((v, i) => { H[i] = (H[i] + v) >>> 0; });
    }
    return H.map((v) => v.toString(16).padStart(8, "0")).join("");
  };
})(globalThis);
