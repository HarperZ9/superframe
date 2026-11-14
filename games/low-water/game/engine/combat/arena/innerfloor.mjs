// The inner rooms' floors on the arena page: black velvet where no light falls, the lamps' pools from the same
// light the simulation reads (so what is lit is what is lit), the floor's own grain (boards, flags, cobbles, snow,
// ice), the furniture as volumes with an ink edge, and the bodies' shadows. Values into the 640 x 360 buffer.
//   stageFloor(V, g, lit)    bodyShadows(V, g, bodies)
// The Host's freeze (combat/arena/hostworld.mjs) turns floor cells to `frost`: drawn as rime with cracks over the
// black river ice, so the spreading ice reads as a different thing from the floor it spreads over.
import { gray, hash } from "./innerstage.mjs";

const S = 30, TILT = 0.62;
const BASE = { boards: 0.5, flags: 0.52, cobbles: 0.46, snow: 0.8, ice: 0.2 };
const HEIGHT = { maze: 1.9, yard: 2.2, road: 1.8 };
const AMB = 0.24; // the floor's own light where no lamp reaches: black velvet, not black

export function stageFloor(V, g, lit) {
  const W = V.W, f = W.field, A = f.arena, st = V.stage.st, R = A.rows.length, C = A.rows[0].length, base = BASE[st.floor] ?? 0.5;
  const map = (V.map ||= new OffscreenCanvas(C, R)), mg = map.getContext("2d"), img = mg.createImageData(C, R), frost = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const x = A.origin[0] + c + 0.5, z = A.origin[1] + r + 0.5, light = f.lightAt(x, z, lit), foot = f.footing(x, z);
    let v = st.floor === "snow" ? 0.3 + 0.6 * light : base * (AMB + 0.95 * light);
    if (f.solid(x, z)) v = 0.025;
    else if (foot.surface === "mud") v = 0.09 + 0.16 * light; // a pit (combat/arena/innerhaz.mjs): dark, wet, read as ground to keep out of
    else if (foot.frost) { v = st.floor === "ice" ? 0.62 + 0.3 * light : Math.min(1, v + 0.1); if (st.floor === "ice") frost.push([x, z, light]); }
    const i = (r * C + c) * 4, b = Math.round(Math.min(1, v) * 255); img.data[i] = img.data[i + 1] = img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  mg.putImageData(img, 0, 0);
  const [x0, y0] = V.proj(A.origin[0], A.origin[1]);
  g.imageSmoothingEnabled = true; g.drawImage(map, x0, y0, C * S, R * S * TILT); g.imageSmoothingEnabled = false;
  grain(V, g, st.floor);
  if (st.floor === "ice") reflection(V, g);
  for (const [x, z, light] of frost) rime(V, g, x, z, light);
  if (frost.length) iceFeature(V, A, frost);
  furniture(V, g, A);
}

// the floor's own grain, world-anchored, faint: it says what the floor is without competing with the bodies
function grain(V, g, kind) {
  const W = V.W, b = W.field.bounds, P = (x, z) => V.proj(x, z);
  if (kind === "boards") for (let z = b.z0 + 1; z < b.z1 - 1; z += 0.5) { const [xa, y] = P(b.x0 + 1, z), [xb] = P(b.x1 - 1, z); g.fillStyle = gray(0.02, 0.32); g.fillRect(xa, y, xb - xa, 1); for (let x = b.x0 + 1 + hash(z * 2) * 3; x < b.x1 - 1; x += 3.2) { const [jx, jy] = P(x, z); g.fillRect(jx, jy, 1, 9); } }
  if (kind === "flags") for (let z = b.z0 + 1; z < b.z1 - 1; z += 1) for (let x = b.x0 + 1; x < b.x1 - 1; x += 1.2) { const [jx, jy] = P(x + (z % 2) * 0.6, z); g.fillStyle = gray(0.02, 0.35); g.fillRect(jx, jy, S * 1.2, 1); g.fillRect(jx, jy, 1, S * TILT); }
  if (kind === "cobbles") for (let k = 0; k < 520; k++) { const x = b.x0 + 1 + hash(k, 1) * (b.x1 - b.x0 - 2), z = b.z0 + 1 + hash(k, 2) * (b.z1 - b.z0 - 2), [cx, cy] = P(x, z); g.fillStyle = gray(0.02, 0.3); g.fillRect(cx, cy + 2, 5, 1); g.fillStyle = gray(0.9, 0.08); g.fillRect(cx + 1, cy, 3, 1); }
  if (kind === "snow") for (const zr of [5.2, 6.8]) { g.fillStyle = gray(0.05, 0.22); for (let x = b.x0 + 1; x < b.x1 - 1; x += 0.25) { const [rx, ry] = P(x, zr + Math.sin(x * 0.7) * 0.08); g.fillRect(rx, ry, 8, 2); } }
  if (kind === "ice") for (let z = b.z0 + 1.5; z < b.z1 - 1; z += 0.7) for (let x = b.x0 + 1.5; x < b.x1 - 2; x += 0.9) if (hash(x * 10, z * 10) > 0.45) { const [tx, ty] = P(x, z); g.fillStyle = gray(0.3, 0.12); g.fillRect(tx, ty, 3 + ((hash(x, z) * 9) | 0), 1); }
}

// black ice takes the shaft as a long reflection running toward the viewer (Martin's light on water)
function reflection(V, g) {
  const [px, py, rx] = V.stage.pool;
  for (let k = 0; k < 9; k++) { const y = py + k * 6, w = rx * (1.4 - k * 0.12); g.fillStyle = gray(0.85, 0.07 + 0.01 * (9 - k)); g.fillRect(px - w / 2 + Math.sin(k * 2.3) * 6, y, w, 2); }
}

// frozen cell on the black river: pale rime (in the map above) and one dark crack across it, joined cell to cell
// along a fixed direction, so the frozen ground reads as a sheet of white ice with cracks in it
function rime(V, g, x, z, light) {
  const a = (hash(Math.floor(x / 3), Math.floor(z / 3)) - 0.5) * 1.2, l = 0.62, [x0, y0] = V.proj(x - Math.cos(a) * l, z - Math.sin(a) * l), [x1, y1] = V.proj(x + Math.cos(a) * l, z + Math.sin(a) * l);
  g.strokeStyle = gray(0.08, 0.7); g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y0); g.lineTo((x0 + x1) / 2 + (hash(x, z) - 0.5) * 6, (y0 + y1) / 2 + (hash(z, x) - 0.5) * 3); g.lineTo(x1, y1); g.stroke();
  if (hash(x * 3, z * 3) > 0.7) { g.fillStyle = gray(0.98, 0.5); g.fillRect(x0 + 4, y0 - 2, 6, 1); }
  void light;
}

// what the ice measure compares: up to twelve frozen cells against up to twelve open cells of the same floor
function iceFeature(V, A, frost) {
  const box = (x, z) => { const [ax, ay] = V.proj(x - 0.4, z - 0.4), [bx, by] = V.proj(x + 0.4, z + 0.4); return [ax, ay, bx - ax, by - ay]; }, f = V.W.field, open = [];
  for (let r = 1; r < A.rows.length - 1 && open.length < 12; r += 2) for (let c = 1; c < A.rows[0].length - 1 && open.length < 12; c += 3) { const x = c + 0.5, z = r + 0.5; if (!f.solid(x, z) && !f.footing(x, z).frost && !V.W.fighters.some((F) => Math.hypot(F.x - x, F.z - z) < 1.5)) open.push(box(x, z)); }
  const ice = frost.filter(([x, z]) => !V.W.fighters.some((F) => Math.hypot(F.x - x, F.z - z) < 1.5)).slice(0, 12).map(([x, z]) => box(x, z));
  if (ice.length && open.length) (V.features ||= []).push({ name: "ice", boxes: ice, vs: open });
}

// solid cells that are not the room's walls (the desk, the table, the stacks, the hut) as volumes: a lit top, a dark
// front, an ink line round both, a contact shadow on the floor
function furniture(V, g, A) {
  const h = HEIGHT[A.name] || 0.9, solid = (c, r) => { const ch = (A.rows[r] || "")[c], cell = A.legend[ch]; return ch && ch !== "K" && cell && cell.solid; };
  for (let r = 0; r < A.rows.length; r++) for (let c = 0; c < A.rows[r].length; c++) {
    if (!solid(c, r)) continue;
    const x = A.origin[0] + c, z = A.origin[1] + r, light = V.W.field.lightAt(x + 0.5, z + 0.5, []);
    const [ax, ay] = V.proj(x, z, h), [bx, by] = V.proj(x + 1, z + 1, h), [, fy] = V.proj(x, z + 1, 0);
    if (!solid(c, r + 1)) { g.fillStyle = gray(0.02, 0.55); g.fillRect(ax - 2, fy, bx - ax + 4, 6); g.fillStyle = gray(0.05 + 0.18 * light); g.fillRect(ax, by, bx - ax + 0.5, fy - by); g.fillStyle = gray(0.01); g.fillRect(ax, fy - 1, bx - ax + 0.5, 1); }
    g.fillStyle = gray(0.18 + 0.6 * light); g.fillRect(ax, ay, bx - ax + 0.5, by - ay + 0.5);
    if (A.name === "maze") for (let k = 0; k < 2; k++) { g.fillStyle = gray(0.1 + 0.3 * light); g.beginPath(); g.ellipse(ax + 8 + k * 14, ay + (by - ay) / 2, 6, (by - ay) / 2 - 1, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = gray(0.01);
    if (!solid(c, r - 1)) g.fillRect(ax, ay, bx - ax + 0.5, 1);
    if (!solid(c - 1, r)) g.fillRect(ax, ay, 1, fy - ay);
    if (!solid(c + 1, r)) g.fillRect(bx, ay, 1, fy - ay);
  }
}

// each body's contact shadow, and a long cast shadow when it stands in the shaft's pool (away from the source)
export function bodyShadows(V, g, bodies) {
  const [px, py, rx, ry] = V.stage.pool, [sx] = V.stage.src;
  for (const F of bodies) {
    const d = V.W.defs[F.id], [x, y] = V.proj(F.x, F.z), w = d.radius * S * 1.3, H = d.height * S;
    g.fillStyle = gray(0.0, 0.6); g.beginPath(); g.ellipse(x, y, w * 1.25, w * 0.42, 0, 0, Math.PI * 2); g.fill();
    const inPool = ((x - px) / (rx * 1.2)) ** 2 + ((y - py) / (ry * 1.2)) ** 2 < 1;
    if (inPool) { const dir = x >= sx ? 1 : -1; g.fillStyle = gray(0.0, 0.4); g.beginPath(); g.moveTo(x - w * 0.6, y); g.lineTo(x + dir * H * 0.9 - w * 0.3, y + H * 0.25); g.lineTo(x + dir * H * 0.9 + w * 0.5, y + H * 0.22); g.lineTo(x + w * 0.6, y); g.closePath(); g.fill(); }
  }
}
