// The character lead's figures (characters/: one rig, real-time path A: skinned mesh, brushwork,
// banded light, ink) placed into a 1920 x 1080 still cut from a v2 plate, at the plate's density
// (pxPerMetre) and hidden where the painting stands in front (the plate's world buffer). Glue for
// the look stills only; the game draws people at run time.
import { readFileSync } from "node:fs";
import { rn } from "../rn.mjs";
const CH = new URL("../../characters/", import.meta.url);
const { library } = await import(new URL("anim/library.mjs", CH).href), { gbuffer } = await import(new URL("render/figure.mjs", CH).href);
const { albedo, light, ink, compose, sodiumTone } = await import(new URL("render/shade.mjs", CH).href), { RIGS } = await import(new URL("render/rigs.mjs", CH).href);
const CAM = await import(rn("web/shaders/paintover/camera.mjs"));

// who stands where (world coordinates of the new plates)
export const SCENES = {
  quay: { rig: "quay", figs: [{ who: "fennick", at: [-2.7, -0.69, 1.4], facing: 20, clip: "talk_a" }, { who: "lamb", at: [-1.4, 0, -0.9], facing: -60, clip: "idle" }, { who: "marrow", at: [2.3, 0, -1.5], facing: 60, clip: "talk_c" }], lamps: [[3.5, 4.45, -1.3], [-10, 4.45, -1.3]] },
  brine: { rig: "brine", figs: [{ who: "fennick", at: [-0.9, 0, 0.9], facing: 50, clip: "talk_a" }, { who: "lamb", at: [0.5, 0, 0.9], facing: -80, clip: "talk_b" }] },
  weigh: { rig: "weigh", figs: [{ who: "marrow", at: [0.9, 0, 1.4], facing: 30, clip: "talk_c" }, { who: "lamb", at: [2.4, 0, 2.6], facing: -150, clip: "idle" }] },
};

export async function placeFigures(still, { info, cam, W, H, name, scene, custom = null }) {
  const S = custom || SCENES[scene]; if (!S) throw new Error(`no figure scene for ${scene}`);
  const names = [...new Set(S.figs.map((f) => f.who))], cast = Object.fromEntries(await Promise.all(names.map(async (n) => [n, { ...(await import(new URL(`cast/${n}.mjs`, CH).href)) }])));
  const L = library(Object.fromEntries(names.map((n) => [n, cast[n].style]).filter(([, s]) => s)));
  const R = RIGS[S.rig], rig = S.lamps ? { ...R.rig, lamps: S.lamps.map((pos) => ({ pos, c: [1.0, 0.62, 0.26], power: 44 })) } : R.rig, ppm = info.pxPerMetre;
  // depth of the plate per still pixel, from the half-size world buffer
  const pos = new Float32Array(readFileSync(new URL(`../../content/${name}/geo-pos.f32`, import.meta.url)).buffer.slice(0)), w2 = W >> 1, depth = new Float32Array(still.W * still.H);
  for (let y = 0; y < still.H; y++) for (let x = 0; x < still.W; x++) { const i = (Math.min((H >> 1) - 1, (still.y0 + y) >> 1) * w2 + Math.min(w2 - 1, (still.x0 + x) >> 1)) * 3; depth[y * still.W + x] = pos[i + 1] > 900 ? 1e4 : (pos[i] - cam.pos[0]) * cam.fwd[0] + (pos[i + 1] - cam.pos[1]) * cam.fwd[1] + (pos[i + 2] - cam.pos[2]) * cam.fwd[2]; }
  const proj = (p) => { const q = CAM.project(cam, W, H, p); return [q[0] - still.x0, q[1] - still.y0, q[2]]; }, dOf = (p) => (p[0] - cam.pos[0]) * cam.fwd[0] + (p[1] - cam.pos[1]) * cam.fwd[1] + (p[2] - cam.pos[2]) * cam.fwd[2];
  const order = [...S.figs].sort((a, b) => dOf(b.at) - dOf(a.at));
  for (const f of order) {
    // a soft contact shadow
    const [cx, cy] = proj(f.at), rx = 0.42 * ppm, ry = rx * Math.sin((info.camera.elevDeg * Math.PI) / 180);
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { if (x < 0 || y < 0 || x >= still.W || y >= still.H) continue; const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d > 1) continue; const k = 0.55 * (1 - d) ** 1.5, i = (y * still.W + x) * 4; for (let c = 0; c < 3; c++) still.img[i + c] *= 1 - k; }
    const C = cast[f.who], hM = 2.8, h = Math.ceil(hM * ppm), w = Math.ceil(h * 0.8), ss = 2, centre = [f.at[0], f.at[1] + 1.05, f.at[2]];
    const view = { yawDeg: info.camera.yawDeg, elevDeg: info.camera.elevDeg, height: hM, centre }, pose = L.pose(f.who, f.clip || "idle", f.frame ?? 10); pose.root = { ...pose.root, x: 0, z: 0 };
    const { G } = gbuffer([{ C, pose, facing: info.camera.yawDeg + f.facing, at: f.at, tool: f.tool }], view, w, h, ss, rig);
    const layer = compose(G, albedo(G, C.palette), light(G, rig, C.palette), ink(G, { scale: ss * 0.7 }), { bands: 4 });
    if (R.tone) for (let i = 0; i < G.w * G.h; i++) if (G.id[i]) layer.set(R.tone([layer[i * 4], layer[i * 4 + 1], layer[i * 4 + 2]]), i * 4);
    const [px, py] = proj(centre), ox = px - G.w / ss / 2, oy = py - G.h / ss / 2;
    for (let y = 0; y < Math.floor(G.h / ss); y++) for (let x = 0; x < Math.floor(G.w / ss); x++) {
      const X = Math.round(ox + x), Y = Math.round(oy + y); if (X < 0 || Y < 0 || X >= still.W || Y >= still.H) continue;
      let r = 0, g = 0, b = 0, al = 0;
      for (let dy = 0; dy < ss; dy++) for (let dx = 0; dx < ss; dx++) { const i = (y * ss + dy) * G.w + x * ss + dx, a = layer[i * 4 + 3]; if (a <= 0) continue; if (G.id[i] && depth[Y * still.W + X] < dOf([G.wp[i * 3], G.wp[i * 3 + 1], G.wp[i * 3 + 2]]) - 0.35) continue; r += layer[i * 4] * a; g += layer[i * 4 + 1] * a; b += layer[i * 4 + 2] * a; al += a; }
      if (al <= 0) continue; const k = al / (ss * ss), j = (Y * still.W + X) * 4;
      still.img[j] = still.img[j] * (1 - k) + (r / al) * k; still.img[j + 1] = still.img[j + 1] * (1 - k) + (g / al) * k; still.img[j + 2] = still.img[j + 2] * (1 - k) + (b / al) * k;
    }
  }
}
