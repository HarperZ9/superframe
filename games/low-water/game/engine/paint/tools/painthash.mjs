// The painter's output over a fixed sequence (three figures, sizes and poses changing, 24 frames), as one
// hash, and the time it took: a speed change must leave the hash alone.
//   node game/engine/paint/tools/painthash.mjs [runs]
import { createHash } from "node:crypto";
import { makePainter } from "../painter.mjs";
import { tables } from "../install.mjs";
import { paletteAt } from "../palette.mjs";
import { figure } from "../tests/fixture.mjs";
const MATS = { coat: { id: 1 }, skin: { id: 4 }, hat: { id: 6 }, cheek: { id: 29 }, jawcool: { id: 39 }, eye: { id: 15 } };
const runs = +(process.argv[2] || 3), times = [];
let digest = "";
for (let r = 0; r < runs; r++) {
  const P = makePainter({ ...tables(MATS) }), H = createHash("sha256"), t0 = performance.now();
  for (let f = 0; f < 24; f++) for (const [key, ppm, yaw] of [["a", 87, 0.02 * f], ["b", 140 + (f % 3) * 20, 1 + 0.05 * f], ["c", 230, -0.5 + 0.01 * f]]) {
    const F = figure({ w: Math.round(1.4 * ppm), h: Math.round(2.9 * ppm), ppm, yaw, dx: 0.004 * f });
    P.paint(F.rgba, F.w, F.h, F.G, 1, { key, ppm, yawDeg: 26, palette: paletteAt("quay", 23 + f / 60), haze: 0 });
    H.update(F.rgba);
  }
  times.push(performance.now() - t0); const d = H.digest("hex"); if (digest && d !== digest) throw new Error("not deterministic run to run"); digest = d;
}
times.sort((a, b) => a - b);
console.log(JSON.stringify({ hash: digest.slice(0, 16), ms: times.map((t) => +t.toFixed(0)), median: +times[times.length >> 1].toFixed(0) }));
