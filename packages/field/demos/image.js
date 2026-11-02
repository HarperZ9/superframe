// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Demo: an image to its spectrum.
   PNG (8-bit sRGB, decoded by superframe playbook/lib/png.js) -> RGB grid field, values code/255, grain 1/255
   --luma (homomorphism: keeps Rec. 709 luma at 8 bits; loses chroma, measured as H(RGB) - H(Y') per pixel)
   --pad (embedding) --spectrum (isomorphism, 2D DFT, inverse within 1e-9)
   --magnitude (homomorphism: keeps energy; loses phase, measured by a zero-phase rebuild coded at 1/255). */
"use strict";
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const F = require("../src/index.js");

const IMAGE = process.env.FIELD_DEMO_IMAGE; // any PNG; the demo skips without one
const PNG = path.resolve(__dirname, "../../../playbook/lib/png.js");

const lumaConv = F.converter({ id: "image.luma709", claims: "homomorphism",
  from: { domain: "grid" },
  forward: (f) => {
    const n = f.values.length / 3, v = new Float64Array(n);
    for (let i = 0; i < n; i++) v[i] = Math.round(255 * (0.2126 * f.values[3 * i] + 0.7152 * f.values[3 * i + 1] + 0.0722 * f.values[3 * i + 2])) / 255;
    return { values: v, components: 1, sigma: f.sigma, rep: { kind: "digital", bits: 8, grain: 1 / 255, encoding: "Rec. 709 luma of sRGB codes" } };
  },
  keeps: { name: "luma within half a code", check: (src, out) => {
    let worst = 0;
    for (let i = 0; i < out.values.length; i++) {
      const y = 0.2126 * src.values[3 * i] + 0.7152 * src.values[3 * i + 1] + 0.0722 * src.values[3 * i + 2];
      worst = Math.max(worst, Math.abs(y - out.values[i]));
    }
    return { ok: worst <= 0.5 / 255 + 1e-12, detail: "worst luma error " + (worst * 255).toFixed(3) + " codes" };
  } },
  lossEstimate: (src, out) => {
    const E = F.entropyOf, n = out.values.length, px = new Array(n), y = new Array(n);
    for (let i = 0; i < n; i++) { px[i] = Math.round(src.values[3 * i] * 255) + "," + Math.round(src.values[3 * i + 1] * 255) + "," + Math.round(src.values[3 * i + 2] * 255); y[i] = Math.round(out.values[i] * 255); }
    const lost = E(px) - E(y);
    return { bits: lost * n, method: `H(RGB) - H(Y') per pixel on this image: ${E(px).toFixed(3)} - ${E(y).toFixed(3)} bits` };
  },
});

const load = async () => {
  const { decodePNG } = await import(pathToFileURL(PNG).href);
  const buf = fs.readFileSync(IMAGE), img = decodePNG(buf), n = img.w * img.h, v = new Float64Array(3 * n);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) v[3 * i + c] = img.data[4 * i + c] / 255;
  return F.make({ name: path.basename(IMAGE), domain: { kind: "grid", shape: [img.h, img.w], spacing: [{ step: 1, unit: "px" }, { step: 1, unit: "px" }] },
    values: v, components: 3, unit: "1", sigma: 1 / 255 / Math.sqrt(12),
    prov: { status: "measured", source: IMAGE, sha256: F.sha256(buf), method: "screenshot of the workstation page, 390 px phone viewport" },
    rep: { kind: "digital", bits: 8, grain: 1 / 255, encoding: "sRGB 8-bit codes / 255" } });
};

const run = async () => {
  const img = await load();
  const y = F.apply(lumaConv, img), p = F.apply(F.C.pad(), y), s = F.apply(F.C.spectrum(1e-9), p), mag = F.apply(F.C.magnitude(1 / 255), s);
  const comp = { image: F.compression(y, 1 / 255), spectrum_magnitude: F.compression(mag, 1e-3) };
  return { image: IMAGE, w: img.domain.shape[1], h: img.domain.shape[0], padded: p.domain.shape, compression: comp,
    chain: mag.ledger.map((e) => ({ converter: e.converter, claimed: e.claimed, measured: e.measured, bitsLost: e.bitsLost, maxErr: e.maxErr, reverse: e.reverse, method: e.method })),
    field: mag };
};

module.exports = { run, lumaConv, load };
