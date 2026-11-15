// Image diff for the figure drawer (perf/PROGRESS.md): draws a fixed set of figures through one
// checkout's drawer (characters/runtime/fightdrawer.mjs, with the brush painter installed) in Node,
// on real plates (place.json, geo buffer, painted luminance) with a synthetic occluder, and writes
// every image the drawer puts on the canvas (the figure and the ground-shadow mask). Run it for two
// checkouts and compare: a change meant to be exact must give 0 differing bytes.
//   node characters/proto/perf_diff.mjs --root <reference checkout> --out a.bin [--fallback <second checkout>]
//   node characters/proto/perf_diff.mjs --compare a.bin b.bin [--tol 0]
import { readFile, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;

if (opt.compare) {
  const [A, B] = [opt.compare, argv[argv.indexOf("--compare") + 2]], tol = +(opt.tol || 0);
  const load = async (f) => { const buf = await readFile(f), n = buf.readUInt32LE(0), idx = JSON.parse(buf.subarray(4, 4 + n).toString()); let o = 4 + n; return idx.map((e) => { const d = buf.subarray(o, o + e.len); o += e.len; return { ...e, d }; }); };
  const [a, b] = await Promise.all([load(A), load(B)]);
  let bad = 0, worst = 0, bytes = 0, px = 0;
  if (a.length !== b.length) { console.log(`FAIL: ${a.length} images against ${b.length}`); process.exit(1); }
  for (let i = 0; i < a.length; i++) {
    const p = a[i], q = b[i];
    if (p.label !== q.label) { console.log(`FAIL ${p.label} against ${q.label}`); bad++; continue; }
    if (p.w !== q.w || p.h !== q.h || p.x !== q.x || p.y !== q.y) {   // placed differently (a cropped upload): compared on the screen, transparent outside each
      const X0 = Math.min(p.x, q.x), Y0 = Math.min(p.y, q.y), X1 = Math.max(p.x + p.w, q.x + q.w), Y1 = Math.max(p.y + p.h, q.y + q.h); let dpx = 0, mx = 0;
      const at = (o, X, Y) => { const x = X - o.x, y = Y - o.y; if (x < 0 || y < 0 || x >= o.w || y >= o.h) return [0, 0, 0, 0]; const k = (y * o.w + x) * 4; return [o.d[k], o.d[k + 1], o.d[k + 2], o.d[k + 3]]; };
      for (let Y = Y0; Y < Y1; Y++) for (let X = X0; X < X1; X++) { const a = at(p, X, Y), b = at(q, X, Y); let e = Math.abs(a[3] - b[3]); if (a[3] && b[3]) for (let c = 0; c < 3; c++) e = Math.max(e, Math.abs(a[c] - b[c])); if (e > tol) dpx++; mx = Math.max(mx, e); }
      bytes += (X1 - X0) * (Y1 - Y0) * 4; px += dpx; worst = Math.max(worst, mx); if (dpx) { bad++; console.log(`DIFF ${p.label} (screen): ${dpx} pixels differ, max ${mx}`); }
      continue;
    }
    let diff = 0, mx = 0, dpx = 0;
    for (let k = 0; k < p.d.length; k += 4) { let any = false; for (let c = 0; c < 4; c++) { const e = Math.abs(p.d[k + c] - q.d[k + c]); if (e > mx) mx = e; if (e > tol) { diff++; any = true; } } if (any) dpx++; }
    bytes += p.d.length; px += dpx; worst = Math.max(worst, mx);
    if (diff) { bad++; console.log(`DIFF ${p.label}: ${dpx} of ${p.d.length / 4} pixels differ, max ${mx}`); }
  }
  console.log(`${a.length} images, ${(bytes / 4 / 1e6).toFixed(2)} Mpx compared; ${bad} differ beyond ${tol} (${px} pixels), max difference ${worst} of 255`);
  process.exit(bad ? 1 : 0);
}

const { nodeHost } = await import("./nodehost.mjs");
const H = await nodeHost(opt), { root, readAny, png, shots, makeFightDrawer, plateCtx } = H;

const poseOf = (W, F) => F.pose, actorOf = (W, F) => F.who;
const screen = new OffscreenCanvas(1920, 1080); screen.label = "screen"; const g = screen.getContext("2d");
const W = { defs: {}, moves: {} };

// cases: a plate, a camera from its place.json, figures placed at world points with poses
async function place(name) { return JSON.parse((await readAny(`content/${name}/place.json`)).toString()); }
function project(cam, W0, H0, P) {   // the plate's bake camera, as platectx.mjs
  const D2R = Math.PI / 180, yaw = cam.yawDeg * D2R, el = cam.elevDeg * D2R, t = cam.target, dist = cam.dist, f = [-Math.sin(yaw) * Math.cos(el), -Math.sin(el), -Math.cos(yaw) * Math.cos(el)];
  const rl = Math.hypot(f[2], f[0]), right = [-f[2] / rl, 0, f[0] / rl], up = [right[1] * f[2] - right[2] * f[1], right[2] * f[0] - right[0] * f[2], right[0] * f[1] - right[1] * f[0]];
  const pos = [t[0] - f[0] * dist, t[1] - f[1] * dist, t[2] - f[2] * dist], r = [P[0] - pos[0], P[1] - pos[1], P[2] - pos[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], asp = W0 / H0;
  const u = dot(r, right) / ((cam.scale || 8) * asp), v = dot(r, up) / (cam.scale || 8);
  return [((u + 1) / 2) * W0 - 0.5, ((1 - v) / 2) * H0 - 0.5, dot(r, f)];
}
const CASES = [
  { plate: "quay", zoom: 0.55, figs: [["lamb", [0.4, 0, -1.4], { anim: "walk", loop: true }], ["fewell", [1.2, 0, -1.8], { anim: "idle", loop: true }], ["strand", [2.0, 0, -2.4], { anim: "talk_b", loop: true }]] },
  { plate: "brine", zoom: 1.0, figs: [["lamb", [0.2, 0, -1.2], { anim: "idle", loop: true }], ["merrow", [-1.0, 0, -0.6], { anim: "talk_a", loop: true }], ["sabine", [1.0, 0, -2.2], { anim: "idle", loop: true }]] },
  { plate: "quay", zoom: 0.55, figs: [["warden", [3.3, 0, -2.3], { anim: "heavy", t: 0 }, 0.07], ["salvor", [4.0, 0, -2.4], { anim: "light_1", t: 0 }, 0.05]] },
];
const FRAMES = +(opt.frames || 4);
// the drawer's section timers (characters/runtime/perf.mjs) over the frames after the first WARM of each case, printed at the end
const WARM = Math.min(3, FRAMES - 1), TOT = [], SUM = [];
for (const [ci, C] of CASES.entries()) {
  const pj = await place(C.plate), cam = pj.camera, variant = pj.variants[0], lights = (pj.lights && pj.lights[variant]) || [];
  const draw = await makeFightDrawer({ poseOf, actorOf, camera: { yawDeg: cam.yawDeg, elevDeg: cam.elevDeg } });
  // the screen shows the plate at C.zoom, centred on the first figure
  const c0 = project(cam, pj.width, pj.height, C.figs[0][1]), left = c0[0] - 960 / C.zoom, top = c0[1] - 600 / C.zoom;
  const toScreen = (p) => { const q = project(cam, pj.width, pj.height, p); return [(q[0] - left) * C.zoom, (q[1] - top) * C.zoom, q[2]]; };
  // a synthetic post nearer than everything, 60 px wide, through the first figure's right side; the floor elsewhere
  const s0 = toScreen(C.figs[0][1]), depthAt = (sx, sy) => (sx > s0[0] + 8 && sx < s0[0] + 68 && sy < s0[1] - 30 ? 1 : 1e9);
  for (let fr = 0; fr < FRAMES; fr++) {
    globalThis.__lwPerf = {}; if (fr >= WARM) (TOT[ci] ||= []).push(globalThis.__lwPerf);
    for (const [fi, [who, at, pose, dt]] of C.figs.entries()) {
      const s = toScreen(at), s1 = toScreen([at[0], at[1] + 1, at[2]]), ppm = Math.abs(s[1] - s1[1]);
      const P = pose.t != null ? { anim: pose.anim, t: pose.t + fr * (dt || 0) } : pose;
      const F = { id: `${who}#${ci}`, who, person: true, team: who === "lamb" ? "lamb" : "town", x: at[0], z: at[2], face: 1.2 + fi, pose: P };
      shots.tag = `case${ci}/f${fr}/${who}`;
      draw(g, F, { x: s[0], y: s[1], ppm, at, face: F.face, cam, plate: C.plate, depth: s[2], depthAt, lights, darkness: 0, W, down: false, room: 2.2 });
    }
    await new Promise((r) => setTimeout(r, 0));   // the ground-shadow flush (a microtask)
    if (fr === 0) { const s = toScreen(C.figs[0][1]); for (let i = 0; i < 600 && !plateCtx({ plate: C.plate, at: C.figs[0][1], x: s[0], y: s[1], ppm: 100, lights }); i++) await new Promise((r) => setTimeout(r, 100)); }   // the plate's luminance loads (frame 0 is drawn without it in every run)
  }
}
// the ground shadow may go up in several rectangles (groundshadow.mjs clusters): a frame's are merged into one
// image over their union, transparent elsewhere, so checkouts that cut it differently compare pixel for pixel
for (let i = 0; i < shots.length; i++) {
  const A = shots[i]; if (!A.label.endsWith(":destination-over")) continue;
  let j = i + 1; while (j < shots.length && shots[j].label === A.label) j++;
  if (j - i < 2) continue;
  const run = shots.slice(i, j), X0 = Math.min(...run.map((r) => r.x)), Y0 = Math.min(...run.map((r) => r.y)), X1 = Math.max(...run.map((r) => r.x + r.w)), Y1 = Math.max(...run.map((r) => r.y + r.h)), W = X1 - X0, H = Y1 - Y0, d = new Uint8Array(W * H * 4);
  for (const r of run) for (let y = 0; y < r.h; y++) d.set(r.d.subarray(y * r.w * 4, (y + 1) * r.w * 4), ((r.y - Y0 + y) * W + r.x - X0) * 4);
  shots.splice(i, j - i, { label: A.label, d, w: W, h: H, x: X0, y: Y0 });
}
const idx = shots.map((s) => ({ label: s.label, w: s.w, h: s.h, x: s.x, y: s.y, len: s.d.length })), head = Buffer.from(JSON.stringify(idx)), n = Buffer.alloc(4); n.writeUInt32LE(head.length);
await writeFile(opt.out, Buffer.concat([n, head, ...shots.map((s) => Buffer.from(s.d.buffer, s.d.byteOffset, s.d.byteLength))]));
// per case, each section's median over the measured frames (the machine is shared; a median holds)
for (const [ci, T] of TOT.entries()) { const keys = [...new Set(T.flatMap((f) => Object.keys(f)))], med = (k) => { const v = T.map((f) => (f[k] ? f[k].ms : 0)).sort((a, b) => a - b); return v[v.length >> 1]; };
  console.log(`case ${ci} median ms a frame: ` + keys.map((k) => [k, med(k)]).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(", ")); }
console.log(`${shots.length} images written to ${opt.out} (${shots.map((s) => s.label.split("/").pop()).slice(0, 4).join(", ")}, ...)`);
