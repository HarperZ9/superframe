// The red flash rule (F5) is WCAG 2.2's (cine/redflash.mjs): a red transition has one state saturated red by
// R / (R + G + B) >= 0.8 and the two states more than 0.2 apart in CIE 1976 u'v', read on each window's mean colour.
// 2026-10-23: the share-of-pixels count it replaced read a fight camera panning across an amber, lamp-lit wall as 35
// to 37 red transitions with every light held still; WCAG 2.0's (R - G - B) x 320 measure passed the fight by 19.5
// against 20 and fails the same wall framed closer (below).
import { test } from "node:test";
import assert from "node:assert/strict";
import { judgeFlash, windowsOf } from "../cine/flash.mjs";
import { chroma } from "../cine/redflash.mjs";
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const W = 160, H = 90;
const frame = (fill) => { const d = new Uint8ClampedArray(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = fill(x, y), i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; } return windowsOf(d, W, H, 1); };
const run = (secs, fill, fps = 30) => Array.from({ length: secs * fps }, (_, i) => frame((x, y) => fill(i / fps, x, y)));
// the quay's lamp-lit wall: amber brushwork, one stroke in ten saturated red by the linear ratio (R / (R + G + B) of
// 0.8 or more), the rest orange under it; the real capture's windows peak at a share of 0.16 and a measure of 19.5
const AMBER = [214, 96, 18], ORANGE = [214, 130, 40], GROUND = [40, 28, 48];
const speck = (x, y) => Math.abs((x * 73856093) ^ (y * 19349663)) % 10 === 0;

test("an amber wall panned across the windows is no red flash; the old share count called it one", () => {
  const pan = run(4, (t, x, y) => { const edge = 40 + 60 * (0.5 - 0.5 * Math.cos(Math.PI * t)); return x > edge && x < edge + 50 ? (speck(x - Math.round(edge), y) ? AMBER : ORANGE) : GROUND; });
  const j = judgeFlash(pan);
  assert.deepEqual(j.errs, []);
  assert.ok(j.redShareTransitions > 0, "the control: by the share of pixels the pan counted");
});

test("a 2 Hz pulse of dark red and of bright red over a quarter of the frame both fail", () => {
  for (const red of [[90, 0, 0], [255, 0, 0]]) {
    const j = judgeFlash(run(2, (t, x, y) => (Math.floor(t * 4) % 2 && x < 80 && y < 45 ? red : GROUND)));
    assert.ok(j.errs.some((e) => /red/.test(e)), `a 2 Hz pulse of ${red} passed`);
  }
});

test("a small dim red patch in a window of other colour is no saturated-red state, and passes", () => {
  const j = judgeFlash(run(2, (t, x, y) => (Math.floor(t * 4) % 2 && x < 6 && y < 6 ? [60, 0, 0] : GROUND)));
  assert.equal(j.redTransitions, 0);
});

// the quay's lamp-lit wall and its red lamp head, cut from the outer fight's frame 75 at half size (tests/fixtures/quay-wall-315x260.rgb.gz),
// panned at four framings. The fight's camera at its closest shows about 3 times more of the wall than framing 1.
// stored as gzipped raw RGB (the repository ignores *.png): 315 x 260, three bytes a pixel
const WALL = (() => { const rgb = gunzipSync(readFileSync(fileURLToPath(new URL("./fixtures/quay-wall-315x260.rgb.gz", import.meta.url)))), data = new Uint8ClampedArray(315 * 260 * 4);
  for (let i = 0, j = 0; j < rgb.length; i += 4, j += 3) { data[i] = rgb[j]; data[i + 1] = rgb[j + 1]; data[i + 2] = rgb[j + 2]; data[i + 3] = 255; }
  return { width: 315, height: 260, data }; })();
const framed = (fx) => {
  const IW = WALL.width, IH = WALL.height, sw = IW * fx, sh = (sw * H) / W, out = [];
  for (let t = 0; t < 90; t++) {
    const u = 0.5 - 0.5 * Math.cos((Math.PI * 2 * t) / 90), ox = (IW - sw) * u, oy = (IH - sh) * (0.3 + 0.4 * u), d = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (Math.min(IH - 1, Math.floor(oy + (y * sh) / H)) * IW + Math.min(IW - 1, Math.floor(ox + (x * sw) / W))) * 4, o = (y * W + x) * 4; d[o] = WALL.data[i]; d[o + 1] = WALL.data[i + 1]; d[o + 2] = WALL.data[i + 2]; d[o + 3] = 255; }
    out.push(windowsOf(d, W, H, 1));
  }
  return out;
};
// the largest u'v' distance from a saturated-red state to any other state of the same window: the margin under 0.2
const margin = (frames) => { let best = 0; for (let k = 0; k < frames[0].M.length; k++) { const cs = frames.map((f) => chroma(f.M[k])).filter((c) => c.Y >= 0.0005); for (const a of cs) if (a.red) for (const b of cs) best = Math.max(best, Math.hypot(a.u - b.u, a.v - b.v)); } return best; };

test("the quay wall framed 3, 6, 12 and 25 times closer than the fight still has no red transition (margin under 0.2)", () => {
  const seen = [];
  for (const fx of [1, 0.5, 0.25, 0.12]) {
    const fr = framed(fx), j = judgeFlash(fr, 30), m = margin(fr); seen.push(`${fx}: ${m.toFixed(3)}`);
    assert.equal(j.redTransitions, 0, `framing ${fx}`);
    assert.ok(m < 0.2, `framing ${fx}: a red state ${m.toFixed(3)} from another in u'v'`);
  }
  // measured 2026-10-23: 0.000, 0.082, 0.117, 0.189; the closest framing is the thin one
  assert.ok(margin(framed(0.12)) > 0.15, `the closest framing's margin moved: ${seen.join(", ")}`);
});

test("the control: WCAG 2.0's (R - G - B) x 320 count fails the same wall at the first closer framing", () => {
  assert.ok(judgeFlash(framed(1), 30).redE20Transitions > 0);
});
