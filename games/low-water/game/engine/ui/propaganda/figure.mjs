// The propaganda's figure (the UI art lead's, 2026-10-22): a placeholder drawing in ink on white, built from
// checked parameters (propaganda/guard.mjs), for the print processes (propaganda/print.mjs) to turn into a
// woodcut, an engraving, a lithograph, a collage or a meme. The painted lead owns the finished drawing; this
// sets the vocabulary they draw to. Every people gets the same cartoon body and the same leer: the cruelty is
// in the myth drawn as fact (props) and in the dress turned into a costume, never in a changed face or body.
//   drawFigure(g, { people, myth, w, h, seed, crowd }) -> throws on parameters the guard refuses
import { checkCaricature } from "./guard.mjs";

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
// a line as a hand cuts it: a little off true at each step
function inkLine(g, pts, r, w = 3) {
  g.lineWidth = w; g.beginPath();
  pts.forEach(([x, y], i) => { const jx = (r() - 0.5) * w * 0.6, jy = (r() - 0.5) * w * 0.6; i ? g.lineTo(x + jx, y + jy) : g.moveTo(x + jx, y + jy); });
  g.stroke();
}
const ell = (g, x, y, rx, ry, fill) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); fill ? g.fill() : g.stroke(); };

// the body every caricature shares: a big head, a narrow coat, the leer
function body(g, cx, base, s, r) {
  const head = base - s * 2.2;
  g.fillStyle = "#e4e4e4"; ell(g, cx, head, s * 0.55, s * 0.6, true); g.lineWidth = s * 0.05; ell(g, cx, head, s * 0.55, s * 0.6);
  inkLine(g, [[cx - s * 0.3, head - s * 0.18], [cx - s * 0.1, head - s * 0.1]], r, s * 0.07); inkLine(g, [[cx + s * 0.3, head - s * 0.18], [cx + s * 0.1, head - s * 0.1]], r, s * 0.07);   // brows down to the middle
  g.fillStyle = "#000"; ell(g, cx - s * 0.18, head, s * 0.05, s * 0.05, true); ell(g, cx + s * 0.18, head, s * 0.05, s * 0.05, true);
  g.lineWidth = s * 0.05; g.beginPath(); g.arc(cx, head + s * 0.05, s * 0.32, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();   // the leer
  for (let i = -3; i <= 3; i++) inkLine(g, [[cx + i * s * 0.07, head + s * 0.25], [cx + i * s * 0.07, head + s * 0.33]], r, s * 0.025);
  g.beginPath(); g.moveTo(cx - s * 0.45, head + s * 0.6); g.lineTo(cx - s * 0.55, base - s * 0.9); g.lineTo(cx + s * 0.55, base - s * 0.9); g.lineTo(cx + s * 0.45, head + s * 0.6); g.closePath();
  g.fillStyle = "#6a6a6a"; g.fill(); g.lineWidth = s * 0.05; g.stroke();
  inkLine(g, [[cx - s * 0.25, base - s * 0.9], [cx - s * 0.3, base]], r, s * 0.09); inkLine(g, [[cx + s * 0.25, base - s * 0.9], [cx + s * 0.3, base]], r, s * 0.09);
  return head;
}

// dress turned to costume, per people (from the world bible's dress, never from the body)
const DRESS = {
  hesh(g, cx, base, s, head, r) {   // braids as ropes to the ground, the felt coat hatched, the blue thread a cord
    for (const sx of [-1, 1]) inkLine(g, Array.from({ length: 12 }, (_, i) => [cx + sx * (s * 0.5 + Math.sin(i) * s * 0.12), head + i * s * 0.22]), r, s * 0.12);
    for (let i = 0; i < 9; i++) inkLine(g, [[cx - s * 0.45 + i * s * 0.11, head + s * 0.7], [cx - s * 0.5 + i * s * 0.11, base - s]], r, s * 0.02);
    inkLine(g, [[cx + s * 0.5, base - s * 1.3], [cx + s * 0.75, base - s * 1.2]], r, s * 0.1);
  },
  vell(g, cx, base, s, head, r) {   // scarves wound round and round until the figure is mostly scarf
    for (let i = 0; i < 6; i++) { g.lineWidth = s * 0.08; g.beginPath(); g.ellipse(cx, head + s * (0.5 + i * 0.25), s * (0.6 + i * 0.03), s * 0.12, (r() - 0.5) * 0.4, 0, Math.PI * 2); g.stroke(); }
    for (let i = 0; i < 8; i++) inkLine(g, [[cx - s * 0.4 + i * s * 0.1, head + s * 0.65], [cx - s * 0.35 + i * s * 0.1, head + s * 0.75], [cx - s * 0.3 + i * s * 0.1, head + s * 0.65]], r, s * 0.03);
  },
  tarn(g, cx, base, s, head, r) {   // the cottar: a flat cap pulled down, an apron, mud to the knee
    g.fillStyle = "#000"; g.beginPath(); g.ellipse(cx, head - s * 0.45, s * 0.65, s * 0.18, -0.1, 0, Math.PI * 2); g.fill();
    inkLine(g, [[cx - s * 0.35, head + s * 0.9], [cx - s * 0.4, base - s * 0.9], [cx + s * 0.4, base - s * 0.9], [cx + s * 0.35, head + s * 0.9]], r, s * 0.04);
    for (let i = 0; i < 14; i++) { g.fillStyle = "#000"; ell(g, cx + (r() - 0.5) * s * 0.9, base - r() * s * 0.6, s * (0.04 + r() * 0.07), s * (0.03 + r() * 0.05), true); }
  },
};
// the myths drawn as fact
const MYTH = {
  hoard(g, cx, base, s, r, W) {   // grain in a hole under the goat
    const gx = cx + s * 1.9, gy = base - s * 0.6;
    g.fillStyle = "#000"; ell(g, gx, gy, s * 0.5, s * 0.22, true); for (const dx of [-0.35, -0.15, 0.15, 0.35]) inkLine(g, [[gx + dx * s, gy], [gx + dx * s, base]], r, s * 0.06);
    inkLine(g, [[gx + s * 0.45, gy - s * 0.1], [gx + s * 0.65, gy - s * 0.4], [gx + s * 0.75, gy - s * 0.3]], r, s * 0.06);
    g.lineWidth = s * 0.04; g.beginPath(); g.moveTo(gx - s, base + s * 0.05); g.lineTo(gx - s * 0.7, base + s * 0.8); g.lineTo(gx + s * 0.7, base + s * 0.8); g.lineTo(gx + s, base + s * 0.05); g.stroke();
    for (let i = 0; i < 5; i++) { const sx = gx - s * 0.5 + i * s * 0.25; g.fillStyle = "#fff"; g.beginPath(); g.ellipse(sx, base + s * 0.5, s * 0.14, s * 0.22, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.fillStyle = "#000"; g.font = `bold ${s * 0.16}px Georgia, serif`; g.fillText("GRAIN", gx - s * 0.3, base + s * 0.95);
  },
  tallow(g, cx, base, s, r) {   // the tallow: drips down the coat and fumes over the head
    for (let i = 0; i < 7; i++) { const x = cx - s * 0.5 + i * s * 0.16; inkLine(g, [[x, base - s * 1.6], [x, base - s * (1.2 - r() * 0.4)]], r, s * 0.06); ell(g, x, base - s * (1.15 - r() * 0.4), s * 0.05, s * 0.07, true); }
    for (let k = 0; k < 4; k++) inkLine(g, Array.from({ length: 8 }, (_, i) => [cx - s * 0.6 + k * s * 0.4 + Math.sin(i * 1.4 + k) * s * 0.08, base - s * 3 - i * s * 0.12]), r, s * 0.03);
  },
  tide(g, cx, base, s, r, W, draw) {   // the same figure again and again behind, a tide
    for (let row = 0; row < 3; row++) for (let i = 0; i < 7; i++) draw(cx - s * 3 + i * s * 1.0 + row * s * 0.4, base - s * (1.4 + row * 0.5), s * (0.35 - row * 0.05));
  },
  money(g, cx, base, s, r, W) {   // the bag of money, an arrow off the edge of the page
    g.fillStyle = "#fff"; ell(g, cx + s * 1.3, base - s * 0.5, s * 0.4, s * 0.45, true); ell(g, cx + s * 1.3, base - s * 0.5, s * 0.4, s * 0.45);
    inkLine(g, [[cx + s * 1.8, base - s * 0.6], [W - s * 0.3, base - s * 0.6]], r, s * 0.08); inkLine(g, [[W - s * 0.6, base - s * 0.85], [W - s * 0.3, base - s * 0.6], [W - s * 0.6, base - s * 0.35]], r, s * 0.08);
  },
  dole(g, cx, base, s, r) {   // a bottle in each hand
    for (const sx of [-1, 1]) { g.fillStyle = "#000"; g.fillRect(cx + sx * s * 0.7 - s * 0.08, base - s * 1.5, s * 0.16, s * 0.4); g.fillRect(cx + sx * s * 0.7 - s * 0.03, base - s * 1.7, s * 0.06, s * 0.2); }
  },
};

export function drawFigure(g, params) {
  const why = checkCaricature(params); if (why.length) throw new Error(`propaganda: refused (${why.join("; ")})`);
  const { people = "hesh", myth = "hoard", w = 400, h = 500, seed = 1 } = params, r = rng(seed);
  g.save(); g.strokeStyle = "#000"; g.lineCap = "round"; g.lineJoin = "round";
  const s = Math.min(w, h) * 0.24, cx = w * 0.38, base = h * 0.86;
  // tone for the processes to work on: a pale sky darkening to the ground, the ground itself dark
  const sky = g.createLinearGradient(0, 0, 0, base); sky.addColorStop(0, "#f2f2f2"); sky.addColorStop(1, "#a8a8a8"); g.fillStyle = sky; g.fillRect(0, 0, w, base);
  g.fillStyle = "#555"; g.fillRect(0, base, w, h - base);
  const draw = (x, b, sz) => { const hd = body(g, x, b, sz, r); (DRESS[people] || DRESS.hesh)(g, x, b, sz, hd, r); };
  if (myth === "tide") MYTH.tide(g, cx, base, s, r, w, draw);
  inkLine(g, [[0, base + s * 0.05], [w, base + s * 0.05]], r, s * 0.05);   // the ground
  draw(cx, base, s);
  if (myth !== "tide" && MYTH[myth]) MYTH[myth](g, cx, base, s, r, w);
  g.restore();
}
