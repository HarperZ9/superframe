import { makePainter } from "../painter.mjs";
import { tables } from "../install.mjs";
import { paletteAt } from "../palette.mjs";
import { figure } from "./fixture.mjs";
const MATS = { coat: { id: 1 }, skin: { id: 4 }, hat: { id: 6 }, cheek: { id: 29 }, jawcool: { id: 39 } };
const P = makePainter({ ...tables(MATS) }), ppm = +(process.argv[2] || 87);
const pal = paletteAt("quay", 23);
for (let f = 0; f < 30; f++) {
  const F = figure({ w: Math.round(1.4 * ppm), h: Math.round(2.9 * ppm), ppm, yaw: f * 0.02 });
  P.paint(F.rgba, F.w, F.h, F.G, 1, { key: "a", ppm, yawDeg: 26, palette: pal, haze: 0 });
}
console.log(JSON.stringify(globalThis.__lwPaintStats.a));
