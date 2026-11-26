//@pass style_crtp_encode
// The physical CRT (raw/renderer/style_crt.hpp), signal pass 1: a line of the source sampled at
// 4 fsc; RGB through the video bandwidth, or luma and the modulated chroma on the wire.
@group(0) @binding(0) var<uniform> U: CrtpGpuParams;
@group(0) @binding(1) var<storage, read> P: array<f32>;
@group(0) @binding(2) var<storage, read> src: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> enc: array<vec4f>;

fn cp_i(i: u32) -> i32 {
    return i32(floor(P[i] + 0.5));
}
fn frac1(x: f32) -> f32 {
    return x - floor(x);
}
fn phase(k: i32, y: i32) -> f32 {
    return 6.283185307179586 * (f32(k & 3) / 4.0 + frac1(f32(y) * P[CP_lineCyc]) + frac1(f32(U.frame) * P[CP_frameCyc]));
}
fn pal_sign(y: i32) -> f32 {
    return select(-1.0, 1.0, (y & 1) == 0);
}
fn tap(which: u32, j: i32) -> f32 {
    return P[CP_taps + u32(cp_i(which) + j + cp_i(which + 1u))];
}
fn held(y: i32, k: i32, c: u32) -> f32 {
    let n: i32 = cp_i(CP_N);
    let kk: i32 = clamp(k, 0, n - 1);
    let sw: i32 = cp_i(CP_srcW);
    let x: i32 = min(sw - 1, ((2 * kk + 1) * sw) / (2 * n));
    let v: vec4f = src[u32(y * sw + x)];
    if (c == 0u) { return v.x; }
    if (c == 1u) { return v.y; }
    return v.z;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let n: i32 = cp_i(CP_N);
    let nl: i32 = cp_i(CP_lines);
    let idx: i32 = i32(gidx);
    if (idx >= n * nl) { return; }
    let k: i32 = idx % n;
    let y: i32 = idx / n;
    if (cp_i(CP_mode) == 0) {
        let hr: i32 = cp_i(CP_tapRgb + 1u);
        var s: vec3f = vec3f(0.0);
        for (var jr: i32 = -hr; jr <= hr; jr++) {
            let t: f32 = tap(CP_tapRgb, jr);
            s = s + t * vec3f(held(y, k + jr, 0u), held(y, k + jr, 1u), held(y, k + jr, 2u));
        }
        enc[u32(idx)] = vec4f(s, 0.0);
        return;
    }
    let r: f32 = held(y, k, 0u);
    let g: f32 = held(y, k, 1u);
    let b: f32 = held(y, k, 2u);
    let h: i32 = cp_i(CP_tapEnc + 1u);
    var a: f32 = 0.0;
    var q: f32 = 0.0;
    for (var j: i32 = -h; j <= h; j++) {
        let rr: f32 = held(y, k + j, 0u);
        let gg: f32 = held(y, k + j, 1u);
        let bb: f32 = held(y, k + j, 2u);
        let ca: f32 = P[CP_fwd + 3u] * rr + P[CP_fwd + 4u] * gg + P[CP_fwd + 5u] * bb;
        let cq: f32 = P[CP_fwd + 6u] * rr + P[CP_fwd + 7u] * gg + P[CP_fwd + 8u] * bb;
        let t: f32 = tap(CP_tapEnc, j);
        a = a + t * ca;
        q = q + t * cq;
    }
    let ph: f32 = phase(k, y);
    var c: f32 = a * cos(ph) + q * sin(ph);
    if (cp_i(CP_pal) == 1) { c = a * sin(ph) + pal_sign(y) * q * cos(ph); }
    enc[u32(idx)] = vec4f(0.299 * r + 0.587 * g + 0.114 * b, c, 0.0, 0.0);
}

//@pass style_crtp_separate
// Signal pass 2: the decoder separates luma and chroma with a one-line comb or a notch.
@group(0) @binding(0) var<uniform> U: CrtpGpuParams;
@group(0) @binding(1) var<storage, read> P: array<f32>;
@group(0) @binding(2) var<storage, read> enc: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> sep: array<vec4f>;

fn cp_i(i: u32) -> i32 {
    return i32(floor(P[i] + 0.5));
}
fn tap(which: u32, j: i32) -> f32 {
    return P[CP_taps + u32(cp_i(which) + j + cp_i(which + 1u))];
}
fn comp(y: i32, k: i32) -> f32 {
    let n: i32 = cp_i(CP_N);
    let e: vec4f = enc[u32(y * n + clamp(k, 0, n - 1))];
    return e.x + e.y;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let n: i32 = cp_i(CP_N);
    let nl: i32 = cp_i(CP_lines);
    let idx: i32 = i32(gidx);
    if (idx >= n * nl || U.pad0 == 7u) { return; }
    let k: i32 = idx % n;
    let y: i32 = idx / n;
    if (cp_i(CP_mode) == 1) {
        sep[u32(idx)] = vec4f(enc[u32(idx)].x, enc[u32(idx)].y, 0.0, 0.0);
        return;
    }
    var yl: f32 = 0.0;
    if (cp_i(CP_comb) == 1) {
        let y2: i32 = select(min(1, nl - 1), y - 1, y > 0);
        yl = 0.5 * (comp(y, k) + comp(y2, k));
    } else {
        let h: i32 = cp_i(CP_tapSep + 1u);
        for (var j: i32 = -h; j <= h; j++) {
            yl = yl + tap(CP_tapSep, j) * comp(y, k + j);
        }
    }
    sep[u32(idx)] = vec4f(yl, comp(y, k) - yl, 0.0, 0.0);
}

//@pass style_crtp_demod
// Signal pass 3: the chroma demodulated with the I and Q (or U and V) low-passes, back to R'G'B'.
@group(0) @binding(0) var<uniform> U: CrtpGpuParams;
@group(0) @binding(1) var<storage, read> P: array<f32>;
@group(0) @binding(2) var<storage, read> sep: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> sig: array<vec4f>;

fn cp_i(i: u32) -> i32 {
    return i32(floor(P[i] + 0.5));
}
fn frac1(x: f32) -> f32 {
    return x - floor(x);
}
fn phase(k: i32, y: i32) -> f32 {
    return 6.283185307179586 * (f32(k & 3) / 4.0 + frac1(f32(y) * P[CP_lineCyc]) + frac1(f32(U.frame) * P[CP_frameCyc]));
}
fn pal_sign(y: i32) -> f32 {
    return select(-1.0, 1.0, (y & 1) == 0);
}
fn tap(which: u32, j: i32) -> f32 {
    return P[CP_taps + u32(cp_i(which) + j + cp_i(which + 1u))];
}
fn chroma(y: i32, k: i32) -> f32 {
    let n: i32 = cp_i(CP_N);
    return sep[u32(y * n + clamp(k, 0, n - 1))].y;
}
fn demod_line(y: i32, k: i32) -> vec2f {
    let pal: bool = cp_i(CP_pal) == 1;
    var a: f32 = 0.0;
    var b: f32 = 0.0;
    let hi: i32 = cp_i(CP_tapI + 1u);
    for (var j: i32 = -hi; j <= hi; j++) {
        let ph: f32 = phase(k + j, y);
        a = a + tap(CP_tapI, j) * 2.0 * chroma(y, k + j) * select(cos(ph), sin(ph), pal);
    }
    let hq: i32 = cp_i(CP_tapQ + 1u);
    for (var jq: i32 = -hq; jq <= hq; jq++) {
        let phq: f32 = phase(k + jq, y);
        b = b + tap(CP_tapQ, jq) * 2.0 * chroma(y, k + jq) * select(sin(phq), pal_sign(y) * cos(phq), pal);
    }
    return vec2f(a, b);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let n: i32 = cp_i(CP_N);
    let nl: i32 = cp_i(CP_lines);
    let idx: i32 = i32(gidx);
    if (idx >= n * nl) { return; }
    let k: i32 = idx % n;
    let y: i32 = idx / n;
    let h: i32 = cp_i(CP_tapLum + 1u);
    var yy: f32 = 0.0;
    for (var j: i32 = -h; j <= h; j++) {
        yy = yy + tap(CP_tapLum, j) * sep[u32(y * n + clamp(k + j, 0, n - 1))].x;
    }
    var ab: vec2f = demod_line(y, k);
    if (cp_i(CP_pal) == 1 && y > 0) { ab = 0.5 * (ab + demod_line(y - 1, k)); }
    let m: u32 = CP_inv;
    sig[u32(idx)] = vec4f(P[m] * yy + P[m + 1u] * ab.x + P[m + 2u] * ab.y, P[m + 3u] * yy + P[m + 4u] * ab.x + P[m + 5u] * ab.y, P[m + 6u] * yy + P[m + 7u] * ab.x + P[m + 8u] * ab.y, 0.0);
}

//@pass style_crtp_beam
// The beams and the phosphor: each gun's current through the tube's power law, a gaussian spot
// that grows with current integrated over the output pixel's footprint on the curved face, the
// mask, and two-term phosphor decay with the history carried between frames.
@group(0) @binding(0) var<uniform> U: CrtpGpuParams;
@group(0) @binding(1) var<storage, read> P: array<f32>;
@group(0) @binding(2) var<storage, read> sig: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> hist: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> em: array<vec4f>;

fn cp_i(i: u32) -> i32 {
    return i32(floor(P[i] + 0.5));
}
fn face_at(px: f32, py: f32) -> vec2f {
    let x: f32 = (px - P[CP_outW] / 2.0) * (P[CP_viewW] / P[CP_outW]) + P[CP_cx];
    let y: f32 = (py - P[CP_outH] / 2.0) * (P[CP_viewH] / P[CP_outH]) + P[CP_cy];
    let d: f32 = P[CP_dist];
    let a: f32 = x * x / (2.0 * P[CP_rx]) + y * y / (2.0 * P[CP_ry]);
    let t: f32 = 2.0 * d / (d + sqrt(max(0.0, d * d - 4.0 * a * d)));
    return vec2f(t * x, t * y);
}
fn footprint(px: f32, py: f32) -> vec4f {
    let c: vec2f = face_at(px + 0.5, py + 0.5);
    let xp: vec2f = face_at(px + 1.0, py + 0.5);
    let xm: vec2f = face_at(px, py + 0.5);
    let yp: vec2f = face_at(px + 0.5, py + 1.0);
    let ym: vec2f = face_at(px + 0.5, py);
    let hx: f32 = 0.5 * (abs(xp.x - xm.x) + abs(yp.x - ym.x));
    let hy: f32 = 0.5 * (abs(xp.y - xm.y) + abs(yp.y - ym.y));
    return vec4f(c, max(hx, 1.0e-4), max(hy, 1.0e-4));
}
fn face_alpha(sx: f32, sy: f32, hx: f32, hy: f32) -> f32 {
    let r: f32 = P[CP_corner];
    let qx: f32 = abs(sx) - (P[CP_faceW] / 2.0 - r);
    let qy: f32 = abs(sy) - (P[CP_faceH] / 2.0 - r);
    let d: f32 = length(vec2f(max(qx, 0.0), max(qy, 0.0))) + min(max(qx, qy), 0.0) - r;
    return clamp(0.5 - d / (2.0 * max(hx, hy)), 0.0, 1.0);
}
fn dampen(cov0: f32, sy: f32, hy: f32) -> f32 {
    var cov: f32 = cov0;
    if (cp_i(CP_maskType) != 1) { return cov; }
    for (var i: i32 = 0; i < cp_i(CP_nDampers); i++) {
        let dc: f32 = (P[CP_dampers + u32(i)] - 0.5) * P[CP_faceH];
        let lo: f32 = max(sy - hy, dc - P[CP_damperW] / 2.0);
        let hi: f32 = min(sy + hy, dc + P[CP_damperW] / 2.0);
        if (hi > lo) { cov = cov * (1.0 - (hi - lo) / (2.0 * hy)); }
    }
    return cov;
}
fn stripe_mask(sx: f32, sy: f32, hx: f32, hy: f32, c: u32) -> f32 {
    let pp: f32 = P[CP_pitch];
    let fill: f32 = P[CP_fill];
    let w: f32 = fill * pp / 3.0;
    let s: f32 = f32(c) * pp / 3.0 + (1.0 - fill) * pp / 6.0;
    let a: f32 = 2.0 * hx;
    let m0: i32 = i32(floor((sx - a - s - w) / pp));
    let m1: i32 = i32(floor((sx + a - s) / pp));
    if (m1 - m0 > 32) { return P[CP_maskMean]; }
    var cov: f32 = 0.0;
    for (var k: i32 = m0; k <= m1; k++) {
        let x0: f32 = f32(k) * pp + s - sx;
        let xw: f32 = cp_tent_cdf(x0 + w, a) - cp_tent_cdf(x0, a);
        if (xw <= 0.0) { continue; }
        var yw: f32 = 1.0;
        if (cp_i(CP_maskType) == 2) {
            let py: f32 = P[CP_slotH] + P[CP_slotGap];
            yw = cp_pulse_box(sy - hy, sy + hy, py, P[CP_slotH], f32(k & 1) * py * 0.5);
        }
        cov = cov + xw * yw;
    }
    return dampen(cov, sy, hy);
}
fn pixel_stripe_mask(px: f32, py: f32, sy: f32, hy: f32, c: u32) -> f32 {
    let pp: f32 = P[CP_pitchPx];
    let fill: f32 = P[CP_fill];
    let w: f32 = fill * pp / 3.0;
    let s: f32 = f32(c) * pp / 3.0 + (1.0 - fill) * pp / 6.0;
    let k0: i32 = i32(floor((px - s - w) / pp));
    let k1: i32 = i32(floor((px + 1.0 - s) / pp));
    var cov: f32 = 0.0;
    for (var k: i32 = k0; k <= k1; k++) {
        let x0: f32 = max(px, f32(k) * pp + s);
        let x1: f32 = min(px + 1.0, f32(k) * pp + s + w);
        if (x1 <= x0) { continue; }
        var yw: f32 = 1.0;
        if (cp_i(CP_maskType) == 2) {
            let u: f32 = pp / P[CP_pitch];
            let pyy: f32 = (P[CP_slotH] + P[CP_slotGap]) * u;
            yw = cp_pulse_box(py, py + 1.0, pyy, P[CP_slotH] * u, f32(k & 1) * pyy * 0.5);
        }
        cov = cov + (x1 - x0) * yw;
    }
    return dampen(cov, sy, hy);
}
fn delta_mask(sx: f32, sy: f32, hx: f32, hy: f32) -> vec3f {
    let d: f32 = P[CP_pitch] / sqrt(3.0);
    let r: f32 = P[CP_fill] * d / 2.0;
    let rowh: f32 = d * sqrt(3.0) / 2.0;
    var o: vec3f = vec3f(0.0);
    let aa: f32 = min(0.75 * (hx + hy), r);
    for (var j: i32 = 0; j < 4; j++) {
        for (var i: i32 = 0; i < 4; i++) {
            let x: f32 = sx + ((f32(i) + 0.5) / 4.0 - 0.5) * 3.0 * hx;
            let y: f32 = sy + ((f32(j) + 0.5) / 4.0 - 0.5) * 3.0 * hy;
            let lj: i32 = i32(floor(y / rowh));
            for (var dj: i32 = 0; dj <= 1; dj++) {
                let jj: i32 = lj + dj;
                let li: i32 = i32(floor(x / d - f32(jj) / 2.0));
                for (var di: i32 = 0; di <= 1; di++) {
                    let ii: i32 = li + di;
                    let cx: f32 = (f32(ii) + f32(jj) / 2.0) * d;
                    let cy: f32 = f32(jj) * rowh;
                    let e: f32 = clamp(0.5 + (r - length(vec2f(x - cx, y - cy))) / aa, 0.0, 1.0);
                    let col: i32 = (((ii - jj) % 3) + 3) % 3;
                    if (e > 0.0 && col == 0) { o.x = o.x + e / 16.0; }
                    if (e > 0.0 && col == 1) { o.y = o.y + e / 16.0; }
                    if (e > 0.0 && col == 2) { o.z = o.z + e / 16.0; }
                }
            }
        }
    }
    let t: f32 = clamp((hx / P[CP_pitch] - 0.7) / 0.3, 0.0, 1.0);
    let bl: f32 = t * t * (3.0 - 2.0 * t);
    return o + (vec3f(P[CP_maskMean]) - o) * bl;
}
fn mask_cover(sx: f32, sy: f32, hx: f32, hy: f32, px: f32, py: f32) -> vec3f {
    let t: i32 = cp_i(CP_maskType);
    if (t == 0) { return vec3f(1.0); }
    var cov: vec3f = vec3f(stripe_mask(sx, sy, hx, hy, 0u), stripe_mask(sx, sy, hx, hy, 1u), stripe_mask(sx, sy, hx, hy, 2u));
    if (t == 3) { cov = delta_mask(sx, sy, hx, hy); }
    if (t != 3 && cp_i(CP_maskLock) == 1) { cov = vec3f(pixel_stripe_mask(px, py, sy, hy, 0u), pixel_stripe_mask(px, py, sy, hy, 1u), pixel_stripe_mask(px, py, sy, hy, 2u)); }
    let mx: f32 = P[CP_maskMix];
    return vec3f(1.0 - mx) + mx * cov / P[CP_maskMean];
}
fn gun_current(v: f32) -> f32 {
    return pow(max(P[CP_contrast] * v + P[CP_brightness], 0.0), P[CP_gamma]);
}
fn spot_sigma(i: f32) -> f32 {
    return P[CP_lineMm] * (P[CP_spotLo] + (P[CP_spotHi] - P[CP_spotLo]) * pow(min(i, 1.5), P[CP_spotExp]));
}
fn drive(c: u32, j: i32, k: i32) -> f32 {
    let s: vec4f = sig[u32(j * cp_i(CP_N) + k)];
    if (cp_i(CP_mono) == 1) { return 0.299 * s.x + 0.587 * s.y + 0.114 * s.z; }
    if (c == 0u) { return s.x; }
    if (c == 1u) { return s.y; }
    return s.z;
}
fn deposit(c: u32, rx: f32, ry: f32, hx: f32, hy: f32) -> f32 {
    let n: i32 = cp_i(CP_N);
    let nl: i32 = cp_i(CP_lines);
    let lmm: f32 = P[CP_lineMm];
    let rw: f32 = P[CP_rasterW];
    let rh: f32 = P[CP_rasterH];
    let dx: f32 = rw / f32(n);
    let smax: f32 = spot_sigma(1.5);
    let reachy: f32 = 3.0 * smax + hy;
    let reachx: f32 = 3.0 * smax + hx;
    let yl: f32 = (ry + rh / 2.0) / lmm - 0.5;
    let j0: i32 = max(0, i32(floor(yl - reachy / lmm)));
    let j1: i32 = min(nl - 1, i32(ceil(yl + reachy / lmm)));
    let kc: f32 = (rx + rw / 2.0) / dx - 0.5;
    let k0: i32 = max(0, i32(floor(kc - reachx / dx)));
    let k1: i32 = min(n - 1, i32(ceil(kc + reachx / dx)));
    let fld: i32 = i32(U.frame);
    var e: f32 = 0.0;
    for (var j: i32 = j0; j <= j1; j++) {
        if (cp_i(CP_interlace) == 1 && (j & 1) != (fld & 1)) { continue; }
        let yj: f32 = -rh / 2.0 + (f32(j) + 0.5) * lmm;
        for (var k: i32 = k0; k <= k1; k++) {
            let cur: f32 = gun_current(drive(c, j, k));
            if (cur <= 0.0) { continue; }
            let s: f32 = spot_sigma(cur);
            let xk: f32 = -rw / 2.0 + (f32(k) + 0.5) * dx;
            e = e + cur * cp_gauss_mass(rx - hx, rx + hx, xk, s) * cp_gauss_mass(ry - hy, ry + hy, yj, s);
        }
    }
    return e * dx * lmm / (4.0 * hx * hy);
}
// One component c: (emission this frame, history term 1, history term 2).
fn component(c: u32, e: f32, r1: f32, r2: f32, t0: f32) -> vec3f {
    let tt: f32 = P[CP_fieldT];
    let b: u32 = CP_decay + 5u * c;
    let w: f32 = P[b];
    let e1: f32 = P[b + 1u];
    let e2: f32 = P[b + 2u];
    let n1: f32 = exp(-(tt - t0) / P[b + 3u]);
    let n2: f32 = exp(-(tt - t0) / P[b + 4u]);
    return vec3f(r1 * (1.0 - e1) + r2 * (1.0 - e2) + e * (w * (1.0 - n1) + (1.0 - w) * (1.0 - n2)), r1 * e1 + e * w * n1, r2 * e2 + e * (1.0 - w) * n2);
}
fn conv_off(c: u32, sx: f32, sy: f32) -> vec2f {
    let k: f32 = P[CP_conv + 4u] / (P[CP_faceW] / 2.0);
    if (c == 0u) { return vec2f(P[CP_conv] + k * sx, P[CP_conv + 1u] + k * sy); }
    if (c == 2u) { return vec2f(P[CP_conv + 2u] - k * sx, P[CP_conv + 3u] - k * sy); }
    return vec2f(0.0);
}
fn energy(c: u32, lit: bool, mono: bool, mono_e: f32, cov: f32, sx: f32, sy: f32, hx: f32, hy: f32) -> f32 {
    if (lit && mono) { return mono_e * cov; }
    if (!lit) { return 0.0; }
    let o: vec2f = conv_off(c, sx, sy);
    return deposit(c, sx - o.x, sy - o.y, hx, hy) * cov;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let ww: u32 = u32(cp_i(CP_outW));
    let hh: u32 = u32(cp_i(CP_outH));
    let pix: u32 = gidx;
    if (pix >= ww * hh) { return; }
    let px: f32 = f32(pix % ww);
    let py: f32 = f32(pix / ww);
    let fp: vec4f = footprint(px, py);
    let sx: f32 = fp.x;
    let sy: f32 = fp.y;
    let hx: f32 = fp.z;
    let hy: f32 = fp.w;
    let alpha: f32 = face_alpha(sx, sy, hx, hy);
    let cover: vec3f = mask_cover(sx, sy, hx, hy, px, py);
    let t0: f32 = clamp((sy + P[CP_rasterH] / 2.0) / P[CP_rasterH], 0.0, 1.0) * P[CP_fieldT];
    let lit: bool = alpha > 0.0 && abs(sx) < P[CP_rasterW] / 2.0 + 3.0 * hx && abs(sy) < P[CP_rasterH] / 2.0 + 3.0 * hy;
    let mono: bool = cp_i(CP_mono) == 1;
    var mono_e: f32 = 0.0;
    if (lit && mono) { mono_e = deposit(0u, sx, sy, hx, hy); }
    let ra: vec4f = hist[2u * pix];
    let rb: vec4f = hist[2u * pix + 1u];
    let cr: vec3f = component(0u, energy(0u, lit, mono, mono_e, cover.x, sx, sy, hx, hy), ra.x, rb.x, t0);
    let cg: vec3f = component(1u, energy(1u, lit, mono, mono_e, cover.y, sx, sy, hx, hy), ra.y, rb.y, t0);
    let cb: vec3f = component(2u, energy(2u, lit, mono, mono_e, cover.z, sx, sy, hx, hy), ra.z, rb.z, t0);
    hist[2u * pix] = vec4f(cr.y, cg.y, cb.y, ra.w);
    hist[2u * pix + 1u] = vec4f(cr.z, cg.z, cb.z, rb.w);
    em[pix] = vec4f(cr.x, cg.x, cb.x, alpha);
}

//@pass style_crtp_halo_down
// The faceplate halo: the emission box-averaged into the halo grid.
@group(0) @binding(0) var<uniform> U: CrtpGpuParams;
@group(0) @binding(1) var<storage, read> P: array<f32>;
@group(0) @binding(2) var<storage, read> em: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> hd: array<vec4f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let gw: u32 = u32(floor(P[CP_gw] + 0.5));
    let gh: u32 = u32(floor(P[CP_gh] + 0.5));
    let q: u32 = u32(floor(P[CP_haloQ] + 0.5));
    let ww: u32 = u32(floor(P[CP_outW] + 0.5));
    let hh: u32 = u32(floor(P[CP_outH] + 0.5));
    if (gidx >= gw * gh || U.pad0 == 7u) { return; }
    let gx: u32 = gidx % gw;
    let gy: u32 = gidx / gw;
    var s: vec3f = vec3f(0.0);
    var n: f32 = 0.0;
    for (var y: u32 = gy * q; y < min(hh, gy * q + q); y++) {
        for (var x: u32 = gx * q; x < min(ww, gx * q + q); x++) {
            s = s + em[y * ww + x].xyz;
            n = n + 1.0;
        }
    }
    hd[gidx] = vec4f(s / n, 0.0);
}

//@pass style_crtp_halo_conv
// The halo grid convolved with the kernel derived from the glass optics (zero outside the frame).
@group(0) @binding(0) var<uniform> U: CrtpGpuParams;
@group(0) @binding(1) var<storage, read> P: array<f32>;
@group(0) @binding(2) var<storage, read> kern: array<f32>;
@group(0) @binding(3) var<storage, read> hd: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> hc: array<vec4f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let gw: i32 = i32(floor(P[CP_gw] + 0.5));
    let gh: i32 = i32(floor(P[CP_gh] + 0.5));
    let r: i32 = i32(floor(P[CP_haloR] + 0.5));
    let sz: i32 = 2 * r + 1;
    let idx: i32 = i32(gidx);
    if (idx >= gw * gh || U.pad0 == 7u) { return; }
    let x: i32 = idx % gw;
    let y: i32 = idx / gw;
    var s: vec3f = vec3f(0.0);
    for (var dy: i32 = -r; dy <= r; dy++) {
        let yy: i32 = y + dy;
        if (yy < 0 || yy >= gh) { continue; }
        for (var dx: i32 = -r; dx <= r; dx++) {
            let xx: i32 = x + dx;
            if (xx < 0 || xx >= gw) { continue; }
            s = s + kern[u32((dy + r) * sz + dx + r)] * hd[u32(yy * gw + xx)].xyz;
        }
    }
    hc[u32(idx)] = vec4f(s, 0.0);
}

//@pass style_crtp_compose
// The faceplate: the phosphor colour of the direct light and the halo, the room reflected in the
// curved glass, the black level it lights up and the bezel; then the display encode to RGBA8.
@group(0) @binding(0) var<uniform> U: CrtpGpuParams;
@group(0) @binding(1) var<storage, read> P: array<f32>;
@group(0) @binding(2) var<storage, read> em: array<vec4f>;
@group(0) @binding(3) var<storage, read> hc: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> out8: array<u32>;

fn face_at(px: f32, py: f32) -> vec2f {
    let x: f32 = (px - P[CP_outW] / 2.0) * (P[CP_viewW] / P[CP_outW]) + P[CP_cx];
    let y: f32 = (py - P[CP_outH] / 2.0) * (P[CP_viewH] / P[CP_outH]) + P[CP_cy];
    let d: f32 = P[CP_dist];
    let a: f32 = x * x / (2.0 * P[CP_rx]) + y * y / (2.0 * P[CP_ry]);
    let t: f32 = 2.0 * d / (d + sqrt(max(0.0, d * d - 4.0 * a * d)));
    return vec2f(t * x, t * y);
}
fn halo_at(px: f32, py: f32) -> vec3f {
    let q: f32 = P[CP_haloQ];
    let gw: i32 = i32(floor(P[CP_gw] + 0.5));
    let gh: i32 = i32(floor(P[CP_gh] + 0.5));
    let fx: f32 = clamp((px + 0.5) / q - 0.5, 0.0, f32(gw - 1));
    let fy: f32 = clamp((py + 0.5) / q - 0.5, 0.0, f32(gh - 1));
    let x0: i32 = i32(floor(fx));
    let y0: i32 = i32(floor(fy));
    let x1: i32 = min(gw - 1, x0 + 1);
    let y1: i32 = min(gh - 1, y0 + 1);
    let tx: f32 = fx - f32(x0);
    let ty: f32 = fy - f32(y0);
    let a: vec3f = hc[u32(y0 * gw + x0)].xyz;
    let b: vec3f = hc[u32(y0 * gw + x1)].xyz;
    let c: vec3f = hc[u32(y1 * gw + x0)].xyz;
    let d: vec3f = hc[u32(y1 * gw + x1)].xyz;
    return (a * (1.0 - tx) + b * tx) * (1.0 - ty) + (c * (1.0 - tx) + d * tx) * ty;
}
fn glass_reflection(sx: f32, sy: f32) -> f32 {
    let rx: f32 = P[CP_rx];
    let ry: f32 = P[CP_ry];
    let dd: f32 = P[CP_dist];
    let sz: f32 = sx * sx / (2.0 * rx) + sy * sy / (2.0 * ry);
    let iv: vec3f = normalize(vec3f(sx, sy, sz + dd));
    let nv: vec3f = normalize(vec3f(sx / rx, sy / ry, -1.0));
    let d: f32 = dot(iv, nv);
    return cp_fresnel_air(P[CP_glassN], acos(min(1.0, abs(d)))) * cp_room_env(iv - 2.0 * d * nv);
}
fn gamut_fit(rgb: vec3f) -> vec3f {
    let lw: vec3f = vec3f(P[CP_luma], P[CP_luma + 1u], P[CP_luma + 2u]);
    let y: f32 = max(0.0, dot(lw, rgb));
    let m: f32 = min(rgb.x, min(rgb.y, rgb.z));
    if (m >= 0.0) { return rgb; }
    return vec3f(y) + (y / (y - m)) * (rgb - vec3f(y));
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let ww: u32 = u32(floor(P[CP_outW] + 0.5));
    let hh: u32 = u32(floor(P[CP_outH] + 0.5));
    let pix: u32 = gidx;
    if (pix >= ww * hh || U.pad0 == 7u) { return; }
    let px: f32 = f32(pix % ww);
    let py: f32 = f32(pix / ww);
    let e: vec4f = em[pix];
    let a: f32 = e.w;
    let c: vec2f = face_at(px + 0.5, py + 0.5);
    let gun: vec3f = P[CP_haloDirect] * e.xyz + halo_at(px, py);
    let m: u32 = CP_M;
    let rgb: vec3f = gamut_fit(vec3f(P[m] * gun.x + P[m + 1u] * gun.y + P[m + 2u] * gun.z, P[m + 3u] * gun.x + P[m + 4u] * gun.y + P[m + 5u] * gun.z, P[m + 6u] * gun.x + P[m + 7u] * gun.y + P[m + 8u] * gun.z));
    let black: f32 = P[CP_ambient] * P[CP_transmission];
    let spec: f32 = P[CP_reflection] * glass_reflection(c.x, c.y);
    let bezel: vec3f = vec3f(P[CP_bezel], P[CP_bezel + 1u], P[CP_bezel + 2u]);
    let o: vec3f = a * (rgb + vec3f(black + spec)) + (1.0 - a) * bezel;
    let ex: f32 = P[CP_exposure];
    out8[pix] = cp_enc(o.x, ex) | (cp_enc(o.y, ex) << 8u) | (cp_enc(o.z, ex) << 16u) | (255u << 24u);
}
