// Drawing a Tide Run's view (world/runs.mjs view()) as a paper chart. x runs right, z runs down.
// Every mark has a word or a shape as well as a tone, so nothing depends on colour alone.
export const C = { night: "#120d10", paper: "#e9e3d4", paper2: "#d9d0bb", ink: "#1d1418", ink2: "#5a4c4a", hot: "#9a3b1f", warm: "rgba(255,196,110,0.32)" };
const FONT = (px, mono = true) => `${px}px ${mono ? "'LW Conso', Consolas, monospace" : "'LW Hanken', sans-serif"}`;

// The box that holds everything, padded by a metre.
function bounds(v) {
  const xs = [v.x, v.goal.x], zs = [v.z, v.goal.z];
  for (const r of v.rects) { xs.push(r[0], r[2]); zs.push(r[1], r[3]); }
  for (const c of [...v.frost, ...v.lights, ...v.climb]) { xs.push(c[0] - c[2], c[0] + c[2]); zs.push(c[1] - c[2], c[1] + c[2]); }
  if (v.pursuer) { xs.push(v.pursuer.x); zs.push(v.pursuer.z); }
  return { x0: Math.min(...xs) - 1, x1: Math.max(...xs) + 1, z0: Math.min(...zs) - 1, z1: Math.max(...zs) + 1 };
}

export function fit(canvas) {
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
  const g = canvas.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, W, H };
}

export function drawChart(canvas, v) {
  const { g, W, H } = fit(canvas);
  if (!W || !H) return;
  const b = bounds(v), top = 54, pad = 28;
  const s = Math.min((W - pad * 2) / (b.x1 - b.x0), (H - top - pad) / (b.z1 - b.z0));
  const ox = (W - (b.x1 - b.x0) * s) / 2, oz = top + (H - top - pad - (b.z1 - b.z0) * s) / 2;
  const P = (x, z) => [ox + (x - b.x0) * s, oz + (z - b.z0) * s];
  g.fillStyle = C.night; g.fillRect(0, 0, W, H);
  ground(g, v, P, s);
  for (const l of v.lights) light(g, P, s, l);
  for (const f of v.frost) ring(g, P, s, f, "frost", [2, 4]);
  for (const c of v.climb) ring(g, P, s, c, "stairs", [6, 3]);
  if (v.pursuer) pursuer(g, P, s, v.pursuer);
  goal(g, P, s, v.goal);
  you(g, P, s, v);
  timeMark(g, W, v);
}

function ground(g, v, P, s) {
  for (const r of v.rects) {
    const [ax, az] = P(Math.min(r[0], r[2]), Math.min(r[1], r[3])), w = Math.abs(r[2] - r[0]) * s, d = Math.abs(r[3] - r[1]) * s;
    g.fillStyle = C.paper; g.fillRect(ax, az, w, d);
    const depth = v.waterY - (r[4] ?? 0);
    if (depth > 0) hatch(g, ax, az, w, d, depth, v);
    g.strokeStyle = C.ink; g.lineWidth = 1.5; g.strokeRect(ax + 0.5, az + 0.5, w - 1, d - 1);
  }
}

// Water over the ground: diagonal lines, closer for deeper, and the depth in words at the corner.
function hatch(g, x, z, w, d, depth, v) {
  const gap = depth >= v.waist ? 5 : depth >= v.knee ? 9 : 15;
  g.save(); g.beginPath(); g.rect(x, z, w, d); g.clip();
  g.strokeStyle = "rgba(40,60,80,0.55)"; g.lineWidth = 1;
  for (let k = -d; k < w; k += gap) { g.beginPath(); g.moveTo(x + k, z + d); g.lineTo(x + k + d, z); g.stroke(); }
  g.restore();
  const word = depth >= v.waist ? "water: waist" : depth >= v.knee ? "water: knee" : "water: ankle";
  label(g, x + 6, z + 14, word, C.ink2);
}

export function light(g, P, s, l) {
  const [x, z] = P(l[0], l[1]), r = l[2] * s;
  const grd = g.createRadialGradient(x, z, 0, x, z, r);
  grd.addColorStop(0, C.warm); grd.addColorStop(1, "rgba(255,196,110,0)");
  g.fillStyle = grd; g.beginPath(); g.arc(x, z, r, 0, Math.PI * 2); g.fill();
  g.setLineDash([1, 5]); g.strokeStyle = C.ink2; g.lineWidth = 1; g.beginPath(); g.arc(x, z, r, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  g.beginPath(); g.arc(x, z, 3, 0, Math.PI * 2); g.fillStyle = C.ink2; g.fill();
  label(g, x + 6, z - r + 14, "light", C.ink2);
}

function ring(g, P, s, c, word, dash) {
  const [x, z] = P(c[0], c[1]), r = c[2] * s;
  g.setLineDash(dash); g.strokeStyle = C.ink; g.lineWidth = 1.5; g.beginPath(); g.arc(x, z, r, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  if (word === "frost") for (let k = 0; k < 5; k++) { const a = k * 1.256, rr = r * 0.5; star(g, x + Math.cos(a) * rr, z + Math.sin(a) * rr); }
  label(g, x - r, z + r + 14, word, C.ink);
}
function star(g, x, z) { g.strokeStyle = C.ink2; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 3, z); g.lineTo(x + 3, z); g.moveTo(x, z - 3); g.lineTo(x, z + 3); g.stroke(); }

function pursuer(g, P, s, p) {
  const [x, z] = P(p.x, p.z), R = p.cone[0] * s, half = (p.cone[1] * Math.PI) / 180, a = Math.atan2(p.fz, p.fx);
  g.beginPath(); g.moveTo(x, z); g.arc(x, z, R, a - half, a + half); g.closePath();
  g.fillStyle = "rgba(29,20,24,0.12)"; g.fill(); g.setLineDash([5, 3]); g.strokeStyle = C.ink; g.lineWidth = 1.5; g.stroke(); g.setLineDash([]);
  g.fillStyle = C.ink; g.fillRect(x - 5, z - 5, 10, 10);
  label(g, x + 8, z - 8, "watcher", C.ink);
}

export function goal(g, P, s, q) {
  const [x, z] = P(q.x, q.z), r = Math.max(6, q.r * s);
  g.strokeStyle = C.ink; g.lineWidth = 2;
  for (const rr of [r, r * 0.6]) { g.beginPath(); g.arc(x, z, rr, 0, Math.PI * 2); g.stroke(); }
  label(g, x - r, z - r - 6, q.name ? `goal: ${q.name}` : "goal", C.ink);
}

export function you(g, P, s, v) {
  const [x, z] = P(v.x, v.z);
  g.beginPath(); g.arc(x, z, 7, 0, Math.PI * 2); g.fillStyle = C.ink; g.fill();
  g.beginPath(); g.arc(x, z, 11, 0, Math.PI * 2); g.strokeStyle = C.hot; g.lineWidth = 2; g.stroke();
  label(g, x + 14, z + 4, "you", C.ink);
}

// The time left: a ruled line across the top, a notch per game minute, a mark where it stands.
export function timeMark(g, W, v) {
  const x0 = 28, x1 = W - 28, y = 30;
  g.fillStyle = C.paper; g.fillRect(0, 0, W, 46);
  g.strokeStyle = C.ink; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
  if (!Number.isFinite(v.limit)) { label(g, x0, 18, `${v.minutes} min, no limit`, C.ink); return; }
  for (let m = 0; m <= v.limit; m++) { const x = x0 + ((x1 - x0) * m) / v.limit; g.beginPath(); g.moveTo(x, y - (m % 5 ? 3 : 6)); g.lineTo(x, y + (m % 5 ? 3 : 6)); g.stroke(); }
  const x = x0 + ((x1 - x0) * Math.min(v.minutes, v.limit)) / v.limit;
  g.fillStyle = C.ink; g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x - 6, y + 12); g.lineTo(x + 6, y + 12); g.closePath(); g.fill();
  label(g, x0, 18, `time left ${Math.max(0, v.limit - v.minutes)} of ${v.limit} min`, C.ink);
}

export function label(g, x, y, text, color) { g.font = FONT(12); g.fillStyle = color; g.fillText(text, x, y); }
