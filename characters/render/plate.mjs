// Plates: load a baked place (content/<place>/) and composite figures into it at the plate camera's
// scale, hidden where the painting stands in front of them (the plate's world buffer).
import { readFileSync } from "node:fs";
import { rn, readPng } from "./io.mjs";
const CAM = await import(rn("web/shaders/paintover/camera.mjs"));
const ROOT = new URL("../../content/", import.meta.url);

export function loadPlate(name, variant = "night") {
  // v2 plates (one-world, orthographic) are not read here yet; their v1 bakes live in content-v1/
  let root = ROOT, info = JSON.parse(readFileSync(new URL(`${name}/place.json`, root), "utf8"));
  if ((info.version || 1) >= 2) { root = new URL("../../content-v1/", import.meta.url); info = JSON.parse(readFileSync(new URL(`${name}/place.json`, root), "utf8")); }
  const W = info.width, H = info.height, ROOTP = root;
  const png = readPng(readFileSync(new URL(`${name}/${variant}.png`, ROOTP))), cam = CAM.isoCamera(info.camera);
  const pos = new Float32Array(readFileSync(new URL(`${name}/geo-pos.f32`, ROOTP)).buffer.slice(0)), depth = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { const y = pos[i * 3 + 1]; depth[i] = y > 900 ? 1e4 : (pos[i * 3] - cam.pos[0]) * cam.fwd[0] + (y - cam.pos[1]) * cam.fwd[1] + (pos[i * 3 + 2] - cam.pos[2]) * cam.fwd[2]; }
  const img = new Float32Array(W * H * 4); for (let i = 0; i < W * H * 4; i++) img[i] = png.data[i] / 255;
  return { name, info, W, H, cam, img, depth, project: (p) => CAM.project(cam, W, H, p) };
}
// Pixels per metre at a world point (perspective plate camera).
export function ppmAt(plate, p) { const d = (p[0] - plate.cam.pos[0]) * plate.cam.fwd[0] + (p[1] - plate.cam.pos[1]) * plate.cam.fwd[1] + (p[2] - plate.cam.pos[2]) * plate.cam.fwd[2]; return plate.H / (2 * Math.tan(plate.info.camera.fovY / 2) * d); }
export const depthOf = (plate, p) => (p[0] - plate.cam.pos[0]) * plate.cam.fwd[0] + (p[1] - plate.cam.pos[1]) * plate.cam.fwd[1] + (p[2] - plate.cam.pos[2]) * plate.cam.fwd[2];

// A soft contact shadow under a figure at ground point p (radius r metres), multiplied into the plate.
export function shadow(plate, p, r = 0.45, k = 0.55) {
  const [cx, cy] = plate.project(p), ppm = ppmAt(plate, p) * (plate.zoom || 1), rx = r * ppm, ry = rx * Math.sin((plate.info.camera.elevDeg * Math.PI) / 180);
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    if (x < 0 || y < 0 || x >= plate.W || y >= plate.H) continue;
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d > 1) continue;
    const a = k * (1 - d) ** 1.5, i = (y * plate.W + x) * 4; for (let c = 0; c < 3; c++) plate.img[i + c] *= 1 - a;
  }
}
// Composite a figure layer (float RGBA at G size, supersample ss, centred at world point centre) into the plate.
export function place(plate, layer, G, ss, centre) {
  if (!plate) return;
  const dc = depthOf(plate, centre), [cx, cy] = plate.project(centre), ox = cx - G.w / ss / 2, oy = cy - G.h / ss / 2, w = Math.floor(G.w / ss), h = Math.floor(G.h / ss);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = Math.round(ox + x), Y = Math.round(oy + y); if (X < 0 || Y < 0 || X >= plate.W || Y >= plate.H) continue;
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < ss; dy++) for (let dx = 0; dx < ss; dx++) {
      const i = (y * ss + dy) * G.w + x * ss + dx, al = layer[i * 4 + 3]; if (al <= 0) continue;
      let hid = false;
      // body pixels test their own depth; the outline outside the body tests the figure's centre depth
      const d = G.id[i] ? depthOf(plate, [G.wp[i * 3], G.wp[i * 3 + 1], G.wp[i * 3 + 2]]) : dc;
      hid = plate.depth[Y * plate.W + X] < d - 0.35;
      if (hid) continue;
      r += layer[i * 4] * al; g += layer[i * 4 + 1] * al; b += layer[i * 4 + 2] * al; a += al;
    }
    if (a <= 0) continue; const k = a / (ss * ss), j = (Y * plate.W + X) * 4;
    plate.img[j] = plate.img[j] * (1 - k) + (r / a) * k; plate.img[j + 1] = plate.img[j + 1] * (1 - k) + (g / a) * k; plate.img[j + 2] = plate.img[j + 2] * (1 - k) + (b / a) * k;
  }
}

// A closer camera on the same plate: crop around a world point and upscale (nearest), carrying the
// world depth, so figures can be placed at the zoomed scale. A stand-in for plates baked at a higher
// resolution for a closer gameplay camera.
export function zoomPlate(plate, zoom, at, dy = -40) {
  const { W, H } = plate, c = plate.project(at), x0 = Math.round(c[0] - W / zoom / 2), y0 = Math.round(c[1] + dy - H / zoom / 2);
  const img = new Float32Array(W * H * 4), depth = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = Math.min(W - 1, Math.max(0, Math.floor(x0 + x / zoom))), sy = Math.min(H - 1, Math.max(0, Math.floor(y0 + y / zoom))), s = sy * W + sx;
    img[(y * W + x) * 4] = plate.img[s * 4]; img[(y * W + x) * 4 + 1] = plate.img[s * 4 + 1]; img[(y * W + x) * 4 + 2] = plate.img[s * 4 + 2]; img[(y * W + x) * 4 + 3] = 1; depth[y * W + x] = plate.depth[s];
  }
  return { ...plate, img, depth, zoom, project: (p) => { const q = plate.project(p); return [(q[0] - x0) * zoom, (q[1] - y0) * zoom, q[2]]; } };
}
export const clonePlate = (p) => ({ ...p, img: new Float32Array(p.img) });
