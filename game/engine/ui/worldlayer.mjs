// Shared pieces for scenes that play in the painted world (design/UI-SYSTEM.md 7, 7.3, 7.4). Owned
// by the UI and UX lead. A fight, a sneak and a Tide Run all draw over the plate view under the
// game camera: a canvas for figures and ground marks, a stage that lays the scene's own metres on
// the area's world (world/stage.mjs), and a camera framing that keeps every figure clear of the
// paper (the strip bottom left, the HUD tab top left).
//   const L = worldCanvas(host, { G, cam, id, size })   L.canvas, L.stage, L.screen([x, z], h)
//   L.ctx() -> 2d context sized to the layer, cleared;  clearOfPaper(bounds, cam, papers)
//   ground marks: ring, hatchPoly, wedge (pencil and ink, in the plates' ink family; UX-AUDIT A2)
import { h } from "./dom.mjs";
import { stageFor } from "../world/stage.mjs";
import { personDrawer } from "./figures.mjs";

export const INK = "rgba(26,17,24,", PAPER = "rgba(233,227,212,";

export function worldCanvas(host, { G, cam = null, id = null, size = [16, 10], origin = [0, 0] }) {
  const canvas = h("canvas.fightcanvas");
  host.append(canvas);
  const stage = stageFor(G, id, size);
  const flat = (x, z) => { // no plate (a harness): the scene as plain ground fitted to the layer
    const sc = Math.min(canvas.width / (size[0] + 2), canvas.height / (size[1] + 2));
    return { x: (x - origin[0] + 1) * sc, y: (z - origin[1] + 1) * sc, ppm: sc };
  };
  return {
    canvas, stage,
    screen([x, z], hgt = 0) {
      const p = stage.toWorld([x, z], hgt);
      if (cam && cam.ready()) { const s = cam.toScreen(p); return s && { x: s[0], y: s[1], ppm: cam.scaleAt(p) }; }
      return flat(x, z);
    },
    ctx() {
      const r = canvas.getBoundingClientRect();
      if (canvas.width !== Math.round(r.width) || canvas.height !== Math.round(r.height)) { canvas.width = Math.round(r.width); canvas.height = Math.round(r.height); }
      const g = canvas.getContext("2d"); g.clearRect(0, 0, canvas.width, canvas.height);
      if (!cam) { g.fillStyle = "#1a1416"; g.fillRect(0, 0, canvas.width, canvas.height); }
      return g;
    },
    remove: () => canvas.remove(),
  };
}

// Plate-pixel bounds widened so the camera centres the figures in the part of the screen the paper
// leaves free (LOOK-UNIFIED R7: panels never cover the fighters). papers: elements on screen.
export function clearOfPaper(bounds, cam, papers = []) {
  if (!bounds || !cam || !cam.frameNow || !cam.frameNow()) return bounds;
  const z = cam.frameNow().zoom || 1, view = cam.element.getBoundingClientRect();
  let [x0, y0, x1, y1] = bounds;
  for (const el of papers) {
    if (!el || !el.isConnected) continue;
    const r = el.getBoundingClientRect(); if (!r.width) continue;
    const left = r.left - view.left < view.width / 3, bottom = r.bottom - view.top > (view.height * 2) / 3, top = r.top - view.top < view.height / 3;
    if (left && bottom) { x0 -= (r.right - view.left) / z; y1 += (view.bottom - r.top) / z; }
    else if (left && top) { x0 -= (r.right - view.left) / z * 0.5; y0 -= (r.bottom - view.top) / z * 0.5; }
  }
  return [x0, y0, x1, y1];
}

// ---- ground marks: drawn on the ground plane, never floating ----
export function groundPoly(L, pts) { return pts.map((p) => L.screen(p)).filter(Boolean); }
export function pathOf(g, sp) { g.beginPath(); sp.forEach((s, i) => (i ? g.lineTo(s.x, s.y) : g.moveTo(s.x, s.y))); g.closePath(); }
export function circlePts([x, z], r, n = 28) { return Array.from({ length: n }, (_, k) => [x + Math.cos((k / n) * Math.PI * 2) * r, z + Math.sin((k / n) * Math.PI * 2) * r]); }
export function wedgePts([x, z], face, range, halfDeg, n = 18) {
  const half = (halfDeg * Math.PI) / 180, a0 = Math.atan2(Math.cos(face), Math.sin(face)), pts = [[x, z]];
  for (let k = 0; k <= n; k++) { const a = a0 - half + (2 * half * k) / n; pts.push([x + Math.cos(a) * range, z + Math.sin(a) * range]); }
  return pts;
}
// Pencil hatching clipped to a ground polygon: graphite at density by strength (0 to 1).
export function hatch(g, sp, strength = 0.3, gap = 7, ink = false) {
  if (sp.length < 3) return;
  const xs = sp.map((s) => s.x), ys = sp.map((s) => s.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  g.save(); pathOf(g, sp); g.clip();
  g.strokeStyle = ink ? `${INK}${0.35 + strength * 0.4})` : `rgba(107,98,92,${0.25 + strength * 0.45})`; g.lineWidth = 1;
  for (let k = x0 - (y1 - y0); k < x1; k += gap) { g.beginPath(); g.moveTo(k, y1); g.lineTo(k + (y1 - y0), y0); g.stroke(); }
  g.restore();
}
export function outline(g, sp, { dash = null, width = 1.5, alpha = 0.8 } = {}) {
  if (sp.length < 2) return;
  g.save(); g.setLineDash(dash || []); g.strokeStyle = `${INK}${alpha})`; g.lineWidth = width; pathOf(g, sp); g.stroke(); g.restore();
}
export function ring(g, L, at, r, opts = {}) { outline(g, groundPoly(L, circlePts(at, r)), opts); }

// A person in the scene (a watcher, a pursuer) through the one person drawer (ui/figures.mjs), so
// the character pipeline draws them as it draws everyone else.
export function drawPerson(g, L, cam, who, [x, z], { face = 0, walking = false, crouch = false } = {}) {
  const s = L.screen([x, z]); if (!s) return;
  const at = L.stage.toWorld([x, z], 0), pj = cam && cam.place ? cam.place() : null;
  personDrawer()(g, { who }, { x: s.x, y: s.y, ppm: s.ppm * (crouch ? 0.72 : 1), at, face, walking, running: false, talking: false, gesture: null,
    cam: pj && pj.camera, plate: pj && pj.place, depth: cam && cam.depthOf ? cam.depthOf(at) : 0, depthAt: cam && cam.depthAt, lights: [] });
}
// Lamb is drawn by the people layer (ui/peoplelayer.mjs) at G.state.pos; a scene moves her there.
export function placeLamb(G, L, [x, z]) { if (L.stage) G.state.pos = L.stage.toWorld([x, z], 0); }
