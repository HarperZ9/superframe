// Surface kinds for era 4 of The Quota (year 70, the closure; design/eras/era4.md section 11, look L4): lino, papered
// and gloss-painted walls with a nicotine film toward the ceiling, terrazzo and concrete, machine-green steel, glazed
// tile, carpet, Formica, and hand lettering (a 5x7 letter grid laid on a plane: signs, the poster, the map's key, the
// report). Each is registered into kit/ids.mjs's tables on import, after render/props/kinds.mjs, so no other place's
// ids move. Original code (plates agent, 2026-10-22).
import { KIND, ID, BY_ID } from "../kit/ids.mjs";
import "./kinds.mjs";
import { n3, fb3, hash, sstep } from "./noise.mjs";

const S = (mat, scale) => ({ mat, scale, wet: 0, emit: null });
export function kind4(name, mat, scale, tone, detail) {
  if (ID[name] != null) return ID[name];
  const k = { id: BY_ID.length, name, mat, scale, wet: 0, tone, cls: 2, flags: "", emit: null, detail };
  KIND[name] = k; ID[name] = k.id; BY_ID[k.id] = k; return k.id;
}
// the nicotine film: walls yellow and darken toward the ceiling and in the corners
const film = (P, top = 2.6) => 0.55 + 0.45 * (1 - sstep(top * 0.45, top, P[1])) * (0.85 + 0.3 * fb3(P[0] * 1.3, P[1] * 2, P[2] * 1.3));

// lino: worn square tiles in two tones, a path worn pale through the middle
kind4("lino", "lw oxblood", 1, 0.45, (P) => {
  const i = Math.floor(P[0] / 0.3), j = Math.floor(P[2] / 0.3), fx = P[0] / 0.3 - i, fz = P[2] / 0.3 - j, seam = Math.min(fx, 1 - fx, fz, 1 - fz) < 0.025;
  const wear = sstep(0.45, 0.75, fb3(P[0] * 0.9, 0, P[2] * 0.9)), dark = (i + j) & 1;
  if (seam) return S("lw tar", 0.5);
  return dark ? S("lw oxblood", 0.32 + 0.18 * wear + 0.06 * n3(P[0] * 30, 0, P[2] * 30)) : S("lw bone", 0.42 + 0.12 * n3(P[0] * 25, 0, P[2] * 25) - 0.1 * wear);
});
// wallpaper: a narrow stripe and a small repeating sprig, yellowed upward, lifting at the seams
kind4("paper4", "lw bone", 1, 0.6, (P, N) => {
  const u = Math.abs(N[0]) > 0.7 ? P[2] : P[0], s = ((u / 0.53) % 1 + 1) % 1, stripe = Math.abs(((u * 9) % 1 + 1) % 1 - 0.5) < 0.09;
  const sprig = Math.hypot(((u * 4) % 1 + 1) % 1 - 0.5, ((P[1] * 4 + (Math.floor(u * 4) & 1) * 0.5) % 1) - 0.5) < 0.12, f = film(P);
  if (s < 0.008) return S("lw rope", 0.3 * f);
  return sprig ? S("lw oxblood", 0.4 * f) : stripe ? S("lw mustard", 0.45 * f) : S("lw paper", 0.62 * f);
});
// gloss paint over plaster: institutional green below a dado line, cream above, chipped at the edges
kind4("gloss", "lw green paint", 1, 0.55, (P) => {
  const chip = sstep(0.78, 0.84, fb3(P[0] * 7, P[1] * 7, P[2] * 7)), f = film(P, 2.9);
  if (chip > 0.5) return S("plaster", 0.55);
  return P[1] < 1.2 ? S("lw green paint", 0.42 * f) : S("lw limewash", 0.6 * f);
});
// concrete: shuttering marks in courses, damp darkening at the foot, graffiti scrubbed to a pale ghost
kind4("concrete", "stone", 1, 0.5, (P) => {
  const course = Math.abs(((P[1] / 0.3) % 1) - 0.5) > 0.47, damp = 1 - 0.35 * (1 - sstep(0, 0.6, P[1])) * fb3(P[0] * 3, P[1] * 3, P[2] * 3);
  return S(course ? "lw slate" : "stone", (0.42 + 0.18 * fb3(P[0] * 6, P[1] * 6, P[2] * 6)) * damp);
});
kind4("terrazzo", "stone", 1, 0.5, (P) => { const v = hash(Math.floor(P[0] * 90), 0, Math.floor(P[2] * 90)); return v < 0.12 ? S("lw tar", 0.4) : v < 0.2 ? S("lw rust", 0.5) : S("lw bone", 0.5 + 0.1 * n3(P[0] * 4, 0, P[2] * 4)); });
// machine paint: mill green over steel, worn to bright metal on edges and handles, oil black low down
kind4("machine", "lw green paint", 1, 0.45, (P, N) => {
  const wear = sstep(0.62, 0.72, fb3(P[0] * 11, P[1] * 11, P[2] * 11)), oil = P[1] < 0.35 && n3(P[0] * 5, P[1] * 5, P[2] * 5) > 0.45;
  if (oil) return S("lw tar", 0.6); if (wear > 0.5) return S("metal", 0.55);
  return S("lw teal", 0.28 + 0.1 * Math.max(0, N[1]) + 0.08 * n3(P[0] * 20, P[1] * 20, P[2] * 20));
});
kind4("steel", "metal", 1, 0.5, (P) => S("metal", 0.32 + 0.2 * fb3(P[0] * 8, P[1] * 8, P[2] * 8)));
kind4("tile4", "lw bone", 1, 0.65, (P, N) => { const u = Math.abs(N[0]) > 0.7 ? P[2] : P[0], a = ((u / 0.15) % 1 + 1) % 1, b = ((P[1] / 0.15) % 1 + 1) % 1; return Math.min(a, b) < 0.06 ? S("lw slate", 0.45) : S("lw bone", 0.7 * film(P, 2.4)); });
kind4("carpet", "lw oxblood", 1, 0.4, (P) => { const m = Math.abs(Math.sin(P[0] * 26) * Math.sin(P[2] * 26)), w = sstep(0.5, 0.8, fb3(P[0] * 1.2, 0, P[2] * 1.2)), pile = 0.03 * n3(P[0] * 90, 0, P[2] * 90); return m > 0.92 ? S("lw mustard", 0.26 - 0.06 * w + pile) : S("lw oxblood", 0.26 + pile + 0.1 * w); });
kind4("formica", "lw teal", 1, 0.55, (P) => { const sp = hash(Math.floor(P[0] * 60), Math.floor(P[1] * 60), Math.floor(P[2] * 60)); return sp < 0.08 ? S("lw bone", 0.7) : S("lw teal", 0.38 + 0.06 * n3(P[0] * 3, P[1] * 3, P[2] * 3)); });
kind4("vinyl", "lw oxblood", 1, 0.45, (P) => S("lw oxblood", 0.36 + 0.14 * sstep(0.6, 0.8, n3(P[0] * 6, P[1] * 6, P[2] * 6))));
kind4("brick4", "brick", 1, 0.45, (P, N) => {
  const u = Math.abs(N[0]) > 0.7 ? P[2] : P[0], row = Math.floor(P[1] / 0.075), b = Math.floor(u / 0.225 + (row & 1) * 0.5), fu = ((u / 0.225 + (row & 1) * 0.5) % 1 + 1) % 1, fv = ((P[1] / 0.075) % 1 + 1) % 1;
  if (fu < 0.05 || fv < 0.12) return S("lw bone", 0.35); const soot = 1 - 0.45 * sstep(1.5, 6, P[1]) * fb3(P[0], P[1], P[2]);
  return S(hash(b, row, 3) < 0.2 ? "lw rust" : "brick", (0.38 + 0.2 * hash(b, row, 4)) * soot);
});

// 5x7 capitals: a row string per glyph, top row first
const F = { A: "01110100011000111111100011000110001", B: "11110100011000111110100011000111110", C: "01110100011000010000100001000101110", D: "11110100011000110001100011000111110", E: "11111100001000011110100001000011111", F: "11111100001000011110100001000010000", G: "01110100011000010111100011000101111", H: "10001100011000111111100011000110001", I: "01110001000010000100001000010001110", K: "10001100101010011000101001001010001", L: "10000100001000010000100001000011111", M: "10001110111010110101100011000110001", N: "10001100011100110101100111000110001", O: "01110100011000110001100011000101110", P: "11110100011000111110100001000010000", R: "11110100011000111110101001001010001", S: "01111100001000001110000010000111110", T: "11111001000010000100001000010000100", U: "10001100011000110001100011000101110", V: "10001100011000110001100010101000100", W: "10001100011000110101101011010101010", Y: "10001100010101000100001000010000100", "&": "01100100101010001000101011001001101", "-": "00000000000000011111000000000000000", ".": "00000000000000000000000000000000100", "0": "01110100011001110101110011000101110", "1": "00100011000010000100001000010001110", "4": "00010001100101010010111110001000010", "7": "11111000010001000100010000100001000" };
// lettering(name, lines, { o, u, v, cell, ink, ground, rough }): text on the plane through o, along u (rightward) and v
// (downward), cell metres per dot. rough (0..1) breaks a dot's edge and drips it down, for paint by hand.
export function lettering(name, lines, { o, u, v, cell = 0.02, ink = ["lw bone", 0.8], ground = ["lw paper", 0.6], rough = 0, gap = 1.6 }) {
  return kind4(name, ground[0], 1, 0.6, (P, N, V) => {
    const d = [P[0] - o[0], P[1] - o[1], P[2] - o[2]], a = (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / cell, b = (d[0] * v[0] + d[1] * v[1] + d[2] * v[2]) / cell;
    const j = rough ? n3(P[0] * 40, P[1] * 40, P[2] * 40) * rough * 0.9 : 0, line = Math.floor(b / (7 + gap)), row = Math.floor(b - line * (7 + gap) + j);
    const drip = rough && hash(Math.floor(a), line, 9) < 0.18 * rough && row >= 7 && row < 7 + gap * 1.5 + 3 * hash(Math.floor(a), line, 3);
    const t = lines[line] || "", ci = Math.floor(a / 6), col = Math.floor(a - ci * 6 + j), g = F[t[ci]];
    let on = a >= 0 && line >= 0 && g && col < 5 && row >= 0 && row < 7 && g[row * 5 + col] === "1";
    if (drip && g && col >= 0 && col < 5 && g[30 + col] === "1") on = true;
    if (on) return S(ink[0], ink[1]);
    return S(ground[0], ground[1] * (0.85 + 0.25 * n3(P[0] * 9, P[1] * 9, P[2] * 9)));
  });
}
// halftone: dots on a 45-degree screen whose size follows a field (a face, a crowd, smoke), for the poster's collage
export function halftone(name, field, { o, u, v, pitch = 0.012, ink = ["lw tar", 0.3], ground = ["lw paper", 0.7] }) {
  return kind4(name, ground[0], 1, 0.6, (P) => {
    const d = [P[0] - o[0], P[1] - o[1], P[2] - o[2]], a = d[0] * u[0] + d[1] * u[1] + d[2] * u[2], b = d[0] * v[0] + d[1] * v[1] + d[2] * v[2];
    const r = (a + b) / pitch / Math.SQRT2, s = (a - b) / pitch / Math.SQRT2, fr = r - Math.round(r), fs = s - Math.round(s), t = field(a, b);
    return Math.hypot(fr, fs) < 0.62 * Math.sqrt(Math.max(0, Math.min(1, t))) ? S(ink[0], ink[1]) : S(ground[0], ground[1]);
  });
}
// the bank's map: streets in pen on cartridge paper, the river, and the blocks to be cleared in a grey wash
export function bankMap(name, { o, u, v, w, h }) {
  return kind4(name, "lw paper", 1, 0.7, (P) => {
    const d = [P[0] - o[0], P[1] - o[1], P[2] - o[2]], a = (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / w, b = (d[0] * v[0] + d[1] * v[1] + d[2] * v[2]) / h;
    const river = Math.abs(b - 0.72 - 0.08 * Math.sin(a * 7)) < 0.03, gx = Math.abs(((a * 7 + 0.15 * b) % 1) - 0.5) > 0.46, gy = Math.abs(((b * 6) % 1) - 0.5) > 0.465;
    const bi = Math.floor(a * 7 + 0.15 * b), bj = Math.floor(b * 6), wash = b > 0.42 && b < 0.7 && hash(bi, bj, 21) < 0.7;
    if (a < 0.02 || a > 0.98 || b < 0.02 || b > 0.98) return S("lw tar", 0.3);
    if (river) return S("lw cobalt", 0.4); if (gx || gy) return S("lw tar", 0.35);
    return wash ? S("lw slate", 0.55 + 0.1 * n3(P[0] * 30, P[1] * 30, P[2] * 30)) : S("lw paper", 0.72);
  });
}
export { ID };
