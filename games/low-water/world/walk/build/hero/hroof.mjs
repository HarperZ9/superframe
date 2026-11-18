// The roof of a hero house: two decks of shingles on rafters whose tails show under the eaves,
// barge and fascia boards, a stone chimney, and the load of snow: a thick blanket over each slope
// that rolls over the eave as a cornice, thinner at the ridge where the wind takes it, with ice
// hanging from the eave in uneven runs (longer on the side the low sun reaches).
import { put, dir } from "../kit.mjs";
import { sub, add, mul, norm, lerp } from "./hmesh.mjs";
import { snowPillow, fbm } from "./hparts.mjs";

function snowLoad(T, f, gx, D, ov, ridge, eave, pitch, sz, depth) {
  const { M, R } = T, ph = R() * 40, run = D + ov, nu = Math.max(24, Math.round(gx * 2 / 0.12)), nv = 26, cornice = 0.22 + 0.25 * R();
  const ca = Math.cos(pitch), sa = Math.sin(pitch);
  // s across the roof (0..1 over -gx..gx), t down the slope from the ridge (0) past the eave (1.12)
  const P = (s, t) => {
    const x = (s * 2 - 1) * (gx + 0.06), tt = t * 1.12, along = Math.min(tt, 1), past = Math.max(0, tt - 1) / 0.12;
    const edge = Math.min(1, Math.min(s, 1 - s) * gx * 2 / 0.35), thick = depth * (0.55 + 0.45 * Math.min(1, along * 3)) * (0.85 + 0.3 * fbm(x * 1.3 + ph, along * 4)) * Math.sqrt(edge);
    const y0 = ridge - (eave + 0.02 - ridge) * -along, z0 = sz * run * along;
    // the deck surface, then out along its normal by the thickness; past the eave the blanket curls down
    let y = y0 + thick * ca, z = z0 + sz * thick * sa;
    if (past > 0) { const c = past * Math.PI * 0.62; y = y0 + thick * Math.cos(pitch + c) - cornice * 0.35 * past; z = z0 + sz * (thick * Math.sin(pitch + c) + cornice * Math.sin(c) * 0.9); }
    return put(f, [x, y, z]);
  };
  M.grid("snow", P, nu, nv, (s, t) => [(s * 2 - 1) * gx * 0.5 + ph, t * run * 0.5]);
  // the ends of the blanket over each gable, closing it to the deck
  for (const s of [0, 1]) M.grid("snow", (u, t) => { const a = P(s, t), x = (s * 2 - 1) * (gx + 0.06), along = Math.min(1, t * 1.12); const b = put(f, [x, ridge - (ridge - eave) * along, sz * run * along]); return [lerp(b[0], a[0], u), lerp(b[1], a[1], u), lerp(b[2], a[2], u)]; }, 2, nv, (u, t) => [u * 0.3, t * 2]);
  return { lipY: (eave - cornice * 0.35), lipZ: sz * (run + cornice * 0.8) };
}

function icicles(T, f, gx, y, z, long) {
  const { M, R } = T;
  for (let x = -gx; x < gx; x += 0.05 + 0.1 * R()) {
    if (R() < 0.35) continue;
    const run = 0.5 + 0.5 * Math.sin(x * 1.7 + R()), len = (0.04 + R() * R() * long) * run;
    if (len < 0.03) continue;
    M.icicle("ice", put(f, [x, y + 0.02, z - Math.sign(z) * 0.05]), len, 0.012 + 0.018 * R() * Math.min(1, len * 3), R);
  }
}

export function roof(T, f, W, D, hw, pitch, lod) {
  const { M, R } = T, ov = 0.6, gx = W + 0.4, rise = (D + ov) * Math.tan(pitch), ridge = hw + D * Math.tan(pitch), eave = ridge - rise;
  const deck = 0.07, n = (sz) => dir(f, [0, Math.cos(pitch), sz * Math.sin(pitch)]);
  for (const sz of [-1, 1]) {
    // the deck of shingles, its uv down the slope so the courses run along the eave
    const A = put(f, [-gx, ridge + deck, 0]), B = put(f, [gx, ridge + deck, 0]), C = put(f, [gx, eave + deck, sz * (D + ov)]), Dd = put(f, [-gx, eave + deck, sz * (D + ov)]), L = Math.hypot(rise, D + ov);
    M.wear = [Math.min(1, T.age + 0.2), 0.3, 0.1, R()];
    M.quad("shingle", A, B, C, Dd, [[0, 0], [2 * gx, 0], [2 * gx, L], [0, L]]);
    // the deck's underside and its edge
    const ua = put(f, [-gx, ridge, 0]), ub = put(f, [gx, ridge, 0]), uc = put(f, [gx, eave, sz * (D + ov)]), ud = put(f, [-gx, eave, sz * (D + ov)]);
    M.quad("timber", ud, uc, ub, ua, [[0, 0], [2 * gx, 0], [2 * gx, L], [0, L]]);
    M.wear = T.col;
    // fascia along the eave and rafter tails under it
    M.bbox("timber", f, -gx, eave - 0.16, sz * (D + ov) - (sz > 0 ? 0.04 : -0.0), gx, eave + deck + 0.02, sz * (D + ov) + (sz > 0 ? 0 : 0.04), 0.01, 1, [R() * 9, R() * 9]);
    if (lod === 0) for (let x = -gx + 0.3; x < gx - 0.2; x += 0.6) {
      const zz = sz * (D + 0.05), ze = sz * (D + ov - 0.05), y0 = hw - 0.05 - (Math.abs(zz) - D) * Math.tan(pitch);
      M.tube("timber", [put(f, [x, y0 - 0.05, zz]), put(f, [x, eave - 0.1, ze])], 0.05, 4);
    }
    const lip = snowLoad(T, f, gx, D, ov, ridge, eave, pitch, sz, 0.32 + 0.3 * R());
    if (lod === 0) icicles(T, f, gx, lip.lipY, lip.lipZ, sz > 0 ? 0.7 : 0.4);
  }
  // barge boards up each gable
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const a = put(f, [sx * gx, ridge + deck + 0.04, 0]), b = put(f, [sx * gx, eave + deck + 0.04, sz * (D + ov)]);
    M.tube("timber", [a, b], 0.07, 4);
  }
  // the ridge cap of snow
  M.tube("snow", [put(f, [-gx - 0.05, ridge + 0.32, 0]), put(f, [0, ridge + 0.38, 0]), put(f, [gx + 0.05, ridge + 0.3, 0])], 0.22, 10);
  // the chimney: stone courses, a cap and its snow
  const cx = (R() - 0.5) * W, cz = -0.6, base = ridge - 0.9, top = ridge + 1.2;
  for (let y = base; y < top; y += 0.22) M.bbox("stone", f, cx - 0.33 + (R() - 0.5) * 0.02, y, cz - 0.34, cx + 0.33, y + 0.21, cz + 0.34, 0.025, 1, [R() * 9, R() * 9]);
  M.bbox("stone", f, cx - 0.42, top, cz - 0.43, cx + 0.42, top + 0.09, cz + 0.43, 0.02);
  snowPillow(T, f, cx - 0.42, cz - 0.43, cx + 0.42, cz + 0.43, top + 0.09, 0.14 + 0.1 * R(), 0.04);
  return { ridge, eave, gx, ov };
}
