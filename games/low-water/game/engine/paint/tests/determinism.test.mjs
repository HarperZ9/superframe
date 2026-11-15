// A figure's paint depends only on its own inputs and history: two painters (as a worker and the main thread
// hold) that see the same frames of figure X give the same bytes, whatever else either painted in between
// (the performance engineer's verify mode found strokes differing by up to 60 of 255 when birthDir handed
// back the shared form array). And the palette cache is pure: the same minute gives the same paint whatever
// second was asked first.
import test from "node:test";
import assert from "node:assert/strict";
import { makePainter } from "../painter.mjs";
import { tables } from "../install.mjs";
import { paletteAt } from "../palette.mjs";
import { figure } from "./fixture.mjs";
const MATS = { coat: { id: 1 }, skin: { id: 4 }, hat: { id: 6 }, cheek: { id: 29 }, jawcool: { id: 39 }, eye: { id: 15 } };

test("figure X paints the same bytes whether or not another figure was painted between its frames", () => {
  const pal = paletteAt("quay", 23), A = makePainter({ ...tables(MATS) }), B = makePainter({ ...tables(MATS) });
  let diff = 0, total = 0;
  for (let f = 0; f < 8; f++) {
    // A: X then another figure Y (different pose and size, flat patches, births every frame); B: X alone
    const pp = f % 2 ? 150 : 87, XA = figure({ w: Math.round(1.4 * pp), h: Math.round(2.9 * pp), ppm: pp, yaw: f * 0.03, dx: f * 0.01 }), XB = figure({ w: Math.round(1.4 * pp), h: Math.round(2.9 * pp), ppm: pp, yaw: f * 0.03, dx: f * 0.01 });   // the size changes every frame, so the stroke cache is rebuilt from the kept directions
    A.paint(XA.rgba, XA.w, XA.h, XA.G, 1, { key: "x", ppm: pp, yawDeg: 26, palette: pal, haze: 0 });
    const Y = figure({ w: 160, h: 330, ppm: 115, yaw: 1.3 + f * 0.05 }); A.paint(Y.rgba, Y.w, Y.h, Y.G, 1, { key: "y", ppm: 115, yawDeg: 26, palette: pal, haze: 0 });
    B.paint(XB.rgba, XB.w, XB.h, XB.G, 1, { key: "x", ppm: pp, yawDeg: 26, palette: pal, haze: 0 });
    for (let i = 0; i < XA.rgba.length; i++) { total++; if (XA.rgba[i] !== XB.rgba[i]) diff++; }
  }
  assert.equal(diff, 0, `${diff} of ${total} bytes differ`);
});

test("the palette for a minute does not depend on which second asked first (two threads, two caches)", async () => {
  // two fresh copies of the module, as a worker and the main thread each hold their own cache
  const T1 = await import("../palette.mjs?thread=1"), T2 = await import("../palette.mjs?thread=2");
  for (const [place, h, s1, s2] of [["brine", 21 + 13 / 60, 1, 25], ["mole", 4 + 7 / 60, 2, 29], ["quay", 23 + 59 / 60, 0, 20]]) {
    const a = T1.paletteAt(place, h + s1 / 3600), b = T2.paletteAt(place, h + s2 / 3600);
    assert.equal(JSON.stringify(a), JSON.stringify(b), `${place} at ${h.toFixed(3)}: the first second asked changed the paint`);
  }
});
