// The painted dialogue box (the author, 2026-10-21: "in dialogue they can be like painted dialogue boxes with
// painted avatars of the characters"), in both looks, drawn on a 2D canvas. Browser module.
//   painted: a dark board laid in broad oil strokes with a ragged painted edge, the speaker's painted portrait
//     in an arched window cut into the board's left end (its edge painted over, not ruled), the name in Conso
//     small capitals on a lighter stroke, the line in Hanken on the board.
//   glyph: the same layout in type: the board's edge in box drawing, the portrait set as glyphs (its tone map
//     through the measured ramp, colours from the portrait, edges shaped by slope marks), the text in Conso.
//   drawBox(ctx, { look, x, y, w, h, img, name, text, seed, atlas })   img: an <img> or canvas of the portrait
// Original code; deterministic by seed.
import { measuredRamp } from "../glyph/tonemap.mjs";

function rnd(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const rgb = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
// the part of a 640 x 800 portrait the box shows: head and collar (eyes at 40 percent of the portrait)
export const CROP = { x: 0.14, y: 0.12, w: 0.72, h: 0.66 };
const crop = (img) => [img.width * CROP.x, img.height * CROP.y, img.width * CROP.w, img.height * CROP.h];
const BOARD = [0.13, 0.105, 0.09], BOARD_LIGHT = [0.2, 0.16, 0.13], NAME = [0.55, 0.42, 0.28], INK = [0.93, 0.88, 0.78];

// a ragged painted rectangle: a path whose edge wanders a few pixels, filled, then strokes laid along it
function raggedPath(ctx, x, y, w, h, rand, j = 5) {
  const pts = [], step = 18;
  for (let t = 0; t <= w; t += step) pts.push([x + t, y + (rand() - 0.5) * j]);
  for (let t = 0; t <= h; t += step) pts.push([x + w + (rand() - 0.5) * j, y + t]);
  for (let t = w; t >= 0; t -= step) pts.push([x + t, y + h + (rand() - 0.5) * j]);
  for (let t = h; t >= 0; t -= step) pts.push([x + (rand() - 0.5) * j, y + t]);
  ctx.beginPath(); pts.forEach(([a, b], k) => (k ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath();
}
function brushStroke(ctx, x0, y0, x1, y1, wid, col, alpha, rand) {
  // a stroke as a few parallel bristle lines of slightly different value, tapering at both ends
  const n = Math.max(3, Math.round(wid / 2.2)), dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  for (let k = 0; k < n; k++) {
    const o = (k / (n - 1) - 0.5) * wid, v = 1 + (rand() - 0.5) * 0.18, a = alpha * (0.55 + 0.45 * rand());
    ctx.strokeStyle = rgb(col.map((c) => Math.min(1, c * v)), a); ctx.lineWidth = wid / n * 1.6; ctx.lineCap = "round";
    const s0 = rand() * 0.12, s1 = 1 - rand() * 0.2;
    ctx.beginPath(); ctx.moveTo(x0 + dx * s0 + nx * o, y0 + dy * s0 + ny * o); ctx.quadraticCurveTo(x0 + dx * 0.5 + nx * (o + (rand() - 0.5) * 3), y0 + dy * 0.5 + ny * (o + (rand() - 0.5) * 3), x0 + dx * s1 + nx * o, y0 + dy * s1 + ny * o); ctx.stroke();
  }
}
function paintBoard(ctx, x, y, w, h, rand) {
  ctx.save(); raggedPath(ctx, x, y, w, h, rand, 6); ctx.fillStyle = rgb(BOARD, 0.96); ctx.fill(); ctx.clip();
  for (let k = 0; k < Math.round((w * h) / 900); k++) {
    const cx = x + rand() * w, cy = y + rand() * h, len = 40 + rand() * 90, a = -0.25 + (rand() - 0.5) * 0.25, col = rand() < 0.5 ? BOARD_LIGHT : BOARD.map((c) => c * 0.8);
    brushStroke(ctx, cx - Math.cos(a) * len / 2, cy - Math.sin(a) * len / 2, cx + Math.cos(a) * len / 2, cy + Math.sin(a) * len / 2, 10 + rand() * 14, col, 0.35, rand);
  }
  ctx.restore();
  // the painted edge: a lighter stroke dragged along the top, a darker one along the bottom
  for (let t = x; t < x + w; t += 70) brushStroke(ctx, t, y + 2 + (rand() - 0.5) * 3, Math.min(x + w, t + 80), y + 2 + (rand() - 0.5) * 3, 5, [0.36, 0.28, 0.2], 0.55, rand);
}
function paintWindow(ctx, img, x, y, w, h, rand) {
  // an arch: the portrait clipped to it, its edge painted over with the board's colour in short strokes
  ctx.save(); ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2); ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.clip();
  ctx.drawImage(img, ...crop(img), x, y, w, h);
  ctx.restore();
  for (let k = 0; k < 60; k++) {
    const t = k / 60, along = t * (Math.PI + 2 * (h - w / 2) / (w / 2)), px = t < 0.3 ? x : t > 0.7 ? x + w : x + w / 2 - Math.cos((t - 0.3) / 0.4 * Math.PI) * w / 2, py = t < 0.3 ? y + h - (t / 0.3) * (h - w / 2) : t > 0.7 ? y + w / 2 + ((t - 0.7) / 0.3) * (h - w / 2) : y + w / 2 - Math.sin((t - 0.3) / 0.4 * Math.PI) * w / 2;
    void along; brushStroke(ctx, px - 6, py - 3 + rand() * 6, px + 6, py - 3 + rand() * 6, 6, BOARD, 0.8, rand);
  }
}
function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/), lines = []; let cur = "";
  for (const w of words) { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}

export function drawBox(ctx, { look = "painted", x, y, w, h, img, name = "", text = "", seed = 11, atlas = null, font = { name: "LW Conso", text: "LW Hanken" } }) {
  const rand = rnd(seed), pw = Math.round(h * 1.0), ph = Math.round(h * 1.3), px = x + Math.round(h * 0.12), py = y + h - ph - Math.round(h * 0.08);
  if (look === "glyph") return glyphBox(ctx, { x, y, w, h, img, name, text, atlas, px, py, pw, ph });
  paintBoard(ctx, x, y, w, h, rand);
  if (img) paintWindow(ctx, img, px, py, pw, ph, rand);
  const tx = px + pw + Math.round(h * 0.14), tw = x + w - tx - Math.round(h * 0.12);
  // the name on a stroke of ochre, the line below it
  ctx.font = `600 ${Math.round(h * 0.11)}px "${font.name}"`; const nw = ctx.measureText(name.toUpperCase()).width;
  brushStroke(ctx, tx - 14, y + h * 0.17, tx + nw + 16, y + h * 0.17, h * 0.15, NAME, 0.8, rand);
  ctx.fillStyle = rgb([0.1, 0.07, 0.06]); ctx.textBaseline = "middle"; ctx.fillText(name.toUpperCase(), tx, y + h * 0.17);
  ctx.font = `400 ${Math.round(h * 0.12)}px "${font.text}"`; ctx.fillStyle = rgb(INK); ctx.textBaseline = "top";
  wrap(ctx, text, tw).slice(0, 4).forEach((l, k) => ctx.fillText(l, tx, y + h * 0.32 + k * h * 0.165));
}

// glyph look: cells of cw x ch; the portrait's luminance per cell through the measured ramp, its colour kept
function glyphBox(ctx, { x, y, w, h, img, name, text, atlas, px, py, pw, ph }) {
  const cw = atlas ? atlas.cw : 8, ch = atlas ? atlas.ch : 12, cols = Math.floor(w / cw), rows = Math.floor(h / ch);
  ctx.fillStyle = "rgb(8,8,10)"; ctx.fillRect(x, y, cols * cw, rows * ch);
  ctx.font = `${ch - 1}px "LW Conso", Consolas, monospace`; ctx.textBaseline = "top"; ctx.fillStyle = "rgb(190,170,130)";
  const put = (c, r, s, col) => { ctx.fillStyle = col; ctx.fillText(s, x + c * cw, y + r * ch); };
  for (let c = 1; c < cols - 1; c++) { put(c, 0, "─", "rgb(150,120,80)"); put(c, rows - 1, "─", "rgb(150,120,80)"); }
  for (let r = 1; r < rows - 1; r++) { put(0, r, "│", "rgb(150,120,80)"); put(cols - 1, r, "│", "rgb(150,120,80)"); }
  put(0, 0, "┌", "rgb(150,120,80)"); put(cols - 1, 0, "┐", "rgb(150,120,80)"); put(0, rows - 1, "└", "rgb(150,120,80)"); put(cols - 1, rows - 1, "┘", "rgb(150,120,80)");
  // the portrait in type: tones from luminance, edges from the luminance slope
  // the portrait in half-size cells (a face needs more cells than a line of text), on its own sub-grid
  const pcw = cw * 0.625, pch = ch * 0.625, pc = Math.floor(pw / pcw), pr = Math.floor(ph / pch), oc = Math.floor((px - x) / cw), orow = Math.floor((py - y) / ch);
  if (img) {
    const t = document.createElement("canvas"); t.width = pc * 4; t.height = pr * 4; const g = t.getContext("2d"); g.drawImage(img, ...crop(img), 0, 0, t.width, t.height);
    const d = g.getImageData(0, 0, t.width, t.height).data, ramp = " .:-=+*#%@", L0 = (X, Y) => { const i = (Y * t.width + X) * 4; return (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255; };
    // the value range stretched (p5 to p95 of the portrait), so a dark painting still spans the ramp
    const all = []; for (let Y = 0; Y < t.height; Y += 2) for (let X = 0; X < t.width; X += 2) all.push(L0(X, Y)); all.sort((a, b) => a - b);
    const lo = all[Math.floor(all.length * 0.05)], hi = all[Math.floor(all.length * 0.95)], L = (X, Y) => Math.max(0, Math.min(1, (L0(X, Y) - lo) / Math.max(0.05, hi - lo)));
    ctx.font = `${Math.round(pch)}px "LW Conso", Consolas, monospace`;
    const putP = (c, r, s2, col) => { ctx.fillStyle = col; ctx.fillText(s2, px + c * pcw, py + r * pch); };
    const glyphs = atlas ? measuredRamp(atlas.cov, atlas.rampChars, 12).map((k) => atlas.chars[k]) : ramp.split("");
    for (let r = 0; r < pr; r++) for (let c = 0; c < pc; c++) {
      let s = 0, R = 0, G = 0, B = 0; for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) { const X = c * 4 + xx, Y = r * 4 + yy, i = (Y * t.width + X) * 4; s += L(X, Y); R += d[i]; G += d[i + 1]; B += d[i + 2]; }
      const v = s / 16, gx = L(c * 4 + 3, r * 4 + 2) - L(c * 4, r * 4 + 2), gy = L(c * 4 + 2, r * 4 + 3) - L(c * 4 + 2, r * 4);
      let ch2 = glyphs[Math.min(glyphs.length - 1, Math.floor(Math.pow(v, 0.9) * glyphs.length))];
      if (v > 0.15 && Math.hypot(gx, gy) > 0.3) { const a = Math.atan2(gy, gx) * 180 / Math.PI, q = ((a % 180) + 180) % 180; ch2 = q < 22 || q > 158 ? "|" : q < 68 ? "\\" : q < 112 ? "-" : "/"; }
      const k = Math.min(3, (0.45 + 0.6 * v) / Math.max(0.08, Math.max(R, G, B) / 16 / 255)); putP(c, r, ch2, `rgb(${Math.min(255, R / 16 * k) | 0},${Math.min(255, G / 16 * k) | 0},${Math.min(255, B / 16 * k) | 0})`);
    }
  }
  ctx.font = `${ch - 1}px "LW Conso", Consolas, monospace`;
  const tc = oc + Math.ceil(pw / cw) + 2; put(tc, 1, String(name).toUpperCase(), "rgb(214,170,96)");
  ctx.font = `${ch - 1}px "LW Conso", Consolas, monospace`; ctx.fillStyle = "rgb(225,215,195)";
  const maxW = (cols - tc - 2) * cw; wrap(ctx, text, maxW).slice(0, rows - 4).forEach((l, k) => ctx.fillText(l, x + tc * cw, y + (3 + k) * ch));
}
