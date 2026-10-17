import { build, P, palette } from "../cast/lamb.mjs";
import { solve } from "../rig/skeleton.mjs";
import { skin } from "../rig/body.mjs";
import { spriteView, rasterize, makeG, placeFn } from "../render/raster.mjs";
import { albedo, light, ink, compose, NEUTRAL } from "../render/shade.mjs";
import { writePng, toRgba8, down } from "../render/io.mjs";
const { M, B } = build(); console.log("verts", M.pos.length / 3, "tris", M.tri.length / 3);
const S = skin(M, B, solve(P, {}));
const ss = 2, W = 400 * ss, H = 640 * ss;
for (const [tag, facing] of [["front", 36], ["side", 36 + 90], ["back", 36 + 180], ["q", 36 - 40]]) {
  const V = spriteView({ yawDeg: 36, elevDeg: 26 }, { w: W, h: H, height: 2.3, centre: [0, 1.05, 0] });
  const G = rasterize(V, M, S, makeG(W, H), placeFn(facing));
  const A = albedo(G, palette), E = light(G, NEUTRAL, palette), I = ink(G, { scale: ss });
  const d = down(compose(G, A, E, I), W, H, ss);
  writePng(`out/t0-${tag}.png`, { width: d.w, height: d.h, data: toRgba8(d.rgba, d.w, d.h, [0.55, 0.53, 0.5]) });
}
