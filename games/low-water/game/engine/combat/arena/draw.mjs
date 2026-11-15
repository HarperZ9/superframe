// The arena's look, on the CPU: a 640x360 canvas drawn in values (ink to paper), then an
// ordered dither into five tones, warm under sodium and cold away from it, scaled up 2x. The
// ground is lit by the same light the simulation's sight rule reads, so what the player can see
// is what Lamb can see. Opponents Lamb cannot see are not drawn.
import { drawFigure, drawProjectile, tells } from "./figure.mjs";
import { drawHud } from "./hud.mjs";
import { lamps } from "../sim/target.mjs";
import { poseOf } from "../anim/drive.mjs";
import { drawForm } from "./forms.mjs";
import { wallShadows, floorMarks, anchor, innerHud } from "./innerdraw.mjs";
import { stageGeom, stageBack, stageShaft, shaftDust, stageFront } from "./innerstage.mjs";
import { stageFloor, bodyShadows } from "./innerfloor.mjs";
import { smokeBank, puffs, debris, bursts, fxEvents } from "./innerfx.mjs";
import { figurePass, tone, lightMap } from "./innertone.mjs";
import { formGround } from "./forms.mjs";
import { drawLambInner } from "./innerfigure.mjs";
import { silhouettes } from "./innersil.mjs";

// The shake never hides a tell (design/CAMERA.md, the coordinator's ruling of 2026-10-17): while any opponent's
// tell shows, the view moves at most 1 buffer pixel (3 px at 1080p). ?shakeclamp=off turns it off (a control).
export const SHAKE = { tellCap: 1, clamp: typeof location === "undefined" || !/shakeclamp=off/.test(location.search) };

const IW = 640, IH = 360, S = 30, TILT = 0.62;
const SURF = { stone: 0.6, mud: 0.34, weed: 0.26, wood: 0.5, shingle: 0.46, frost: 0.82 };
const WARM = [[18, 8, 10], [72, 34, 22], [150, 86, 44], [222, 152, 86], [248, 220, 168]];
const COLD = [[16, 12, 18], [52, 46, 58], [112, 106, 112], [186, 180, 172], [238, 232, 220]];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const gray = (v, a = 1) => { const c = Math.round(clamp(v) * 255); return `rgba(${c},${c},${c},${a})`; };

export function createView(canvas, W) {
  const out = canvas.getContext("2d"), buf = new OffscreenCanvas(IW, IH), g = buf.getContext("2d", { willReadFrequently: true });
  const V = { W, cam: { x: W.lamb().x, z: W.lamb().z }, shake: 0, shakeT: 0, bark: null, barkT: 0, flashes: [], sparks: [], t: 0 };
  // ?innerfx=off,list: the inner arena's layers that can be left out, to find what a measure is reading (smoke,
  // debris, dust, sparks, bursts, smear, rim)
  V.off = new Set(typeof location === "undefined" ? [] : (new URLSearchParams(location.search).get("innerfx") || "").split(",").filter(Boolean));
  V.proj = (x, z, y = 0) => [IW / 2 + (x - V.cam.x) * S + V.sx, IH / 2 + (z - V.cam.z) * S * TILT - y * S + V.sy];
  V.silhouettes = () => silhouettes(V);
  V.events = (ev) => {
    if (W.inner) fxEvents(V, ev);
    for (const e of ev) {
      // a keyed shake along the blow (design/CAMERA.md "Combat impacts, 2026-10-21"): out to its peak by frame 3,
      // a 40% swing back at frame 7 to 8, still by frame 12 (15 for a heavier blow); a bigger blow replaces a smaller
      if (e.type === "shake" && (!V.kick || e.amp * 6 >= V.kick.amp * (1 - V.kick.f / V.kick.len))) V.kick = { amp: e.amp * 6, dir: e.dir || [1, 0], f: 0, len: e.frames > 14 ? 15 : 12 };
      if (e.type === "bark") { V.bark = e; V.barkT = 150; }
      if (["parry", "block", "guardbreak", "ducked", "lit", "doused", "gust", "disarm"].includes(e.type)) V.flashes.push({ ...e, life: 40 });
      // readable damage: each blow's harm rises off the body it landed on (Lamb's in warm, the others' pale)
      if (e.type === "hit" && e.dmg > 0 && !W.inner) { const T = W.byId(e.id); if (T) (V.numbers ||= []).push({ x: T.x, z: T.z, y: W.defs[T.id].height + 0.2, n: e.dmg, lamb: e.id === "lamb", life: 50 }); }
      if (e.type === "glance" && !W.inner) { const T = W.byId(e.id); if (T) (V.numbers ||= []).push({ x: T.x, z: T.z, y: W.defs[T.id].height + 0.2, text: "glance", life: 40 }); }
      if (["hit", "parry", "block"].includes(e.type)) { const T = W.byId(e.id); if (T) V.sparks.push({ x: T.x, z: T.z, y: W.defs[T.id].height * 0.55, life: 8, big: e.type !== "hit" || e.dmg >= 1.5 }); }
    }
  };
  V.draw = () => {
    frame(V, g); if (W.inner) tone(V, g); else dither(V, g); out.imageSmoothingEnabled = false; out.drawImage(buf, 0, 0, canvas.width, canvas.height);
    if (W.inner) anchor(V, out, canvas.width, canvas.height);
    drawHud(out, V, canvas.width, canvas.height);
    if (W.inner) innerHud(out, V, canvas.width, canvas.height);
  };
  return V;
}

const keyed = (f, len) => (f <= 3 ? f / 3 : f <= 7.5 ? 1 - (1.4 * (f - 3)) / 4.5 : f <= len ? -0.4 * (1 - (f - 7.5) / (len - 7.5)) : 0);

function frame(V, g) {
  const W = V.W, L = W.lamb();
  V.t++; V.cam.x += (L.x - V.cam.x) * 0.12; V.cam.z += (L.z - V.cam.z) * 0.12;
  // keep the arena on screen: centre it on an axis where it fits, else clamp to its edges
  const b = W.field.bounds, hw = IW / 2 / S, hd = IH / 2 / (S * TILT);
  V.cam.x = b.x1 - b.x0 <= 2 * hw ? (b.x0 + b.x1) / 2 : Math.max(b.x0 + hw, Math.min(b.x1 - hw, V.cam.x));
  V.cam.z = b.z1 - b.z0 <= 2 * hd ? (b.z0 + b.z1) / 2 : Math.max(b.z0 + hd, Math.min(b.z1 - hd, V.cam.z));
  const tell = W.fighters.some((F) => F.team !== "lamb" && F.act && W.moves[F.act.id].tell && F.act.f >= W.moves[F.act.id].tell.at[0] && F.act.f <= W.moves[F.act.id].tell.at[1]);
  const K = V.kick, o = K ? K.amp * keyed(++K.f, K.len) : 0; if (K && K.f >= K.len) V.kick = null;
  V.sx = K ? K.dir[0] * o : 0; V.sy = K ? K.dir[1] * o * TILT : 0;
  const len = Math.hypot(V.sx, V.sy); if (tell && SHAKE.clamp && len > SHAKE.tellCap) { V.sx *= SHAKE.tellCap / len; V.sy *= SHAKE.tellCap / len; } // the cap is on the offset, not each axis
  V.shakeNow = { px: +Math.hypot(V.sx, V.sy).toFixed(3), tell };
  const lit = lamps(W);
  if (W.inner) return innerFrame(V, g, lit);
  ground(V, g, lit);
  for (const L2 of W.groundLights) glow(V, g, L2.x, L2.z, L2.r);
  const bodies = W.fighters.filter((F) => !F.out || F.team === "lamb").filter((F) => F.team === "lamb" || W.visible(L, F) || F.flash > 0);
  bodies.sort((a, b) => a.z - b.z);
  for (const F of bodies) (W.defs[F.id].form ? drawForm : drawFigure)(g, V, F, poseOf(W, F), W.field.lightAt(F.x, F.z, lit));
  // Lamb's place, drawn over everyone: a boss in front must not hide where Lamb stands
  { const [lx, ly] = V.proj(L.x, L.z); g.strokeStyle = gray(0.95, 0.55); g.lineWidth = 1; g.beginPath(); g.ellipse(lx, ly, 12, 7, 0, 0, Math.PI * 2); g.stroke(); }
  for (const P of W.projectiles) drawProjectile(g, V, P);
  sparks(V, g);
  weather(V, g);
}

// The inner arena, staged (combat/data/stages-inner.mjs): the building and its haze, the bank of smoke, the floor, what
// the forms lay on it, the shaft, the bodies on their own layer with the found edge and the ink line, the tells over
// everything (a telegraph never breaks: 03-SURREAL.md rule 6), the dust and debris, the rock frame. Every form is
// drawn: a dream's monster is not hidden by the dark.
function innerFrame(V, g, lit) {
  const W = V.W, L = W.lamb(); V.features = [];
  const on = (k) => !V.off.has(k);
  stageGeom(V); stageBack(V, g); if (on("smoke")) smokeBank(V, g);
  stageFloor(V, g, lit); formGround(V, g); wallShadows(V, g); floorMarks(V, g);
  for (const s of W.field.arena.lights || []) pendant(V, g, s);
  stageShaft(V, g); if (on("smoke")) puffs(V, g);
  // a limb of the Host is drawn just after the Host's body, so its wings never hide a lie that has to be named
  const B = W.byId("boss"), zOf = (F) => (W.defs[F.id].limbOf && B ? B.z + 0.01 : F.z);
  const bodies = W.fighters.filter((F) => !F.out || F.team === "lamb" || W.defs[F.id].form).sort((a, b) => zOf(a) - zOf(b));
  bodyShadows(V, g, bodies.filter((F) => !F.out && !F.fallen));
  const poses = new Map(bodies.map((F) => [F, poseOf(W, F)])); V.lambPose = (poses.get(L) || {}).kind || "free";
  const li = bodies.indexOf(L), drawSome = (list) => (fg) => { for (const F of list) (F === L ? drawLambInner : drawForm)(fg, V, F, poses.get(F), W.field.lightAt(F.x, F.z, lit)); };
  // a form's part that lies over the character (Never Once's arm on his shoulders) goes in the front pass
  V.overlays = [];
  const behind = drawSome(bodies.slice(0, li)), front = drawSome(bodies.slice(li + 1));
  figurePass(V, g, { behind, lamb: drawSome([L]), front: (fg) => { front(fg); for (const o of V.overlays) o(fg); } });
  for (const F of bodies) tells(g, V, F, poses.get(F));
  { const [lx, ly] = V.proj(L.x, L.z); g.strokeStyle = gray(0.95, 0.55); g.lineWidth = 1; g.beginPath(); g.ellipse(lx, ly, 12, 7, 0, 0, Math.PI * 2); g.stroke(); }
  for (const P of W.projectiles) drawProjectile(g, V, P);
  if (on("sparks")) sparks(V, g); if (on("bursts")) bursts(V, g); if (on("debris")) debris(V, g); if (on("dust")) shaftDust(V, g); stageFront(V, g);
  lightMap(V, lit);
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

// an inner room's lamp hangs: a small lit shade, no post standing in the floor
function pendant(V, g, s) {
  const [x, y] = V.proj(s.x, s.z, 2.4); g.fillStyle = gray(s.off ? 0.15 : 0.95); g.fillRect(x - 3, y - 1, 6, 3); g.fillStyle = gray(0.06); g.fillRect(x, y - 10, 1, 9);
}

function glow(V, g, x, z, r) {
  const [px, py] = V.proj(x, z), R = r * S * 0.6, grd = g.createRadialGradient(px, py, 0, px, py, R);
  grd.addColorStop(0, "rgba(255,255,255,0.55)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(px - R, py - R, 2 * R, 2 * R);
  g.fillStyle = gray(1); g.fillRect(px - 1, py - 3, 3, 4);
}

// A contact mark on the frame of the hit: a pale star that shrinks over 8 frames.
// (`v` under 1 draws a smaller, dimmer star; the inner arena uses the full one since 05-CARE took WCAG's wording)
function sparks(V, g, v = 1) {
  V.sparks = V.sparks.filter((s) => s.life-- > 0);
  const small = v < 1; g.strokeStyle = gray(v); g.lineWidth = small ? 1 : 2;
  for (const s of V.sparks) {
    const [x, y] = V.proj(s.x, s.z, s.y), r = (small ? (s.big ? 7 : 5) : s.big ? 16 : 10) * (s.life / 8) + 2;
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
