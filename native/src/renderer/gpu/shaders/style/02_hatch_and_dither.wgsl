//@pass style_hatch
// Curvature hatching (raw/renderer/style_hatch.hpp) over the owned still life of
// web/shaders/fixtures/stilllife.mjs, seen from its camera. Writes the sRGB-encoded RGBA8.
@group(0) @binding(0) var<uniform> U: HatchParams;
@group(0) @binding(1) var<storage, read_write> out8: array<u32>;

fn sd_sphere(p: vec3f) -> f32 {
    return length(p - vec3f(-0.9, 0.55, 0.2)) - 0.55;
}
fn sd_torus(p: vec3f) -> f32 {
    let qx: f32 = length(vec2f(p.x - 0.75, p.z - 0.45)) - 0.5;
    let qy: f32 = p.y - 0.18;
    return sqrt(qx * qx + qy * qy) - 0.18;
}
fn sd_capsule(p: vec3f) -> f32 {
    let pa: vec3f = p - vec3f(0.05, 0.25, -0.95);
    let ba: vec3f = vec3f(0.0, 1.3, 0.0);
    let h: f32 = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - 0.25;
}
fn sd_round_box(p: vec3f) -> f32 {
    let q: vec3f = abs(p - vec3f(1.65, 0.3, -0.6)) - vec3f(0.22, 0.22, 0.22);
    return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0) - 0.08;
}
fn still_sdf(p: vec3f) -> f32 {
    return min(min(min(min(p.y, sd_sphere(p)), sd_torus(p)), sd_capsule(p)), sd_round_box(p));
}
fn mixed(p: vec3f, ei: vec3f, ej: vec3f) -> f32 {
    return (still_sdf(p + ei + ej) - still_sdf(p + ei - ej) - still_sdf(p - ei + ej) + still_sdf(p - ei - ej)) / (4.0 * 0.01 * 0.01);
}
// The surface normal and the line direction's normal partner at p; returns 1 at an umbilic.
fn curvature(p: vec3f, nout: ptr<function, vec3f>, other: ptr<function, vec3f>) -> f32 {
    let ex: vec3f = vec3f(0.01, 0.0, 0.0);
    let ey: vec3f = vec3f(0.0, 0.01, 0.0);
    let ez: vec3f = vec3f(0.0, 0.0, 0.01);
    let f0: f32 = still_sdf(p);
    let fxp: f32 = still_sdf(p + ex);
    let fxm: f32 = still_sdf(p - ex);
    let fyp: f32 = still_sdf(p + ey);
    let fym: f32 = still_sdf(p - ey);
    let fzp: f32 = still_sdf(p + ez);
    let fzm: f32 = still_sdf(p - ez);
    let g: vec3f = vec3f(fxp - fxm, fyp - fym, fzp - fzm) / (2.0 * 0.01);
    let gl: f32 = length(g);
    let n: vec3f = g / gl;
    let hxy: f32 = mixed(p, ex, ey);
    let hxz: f32 = mixed(p, ex, ez);
    let hyz: f32 = mixed(p, ey, ez);
    let r0: vec3f = vec3f((fxp - 2.0 * f0 + fxm) / (0.01 * 0.01), hxy, hxz);
    let r1: vec3f = vec3f(hxy, (fyp - 2.0 * f0 + fym) / (0.01 * 0.01), hyz);
    let r2: vec3f = vec3f(hxz, hyz, (fzp - 2.0 * f0 + fzm) / (0.01 * 0.01));
    var aux: vec3f = vec3f(1.0, 0.0, 0.0);
    if (abs(n.y) < 0.9) { aux = vec3f(0.0, 1.0, 0.0); }
    let t1: vec3f = normalize(cross(n, aux));
    let t2: vec3f = cross(n, t1);
    let h1: vec3f = vec3f(dot(r0, t1), dot(r1, t1), dot(r2, t1));
    let h2: vec3f = vec3f(dot(r0, t2), dot(r1, t2), dot(r2, t2));
    let a: f32 = dot(t1, h1) / gl;
    let b: f32 = dot(t1, h2) / gl;
    let d: f32 = dot(t2, h2) / gl;
    let m: f32 = 0.5 * (a + d);
    let r: f32 = sqrt(0.25 * (a - d) * (a - d) + b * b);
    let k1: f32 = m + r;
    let k2: f32 = m - r;
    var kmax: f32 = k2;
    if (abs(k1) >= abs(k2)) { kmax = k1; }
    var ex2: f32 = b;
    var ey2: f32 = kmax - a;
    if (abs(kmax - d) > abs(kmax - a)) {
        ex2 = kmax - d;
        ey2 = b;
    }
    let el: f32 = sqrt(ex2 * ex2 + ey2 * ey2);
    var umb: f32 = 0.0;
    if (r < U.a.z * max(max(abs(k1), abs(k2)), 0.05) || el < 1.0e-12) { umb = 1.0; }
    var dir: vec3f = t1;
    if (el > 0.0) { dir = normalize(t1 * (ex2 / el) + t2 * (ey2 / el)); }
    if (umb > 0.5) {
        let up: vec3f = vec3f(0.0, 1.0, 0.0) - n * n.y;
        dir = t1;
        if (length(up) > 1.0e-6) { dir = normalize(up); }
    }
    *nout = n;
    *other = cross(n, dir);
    return umb;
}
fn line_cov(s: f32, freq: f32, half_w: f32, px: f32) -> f32 {
    let u: f32 = s * freq;
    let fr: f32 = u - floor(u);
    let dist: f32 = min(fr, 1.0 - fr) / freq;
    return clamp((half_w - dist) / px + 0.5, 0.0, 1.0) * min(1.0, (2.0 * half_w) / px);
}
fn hatch_lines(s: f32, freq: f32, px: f32, half_w: f32) -> f32 {
    let lev: f32 = max(0.0, log2((px * freq) / 0.25));
    let l0: f32 = floor(lev);
    let t: f32 = lev - l0;
    let f0: f32 = freq / exp2(l0);
    return line_cov(s, f0, half_w, px) * (1.0 - t) + line_cov(s, f0 / 2.0, half_w, px) * t;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let x: f32 = f32(i % U.width);
    let y: f32 = f32(i / U.width);
    let wf: f32 = f32(U.width);
    let hf: f32 = f32(U.height);
    let eye: vec3f = vec3f(3.2, 2.3, 3.7);
    let fwd: vec3f = normalize(vec3f(0.25, 0.5, -0.15) - eye);
    let right: vec3f = normalize(vec3f(-fwd.z, 0.0, fwd.x));
    let up: vec3f = cross(right, fwd);
    let sx: f32 = ((x + 0.5) / wf - 0.5) * 2.0 * (wf / hf) * 0.42;
    let sy: f32 = (0.5 - (y + 0.5) / hf) * 2.0 * 0.42;
    let rd: vec3f = normalize(fwd + right * sx + up * sy);
    var t: f32 = 0.0;
    var hit: f32 = -1.0;
    for (var it: i32 = 0; it < 160; it++) {
        let d: f32 = still_sdf(eye + rd * t);
        if (d < 1.0e-4 * (1.0 + t)) {
            hit = t;
            break;
        }
        t += d;
        if (t > 30.0) { break; }
    }
    var col: vec3f = U.paper.xyz;
    if (hit > 0.0) {
        let q: vec3f = eye + rd * hit;
        var cn: vec3f = vec3f(0.0);
        var co: vec3f = vec3f(0.0);
        let umb: f32 = curvature(q, &cn, &co);
        let tone: f32 = 0.12 + 0.88 * max(0.0, dot(cn, normalize(vec3f(-0.5, 0.8, 0.45))));
        let px: f32 = (hit * 2.0 * 0.42) / hf;
        let half_w: f32 = 0.5 * U.a.y * px;
        let dark: f32 = 1.0 - tone;
        let second: f32 = dot(q, vec3f(0.6246950475544243, 0.4685212856658182, -0.6246950475544243));
        var s1: f32 = dot(q, co);
        var s2: f32 = second;
        if (umb > 0.5 && abs(cn.y) > 0.95) {
            s1 = dot(q, vec3f(0.9578262852211514, 0.0, 0.28734788556634544));
            s2 = dot(q, vec3f(-0.28734788556634544, 0.0, 0.9578262852211514));
        } else if (umb > 0.5) {
            s1 = q.y;
        }
        var ink: f32 = hatch_lines(s1, U.a.x, px, half_w * (0.4 + 1.6 * dark));
        if (U.layers > 1u && tone < 0.5) { ink = 1.0 - (1.0 - ink) * (1.0 - hatch_lines(s2, U.a.x, px, half_w * (0.4 + 2.0 * (0.5 - tone)))); }
        if (U.a.w > 0.0) {
            let nv: f32 = abs(dot(cn, rd));
            if (nv < U.a.w) { ink = max(ink, min(1.0, (U.a.w - nv) / (0.5 * U.a.w))); }
        }
        col = U.paper.xyz * (1.0 - ink) + U.ink.xyz * ink;
    }
    out8[i] = pack_rgb8(col);
}

//@pass style_hysteresis
// Hysteresis quantisation (raw/renderer/style_quantise.hpp), one dispatch a frame. pal: palette
// OKLab (palette mode); img: scene-linear RGBA; motion: (mx, my, expected previous distance, this
// frame's distance); prev and next: the state, (decision, persistence count, distance, 0), the
// previous frame's read and this frame's written. Writes the sRGB RGBA8 word a pixel.
@group(0) @binding(0) var<uniform> U: HystParams;
@group(0) @binding(1) var<storage, read> pal: array<vec4f>;
@group(0) @binding(2) var<storage, read> img: array<vec4f>;
@group(0) @binding(3) var<storage, read> motion: array<vec4f>;
@group(0) @binding(4) var<storage, read> prev: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> next: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> out8: array<u32>;

fn cbrt_p(x: f32) -> f32 {
    return select(0.0, pow(x, 1.0 / 3.0), x > 0.0);
}
fn shoulder(v: f32) -> f32 {
    return 1.0 - exp(-max(0.0, v) * U.a.z);
}
fn to_oklab(c: vec3f) -> vec3f {
    let l: f32 = cbrt_p(0.4122214708 * c.x + 0.5363325363 * c.y + 0.0514459929 * c.z);
    let m: f32 = cbrt_p(0.2119034982 * c.x + 0.6806995451 * c.y + 0.1073969566 * c.z);
    let s: f32 = cbrt_p(0.0883024619 * c.x + 0.2817188376 * c.y + 0.6299787005 * c.z);
    return vec3f(0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s);
}
fn from_oklab(q: vec3f) -> vec3f {
    let l0: f32 = q.x + 0.3963377774 * q.y + 0.2158037573 * q.z;
    let m0: f32 = q.x - 0.1055613458 * q.y - 0.0638541728 * q.z;
    let s0: f32 = q.x - 0.0894841775 * q.y - 1.291485548 * q.z;
    let l: f32 = l0 * l0 * l0;
    let m: f32 = m0 * m0 * m0;
    let s: f32 = s0 * s0 * s0;
    return vec3f(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
}
fn plain_decision(lab: vec3f) -> i32 {
    if (U.mode == 0u) { return i32(clamp(floor(lab.x * U.a.x + 0.5), 0.0, U.a.x)); }
    var best: i32 = 0;
    var bd: f32 = 1.0e30;
    for (var k: u32 = 0u; k < U.palSize; k++) {
        let d: f32 = length(lab - pal[k].xyz);
        if (d < bd) {
            bd = d;
            best = i32(k);
        }
    }
    return best;
}
fn keep(lab: vec3f, p: i32, pl: i32) -> bool {
    if (U.mode == 0u) {
        let x: f32 = lab.x * U.a.x;
        return x >= f32(p) - 0.5 - U.a.y && x <= f32(p) + 0.5 + U.a.y;
    }
    return length(lab - pal[u32(p)].xyz) <= length(lab - pal[u32(pl)].xyz) + U.a.y;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let w: i32 = i32(U.width);
    let h: i32 = i32(U.height);
    let x: i32 = i32(i % U.width);
    let y: i32 = i32(i / U.width);
    let c: vec3f = img[i].xyz;
    let lab: vec3f = to_oklab(vec3f(shoulder(c.x), shoulder(c.y), shoulder(c.z)));
    let pl: i32 = plain_decision(lab);
    var d: i32 = pl;
    var cnt: f32 = 0.0;
    let mo: vec4f = motion[i];
    if (U.on > 0u && U.hasState > 0u) {
        var mx: f32 = 0.0;
        var my: f32 = 0.0;
        if (U.hasMotion > 0u) {
            mx = mo.x;
            my = mo.y;
        }
        let px: i32 = i32(floor(f32(x) + 0.5 - mx));
        let py: i32 = i32(floor(f32(y) + 0.5 - my));
        if (px >= 0 && py >= 0 && px < w && py < h) {
            let s: vec4f = prev[u32(py * w + px)];
            let expect: f32 = mo.z;
            if (abs(s.z - expect) <= U.a.w * expect) {
                let pv: i32 = i32(floor(s.x + 0.5));
                if (pv != pl && keep(lab, pv, pl)) {
                    let cc: f32 = s.y + 1.0;
                    if (cc < U.b.x) {
                        d = pv;
                        cnt = cc;
                    }
                }
            }
        }
    }
    next[i] = vec4f(f32(d), cnt, mo.w, 0.0);
    var rgb: vec3f = vec3f(0.0);
    if (U.mode == 0u) {
        let Lq: f32 = f32(d) / U.a.x;
        var sc: f32 = 0.0;
        if (lab.x > 1.0e-9) { sc = Lq / lab.x; }
        rgb = from_oklab(vec3f(Lq, lab.y * sc, lab.z * sc));
    } else {
        rgb = from_oklab(pal[u32(d)].xyz);
    }
    out8[i] = pack_rgb8(rgb);
}

//@pass style_palettelight
// Palette-locked lighting (raw/renderer/style_quantise.hpp). gb: four vec4f a pixel: (hit, class,
// detail, pool phase), (P, vis moon), (N, vis lamp), (vis window, 0, 0, 0). tbl: palette indices,
// (class * 2 + variant) * K + step for the four lit classes, then the void ramp, three window
// entries, two lamp entries, the night entry. ent: RGBA8 of every entry. Writes an index and RGBA8.
@group(0) @binding(0) var<uniform> U: PalettelightParams;
@group(0) @binding(1) var<storage, read> gb: array<vec4f>;
@group(0) @binding(2) var<storage, read> tbl: array<u32>;
@group(0) @binding(3) var<storage, read> ent: array<u32>;
@group(0) @binding(4) var<storage, read_write> outIdx: array<u32>;
@group(0) @binding(5) var<storage, read_write> out8: array<u32>;

fn bayer8(x0: i32, y0: i32) -> u32 {
    let x: u32 = u32(x0 & 7);
    let y: u32 = u32(y0 & 7);
    let v: u32 = x ^ y;
    return ((v & 1u) << 5u) | ((y & 1u) << 4u) | (((v >> 1u) & 1u) << 3u) | (((y >> 1u) & 1u) << 2u) | (((v >> 2u) & 1u) << 1u) | ((y >> 2u) & 1u);
}
fn thr(x: i32, y: i32) -> f32 {
    return (f32(bayer8(x, y)) + 0.5) / 64.0;
}
fn radial(la: vec4f, lb: vec4f, p: vec3f, n: vec3f, vis: f32) -> f32 {
    let v: vec3f = p - la.xyz;
    let r2: f32 = dot(v, v);
    let q: f32 = r2 / (la.w * la.w);
    if (q >= 1.0) { return 0.0; }
    let m: f32 = (lb.y * (1.0 - q) * (1.0 - q)) / (1.0 + r2 / (lb.x * lb.x));
    let tov: vec3f = la.xyz - p;
    let l: f32 = length(tov);
    var term: f32 = 1.0;
    if (l >= 1.0e-6) { term = sat1((dot(n, tov) / l + lb.z) / (1.0 + lb.z)); }
    return vis * m * term;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let ix: i32 = i32(i % U.width);
    let iy: i32 = i32(i / U.width);
    let b: u32 = i * 4u;
    let v0: vec4f = gb[b];
    let v1: vec4f = gb[b + 1u];
    let v2: vec4f = gb[b + 2u];
    let v3: vec4f = gb[b + 3u];
    let K: u32 = U.steps;
    let vs: u32 = U.voidSteps;
    var idx: u32 = tbl[8u * K + vs + 5u];
    let T1: f32 = thr(ix, iy);
    let T2: f32 = thr(ix + 11, iy + 7);
    let time: f32 = U.b.x;
    if (v0.x > 0.5) {
        let cls: u32 = u32(v0.y + 0.5);
        let voidBase: u32 = 8u * K;
        let winBase: u32 = voidBase + vs;
        let lampBase: u32 = winBase + 3u;
        if (cls == 4u) {
            let pos0: f32 = v0.w * f32(vs) + time * U.a.w * f32(vs);
            let pos: f32 = pos0 - floor(pos0 / f32(vs)) * f32(vs);
            let lo: u32 = u32(floor(pos));
            let f: f32 = pos - floor(pos);
            var st: u32 = lo;
            if (f > T1) { st = lo + 1u; }
            idx = tbl[voidBase + (st % vs)];
        } else if (cls == 5u) {
            let s: f32 = 1.4 + 0.6 * sin(time * 5.0 + v1.x * 3.0) + 0.4 * (v0.z - 0.5);
            let tone: f32 = clamp(s, 0.0, 2.0);
            let lo: u32 = min(1u, u32(floor(tone)));
            var st: u32 = lo;
            if (tone - f32(lo) > T1) { st = lo + 1u; }
            idx = tbl[winBase + st];
        } else if (cls == 6u) {
            var st: u32 = 0u;
            if (0.5 + 0.2 * sin(time * 7.0) > T1) { st = 1u; }
            idx = tbl[lampBase + st];
        } else {
            let p: vec3f = v1.xyz;
            let n: vec3f = v2.xyz;
            let nl: f32 = max(0.0, dot(n, U.b.yzw));
            let cool: f32 = U.a.y * (0.7 + 0.3 * (0.5 + 0.5 * n.y)) + U.a.z * nl * v1.w;
            let warm: f32 = radial(U.lampA, U.lampB, p, n, v2.w) + radial(U.g0a, U.g0b, p, n, v3.x) + radial(U.g1a, U.g1b, p, n, v3.x);
            let E: f32 = cool + warm;
            let tone: f32 = 1.0 - exp(-U.a.x * E * v0.z);
            let s: f32 = min(f32(K - 1u), max(0.0, tone * f32(K - 1u)));
            var wf: f32 = 0.0;
            if (E > 1.0e-9) { wf = warm / E; }
            let lo: u32 = min(K - 2u, u32(floor(s)));
            var st: u32 = lo;
            if (s - f32(lo) > T1) { st = lo + 1u; }
            var variant: u32 = 0u;
            if (wf >= 0.7) {
                variant = 1u;
            } else if (wf > 0.3) {
                if ((wf - 0.3) / 0.4 > T2) { variant = 1u; }
            }
            idx = tbl[(cls * 2u + variant) * K + st];
        }
    }
    outIdx[i] = idx;
    out8[i] = ent[idx];
}

//@pass style_dither
// Palette quantisation and dither (raw/renderer/style_dither.hpp) in double-single arithmetic: a
// value is a vec2f (hi, lo), and the error-free transforms (Knuth two-sum, Dekker split and
// two-product) are written without fma, so the decisions can equal the float64 reference's.
// K: the constants as (hi, lo) pairs: the sRGB byte to linear table (256), the two OKLab matrices
// (9 each), epsilon, the pair penalty, the three IGN constants, brightness, strength. pal: the
// palette's OKLab as pairs, 3 an entry; palrgb: its RGBA8. bn: blue-noise ranks. src: the RGBA8
// plate. Writes a palette index and the entry's RGBA8 a pixel.
@group(0) @binding(0) var<uniform> U: DitherGpuParams;
@group(0) @binding(1) var<storage, read> K: array<vec2f>;
@group(0) @binding(2) var<storage, read> pal: array<vec2f>;
@group(0) @binding(3) var<storage, read> palrgb: array<u32>;
@group(0) @binding(4) var<storage, read> bn: array<u32>;
@group(0) @binding(5) var<storage, read> src: array<u32>;
@group(0) @binding(6) var<storage, read_write> idx: array<u32>;
@group(0) @binding(7) var<storage, read_write> out8: array<u32>;

fn two_sum(a: f32, b: f32) -> vec2f {
    let s: f32 = a + b;
    let bb: f32 = s - a;
    return vec2f(s, (a - (s - bb)) + (b - bb));
}
fn quick_two_sum(a: f32, b: f32) -> vec2f {
    let s: f32 = a + b;
    return vec2f(s, b - (s - a));
}
fn split_f(a: f32) -> vec2f {
    let c: f32 = 4097.0 * a;
    let big: f32 = c - a;
    let hi: f32 = c - big;
    return vec2f(hi, a - hi);
}
fn two_prod(a: f32, b: f32) -> vec2f {
    let p: f32 = a * b;
    let sa: vec2f = split_f(a);
    let sb: vec2f = split_f(b);
    let e: f32 = ((sa.x * sb.x - p) + sa.x * sb.y + sa.y * sb.x) + sa.y * sb.y;
    return vec2f(p, e);
}
fn ds(a: f32) -> vec2f {
    return vec2f(a, 0.0);
}
fn ds_add(a: vec2f, b: vec2f) -> vec2f {
    var s: vec2f = two_sum(a.x, b.x);
    let t: vec2f = two_sum(a.y, b.y);
    s.y = s.y + t.x;
    s = quick_two_sum(s.x, s.y);
    s.y = s.y + t.y;
    return quick_two_sum(s.x, s.y);
}
fn ds_sub(a: vec2f, b: vec2f) -> vec2f {
    return ds_add(a, -b);
}
fn ds_mul(a: vec2f, b: vec2f) -> vec2f {
    var p: vec2f = two_prod(a.x, b.x);
    p.y = p.y + (a.x * b.y + a.y * b.x);
    return quick_two_sum(p.x, p.y);
}
fn ds_div(a: vec2f, b: vec2f) -> vec2f {
    let q1: f32 = a.x / b.x;
    var r: vec2f = ds_sub(a, ds_mul(b, ds(q1)));
    let q2: f32 = r.x / b.x;
    r = ds_sub(r, ds_mul(b, ds(q2)));
    let q3: f32 = r.x / b.x;
    return ds_add(quick_two_sum(q1, q2), ds(q3));
}
fn ds_lt(a: vec2f, b: vec2f) -> bool {
    return a.x < b.x || (a.x == b.x && a.y < b.y);
}
fn ds_gt(a: vec2f, b: vec2f) -> bool {
    return ds_lt(b, a);
}
fn ds_le(a: vec2f, b: vec2f) -> bool {
    return !ds_lt(b, a);
}
fn ds_abs(a: vec2f) -> vec2f {
    if (a.x < 0.0 || (a.x == 0.0 && a.y < 0.0)) { return -a; }
    return a;
}
fn ds_min(a: vec2f, b: vec2f) -> vec2f {
    if (ds_lt(b, a)) { return b; }
    return a;
}
fn ds_clamp01(a: vec2f) -> vec2f {
    if (ds_lt(a, ds(0.0))) { return ds(0.0); }
    if (ds_gt(a, ds(1.0))) { return ds(1.0); }
    return a;
}
fn ds_floor(a: vec2f) -> vec2f {
    let f: f32 = floor(a.x);
    if (f == a.x) { return quick_two_sum(f, floor(a.y)); }
    return ds(f);
}
// Cube root: an f32 estimate, then one Newton step in double-single.
fn ds_cbrt(x: vec2f) -> vec2f {
    if (x.x == 0.0) { return ds(0.0); }
    let y0: f32 = sign(x.x) * pow(abs(x.x), 1.0 / 3.0);
    let yy: vec2f = ds_mul(ds(y0), ds(y0));
    let y3: vec2f = ds_mul(yy, ds(y0));
    return ds_add(ds(y0), ds_div(ds_sub(x, y3), ds_mul(ds(3.0), yy)));
}
fn palc(i: u32, c: u32) -> vec2f {
    return pal[3u * i + c];
}
fn mat3ds(m: u32, x: vec2f, y: vec2f, z: vec2f, row: u32) -> vec2f {
    return ds_add(ds_add(ds_mul(K[m + 3u * row], x), ds_mul(K[m + 3u * row + 1u], y)), ds_mul(K[m + 3u * row + 2u], z));
}
fn lab3(r: vec2f, g: vec2f, b: vec2f, L: ptr<function, vec2f>, A: ptr<function, vec2f>, B: ptr<function, vec2f>) {
    let l: vec2f = ds_cbrt(mat3ds(256u, r, g, b, 0u));
    let m: vec2f = ds_cbrt(mat3ds(256u, r, g, b, 1u));
    let s: vec2f = ds_cbrt(mat3ds(256u, r, g, b, 2u));
    *L = mat3ds(265u, l, m, s, 0u);
    *A = mat3ds(265u, l, m, s, 1u);
    *B = mat3ds(265u, l, m, s, 2u);
}
fn dist2(L: vec2f, a: vec2f, b: vec2f, i: u32) -> vec2f {
    let dL: vec2f = ds_sub(L, palc(i, 0u));
    let da: vec2f = ds_sub(a, palc(i, 1u));
    let db: vec2f = ds_sub(b, palc(i, 2u));
    return ds_add(ds_add(ds_mul(dL, dL), ds_mul(da, da)), ds_mul(db, db));
}
fn nearest(L: vec2f, a: vec2f, b: vec2f) -> u32 {
    var best: u32 = 0u;
    var bestD: vec2f = dist2(L, a, b, 0u);
    for (var i: u32 = 1u; i < U.n; i++) {
        let d: vec2f = dist2(L, a, b, i);
        if (ds_lt(d, bestD)) {
            bestD = d;
            best = i;
        }
    }
    return best;
}
fn far_side(L: vec2f, a: vec2f, b: vec2f, i: u32) -> i32 {
    let dL: vec2f = ds_sub(L, palc(i, 0u));
    let da: vec2f = ds_sub(a, palc(i, 1u));
    let db: vec2f = ds_sub(b, palc(i, 2u));
    let d2: vec2f = ds_add(ds_add(ds_mul(dL, dL), ds_mul(da, da)), ds_mul(db, db));
    var best: i32 = -1;
    var bestS: vec2f = vec2f(0.0);
    var have: bool = false;
    for (var j: u32 = 0u; j < U.n; j++) {
        if (j == i) { continue; }
        let sL: vec2f = ds_sub(palc(j, 0u), palc(i, 0u));
        let sa: vec2f = ds_sub(palc(j, 1u), palc(i, 1u));
        let sb: vec2f = ds_sub(palc(j, 2u), palc(i, 2u));
        let len2: vec2f = ds_add(ds_add(ds_mul(sL, sL), ds_mul(sa, sa)), ds_mul(sb, sb));
        if (ds_lt(len2, K[274u])) { continue; }
        let u: vec2f = ds_div(ds_add(ds_add(ds_mul(dL, sL), ds_mul(da, sa)), ds_mul(db, sb)), len2);
        if (ds_le(u, ds(0.0))) { continue; }
        let uc: vec2f = ds_min(u, ds(1.0));
        let pen: vec2f = ds_mul(ds_mul(K[275u], len2), ds_add(ds_abs(ds_sub(uc, ds(0.5))), ds(0.5)));
        let score: vec2f = ds_add(ds_sub(d2, ds_mul(ds_mul(uc, uc), len2)), pen);
        if (!have || ds_lt(score, bestS)) {
            bestS = score;
            best = i32(j);
            have = true;
        }
    }
    return best;
}
fn bayer_rank(x: u32, y: u32, n: u32) -> u32 {
    if (n == 2u) { return (((x ^ y) & 1u) << 1u) | (y & 1u); }
    if (n == 4u) {
        let z: u32 = (x ^ y) & 3u;
        return ((z & 1u) << 3u) | ((y & 1u) << 2u) | (z & 2u) | ((y & 2u) >> 1u);
    }
    let xx: u32 = x & 7u;
    let yy: u32 = y & 7u;
    let v: u32 = xx ^ yy;
    return ((v & 1u) << 5u) | ((yy & 1u) << 4u) | ((v & 2u) << 2u) | ((yy & 2u) << 1u) | ((v & 4u) >> 1u) | ((yy & 4u) >> 2u);
}
// The threshold of a pixel: mode 1, 2, 3 Bayer 2, 4, 8; 4 IGN; 5 blue noise.
fn threshold(x: u32, y: u32, mode: u32) -> vec2f {
    if (mode == 1u) { return ds((f32(bayer_rank(x, y, 2u)) + 0.5) / 4.0); }
    if (mode == 2u) { return ds((f32(bayer_rank(x, y, 4u)) + 0.5) / 16.0); }
    if (mode == 3u) { return ds((f32(bayer_rank(x, y, 8u)) + 0.5) / 64.0); }
    if (mode == 4u) {
        let f: vec2f = ds_add(ds_mul(K[276u], ds(f32(x))), ds_mul(K[277u], ds(f32(y))));
        let v: vec2f = ds_mul(K[278u], ds_sub(f, ds_floor(f)));
        return ds_sub(v, ds_floor(v));
    }
    return ds((f32(bn[(y % 64u) * 64u + x % 64u]) + 0.5) / 4096.0);
}
fn pal_lin(k: u32, c: u32) -> vec2f {
    return K[(palrgb[k] >> (8u * c)) & 255u];
}
fn before(a: u32, b: u32) -> bool {
    let La: vec2f = palc(a, 0u);
    let Lb: vec2f = palc(b, 0u);
    if (ds_lt(La, Lb)) { return true; }
    if (ds_lt(Lb, La)) { return false; }
    return a < b;
}
fn mix_pick(r: vec2f, g: vec2f, b: vec2f, th: vec2f) -> u32 {
    var plan: array<u32, 16>;
    var sr: vec2f = ds(0.0);
    var sg: vec2f = ds(0.0);
    var sb: vec2f = ds(0.0);
    var TL: vec2f = vec2f(0.0);
    var TA: vec2f = vec2f(0.0);
    var TB: vec2f = vec2f(0.0);
    var CL: vec2f = vec2f(0.0);
    var CA: vec2f = vec2f(0.0);
    var CB: vec2f = vec2f(0.0);
    for (var i: u32 = 0u; i < 16u; i++) {
        let w: vec2f = ds(f32(i + 1u));
        lab3(ds_mul(w, r), ds_mul(w, g), ds_mul(w, b), &TL, &TA, &TB);
        var k: u32 = 0u;
        var bd: vec2f = vec2f(0.0);
        var have: bool = false;
        for (var j: u32 = 0u; j < U.n; j++) {
            lab3(ds_add(sr, pal_lin(j, 0u)), ds_add(sg, pal_lin(j, 1u)), ds_add(sb, pal_lin(j, 2u)), &CL, &CA, &CB);
            let dL: vec2f = ds_sub(CL, TL);
            let dA: vec2f = ds_sub(CA, TA);
            let dB: vec2f = ds_sub(CB, TB);
            let d: vec2f = ds_add(ds_add(ds_mul(dL, dL), ds_mul(dA, dA)), ds_mul(dB, dB));
            if (!have || ds_lt(d, bd)) {
                bd = d;
                k = j;
                have = true;
            }
        }
        var q: u32 = i;
        for (var st: u32 = 0u; st < 16u; st++) {
            if (q == 0u || !before(k, plan[q - 1u])) { break; }
            plan[q] = plan[q - 1u];
            q = q - 1u;
        }
        plan[q] = k;
        sr = ds_add(sr, pal_lin(k, 0u));
        sg = ds_add(sg, pal_lin(k, 1u));
        sb = ds_add(sb, pal_lin(k, 2u));
    }
    let f: vec2f = ds_floor(ds_mul(th, ds(16.0)));
    let pi: i32 = min(15, i32(f.x) + i32(f.y));
    return plan[u32(max(pi, 0))];
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let p: u32 = gidx;
    if (p >= U.width * U.height) { return; }
    let x: u32 = p % U.width;
    let y: u32 = p / U.width;
    let mode: u32 = U.mode;
    let c: u32 = src[p];
    let r: vec2f = K[c & 255u];
    let g: vec2f = K[(c >> 8u) & 255u];
    let b: vec2f = K[(c >> 16u) & 255u];
    var L0: vec2f = vec2f(0.0);
    var A: vec2f = vec2f(0.0);
    var Bv: vec2f = vec2f(0.0);
    lab3(r, g, b, &L0, &A, &Bv);
    let L: vec2f = ds_clamp01(ds_add(L0, K[279u]));
    var i: u32 = nearest(L, A, Bv);
    let strength: vec2f = K[280u];
    if (mode >= 6u) {
        if (U.n >= 2u && ds_gt(strength, ds(0.0))) {
            var srcMode: u32 = 5u;
            if (mode == 6u) { srcMode = 2u; }
            if (mode == 7u) { srcMode = 3u; }
            let th: vec2f = ds_add(ds(0.5), ds_mul(ds_sub(threshold(x, y, srcMode), ds(0.5)), strength));
            i = mix_pick(r, g, b, th);
        }
        idx[p] = i;
        out8[p] = palrgb[i];
        return;
    }
    if (mode != 0u && U.n >= 2u && ds_gt(strength, ds(0.0))) {
        let j: i32 = far_side(L, A, Bv, i);
        if (j >= 0) {
            let ju: u32 = u32(j);
            let sL: vec2f = ds_sub(palc(ju, 0u), palc(i, 0u));
            let sa: vec2f = ds_sub(palc(ju, 1u), palc(i, 1u));
            let sb: vec2f = ds_sub(palc(ju, 2u), palc(i, 2u));
            let len2: vec2f = ds_add(ds_add(ds_mul(sL, sL), ds_mul(sa, sa)), ds_mul(sb, sb));
            if (!ds_lt(len2, K[274u])) {
                let num: vec2f = ds_add(ds_add(ds_mul(ds_sub(L, palc(i, 0u)), sL), ds_mul(ds_sub(A, palc(i, 1u)), sa)), ds_mul(ds_sub(Bv, palc(i, 2u)), sb));
                let f: vec2f = ds_clamp01(ds_div(num, len2));
                let th: vec2f = ds_add(ds(0.5), ds_mul(ds_sub(threshold(x, y, mode), ds(0.5)), strength));
                if (ds_gt(f, th)) { i = ju; }
            }
        }
    }
    idx[p] = i;
    out8[p] = palrgb[i];
}

