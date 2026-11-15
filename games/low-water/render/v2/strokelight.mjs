// Stroke light (design/art/PAINT-LANGUAGE.md; the author, 2026-10-21, on the portrait painter: "I like the lighting
// that the paint strokes introduce ... Could really improve the lighting, especially with the environment"). The
// light is laid in paint, not left as a smooth gradient:
//   - the light family of every surface takes loaded strokes that run along its plane and catch the key: stone
//     long and level (a knife's drag), brick short level dabs, timber along the grain, plaster loose diagonals;
//   - the shadow family is glazed and unified: one cool transparent dark, its texture kept, its noise calmed;
//   - the edge where light meets shadow is broken: strokes of light reach into the dark and fall short of it;
//   - near a light source the strokes turn to radiate from it, warmer and more loaded the nearer they are.
// Light family and terminator come from the light model's terms when given (terms.family, terms.warm); without
// them they are read from the plate's own value against its neighbourhood, so the pass runs on any plate.
// Original code; deterministic by seed.
//   strokeLight(rgba8, W, H, { id, nrm, names, cam, terms }, { seed, scale, strength, frost }) -> Uint8ClampedArray
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
function rnd(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
// the stroke a material takes in the light: [length px, width px, angle mode, alpha, lift, tint, tint share]
const KIND = {
  stone: [18, 3.2, "level", 0.55], brick: [7, 2.6, "level", 0.6], timber: [16, 2.2, "grain", 0.55], plaster: [12, 3.6, "diag", 0.45],
  roof: [14, 2.6, "slope", 0.5], ground: [16, 3.0, "level", 0.45], cloth: [10, 3.0, "grain", 0.5], metal: [9, 1.8, "grain", 0.6],
  // from the code-drawn illustrations (inspiration section 10): hairline strokes for hair, wool and feathers; a short
  // square dab for felt; wind streaks for snow and frost (long, thin, all one way, the wind's); skin soft and blended;
  // bread a crusted knife
  hair: [14, 0.9, "grain", 0.75, 1.35], felt: [5, 3.2, "level", 0.6, 1.15], wind: [26, 1.1, "wind", 0.7, 1.2, [0.92, 0.94, 0.98], 0.55], skin: [9, 3.4, "diag", 0.4], bread: [8, 3.0, "level", 0.6],
};
export const WIND = [0.96, -0.28];   // the wind's streak on the screen (from the left, a little rising)
const KIND_OF = {
  quay: "stone", cobble: "stone", slab: "stone", wall: "stone", steps: "stone", mole: "stone", tower: "stone",
  brick: "brick", brickdark: "brick", chimney: "brick",
  boards: "timber", deck: "timber", timber: "timber", plank: "timber", darkwood: "timber", barrel: "timber", crate: "timber",
  plaster: "plaster", limewash: "plaster", bone: "plaster", oxblood: "plaster", mustard: "plaster", teal: "plaster", pink: "plaster", cobalt: "plaster",
  roof: "roof", tile: "roof", mud: "ground", sand: "ground", shingle: "ground", ice: "ground",
  canvas: "cloth", sack: "cloth", rug: "cloth", oilskin: "cloth", navy: "cloth", iron: "metal", rust: "metal", stove: "metal", brass: "metal",
  wool: "hair", hair: "hair", feather: "hair", straw: "hair", felt: "felt", snow: "wind", frost: "wind", rime: "wind", skin: "skin", flesh: "skin", bread: "bread",
};
const EMIT = new Set(["lantern", "window", "windowdim", "flame", "stovefire", "candle", "sodium", "porthole", "whitelamp", "arc"]);

export function strokeLight(src, W, H, { id, nrm = null, names, cam = { yawDeg: 34, elevDeg: 36 }, terms = null }, { seed = 7, scale = 1, strength = 1, frost = 0 } = {}) {
  const n = W * H, out = new Float32Array(n * 3), rand = rnd(seed), L = new Float32Array(n);
  for (let i = 0; i < n; i++) { for (let c = 0; c < 3; c++) out[i * 3 + c] = src[i * 4 + c] / 255; L[i] = lum(out[i * 3], out[i * 3 + 1], out[i * 3 + 2]); }
  // the local mean value (a 2-level box blur over about 24 px), for the light family without a light model
  const r = Math.max(4, Math.round(12 * scale)), M = boxBlur(L, W, H, r);
  const fam = new Float32Array(n);
  for (let i = 0; i < n; i++) fam[i] = terms ? terms.family[i] : clamp((L[i] / Math.max(0.02, M[i]) - 0.92) * 3.2);
  // screen directions of the world axes (orthographic camera): x, z on the ground, y up
  const y = (cam.yawDeg * Math.PI) / 180, e = (cam.elevDeg * Math.PI) / 180, right = [Math.cos(y), 0, -Math.sin(y)];
  const fwd = [-Math.sin(y) * Math.cos(e), -Math.sin(e), -Math.cos(y) * Math.cos(e)], up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
  const scr = (v) => { const sx = v[0] * right[0] + v[1] * right[1] + v[2] * right[2], sy = -(v[0] * up[0] + v[1] * up[1] + v[2] * up[2]), l = Math.hypot(sx, sy) || 1; return [sx / l, sy / l]; };
  // 1. glaze the shadow family: a cool transparent dark over a calmed copy (texture kept at a third)
  const soft = [0, 1, 2].map((c) => boxBlur(Float32Array.from({ length: n }, (_, i) => out[i * 3 + c]), W, H, Math.max(2, Math.round(3 * scale))));
  const glaze = [0.78, 0.84, 1.0];
  for (let i = 0; i < n; i++) { if (!id[i]) continue; const t = (terms && terms.shade ? terms.shade[i] : clamp(1 - fam[i] * 1.6)) * 0.55 * strength; if (t <= 0) continue; for (let c = 0; c < 3; c++) { const calm = out[i * 3 + c] * 0.35 + soft[c][i] * 0.65; out[i * 3 + c] += (calm * glaze[c] * 0.9 - out[i * 3 + c]) * t; } }
  // the light sources: emitter pixels gathered into clusters (a 6 px grid), each with its brightness
  const srcs = [], seen = new Map(), G6 = 6;
  for (let i = 0; i < n; i++) { if (!EMIT.has(names[id[i]] || "") || L[i] < 0.4) continue; const k = `${Math.floor((i % W) / G6)},${Math.floor(i / W / G6)}`; let c = seen.get(k); if (!c) { c = { x: 0, y: 0, n: 0, b: 0 }; seen.set(k, c); srcs.push(c); } c.x += i % W; c.y += (i / W) | 0; c.n++; c.b += L[i]; }
  for (const c of srcs) { c.x /= c.n; c.y /= c.n; c.b /= c.n; c.reach = (40 + 90 * c.b) * scale * Math.min(2, Math.sqrt(c.n) / 2); }
  // 2. loaded strokes in the light, along each surface's plane, by material
  const step = Math.max(2, Math.round(4 * scale)), ref = out.slice();
  let laid = 0;
  for (let gy = 0; gy < H; gy += step) for (let gx = 0; gx < W; gx += step) {
    const x = Math.min(W - 1, gx + Math.floor(rand() * step)), yy = Math.min(H - 1, gy + Math.floor(rand() * step)), i = yy * W + x, nm = names[id[i]] || "";
    if (!id[i] || EMIT.has(nm) || nm === "sky") continue;
    const f = fam[i] + (rand() - 0.5) * 0.5;   // the terminator broken: some strokes reach into the dark, some fall short
    if (f < 0.45) continue;
    const N = nrm ? [nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]] : [0, 1, 0];
    const K = frost > 0 && N[1] > 0.6 && rand() < frost * 0.6 ? KIND.wind : KIND[KIND_OF[nm] || "plaster"];   // frost on the tops: the wind's white streaks over whatever lies under them
    let d;
    if (K[2] === "level" || K[2] === "slope") d = Math.abs(N[1]) > 0.6 ? scr([1, 0, 0]) : scr([N[2], 0, -N[0]]);   // along the floor's x, or level along a wall
    else if (K[2] === "wind") d = WIND;
    else if (K[2] === "grain") d = Math.abs(N[1]) > 0.6 ? scr([0, 0, 1]) : scr([0, 1, 0]);
    else { const a = scr([N[2], 0, -N[0]]); d = [a[0] * 0.7 - a[1] * 0.7, a[0] * 0.7 + a[1] * 0.7]; }   // plaster: loose diagonals
    if (K[2] === "slope" && Math.abs(N[1]) <= 0.6) d = scr([N[0], 0, N[2]].map((v, k) => v + (k === 1 ? 1 : 0)));
    // near a light source the stroke radiates from it (a lamp's pool laid as loaded strokes, not a gradient)
    let near = null, nb = 0;
    if (terms && terms.srcX && !Number.isNaN(terms.srcX[i])) { near = { x: terms.srcX[i], y: terms.srcY[i] }; nb = clamp(terms.strength[i] * 1.5) * clamp(1 - Math.hypot(x - near.x, yy - near.y) / (220 * scale)); }   // the light model names the ruling lamp
    else for (const c of srcs) { const dd = Math.hypot(x - c.x, yy - c.y); if (dd < c.reach && 1 - dd / c.reach > nb) { nb = 1 - dd / c.reach; near = c; } }
    if (near && nb > 0.15) { const rx = x - near.x, ry = yy - near.y, rl = Math.hypot(rx, ry) || 1; d = [d[0] * (1 - nb) + (rx / rl) * nb, d[1] * (1 - nb) + (ry / rl) * nb]; const dl = Math.hypot(d[0], d[1]) || 1; d = [d[0] / dl, d[1] / dl]; }
    const c0 = [ref[i * 3], ref[i * 3 + 1], ref[i * 3 + 2]], lift = 1 + (0.22 + 0.25 * nb) * clamp(f) * strength, warm = terms ? terms.warm[i] : 0.25;
    const L2 = lift * (K[4] || 1), wm = warm + 0.6 * nb; let col = [c0[0] * L2 * (1 + 0.06 * wm), c0[1] * L2, c0[2] * L2 * (1 - 0.1 * wm)];
    if (K[5]) col = col.map((v, ch) => v * (1 - K[6]) + K[5][ch] * K[6]);   // snow and frost: the wind lays white over what is under it
    col = col.map((v) => clamp(v * (1 + (rand() - 0.5) * 0.08)));
    dab(out, K[5] ? null : ref, W, H, x, yy, d, K[0] * scale * (0.7 + 0.6 * rand()), K[1] * scale, col, K[3] * strength * clamp(f), id, id[i]);
    laid++;
  }
  const o8 = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i++) { for (let c = 0; c < 3; c++) o8[i * 4 + c] = clamp(out[i * 3 + c]) * 255; o8[i * 4 + 3] = src[i * 4 + 3]; }
  o8.stats = { strokes: laid, sources: srcs.length };
  return o8;
}
// one tapered stroke; with ref and id it stays on its own surface (same id, close colour)
function dab(out, ref, W, H, cx, cy, d, len, wid, col, alpha, id, own) {
  const R = Math.ceil(len / 2 + wid);
  for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(H - 1, cy + R); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(W - 1, cx + R); x++) {
    const px = x - cx, py = y - cy, u = (px * d[0] + py * d[1]) / (len / 2), v = (-px * d[1] + py * d[0]) / wid; if (Math.abs(u) > 1 || Math.abs(v) > 1) continue;
    const i = y * W + x; if (id && id[i] !== own) continue;
    if (ref) { const dc = Math.abs(ref[i * 3] - col[0]) + Math.abs(ref[i * 3 + 1] - col[1]) + Math.abs(ref[i * 3 + 2] - col[2]); if (dc > 0.35) continue; }
    const a = alpha * (1 - u * u) * (1 - Math.pow(Math.abs(v), 3)) * (0.85 + 0.15 * Math.sin(v * 5.3 + cx));
    for (let c = 0; c < 3; c++) out[i * 3 + c] = out[i * 3 + c] * (1 - a) + col[c] * a;
  }
}
function boxBlur(a, W, H, r) {
  const t = new Float32Array(a.length), o = new Float32Array(a.length), cl = (v, n) => (v < 0 ? 0 : v >= n ? n - 1 : v);
  for (let pass = 0; pass < 2; pass++) {
    const s = pass ? o.slice() : a;
    for (let y = 0; y < H; y++) { let acc = 0; for (let x = -r; x <= r; x++) acc += s[y * W + cl(x, W)]; for (let x = 0; x < W; x++) { t[y * W + x] = acc / (2 * r + 1); acc += s[y * W + cl(x + r + 1, W)] - s[y * W + cl(x - r, W)]; } }
    for (let x = 0; x < W; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += t[cl(y, H) * W + x]; for (let y = 0; y < H; y++) { o[y * W + x] = acc / (2 * r + 1); acc += t[cl(y + r + 1, H) * W + x] - t[cl(y - r, H) * W + x]; } }
  }
  return o;
}
