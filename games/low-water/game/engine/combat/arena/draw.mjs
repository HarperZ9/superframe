// The arena's look, on the CPU: a 640x360 canvas drawn in values (ink to paper), then an
// ordered dither into five tones, warm under sodium and cold away from it, scaled up 2x. The
// ground is lit by the same light the simulation's sight rule reads, so what the player can see
// is what Lamb can see. Opponents Lamb cannot see are not drawn.
import { drawFigure, drawProjectile } from "./figure.mjs";
import { drawHud } from "./hud.mjs";
import { lamps } from "../sim/target.mjs";
import { poseOf } from "../anim/drive.mjs";

const IW = 640, IH = 360, S = 30, TILT = 0.62;
const SURF = { stone: 0.6, mud: 0.34, weed: 0.26, wood: 0.5, shingle: 0.46 };
const WARM = [[18, 8, 10], [72, 34, 22], [150, 86, 44], [222, 152, 86], [248, 220, 168]];
const COLD = [[16, 12, 18], [52, 46, 58], [112, 106, 112], [186, 180, 172], [238, 232, 220]];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const gray = (v, a = 1) => { const c = Math.round(clamp(v) * 255); return `rgba(${c},${c},${c},${a})`; };

export function createView(canvas, W) {
  const out = canvas.getContext("2d"), buf = new OffscreenCanvas(IW, IH), g = buf.getContext("2d", { willReadFrequently: true });
  const V = { W, cam: { x: W.lamb().x, z: W.lamb().z }, shake: 0, shakeT: 0, bark: null, barkT: 0, flashes: [], sparks: [], t: 0 };
  V.proj = (x, z, y = 0) => [IW / 2 + (x - V.cam.x) * S + V.sx, IH / 2 + (z - V.cam.z) * S * TILT - y * S + V.sy];
  V.events = (ev) => {
    for (const e of ev) {
      if (e.type === "shake") { V.shake = Math.max(V.shake, e.amp); V.shakeT = Math.max(V.shakeT, e.frames); }
      if (e.type === "bark") { V.bark = e; V.barkT = 150; }
      if (["parry", "block", "guardbreak", "ducked", "lit", "doused", "gust", "disarm"].includes(e.type)) V.flashes.push({ ...e, life: 40 });
      if (["hit", "parry", "block"].includes(e.type)) { const T = W.byId(e.id); if (T) V.sparks.push({ x: T.x, z: T.z, y: W.defs[T.id].height * 0.55, life: 8, big: e.type !== "hit" || e.dmg >= 1.5 }); }
    }
  };
  V.draw = () => { frame(V, g); dither(V, g); out.imageSmoothingEnabled = false; out.drawImage(buf, 0, 0, canvas.width, canvas.height); drawHud(out, V, canvas.width, canvas.height); };
  return V;
}

function frame(V, g) {
  const W = V.W, L = W.lamb();
  V.t++; V.cam.x += (L.x - V.cam.x) * 0.12; V.cam.z += (L.z - V.cam.z) * 0.12;
  // keep the arena on screen: centre it on an axis where it fits, else clamp to its edges
  const b = W.field.bounds, hw = IW / 2 / S, hd = IH / 2 / (S * TILT);
  V.cam.x = b.x1 - b.x0 <= 2 * hw ? (b.x0 + b.x1) / 2 : Math.max(b.x0 + hw, Math.min(b.x1 - hw, V.cam.x));
  V.cam.z = b.z1 - b.z0 <= 2 * hd ? (b.z0 + b.z1) / 2 : Math.max(b.z0 + hd, Math.min(b.z1 - hd, V.cam.z));
  const k = V.shakeT > 0 ? V.shake * 6 : 0; V.shakeT = Math.max(0, V.shakeT - 2); if (!V.shakeT) V.shake = 0;
  V.sx = Math.sin(V.t * 1.9) * k; V.sy = Math.cos(V.t * 2.7) * k * 0.7;
  const lit = lamps(W);
  ground(V, g, lit);
  for (const L2 of W.groundLights) glow(V, g, L2.x, L2.z, L2.r);
  const bodies = W.fighters.filter((F) => !F.out || F.team === "lamb").filter((F) => F.team === "lamb" || W.visible(L, F) || F.flash > 0);
  bodies.sort((a, b) => a.z - b.z);
  for (const F of bodies) drawFigure(g, V, F, poseOf(W, F), W.field.lightAt(F.x, F.z, lit));
  for (const P of W.projectiles) drawProjectile(g, V, P);
  sparks(V, g);
  weather(V, g);
}

// Tiles by surface, lit by the light the sight rule reads, the sea over them where it stands,
// and fog that closes in with distance from Lamb. Values go into a one-pixel-per-tile map that is
// scaled up smoothly (soft ground); the water's edge and its glints are drawn sharp over it.
function ground(V, g, lit) {
  const W = V.W, f = W.field, A = f.arena, L = W.lamb(), fog = f.terms.fog, R = A.rows.length, C = A.rows[0].length;
  const map = (V.map ||= new OffscreenCanvas(C, R)), mg = map.getContext("2d"), img = mg.createImageData(C, R), wet = [];
  g.fillStyle = gray(0.04); g.fillRect(0, 0, IW, IH);
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const x = A.origin[0] + c + 0.5, z = A.origin[1] + r + 0.5, cell = f.cellAt(x, z), d = f.depthAt(x, z), light = f.lightAt(x, z, lit), foot = f.footing(x, z);
    let v = (SURF[cell.surface] ?? 0.5) * (0.12 + 1.1 * light);
    if (foot.frost) v = 0.35 + 0.9 * light;
    if (foot.wet && d < 0) v += 0.08 * light;
    if (d > 0) { v = 0.03 + 0.12 * light; wet.push([x, z, d, light]); }
    const fm = 1 - Math.exp(-fog * 9 * Math.hypot(x - L.x, z - L.z));
    v = v * (1 - fm) + (light > 0.25 ? 0.55 : 0.32) * fm;
    const i = (r * C + c) * 4, b = Math.round(clamp(v) * 255); img.data[i] = img.data[i + 1] = img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  mg.putImageData(img, 0, 0);
  const [x0, y0] = V.proj(A.origin[0], A.origin[1]);
  g.imageSmoothingEnabled = true; g.drawImage(map, x0, y0, C * S, R * S * TILT); g.imageSmoothingEnabled = false;
  for (const [x, z, d, light] of wet) {
    const [px, py] = V.proj(x - 0.5, z - 0.5), ph = V.t * 0.06 + x * 1.7 + z * 0.9;
    g.fillStyle = gray(0.18 + 0.5 * light, 0.9);
    for (let k = 0; k < 3; k++) { const yy = py + ((k * 7 + (V.t >> 2)) % Math.ceil(S * TILT)), w = 4 + 6 * Math.abs(Math.sin(ph + k)); g.fillRect(px + ((k * 11) % (S - 8)), yy, w, 1); }
    if (d < 0.15) { g.fillStyle = gray(0.6 * light + 0.2, 0.6); g.fillRect(px, py, S, 1); }
  }
  for (const s of A.lights || []) post(V, g, s);
  for (const p of W.props || []) prop(V, g, p);
}

// A sluice lever (up when shut, down when open) and a rigged rope's loop on the ground.
function prop(V, g, p) {
  if (p.kind === "sluice" && p.x != null) {
    const [x, y] = V.proj(p.x, p.z), a = p.open ? 0.9 : -0.9;
    g.fillStyle = gray(0.08); g.fillRect(x - 3, y - 16, 6, 16);
    g.strokeStyle = gray(0.85); g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x + Math.sin(a) * 12, y - 14 - Math.cos(a) * 12); g.stroke();
  }
  if (p.kind === "snare" && p.armed) {
    const [x, y] = V.proj(p.x, p.z);
    g.strokeStyle = gray(0.7, 0.8); g.lineWidth = 1; g.setLineDash([3, 3]); g.beginPath(); g.ellipse(x, y, 14, 9, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  }
}

function post(V, g, s) {
  const [x, y] = V.proj(s.x, s.z), [, top] = V.proj(s.x, s.z, 4.2);
  g.fillStyle = gray(0.06); g.fillRect(x - 1, top, 3, y - top);
  g.fillStyle = gray(s.off ? 0.15 : 1); g.beginPath(); g.arc(x, top, 3, 0, Math.PI * 2); g.fill();
}

function glow(V, g, x, z, r) {
  const [px, py] = V.proj(x, z), R = r * S * 0.6, grd = g.createRadialGradient(px, py, 0, px, py, R);
  grd.addColorStop(0, "rgba(255,255,255,0.55)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(px - R, py - R, 2 * R, 2 * R);
  g.fillStyle = gray(1); g.fillRect(px - 1, py - 3, 3, 4);
}

// A contact mark on the frame of the hit: a pale star that shrinks over 8 frames.
function sparks(V, g) {
  V.sparks = V.sparks.filter((s) => s.life-- > 0);
  g.strokeStyle = gray(1); g.lineWidth = 2;
  for (const s of V.sparks) {
    const [x, y] = V.proj(s.x, s.z, s.y), r = (s.big ? 16 : 10) * (s.life / 8) + 2;
    g.beginPath(); for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 4 + 0.4; g.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.stroke();
  }
}

function weather(V, g) {
  const t = V.W.field.terms, n = t.outdoors ? Math.round(clamp(t.rain / 6) * 220) : 0;
  g.strokeStyle = gray(0.85, 0.5); g.lineWidth = 1; g.beginPath();
  const wx = clamp(t.windX / 10, -1, 1) * 6;
  for (let i = 0; i < n; i++) { const x = (i * 97 + V.t * 13) % IW, y = (i * 53 + V.t * 23) % IH; g.moveTo(x, y); g.lineTo(x + wx, y + 8); }
  g.stroke();
}

// Five tones by an ordered dither; warm when Lamb stands in sodium.
function dither(V, g) {
  const L = V.W.lamb(), pal = V.W.field.sodiumAt(L.x, L.z) ? WARM : COLD;
  const img = g.getImageData(0, 0, IW, IH), d = img.data;
  for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) {
    const i = (y * IW + x) * 4, v = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
    const s = clamp(v) * 4, lo = Math.floor(s), c = pal[Math.min(4, lo + (s - lo > BAYER[(y & 3) * 4 + (x & 3)] ? 1 : 0))];
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
  }
  g.putImageData(img, 0, 0);
}
