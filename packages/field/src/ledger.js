// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* field/ledger: every conversion appends one entry to the field's chain ledger. An entry names the
   converter, the grade it claimed and the grade measured, the bits lost on the round trip, the tolerance,
   and sha256 hashes of the input and output values. Each entry also holds the hash of the entry before
   it, so editing or dropping a step breaks the chain. Hashing follows tools/kernels receipts: a header
   (encoding, length, unit) and then the bytes, so the same numbers in another encoding hash differently. */
(function (g) {
  "use strict";
  const F = (g.Field = g.Field || {});

  let hasher = null;
  F.setHasher = (fn) => { hasher = fn; };
  const sha256 = (data) => {
    if (hasher) return hasher(data);
    if (typeof require === "function") return require("crypto").createHash("sha256").update(data).digest("hex");
    throw new F.FieldError("no sha256 available: call Field.setHasher in a page");
  };
  F.sha256 = sha256;

  const bytesOf = (f) => {
    const v = f.values;
    if (v instanceof Float64Array || v instanceof Float32Array) return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
    if (typeof v[0] === "number") return Buffer.from(Float64Array.from(v).buffer);
    return Buffer.from(JSON.stringify(Array.from(v)), "utf8");
  };
  F.hashValues = (f) => {
    const enc = f.values.constructor.name, head = `${enc}|${f.values.length}|${f.components}|${f.unit.name}|`;
    return sha256(Buffer.concat([Buffer.from(head, "utf8"), bytesOf(f)]));
  };

  const canon = (x) => {
    if (x === null || typeof x !== "object") return JSON.stringify(x === undefined ? null : x);
    if (Array.isArray(x)) return "[" + x.map(canon).join(",") + "]";
    return "{" + Object.keys(x).sort().filter((k) => x[k] !== undefined).map((k) => JSON.stringify(k) + ":" + canon(x[k])).join(",") + "}";
  };
  F.canonJSON = canon;
  /* entry: plain record; prev and hash are filled here. */
  F.appendEntry = (ledger, entry) => {
    const prev = ledger.length ? ledger[ledger.length - 1].hash : "genesis";
    const body = Object.assign({ i: ledger.length, prev }, entry);
    body.hash = sha256(canon(body));
    return ledger.concat([body]);
  };

  /* Recompute each hash and link. Returns { ok, broken_at } (broken_at = -1 when whole). */
  F.verifyLedger = (ledger) => {
    for (let i = 0; i < ledger.length; i++) {
      const e = Object.assign({}, ledger[i]), h = e.hash;
      delete e.hash;
      const want = i ? ledger[i - 1].hash : "genesis";
      if (e.prev !== want || sha256(canon(e)) !== h || e.i !== i) return { ok: false, broken_at: i };
    }
    return { ok: true, broken_at: -1 };
  };

  F.ledgerJSONL = (ledger) => ledger.map((e) => JSON.stringify(e)).join("\n") + "\n";

  if (typeof module !== "undefined" && module.exports) module.exports = F;
})(typeof globalThis !== "undefined" ? globalThis : this);
