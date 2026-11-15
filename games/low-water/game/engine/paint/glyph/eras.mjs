// The glyph style's base palette per era (design/art/GLYPH-LANGUAGE.md section 5): what ground the type
// stands on, what ink it is struck in, where the one warm thing comes from, and the one hot mark. The
// palette grades the lit frame: each cell's lit colour is pulled toward the era's ink by its value
// (a duotone between ground and ink), by the era's grade strength, so the light still sets every value
// and the era sets the hue. Emitters keep most of their own colour (in era 2 a lamp is the only warm
// thing in the frame). The hot mark (a telegraph, a selected choice) is never graded. Original code.
//   eraLook(era) -> look   gradeCell(FG, BG, i, look, keep)   ERA_NAMES
// era 0 is Low Water's own night (no grade), so the Gullet acts look as they did.
export const ERA_NAMES = { 0: "Low Water", 1: "The Exchange", 2: "The Quota", 3: "Allocation", 4: "The Closure", 5: "The Clearance" };
export const ERAS = {
  0: { ground: [14, 10, 14], ink: [233, 227, 212], hot: [214, 120, 74], grade: 0, sky: [1, 1, 1], snow: 0, decay: 0 },
  // money and lamp-black: warm umber ground, bone ink, brass the warm
  1: { ground: [16, 11, 8], ink: [236, 218, 186], hot: [226, 104, 58], grade: 0.35, sky: [1.08, 1.0, 0.86], snow: 0, decay: 0, keepWarm: true },
  // the famine winter: frost-blue type on a blue-black ground; the lamp the only warmth
  2: { ground: [7, 10, 17], ink: [196, 216, 238], hot: [232, 86, 56], grade: 0.55, sky: [0.82, 0.94, 1.22], snow: 1, decay: 0.15, keepWarm: true },
  // allocation: institutional grey-green, the ink of a ration book
  3: { ground: [11, 13, 11], ink: [204, 212, 192], hot: [226, 96, 64], grade: 0.5, sky: [0.94, 1.02, 0.94], snow: 0, decay: 0.3 },
  // the closure: nicotine paper and a fluorescent tube
  4: { ground: [15, 12, 9], ink: [222, 204, 168], hot: [90, 196, 214], grade: 0.5, sky: [1.0, 0.98, 0.9], snow: 0, decay: 0.45 },
  // the clearance: sodium amber, a single ink; the hot mark is the patrol car's blue
  5: { ground: [9, 6, 3], ink: [255, 178, 74], hot: [96, 156, 255], grade: 0.85, sky: [1.15, 0.78, 0.42], snow: 0, decay: 0.55 },
};
export function eraLook(era) { return ERAS[era] || ERAS[0]; }

// grade one cell of a frame's arrays in place: ink and ground pulled toward the era's duotone at the
// cell's value; keep (0..1) holds back the grade (emitters: most of their own colour)
export function gradeCell(FG, BG, i, look, keep = 0) {
  const k = look.grade * (1 - keep); if (k <= 0) return;
  const lf = (0.2126 * FG[i * 3] + 0.7152 * FG[i * 3 + 1] + 0.0722 * FG[i * 3 + 2]) / 255;
  const lb = (0.2126 * BG[i * 3] + 0.7152 * BG[i * 3 + 1] + 0.0722 * BG[i * 3 + 2]) / 255;
  for (let c = 0; c < 3; c++) {
    const g = look.ground[c], ink = look.ink[c];
    FG[i * 3 + c] = FG[i * 3 + c] * (1 - k) + (g + (ink - g) * Math.min(1, lf * 1.15)) * k;
    BG[i * 3 + c] = BG[i * 3 + c] * (1 - k) + (g + (ink - g) * Math.min(1, lb * 1.15)) * k;
  }
}
// how much of a cell's ink is lamp-warm (red well over blue, and bright): in eras 1 and 2 that much of the
// cell keeps its own colour, so a lamp's pool stays the one warm thing in a graded frame
const warmth = (FG, i) => Math.max(0, Math.min(1, ((FG[i * 3] - FG[i * 3 + 2]) / 255 - 0.12) * 2.5)) * Math.min(1, FG[i * 3] / 140);
// the whole frame (world, figures, effects: before the panels); a cell flagged hot keeps its colour
export function gradeFrame(out, n, look, hot = null) {
  if (!look || look.grade <= 0) return;
  for (let i = 0; i < n; i++) { if (hot && hot[i]) continue; gradeCell(out.FG, out.BG, i, look, Math.max(out.EM[i] > 100 ? 0.75 : 0, look.keepWarm ? warmth(out.FG, i) : 0)); }
}
