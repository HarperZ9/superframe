//@pass style_sag_current
// Scan-causal EHT sag (raw/renderer/style_sag.hpp): the beam current of one line, one workgroup a
// line, summed by a tree in workgroup memory.
@group(0) @binding(0) var<uniform> U: SagGpuParams;
@group(0) @binding(1) var<storage, read> src: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> I: array<f32>;
var<workgroup> part: array<f32, 64>;

@compute @workgroup_size(64)
fn main(@builtin(local_invocation_id) lid: vec3u, @builtin(workgroup_id) wid: vec3u) {
    let w: i32 = i32(U.width);
    let y: i32 = i32(wid.x);
    let g: f32 = U.b.y;
    var s: f32 = 0.0;
    for (var x: i32 = i32(lid.x); x < w; x += 64) {
        let c: vec3f = max(src[u32(y * w + x)].xyz, vec3f(0.0));
        s = s + (pow(c.x, g) + pow(c.y, g) + pow(c.z, g)) / 3.0;
    }
    part[lid.x] = s;
    workgroupBarrier();
    for (var st: u32 = 32u; st > 0u; st = st >> 1u) {
        if (lid.x < st) { part[lid.x] = part[lid.x] + part[lid.x + st]; }
        workgroupBarrier();
    }
    if (lid.x == 0u) { I[u32(y)] = part[0] / f32(w); }
}

//@pass style_sag_scan
// Scan-causal EHT sag: one invocation walks the lines in order (the recurrence is causal), twice
// with settle; L holds sag, gain, drawn height and spot sigma per line.
@group(0) @binding(0) var<uniform> U: SagGpuParams;
@group(0) @binding(1) var<storage, read> I: array<f32>;
@group(0) @binding(2) var<storage, read_write> L: array<vec4f>;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    if (gidx > 0u) { return; }
    let h: i32 = i32(U.height);
    let a: f32 = U.a.y;
    let S: f32 = U.a.x;
    var s: f32 = U.b.z;
    let cy: f32 = f32(h) / 2.0;
    for (var y: i32 = 0; y < h; y++) {
        s = s + a * (S * I[u32(y)] - s);
        L[u32(y)] = vec4f(s, 0.0, 0.0, 0.0);
    }
    if (U.settle != 0u) {
        s = s * pow(1.0 - a, f32(U.blank));
        for (var y2: i32 = 0; y2 < h; y2++) {
            s = s + a * (S * I[u32(y2)] - s);
            L[u32(y2)] = vec4f(s, 0.0, 0.0, 0.0);
        }
    }
    for (var y3: i32 = 0; y3 < h; y3++) {
        let v: f32 = L[u32(y3)].x;
        let k: f32 = 1.0 / sqrt(1.0 - v);
        L[u32(y3)] = vec4f(v, k, cy + (f32(y3) + 0.5 - cy) * k, U.a.w + U.a.z * v);
    }
}

//@pass style_sag_resample
// Scan-causal EHT sag: each output line read from the two drawn lines around it, each sampled at
// its own gain with a gaussian spot (in linear light), dimmed with the sag; signal8 to RGBA8.
@group(0) @binding(0) var<uniform> U: SagGpuParams;
@group(0) @binding(1) var<storage, read> src: array<vec4f>;
@group(0) @binding(2) var<storage, read> L: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> out8: array<u32>;

fn sample_line(y: i32, xs: f32, sigma: f32) -> vec3f {
    let w: i32 = i32(U.width);
    let R: i32 = i32(U.radius);
    let g: f32 = U.b.y;
    let x0: i32 = i32(floor(xs));
    var ws: f32 = 0.0;
    var acc: vec3f = vec3f(0.0);
    for (var j: i32 = x0 - R; j <= x0 + R; j++) {
        if (j < 0 || j >= w) { continue; }
        let d: f32 = (f32(j) + 0.5 - xs) / sigma;
        let wt: f32 = exp(-0.5 * d * d);
        let c: vec3f = max(src[u32(y * w + j)].xyz, vec3f(0.0));
        ws = ws + wt;
        acc = acc + wt * vec3f(pow(c.x, g), pow(c.y, g), pow(c.z, g));
    }
    if (ws > 0.0) { acc = acc / ws; }
    return acc;
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
    let yo: i32 = i32(i / U.width);
    let yc: f32 = f32(yo) + 0.5;
    let cx: f32 = f32(w) / 2.0;
    if (yc < L[0].z || yc > L[u32(h - 1)].z) {
        out8[i] = 255u << 24u;
        return;
    }
    var lo: i32 = 0;
    var hi: i32 = h - 1;
    while (hi - lo > 1) {
        let m: i32 = (lo + hi) / 2;
        if (L[u32(m)].z <= yc) { lo = m; } else { hi = m; }
    }
    let y1: i32 = min(h - 1, lo + 1);
    let A: vec4f = L[u32(lo)];
    let Bq: vec4f = L[u32(y1)];
    var f: f32 = 0.0;
    if (y1 != lo) { f = (yc - A.z) / (Bq.z - A.z); }
    let xc: f32 = f32(x) + 0.5;
    let a: vec3f = sample_line(lo, cx + (xc - cx) / A.y, A.w) * pow(1.0 - A.x, U.b.x);
    let b: vec3f = sample_line(y1, cx + (xc - cx) / Bq.y, Bq.w) * pow(1.0 - Bq.x, U.b.x);
    let m3: vec3f = a * (1.0 - f) + b * f;
    let ig: f32 = 1.0 / U.b.y;
    let q: vec3f = clamp(vec3f(pow(m3.x, ig), pow(m3.y, ig), pow(m3.z, ig)), vec3f(0.0), vec3f(1.0));
    out8[i] = u32(floor(q.x * 255.0 + 0.5)) | (u32(floor(q.y * 255.0 + 0.5)) << 8u) | (u32(floor(q.z * 255.0 + 0.5)) << 16u) | (255u << 24u);
}

//@pass style_cari_sal
// Salience caricature (raw/renderer/style_sag.hpp): salience from the material ids.
@group(0) @binding(0) var<uniform> U: CariGpuParams;
@group(0) @binding(1) var<storage, read> mat: array<i32>;
@group(0) @binding(2) var<storage, read_write> s: array<f32>;

fn weight(m: i32) -> f32 {
    if (m < 0 || m > 9) { return 0.0; }
    if (m < 4) { return U.w0[m]; }
    if (m < 8) { return U.w1[m - 4]; }
    return U.w2[m - 8];
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    s[i] = weight(mat[i]);
}

//@pass style_cari_blur
// Salience caricature: one pass of the separable gaussian (dir 0 along x, 1 along y), clamped ends.
@group(0) @binding(0) var<uniform> U: CariGpuParams;
@group(0) @binding(1) var<storage, read> taps: array<f32>;
@group(0) @binding(2) var<storage, read> a: array<f32>;
@group(0) @binding(3) var<storage, read_write> b: array<f32>;

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
    let R: i32 = i32(U.radius);
    var v: f32 = 0.0;
    for (var k: i32 = -R; k <= R; k++) {
        var j: i32 = y * w + clamp(x + k, 0, w - 1);
        if (U.dir != 0u) { j = clamp(y + k, 0, h - 1) * w + x; }
        v = v + taps[u32(k + R)] * a[u32(j)];
    }
    b[i] = v;
}

//@pass style_cari_grad
// Salience caricature: the central-difference gradient of the smoothed salience.
@group(0) @binding(0) var<uniform> U: CariGpuParams;
@group(0) @binding(1) var<storage, read> S: array<f32>;
@group(0) @binding(2) var<storage, read_write> g: array<vec2f>;

fn cl(x: i32, y: i32) -> u32 {
    return u32(clamp(y, 0, i32(U.height) - 1) * i32(U.width) + clamp(x, 0, i32(U.width) - 1));
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let x: i32 = i32(i % U.width);
    let y: i32 = i32(i / U.width);
    g[i] = vec2f(0.5 * (S[cl(x + 1, y)] - S[cl(x - 1, y)]), 0.5 * (S[cl(x, y + 1)] - S[cl(x, y - 1)]));
}

//@pass style_cari_lambda
// Salience caricature: one workgroup finds the largest Frobenius norm of the gradient's derivative
// (a max tree in workgroup memory), then lambda, clamped so the composed map keeps det J >= 0.04.
@group(0) @binding(0) var<uniform> U: CariGpuParams;
@group(0) @binding(1) var<storage, read> g: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> L: array<f32>;
var<workgroup> part: array<f32, 256>;

fn cl(x: i32, y: i32) -> u32 {
    return u32(clamp(y, 0, i32(U.height) - 1) * i32(U.width) + clamp(x, 0, i32(U.width) - 1));
}

@compute @workgroup_size(256)
fn main(@builtin(local_invocation_id) lid: vec3u) {
    let w: i32 = i32(U.width);
    let h: i32 = i32(U.height);
    var m: f32 = 0.0;
    for (var i: i32 = i32(lid.x); i < w * h; i += 256) {
        let x: i32 = i % w;
        let y: i32 = i / w;
        let dx: vec2f = 0.5 * (g[cl(x + 1, y)] - g[cl(x - 1, y)]);
        let dy: vec2f = 0.5 * (g[cl(x, y + 1)] - g[cl(x, y - 1)]);
        m = max(m, sqrt(dx.x * dx.x + dy.x * dy.x + dx.y * dx.y + dy.y * dy.y));
    }
    part[lid.x] = m;
    workgroupBarrier();
    for (var st: u32 = 128u; st > 0u; st = st >> 1u) {
        if (lid.x < st) { part[lid.x] = max(part[lid.x], part[lid.x + st]); }
        workgroupBarrier();
    }
    if (lid.x == 0u) {
        let c: f32 = 1.0 - pow(0.04, 1.0 / (2.0 * f32(U.steps)));
        var lam: f32 = 0.0;
        if (part[0] > 0.0) { lam = min(U.a.x, (c * U.a.y) / part[0]); }
        L[0] = lam;
    }
}

//@pass style_cari_warp
// Salience caricature: each output pixel reads the source at y + lambda grad S (composed over the
// steps, the gradient read bilinearly at the moving point), lab-encoded to RGBA8.
@group(0) @binding(0) var<uniform> U: CariGpuParams;
@group(0) @binding(1) var<storage, read> src: array<vec4f>;
@group(0) @binding(2) var<storage, read> g: array<vec2f>;
@group(0) @binding(3) var<storage, read> L: array<f32>;
@group(0) @binding(4) var<storage, read_write> out8: array<u32>;

fn grad_at(fx: f32, fy: f32) -> vec2f {
    let w: i32 = i32(U.width);
    let h: i32 = i32(U.height);
    let u: f32 = fx - 0.5;
    let v: f32 = fy - 0.5;
    let x0: i32 = clamp(i32(floor(u)), 0, w - 1);
    let y0: i32 = clamp(i32(floor(v)), 0, h - 1);
    let x1: i32 = min(w - 1, x0 + 1);
    let y1: i32 = min(h - 1, y0 + 1);
    let tx: f32 = clamp(u - f32(x0), 0.0, 1.0);
    let ty: f32 = clamp(v - f32(y0), 0.0, 1.0);
    return (g[u32(y0 * w + x0)] * (1.0 - tx) + g[u32(y0 * w + x1)] * tx) * (1.0 - ty) + (g[u32(y1 * w + x0)] * (1.0 - tx) + g[u32(y1 * w + x1)] * tx) * ty;
}
fn sample_src(fx: f32, fy: f32) -> vec3f {
    let w: i32 = i32(U.width);
    let h: i32 = i32(U.height);
    let u: f32 = fx - 0.5;
    let v: f32 = fy - 0.5;
    let x0: i32 = clamp(i32(floor(u)), 0, w - 1);
    let y0: i32 = clamp(i32(floor(v)), 0, h - 1);
    let x1: i32 = min(w - 1, x0 + 1);
    let y1: i32 = min(h - 1, y0 + 1);
    let tx: f32 = clamp(u - f32(x0), 0.0, 1.0);
    let ty: f32 = clamp(v - f32(y0), 0.0, 1.0);
    return (src[u32(y0 * w + x0)].xyz * (1.0 - tx) + src[u32(y0 * w + x1)].xyz * tx) * (1.0 - ty) + (src[u32(y1 * w + x0)].xyz * (1.0 - tx) + src[u32(y1 * w + x1)].xyz * tx) * ty;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let x: f32 = f32(i % U.width);
    let y: f32 = f32(i / U.width);
    let lam: f32 = L[0];
    var f: vec2f = vec2f(x + 0.5, y + 0.5) + lam * g[i];
    for (var k: i32 = 1; k < i32(U.steps); k++) { f = f + lam * grad_at(f.x, f.y); }
    out8[i] = lab_pack(sample_src(f.x, f.y), U.a.z);
}

//@pass style_pixel_capture
// Perspective-stable pixel art (raw/renderer/style_pixel.hpp): the probe, one ray a texel from the
// snapped origin; geo holds the hit's Chebyshev distance (-1 for sky), material and object.
@group(0) @binding(0) var<uniform> U: PixelGpuParams;
@group(0) @binding(1) var<storage, read_write> geo: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> nrm: array<vec4f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let N: u32 = U.n;
    let k: u32 = gidx;
    if (k >= 6u * N * N) { return; }
    let f: u32 = k / (N * N);
    let j: u32 = (k % (N * N)) / N;
    let i: u32 = k % N;
    let r: vec3f = px_face_dir(f, 2.0 * (f32(i) + 0.5) / f32(N) - 1.0, 2.0 * (f32(j) + 0.5) / f32(N) - 1.0);
    let d: vec3f = normalize(r);
    let o: vec3f = U.origin.xyz;
    let hit: vec3f = px_march(o, d, 40.0);
    if (hit.x < 0.0) {
        geo[k] = vec4f(-1.0, -1.0, -1.0, 0.0);
        nrm[k] = vec4f(0.0);
        return;
    }
    let p: vec3f = o + d * hit.x;
    geo[k] = vec4f(px_cheb(p - o), hit.y, hit.z, 0.0);
    nrm[k] = vec4f(px_normal(p), 0.0);
}

//@pass style_pixel_shade
// Pixel art: the camera-independent colour of every texel, posterised, with outlines where a
// texel borders a farther object and creases where the normal turns.
@group(0) @binding(0) var<uniform> U: PixelGpuParams;
@group(0) @binding(1) var<storage, read> geo: array<vec4f>;
@group(0) @binding(2) var<storage, read> nrm: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> col: array<vec4f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let N: u32 = U.n;
    let k: u32 = gidx;
    if (k >= 6u * N * N) { return; }
    let f: u32 = k / (N * N);
    let j: i32 = i32((k % (N * N)) / N);
    let i: i32 = i32(k % N);
    let u: f32 = 2.0 * (f32(i) + 0.5) / f32(N) - 1.0;
    let v: f32 = 2.0 * (f32(j) + 0.5) / f32(N) - 1.0;
    let bands: f32 = U.origin.w;
    let g: vec4f = geo[k];
    let r: vec3f = px_face_dir(f, u, v);
    if (g.x < 0.0) {
        col[k] = vec4f(px_stylise(px_sky(normalize(r)), bands, 0.0), 1.0);
        return;
    }
    let p: vec3f = U.origin.xyz + (g.x / px_cheb(r)) * r;
    let n: vec3f = nrm[k].xyz;
    var dL: f32 = 0.0;
    for (var s: i32 = 0; s < 4; s++) {
        var di: i32 = 0;
        var dj: i32 = 0;
        if (s == 0) { di = 1; }
        if (s == 1) { di = -1; }
        if (s == 2) { dj = 1; }
        if (s == 3) { dj = -1; }
        let ii: i32 = i + di;
        let jj: i32 = j + dj;
        if (ii < 0 || jj < 0 || ii >= i32(N) || jj >= i32(N)) { continue; }
        let q: u32 = (f * N + u32(jj)) * N + u32(ii);
        let gq: vec4f = geo[q];
        if (gq.z != g.z && (gq.x < 0.0 || gq.x > g.x * 1.03)) {
            dL = -U.a.x;
        } else if (dL == 0.0 && gq.z == g.z && (di > 0 || dj > 0) && dot(n, nrm[q].xyz) < 0.6) {
            dL = -U.a.y;
        }
    }
    col[k] = vec4f(px_stylise(px_shade(p, n, i32(g.y)), bands, dL), 1.0);
}

//@pass style_pixel_clear
// Pixel art: a splat buffer filled with 0xffffffff (no texel).
@group(0) @binding(0) var<uniform> U: PixelGpuParams;
@group(0) @binding(1) var<storage, read_write> a: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    if (gidx >= U.width * U.height) { return; }
    a[gidx] = 0xffffffffu;
}

//@pass style_pixel_splatz
// Pixel art: each texel's world-space quad projected into the view; the nearest depth key (view
// depth quantised to 1/4096) per pixel by atomicMin.
@group(0) @binding(0) var<uniform> U: PixelGpuParams;
@group(0) @binding(1) var<storage, read> geo: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> zb: array<atomic<u32>>;

fn cam_project(p: vec3f) -> vec3f {
    let v: vec3f = p - U.eye.xyz;
    let z: f32 = dot(v, U.f.xyz);
    let W: f32 = f32(U.width);
    let H: f32 = f32(U.height);
    let x: f32 = dot(v, U.r.xyz) / (z * U.eye.w * (W / H));
    let y: f32 = dot(v, U.u.xyz) / (z * U.eye.w);
    return vec3f((x + 1.0) / 2.0 * W, (1.0 - y) / 2.0 * H, z);
}
fn edgef(a: vec2f, b: vec2f, x: f32, y: f32) -> f32 {
    return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
}
fn in_tri(a: vec2f, b: vec2f, c: vec2f, x: f32, y: f32) -> bool {
    let e0: f32 = edgef(a, b, x, y);
    let e1: f32 = edgef(b, c, x, y);
    let e2: f32 = edgef(c, a, x, y);
    return (e0 >= 0.0 && e1 >= 0.0 && e2 >= 0.0) || (e0 <= 0.0 && e1 <= 0.0 && e2 <= 0.0);
}
fn corner(f: u32, u: f32, v: f32, d: f32) -> vec3f {
    let r: vec3f = px_face_dir(f, u, v);
    return cam_project(U.origin.xyz + (d / px_cheb(r)) * r);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let N: u32 = U.n;
    let k: u32 = gidx;
    if (k >= 6u * N * N) { return; }
    let d: f32 = geo[k].x;
    if (d < 0.0) { return; }
    let f: u32 = k / (N * N);
    let j: u32 = (k % (N * N)) / N;
    let i: u32 = k % N;
    let u: f32 = 2.0 * (f32(i) + 0.5) / f32(N) - 1.0;
    let v: f32 = 2.0 * (f32(j) + 0.5) / f32(N) - 1.0;
    let h: f32 = U.a.z / f32(N);
    let c0: vec3f = corner(f, u - h, v - h, d);
    let c1: vec3f = corner(f, u + h, v - h, d);
    let c2: vec3f = corner(f, u + h, v + h, d);
    let c3: vec3f = corner(f, u - h, v + h, d);
    let cc: vec3f = corner(f, u, v, d);
    if (c0.z < 0.05 || c1.z < 0.05 || c2.z < 0.05 || c3.z < 0.05 || cc.z < 0.05) { return; }
    let W: i32 = i32(U.width);
    let H: i32 = i32(U.height);
    let x0: i32 = max(0, i32(floor(min(min(c0.x, c1.x), min(c2.x, c3.x)))));
    let x1: i32 = min(W - 1, i32(ceil(max(max(c0.x, c1.x), max(c2.x, c3.x)))));
    let y0: i32 = max(0, i32(floor(min(min(c0.y, c1.y), min(c2.y, c3.y)))));
    let y1: i32 = min(H - 1, i32(ceil(max(max(c0.y, c1.y), max(c2.y, c3.y)))));
    if (x1 - x0 > 63 || y1 - y0 > 63) { return; }
    let z: u32 = u32(floor(cc.z * 4096.0));
    for (var y: i32 = y0; y <= y1; y++) {
        for (var x: i32 = x0; x <= x1; x++) {
            let px: f32 = f32(x) + 0.5;
            let py: f32 = f32(y) + 0.5;
            if (!in_tri(c0.xy, c1.xy, c2.xy, px, py) && !in_tri(c0.xy, c2.xy, c3.xy, px, py)) { continue; }
            atomicMin(&zb[u32(y * W + x)], z);
        }
    }
}

//@pass style_pixel_splatid
// Pixel art: the lowest texel index among the quads at each pixel's nearest depth key (atomicMin);
// the depth keys are read plainly, written by the previous pass.
@group(0) @binding(0) var<uniform> U: PixelGpuParams;
@group(0) @binding(1) var<storage, read> geo: array<vec4f>;
@group(0) @binding(2) var<storage, read> zb: array<u32>;
@group(0) @binding(3) var<storage, read_write> idb: array<atomic<u32>>;

fn cam_project(p: vec3f) -> vec3f {
    let v: vec3f = p - U.eye.xyz;
    let z: f32 = dot(v, U.f.xyz);
    let W: f32 = f32(U.width);
    let H: f32 = f32(U.height);
    let x: f32 = dot(v, U.r.xyz) / (z * U.eye.w * (W / H));
    let y: f32 = dot(v, U.u.xyz) / (z * U.eye.w);
    return vec3f((x + 1.0) / 2.0 * W, (1.0 - y) / 2.0 * H, z);
}
fn edgef(a: vec2f, b: vec2f, x: f32, y: f32) -> f32 {
    return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
}
fn in_tri(a: vec2f, b: vec2f, c: vec2f, x: f32, y: f32) -> bool {
    let e0: f32 = edgef(a, b, x, y);
    let e1: f32 = edgef(b, c, x, y);
    let e2: f32 = edgef(c, a, x, y);
    return (e0 >= 0.0 && e1 >= 0.0 && e2 >= 0.0) || (e0 <= 0.0 && e1 <= 0.0 && e2 <= 0.0);
}
fn corner(f: u32, u: f32, v: f32, d: f32) -> vec3f {
    let r: vec3f = px_face_dir(f, u, v);
    return cam_project(U.origin.xyz + (d / px_cheb(r)) * r);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let N: u32 = U.n;
    let k: u32 = gidx;
    if (k >= 6u * N * N) { return; }
    let d: f32 = geo[k].x;
    if (d < 0.0) { return; }
    let f: u32 = k / (N * N);
    let j: u32 = (k % (N * N)) / N;
    let i: u32 = k % N;
    let u: f32 = 2.0 * (f32(i) + 0.5) / f32(N) - 1.0;
    let v: f32 = 2.0 * (f32(j) + 0.5) / f32(N) - 1.0;
    let h: f32 = U.a.z / f32(N);
    let c0: vec3f = corner(f, u - h, v - h, d);
    let c1: vec3f = corner(f, u + h, v - h, d);
    let c2: vec3f = corner(f, u + h, v + h, d);
    let c3: vec3f = corner(f, u - h, v + h, d);
    let cc: vec3f = corner(f, u, v, d);
    if (c0.z < 0.05 || c1.z < 0.05 || c2.z < 0.05 || c3.z < 0.05 || cc.z < 0.05) { return; }
    let W: i32 = i32(U.width);
    let H: i32 = i32(U.height);
    let x0: i32 = max(0, i32(floor(min(min(c0.x, c1.x), min(c2.x, c3.x)))));
    let x1: i32 = min(W - 1, i32(ceil(max(max(c0.x, c1.x), max(c2.x, c3.x)))));
    let y0: i32 = max(0, i32(floor(min(min(c0.y, c1.y), min(c2.y, c3.y)))));
    let y1: i32 = min(H - 1, i32(ceil(max(max(c0.y, c1.y), max(c2.y, c3.y)))));
    if (x1 - x0 > 63 || y1 - y0 > 63) { return; }
    let z: u32 = u32(floor(cc.z * 4096.0));
    for (var y: i32 = y0; y <= y1; y++) {
        for (var x: i32 = x0; x <= x1; x++) {
            let px: f32 = f32(x) + 0.5;
            let py: f32 = f32(y) + 0.5;
            if (!in_tri(c0.xy, c1.xy, c2.xy, px, py) && !in_tri(c0.xy, c2.xy, c3.xy, px, py)) { continue; }
            let p: u32 = u32(y * W + x);
            if (zb[p] == z) { atomicMin(&idb[p], k); }
        }
    }
}

//@pass style_pixel_resolve
// Pixel art: each pixel's texel colour, or an eye-ray fill where no texel reaches; during a cell
// change a 4 x 4 Bayer threshold picks the previous probe. sRGB to RGBA8.
@group(0) @binding(0) var<uniform> U: PixelGpuParams;
@group(0) @binding(1) var<storage, read> col0: array<vec4f>;
@group(0) @binding(2) var<storage, read> col1: array<vec4f>;
@group(0) @binding(3) var<storage, read> idb0: array<u32>;
@group(0) @binding(4) var<storage, read> idb1: array<u32>;
@group(0) @binding(5) var<storage, read_write> out8: array<u32>;

fn bayer4(x: u32, y: u32) -> f32 {
    let i: u32 = (y & 3u) * 4u + (x & 3u);
    let a: vec4f = vec4f(0.0, 8.0, 2.0, 10.0);
    let b: vec4f = vec4f(12.0, 4.0, 14.0, 6.0);
    let c: vec4f = vec4f(3.0, 11.0, 1.0, 9.0);
    let d: vec4f = vec4f(15.0, 7.0, 13.0, 5.0);
    if (i < 4u) { return a[i]; }
    if (i < 8u) { return b[i - 4u]; }
    if (i < 12u) { return c[i - 8u]; }
    return d[i - 12u];
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let p: u32 = gidx;
    if (p >= U.width * U.height) { return; }
    let x: u32 = p % U.width;
    let y: u32 = p / U.width;
    let use_prev: bool = U.has_prev != 0u && (bayer4(x, y) + 0.5) / 16.0 >= U.a.w;
    var t: u32 = idb0[p];
    if (use_prev) { t = idb1[p]; }
    var c: vec3f = vec3f(0.0);
    if (t != 0xffffffffu) {
        if (use_prev) { c = col1[t].xyz; } else { c = col0[t].xyz; }
    } else {
        let W: f32 = f32(U.width);
        let H: f32 = f32(U.height);
        let sx: f32 = (2.0 * (f32(x) + 0.5) / W - 1.0) * U.eye.w * (W / H);
        let sy: f32 = (1.0 - 2.0 * (f32(y) + 0.5) / H) * U.eye.w;
        let d: vec3f = normalize(U.f.xyz + sx * U.r.xyz + sy * U.u.xyz);
        let e: vec3f = U.eye.xyz;
        let hit: vec3f = px_march(e, d, 40.0);
        if (hit.x < 0.0) {
            c = px_stylise(px_sky(d), U.origin.w, 0.0);
        } else {
            let q: vec3f = e + d * hit.x;
            c = px_stylise(px_shade(q, px_normal(q), i32(hit.y)), U.origin.w, 0.0);
        }
    }
    out8[p] = pack_rgb8(c);
}

