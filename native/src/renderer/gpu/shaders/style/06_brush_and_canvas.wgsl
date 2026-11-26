//@pass style_paint_prep
// The painterly shader (raw/renderer/style_paint.hpp), first pass: scene light through a soft
// shoulder on the largest channel to a display colour, its sRGB encoding and luminance, and its
// Kubelka-Munk pigment latent (concentrations and the RGB residual, two vec4 a pixel).
@group(0) @binding(0) var<uniform> U: PaintGpuParams;
@group(0) @binding(1) var<storage, read> pig: array<f32>;
@group(0) @binding(2) var<storage, read> scene: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> sb: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> lat: array<vec4f>;

fn km_decode(c: vec4f) -> vec3f {
    var o: vec3f = vec3f(0.0);
    for (var w: u32 = 0u; w < 31u; w++) {
        let K: f32 = dot(c, vec4f(pig[4u * w], pig[4u * w + 1u], pig[4u * w + 2u], pig[4u * w + 3u]));
        let S: f32 = dot(c, vec4f(pig[124u + 4u * w], pig[124u + 4u * w + 1u], pig[124u + 4u * w + 2u], pig[124u + 4u * w + 3u]));
        let q: f32 = K / max(S, 1.0e-9);
        let R: f32 = 1.0 + q - sqrt(q * q + 2.0 * q);
        o = o + R * vec3f(pig[248u + 3u * w], pig[248u + 3u * w + 1u], pig[248u + 3u * w + 2u]);
    }
    return o;
}
fn lut_conc(s: vec3f) -> vec4f {
    let f: vec3f = clamp(s, vec3f(0.0), vec3f(1.0)) * 16.0;
    let i0: vec3i = vec3i(min(vec3f(15.0), floor(f)));
    let t: vec3f = f - vec3f(i0);
    var c: vec4f = vec4f(0.0);
    for (var dz: i32 = 0; dz < 2; dz++) {
        for (var dy: i32 = 0; dy < 2; dy++) {
            for (var dx: i32 = 0; dx < 2; dx++) {
                let w: f32 = select(1.0 - t.x, t.x, dx == 1) * select(1.0 - t.y, t.y, dy == 1) * select(1.0 - t.z, t.z, dz == 1);
                let o: u32 = 341u + u32((((i0.z + dz) * 17 + i0.y + dy) * 17 + i0.x + dx) * 4);
                c = c + w * vec4f(pig[o], pig[o + 1u], pig[o + 2u], pig[o + 3u]);
            }
        }
    }
    return c;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let k: f32 = U.a.x;
    let sc: vec3f = max(scene[i].xyz, vec3f(0.0));
    let m: f32 = max(sc.x, max(sc.y, sc.z));
    let t: f32 = m * k;
    var gain: f32 = k * (1.0 - t / 2.0 + t * t / 6.0);
    if (t >= 1.0e-3) { gain = (1.0 - exp(-t)) / m; }
    let D: vec3f = sc * gain;
    let e: vec3f = vec3f(linear_to_srgb(D.x), linear_to_srgb(D.y), linear_to_srgb(D.z));
    let c: vec4f = lut_conc(e);
    let dec: vec3f = km_decode(c);
    sb[i] = vec4f(e, 0.2126 * D.x + 0.7152 * D.y + 0.0722 * D.z);
    lat[2u * i] = c;
    lat[2u * i + 1u] = vec4f(D - dec, 0.0);
}

//@pass style_paint_tensor
// The painterly shader: the structure tensor (Sobel on the sRGB colour).
@group(0) @binding(0) var<uniform> U: PaintGpuParams;
@group(0) @binding(1) var<storage, read> sb: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> T: array<vec4f>;

fn at(x: i32, y: i32) -> vec3f {
    return sb[u32(clamp(y, 0, i32(U.height) - 1) * i32(U.width) + clamp(x, 0, i32(U.width) - 1))].xyz;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let x: i32 = i32(i % U.width);
    let y: i32 = i32(i / U.width);
    let gx: vec3f = (at(x + 1, y - 1) + 2.0 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2.0 * at(x - 1, y) - at(x - 1, y + 1)) / 4.0;
    let gy: vec3f = (at(x - 1, y + 1) + 2.0 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2.0 * at(x, y - 1) - at(x + 1, y - 1)) / 4.0;
    T[i] = vec4f(dot(gx, gx), dot(gx, gy), dot(gy, gy), 0.0);
}

//@pass style_paint_blur
// The painterly shader: one pass of the tensor's separable gaussian (dir 0 along x, 1 along y).
@group(0) @binding(0) var<uniform> U: PaintGpuParams;
@group(0) @binding(1) var<storage, read> wts: array<f32>;
@group(0) @binding(2) var<storage, read> a: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> o: array<vec4f>;

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
    let r: i32 = i32(U.blur_r);
    var s: vec4f = vec4f(0.0);
    for (var k: i32 = -r; k <= r; k++) {
        var xx: i32 = x;
        var yy: i32 = y;
        if (U.dir != 0u) { yy = clamp(y + k, 0, h - 1); } else { xx = clamp(x + k, 0, w - 1); }
        s = s + wts[u32(k + r)] * a[u32(yy * w + xx)];
    }
    o[i] = s;
}

//@pass style_paint_akf
// The painterly shader: the anisotropic Kuwahara filter, eight polynomial-weighted sectors of an
// ellipse along the flow, averaging pigment latents (so the filter mixes paint).
@group(0) @binding(0) var<uniform> U: PaintGpuParams;
@group(0) @binding(1) var<storage, read> sb: array<vec4f>;
@group(0) @binding(2) var<storage, read> lat: array<vec4f>;
@group(0) @binding(3) var<storage, read> T: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> olat: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> os: array<vec4f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let p: u32 = gidx;
    if (p >= U.width * U.height) { return; }
    let w: i32 = i32(U.width);
    let h: i32 = i32(U.height);
    let x: i32 = i32(p % U.width);
    let y: i32 = i32(p / U.width);
    let f: vec3f = pt_flow(T[p]);
    let tx: f32 = f.x;
    let ty: f32 = f.y;
    let A: f32 = f.z;
    let r: f32 = U.a.y;
    let zeta: f32 = U.a.w;
    let eta: f32 = U.b.x;
    let a: f32 = r * (1.0 + A);
    let b: f32 = r / (1.0 + A);
    let ex: i32 = i32(ceil(sqrt(a * a * tx * tx + b * b * ty * ty)));
    let ey: i32 = i32(ceil(sqrt(a * a * ty * ty + b * b * tx * tx)));
    var acc: array<f32, 112>;
    for (var dy: i32 = -ey; dy <= ey; dy++) {
        for (var dx: i32 = -ex; dx <= ex; dx++) {
            let u: f32 = (tx * f32(dx) + ty * f32(dy)) / a;
            let v: f32 = (-ty * f32(dx) + tx * f32(dy)) / b;
            let rr: f32 = u * u + v * v;
            if (rr > 1.0) { continue; }
            let qi: u32 = u32(clamp(y + dy, 0, h - 1) * w + clamp(x + dx, 0, w - 1));
            let g: f32 = exp(-2.0 * rr);
            let l0: vec4f = lat[2u * qi];
            let l1: vec4f = lat[2u * qi + 1u];
            let sv: vec3f = sb[qi].xyz;
            for (var k: i32 = 0; k < 8; k++) {
                let ang: f32 = -6.283185307179586 * f32(k) / 8.0;
                let xk: f32 = u * cos(ang) - v * sin(ang);
                let yk: f32 = u * sin(ang) + v * cos(ang);
                let z: f32 = xk + zeta - eta * yk * yk;
                if (z <= 0.0) { continue; }
                let wk: f32 = z * z * g;
                let o: i32 = k * 14;
                acc[o] = acc[o] + wk;
                acc[o + 1] = acc[o + 1] + wk * l0.x;
                acc[o + 2] = acc[o + 2] + wk * l0.y;
                acc[o + 3] = acc[o + 3] + wk * l0.z;
                acc[o + 4] = acc[o + 4] + wk * l0.w;
                acc[o + 5] = acc[o + 5] + wk * l1.x;
                acc[o + 6] = acc[o + 6] + wk * l1.y;
                acc[o + 7] = acc[o + 7] + wk * l1.z;
                acc[o + 8] = acc[o + 8] + wk * sv.x;
                acc[o + 9] = acc[o + 9] + wk * sv.y;
                acc[o + 10] = acc[o + 10] + wk * sv.z;
                acc[o + 11] = acc[o + 11] + wk * sv.x * sv.x;
                acc[o + 12] = acc[o + 12] + wk * sv.y * sv.y;
                acc[o + 13] = acc[o + 13] + wk * sv.z * sv.z;
            }
        }
    }
    var wsum: f32 = 0.0;
    var L0: vec4f = vec4f(0.0);
    var L1: vec3f = vec3f(0.0);
    var S3: vec3f = vec3f(0.0);
    for (var k2: i32 = 0; k2 < 8; k2++) {
        let o: i32 = k2 * 14;
        let Wk: f32 = acc[o];
        if (Wk <= 0.0) { continue; }
        let m: vec3f = vec3f(acc[o + 8], acc[o + 9], acc[o + 10]) / Wk;
        let m2: vec3f = vec3f(acc[o + 11], acc[o + 12], acc[o + 13]) / Wk;
        let v2: f32 = max(m2.x - m.x * m.x, 0.0) + max(m2.y - m.y * m.y, 0.0) + max(m2.z - m.z * m.z, 0.0);
        let sd: f32 = sqrt(v2) * 255.0;
        var pw: f32 = 0.0;
        if (sd > 1.0e-6) { pw = pow(sd, U.a.z); }
        let alpha: f32 = 1.0 / (1.0 + pw);
        wsum = wsum + alpha;
        L0 = L0 + alpha * vec4f(acc[o + 1], acc[o + 2], acc[o + 3], acc[o + 4]) / Wk;
        L1 = L1 + alpha * vec3f(acc[o + 5], acc[o + 6], acc[o + 7]) / Wk;
        S3 = S3 + alpha * m;
    }
    olat[2u * p] = L0 / wsum;
    olat[2u * p + 1u] = vec4f(L1 / wsum, 0.0);
    os[p] = vec4f(S3 / wsum, A);
}

//@pass style_paint_stroke
// The painterly shader: brush relief and stroke identity, bristle and identity noise averaged
// along the flow both ways with triangle weights, fading out where the flow turns near 90 degrees.
@group(0) @binding(0) var<uniform> U: PaintGpuParams;
@group(0) @binding(1) var<storage, read> T: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> Hs: array<vec2f>;
@group(0) @binding(3) var<storage, read> Cv: array<vec4f>;
@group(0) @binding(4) var<storage, read> Kv: array<f32>;

fn layer_weight(k: u32) -> f32 {
    let age: f32 = Kv[5u * k];
    if (age < 0.0) { return 0.0; }
    return min(1.0, (age + 1.0) / 8.0) * max(0.02, 1.0 - Kv[5u * k + 3u] / 0.35);
}
fn cv_at(x: f32, y: f32) -> vec4f {
    let w: i32 = i32(U.width);
    let h: i32 = i32(U.height);
    let fx: f32 = clamp(x, 0.0, f32(w - 1));
    let fy: f32 = clamp(y, 0.0, f32(h - 1));
    let x0: i32 = i32(floor(fx));
    let y0: i32 = i32(floor(fy));
    let x1: i32 = min(w - 1, x0 + 1);
    let y1: i32 = min(h - 1, y0 + 1);
    let tx: f32 = fx - f32(x0);
    let ty: f32 = fy - f32(y0);
    return (Cv[u32(y0 * w + x0)] * (1.0 - tx) + Cv[u32(y0 * w + x1)] * tx) * (1.0 - ty) + (Cv[u32(y1 * w + x0)] * (1.0 - tx) + Cv[u32(y1 * w + x1)] * tx) * ty;
}
fn cnoise(kind: u32, x: f32, y: f32, m: f32) -> f32 {
    if (U.canvas_mode == 0u) { return pt_noise(kind, x + U.e.y, y + U.e.z); }
    let q: vec4f = cv_at(x, y);
    let w0: f32 = layer_weight(0u);
    let w1: f32 = layer_weight(1u);
    if (w1 == 0.0) { return pt_noise(kind, q.x, q.y); }
    if (w0 == 0.0) { return pt_noise(kind, q.z, q.w); }
    let n0: f32 = pt_noise(kind, q.x, q.y) - m;
    let n1: f32 = pt_noise(kind, q.z, q.w) - m;
    return m + (w0 * n0 + w1 * n1) / sqrt(w0 * w0 + w1 * w1);
}
fn dir_at(px: f32, py: f32) -> vec3f {
    let w: i32 = i32(U.width);
    let h: i32 = i32(U.height);
    let fx: f32 = clamp(px, 0.0, f32(w - 1));
    let fy: f32 = clamp(py, 0.0, f32(h - 1));
    let x0: i32 = i32(floor(fx));
    let y0: i32 = i32(floor(fy));
    let x1: i32 = min(w - 1, x0 + 1);
    let y1: i32 = min(h - 1, y0 + 1);
    let tx: f32 = fx - f32(x0);
    let ty: f32 = fy - f32(y0);
    return pt_flow((T[u32(y0 * w + x0)] * (1.0 - tx) + T[u32(y0 * w + x1)] * tx) * (1.0 - ty) + (T[u32(y1 * w + x0)] * (1.0 - tx) + T[u32(y1 * w + x1)] * tx) * ty);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let x: f32 = f32(i % U.width);
    let y: f32 = f32(i / U.width);
    let L: i32 = i32(U.stroke_len);
    var acc: f32 = cnoise(0u, x, y, 0.5) * f32(L + 1);
    var ids: f32 = cnoise(1u, x, y, 0.5) * f32(L + 1);
    var ws: f32 = f32(L + 1);
    for (var sg: i32 = 0; sg < 2; sg++) {
        let sgn: f32 = select(-1.0, 1.0, sg == 0);
        var px: f32 = x;
        var py: f32 = y;
        let d0: vec3f = dir_at(px, py);
        var tx: f32 = d0.x * sgn;
        var ty: f32 = d0.y * sgn;
        var cont: f32 = 1.0;
        for (var k: i32 = 1; k <= L; k++) {
            px = px + tx;
            py = py + ty;
            let nd: vec3f = dir_at(px, py);
            let d: f32 = nd.x * tx + nd.y * ty;
            tx = select(nd.x, -nd.x, d < 0.0);
            ty = select(nd.y, -nd.y, d < 0.0);
            let a: f32 = clamp((abs(d) - 0.05) / 0.25, 0.0, 1.0);
            cont = cont * a * a * (3.0 - 2.0 * a);
            let wk: f32 = f32(L + 1 - k) * cont;
            acc = acc + wk * cnoise(0u, px, py, 0.5);
            ids = ids + wk * cnoise(1u, px, py, 0.5);
            ws = ws + wk;
        }
    }
    Hs[i] = vec2f(acc / ws, ids / ws);
}

//@pass style_paint_relief
// The painterly shader: per pixel the XDoG line, the lit impasto (shade and sheen) and the
// watercolour wet edge; compose reads it bilinearly at the warped position.
@group(0) @binding(0) var<uniform> U: PaintGpuParams;
@group(0) @binding(1) var<storage, read> os: array<vec4f>;
@group(0) @binding(2) var<storage, read> Hs: array<vec2f>;
@group(0) @binding(3) var<storage, read> T: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> Rl: array<vec4f>;
@group(0) @binding(5) var<storage, read> Cv: array<vec4f>;
@group(0) @binding(6) var<storage, read> Kv: array<f32>;

fn layer_weight(k: u32) -> f32 {
    let age: f32 = Kv[5u * k];
    if (age < 0.0) { return 0.0; }
    return min(1.0, (age + 1.0) / 8.0) * max(0.02, 1.0 - Kv[5u * k + 3u] / 0.35);
}
fn cv_at(x: f32, y: f32) -> vec4f {
    let w: i32 = i32(U.width);
    let h: i32 = i32(U.height);
    let fx: f32 = clamp(x, 0.0, f32(w - 1));
    let fy: f32 = clamp(y, 0.0, f32(h - 1));
    let x0: i32 = i32(floor(fx));
    let y0: i32 = i32(floor(fy));
    let x1: i32 = min(w - 1, x0 + 1);
    let y1: i32 = min(h - 1, y0 + 1);
    let tx: f32 = fx - f32(x0);
    let ty: f32 = fy - f32(y0);
    return (Cv[u32(y0 * w + x0)] * (1.0 - tx) + Cv[u32(y0 * w + x1)] * tx) * (1.0 - ty) + (Cv[u32(y1 * w + x0)] * (1.0 - tx) + Cv[u32(y1 * w + x1)] * tx) * ty;
}
fn cnoise(kind: u32, x: f32, y: f32, m: f32) -> f32 {
    if (U.canvas_mode == 0u) { return pt_noise(kind, x + U.e.y, y + U.e.z); }
    let q: vec4f = cv_at(x, y);
    let w0: f32 = layer_weight(0u);
    let w1: f32 = layer_weight(1u);
    if (w1 == 0.0) { return pt_noise(kind, q.x, q.y); }
    if (w0 == 0.0) { return pt_noise(kind, q.z, q.w); }
    let n0: f32 = pt_noise(kind, q.x, q.y) - m;
    let n1: f32 = pt_noise(kind, q.z, q.w) - m;
    return m + (w0 * n0 + w1 * n1) / sqrt(w0 * w0 + w1 * w1);
}
fn xdog(x: i32, y: i32) -> f32 {
    let w: i32 = i32(U.width);
    let h: i32 = i32(U.height);
    let sg: f32 = U.c.w;
    let k: f32 = 1.6;
    let R: i32 = i32(ceil(3.0 * sg * k));
    var a: f32 = 0.0;
    var b: f32 = 0.0;
    var wa: f32 = 0.0;
    var wb: f32 = 0.0;
    for (var dy: i32 = -R; dy <= R; dy++) {
        for (var dx: i32 = -R; dx <= R; dx++) {
            let q: vec3f = os[u32(clamp(y + dy, 0, h - 1) * w + clamp(x + dx, 0, w - 1))].xyz;
            let l: f32 = 0.2126 * q.x + 0.7152 * q.y + 0.0722 * q.z;
            let r2: f32 = f32(dx * dx + dy * dy);
            let g1: f32 = exp(-r2 / (2.0 * sg * sg));
            let g2: f32 = exp(-r2 / (2.0 * sg * sg * k * k));
            a = a + g1 * l;
            wa = wa + g1;
            b = b + g2 * l;
            wb = wb + g2;
        }
    }
    let D: f32 = a / wa - 0.985 * (b / wb);
    if (D >= -0.004) { return 1.0; }
    return 1.0 + tanh(U.d.x * (D + 0.004));
}
fn hs(x: i32, y: i32) -> f32 {
    let xx: i32 = clamp(x, 0, i32(U.width) - 1);
    let yy: i32 = clamp(y, 0, i32(U.height) - 1);
    return U.b.y * Hs[u32(yy * i32(U.width) + xx)].x + 0.12 * cnoise(2u, f32(xx), f32(yy), 0.5);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let x: i32 = i32(i % U.width);
    let y: i32 = i32(i / U.width);
    var lineq: f32 = 1.0;
    if (U.c.z > 0.0) { lineq = xdog(x, y); }
    let nx: f32 = -(hs(x + 1, y) - hs(x - 1, y)) * 2.5;
    let ny: f32 = -(hs(x, y + 1) - hs(x, y - 1)) * 2.5;
    let n: vec3f = vec3f(nx, ny, 1.0) / length(vec3f(nx, ny, 1.0));
    let L: vec3f = vec3f(-0.5, -0.6, 0.62) / length(vec3f(-0.5, -0.6, 0.62));
    let ndl: f32 = dot(n, L);
    let rz: f32 = 2.0 * ndl * n.z - L.z;
    Rl[i] = vec4f(lineq, 1.0 + 0.9 * (ndl - L.z), U.b.z * pow(max(0.0, rz), 24.0) * 0.35, pt_smooth(0.012, 0.05, sqrt(T[i].x + T[i].z)));
}

//@pass style_paint_compose
// The painterly shader's compose: warp, temperature push and broken colour in pigment space,
// Kubelka-Munk decode as a ratio, value massing, then the medium (lit impasto, or a watercolour
// glaze over paper) and the lines; sRGB to RGBA8.
@group(0) @binding(0) var<uniform> U: PaintGpuParams;
@group(0) @binding(1) var<storage, read> pig: array<f32>;
@group(0) @binding(2) var<storage, read> olat: array<vec4f>;
@group(0) @binding(3) var<storage, read> Hs: array<vec2f>;
@group(0) @binding(4) var<storage, read> Rl: array<vec4f>;
@group(0) @binding(5) var<storage, read> Cv: array<vec4f>;
@group(0) @binding(6) var<storage, read> Kv: array<f32>;
@group(0) @binding(7) var<storage, read_write> out8: array<u32>;

fn layer_weight(k: u32) -> f32 {
    let age: f32 = Kv[5u * k];
    if (age < 0.0) { return 0.0; }
    return min(1.0, (age + 1.0) / 8.0) * max(0.02, 1.0 - Kv[5u * k + 3u] / 0.35);
}
fn bil_index(x: f32, y: f32) -> vec4f {
    let fx: f32 = clamp(x, 0.0, f32(i32(U.width) - 1));
    let fy: f32 = clamp(y, 0.0, f32(i32(U.height) - 1));
    return vec4f(floor(fx), floor(fy), fx - floor(fx), fy - floor(fy));
}
fn cv_at(x: f32, y: f32) -> vec4f {
    let w: i32 = i32(U.width);
    let b: vec4f = bil_index(x, y);
    let x0: i32 = i32(b.x);
    let y0: i32 = i32(b.y);
    let x1: i32 = min(w - 1, x0 + 1);
    let y1: i32 = min(i32(U.height) - 1, y0 + 1);
    return (Cv[u32(y0 * w + x0)] * (1.0 - b.z) + Cv[u32(y0 * w + x1)] * b.z) * (1.0 - b.w) + (Cv[u32(y1 * w + x0)] * (1.0 - b.z) + Cv[u32(y1 * w + x1)] * b.z) * b.w;
}
fn cnoise(kind: u32, x: f32, y: f32, m: f32) -> f32 {
    if (U.canvas_mode == 0u) { return pt_noise(kind, x + U.e.y, y + U.e.z); }
    let q: vec4f = cv_at(x, y);
    let w0: f32 = layer_weight(0u);
    let w1: f32 = layer_weight(1u);
    if (w1 == 0.0) { return pt_noise(kind, q.x, q.y); }
    if (w0 == 0.0) { return pt_noise(kind, q.z, q.w); }
    let n0: f32 = pt_noise(kind, q.x, q.y) - m;
    let n1: f32 = pt_noise(kind, q.z, q.w) - m;
    return m + (w0 * n0 + w1 * n1) / sqrt(w0 * w0 + w1 * w1);
}
fn lat_at(x: f32, y: f32, c: u32) -> vec4f {
    let w: i32 = i32(U.width);
    let b: vec4f = bil_index(x, y);
    let x0: i32 = i32(b.x);
    let y0: i32 = i32(b.y);
    let x1: i32 = min(w - 1, x0 + 1);
    let y1: i32 = min(i32(U.height) - 1, y0 + 1);
    return (olat[2u * u32(y0 * w + x0) + c] * (1.0 - b.z) + olat[2u * u32(y0 * w + x1) + c] * b.z) * (1.0 - b.w) + (olat[2u * u32(y1 * w + x0) + c] * (1.0 - b.z) + olat[2u * u32(y1 * w + x1) + c] * b.z) * b.w;
}
fn hs_at(x: f32, y: f32) -> vec2f {
    let w: i32 = i32(U.width);
    let b: vec4f = bil_index(x, y);
    let x0: i32 = i32(b.x);
    let y0: i32 = i32(b.y);
    let x1: i32 = min(w - 1, x0 + 1);
    let y1: i32 = min(i32(U.height) - 1, y0 + 1);
    return (Hs[u32(y0 * w + x0)] * (1.0 - b.z) + Hs[u32(y0 * w + x1)] * b.z) * (1.0 - b.w) + (Hs[u32(y1 * w + x0)] * (1.0 - b.z) + Hs[u32(y1 * w + x1)] * b.z) * b.w;
}
fn rl_at(x: f32, y: f32) -> vec4f {
    let w: i32 = i32(U.width);
    let b: vec4f = bil_index(x, y);
    let x0: i32 = i32(b.x);
    let y0: i32 = i32(b.y);
    let x1: i32 = min(w - 1, x0 + 1);
    let y1: i32 = min(i32(U.height) - 1, y0 + 1);
    return (Rl[u32(y0 * w + x0)] * (1.0 - b.z) + Rl[u32(y0 * w + x1)] * b.z) * (1.0 - b.w) + (Rl[u32(y1 * w + x0)] * (1.0 - b.z) + Rl[u32(y1 * w + x1)] * b.z) * b.w;
}
fn km_decode(c: vec4f) -> vec3f {
    var o: vec3f = vec3f(0.0);
    for (var w: u32 = 0u; w < 31u; w++) {
        let K: f32 = dot(c, vec4f(pig[4u * w], pig[4u * w + 1u], pig[4u * w + 2u], pig[4u * w + 3u]));
        let S: f32 = dot(c, vec4f(pig[124u + 4u * w], pig[124u + 4u * w + 1u], pig[124u + 4u * w + 2u], pig[124u + 4u * w + 3u]));
        let q: f32 = K / max(S, 1.0e-9);
        let R: f32 = 1.0 + q - sqrt(q * q + 2.0 * q);
        o = o + R * vec3f(pig[248u + 3u * w], pig[248u + 3u * w + 1u], pig[248u + 3u * w + 2u]);
    }
    return o;
}
fn glaze(c: vec4f, X: f32, Rg: f32) -> vec3f {
    var o: vec3f = vec3f(0.0);
    for (var w: u32 = 0u; w < 31u; w++) {
        let K: f32 = dot(c, vec4f(pig[4u * w], pig[4u * w + 1u], pig[4u * w + 2u], pig[4u * w + 3u]));
        let S: f32 = max(dot(c, vec4f(pig[124u + 4u * w], pig[124u + 4u * w + 1u], pig[124u + 4u * w + 2u], pig[124u + 4u * w + 3u])), 1.0e-6);
        // sinh and cosh from one exp: WARP's sinh and cosh were off by about 1e-4 relative at z
        // near 13, enough to flip a nearly cancelled channel (yellow's blue), whose glaze ratio is
        // floored at 1e-4 and so magnifies an absolute error by 1e4 (bounds-11 runs, first WARP run).
        // b and a small z keep f32 precision in forms equal to the reference's.
        let ks: f32 = K / S;
        let a: f32 = 1.0 + ks;
        let b: f32 = sqrt(ks * (2.0 + ks));
        let z: f32 = min(b * S * X, 30.0);
        let ez: f32 = exp(z);
        var sh: f32 = 0.5 * (ez - 1.0 / ez);
        if (z < 0.1) { sh = z * (1.0 + z * z * (1.0 / 6.0 + z * z / 120.0)); }
        let chh: f32 = 0.5 * (ez + 1.0 / ez);
        let den: f32 = a * sh + b * chh;
        let R: f32 = sh / den;
        let Tt: f32 = b / den;
        let Rt: f32 = R + (Tt * Tt * Rg) / (1.0 - R * Rg);
        o = o + Rt * vec3f(pig[248u + 3u * w], pig[248u + 3u * w + 1u], pig[248u + 3u * w + 2u]);
    }
    return o;
}
fn wpow(v: f32, e: f32) -> f32 {
    if (v <= 0.0) { return 0.0; }
    return pow(v, e);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let x: f32 = f32(i % U.width);
    let y: f32 = f32(i / U.width);
    var wv: vec2f = vec2f(0.0);
    if (U.d.y > 0.0) { wv = vec2f(cnoise(5u, x, y, 0.0), cnoise(6u, x, y, 0.0)); }
    let sx: f32 = x + wv.x * U.d.y;
    let sy: f32 = y + wv.y * U.d.y;
    var c: vec4f = lat_at(sx, sy, 0u);
    let res: vec3f = lat_at(sx, sy, 1u).xyz;
    let dec0: vec3f = km_decode(c);
    let D: vec3f = max(dec0 + res, vec3f(0.0));
    let v: f32 = clamp(0.2126 * D.x + 0.7152 * D.y + 0.0722 * D.z, 0.0, 1.0);
    let mx: f32 = max(D.x, max(D.y, D.z));
    let mn: f32 = min(D.x, min(D.y, D.z));
    let keep: f32 = pt_smooth(0.15, 0.6, (mx - mn) / max(mx, 1.0e-3));
    let pk: f32 = U.b.w * (1.0 - 0.85 * keep);
    c.w = c.w + pk * (1.0 - v) * (1.0 - v);
    c.z = c.z + 0.6 * pk * (1.0 - v) * (1.0 - v);
    c.y = c.y + pk * 0.08 * v * v;
    let jit: f32 = (hs_at(sx, sy).y - 0.5) * 2.0;
    let rel: vec4f = rl_at(sx, sy);
    let bk: f32 = U.c.x * (1.0 - 0.85 * v * v) * (1.0 - 0.7 * keep);
    c.y = c.y + bk * max(jit, 0.0);
    c.w = c.w + bk * max(-jit, 0.0);
    c.z = c.z + 0.5 * bk * abs(jit) * (1.0 - v);
    c = c / (c.x + c.y + c.z + c.w);
    var rgb: vec3f = D * min(vec3f(4.0), (km_decode(c) + vec3f(0.01)) / (dec0 + vec3f(0.01)));
    if (U.c.y > 0.0) {
        let vy: f32 = 0.2126 * rgb.x + 0.7152 * rgb.y + 0.0722 * rgb.z;
        let f: f32 = min(vy, 1.0) * U.c.y;
        let fl: f32 = floor(f);
        let vq: f32 = max(min(vy, 0.02), (fl + pt_smooth(0.3, 0.7, f - fl)) / U.c.y);
        let g: f32 = 1.0 + (vq / max(vy, 1.0e-6) - 1.0) * (1.0 - 0.6 * keep);
        rgb = rgb * g;
    }
    let paper: f32 = cnoise(3u, x, y, 0.5);
    if (U.medium == 2u) {
        let valley: f32 = cnoise(4u, x, y, 0.5);
        let Rg: f32 = 0.86 * (0.93 + 0.07 * paper);
        let X0: f32 = 1.5;
        let X: f32 = X0 * (1.0 + U.d.z * (0.5 - valley) * 2.0) * (1.0 + U.d.w * rel.w);
        let g0: vec3f = glaze(c, X0, 0.86);
        let g1: vec3f = glaze(c, X, Rg);
        let lw: vec3f = vec3f(0.2126, 0.7152, 0.0722);
        let sr: f32 = dot(lw, g1) / max(dot(lw, g0), 1.0e-4);
        let ratio: vec3f = clamp(vec3f(sr) + (g1 / max(g0, vec3f(1.0e-4)) - vec3f(sr)) * keep, vec3f(0.5), vec3f(2.0));
        let wc: vec3f = clamp(rgb * ratio, vec3f(0.0), vec3f(1.0));
        rgb = vec3f(wpow(wc.x, U.e.x), wpow(wc.y, U.e.x), wpow(wc.z, U.e.x));
    } else {
        rgb = rgb * rel.y + vec3f(rel.z);
    }
    let t: f32 = 1.0 - U.c.z * (1.0 - rel.x);
    // alpha carries the line factor for P23's defocus; colour checks skip alpha
    out8[i] = (pack_rgb8(max(rgb * t, vec3f(0.0))) & 0x00ffffffu) | (u32(floor(clamp(t, 0.0, 1.0) * 255.0 + 0.5)) << 24u);
}

//@pass style_canvas_decide
// The advected canvas: one invocation reads last frame's distortion sums, ages the two layers and
// regenerates a distorted one with a fresh seed. K: per layer age, seed x, seed y, mean
// distortion, reset (5 a layer), then the frame count at 10. S: distortion sums and counts.
@group(0) @binding(0) var<uniform> U: PaintGpuParams;
@group(0) @binding(1) var<storage, read_write> K: array<f32>;
@group(0) @binding(2) var<storage, read_write> S: array<u32>;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    if (gidx > 0u || U.width == 0u) { return; }
    let frame: f32 = K[10];
    for (var k: u32 = 0u; k < 2u; k++) {
        let n: u32 = S[2u + k];
        var md: f32 = 0.0;
        if (n > 0u) { md = f32(S[k]) / 4096.0 / f32(n); }
        K[5u * k + 3u] = md;
        if (K[5u * k] >= 0.0) { K[5u * k] = min(1.0e6, K[5u * k] + 1.0); }
        K[5u * k + 4u] = 0.0;
    }
    // The layer to wake (2: none). Written once after the choice: dxc refuses a UAV store from a
    // helper called inside the search loop.
    var wk: u32 = 2u;
    if (frame == 0.0) {
        wk = 0u;
    } else {
        if (K[0] >= 0.0 && K[3] > 0.35 && (K[5] < 0.0 || (K[5] >= 12.0 && K[8] > 0.175))) { wk = 1u; }
        else if (K[5] >= 0.0 && K[8] > 0.35 && (K[0] < 0.0 || (K[0] >= 12.0 && K[3] > 0.175))) { wk = 0u; }
    }
    if (wk < 2u) {
        K[5u * wk] = 0.0;
        K[5u * wk + 3u] = 0.0;
        K[5u * wk + 4u] = 1.0;
        K[5u * wk + 1u] = hash3(u32(frame), wk, 101u) * 997.0;
        K[5u * wk + 2u] = hash3(u32(frame), wk, 103u) * 997.0;
    }
    if (frame == 0.0) { K[0] = 8.0; }
    for (var j: u32 = 0u; j < 4u; j++) { S[j] = 0u; }
    K[10] = frame + 1.0;
}

//@pass style_canvas_advect
// The advected canvas: each pixel fetches last frame's canvas coordinates along its motion vector
// (bilinear), or starts fresh at the pixel plus the layer seed where reprojection fails the depth
// test or the layer was regenerated.
@group(0) @binding(0) var<uniform> U: PaintGpuParams;
@group(0) @binding(1) var<storage, read> K: array<f32>;
@group(0) @binding(2) var<storage, read> Cprev: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> Cnew: array<vec4f>;
@group(0) @binding(4) var<storage, read> mv: array<vec2f>;
@group(0) @binding(5) var<storage, read> dd: array<vec2f>;
@group(0) @binding(6) var<storage, read> pd_in: array<f32>;
@group(0) @binding(7) var<storage, read_write> pd_out: array<f32>;

fn cprev(x: f32, y: f32) -> vec4f {
    let w: i32 = i32(U.width);
    let h: i32 = i32(U.height);
    let fx: f32 = clamp(x, 0.0, f32(w - 1));
    let fy: f32 = clamp(y, 0.0, f32(h - 1));
    let x0: i32 = i32(floor(fx));
    let y0: i32 = i32(floor(fy));
    let x1: i32 = min(w - 1, x0 + 1);
    let y1: i32 = min(h - 1, y0 + 1);
    let tx: f32 = fx - f32(x0);
    let ty: f32 = fy - f32(y0);
    return (Cprev[u32(y0 * w + x0)] * (1.0 - tx) + Cprev[u32(y0 * w + x1)] * tx) * (1.0 - ty) + (Cprev[u32(y1 * w + x0)] * (1.0 - tx) + Cprev[u32(y1 * w + x1)] * tx) * ty;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let p: u32 = gidx;
    if (p >= U.width * U.height) { return; }
    let w: i32 = i32(U.width);
    let h: i32 = i32(U.height);
    let x: f32 = f32(p % U.width);
    let y: f32 = f32(p / U.width);
    let px: f32 = x - mv[p].x;
    let py: f32 = y - mv[p].y;
    let q: u32 = u32(clamp(i32(floor(py + 0.5)), 0, h - 1) * w + clamp(i32(floor(px + 0.5)), 0, w - 1));
    let inside: bool = px >= 0.0 && py >= 0.0 && px <= f32(w - 1) && py <= f32(h - 1);
    let valid: bool = inside && pd_in[q] > 0.0 && abs(pd_in[q] - dd[p].y) <= 0.02 * dd[p].y;
    let old: vec4f = cprev(px, py);
    var o: vec4f = old;
    if (K[4] > 0.5 || !valid) {
        o.x = x + K[1];
        o.y = y + K[2];
    }
    if (K[9] > 0.5 || !valid) {
        o.z = x + K[6];
        o.w = y + K[7];
    }
    Cnew[p] = o;
    pd_out[p] = dd[p].x;
}

//@pass style_canvas_distort
// The advected canvas: each layer's mean distortion (the departure of the coordinate field's local
// scale from 1, rotation free), summed as integers so CPU and GPU sums agree.
@group(0) @binding(0) var<uniform> U: PaintGpuParams;
@group(0) @binding(1) var<storage, read> Cn: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> S: array<atomic<u32>>;

fn departure(a: f32, b: f32, c: f32, d: f32) -> f32 {
    let E: f32 = a * a + b * b + c * c + d * d;
    let det: f32 = abs(a * d - b * c);
    let disc: f32 = sqrt(max(0.0, E * E - 4.0 * det * det));
    let s1: f32 = sqrt(max(1.0e-12, (E + disc) / 2.0));
    let s2: f32 = sqrt(max(1.0e-12, (E - disc) / 2.0));
    return abs(log(s1)) + abs(log(s2));
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let p: u32 = gidx;
    if (p >= U.width * U.height) { return; }
    let w: u32 = U.width;
    let x: u32 = p % w;
    let y: u32 = p / w;
    if (x < 1u || y < 1u || x >= w - 1u || y >= U.height - 1u) { return; }
    let r: vec4f = Cn[p + 1u];
    let l: vec4f = Cn[p - 1u];
    let dn: vec4f = Cn[p + w];
    let up: vec4f = Cn[p - w];
    let D0: f32 = departure((r.x - l.x) / 2.0, (dn.x - up.x) / 2.0, (r.y - l.y) / 2.0, (dn.y - up.y) / 2.0);
    if (D0 <= 1.0) {
        atomicAdd(&S[0], u32(floor(D0 * 4096.0)));
        atomicAdd(&S[2], 1u);
    }
    let D1: f32 = departure((r.z - l.z) / 2.0, (dn.z - up.z) / 2.0, (r.w - l.w) / 2.0, (dn.w - up.w) / 2.0);
    if (D1 <= 1.0) {
        atomicAdd(&S[1], u32(floor(D1 * 4096.0)));
        atomicAdd(&S[3], 1u);
    }
}

