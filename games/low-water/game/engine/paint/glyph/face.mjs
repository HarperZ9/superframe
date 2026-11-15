// A face in type at play size (design/art/GLYPH-LANGUAGE.md section 2). Where a head covers three cells
// across and two down or more, it is set as a face instead of one letter: the head a block of lit skin
// (its ground), the features struck in dark ink over it at their places on the head, each from the mood:
//   eyes    a mark per lid (o open, O wide, - lidded, _ shut), moved toward the gaze
//   brows   the cell over each eye: \ / angry, / \ worried, ^ raised, - level
//   mouth   - set, = held, ~ uneasy, o startled, u warm, ^ grieving; to one side for contempt
//   side    one eye on the near side, the nose (> or <) on the leading edge, the back of the head hair
// A smaller head keeps one face letter by facing (figures.mjs headLetter). Original code.
//   faceCells(head, look, grid, atlas) -> Map(cellIndex -> { g: glyph index, role: "skin" | "edge" | "feature" | "hair" | "hat" })
//   head: { cx, cy, r } in screen px; look: { facing: "front" | "back" | "left" | "right", mood, gaze (-1..1), hat }
export const MOODS = {
  neutral: { brow: "-", eye: "o", mouth: "-" }, wary: { brow: "-", eye: "-", mouth: "~" }, startled: { brow: "^", eye: "O", mouth: "o" },
  set: { brow: "=", eye: "-", mouth: "=" }, warm: { brow: "-", eye: "o", mouth: "u" }, anxious: { brow: "worry", eye: "o", mouth: "~" },
  angry: { brow: "anger", eye: "-", mouth: "=" }, grieving: { brow: "worry", eye: "_", mouth: "^" }, afraid: { brow: "worry", eye: "O", mouth: "o" },
  contempt: { brow: "-", eye: "-", mouth: "side" }, lying: { brow: "-", eye: "o", mouth: "~", away: true },
};
const browOf = (m, side) => (m.brow === "anger" ? (side < 0 ? "\\" : "/") : m.brow === "worry" ? (side < 0 ? "/" : "\\") : m.brow);

// the features as points on the head (u right, v down, -1..1 across the head) with their glyphs
function features(look, m) {
  const gz = Math.max(-1, Math.min(1, (look.gaze || 0) + (m.away ? 0.9 : 0))) * 0.16, F = [];
  if (look.facing === "front") {
    for (const s of [-1, 1]) { F.push([s * 0.4 + gz, -0.05, m.eye]); F.push([s * 0.42 + gz * 0.5, -0.4, browOf(m, s)]); }
    F.push(m.mouth === "side" ? [0.25, 0.48, "/"] : [0, 0.48, m.mouth]);
  } else if (look.facing !== "back") {
    const d = look.facing === "right" ? 1 : -1;
    F.push([d * 0.38 + d * Math.abs(gz), -0.05, m.eye], [d * 0.38, -0.4, browOf(m, -d)], [d * 0.92, 0.15, d > 0 ? ">" : "<"], [d * 0.45, 0.5, m.mouth === "side" ? "/" : m.mouth]);
  }
  return F;
}
// what the rest of a head cell is: hat or hair on top, hair at the back of a side view, skin elsewhere
function baseRole(u, v, look) {
  if (look.facing === "back") return v < -0.45 && look.hat ? ["=", "hat"] : ["%", "hair"];
  if (v < -0.55) return look.hat ? [look.hat === "brim" ? "=" : "_", "hat"] : ["~", "hair"];
  const back = look.facing === "right" ? -u : look.facing === "left" ? u : -2;
  return back > 0.45 ? ["%", "hair"] : [" ", "skin"];
}
export function faceCells(head, look, grid, atlas) {
  const { ox, oy, cw, ch, cols, rows } = grid, m = MOODS[look.mood] || MOODS.neutral, out = new Map();
  const at = (u, v) => { const x = Math.floor((head.cx + u * head.r - ox) / cw), y = Math.floor((head.cy + v * head.r - oy) / ch); return x >= 0 && y >= 0 && x < cols && y < rows ? y * cols + x : -1; };
  const x0 = Math.max(0, Math.floor((head.cx - head.r - ox) / cw)), x1 = Math.min(cols - 1, Math.floor((head.cx + head.r - ox) / cw));
  const y0 = Math.max(0, Math.floor((head.cy - head.r - oy) / ch)), y1 = Math.min(rows - 1, Math.floor((head.cy + head.r - oy) / ch));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const u = (ox + x * cw + cw / 2 - head.cx) / head.r, v = (oy + y * ch + ch / 2 - head.cy) / head.r; if (u * u + v * v > 1.2) continue;
    const [g, role] = baseRole(u, v, look); out.set(y * cols + x, { g: atlas.index(g), role });
  }
  // the head's own contour: the first and last skin cell of each row take ( and ), so the block reads round
  for (let y = y0; y <= y1; y++) {
    const row = []; for (let x = x0; x <= x1; x++) { const c = out.get(y * cols + x); if (c && c.role === "skin") row.push(x); }
    if (row.length >= 3) { out.set(y * cols + row[0], { g: atlas.index("("), role: "edge" }); out.set(y * cols + row[row.length - 1], { g: atlas.index(")"), role: "edge" }); }
  }
  for (const [u, v, g] of features(look, m)) { const k = at(u, v); if (k >= 0 && out.has(k) && out.get(k).role === "skin") out.set(k, { g: atlas.index(g), role: "feature" }); }
  return out;
}
// big enough for a face: the head spans three cells across and two down
export const faceFits = (r, cw, ch) => r * 2 >= cw * 2.6 && r * 2 >= ch * 1.7;
