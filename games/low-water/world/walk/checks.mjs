// The camera check on the real island: a scripted walk with the follow camera, swung toward the
// walls every few seconds, and every frame's eye tested against the triangles the page draws (the
// town's mesh and the trunks' bark), not against the solids the camera steers by. Run in the page
// by tools/shot.mjs --check; no drawing, only the walker, its animation and the camera.
import { makeTriangleGrid } from "../play/geocheck.mjs";
import { makeAutopilot } from "../play/autopilot.mjs";

// the drawn triangles within a box of the map: built sites, and the bark of every tree
function gather(W, x0, z0, x1, z1) {
  const G = makeTriangleGrid(), sc = W.scene;
  for (const s of sc.built.sites) {
    if (!s.mesh) continue;
    const d = s.mesh.data, O = s.mesh.origin;
    for (let i = 0; i + 35 < d.length; i += 36) {
      const a = [d[i] + O[0], d[i + 1] + O[1], d[i + 2] + O[2]], b = [d[i + 12] + O[0], d[i + 13] + O[1], d[i + 14] + O[2]], c = [d[i + 24] + O[0], d[i + 25] + O[1], d[i + 26] + O[2]];
      if (Math.max(a[0], b[0], c[0]) < x0 || Math.min(a[0], b[0], c[0]) > x1 || Math.max(a[2], b[2], c[2]) < z0 || Math.min(a[2], b[2], c[2]) > z1) continue;
      // lit cards and lamps are drawn, but a camera may pass a lamp's glow; walls, roofs and steel count
      if (d[i + 8] === 16 || d[i + 8] === 17) continue;
      G.add(a, b, c);
    }
  }
  const forms = sc.forest.forms;
  for (let cz = Math.floor(z0 / 32); cz <= Math.floor(z1 / 32); cz++) for (let cx = Math.floor(x0 / 32); cx <= Math.floor(x1 / 32); cx++) {
    const t = sc.forest.cellOf(cx, cz).t;
    for (let i = 0; i < t.length; i += 8) {
      if (t[i + 4] <= 0.3) continue;
      const m = forms[t[i + 6]].near, sz = t[i + 4], c = Math.cos(t[i + 3]), s = Math.sin(t[i + 3]);
      const P = (k) => { const x = m[k] * sz, y = m[k + 1] * sz, z = m[k + 2] * sz; return [x * c + z * s + t[i], y + t[i + 1], -x * s + z * c + t[i + 2]]; };
      for (let k = 0; k + 35 < m.length; k += 36) if (m[k + 8] < 0.5 && m[k + 1] * sz < 8) G.add(P(k), P(k + 12), P(k + 24));
    }
  }
  return G;
}

// one walk: { viewpoint, seconds, collide, plant } -> frames, bad frames and what each was
export function checkWalk(W, { viewpoint, seconds = 40, collide = true, plant = false, run = false }) {
  const play = W.play, pl = play.player, v = play.stand(viewpoint, "follow"), len = seconds * (run ? 4.6 : 1.45) + 20;
  let pts = W.roads.walkFrom(v.x, v.z, len);
  if (!pts || Math.hypot(pts[0][0] - v.x, pts[0][1] - v.z) > 8) { pts = []; for (let s = 0; s <= len; s += 3) pts.push([v.x + Math.sin(v.yaw) * s, v.z - Math.cos(v.yaw) * s]); }
  // the places near the walk are built now, as a frame drawn there would build them (one a call)
  for (let k = 0; k < 8; k++) W.scene.built.update({ cam: { x: v.x, z: v.z } });
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]), G = gather(W, Math.min(...xs) - 30, Math.min(...zs) - 30, Math.max(...xs) + 30, Math.max(...zs) + 30);
  const pilot = makeAutopilot(pts, { run }), dt = 1 / 30, out = { viewpoint, collide, plant, triangles: G.count, frames: 0, clipped: 0, enclosed: 0, under: 0, nearest: 1e9, armMin: 1e9 };
  pl.cam.state.collide = collide;
  let wall = null;
  for (let i = 0; i < seconds * 30 && !pilot.done; i++) {
    // halfway, a wall is planted two metres behind the walker, across the camera's line
    if (plant && i === Math.floor(seconds * 15)) {
      const b = pl.body.state, f = [Math.sin(pl.cam.state.follow.yaw), -Math.cos(pl.cam.state.follow.yaw)], y = b.y;
      wall = pl.solids.plant({ kind: "box", x: b.x - f[0] * 2, z: b.z - f[1] * 2, turn: -pl.cam.state.follow.yaw, hu: 4, hv: 0.12, y0: y - 1, y1: y + 6 });
      const s = wall, co = Math.cos(s.turn), sn = Math.sin(s.turn), c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, q]) => [s.x + a * s.hu * co + q * s.hv * sn, s.z - a * s.hu * sn + q * s.hv * co]);
      for (let k = 0; k < 4; k++) { const p = c[k], q = c[(k + 1) % 4]; G.add([p[0], s.y0, p[1]], [q[0], s.y0, q[1]], [q[0], s.y1, q[1]]); G.add([p[0], s.y0, p[1]], [q[0], s.y1, q[1]], [p[0], s.y1, p[1]]); }
    }
    const swing = (i % 180 < 45 ? 0.05 : 0) * (i % 360 < 180 ? 1 : -1);
    const raw = { keys: new Set(), pressed: new Set(), mouse: [swing / 0.0022, i % 270 < 20 ? (i % 540 < 270 ? -6 : 6) : 0], wheel: 0 };
    const view = pl.update(dt, raw, { intent: pilot.step(pl.body.state) });
    const p = G.probe(view.eye, 0.18);
    out.frames++; out.nearest = Math.min(out.nearest, p.nearest); out.armMin = Math.min(out.armMin, pl.cam.state.follow.arm);
    if (p.clipped) out.clipped++; if (p.enclosed) out.enclosed++;
    if ((p.clipped || p.enclosed) && (out.samples ||= []).length < 4) out.samples.push({ frame: i, eye: view.eye.map((x) => +x.toFixed(2)), body: [+pl.body.state.x.toFixed(2), +pl.body.state.z.toFixed(2)], arm: +pl.cam.state.follow.arm.toFixed(2), nearest: +p.nearest.toFixed(3), backs: p.backs });
    if (view.eye[1] < pl.solids.ground(view.eye[0], view.eye[2]) + 0.1) out.under++;
  }
  if (wall) pl.solids.unplant(wall);
  pl.cam.state.collide = true;
  out.bad = out.clipped + out.enclosed + out.under;
  out.nearest = +out.nearest.toFixed(3); out.armMin = +out.armMin.toFixed(2);
  return out;
}
