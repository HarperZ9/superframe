// Two things the glyph grid sets in the panels beyond their text (design/art/GLYPH-LANGUAGE.md sections 2, 6):
//   the dialogue portrait   the talk panel's portrait frame filled with the speaker's glyph portrait
//                           (glyph/portrait.mjs), at the frame's own cells, in the speaker's face and light
//   the read-back           when the talk panel speaks as READBACK, or the beat is a read-back node (ui.readback,
//                           set by paint/renderer.mjs), it is set as a typed document: paper ground,
//                           ribbon-black type, a ruled margin with line numbers, the page header in capitals
// Original code.   collectExtras(root, cw, ch, byEl) -> { portraits, typed }   drawExtras(ui, grid, out, atlas, look)
import { glyphPortrait, portraitCells } from "./portrait.mjs";

const ready = new Map();   // set/who -> the loaded portrait (null while loading or missing)
function portraitOf(set, who) {
  const k = `${set}/${who}`; if (ready.has(k)) return ready.get(k);
  ready.set(k, null); glyphPortrait(set, who).then((P) => ready.set(k, P)).catch((e) => console.warn(`glyph portrait ${k}: ${e.message}`)); return null;
}
const SRC = /\/characters\/([^/]+)\/([^/]+)\/([^/-]+)-([^/.]+)\.png/;
export function collectExtras(root, cw, ch, owner) {
  const portraits = [];
  for (const fr of root.querySelectorAll(".portrait:not([hidden]):not(.noface) .pframe")) {
    const img = fr.querySelector(".pimg.on"), m = img && SRC.exec(decodeURIComponent(img.src || "")); if (!m) continue;
    const r = fr.getBoundingClientRect(); if (r.width < cw * 4) continue;
    const row = fr.closest(".portrait").getBoundingClientRect(), nm = fr.closest(".portrait").querySelector(".pname"), nr = nm && nm.getBoundingClientRect();
    const cell = (q) => ({ x0: Math.round(q.left / cw), y0: Math.round(q.top / ch), x1: Math.round(q.right / cw) - 1, y1: Math.round(q.bottom / ch) - 1 });
    portraits.push({ set: m[1], who: m[2], face: m[3], light: m[4], P: owner(fr), box: cell(r), row: cell(row), name: nm && nr && nr.width ? { text: nm.textContent.trim().toUpperCase(), x: Math.floor(nr.left / cw), y: Math.floor((nr.top + nr.height / 2) / ch) } : null });
  }
  const name = root.querySelector(".talk .portrait .pname"), talk = root.querySelector("aside.talk");
  return { portraits, typed: name && /^\s*READBACK\s*$/i.test(name.textContent || "") ? owner(name) : null, talk: talk ? owner(talk) : null };
}
// a panel's movement by the grid's layout since it was collected (layoutPanels moves boxes in place)
const moved = (P) => (P && P.box0 ? [P.box.x0 - P.box0.x0, P.box.y0 - P.box0.y0] : [0, 0]);

function drawPortrait(f, put, atlas, look) {
  const P = portraitOf(f.set, f.who); if (!P) return false;
  const [dx, dy] = moved(f.P), cols = f.box.x1 - f.box.x0 + 1, rows = f.box.y1 - f.box.y0 + 1;
  // the portrait's row is opaque, as the painted panel's is: the log scrolled under it is cleared, the name set again
  const T = globalThis.__lwTyped ? globalThis.__lwTyped({}) : null, G0 = T ? T.ground : look.ground, ink = T ? T.ink : [233, 227, 212];   // the panel's own stock when the UI's typed matter sets it
  for (let Y = f.row.y0 + dy; Y <= f.row.y1 + dy; Y++) for (let X = f.row.x0 + dx; X <= f.row.x1 + dx; X++) put(X, Y, atlas.index(" "), G0, G0);
  if (f.name) [...f.name.text].forEach((c, k) => { if (c !== " ") put(f.name.x + dx + k, f.name.y + dy, atlas.index(c), ink, G0); });
  const cells = portraitCells(P, { mood: f.face, light: f.light, cols, rows }, atlas, look);
  cells.forEach((c, k) => put(f.box.x0 + dx + (k % cols), f.box.y0 + dy + Math.floor(k / cols), c.g, c.fg, c.bg));
  return true;
}
// the read-back as a typed sheet: every cell of the panel inverted to ink on paper, a ruled margin of line numbers
function drawTyped(P, grid, out, atlas, at) {
  const PAPER = [233, 227, 212], INKC = [29, 20, 24], RULE = [150, 140, 130], b = P.box;
  for (let Y = b.y0; Y <= b.y1; Y++) for (let X = b.x0; X <= b.x1; X++) {
    const i = at(X, Y); if (i < 0) continue; const blank = out.G[i] === atlas.index(" ");
    for (let c = 0; c < 3; c++) { out.BG[i * 3 + c] = PAPER[c]; out.FG[i * 3 + c] = INKC[c]; }
    if (!blank && (X === b.x0 || X === b.x1 || Y === b.y0 || Y === b.y1)) for (let c = 0; c < 3; c++) out.FG[i * 3 + c] = RULE[c];
  }
  let n = 0;
  for (let Y = b.y0 + 2; Y < b.y1; Y += 2) { const s = String(++n).padStart(3, " "); [...s].forEach((d, k) => { const i = at(b.x0 + 1 + k, Y); if (i >= 0 && d !== " " && out.G[i] === atlas.index(" ")) { out.G[i] = atlas.cut(atlas.index(d), "small"); for (let c = 0; c < 3; c++) out.FG[i * 3 + c] = RULE[c]; } }); }
  return n;
}
export function drawExtras(ui, grid, out, atlas, look, put, at) {
  const ex = ui.extras; if (!ex) return { portraits: 0, typed: 0 };
  let p = 0; for (const f of ex.portraits) if (drawPortrait(f, put, atlas, look)) p++;
  // the UI art lead's typed matter (ui/typed.mjs, globalThis.__lwTyped) sets the read-back as the era's record when a
  // story opts in; this plain typed sheet is the fallback for a story that does not
  const theirs = globalThis.__lwTyped && globalThis.__lwTyped({}), sheet = !theirs && (ex.typed || (ui.readback && ex.talk)), typed = sheet ? drawTyped(sheet, grid, out, atlas, at) : 0;   // the speaker READBACK, or a read-back node
  return { portraits: p, typed };
}
