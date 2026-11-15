// Placeholder figures for the arena: ink silhouettes posed from the combat pose (anim/drive.mjs).
// The character lead's production figures replace these and read the same pose. Each kind has
// one thing that reads at distance: Lamb's pale collar and hat brim, the holder's height and pale
// hat band, the skirmisher's low stoop and light coat. Telegraphs read as a pale glint on the
// tool (a swing or throw) or a pale ring under the target (a grab: no catch, no block).
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const gray = (v, a = 1) => { const c = Math.round(clamp(v) * 255); return `rgba(${c},${c},${c},${a})`; };
import { ARENA_ARCHETYPES } from "../data/archetypes.mjs";
// the arena archetypes' looks (combat/data/archetypes.mjs): breadth (wide), hat shape, a shield, a beast's
// level body, a grappler's arms, a long coat; an elite wears a pale sash
const LOOK = {
  lamb: { coat: 0.13, trim: 0.95, hat: "brim", stoop: 0.05 },
  holder: { coat: 0.08, trim: 0.85, hat: "band", stoop: 0.12 },
  skirmisher: { coat: 0.42, trim: 0.12, hat: "cap", stoop: 0.3 },
  ...Object.fromEntries(Object.entries(ARENA_ARCHETYPES).map(([k, A]) => [k, A.look])),
};

// The tool's angle from facing (radians) and its lift, by phase.
export function toolPose(W, F, pose) {
  if (!F.act) return { a: F.guardT > 0 ? 0 : 0.9, lift: F.guardT > 0 ? 0.25 : -0.2, smear: null };
  const m = W.moves[F.act.id], h = m.hits[0], arc = h ? h.arc.map((d) => (d * Math.PI) / 180) : [0, 0];
  const thrust = h && h.arc[1] - h.arc[0] < 60;
  if (pose.kind === "parry") return { a: 0, lift: 0.5, smear: null };
  if (pose.phase === "startup") { const u = F.act.f / Math.max(1, m.startup); return { a: thrust ? Math.PI * 0.9 : arc[0] - 1.6 * u, lift: 0.1 + 0.5 * u, smear: null, pull: thrust ? u : 0 }; }
  if (pose.phase === "active" && h) { const u = (F.act.f - m.startup) / Math.max(1, m.active); return { a: thrust ? 0 : arc[0] + (arc[1] - arc[0]) * u, lift: 0.1, smear: thrust ? null : [arc[0], arc[0] + (arc[1] - arc[0]) * u], reach: h ? h.r[1] : 0, lunge: thrust ? 0.4 : 0 }; }
  return { a: thrust ? 0.2 : arc[1] + 0.3, lift: -0.3, smear: null };
}

// The player's own body is always drawn as if in a little light (0.35), so Lamb can be seen
// creeping in the dark even when no one in the fight can see Lamb.
export function drawFigure(g, V, F, pose, light) {
  if (F.team === "lamb") light = Math.max(light, 0.35);
  const W = V.W, def = W.defs[F.id], look = LOOK[def.kind] || LOOK[def.style] || def.look || LOOK.lamb, S = 30, TILT = 0.62;
  const kind = pose.kind || "free", fx = Math.cos(F.face), fz = Math.sin(F.face);
  let [bx, by] = V.proj(F.x, F.z), H = def.height * S * 0.9, lean = look.stoop, wide = def.radius * S * 1.2 * (look.wide || 1);
  if (kind === "dodge") { H *= pose.anim.startsWith("roll") && pose.f < 14 ? 0.45 : 0.75; lean += 0.3; }
  if (kind === "stagger") lean -= 0.35;
  if (kind === "down" || kind === "fall" || F.fallen || (F.out && !F.yielded)) return lying(g, V, F, def, look, light);
  if (look.beast) return beast(g, V, F, def, look, light, pose);
  const tp = toolPose(W, F, pose), bob = !F.act && Math.hypot(F.vx, F.vz) > 0.3 ? Math.abs(Math.sin(V.t * 0.45)) * 2 : 0;
  const ink = F.flash > 0 ? 0.98 : look.coat * (0.6 + 0.8 * light), top = [bx + fx * lean * S * 0.5, by - H - bob + fz * lean * S * 0.3];
  // shadow, coat, head, hat, trim
  g.fillStyle = gray(0.02, 0.55); g.beginPath(); g.ellipse(bx, by, wide * 1.3, wide * 0.45, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = gray(ink); g.beginPath(); g.moveTo(bx - wide, by); g.lineTo(bx + wide, by); g.lineTo(top[0] + wide * 0.45, top[1] + H * 0.22); g.lineTo(top[0] - wide * 0.45, top[1] + H * 0.22); g.closePath(); g.fill();
  g.beginPath(); g.arc(top[0], top[1] + H * 0.11, wide * 0.42, 0, Math.PI * 2); g.fill();
  g.fillStyle = gray(F.flash > 0 ? 1 : look.trim * (0.5 + 0.6 * light));
  if (look.hat === "brim") g.fillRect(top[0] - wide * 0.8, top[1] + 1, wide * 1.6, 2);
  if (look.hat === "band") g.fillRect(top[0] - wide * 0.45, top[1] + H * 0.04, wide * 0.9, 3);
  g.fillRect(top[0] - wide * 0.4, top[1] + H * 0.22, wide * 0.8, 2);
  hat(g, look, top, wide, H);
  if (look.longcoat) { g.fillStyle = gray(ink); g.beginPath(); g.moveTo(bx - wide * 1.25, by + 2); g.lineTo(bx + wide * 1.25, by + 2); g.lineTo(bx + wide * 0.6, by - H * 0.4); g.lineTo(bx - wide * 0.6, by - H * 0.4); g.closePath(); g.fill(); }
  if (look.arms) { g.strokeStyle = gray(ink); g.lineWidth = 5; const sy = top[1] + H * 0.3; g.beginPath(); g.moveTo(top[0] - wide * 0.5, sy); g.lineTo(top[0] - wide * 1.4 + fx * 8, sy + H * 0.3); g.moveTo(top[0] + wide * 0.5, sy); g.lineTo(top[0] + wide * 1.4 + fx * 8, sy + H * 0.3); g.stroke(); }
  if (look.shield) { const sx = bx + fx * wide * 0.9, sy = by - H * 0.45 + fz * 4; g.fillStyle = gray(0.5 * (0.5 + light)); g.beginPath(); g.ellipse(sx, sy, wide * 0.7, wide * 0.8, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = gray(look.trim * (0.5 + 0.6 * light)); g.lineWidth = 2; g.stroke(); }
  if (def.sash) { g.strokeStyle = gray(def.sash * (0.6 + 0.4 * light)); g.lineWidth = 3; g.beginPath(); g.moveTo(top[0] - wide * 0.7, top[1] + H * 0.28); g.lineTo(bx + wide * 0.7, by - H * 0.35); g.stroke(); }
  if (F.lantern > 0) { const lx = bx - fz * wide * 0.9, ly = by - H * 0.38; g.fillStyle = gray(1); g.fillRect(lx - 2, ly - 3, 4, 6); g.fillStyle = gray(1, 0.25); g.beginPath(); g.arc(lx, ly, 7, 0, Math.PI * 2); g.fill(); }
  if (F.tool) tool(g, V, F, def, tp, top, H, fx, fz, light);
  tells(g, V, F, pose);
  if (F.yielded) { g.fillStyle = gray(0.95); g.fillRect(top[0] - 6, top[1] - 8, 12, 2); }
}

export function tool(g, V, F, def, tp, top, H, fx, fz, light) {
  const len = (def.tool.reach || 1) * 30 * 0.85, a = F.face + tp.a, hand = [top[0] + fx * 6, top[1] + H * 0.45];
  const end = [hand[0] + Math.cos(a) * len, hand[1] + Math.sin(a) * len * 0.62 - tp.lift * 30];
  if (def.tool.cls === "shield") {
    g.fillStyle = gray(0.55 * (0.5 + light)); g.save(); g.translate(hand[0] + Math.cos(a) * 8, hand[1] + Math.sin(a) * 5 - tp.lift * 20); g.rotate(a); g.fillRect(-3, -9, 7, 18); g.restore();
  } else {
    g.strokeStyle = gray(0.02); g.lineWidth = def.tool.cls === "heavy" ? 5 : 4;
    g.beginPath(); g.moveTo(hand[0], hand[1]); g.lineTo(end[0], end[1]); g.stroke();
    g.strokeStyle = gray(0.55 + 0.4 * light); g.lineWidth = def.tool.cls === "heavy" ? 2 : 1.5; g.stroke();
  }
  if (tp.smear && !(V.off && V.off.has("smear"))) {
    const [bx, by] = V.proj(F.x, F.z), r = tp.reach * 30;
    g.strokeStyle = gray(0.95, V.W.inner ? 0.4 : 0.75); g.lineWidth = 3; g.beginPath();
    for (let s = 0; s <= 8; s++) { const t = F.face + tp.smear[0] + ((tp.smear[1] - tp.smear[0]) * s) / 8, x = bx + Math.cos(t) * r, y = by - H * 0.45 + Math.sin(t) * r * 0.62; s ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  (V.tips ||= {})[F.id] = end;
}

// Hats: a hat reads at distance before a face does.
function hat(g, look, top, wide, H) {
  const h = look.hat;
  if (h === "wide") g.fillRect(top[0] - wide * 1.1, top[1] + 1, wide * 2.2, 3);
  else if (h === "cap") g.fillRect(top[0] - wide * 0.45, top[1] - 1, wide * 0.9, 4);
  else if (h === "tall") g.fillRect(top[0] - wide * 0.35, top[1] - H * 0.14, wide * 0.7, H * 0.15);
  else if (h === "hood") { g.beginPath(); g.moveTo(top[0] - wide * 0.55, top[1] + H * 0.2); g.lineTo(top[0], top[1] - H * 0.1); g.lineTo(top[0] + wide * 0.55, top[1] + H * 0.2); g.closePath(); g.fill(); }
}

// A beast: a level body and a head forward (the hound low and long; the swarm a flutter of wings).
function beast(g, V, F, def, look, light, pose) {
  const [bx, by] = V.proj(F.x, F.z), L = def.height * 30 * 0.9 * (look.wide || 1), fx = Math.cos(F.face), fz = Math.sin(F.face);
  const ink = F.flash > 0 ? 0.98 : look.coat * (0.6 + 0.8 * light), h = def.height * 30 * 0.5, low = pose.kind === "dodge" ? 0.6 : 1;
  g.fillStyle = gray(0.02, 0.55); g.beginPath(); g.ellipse(bx, by, L * 0.7, L * 0.25, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = gray(ink);
  if (look.flutter) {
    const w = Math.sin(V.t * 0.9 + F.x) * 0.5 + 0.5, y = by - h * 2.2;
    g.beginPath(); g.ellipse(bx, y, L * 0.25, L * 0.18, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(bx, y); g.lineTo(bx - L * 0.8, y - L * 0.5 * w); g.lineTo(bx - L * 0.2, y + 2); g.moveTo(bx, y); g.lineTo(bx + L * 0.8, y - L * 0.5 * w); g.lineTo(bx + L * 0.2, y + 2); g.fill();
  } else {
    g.beginPath(); g.ellipse(bx, by - h * low, L * 0.55, h * 0.55, Math.atan2(fz * 0.62, fx) * 0.2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(bx + fx * L * 0.55, by - h * 1.25 * low + fz * 4, h * 0.45, 0, Math.PI * 2); g.fill();
    g.fillStyle = gray(look.trim * (0.5 + 0.6 * light)); g.fillRect(bx + fx * L * 0.55 - 3, by - h * 1.7 * low, 2, 4); g.fillRect(bx + fx * L * 0.55 + 1, by - h * 1.7 * low, 2, 4);
  }
  if (def.sash) { g.fillStyle = gray(def.sash); g.fillRect(bx - 4, by - h * 1.1, 8, 2); }
  tells(g, V, F, pose);
}

// A swing or throw telegraph: a pale glint at the tool tip. A grab: a ring under the target. The arena's
// own: sweep, a low arc on the ground at the move's reach; pounce, a line on the ground ahead; shout, rings
// going out from the caller.
export function tells(g, V, F, pose) {
  if (!F.act) return;
  const m = V.W.moves[F.act.id];
  if (!m.tell || F.act.f < m.tell.at[0] || F.act.f > m.tell.at[1]) return;
  const blink = (F.act.f >> 2) % 2 === 0, u = F.act.f / Math.max(1, m.startup), [fx0, fy0] = V.proj(F.x, F.z);
  if (m.tell.kind === "sweep") {
    const r = Math.max(...m.hits.map((h) => h.r[1])) * 30, a0 = F.face + (m.hits[0].arc[0] * Math.PI) / 180, a1 = F.face + (m.hits[0].arc[1] * Math.PI) / 180;
    g.strokeStyle = gray(0.95, 0.3 + 0.6 * u); g.lineWidth = 2 + 2 * u; g.beginPath();
    for (let s = 0; s <= 16; s++) { const t = a0 + ((a1 - a0) * s) / 16, x = fx0 + Math.cos(t) * r, y = fy0 + Math.sin(t) * r * 0.62; s ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  if (m.tell.kind === "slam") { // a boss's slam: the ring it will strike inside, closing in as the wind-up runs out
    const r = Math.max(...m.hits.map((h) => h.r[1])) * 30; g.strokeStyle = gray(0.95, 0.3 + 0.6 * u); g.lineWidth = 2 + 3 * u;
    g.beginPath(); g.ellipse(fx0, fy0, r, r * 0.62, 0, 0, Math.PI * 2); g.stroke();
  }
  if (m.tell.kind === "pounce") {
    const len = 4.5 * 30 * u; g.strokeStyle = gray(0.95, 0.35 + 0.5 * u); g.lineWidth = 3; g.setLineDash([6, 5]);
    g.beginPath(); g.moveTo(fx0, fy0); g.lineTo(fx0 + Math.cos(F.face) * len, fy0 + Math.sin(F.face) * len * 0.62); g.stroke(); g.setLineDash([]);
  }
  if (m.tell.kind === "shout") {
    for (let k = 0; k < 3; k++) { const r = ((u * 3 + k) % 3) * 22 + 10; g.strokeStyle = gray(0.95, 0.5 * (1 - r / 80)); g.lineWidth = 2; g.beginPath(); g.ellipse(fx0, fy0, r, r * 0.62, 0, 0, Math.PI * 2); g.stroke(); }
  }
  if (m.tell.kind === "grab") {
    const T = V.W.lamb(), [tx, ty] = V.proj(T.x, T.z);
    g.strokeStyle = gray(0.95, 0.4 + 0.5 * u); g.lineWidth = 2; g.beginPath(); g.ellipse(tx, ty, 26 - 12 * u, (26 - 12 * u) * 0.62, 0, 0, Math.PI * 2); g.stroke();
  }
  const tip = (V.tips || {})[F.id];
  if (blink && tip) { g.fillStyle = gray(1); g.fillRect(tip[0] - 2, tip[1] - 2, 4, 4); }
}

function lying(g, V, F, def, look, light) {
  const [bx, by] = V.proj(F.x, F.z), L = def.height * 30 * 0.5;
  g.fillStyle = gray(F.flash > 0 ? 0.98 : look.coat * (0.6 + 0.8 * light));
  // a body on the ground, foreshortened by the camera's tilt along its length
  const dx = Math.cos(F.face) * L * 0.6, dy = Math.sin(F.face) * L * 0.6 * 0.62, len = Math.max(10, Math.hypot(dx, dy));
  g.beginPath(); g.ellipse(bx + dx * 0.4, by - 4 + dy * 0.4, len, 7, Math.atan2(dy, dx), 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(bx + dx * 1.2, by - 5 + dy * 1.2, 6, 0, Math.PI * 2); g.fill();
}

export function drawProjectile(g, V, P) {
  const [x, y] = V.proj(P.x, P.z), [, yy] = V.proj(P.x, P.z, P.y);
  g.fillStyle = gray(0.02, 0.5); g.fillRect(x - 2, y - 1, 4, 2);
  g.fillStyle = gray(P.use === "lantern" ? 1 : P.use === "mud" ? 0.2 : 0.8);
  const r = P.use === "rope" ? 5 : 2; g.fillRect(x - r, yy - 2, r * 2, P.use === "rope" ? 2 : 4);
}
