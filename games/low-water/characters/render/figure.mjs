// Render one or more posed figures into a float RGBA image, in the live look (prototype A) or as a
// G-buffer for the painted bake (prototype C).
import { solveFigure, hiddenOf } from "../rig/solvefig.mjs";
import { skin, groundShift } from "../rig/body.mjs";
import { MATS } from "../rig/materials.mjs";
// Head detail by scale (pixels a metre at the render's own resolution): near for close-ups, mid for
// full figures that fill a frame, far for gameplay distances.
export const lodFor = (ppm) => (ppm > 700 ? "near" : ppm > 220 ? "mid" : "far");
export const PROP_IDS = new Set(["wood", "steel", "brass", "glass", "flame"].map((n) => MATS[n].id));
export const lying = (pose) => { const r = pose.root || {}, a = (((r.pitch || 0) % 360) + 360) % 360; return Math.min(a, 360 - a) > 25; };
import { spriteView, rasterize, makeG, placeFn, castShadow } from "./raster.mjs";
import { albedo, light, ink, compose, NEUTRAL, shadowDir } from "./shade.mjs";
import { down, paste } from "./image.mjs";

// figs: [{ C (cast module with build/P/palette and a cached mesh), pose, facing, at }]
export function gbuffer(figs, view, w, h, ss = 2, rig = null) {
  const V = spriteView(view, { w: w * ss, h: h * ss, height: view.height, centre: view.centre });
  const G = makeG(w * ss, h * ss);
  for (const f of figs) {
    const lod = lodFor((h * ss) / view.height), tool = f.tool || f.C.info?.tool, key = `mesh_${lod}_${tool}`;
    const mesh = f.C[key] || (f.C[key] = f.C.build({ lod, tool }));
    const S = skin(mesh.M, mesh.B, solveFigure(f.C, mesh, f.pose)), at = f.at ?? [0, 0, 0], dy = groundShift(mesh.M, S, PROP_IDS, lying(f.pose));
    const pl = placeFn(f.facing ?? 0, [at[0], at[1] + dy * (f.scale || 1), at[2]], f.scale || 1);
    const hid = hiddenOf(f.pose, mesh); rasterize(V, mesh.M, S, G, pl, hid);
    if (rig) G.pending = [...(G.pending || []), { M: mesh.M, S, pl, dir: shadowDir(rig, at), hid }];
  }
  for (const p of G.pending || []) castShadow(G, p.M, p.S, p.pl, p.dir, { hidden: p.hid });
  G.palette = figs[0]?.C.palette || {};
  return { G, V, ss };
}
// Per-figure palettes: pixels carry a material id only, so mixed casts are rendered one figure per G
// and composited; for the sheets one figure per image is the normal case.
export function live(figs, view, w, h, { rig = NEUTRAL, ss = 2, bands = 0, inkScale = 1 } = {}) {
  const { G } = gbuffer(figs, view, w, h, ss, rig), pal = figs[0].C.palette || {};
  const A = albedo(G, pal), E = light(G, rig, pal), I = ink(G, { scale: ss * inkScale });
  return down(compose(G, A, E, I, { bands }), G.w, G.h, ss);
}
export { paste };
