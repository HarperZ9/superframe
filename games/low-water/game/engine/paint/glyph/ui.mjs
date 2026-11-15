// Panels in the grid: every open panel of the game (a sheet, the talk page, a leaf, a button, a key
// chip) drawn natively in the character grid: a box-drawing frame on its box, its ground filled, its
// text set in cells at each character's place. The DOM panels stay where they are for input, made
// invisible but laid out in a monospace whose advance is the cell's, so their text falls on the grid.
// The grid for panels is the screen's (panels do not move with the world).
//   collectUi(root, cw, ch) -> ui (panels back to front, each with its box and characters)   drawUi(ui, grid, out, atlas, o)
// Original code.
import { collectExtras, drawExtras } from "./uiextra.mjs";
import { eraLook } from "./eras.mjs";
export const PANELS = ".sheet, .talk, .leaf, .btn, .chip, .key, .placecard, .hud, .strip, .meter, .menu, .toast, .vl, .gearcard, .dbook, .hint, .mapspot, .edgemark, .talkoffer, .lietab";
const BOX = { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" };

// the highest z-index on the way up (a panel inside a raised dock is raised with it)
function zIndexOf(el) { let z = 0; for (let e = el; e && e !== document.body; e = e.parentElement) { const v = parseInt(getComputedStyle(e).zIndex, 10); if (Number.isFinite(v)) z = Math.max(z, v); } return z; }

export function collectUi(root, cw, ch) {
  // panels, outermost first; each panel's stacking from the browser's own hit order at its centre (drawn back to front)
  const panels = [], byEl = new Map();
  // shown on the page: laid out, not hidden, not made invisible (a panel slid away is visibility hidden, opacity 0)
  const shownEl = (el) => { if (el.closest("[hidden]") || (el.offsetParent === null && getComputedStyle(el).position !== "fixed")) return false; for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity < 0.05) return false; } return true; };
  for (const el of root.querySelectorAll(PANELS)) {
    if (!shownEl(el)) continue;
    const r = el.getBoundingClientRect(); if (r.width < cw || r.height < ch) continue;
    const hot = el.matches(":focus, .on, .focus, .sel, [aria-selected=\"true\"]") || el.classList.contains("hot");
    const stack = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2), z = stack.findIndex((e) => e === el || el.contains(e));
    const P = { box: { x0: Math.round(r.left / cw), y0: Math.round(r.top / ch), x1: Math.round(r.right / cw) - 1, y1: Math.round(r.bottom / ch) - 1, hot, solid: !el.matches(".btn, .key") }, z: z < 0 ? -1 : z, zi: zIndexOf(el), chars: [], el };   // not hit-testable (pointer-events: none): an overlay, drawn on top
    panels.push(P); byEl.set(el, P);
  }
  const owner = (node) => { for (let e = node; e; e = e.parentElement) { const P = byEl.get(e); if (P) return P; } return null; };
  // meters (notch rows: span.tick > i with --f the fill): the row as a bar of block glyphs across its cells,
  // full where filled, a light shade where empty, a notch's own mark every cell a notch starts in
  for (const row of root.querySelectorAll(".tick")) {
    const P = owner(row); if (!P || row.offsetParent === null) continue;
    const kids = [...row.children]; if (!kids.length) continue;
    const r = row.getBoundingClientRect(), x0 = Math.round(r.left / cw), x1 = Math.max(x0, Math.round(r.right / cw) - 1), y = Math.floor((r.top + r.height / 2) / ch);
    const fill = kids.reduce((a, k) => a + (parseFloat(getComputedStyle(k).getPropertyValue("--f")) || 0), 0) / kids.length, cells = x1 - x0 + 1, full = fill * cells;
    for (let x = x0; x <= x1; x++) { const f = Math.max(0, Math.min(1, full - (x - x0))); P.chars.push({ x, y, c: f > 0.75 ? "█" : f > 0.25 ? "▓" : "░", dim: f > 0.25 ? 1 : 0.6, strong: true }); }
  }
  // characters: each text node, character by character, at its laid-out place, with the panel that owns it
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), range = document.createRange();
  // the box a scrolled panel shows (a talk log scrolled up): characters outside it are not drawn (the UI art lead's, 2026-10-21)
  const clips = new Map(), clipOf = (el) => { if (clips.has(el)) return clips.get(el); let c = null; for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.overflowY !== "visible" || cs.overflowX !== "visible") { const r = e.getBoundingClientRect(); c = c ? { l: Math.max(c.l, r.left), t: Math.max(c.t, r.top), r: Math.min(c.r, r.right), b: Math.min(c.b, r.bottom) } : { l: r.left, t: r.top, r: r.right, b: r.bottom }; } } clips.set(el, c); return c; };
  for (let t = tw.nextNode(); t; t = tw.nextNode()) {
    const p = t.parentElement, P = p && owner(p); if (!P) continue;
    const s = t.textContent; if (!s.trim()) continue;
    const cs = getComputedStyle(p), dim = p.closest(".past, .nar") ? 0.65 : 1, strong = /^(6|7|8|9)00$/.test(cs.fontWeight) || !!p.closest("b, strong, .who, .ltitle");
    // one character a cell: where the page's type is narrower than a cell (a 4K grid's cells are twice as wide), a
    // line's run keeps its characters in order, each at least one cell past the last, a space keeping a cell
    let lx = P._lx ?? -1e9, ly = P._ly ?? -1e9;   // carried across the text nodes of one panel (a word in its own span)
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "\n") continue;
      range.setStart(t, i); range.setEnd(t, i + 1); const r = range.getBoundingClientRect(); if (!r.width) continue;
      const cl = clipOf(p), my = r.top + r.height / 2; if (cl && (my < cl.t || my > cl.b || r.left + r.width / 2 > cl.r || r.left + r.width / 2 < cl.l)) continue;
      let x = Math.floor((r.left + r.width / 2) / cw); const y = Math.floor((r.top + r.height / 2) / ch);
      if (y === ly && x <= lx) x = lx + 1; lx = x; ly = y;
      if (s[i] === " ") continue;
      P.chars.push({ x, y, c: s[i], dim, strong });
    }
    P._lx = lx; P._ly = ly;
  }
  for (const P of panels) { const up = P.el.parentElement && P.el.parentElement.closest(PANELS); P.parent = up ? byEl.get(up) || null : null; }
  panels.sort((a, b) => a.zi - b.zi || b.z - a.z);   // back to front: by the stacking the page sets, then by hit order
  for (const P of panels) P.box0 = { ...P.box };
  return { panels, extras: collectExtras(root, cw, ch, owner) };   // the portrait and the read-back (glyph/uiextra.mjs)
}

const INK = [233, 227, 212], GROUND = [16, 12, 16], HOT = [214, 120, 74];
export function drawUi(ui, grid, out, atlas, o, scene = null) {
  // the panels' grid is the screen's: cell (X, Y) covers screen [X cw, (X + 1) cw) x [Y ch, (Y + 1) ch);
  // the world grid's cell under it is used (its origin differs from the screen's by less than a cell)
  const { cols, rows, ox, oy, cw, ch } = grid, at = (X, Y) => { const x = Math.floor((X * cw - ox + cw / 2) / cw), y = Math.floor((Y * ch - oy + ch / 2) / ch); return x >= 0 && y >= 0 && x < cols && y < rows ? y * cols + x : -1; };
  // typed matter (the UI art lead's ui/typed.mjs, 2026-10-21): a story's era sets the panels as its own printed
  // matter, ink and stock, frame, and each character's strike; with none set the panels draw as before
  const T = globalThis.__lwTyped ? globalThis.__lwTyped(o) : null;
  const paper = o.palette === "paper", ink = T ? T.ink : paper ? [29, 20, 24] : INK, ground = T ? T.ground : paper ? [233, 227, 212] : GROUND, BX = (T && T.box) || BOX;
  const put = (X, Y, g, col, bg) => { const oi = at(X, Y); if (oi < 0) return; out.G[oi] = atlas.index(g); out.EM[oi] = 0; out.FG[oi * 3] = col[0]; out.FG[oi * 3 + 1] = col[1]; out.FG[oi * 3 + 2] = col[2]; if (bg) { out.BG[oi * 3] = bg[0]; out.BG[oi * 3 + 1] = bg[1]; out.BG[oi * 3 + 2] = bg[2]; } };
  const Wc = Math.floor((grid.W || cols * cw) / cw), Hc = Math.floor((grid.H || rows * ch) / ch);
  const left = layoutPanels(ui.panels, Wc, Hc);
  for (const P of ui.panels) {
    const b = P.box, line = b.hot ? HOT : ink.map((v, k) => Math.round(v * 0.55 + ground[k] * 0.45));
    if (b.solid) for (let Y = b.y0; Y <= b.y1; Y++) for (let X = b.x0; X <= b.x1; X++) { const f = T && T.fill ? T.fill(X, Y, b) : null; put(X, Y, f ? f.c : " ", f ? f.col : ink, ground); }
    for (let X = b.x0 + 1; X < b.x1; X++) { put(X, b.y0, BX.h, line); put(X, b.y1, BX.h, line); }
    for (let Y = b.y0 + 1; Y < b.y1; Y++) { put(b.x0, Y, (T && T.side && T.side(Y, b)) || BX.v, line); put(b.x1, Y, (T && T.side && T.side(Y, b)) || BX.v, line); }
    put(b.x0, b.y0, BX.tl, line); put(b.x1, b.y0, BX.tr, line); put(b.x0, b.y1, BX.bl, line); put(b.x1, b.y1, BX.br, line);
    // text inside the frame: a character past the right edge wraps to the row under its line (a DOM line is two cells tall)
    const ix0 = b.x0 + 1, ix1 = b.x1 - 1, iy1 = b.y1 - 1;
    for (const c of P.chars) {
      let X = c.x, Y = c.y; if (P.parent == null || P.chars === c) { /* placed */ }
      if (X > ix1 && b.solid) { const over = X - ix1 - 1, span = Math.max(1, ix1 - ix0 - 1); Y += 1 + Math.floor(over / span); X = ix0 + 1 + (over % span); }
      if (b.solid && (X < ix0 || X > ix1 || Y < b.y0 + 1 || Y > iy1)) continue;
      const k = T ? Math.max(T.minK || 0.72, c.dim * (c.strong ? 1 : 0.88) * T.strike(X, Y, c.c, b)) : c.dim * (c.strong ? 1 : 0.88);   // typed matter keeps AA contrast on its stock
      put(X, Y, c.c, ink.map((v, i) => Math.round(ground[i] + (v - ground[i]) * k)));
    }
  }
  const putG = (X, Y, g, col, bg) => { const oi = at(X, Y); if (oi < 0) return; out.G[oi] = g; out.EM[oi] = 0; for (let c = 0; c < 3; c++) { out.FG[oi * 3 + c] = col[c]; out.BG[oi * 3 + c] = bg[c]; } };
  ui.drawnExtras = drawExtras(ui, grid, out, atlas, eraLook(scene && scene.era), putG, at);
  // the hint, bottom right, set in the grid
  ui.placed = ui.panels.filter((P) => !P.parent && P.box.solid).map((P) => ({ cls: P.el.className, ...P.box })); ui.left = left.map((P) => P.el.className);
  if (ui.hint) { const X1 = Math.floor((grid.W || cols * cw) / cw) - 2, Y = Math.floor((grid.H || rows * ch) / ch) - 2; [...ui.hint].forEach((ch2, i) => put(X1 - ui.hint.length + i, Y, ch2, ink.map((v, k) => Math.round(ground[k] + (v - ground[k]) * 0.7)))); }
}

// Panel layout in the grid (the same rules the painted UI keeps: whole on screen, never covering an open
// panel). Top-level panels are moved, their child panels and characters with them:
//   - a panel past the screen's edge moves back inside it;
//   - a panel drawn over an earlier one moves the least distance (up, down, left or right) that clears
//     every earlier panel and stays on screen; if none does, it stays and the overlap is reported.
// Writes each panel's box and characters in place; returns the overlaps it could not clear.
export function layoutPanels(panels, Wc, Hc) {
  // larger panels are placed first and keep their places; small ones (a key chip, a note) move round them
  const area = (P) => (P.box.x1 - P.box.x0 + 1) * (P.box.y1 - P.box.y0 + 1);
  const top = panels.filter((P) => !P.parent && P.box.solid).sort((a, b) => area(b) - area(a)), placed = [], left = [];
  if (globalThis.__lwGlyphNoLayout) return left;   // the visual check's control
  const hit = (a, b) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
  const move = (P, dx, dy) => { for (const Q of panels) { let p = Q; while (p && p !== P) p = p.parent; if (p !== P) continue; Q.box = { ...Q.box, x0: Q.box.x0 + dx, x1: Q.box.x1 + dx, y0: Q.box.y0 + dy, y1: Q.box.y1 + dy }; for (const c of Q.chars) { c.x += dx; c.y += dy; } } };
  for (const P of top) {
    const b = P.box, w = b.x1 - b.x0, h = b.y1 - b.y0;
    // inside the screen
    let dx = 0, dy = 0; if (b.x1 > Wc - 1) dx = Wc - 1 - b.x1; if (b.x0 + dx < 0) dx = -b.x0; if (b.y1 > Hc - 1) dy = Hc - 1 - b.y1; if (b.y0 + dy < 0) dy = -b.y0;
    if (dx || dy) move(P, dx, dy);
    const clear = (bb) => bb.x0 >= 0 && bb.y0 >= 0 && bb.x1 < Wc && bb.y1 < Hc && !placed.some((q) => hit(bb, q));
    if (!clear(P.box)) {
      const B = P.box, cands = [];
      // beside any placed panel's edge, in x, in y, or both (a chip pushed off the talk page can sit beside its neighbour chip)
      const xs = [0, ...placed.flatMap((q) => [q.x0 - 1 - B.x1, q.x1 + 1 - B.x0])], ys = [0, ...placed.flatMap((q) => [q.y0 - 1 - B.y1, q.y1 + 1 - B.y0])];
      for (const ddx of xs) for (const ddy of ys) if (ddx || ddy) cands.push([ddx, ddy]);
      cands.sort((a, c) => Math.abs(a[0]) + Math.abs(a[1]) - Math.abs(c[0]) - Math.abs(c[1]));
      const ok = cands.find(([ddx, ddy]) => clear({ x0: B.x0 + ddx, x1: B.x1 + ddx, y0: B.y0 + ddy, y1: B.y1 + ddy }));
      if (ok) move(P, ok[0], ok[1]); else left.push(P);
    }
    placed.push(P.box); void w; void h;
  }
  return left;
}
