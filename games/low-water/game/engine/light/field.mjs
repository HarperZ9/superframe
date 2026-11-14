// The per-pixel light record over a plate (design/state/light.md, light lead's interface): what both styles
// read for every plate sample. Baked once per place, variant and street state (bakeField), then composed
// per frame for the clock and the lights' gains (composeField), cheaply: each sample keeps its two
// strongest lights apart and the rest summed.
//   const F = bakeField(pj, geo, M)    geo: { pos, ids }, M: createLightModel(...)
//   composeField(F, M, { hour, t, gains }) -> F.E (Float32Array rgb, linear, about 1 for a lit surface)
//   F.rec  per sample: dir (Int8 x3, toward the ruling light), K (Uint16 kelvin), shadow, rim, occ,
//          wet, frost, fog (Uint8 0..255), up (Uint8, how far the surface faces up)
import { geoDims, normalsOf, occlusionOf, marcher } from "./geo.mjs";
import { camBasis } from "../world/plateworld.mjs";
import { contrib } from "./model.mjs";
import { surfaceTerms } from "./surface.mjs";
import { mired, fromMired, lum } from "./kelvin.mjs";

const NONE = 255;
// lamps bucketed on a 4 m grid so each sample tries only those in reach
function buckets(lights) {
  const g = new Map(), key = (x, z) => `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
  lights.forEach((L, i) => { const r = Math.ceil(L.reach / 4); for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) { const k = `${Math.floor(L.at[0] / 4) + dx},${Math.floor(L.at[2] / 4) + dz}`; (g.get(k) || g.set(k, []).get(k)).push(i); } });
  return (x, z) => g.get(key(x, z)) || [];
}
// the geometry half of a field (normals, occlusion, the shadow march), shared by window finding and the bake
export function prepGeo(pj, geo) {
  const [w, h] = geoDims(pj), pos = geo.pos, N = normalsOf(pj, pos);
  return { pj, w, h, n: w * h, N, pos, ids: geo.ids, occ: occlusionOf(pj, pos, N), blocked: marcher(pj, pos) };
}
export function bakeField(pj, geo, M, { shadows = true, G = null } = {}) {
  const F = fieldOf(G || prepGeo(pj, geo)); F.shadows = shadows;
  bakeRows(F, M, 0, F.h); surfaceTerms(F, M);
  return F;
}
// the field before any light is baked (steps.mjs bakes it in bands)
export function fieldOf(g) {
  const n = g.n, F = { ...g, shadows: true,
    id0: new Uint8Array(n).fill(NONE), id1: new Uint8Array(n).fill(NONE), e0: new Float32Array(n), e1: new Float32Array(n), rest: new Float32Array(n * 3), rest0: new Float32Array(n * 3), restRaw: new Float32Array(n),
    up: new Uint8Array(n), sunVis: new Uint8Array(n), moonVis: new Uint8Array(n), sunKey: "", E: new Float32Array(n * 3),
    rec: { dir: new Int8Array(n * 3), K: new Uint16Array(n), key: new Uint8Array(n), keyE: new Uint8Array(n), side: new Int8Array(n), term: new Uint8Array(n), shadow: new Uint8Array(n), rim: new Uint8Array(n), occ: g.occ, wet: new Uint8Array(n), frost: new Uint8Array(n), fog: new Uint8Array(n), up: null } };
  F.rec.up = F.up; return F;
}
export function bakeRows(F, M, y0, y1, x0 = 0, x1 = F.w) {
  const near = F.near || (F.near = buckets(M.lights)), B = F.camB || (F.camB = camBasis(F.pj.camera));
  for (let y = y0; y < Math.min(F.h, y1); y++) for (let i = y * F.w + x0; i < y * F.w + x1; i++) { if (!Number.isFinite(F.N[i * 3])) continue; bakeSample(F, M, near, B, i); }
}
function bakeSample(F, M, near, B, i) {
  const { pos, N } = F, px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2], nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
  F.up[i] = Math.round(255 * (0.5 + 0.5 * ny));
  let b0 = 0, b1 = 0, j0 = NONE, j1 = NONE, open = 0, got = 0, rim = 0;
  for (const j of near(px, pz)) {
    const L = M.lights[j], e = contrib(L, px, py, pz, nx, ny, nz); if (e < 0.004) continue;
    open += e; if (F.shadows && !L.generated && F.blocked(i, L.at[0], L.at[1], L.at[2])) continue; got += e;   // a window's short spill is not marched
    // rim: light from behind the surface as the camera sees it, at grazing incidence
    const dx = L.at[0] - px, dy = L.at[1] - py, dz = L.at[2] - pz, d = Math.hypot(dx, dy, dz) || 1, back = (dx * B.f[0] + dy * B.f[1] + dz * B.f[2]) / d;
    if (back > 0.1) rim += e * back * (1 - Math.abs((nx * dx + ny * dy + nz * dz) / d));
    if (e > b0) { if (j0 !== NONE) addRest(F, M, i, j1, b1); j1 = j0; b1 = b0; j0 = j; b0 = e; }
    else if (e > b1) { if (j1 !== NONE) addRest(F, M, i, j1, b1); j1 = j; b1 = e; }
    else addRest(F, M, i, j, e);
  }
  F.id0[i] = j0; F.id1[i] = j1; F.e0[i] = b0; F.e1[i] = b1;
  F.rec.shadow[i] = open > 0.004 ? Math.round(255 * (1 - got / open)) : 0;
  F.rec.rim[i] = Math.min(255, Math.round(rim * 400));
}
// the lights past the two strongest, summed: as they burn now (rest) and as the plate was baked, every one lit (rest0)
function addRest(F, M, i, j, e) {
  if (j === NONE) return; const L = M.lights[j], g = L.decay.gain;
  for (let k = 0; k < 3; k++) { F.rest[i * 3 + k] += L.rgb[k] * e * g; F.rest0[i * 3 + k] += L.generated ? 0 : L.rgb0[k] * e; }
  F.restRaw[i] += e * g;
}

// the sun's and the moon's shadows for the clock's sun: re-marched only when the sun has moved
function skyVis(F, M, S) {
  const key = `${S.sun.dir.map((v) => v.toFixed(2))}|${S.moon.dir.map((v) => v.toFixed(2))}`; if (key === F.sunKey) return;
  F.sunKey = key; const { pos, N, n } = F, sd = S.sun.dir, md = S.moon.dir;
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(N[i * 3])) continue; const px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2];
    F.sunVis[i] = S.sun.E > 0 && sd[1] > 0 && !(F.shadows && F.blocked(i, px + sd[0] * 40, py + sd[1] * 40, pz + sd[2] * 40, 12)) ? 255 : 0;
    F.moonVis[i] = S.moon.E > 0 && md[1] > 0 && !(F.shadows && F.blocked(i, px + md[0] * 40, py + md[1] * 40, pz + md[2] * 40, 10)) ? 255 : 0;
  }
}
// asBaked: every light at full gain and nothing decayed, as the plate's bake lit it (the painted relight's
// denominator); out: where to write (default F.E)
export function composeField(F, M, { hour = M.hour, t = 0, gains = null, indoor = false, asBaked = false, out = null } = {}) {
  const S = hour === M.hour ? M.sky : M.skyAt(hour), G = asBaked ? M.lights.map((L) => (L.generated ? 0 : 1)) : gains || M.gains(t), { N, n, rec } = F, E = out || F.E, R = asBaked ? F.rest0 : F.rest; skyVis(F, M, S);
  const sk = indoor ? 0.25 : 1, sd = S.sun.dir, md = S.moon.dir, sE = S.sun.E * sk, mE = S.moon.E * sk;
  for (let i = 0; i < n; i++) {
    const nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2]; if (!Number.isFinite(nx)) continue;
    const up = F.up[i] / 255, ao = 1 - 0.65 * (F.occ[i] / 255), a = (0.4 + 0.6 * up) * ao * sk, gd = (1 - up) * ao * sk;
    let r = S.amb[0] * a + S.ground[0] * gd, g = S.amb[1] * a + S.ground[1] * gd, b = S.amb[2] * a + S.ground[2] * gd;
    const sl = F.sunVis[i] ? Math.max(0, nx * sd[0] + ny * sd[1] + nz * sd[2]) * sE : 0, ml = F.moonVis[i] ? Math.max(0, nx * md[0] + ny * md[1] + nz * md[2]) * mE : 0;
    r += S.sun.rgb[0] * sl + S.moon.rgb[0] * ml; g += S.sun.rgb[1] * sl + S.moon.rgb[1] * ml; b += S.sun.rgb[2] * sl + S.moon.rgb[2] * ml;
    let wm = lum(S.sun.rgb) * sl * mired(5200) + (lum(S.amb) * a + ml * 0.3) * mired(9000), wt = lum(S.sun.rgb) * sl + lum(S.amb) * a + ml * 0.3, best = sl, bdir = sd, bid = sl > 0 ? KEY_SUN : KEY_SKY;
    if (ml > best) { best = ml; bdir = md; bid = KEY_MOON; }
    for (const [id, e] of [[F.id0[i], F.e0[i]], [F.id1[i], F.e1[i]]]) {
      if (id === NONE) continue; const L = M.lights[id], k = e * G[id], c = asBaked ? L.rgb0 : L.rgb; r += c[0] * k; g += c[1] * k; b += c[2] * k;
      const l = lum(L.rgb) * k; wm += l * mired(L.K); wt += l; if (k > best) { best = k; bdir = L.at; bid = id; }
    }
    r += R[i * 3]; g += R[i * 3 + 1]; b += R[i * 3 + 2]; wm += F.restRaw[i] * 0.4 * mired(1900); wt += F.restRaw[i] * 0.4;
    E[i * 3] = r; E[i * 3 + 1] = g; E[i * 3 + 2] = b; rec.K[i] = Math.round(fromMired(wt > 0 ? wm / wt : mired(6500)));
    const kd = bid >= KEY_SUN ? (bid === KEY_SKY ? [0, 1, 0] : bdir) : [bdir[0] - F.pos[i * 3], bdir[1] - F.pos[i * 3 + 1], bdir[2] - F.pos[i * 3 + 2]];
    dirInto(rec.dir, i, kd); keyInto(rec, i, bid, best, nx * rec.dir[i * 3] + ny * rec.dir[i * 3 + 1] + nz * rec.dir[i * 3 + 2], softOf(M, bid));
  }
  return E;
}
// the ruling light's id per sample, for strokes that radiate from their source: a light's index in M.lights,
// or the sun, the moon, the sky, or (addLights) a moving light
export const KEY_SUN = 250, KEY_MOON = 251, KEY_SKY = 252, KEY_DYN = 253;
const SOFT_OF = { sun: 0.12, moon: 0.2, headlamp: 0.15, carbide: 0.2, window: 0.6, fluorescent: 0.6, embers: 0.5 };
const softOf = (M, id) => (id === KEY_SUN ? 0.12 : id === KEY_MOON ? 0.2 : id === KEY_SKY ? 0.8 : id >= KEY_DYN ? 0.15 : SOFT_OF[M.lights[id].kind] ?? 0.35);
// side: n.l toward the key (-127 shadow side .. 127 lit); term: the terminator band, 255 where n.l = 0, fading
// out over the source's softness; keyE: the key's irradiance (255 = 1)
function keyInto(rec, i, id, e, ndl127, soft) {
  const nl = ndl127 / 127; rec.key[i] = id; rec.keyE[i] = Math.min(255, Math.round(e * 255));
  rec.side[i] = Math.max(-127, Math.min(127, Math.round(nl * 127))); rec.term[i] = Math.round(255 * Math.max(0, 1 - Math.abs(nl) / soft));
}
// the key's colour for a sample (rgb, brightest 1)
export function keyRgb(F, M, i, S = M.sky) {
  const id = F.rec.key[i]; if (id < M.lights.length) return M.lights[id].rgb;
  const c = id === KEY_SUN ? S.sun.rgb : id === KEY_MOON ? S.moon.rgb : S.amb, m = Math.max(...c) || 1; return c.map((v) => v / m);
}
function dirInto(D, i, v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; D[i * 3] = Math.round((127 * v[0]) / l); D[i * 3 + 1] = Math.round((127 * v[1]) / l); D[i * 3 + 2] = Math.round((127 * v[2]) / l); }
// moving lights (the train's headlamp) added into E for this frame, shadowed by the same march; every
// `step`-th sample is marched and its neighbours share the answer (a cheaper pass for live frames)
export function addLights(F, lights, E = F.E, { step = 1 } = {}) {
  const { N, pos, w, h } = F;
  for (const L of lights) for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    const i = y * w + x; if (!Number.isFinite(N[i * 3])) continue;
    const e = contrib(L, pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); if (e < 0.004) continue;
    if (F.shadows && F.blocked(i, L.at[0], L.at[1], L.at[2], 20)) continue;
    for (let dy = 0; dy < step && y + dy < h; dy++) for (let dx = 0; dx < step && x + dx < w; dx++) {
      const j = i + dy * w + dx; if (!Number.isFinite(N[j * 3])) continue; E[j * 3] += L.rgb[0] * e; E[j * 3 + 1] += L.rgb[1] * e; E[j * 3 + 2] += L.rgb[2] * e;
      if (e * 255 > F.rec.keyE[j]) { const v = [L.at[0] - pos[j * 3], L.at[1] - pos[j * 3 + 1], L.at[2] - pos[j * 3 + 2]]; dirInto(F.rec.dir, j, v); keyInto(F.rec, j, KEY_DYN + lights.indexOf(L), e, N[j * 3] * F.rec.dir[j * 3] + N[j * 3 + 1] * F.rec.dir[j * 3 + 1] + N[j * 3 + 2] * F.rec.dir[j * 3 + 2], 0.15); }
    }
  }
  return E;
}
