//@pass style_adj_prep
// Development adjacency (raw/renderer/style_adjacency.hpp), first pass: the developable fraction
// a_k of each layer from the exposure, and D = 0.
@group(0) @binding(0) var<uniform> U: AdjParams;
@group(0) @binding(1) var<storage, read> scene: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> A: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> D: array<vec4f>;

fn developable(H: f32) -> f32 {
    if (H <= 0.0) { return 0.0; }
    let q: f32 = pow(U.c.z / H, U.c.y);
    return 1.0 / (1.0 + q);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let c: vec3f = scene[i].xyz * U.c.w;
    A[i] = vec4f(developable(c.x), developable(c.y), developable(c.z), 0.0);
    D[i] = vec4f(0.0);
}

//@pass style_adj_develop
// One Euler step of development at full resolution, reading the developer and bromide fields F
// (coarse, bilinear). D.w receives the step's development summed over the layers.
@group(0) @binding(0) var<uniform> U: AdjParams;
@group(0) @binding(1) var<storage, read> A: array<vec4f>;
@group(0) @binding(2) var<storage, read> F: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> D: array<vec4f>;

fn coarse_at(x: i32, y: i32) -> vec2f {
    let s: f32 = f32(U.s);
    let cw: i32 = i32(U.cw);
    let ch: i32 = i32(U.ch);
    let u: f32 = (f32(x) + 0.5) / s - 0.5;
    let v: f32 = (f32(y) + 0.5) / s - 0.5;
    let x0: i32 = clamp(i32(floor(u)), 0, cw - 1);
    let y0: i32 = clamp(i32(floor(v)), 0, ch - 1);
    let x1: i32 = min(cw - 1, x0 + 1);
    let y1: i32 = min(ch - 1, y0 + 1);
    let fx: f32 = clamp(u - f32(x0), 0.0, 1.0);
    let fy: f32 = clamp(v - f32(y0), 0.0, 1.0);
    let a: vec2f = F[u32(y0 * cw + x0)].xy;
    let b: vec2f = F[u32(y0 * cw + x1)].xy;
    let c: vec2f = F[u32(y1 * cw + x0)].xy;
    let d: vec2f = F[u32(y1 * cw + x1)].xy;
    return (a * (1.0 - fx) + b * fx) * (1.0 - fy) + (c * (1.0 - fx) + d * fx) * fy;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let x: i32 = i32(i % U.width);
    let y: i32 = i32(i / U.width);
    let cb: vec2f = coarse_at(x, y);
    let rate: f32 = (U.a.w * cb.x) / (1.0 + U.b.z * cb.y);
    var d: vec4f = D[i];
    let a: vec4f = A[i];
    let dt: f32 = U.a.z;
    let dr: f32 = rate * (a.x - d.x) * dt;
    d.x = d.x + dr;
    let dg: f32 = rate * (a.y - d.y) * dt;
    d.y = d.y + dg;
    let db: f32 = rate * (a.z - d.z) * dt;
    d.z = d.z + db;
    d.w = dr + dg + db;
    D[i] = d;
}

//@pass style_adj_chem
// One Euler step of the chemistry on the coarse grid: diffusion with reflecting borders, use by
// development, replenishment by the bath. Reads F, writes G.
@group(0) @binding(0) var<uniform> U: AdjParams;
@group(0) @binding(1) var<storage, read> D: array<vec4f>;
@group(0) @binding(2) var<storage, read> F: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> G: array<vec4f>;

fn at(i: i32, j: i32) -> vec2f {
    let cw: i32 = i32(U.cw);
    let ch: i32 = i32(U.ch);
    return F[u32(clamp(j, 0, ch - 1) * cw + clamp(i, 0, cw - 1))].xy;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    if (gidx >= U.cw * U.ch) { return; }
    let i: i32 = i32(gidx % U.cw);
    let j: i32 = i32(gidx / U.cw);
    let w: i32 = i32(U.width);
    let h: i32 = i32(U.height);
    let s: i32 = i32(U.s);
    var used: f32 = 0.0;
    var cnt: f32 = 0.0;
    for (var yy: i32 = j * s; yy < min(h, j * s + s); yy++) {
        for (var xx: i32 = i * s; xx < min(w, i * s + s); xx++) {
            used = used + D[u32(yy * w + xx)].w;
            cnt = cnt + 1.0;
        }
    }
    used = used / cnt;
    let f0: vec2f = at(i, j);
    let dt: f32 = U.a.z;
    let l: vec2f = at(i - 1, j) + at(i + 1, j) + at(i, j - 1) + at(i, j + 1) - 4.0 * f0;
    let c: f32 = f0.x + U.a.x * l.x * dt - U.b.x * used + U.b.y * (1.0 - f0.x) * dt;
    let b: f32 = f0.y + U.a.y * l.y * dt + U.b.w * used - U.c.x * f0.y * dt;
    G[gidx] = vec4f(c, b, 0.0, 0.0);
}

//@pass style_adj_out
// The output: scene colour times (D + eps) / (A (1 - decay) + eps), lab-encoded to RGBA8.
@group(0) @binding(0) var<uniform> U: AdjParams;
@group(0) @binding(1) var<storage, read> scene: array<vec4f>;
@group(0) @binding(2) var<storage, read> A: array<vec4f>;
@group(0) @binding(3) var<storage, read> D: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> out8: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let free: f32 = 1.0 - U.d.x;
    let eps: f32 = 1.0e-6;
    let o: vec3f = scene[i].xyz * ((D[i].xyz + vec3f(eps)) / (A[i].xyz * free + vec3f(eps)));
    out8[i] = lab_pack(o, U.d.y);
}

//@pass style_crt_phosphor
// crt-classic (raw/renderer/style_crt_classic.hpp), first pass: beam scanlines and the phosphor
// mask in 8.8 fixed point, with the reference's own tables.
@group(0) @binding(0) var<uniform> U: ClassicParams;
@group(0) @binding(1) var<storage, read> beam: array<i32>;
@group(0) @binding(2) var<storage, read> mt: array<i32>;
@group(0) @binding(3) var<storage, read> src: array<u32>;
@group(0) @binding(4) var<storage, read_write> dst: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let v: u32 = src[i];
    if (U.phosphor == 0u) {
        dst[i] = v;
        return;
    }
    let x: i32 = i32(i % U.width);
    let y: i32 = i32(i / U.width);
    let cell: i32 = i32(U.cell);
    let row: i32 = y % cell;
    let ry: i32 = (y % 6) * 3;
    var flatf: i32 = 0;
    if (U.flat_cell != 0u) {
        flatf = select(i32(U.flat_odd), i32(U.flat_even), (y & 1) == 0);
    }
    let r: i32 = ch8(v, 0u);
    let g: i32 = ch8(v, 1u);
    let b: i32 = ch8(v, 2u);
    let p: u32 = u32((ry + x % 3) * 3);
    let k: i32 = max(max(r, g), b) >> 4u;
    var f: i32 = beam[u32(k * cell + row)];
    if (flatf > 0) { f = flatf; }
    dst[i] = pack8((r * f * mt[p] + 32768) >> 16u, (g * f * mt[p + 1u] + 32768) >> 16u, (b * f * mt[p + 2u] + 32768) >> 16u);
}

//@pass style_crt_down
// crt-classic: box-downsample into linear light at 1/q (f32 sums in the reference's order), then
// the thresholded bright field.
@group(0) @binding(0) var<uniform> U: ClassicParams;
@group(0) @binding(1) var<storage, read> toLin: array<f32>;
@group(0) @binding(2) var<storage, read> src: array<u32>;
@group(0) @binding(3) var<storage, read_write> lin: array<f32>;
@group(0) @binding(4) var<storage, read_write> bright: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.lw * U.lh) { return; }
    let lx: i32 = i32(i % U.lw);
    let ly: i32 = i32(i / U.lw);
    let q: i32 = i32(U.q);
    let w: i32 = i32(U.width);
    let h: i32 = i32(U.height);
    var s: vec3f = vec3f(0.0);
    for (var y: i32 = ly * q; y < min(h, ly * q + q); y++) {
        for (var x: i32 = lx * q; x < min(w, lx * q + q); x++) {
            let v: u32 = src[u32(y * w + x)];
            s = s + vec3f(toLin[u32(ch8(v, 0u))], toLin[u32(ch8(v, 1u))], toLin[u32(ch8(v, 2u))]);
        }
    }
    let n: f32 = 1.0 / f32(min(q, h - ly * q) * min(q, w - lx * q));
    let c: vec3f = s * n;
    let t: f32 = clamp((0.2126 * c.x + 0.7152 * c.y + 0.0722 * c.z - 0.18) / 0.3, 0.0, 1.0);
    let kk: f32 = t * t * (3.0 - 2.0 * t);
    let o: u32 = i * 3u;
    lin[o] = c.x;
    lin[o + 1u] = c.y;
    lin[o + 2u] = c.z;
    bright[o] = c.x * kk;
    bright[o + 1u] = c.y * kk;
    bright[o + 2u] = c.z * kk;
}

//@pass style_crt_box
// crt-classic: one box pass along x (dir 0) or y (dir 1) with clamped ends, as boxLine.
@group(0) @binding(0) var<uniform> U: ClassicParams;
@group(0) @binding(1) var<storage, read> a: array<f32>;
@group(0) @binding(2) var<storage, read_write> o: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.lw * U.lh) { return; }
    let lw: i32 = i32(U.lw);
    let lh: i32 = i32(U.lh);
    let x: i32 = i32(i % U.lw);
    let y: i32 = i32(i / U.lw);
    let r: i32 = i32(U.radius);
    let inv: f32 = 1.0 / f32(2 * r + 1);
    for (var c: i32 = 0; c < 3; c++) {
        var s: f32 = 0.0;
        for (var k: i32 = -r; k <= r; k++) {
            var xx: i32 = x;
            var yy: i32 = y;
            if (U.dir != 0u) { yy = clamp(y + k, 0, lh - 1); } else { xx = clamp(x + k, 0, lw - 1); }
            s = s + a[u32((yy * lw + xx) * 3 + c)];
        }
        o[u32((y * lw + x) * 3 + c)] = s * inv;
    }
}

//@pass style_crt_add
// crt-classic: glow = bright bloom 0.9 + lin halation 0.3, added back in linear light through a
// bilinear upsample.
@group(0) @binding(0) var<uniform> U: ClassicParams;
@group(0) @binding(1) var<storage, read> toLin: array<f32>;
@group(0) @binding(2) var<storage, read> toSrgb: array<u32>;
@group(0) @binding(3) var<storage, read> bl: array<f32>;
@group(0) @binding(4) var<storage, read> ha: array<f32>;
@group(0) @binding(5) var<storage, read> src: array<u32>;
@group(0) @binding(6) var<storage, read_write> dst: array<u32>;

fn glow(i: i32) -> vec3f {
    let o: u32 = u32(i * 3);
    var g: vec3f = vec3f(0.0);
    if (U.a.x > 0.0) { g = g + vec3f(bl[o], bl[o + 1u], bl[o + 2u]) * U.a.x * 0.9; }
    if (U.a.y > 0.0) { g = g + vec3f(ha[o], ha[o + 1u], ha[o + 2u]) * U.a.y * 0.3; }
    return g;
}
fn to_srgb(l: f32) -> i32 {
    if (l >= 1.0) { return i32(toSrgb[4096]); }
    if (l <= 0.0) { return i32(toSrgb[0]); }
    return i32(toSrgb[u32(l * 4096.0 + 0.5)]);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let v: u32 = src[i];
    if (U.a.x <= 0.0 && U.a.y <= 0.0) {
        dst[i] = v;
        return;
    }
    let x: i32 = i32(i % U.width);
    let y: i32 = i32(i / U.width);
    let q: f32 = f32(U.q);
    let lw: i32 = i32(U.lw);
    let lh: i32 = i32(U.lh);
    let fx: f32 = clamp((f32(x) + 0.5) / q - 0.5, 0.0, f32(lw - 1));
    let x0: i32 = i32(fx);
    let x1: i32 = min(lw - 1, x0 + 1);
    let tx: f32 = fx - f32(x0);
    let fy: f32 = clamp((f32(y) + 0.5) / q - 0.5, 0.0, f32(lh - 1));
    let y0: i32 = i32(fy);
    let y1: i32 = min(lh - 1, y0 + 1);
    let ty: f32 = fy - f32(y0);
    let g: vec3f = glow(y0 * lw + x0) * (1.0 - tx) * (1.0 - ty) + glow(y0 * lw + x1) * tx * (1.0 - ty) + glow(y1 * lw + x0) * (1.0 - tx) * ty + glow(y1 * lw + x1) * tx * ty;
    if (g.x + g.y + g.z < 0.0015) {
        dst[i] = v;
        return;
    }
    dst[i] = pack8(to_srgb(toLin[u32(ch8(v, 0u))] + g.x), to_srgb(toLin[u32(ch8(v, 1u))] + g.y), to_srgb(toLin[u32(ch8(v, 2u))] + g.z));
}

//@pass style_crt_tube
// crt-classic: barrel warp with bilinear 8.8 taps, a feathered rounded bezel, radial colour
// separation and the vignette.
@group(0) @binding(0) var<uniform> U: ClassicParams;
@group(0) @binding(1) var<storage, read> src: array<u32>;
@group(0) @binding(2) var<storage, read_write> dst: array<u32>;

fn tap(su: f32, sv: f32, c: u32) -> i32 {
    let w: i32 = i32(U.width);
    let h: i32 = i32(U.height);
    let sx: f32 = clamp((su + 1.0) * f32(w - 1) * 0.5, 0.0, f32(w - 1));
    let sy: f32 = clamp((sv + 1.0) * f32(h - 1) * 0.5, 0.0, f32(h - 1));
    let x0: i32 = i32(sx);
    let y0: i32 = i32(sy);
    let tx: i32 = i32((sx - f32(x0)) * 256.0);
    let ty: i32 = i32((sy - f32(y0)) * 256.0);
    let dx: i32 = select(0, 1, x0 + 1 < w);
    let dy: i32 = select(0, w, y0 + 1 < h);
    let p: i32 = y0 * w + x0;
    let top: i32 = ch8(src[u32(p)], c) * (256 - tx) + ch8(src[u32(p + dx)], c) * tx;
    let bot: i32 = ch8(src[u32(p + dy)], c) * (256 - tx) + ch8(src[u32(p + dy + dx)], c) * tx;
    return (top * (256 - ty) + bot * ty) >> 16u;
}
fn bezel_alpha(asu: f32, asv: f32, rc: f32, feather: f32) -> f32 {
    if (rc <= 0.0) { return select(0.0, 1.0, asu <= 1.0 && asv <= 1.0); }
    let qx: f32 = asu - (1.0 - rc);
    let qy: f32 = asv - (1.0 - rc);
    let d: f32 = length(vec2f(max(qx, 0.0), max(qy, 0.0))) + min(max(qx, qy), 0.0) - rc;
    return clamp(-d / feather, 0.0, 1.0);
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
    let curv: f32 = U.a.z;
    let ab: f32 = U.a.w;
    let vig: f32 = U.b.x;
    let W2: f32 = f32((w - 1) * (w - 1));
    let H2: f32 = f32((h - 1) * (h - 1));
    let nv: f32 = 1.0 / (W2 + H2);
    let u: f32 = (f32(x) / f32(w - 1)) * 2.0 - 1.0;
    let v: f32 = (f32(y) / f32(h - 1)) * 2.0 - 1.0;
    let VX: f32 = u * u * W2 * nv;
    let vy: f32 = v * v * H2 * nv;
    let vg: f32 = vig * 256.0;
    if (curv <= 0.0 && ab <= 0.0) {
        if (vig <= 0.0) {
            dst[i] = src[i];
            return;
        }
        let f: i32 = i32(256.0 - vg * (VX + vy));
        let s: u32 = src[i];
        dst[i] = pack8((ch8(s, 0u) * f) >> 8u, (ch8(s, 1u) * f) >> 8u, (ch8(s, 2u) * f) >> 8u);
        return;
    }
    let k: f32 = curv * 0.35;
    let dab: f32 = ab * 0.012;
    var rc: f32 = 0.0;
    if (curv > 0.0) { rc = 0.02 + 0.08 * min(1.0, curv); }
    let feather: f32 = 1.5 / (f32(w + h) / 4.0);
    let safe: f32 = 1.0 - rc - feather * 2.0;
    let fr: f32 = 1.0 - dab;
    let fb: f32 = 1.0 + dab;
    let ff: f32 = 1.0 + k * (u * u + v * v);
    let su: f32 = u * ff;
    let sv: f32 = v * ff;
    var alpha: f32 = 1.0;
    if (!(abs(su) <= safe && abs(sv) <= safe)) { alpha = bezel_alpha(abs(su), abs(sv), rc, feather); }
    if (alpha <= 0.0) {
        dst[i] = pack8(0, 0, 0);
        return;
    }
    let vf: i32 = i32(alpha * (256.0 - vg * (VX + vy)));
    dst[i] = pack8((tap(su * fr, sv * fr, 0u) * vf) >> 8u, (tap(su, sv, 1u) * vf) >> 8u, (tap(su * fb, sv * fb, 2u) * vf) >> 8u);
}

//@pass style_vhs_sample
// VHS (raw/renderer/style_vhs.hpp), pass 1, the transport: each line sampled at 4 fsc with its
// time-base displacement, as Y'IQ.
@group(0) @binding(0) var<uniform> U: VhsParams;
@group(0) @binding(1) var<storage, read> src: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> sm: array<vec4f>;

fn tracking_band(y: i32, f: f32) -> f32 {
    let nl: f32 = f32(U.lines);
    let c: f32 = ((f * 3.7) % (nl + 40.0)) - 20.0;
    let d: f32 = abs(f32(y) - c) / 6.0;
    return U.a.w * max(0.0, 1.0 - d * d);
}
fn line_shift(y: i32, f: u32) -> f32 {
    let s: u32 = U.seed;
    var d: f32 = U.a.x * (0.6 * sin(f32(y) * 0.031 + f32(f) * 0.7 + f32(s)) + 0.4 * gauss3(u32(y), f, 11u + s));
    let from_bottom: i32 = i32(U.lines) - 1 - y;
    let hs: f32 = U.a.y;
    if (f32(from_bottom) < hs) {
        let t: f32 = (hs - f32(from_bottom)) / hs;
        d = d + U.a.z * t * t;
    }
    if (U.a.w > 0.0) { d = d + tracking_band(y, f32(f)) * 12.0 * gauss3(u32(y), f, 23u + s); }
    return d;
}
fn held(y: i32, k: i32) -> vec3f {
    let n: i32 = i32(U.n);
    let kk: i32 = clamp(k, 0, n - 1);
    let sw: i32 = i32(U.src_w);
    let x: i32 = clamp(i32(floor((f32(kk) + 0.5) * f32(sw) / f32(n))), 0, sw - 1);
    let c: vec3f = src[u32(y * sw + x)].xyz;
    return vec3f(dot(U.yiq0.xyz, c), dot(U.yiq1.xyz, c), dot(U.yiq2.xyz, c));
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.n * U.lines) { return; }
    let k: i32 = i32(i % U.n);
    let y: i32 = i32(i / U.n);
    let kf: f32 = f32(k) - line_shift(y, U.frame);
    let k0: f32 = floor(kf);
    let t: f32 = kf - k0;
    sm[i] = vec4f(held(y, i32(k0)) * (1.0 - t) + held(y, i32(k0) + 1) * t, 0.0);
}

//@pass style_vhs_tape
// VHS, pass 2, the tape: luma through the FM channel (bandwidth, emphasis ringing, rising noise),
// chroma through colour-under (narrow bandwidth, delay, streaky noise, phase wobble).
@group(0) @binding(0) var<uniform> U: VhsParams;
@group(0) @binding(1) var<storage, read> taps: array<f32>;
@group(0) @binding(2) var<storage, read> sm: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> tp: array<vec4f>;

fn tracking_band(y: i32, f: f32) -> f32 {
    let nl: f32 = f32(U.lines);
    let c: f32 = ((f * 3.7) % (nl + 40.0)) - 20.0;
    let d: f32 = abs(f32(y) - c) / 6.0;
    return U.a.w * max(0.0, 1.0 - d * d);
}
fn at(y: i32, k: f32) -> vec3f {
    let n: i32 = i32(U.n);
    let kf: f32 = clamp(k, 0.0, f32(n - 1));
    let k0: i32 = i32(floor(kf));
    let t: f32 = kf - f32(k0);
    let k1: i32 = min(n - 1, k0 + 1);
    return sm[u32(y * n + k0)].xyz * (1.0 - t) + sm[u32(y * n + k1)].xyz * t;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.n * U.lines) { return; }
    let k: i32 = i32(i % U.n);
    let y: i32 = i32(i / U.n);
    let f: u32 = U.frame;
    let s: u32 = U.seed;
    let rot: f32 = U.c.x * gauss3(u32(y), f, 31u + s);
    let cr: f32 = cos(rot);
    let sr: f32 = sin(rot);
    let lh: i32 = i32(U.lh);
    let ph: i32 = i32(U.ph);
    let chh: i32 = i32(U.chh);
    let po: i32 = 2 * lh + 1;
    let co: i32 = po + 2 * ph + 1;
    var Y: f32 = 0.0;
    for (var j: i32 = -lh; j <= lh; j++) { Y = Y + taps[u32(j + lh)] * at(y, f32(k + j)).x; }
    var Yl: f32 = 0.0;
    for (var j2: i32 = -ph; j2 <= ph; j2++) { Yl = Yl + taps[u32(po + j2 + ph)] * at(y, f32(k + j2)).x; }
    let gk: u32 = u32(y) * 4096u + u32(k);
    let nz: f32 = U.b.x * (gauss3(gk, f, 41u + s) - 0.5 * (gauss3(gk - 1u, f, 41u + s) + gauss3(gk + 1u, f, 41u + s)));
    let Yo: f32 = Y + U.b.z * (Y - Yl) + nz;
    let kd: f32 = f32(k) - U.b.w;
    var I: f32 = 0.0;
    var Q: f32 = 0.0;
    for (var j3: i32 = -chh; j3 <= chh; j3++) {
        let v: vec3f = at(y, kd + f32(j3));
        I = I + taps[u32(co + j3 + chh)] * v.y;
        Q = Q + taps[u32(co + j3 + chh)] * v.z;
    }
    let m: f32 = f32(k) / 24.0;
    let m0: f32 = floor(m);
    let t: f32 = m - m0;
    let mu: u32 = u32(m0);
    let cn0: f32 = U.b.y * ((1.0 - t) * gauss3(u32(y), mu, 53u + s) + t * gauss3(u32(y), mu + 1u, 53u + s));
    let cn1: f32 = U.b.y * ((1.0 - t) * gauss3(u32(y), mu, 54u + s) + t * gauss3(u32(y), mu + 1u, 54u + s));
    var tn: f32 = 0.0;
    if (U.a.w > 0.0) { tn = tracking_band(y, f32(f)) * 0.5 * gauss3(gk, f, 61u + s); }
    tp[i] = vec4f(Yo + tn, I * cr - Q * sr + cn0, I * sr + Q * cr + cn1, 0.0);
}

//@pass style_vhs_play
// VHS, pass 3, playback: dropouts filled from the line above (the deck's compensator), then
// Y'IQ to R'G'B'. w is the dropout flag.
@group(0) @binding(0) var<uniform> U: VhsParams;
@group(0) @binding(1) var<storage, read> tp: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> sig: array<vec4f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.n * U.lines) { return; }
    let n: i32 = i32(U.n);
    let k: i32 = i32(i % U.n);
    let y: i32 = i32(i / U.n);
    let f: u32 = U.frame;
    let seg: u32 = u32(k / 64);
    let hit: bool = hash3(u32(y), seg, f * 131u + 71u) < U.c.y;
    let run: f32 = hash3(u32(y), seg, f * 131u + 73u) * 64.0;
    let dropped: bool = hit && f32(k - i32(seg) * 64) < run && y > 0;
    var yy: i32 = y;
    if (dropped) { yy = y - 1; }
    let c: vec3f = tp[u32(yy * n + k)].xyz;
    sig[i] = vec4f(dot(U.inv0.xyz, c), dot(U.inv1.xyz, c), dot(U.inv2.xyz, c), select(0.0, 1.0, dropped));
}

//@pass style_vhs_show
// VHS, display: the signal lines resampled to the output size (linear across, each line held
// down), clamped and rounded to RGBA8.
@group(0) @binding(0) var<uniform> U: VhsParams;
@group(0) @binding(1) var<storage, read> sig: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> out8: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.out_w * U.out_h) { return; }
    let w: i32 = i32(U.out_w);
    let h: i32 = i32(U.out_h);
    let x: i32 = i32(i % U.out_w);
    let y: i32 = i32(i / U.out_w);
    let n: i32 = i32(U.n);
    let nl: i32 = i32(U.lines);
    let ly: i32 = min(nl - 1, (y * nl) / h);
    let kf: f32 = (f32(x) + 0.5) * f32(n) / f32(w) - 0.5;
    let k0: i32 = clamp(i32(floor(kf)), 0, n - 1);
    let k1: i32 = min(n - 1, k0 + 1);
    let t: f32 = clamp(kf - f32(k0), 0.0, 1.0);
    let v: vec3f = clamp(sig[u32(ly * n + k0)].xyz * (1.0 - t) + sig[u32(ly * n + k1)].xyz * t, vec3f(0.0), vec3f(1.0));
    let q: vec3u = vec3u(floor(v * 255.0 + 0.5));
    out8[i] = q.x | (q.y << 8u) | (q.z << 16u) | (255u << 24u);
}

