// raw-native style passes in the C++ core (ADR 0019): the one shader source of each ported web
// style pass. scripts/wgsl_to_hlsl.py generates hlsl/style_<name>.hlsl and style_layout.hpp from
// this file; the WebGPU build runs it as written. The float64 references are
// raw/renderer/style_ditherlight.hpp and style_paintover.hpp; the checks are
// src/renderer/gpu/style_parity.cpp, bounds in evidence/cpp-port-style-bounds.json.

// Dither-quantised lighting. a: cell, px (pixels a cell covers), pa (pixel angle), gamma;
// b: dark, hemi, fogDist, fogMax; ink and paper in linear light (w unused).
struct DitherParams {
    width: u32, height: u32, levels: u32, source: u32,
    anchor: u32, lights: u32, pad0: u32, pad1: u32,
    a: vec4f,
    b: vec4f,
    ink: vec4f,
    paper: vec4f,
}
// Paint-over projection. opt: facingPow, fMin, floor, tolBase; opt2: tolGrazing, the 8-bit divisor.
struct PaintParams {
    width: u32, height: u32, count: u32, pad0: u32,
    opt: vec4f,
    opt2: vec4f,
}

// The post stack's passes (web/motion/post.mjs PostPass): size (width, height, frame, time) and
// 16 parameter floats.
struct PostParams {
    size: vec4f,
    p0: vec4f,
    p1: vec4f,
    p2: vec4f,
    p3: vec4f,
}
// CRT purity. a: s, w (beam), mag, magScale; b: earth, degauss, tau, mains; c: field, blank,
// wobble, t; d: spread, 0, 0, 0.
struct PurityParams {
    width: u32, height: u32, pad0: u32, pad1: u32,
    a: vec4f,
    b: vec4f,
    c: vec4f,
    d: vec4f,
}
// Pigment-space lighting. a: Emid, t0, strength, shape; fog: colour and the display gain.
struct LightpaintParams {
    width: u32, height: u32, complement: u32, pad0: u32,
    a: vec4f,
    shadow: vec4f,
    lightp: vec4f,
    fog: vec4f,
}
// Interference glaze. a: d0, dVar, noiseScale, coverage; b: n0, n2, A, B; c: filmN, aspect, tan,
// gain; the camera's axes and eye; fog colour.
struct GlazeParams {
    width: u32, height: u32, dispersion: u32, pad0: u32,
    a: vec4f,
    b: vec4f,
    c: vec4f,
    fwd: vec4f,
    right: vec4f,
    up: vec4f,
    eye: vec4f,
    fog: vec4f,
}
// Curvature hatching. a: freq, width, umb, contour; ink; paper.
struct HatchParams {
    width: u32, height: u32, layers: u32, pad0: u32,
    a: vec4f,
    ink: vec4f,
    paper: vec4f,
}

// Hysteresis quantisation. mode 0 bands, 1 palette; a: N, margin, gain, depthTol; b: K.
struct HystParams {
    width: u32, height: u32, mode: u32, palSize: u32,
    hasState: u32, hasMotion: u32, on: u32, pad0: u32,
    a: vec4f,
    b: vec4f,
}
// Palette-locked lighting. a: gain, ambient, moon, cycle rate; b: time, moon direction; the lamp
// and two window glows as (position, radius), (core, intensity, wrap, 0).
struct PalettelightParams {
    width: u32, height: u32, steps: u32, voidSteps: u32,
    a: vec4f,
    b: vec4f,
    lampA: vec4f,
    lampB: vec4f,
    g0a: vec4f,
    g0b: vec4f,
    g1a: vec4f,
    g1b: vec4f,
}

// Palette dither: n palette entries; mode 0 none, 1 to 3 Bayer 2/4/8, 4 IGN, 5 blue noise, 6 to 8
// the mix modes over Bayer 4, Bayer 8 and blue noise.
struct DitherGpuParams {
    width: u32, height: u32, n: u32, mode: u32,
}

// Development adjacency. a: Dc, Db, dt, k; b: eta, r, beta, etaB; c: rB, gamma, H0, exposure;
// d: decay, the display gain.
struct AdjParams {
    width: u32, height: u32, s: u32, cw: u32,
    ch: u32, pad0: u32, pad1: u32, pad2: u32,
    a: vec4f,
    b: vec4f,
    c: vec4f,
    d: vec4f,
}

// crt-classic (the Studio's tube stage). a: bloom, halation, curvature, aberration; b: vignette.
// dir and radius are the box pass's axis (0 x, 1 y) and radius.
struct ClassicParams {
    width: u32, height: u32, cell: u32, phosphor: u32,
    flat_cell: u32, flat_even: u32, flat_odd: u32, q: u32,
    lw: u32, lh: u32, dir: u32, radius: u32,
    a: vec4f,
    b: vec4f,
}
// VHS. lh, ph, chh: half-widths of the luma, peaking and chroma taps (packed in that order).
// a: jitter, headSwitchLines, headSkew, tracking; b: lumaNoise, chromaNoise, peaking, delay;
// c: phaseNoise, dropouts x generations; the YIQ matrix and its inverse as rows.
struct VhsParams {
    n: u32, lines: u32, src_w: u32, src_h: u32,
    out_w: u32, out_h: u32, frame: u32, seed: u32,
    lh: u32, ph: u32, chh: u32, pad0: u32,
    a: vec4f,
    b: vec4f,
    c: vec4f,
    yiq0: vec4f,
    yiq1: vec4f,
    yiq2: vec4f,
    inv0: vec4f,
    inv1: vec4f,
    inv2: vec4f,
}
// Fibre-network watercolour. a: C, L, fibre width, md; b: spread, k0, k1, rate; c: floc, evap,
// dt, strength; paper: the paper colour and edgeDry.
struct FibreParams {
    width: u32, height: u32, per_cell: u32, pad0: u32,
    a: vec4f,
    b: vec4f,
    c: vec4f,
    paper: vec4f,
}

// The spectral film shader. a: 2^ev, um per pixel, weave x, weave y (output pixels); e0..e2 the
// exposure matrix rows; grain radii (um) and contrasts; halo strengths; the negative's and the
// print's curve constants; b: interimage, bleach, print base; the output matrix rows.
struct FilmParams {
    out_w: u32, out_h: u32, in_w: u32, in_h: u32,
    gw: u32, gh: u32, halo_q: u32, halo_r: u32,
    frame: u32, mtf_r: u32, mtf_dir: u32, pad0: u32,
    a: vec4f,
    e0: vec4f,
    e1: vec4f,
    e2: vec4f,
    grain_r: vec4f,
    grain_cs: vec4f,
    halo_s: vec4f,
    neg_dmin: vec4f,
    neg_span: vec4f,
    neg_k: vec4f,
    neg_x0: vec4f,
    b: vec4f,
    prt_dmin: vec4f,
    prt_span: vec4f,
    prt_k: vec4f,
    log_gain: vec4f,
    out0: vec4f,
    out1: vec4f,
    out2: vec4f,
}

// The lens suite. a: cx, cy, squeeze, iris roundness; b: cos and sin of the streak angle, streak
// length, streak thickness (px); c: star cell (px), star gain, threshold, display gain; phi per channel.
struct LensGpuParams {
    width: u32, height: u32, n_src: u32, n_ghost: u32,
    star_m: u32, tile: u32, tiles_x: u32, blades: u32,
    a: vec4f,
    b: vec4f,
    c: vec4f,
    phi: vec4f,
}

// Scan-causal EHT sag. a: S, alpha, focus, sigma0; b: bright, gamma, initial sag.
struct SagGpuParams {
    width: u32, height: u32, blank: u32, settle: u32,
    radius: u32, pad0: u32, pad1: u32, pad2: u32,
    a: vec4f,
    b: vec4f,
}
// Salience caricature. a: lambda cap, gain, display gain; w0..w2: the salience weight of each
// material id 0 to 9.
struct CariGpuParams {
    width: u32, height: u32, radius: u32, steps: u32,
    dir: u32, pad0: u32, pad1: u32, pad2: u32,
    a: vec4f,
    w0: vec4f,
    w1: vec4f,
    w2: vec4f,
}

// Perspective-stable pixel art. origin: the probe origin and the posterise bands; a: outline,
// crease, quad expansion, crossfade blend; eye and tan(fovy / 2); the camera's forward, right, up.
struct PixelGpuParams {
    width: u32, height: u32, n: u32, has_prev: u32,
    origin: vec4f,
    a: vec4f,
    eye: vec4f,
    f: vec4f,
    r: vec4f,
    u: vec4f,
}

// The painterly shader. medium 0 oil, 1 matte, 2 water; canvas_mode 0 offset, 1 advected; dir and
// blur_r for the tensor blur. a: exposure, radius, q, zeta; b: eta, impasto, gloss, push; c: broken,
// value bands, lines, line sigma; d: line sharpness, warp, granulation, edge; e: dilution, canvas
// offset x and y.
struct PaintGpuParams {
    width: u32, height: u32, medium: u32, canvas_mode: u32,
    dir: u32, stroke_len: u32, blur_r: u32, pad0: u32,
    a: vec4f,
    b: vec4f,
    c: vec4f,
    d: vec4f,
    e: vec4f,
}

fn sat1(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}
fn smooth1(a: f32, b: f32, x: f32) -> f32 {
    let t: f32 = sat1((x - a) / (b - a));
    return t * t * (3.0 - 2.0 * t);
}
fn linear_to_srgb(l0: f32) -> f32 {
    let l: f32 = clamp(l0, 0.0, 1.0);
    if (l <= 0.0031308) { return l * 12.92; }
    return 1.055 * pow(l, 1.0 / 2.4) - 0.055;
}
fn pack_rgb8(c: vec3f) -> u32 {
    let r: u32 = u32(floor(linear_to_srgb(c.x) * 255.0 + 0.5));
    let g: u32 = u32(floor(linear_to_srgb(c.y) * 255.0 + 0.5));
    let b: u32 = u32(floor(linear_to_srgb(c.z) * 255.0 + 0.5));
    return r | (g << 8u) | (b << 16u) | (255u << 24u);
}

// The shader library's hash and noise fade (web/shaders/common.mjs, purity.mjs).
fn pcg(v: u32) -> u32 {
    let state: u32 = v * 747796405u + 2891336453u;
    let word: u32 = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}
fn hash3(x: u32, y: u32, z: u32) -> f32 {
    return f32(pcg(x ^ pcg(y ^ pcg(z)))) / 4294967296.0;
}
fn fade5(t: f32) -> f32 {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}
// The lab parity pages' display encode (web/shaders/lab/gpu-kit.mjs): a soft shoulder, sRGB, 8 bits.
fn lab_pack(c: vec3f, gain: f32) -> u32 {
    let r: u32 = u32(floor(linear_to_srgb(1.0 - exp(-max(0.0, c.x) * gain)) * 255.0 + 0.5));
    let g: u32 = u32(floor(linear_to_srgb(1.0 - exp(-max(0.0, c.y) * gain)) * 255.0 + 0.5));
    let b: u32 = u32(floor(linear_to_srgb(1.0 - exp(-max(0.0, c.z) * gain)) * 255.0 + 0.5));
    return r | (g << 8u) | (b << 16u) | (255u << 24u);
}

// RGBA8 words: one channel as an integer, and three channels packed with alpha 255.
fn ch8(v: u32, c: u32) -> i32 {
    return i32((v >> (8u * c)) & 255u);
}
fn pack8(r: i32, g: i32, b: i32) -> u32 {
    return u32(clamp(r, 0, 255)) | (u32(clamp(g, 0, 255)) << 8u) | (u32(clamp(b, 0, 255)) << 16u) | (255u << 24u);
}
// A Box-Muller normal from three integer hashes (gauss of web/shaders/vhs/vhs.mjs).
fn gauss3(a: u32, b: u32, c: u32) -> f32 {
    let u1: f32 = max(1.0e-7, hash3(a, b, c));
    let u2: f32 = hash3(a, b, c + 7919u);
    return sqrt(-2.0 * log(u1)) * cos(6.283185307179586 * u2);
}

// The pixel-art diorama (web/shaders/pixel/scene.mjs) and its OKLab styling, shared by the pixel
// passes: distance, material and object; the march (t < 0 for a miss); normal; shading; sky.
fn px_box(p: vec3f, c: vec3f, b: vec3f) -> f32 {
    let q: vec3f = abs(p - c) - b;
    return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}
fn px_sph(p: vec3f, c: vec3f, r: f32) -> f32 {
    return length(p - c) - r;
}
fn px_cyl(p: vec3f, cx: f32, cz: f32, y0: f32, y1: f32, r: f32) -> f32 {
    return max(length(vec2f(p.x - cx, p.z - cz)) - r, abs(p.y - (y0 + y1) / 2.0) - (y1 - y0) / 2.0);
}
fn px_map(p: vec3f) -> vec3f {
    var r: vec3f = vec3f(p.y, 0.0, 0.0);
    let pond: f32 = max(length(vec2f(p.x - 2.2, (p.z - 1.6) * 1.4)) - 0.9, abs(p.y + 0.02) - 0.03);
    if (pond < r.x) { r = vec3f(pond, 1.0, 1.0); }
    let walls: f32 = px_box(p, vec3f(-1.0, 0.8, -0.6), vec3f(1.2, 0.8, 0.9));
    if (walls < r.x) { r = vec3f(walls, 2.0, 2.0); }
    let rx: f32 = (p.x + 1.0) * 0.7071 + (p.y - 1.6) * 0.7071;
    let ry: f32 = -(p.x + 1.0) * 0.7071 + (p.y - 1.6) * 0.7071;
    let roof: f32 = max(px_box(vec3f(rx, ry, p.z), vec3f(0.0, 0.0, -0.6), vec3f(0.95, 0.95, 1.05)), -p.y + 1.6);
    if (roof < r.x) { r = vec3f(roof, 3.0, 3.0); }
    let door: f32 = px_box(p, vec3f(-0.5, 0.45, 0.32), vec3f(0.22, 0.45, 0.04));
    if (door < r.x) { r = vec3f(door, 4.0, 4.0); }
    let win: f32 = px_box(p, vec3f(-1.45, 0.95, 0.32), vec3f(0.25, 0.2, 0.03));
    if (win < r.x) { r = vec3f(win, 5.0, 5.0); }
    let trunk: f32 = px_cyl(p, 1.9, -1.2, 0.0, 1.1, 0.13);
    if (trunk < r.x) { r = vec3f(trunk, 6.0, 6.0); }
    let leaves: f32 = min(px_sph(p, vec3f(1.9, 1.5, -1.2), 0.62), px_sph(p, vec3f(2.25, 1.15, -0.95), 0.42));
    if (leaves < r.x) { r = vec3f(leaves, 7.0, 7.0); }
    let body: f32 = px_cyl(p, 0.6, 1.0, 0.0, 0.62, 0.16);
    if (body < r.x) { r = vec3f(body, 8.0, 8.0); }
    let head: f32 = px_sph(p, vec3f(0.6, 0.78, 1.0), 0.13);
    if (head < r.x) { r = vec3f(head, 9.0, 9.0); }
    let post: f32 = px_cyl(p, 0.2, 1.75, 0.0, 0.9, 0.035);
    if (post < r.x) { r = vec3f(post, 10.0, 10.0); }
    let lamp: f32 = px_box(p, vec3f(0.2, 0.98, 1.75), vec3f(0.08, 0.09, 0.08));
    if (lamp < r.x) { r = vec3f(lamp, 11.0, 11.0); }
    let rock: f32 = px_sph(p, vec3f(-2.3, 0.15, 1.4), 0.38) + 0.04 * sin(p.x * 9.0) * sin(p.z * 7.0);
    if (rock < r.x) { r = vec3f(rock, 12.0, 12.0); }
    return r;
}
fn px_albedo(m: i32) -> vec3f {
    if (m == 0) { return vec3f(0.17, 0.32, 0.1); }
    if (m == 1) { return vec3f(0.08, 0.2, 0.32); }
    if (m == 2) { return vec3f(0.62, 0.5, 0.36); }
    if (m == 3) { return vec3f(0.45, 0.13, 0.09); }
    if (m == 4) { return vec3f(0.28, 0.16, 0.08); }
    if (m == 5) { return vec3f(1.0, 0.8, 0.4); }
    if (m == 6) { return vec3f(0.25, 0.15, 0.08); }
    if (m == 7) { return vec3f(0.1, 0.3, 0.09); }
    if (m == 8) { return vec3f(0.15, 0.22, 0.45); }
    if (m == 9) { return vec3f(0.75, 0.55, 0.42); }
    if (m == 10) { return vec3f(0.1, 0.1, 0.1); }
    if (m == 11) { return vec3f(1.0, 0.75, 0.35); }
    return vec3f(0.4, 0.4, 0.42);
}
fn px_normal(p: vec3f) -> vec3f {
    let e: f32 = 1.0e-3;
    let nx: f32 = px_map(p + vec3f(e, 0.0, 0.0)).x - px_map(p - vec3f(e, 0.0, 0.0)).x;
    let ny: f32 = px_map(p + vec3f(0.0, e, 0.0)).x - px_map(p - vec3f(0.0, e, 0.0)).x;
    let nz: f32 = px_map(p + vec3f(0.0, 0.0, e)).x - px_map(p - vec3f(0.0, 0.0, e)).x;
    return normalize(vec3f(nx, ny, nz));
}
fn px_march(o: vec3f, r: vec3f, tmax: f32) -> vec3f {
    var t: f32 = 0.0;
    for (var i: i32 = 0; i < 160 && t < tmax; i++) {
        let h: vec3f = px_map(o + r * t);
        if (h.x < 1.0e-3 * (1.0 + t)) { return vec3f(t, h.y, h.z); }
        t = t + h.x * 0.9;
    }
    return vec3f(-1.0, -1.0, -1.0);
}
fn px_sky(r: vec3f) -> vec3f {
    let k: f32 = max(0.0, r.y);
    return vec3f(0.85 - 0.6 * k, 0.82 - 0.4 * k, 0.78 + 0.1 * k);
}
fn px_shade(p: vec3f, n: vec3f, m: i32) -> vec3f {
    if (m == 5) { return px_albedo(5) * 1.6; }
    if (m == 11) { return px_albedo(11) * 4.0; }
    var alb: vec3f = px_albedo(m);
    if (m == 0) {
        if (((i32(floor(p.x * 2.0)) + i32(floor(p.z * 2.0))) & 1) == 0) { alb = alb * 0.86; }
    }
    let L: vec3f = normalize(vec3f(-0.45, 0.8, 0.4));
    let sh: vec3f = px_march(p + L * 0.02, L, 12.0);
    let sun: f32 = max(0.0, dot(n, L)) * select(0.0, 1.0, sh.x < 0.0) * 2.6;
    let skyf: f32 = (0.55 + 0.45 * n.y) * 0.55;
    let lv: vec3f = vec3f(0.2, 0.98, 1.75) - p;
    let ld: f32 = length(lv);
    let lan: f32 = max(0.0, dot(n, lv) / ld) * 1.2 / (ld * ld + 0.2);
    return alb * (sun * vec3f(1.0, 0.93, 0.8) + skyf * vec3f(0.6, 0.75, 1.0) + lan * vec3f(1.0, 0.7, 0.35));
}
fn px_stylise(rgb: vec3f, bands: f32, dL: f32) -> vec3f {
    let c: vec3f = max(rgb, vec3f(0.0));
    let l: f32 = pow(0.4122214708 * c.x + 0.5363325363 * c.y + 0.0514459929 * c.z, 1.0 / 3.0);
    let m: f32 = pow(0.2119034982 * c.x + 0.6806995451 * c.y + 0.1073969566 * c.z, 1.0 / 3.0);
    let s: f32 = pow(0.0883024619 * c.x + 0.2817188376 * c.y + 0.6299787005 * c.z, 1.0 / 3.0);
    let L: f32 = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    let a: f32 = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    let b: f32 = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    let Lq: f32 = clamp(floor((L + dL) * bands + 0.5) / bands, 0.0, 1.0);
    let l2: f32 = Lq + 0.3963377774 * a + 0.2158037573 * b;
    let m2: f32 = Lq - 0.1055613458 * a - 0.0638541728 * b;
    let s2: f32 = Lq - 0.0894841775 * a - 1.2914855480 * b;
    let l3: f32 = l2 * l2 * l2;
    let m3: f32 = m2 * m2 * m2;
    let s3: f32 = s2 * s2 * s2;
    return max(vec3f(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3, -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3, -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3), vec3f(0.0));
}
fn px_face_dir(f: u32, u: f32, v: f32) -> vec3f {
    if (f == 0u) { return vec3f(1.0, -v, -u); }
    if (f == 1u) { return vec3f(-1.0, -v, u); }
    if (f == 2u) { return vec3f(u, 1.0, v); }
    if (f == 3u) { return vec3f(u, -1.0, -v); }
    if (f == 4u) { return vec3f(u, -v, 1.0); }
    return vec3f(-u, -v, -1.0);
}
fn px_cheb(r: vec3f) -> f32 {
    return max(abs(r.x), max(abs(r.y), abs(r.z)));
}

// The painterly shader's noise fields (web/shaders/paint/noise.mjs), shared by its passes; and its
// flow field from a smoothed structure tensor (abstract.mjs flow).
fn pt_fade(t: f32) -> f32 {
    return t * t * (3.0 - 2.0 * t);
}
fn pt_vnoise(x: f32, y: f32, seed: u32) -> f32 {
    let xi: f32 = floor(x);
    let yi: f32 = floor(y);
    let tx: f32 = pt_fade(x - xi);
    let ty: f32 = pt_fade(y - yi);
    let ix: u32 = bitcast<u32>(i32(xi));
    let iy: u32 = bitcast<u32>(i32(yi));
    let a: f32 = hash3(ix, iy, seed);
    let b: f32 = hash3(ix + 1u, iy, seed);
    let c: f32 = hash3(ix, iy + 1u, seed);
    let d: f32 = hash3(ix + 1u, iy + 1u, seed);
    return (a + (b - a) * tx) * (1.0 - ty) + (c + (d - c) * tx) * ty;
}
fn pt_paper(x: f32, y: f32) -> f32 {
    let c1: f32 = 0.9397;
    let s1: f32 = 0.342;
    let c2: f32 = -0.342;
    let s2: f32 = 0.9397;
    let f1: f32 = pt_vnoise((x * c1 + y * s1) / 0.9, (-x * s1 + y * c1) / 7.0, 31u);
    let f2: f32 = pt_vnoise((x * c2 + y * s2) / 0.9, (-x * s2 + y * c2) / 7.0, 37u);
    return 0.45 * pt_vnoise(x / 2.2, y / 2.2, 11u) + 0.25 * pt_vnoise(x / 9.0, y / 9.0, 13u) + 0.15 * f1 + 0.15 * f2;
}
// Noise kind: 0 bristle, 1 stroke identity, 2 canvas weave, 3 paper, 4 paper at half frequency,
// 5 and 6 the warp fields.
fn pt_noise(kind: u32, x: f32, y: f32) -> f32 {
    if (kind == 0u) { return 0.7 * pt_vnoise(x / 1.3, y / 1.3, 53u) + 0.3 * pt_vnoise(x / 5.0, y / 5.0, 59u); }
    if (kind == 1u) { return pt_vnoise(x / 6.0, y / 6.0, 67u); }
    if (kind == 2u) { return 0.5 + 0.25 * sin(6.283185307179586 * x / 3.2) * cos(6.283185307179586 * y / 3.2) + 0.25 * (pt_vnoise(x / 1.5, y / 1.5, 61u) - 0.5); }
    if (kind == 3u) { return pt_paper(x, y); }
    if (kind == 4u) { return pt_paper(x / 2.0, y / 2.0); }
    if (kind == 5u) { return 2.0 * pt_vnoise(x / 23.0, y / 23.0, 71u) - 1.0; }
    return 2.0 * pt_vnoise(x / 23.0, y / 23.0, 73u) - 1.0;
}
fn pt_smooth(a: f32, b: f32, x: f32) -> f32 {
    let t: f32 = clamp((x - a) / (b - a), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
}
fn pt_major(e: f32, f: f32, g: f32) -> vec3f {
    let tr: f32 = e + g;
    let l1: f32 = (tr + sqrt((e - g) * (e - g) + 4.0 * f * f)) / 2.0;
    let a: vec2f = vec2f(f, l1 - e);
    let b: vec2f = vec2f(l1 - g, f);
    let na: f32 = length(a);
    let nb: f32 = length(b);
    if (na >= nb) { return vec3f(a, na); }
    return vec3f(b, nb);
}
fn pt_flow(T: vec4f) -> vec3f {
    let E: f32 = T.x;
    let F: f32 = T.y;
    let G: f32 = T.z;
    let tr: f32 = E + G;
    let dsc: f32 = sqrt((E - G) * (E - G) + 4.0 * F * F);
    let l1: f32 = (tr + dsc) / 2.0;
    let l2: f32 = (tr - dsc) / 2.0;
    let sh: f32 = clamp((tr - 1.0e-7) / 9.0e-7, 0.0, 1.0);
    var A: f32 = 0.0;
    if (tr > 1.0e-12) { A = (l1 - l2) / (l1 + l2) * sh * sh * (3.0 - 2.0 * sh); }
    let s: f32 = clamp((A - 0.02) / 0.08, 0.0, 1.0);
    let k: f32 = s * s * (3.0 - 2.0 * s);
    var inv: f32 = 0.0;
    if (tr > 1.0e-12) { inv = 1.0 / tr; }
    let m: vec3f = pt_major(k * E * inv + (1.0 - k) * 0.5, k * F * inv - (1.0 - k) * 0.5, k * G * inv + (1.0 - k) * 0.5);
    if (m.z <= 1.0e-12) { return vec3f(0.7071067811865476, 0.7071067811865476, A); }
    return vec3f(-m.y / m.z, m.x / m.z, A);
}

// The physical CRT (raw/renderer/style_crt.hpp). The uniform carries the frame number; the
// parameter block of layout.mjs (crtPackParams, 122 values) and then the packed filter taps are
// one storage array P, indexed by these constants.
struct CrtpGpuParams {
    frame: u32, pad0: u32, pad1: u32, pad2: u32,
}
const CP_srcW: u32 = 0u;
const CP_N: u32 = 2u;
const CP_lines: u32 = 3u;
const CP_mode: u32 = 4u;
const CP_pal: u32 = 5u;
const CP_comb: u32 = 6u;
const CP_lineCyc: u32 = 7u;
const CP_frameCyc: u32 = 8u;
const CP_tapRgb: u32 = 10u;
const CP_tapEnc: u32 = 12u;
const CP_tapSep: u32 = 14u;
const CP_tapLum: u32 = 16u;
const CP_tapI: u32 = 18u;
const CP_tapQ: u32 = 20u;
const CP_fwd: u32 = 22u;
const CP_inv: u32 = 31u;
const CP_outW: u32 = 40u;
const CP_outH: u32 = 41u;
const CP_viewW: u32 = 42u;
const CP_viewH: u32 = 43u;
const CP_cx: u32 = 44u;
const CP_cy: u32 = 45u;
const CP_rx: u32 = 46u;
const CP_ry: u32 = 47u;
const CP_dist: u32 = 48u;
const CP_faceW: u32 = 49u;
const CP_faceH: u32 = 50u;
const CP_rasterW: u32 = 51u;
const CP_rasterH: u32 = 52u;
const CP_lineMm: u32 = 53u;
const CP_corner: u32 = 54u;
const CP_contrast: u32 = 55u;
const CP_brightness: u32 = 56u;
const CP_gamma: u32 = 57u;
const CP_spotLo: u32 = 58u;
const CP_spotHi: u32 = 59u;
const CP_spotExp: u32 = 60u;
const CP_maskType: u32 = 61u;
const CP_pitch: u32 = 62u;
const CP_fill: u32 = 63u;
const CP_slotH: u32 = 64u;
const CP_slotGap: u32 = 65u;
const CP_dampers: u32 = 66u;
const CP_nDampers: u32 = 68u;
const CP_damperW: u32 = 69u;
const CP_maskMix: u32 = 70u;
const CP_maskMean: u32 = 71u;
const CP_maskLock: u32 = 72u;
const CP_pitchPx: u32 = 73u;
const CP_conv: u32 = 74u;
const CP_mono: u32 = 79u;
const CP_interlace: u32 = 80u;
const CP_decay: u32 = 81u;
const CP_fieldT: u32 = 96u;
const CP_haloQ: u32 = 97u;
const CP_haloR: u32 = 98u;
const CP_haloDirect: u32 = 99u;
const CP_gw: u32 = 100u;
const CP_gh: u32 = 101u;
const CP_M: u32 = 102u;
const CP_luma: u32 = 111u;
const CP_ambient: u32 = 114u;
const CP_transmission: u32 = 115u;
const CP_reflection: u32 = 116u;
const CP_glassN: u32 = 117u;
const CP_bezel: u32 = 118u;
const CP_exposure: u32 = 121u;
const CP_taps: u32 = 122u;
fn cp_erf(x: f32) -> f32 {
    let s: f32 = select(1.0, -1.0, x < 0.0);
    let a: f32 = abs(x);
    let t: f32 = 1.0 / (1.0 + 0.3275911 * a);
    let y: f32 = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-a * a);
    return s * y;
}
fn cp_gauss_mass(a: f32, b: f32, mu: f32, sigma: f32) -> f32 {
    let k: f32 = 1.0 / (sigma * 1.4142135623730951);
    return 0.5 * (cp_erf((b - mu) * k) - cp_erf((a - mu) * k));
}
fn cp_tent_cdf(u: f32, a: f32) -> f32 {
    let v: f32 = u / a;
    if (v <= -1.0) { return 0.0; }
    if (v <= 0.0) { return 0.5 * (1.0 + v) * (1.0 + v); }
    if (v < 1.0) { return 1.0 - 0.5 * (1.0 - v) * (1.0 - v); }
    return 1.0;
}
fn cp_pulse_f(x: f32, pp: f32, w: f32) -> f32 {
    let n: f32 = floor(x / pp);
    return n * w + min(max(x - n * pp, 0.0), w);
}
fn cp_pulse_box(y0: f32, y1: f32, pp: f32, w: f32, s: f32) -> f32 {
    let n0: f32 = floor((y0 - s) / pp);
    let a: f32 = y0 - s - n0 * pp;
    let b: f32 = y1 - s - n0 * pp;
    return (cp_pulse_f(b, pp, w) - cp_pulse_f(a, pp, w)) / (y1 - y0);
}
fn cp_room_env(d: vec3f) -> f32 {
    let c: f32 = dot(d, vec3f(-0.38, -0.33, -0.864));
    let t: f32 = clamp((c - 0.975) / 0.02, 0.0, 1.0);
    return 0.04 + t * t * (3.0 - 2.0 * t);
}
fn cp_fresnel_air(n: f32, theta: f32) -> f32 {
    let s: f32 = sin(theta) / n;
    let ci: f32 = cos(theta);
    let ct: f32 = sqrt(1.0 - s * s);
    let rs: f32 = (ci - n * ct) / (ci + n * ct);
    let rp: f32 = (ct - n * ci) / (ct + n * ci);
    return 0.5 * (rs * rs + rp * rp);
}
fn cp_shoulder(x: f32) -> f32 {
    if (x <= 0.8) { return x; }
    // tanh from one exp (WARP's hyperbolic functions are imprecise; the paint glaze, bounds-11).
    let u: f32 = (x - 0.8) / 0.2;
    let e: f32 = exp(-2.0 * u);
    return 0.8 + 0.2 * (1.0 - e) / (1.0 + e);
}
fn cp_enc(v: f32, exposure: f32) -> u32 {
    let l: f32 = cp_shoulder(max(0.0, v * exposure));
    var s: f32 = 1.055 * pow(l, 1.0 / 2.4) - 0.055;
    if (l <= 0.0031308) { s = l * 12.92; }
    return u32(clamp(floor(s * 255.0 + 0.5), 0.0, 255.0));
}

