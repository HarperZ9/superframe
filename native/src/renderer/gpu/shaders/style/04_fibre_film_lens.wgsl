//@pass style_fibre_field
// Fibre-network watercolour (raw/renderer/style_fibre.hpp): the paper, rasterised per pixel from
// the fibres of the 3 x 3 cells around it: coverage and the coverage-weighted orientation tensor
// in F, the crossing density in X.
@group(0) @binding(0) var<uniform> U: FibreParams;
@group(0) @binding(1) var<storage, read_write> F: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> X: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let x: i32 = i32(i % U.width);
    let y: i32 = i32(i / U.width);
    let C: f32 = U.a.x;
    let qx: f32 = f32(x) + 0.5;
    let qy: f32 = f32(y) + 0.5;
    let cx: i32 = i32(floor(qx / C));
    let cy: i32 = i32(floor(qy / C));
    var cov: f32 = 0.0;
    var cov2: f32 = 0.0;
    var t: vec3f = vec3f(0.0);
    for (var j: i32 = cy - 1; j <= cy + 1; j++) {
        for (var ii: i32 = cx - 1; ii <= cx + 1; ii++) {
            for (var k: i32 = 0; k < i32(U.per_cell); k++) {
                let a: u32 = u32(ii + 8192);
                let b: u32 = u32(j + 8192);
                let s: u32 = u32(k * 97 + 13);
                let fx: f32 = (f32(ii) + hash3(a, b, s)) * C;
                let fy: f32 = (f32(j) + hash3(a, b, s + 1u)) * C;
                let th: f32 = 3.141592653589793 * (U.a.w + U.b.x * (hash3(a, b, s + 2u) - 0.5));
                let dx: f32 = cos(th);
                let dy: f32 = sin(th);
                let hl: f32 = U.a.y * (0.6 + 0.8 * hash3(a, b, s + 3u)) / 2.0;
                let rx: f32 = qx - fx;
                let ry: f32 = qy - fy;
                let tt: f32 = clamp(rx * dx + ry * dy, -hl, hl);
                let ex: f32 = rx - tt * dx;
                let ey: f32 = ry - tt * dy;
                let c: f32 = clamp(0.5 * U.a.z + 0.5 - sqrt(ex * ex + ey * ey), 0.0, 1.0);
                if (c > 0.0) {
                    cov = cov + c;
                    cov2 = cov2 + c * c;
                    t = t + c * vec3f(dx * dx, dx * dy, dy * dy);
                }
            }
        }
    }
    F[i] = vec4f(cov, t);
    X[i] = 0.5 * (cov * cov - cov2);
}

//@pass style_fibre_tensor
// Fibre-network watercolour: the conductivity tensor (Kxx, Kxy, Kyy) from the field smoothed over
// a 7 x 7 box.
@group(0) @binding(0) var<uniform> U: FibreParams;
@group(0) @binding(1) var<storage, read> F: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> K: array<vec4f>;

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
    var acc: vec4f = vec4f(0.0);
    var n: f32 = 0.0;
    for (var yy: i32 = max(0, y - 3); yy <= min(h - 1, y + 3); yy++) {
        for (var xx: i32 = max(0, x - 3); xx <= min(w - 1, x + 3); xx++) {
            acc = acc + F[u32(yy * w + xx)];
            n = n + 1.0;
        }
    }
    let cm: f32 = acc.x / n;
    var s: f32 = 0.0;
    if (acc.x > 1.0e-12) { s = 1.0 / acc.x; }
    let g: f32 = U.b.z * min(1.0, cm);
    K[i] = vec4f(U.b.y + g * acc.y * s, g * acc.z * s, U.b.y + g * acc.w * s, 0.0);
}

//@pass style_fibre_init
// Fibre-network watercolour: the wash's pigment (absorbance against the paper) and its starting
// water, dry across strong edges; the deposit starts at zero.
@group(0) @binding(0) var<uniform> U: FibreParams;
@group(0) @binding(1) var<storage, read> src: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> S: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> D: array<vec4f>;

fn lum_at(x: i32, y: i32) -> f32 {
    let w: i32 = i32(U.width);
    let h: i32 = i32(U.height);
    let c: vec3f = src[u32(clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1))].xyz;
    return 0.2126 * c.x + 0.7152 * c.y + 0.0722 * c.z;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let x: i32 = i32(i % U.width);
    let y: i32 = i32(i / U.width);
    let c: vec3f = src[i].xyz;
    let a: vec3f = -log(max(vec3f(0.02), min(vec3f(1.0), c / U.paper.xyz))) * U.c.w;
    let gx: f32 = 0.5 * (lum_at(x + 1, y) - lum_at(x - 1, y));
    let gy: f32 = 0.5 * (lum_at(x, y + 1) - lum_at(x, y - 1));
    S[i] = vec4f(a, clamp(1.0 - U.paper.w * sqrt(gx * gx + gy * gy), 0.05, 1.0));
    D[i] = vec4f(0.0);
}

//@pass style_fibre_step
// Fibre-network watercolour: one explicit step of pigment flux along the eight links (the
// monotone stencil of the tensor), deposition raised at crossings, evaporation. Reads S, writes Sn.
@group(0) @binding(0) var<uniform> U: FibreParams;
@group(0) @binding(1) var<storage, read> K: array<vec4f>;
@group(0) @binding(2) var<storage, read> X: array<f32>;
@group(0) @binding(3) var<storage, read> S: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> Sn: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> D: array<vec4f>;

fn link_g(k: vec4f, l: i32) -> f32 {
    let ax: f32 = max(0.0, k.x - abs(k.y));
    let ay: f32 = max(0.0, k.z - abs(k.y));
    let dg: f32 = abs(k.y) / 2.0;
    let pos: bool = k.y >= 0.0;
    if (l < 2) { return ax; }
    if (l < 4) { return ay; }
    if (l < 6) { return select(0.0, dg, pos); }
    return select(dg, 0.0, pos);
}
fn link_d(l: i32) -> vec2i {
    if (l == 0) { return vec2i(1, 0); }
    if (l == 1) { return vec2i(-1, 0); }
    if (l == 2) { return vec2i(0, 1); }
    if (l == 3) { return vec2i(0, -1); }
    if (l == 4) { return vec2i(1, 1); }
    if (l == 5) { return vec2i(-1, -1); }
    if (l == 6) { return vec2i(1, -1); }
    return vec2i(-1, 1);
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
    let si: vec4f = S[i];
    let ki: vec4f = K[i];
    let dt: f32 = U.c.z;
    var flux: vec3f = vec3f(0.0);
    for (var l: i32 = 0; l < 8; l++) {
        let d: vec2i = link_d(l);
        let xx: i32 = x + d.x;
        let yy: i32 = y + d.y;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) { continue; }
        let j: u32 = u32(yy * w + xx);
        let sj: vec4f = S[j];
        let g: f32 = 0.5 * (link_g(ki, l) + link_g(K[j], l ^ 1)) * min(si.w, sj.w) * dt;
        flux = flux + g * (sj.xyz - si.xyz);
    }
    let dep: f32 = U.b.w * (1.0 + U.c.x * X[i]) * dt;
    let pc: vec3f = si.xyz + flux;
    let dd: vec3f = min(pc, dep * pc);
    Sn[i] = vec4f(pc - dd, max(0.0, si.w - U.c.y));
    D[i] = vec4f(D[i].xyz + dd, 0.0);
}

//@pass style_fibre_out
// Fibre-network watercolour: the dried wash, paper exp(-(suspended + deposited)), sRGB to RGBA8.
@group(0) @binding(0) var<uniform> U: FibreParams;
@group(0) @binding(1) var<storage, read> S: array<vec4f>;
@group(0) @binding(2) var<storage, read> D: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> out8: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let o: vec3f = U.paper.xyz * exp(-(S[i].xyz + D[i].xyz));
    out8[i] = pack_rgb8(o);
}

//@pass style_film_expose
// The spectral film shader (raw/renderer/style_film.hpp), first pass: gate weave, then the camera
// negative's three layer exposures from scene-linear Rec.709 (bilinear, clamped).
@group(0) @binding(0) var<uniform> U: FilmParams;
@group(0) @binding(1) var<storage, read> scene: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> H: array<vec4f>;

fn scene_at(x: f32, y: f32) -> vec3f {
    let W: i32 = i32(U.in_w);
    let Hh: i32 = i32(U.in_h);
    let fx: f32 = clamp(x, 0.0, f32(W - 1));
    let fy: f32 = clamp(y, 0.0, f32(Hh - 1));
    let x0: i32 = i32(floor(fx));
    let y0: i32 = i32(floor(fy));
    let x1: i32 = min(W - 1, x0 + 1);
    let y1: i32 = min(Hh - 1, y0 + 1);
    let tx: f32 = fx - f32(x0);
    let ty: f32 = fy - f32(y0);
    let a: vec3f = scene[u32(y0 * W + x0)].xyz;
    let b: vec3f = scene[u32(y0 * W + x1)].xyz;
    let c: vec3f = scene[u32(y1 * W + x0)].xyz;
    let d: vec3f = scene[u32(y1 * W + x1)].xyz;
    return (a * (1.0 - tx) + b * tx) * (1.0 - ty) + (c * (1.0 - tx) + d * tx) * ty;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.out_w * U.out_h) { return; }
    let x: f32 = f32(i % U.out_w);
    let y: f32 = f32(i / U.out_w);
    let sx: f32 = f32(U.in_w) / f32(U.out_w);
    let sy: f32 = f32(U.in_h) / f32(U.out_h);
    let c: vec3f = scene_at((x + 0.5 - U.a.z) * sx - 0.5, (y + 0.5 - U.a.w) * sy - 0.5);
    let k: f32 = U.a.x;
    H[i] = vec4f(k * dot(U.e0.xyz, c), k * dot(U.e1.xyz, c), k * dot(U.e2.xyz, c), 0.0);
}

//@pass style_film_mtf
// The film: one separable pass of the emulsion-scatter blur (mtf_dir 0 along x, 1 along y).
@group(0) @binding(0) var<uniform> U: FilmParams;
@group(0) @binding(1) var<storage, read> mw: array<f32>;
@group(0) @binding(2) var<storage, read> a: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> o: array<vec4f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.out_w * U.out_h) { return; }
    let W: i32 = i32(U.out_w);
    let Hh: i32 = i32(U.out_h);
    let x: i32 = i32(i % U.out_w);
    let y: i32 = i32(i / U.out_w);
    let r: i32 = i32(U.mtf_r);
    var s: vec3f = vec3f(0.0);
    for (var k: i32 = -r; k <= r; k++) {
        var xx: i32 = x;
        var yy: i32 = y;
        if (U.mtf_dir != 0u) { yy = clamp(y + k, 0, Hh - 1); } else { xx = clamp(x + k, 0, W - 1); }
        let j: u32 = u32(3 * (k + r));
        s = s + vec3f(mw[j], mw[j + 1u], mw[j + 2u]) * a[u32(yy * W + xx)].xyz;
    }
    o[i] = vec4f(s, 0.0);
}

//@pass style_film_halo_down
// The film: box-average the exposure into the halo grid (q x q cells).
@group(0) @binding(0) var<uniform> U: FilmParams;
@group(0) @binding(1) var<storage, read> em: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> hd: array<vec4f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.gw * U.gh) { return; }
    let gx: u32 = i % U.gw;
    let gy: u32 = i / U.gw;
    let q: u32 = U.halo_q;
    var s: vec3f = vec3f(0.0);
    var n: f32 = 0.0;
    for (var y: u32 = gy * q; y < min(U.out_h, gy * q + q); y++) {
        for (var x: u32 = gx * q; x < min(U.out_w, gx * q + q); x++) {
            s = s + em[y * U.out_w + x].xyz;
            n = n + 1.0;
        }
    }
    hd[i] = vec4f(s / n, 0.0);
}

//@pass style_film_halo_conv
// The film: the halo grid convolved with the kernel derived from the base's optics (zero outside
// the frame).
@group(0) @binding(0) var<uniform> U: FilmParams;
@group(0) @binding(1) var<storage, read> kern: array<f32>;
@group(0) @binding(2) var<storage, read> hd: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> hc: array<vec4f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.gw * U.gh) { return; }
    let gw: i32 = i32(U.gw);
    let gh: i32 = i32(U.gh);
    let R: i32 = i32(U.halo_r);
    let S: i32 = 2 * R + 1;
    let x: i32 = i32(i % U.gw);
    let y: i32 = i32(i / U.gw);
    var s: vec3f = vec3f(0.0);
    for (var dy: i32 = -R; dy <= R; dy++) {
        let yy: i32 = y + dy;
        if (yy < 0 || yy >= gh) { continue; }
        for (var dx: i32 = -R; dx <= R; dx++) {
            let xx: i32 = x + dx;
            if (xx < 0 || xx >= gw) { continue; }
            s = s + kern[u32((dy + R) * S + dx + R)] * hd[u32(yy * gw + xx)].xyz;
        }
    }
    hc[i] = vec4f(s, 0.0);
}

//@pass style_film_develop
// The film: each layer's developed dye fraction from its exposure plus the halation returned
// through the base, through the characteristic curve and interimage.
@group(0) @binding(0) var<uniform> U: FilmParams;
@group(0) @binding(1) var<storage, read> H: array<vec4f>;
@group(0) @binding(2) var<storage, read> hc: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> F: array<vec4f>;

fn pow10(x: f32) -> f32 {
    return exp2(x * 3.321928094887362);
}
fn log10f(x: f32) -> f32 {
    return log2(x) * 0.3010299956639812;
}
fn halo_up(x: u32, y: u32) -> vec3f {
    let q: f32 = f32(U.halo_q);
    let gw: i32 = i32(U.gw);
    let gh: i32 = i32(U.gh);
    let fx: f32 = clamp((f32(x) + 0.5) / q - 0.5, 0.0, f32(gw - 1));
    let fy: f32 = clamp((f32(y) + 0.5) / q - 0.5, 0.0, f32(gh - 1));
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

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.out_w * U.out_h) { return; }
    let hl: vec3f = halo_up(i % U.out_w, i / U.out_w);
    let h: vec3f = max(vec3f(1.0e-6), H[i].xyz + U.halo_s.xyz * hl);
    let lh: vec3f = vec3f(log10f(h.x), log10f(h.y), log10f(h.z));
    let D: vec3f = U.neg_dmin.xyz + U.neg_span.xyz / (vec3f(1.0) + exp(-U.neg_k.xyz * (lh - U.neg_x0.xyz)));
    let d: vec3f = D - U.neg_dmin.xyz;
    let m: f32 = (d.x + d.y + d.z) / 3.0;
    let Di: vec3f = U.neg_dmin.xyz + d + U.b.x * (d - vec3f(m));
    let dd: vec3f = min(U.neg_span.xyz, max(vec3f(0.0), Di - U.neg_dmin.xyz));
    let num: vec3f = vec3f(1.0 - pow10(-dd.x), 1.0 - pow10(-dd.y), 1.0 - pow10(-dd.z));
    let den: vec3f = vec3f(1.0 - pow10(-U.neg_span.x), 1.0 - pow10(-U.neg_span.y), 1.0 - pow10(-U.neg_span.z));
    F[i] = vec4f(num / den, 0.0);
}

//@pass style_film_print
// The film's last pass: Boolean-model grain on the negative (Monte Carlo over cloud discs, or the
// model's gaussian when clouds are much smaller than a pixel), then the full spectral print and
// projection, encoded to sRGB RGBA8.
@group(0) @binding(0) var<uniform> U: FilmParams;
@group(0) @binding(1) var<storage, read> tab: array<f32>;
@group(0) @binding(2) var<storage, read> pois: array<u32>;
@group(0) @binding(3) var<storage, read> F: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> out8: array<u32>;

const T_NEGPRIM: u32 = 0u;
const T_NEGCONST: u32 = 123u;
const T_PRINTW: u32 = 164u;
const T_PRINTPRIM: u32 = 287u;
const T_PROJV: u32 = 410u;
const T_J: u32 = 533u;
const FILM_NL: u32 = 41u;
const FILM_PI: f32 = 3.141592653589793;

fn pow10(x: f32) -> f32 {
    return exp2(x * 3.321928094887362);
}
fn log10f(x: f32) -> f32 {
    return log2(x) * 0.3010299956639812;
}
fn u_at(x: i32, y: i32, l: u32) -> f32 {
    let v: vec4f = F[u32(y) * U.out_w + u32(x)];
    if (l == 0u) { return v.x; }
    if (l == 1u) { return v.y; }
    return v.z;
}
fn table_at(u: f32) -> f32 {
    let f: f32 = clamp(u * 32.0, 0.0, 32.0);
    let i: u32 = min(31u, u32(floor(f)));
    return tab[T_J + i] + (tab[T_J + i + 1u] - tab[T_J + i]) * (f - f32(i));
}
fn pick(v: vec4f, l: u32) -> f32 {
    if (l == 0u) { return v.x; }
    if (l == 1u) { return v.y; }
    return v.z;
}
fn grain_mc(px: u32, py: u32, l: u32, r: f32) -> f32 {
    let um: f32 = U.a.y;
    let rpx: f32 = r / um;
    let W: i32 = i32(U.out_w);
    let Hh: i32 = i32(U.out_h);
    let ns: u32 = u32(min(64.0, max(8.0, ceil(12.0 / (FILM_PI * rpx * rpx)))));
    let seed: u32 = U.frame * 3u + l;
    let mu_max: f32 = 2.198806796638283;
    var hit: f32 = 0.0;
    for (var s: u32 = 0u; s < ns; s++) {
        let x: f32 = (f32(px) + hash3(px, py, seed * 131u + 2u * s)) * um;
        let y: f32 = (f32(py) + hash3(px, py, seed * 131u + 2u * s + 1u)) * um;
        let cx0: i32 = i32(floor(x / r));
        let cy0: i32 = i32(floor(y / r));
        var cov: f32 = 0.0;
        for (var cy: i32 = cy0 - 1; cy <= cy0 + 1 && cov < 1.0; cy++) {
            for (var cx: i32 = cx0 - 1; cx <= cx0 + 1 && cov < 1.0; cx++) {
                let qx: i32 = clamp(i32(floor((f32(cx) + 0.5) * r / um)), 0, W - 1);
                let qy: i32 = clamp(i32(floor((f32(cy) + 0.5) * r / um)), 0, Hh - 1);
                let u: f32 = min(0.999, u_at(qx, qy, l));
                let mu: f32 = -log(1.0 - u) / FILM_PI;
                let ucx: u32 = bitcast<u32>(cx);
                let ucy: u32 = bitcast<u32>(cy);
                let hu: u32 = pcg(ucx ^ pcg(ucy ^ pcg(seed * 977u + 1u)));
                let mq: u32 = u32(clamp(floor(mu / mu_max * 512.0), 0.0, 511.0));
                var k: u32 = 0u;
                for (var kk: u32 = 0u; kk < 16u; kk++) {
                    if (hu < pois[mq * 16u + kk]) { break; }
                    k = k + 1u;
                }
                for (var g: u32 = 0u; g < k; g++) {
                    let gx: f32 = (f32(cx) + hash3(ucx, ucy, seed * 977u + 2u + 2u * g)) * r;
                    let gy: f32 = (f32(cy) + hash3(ucx, ucy, seed * 977u + 3u + 2u * g)) * r;
                    let e: f32 = clamp(0.5 + (r - length(vec2f(x - gx, y - gy))) / (0.05 * r), 0.0, 1.0);
                    cov = max(cov, e);
                }
            }
        }
        hit = hit + cov;
    }
    return hit / f32(ns);
}
fn grain_analytic(px: u32, py: u32, l: u32, u: f32, r: f32) -> f32 {
    let seed: u32 = U.frame * 3u + l;
    let u1: f32 = max(1.0e-7, hash3(px, py, seed * 131u + 200u));
    let u2: f32 = hash3(px, py, seed * 131u + 201u);
    let z: f32 = sqrt(-2.0 * log(u1)) * cos(6.283185307179586 * u2);
    let um: f32 = U.a.y;
    return u + sqrt(table_at(u) * r * r / (um * um)) * z;
}
fn grain_at(px: u32, py: u32, l: u32) -> f32 {
    let u: f32 = u_at(i32(px), i32(py), l);
    let r: f32 = pick(U.grain_r, l);
    if (r <= 0.0) { return u; }
    let t: f32 = clamp((r / U.a.y - 0.25) / 0.15, 0.0, 1.0);
    let w: f32 = t * t * (3.0 - 2.0 * t);
    var v: f32 = u;
    if (w >= 1.0) {
        v = grain_mc(px, py, l, r);
    } else if (w <= 0.0) {
        v = grain_analytic(px, py, l, u, r);
    } else {
        let a: f32 = grain_mc(px, py, l, r) - u;
        let b: f32 = grain_analytic(px, py, l, u, r) - u;
        v = u + w * a + sqrt(1.0 - w * w) * b;
    }
    return clamp(u + (v - u) * pick(U.grain_cs, l), 0.0, 1.0);
}
fn neg_density(px: u32, py: u32, l: u32) -> f32 {
    let g: f32 = grain_at(px, py, l);
    let span: f32 = pick(U.neg_span, l);
    return pick(U.neg_dmin, l) - log10f(max(1.0e-6, 1.0 - g * (1.0 - pow10(-span))));
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.out_w * U.out_h) { return; }
    let px: u32 = i % U.out_w;
    let py: u32 = i / U.out_w;
    let D: vec3f = vec3f(neg_density(px, py, 0u), neg_density(px, py, 1u), neg_density(px, py, 2u));
    var hp: vec3f = vec3f(0.0);
    for (var w: u32 = 0u; w < FILM_NL; w++) {
        let p: vec3f = vec3f(tab[T_NEGPRIM + 3u * w], tab[T_NEGPRIM + 3u * w + 1u], tab[T_NEGPRIM + 3u * w + 2u]);
        let T: f32 = pow10(-(dot(D, p) + tab[T_NEGCONST + w]));
        hp = hp + T * vec3f(tab[T_PRINTW + 3u * w], tab[T_PRINTW + 3u * w + 1u], tab[T_PRINTW + 3u * w + 2u]);
    }
    let lh: vec3f = vec3f(log10f(max(hp.x, 1.0e-12)), log10f(max(hp.y, 1.0e-12)), log10f(max(hp.z, 1.0e-12))) + U.log_gain.xyz;
    let dp: vec3f = U.prt_dmin.xyz + U.prt_span.xyz / (vec3f(1.0) + exp(-U.prt_k.xyz * lh));
    let dm: vec3f = U.prt_dmin.xyz;
    let silver: f32 = U.b.y * (dp.x + dp.y + dp.z - dm.x - dm.y - dm.z) / 3.0;
    var xyz: vec3f = vec3f(0.0);
    for (var w2: u32 = 0u; w2 < FILM_NL; w2++) {
        let p: vec3f = vec3f(tab[T_PRINTPRIM + 3u * w2], tab[T_PRINTPRIM + 3u * w2 + 1u], tab[T_PRINTPRIM + 3u * w2 + 2u]);
        let T: f32 = pow10(-(dot(dp, p) + U.b.z + silver));
        xyz = xyz + T * vec3f(tab[T_PROJV + 3u * w2], tab[T_PROJV + 3u * w2 + 1u], tab[T_PROJV + 3u * w2 + 2u]);
    }
    let rgb: vec3f = vec3f(dot(U.out0.xyz, xyz), dot(U.out1.xyz, xyz), dot(U.out2.xyz, xyz));
    out8[i] = pack_rgb8(rgb);
}

//@pass style_lens_core
// The lens suite (raw/renderer/style_lens.hpp), core pass: each pixel of a kept tile gives up phi
// (per channel) of its over-threshold light to the lens terms.
@group(0) @binding(0) var<uniform> U: LensGpuParams;
@group(0) @binding(1) var<storage, read> img: array<vec4f>;
@group(0) @binding(2) var<storage, read> keep: array<u32>;
@group(0) @binding(3) var<storage, read_write> core: array<vec4f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let x: u32 = i % U.width;
    let y: u32 = i / U.width;
    let c: vec4f = img[i];
    var k: f32 = 0.0;
    if (keep[(y / U.tile) * U.tiles_x + x / U.tile] != 0u) {
        let Y: f32 = 0.2126 * c.x + 0.7152 * c.y + 0.0722 * c.z;
        if (Y > U.c.z) { k = (Y - U.c.z) / Y; }
    }
    core[i] = vec4f(c.x * (1.0 - U.phi.x * k), c.y * (1.0 - U.phi.y * k), c.z * (1.0 - U.phi.z * k), 1.0);
}

//@pass style_lens_gather
// The lens suite, gather pass: lateral dispersion resamples the core per wavelength bin, then
// every source adds its starburst, anamorphic streak, halation and ghosts; lab-encoded to RGBA8.
// bins: RGB weight (8 x 3), dispersion scale (8), halation gain and radius (8 x 2). srcs: 24
// floats a source (x, y, E, ghost factor per bin, streak factor per bin). ghosts: per pair and
// bin (m, radius, rotation, 1 / area).
@group(0) @binding(0) var<uniform> U: LensGpuParams;
@group(0) @binding(1) var<storage, read> core: array<vec4f>;
@group(0) @binding(2) var<storage, read> ghosts: array<f32>;
@group(0) @binding(3) var<storage, read> srcs: array<f32>;
@group(0) @binding(4) var<storage, read> star: array<f32>;
@group(0) @binding(5) var<storage, read> bins: array<f32>;
@group(0) @binding(6) var<storage, read_write> out8: array<u32>;

const LENS_TAU: f32 = 6.283185307179586;
const LENS_PI: f32 = 3.141592653589793;

fn rgbw(l: u32) -> vec3f {
    return vec3f(bins[l * 3u], bins[l * 3u + 1u], bins[l * 3u + 2u]);
}
fn samp(px: f32, py: f32) -> vec3f {
    let w: u32 = U.width;
    let h: u32 = U.height;
    let x: f32 = min(f32(w - 1u), max(0.0, px - 0.5));
    let y: f32 = min(f32(h - 1u), max(0.0, py - 0.5));
    let x0: u32 = min(w - 2u, u32(floor(x)));
    let y0: u32 = min(h - 2u, u32(floor(y)));
    let fx: f32 = x - f32(x0);
    let fy: f32 = y - f32(y0);
    let i: u32 = y0 * w + x0;
    return (core[i].xyz * (1.0 - fx) + core[i + 1u].xyz * fx) * (1.0 - fy) + (core[i + w].xyz * (1.0 - fx) + core[i + w + 1u].xyz * fx) * fy;
}
fn star_at(u: f32, v: f32) -> vec3f {
    let M: u32 = U.star_m;
    let mf: f32 = f32(M - 1u);
    if (u < 0.0 || v < 0.0 || u > mf || v > mf) { return vec3f(0.0); }
    let x0: u32 = min(M - 2u, u32(floor(u)));
    let y0: u32 = min(M - 2u, u32(floor(v)));
    let fx: f32 = u - f32(x0);
    let fy: f32 = v - f32(y0);
    let i: u32 = (y0 * M + x0) * 3u;
    let j: u32 = i + M * 3u;
    let a: vec3f = vec3f(star[i], star[i + 1u], star[i + 2u]);
    let b: vec3f = vec3f(star[i + 3u], star[i + 4u], star[i + 5u]);
    let c: vec3f = vec3f(star[j], star[j + 1u], star[j + 2u]);
    let d: vec3f = vec3f(star[j + 3u], star[j + 4u], star[j + 5u]);
    return (a * (1.0 - fx) + b * fx) * (1.0 - fy) + (c * (1.0 - fx) + d * fx) * fy;
}
fn edge_rot(phi: f32, n: f32, rnd: f32, rot: f32) -> f32 {
    let seg: f32 = LENS_TAU / n;
    let x: f32 = phi - rot;
    let a: f32 = x - floor(x / seg) * seg;
    let poly: f32 = cos(LENS_PI / n) / cos(a - LENS_PI / n);
    return poly + (1.0 - poly) * rnd;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    // Groups fold into two dimensions (style_graph::Passes::add): 32,768 64-wide groups a row.
    let gidx: u32 = gid.x + gid.y * 2097152u;
    let i: u32 = gidx;
    if (i >= U.width * U.height) { return; }
    let qx: f32 = f32(i % U.width) + 0.5;
    let qy: f32 = f32(i / U.width) + 0.5;
    let cx: f32 = U.a.x;
    let cy: f32 = U.a.y;
    var o: vec3f = vec3f(0.0);
    for (var l: u32 = 0u; l < 8u; l++) {
        let s: f32 = bins[24u + l];
        o = o + rgbw(l) * samp(cx + (qx - cx) / s, cy + (qy - cy) / s);
    }
    let n: f32 = f32(U.blades);
    let rnd: f32 = U.a.w;
    let ca: f32 = U.b.x;
    let sa: f32 = U.b.y;
    let L: f32 = U.b.z;
    let sg: f32 = U.b.w;
    let cell: f32 = U.c.x;
    let hm: f32 = (f32(U.star_m) - 1.0) * 0.5;
    let sinv: f32 = 1.0 / (cell * cell);
    for (var si: u32 = 0u; si < U.n_src; si++) {
        let b: u32 = si * 24u;
        let sx: f32 = srcs[b];
        let sy: f32 = srcs[b + 1u];
        let E: vec3f = vec3f(srcs[b + 2u], srcs[b + 3u], srcs[b + 4u]);
        let dx: f32 = qx - sx;
        let dy: f32 = qy - sy;
        o = o + E * U.c.y * star_at(dx / cell + hm, dy / cell + hm) * sinv;
        let a: f32 = ca * dx + sa * dy;
        let bb: f32 = -sa * dx + ca * dy;
        let k: f32 = (exp(-abs(a) / L) / (2.0 * L)) * (exp(-bb * bb / (2.0 * sg * sg)) / (sg * 2.5066282746310002));
        let r: f32 = sqrt(dx * dx + dy * dy);
        for (var l2: u32 = 0u; l2 < 8u; l2++) {
            let ha: f32 = bins[32u + l2 * 2u];
            let hr: f32 = bins[33u + l2 * 2u];
            let f: f32 = srcs[b + 13u + l2] * k + ha * exp(-r / hr) / (LENS_TAU * hr * hr);
            o = o + E * rgbw(l2) * f;
        }
        for (var g: u32 = 0u; g < U.n_ghost; g++) {
            for (var l3: u32 = 0u; l3 < 8u; l3++) {
                let gb: u32 = (g * 8u + l3) * 4u;
                let m: f32 = ghosts[gb];
                let rad: f32 = ghosts[gb + 1u];
                let gx: f32 = cx + m * (sx - cx);
                let gy: f32 = cy + m * (sy - cy);
                let vx: f32 = (qx - gx) * U.a.z;
                let vy: f32 = qy - gy;
                let rr: f32 = sqrt(vx * vx + vy * vy);
                if (rr > rad + 1.0) { continue; }
                let cov: f32 = clamp(rad * edge_rot(atan2(vy, vx), n, rnd, ghosts[gb + 2u]) - rr + 0.5, 0.0, 1.0);
                if (cov <= 0.0) { continue; }
                o = o + E * rgbw(l3) * (srcs[b + 5u + l3] * cov * ghosts[gb + 3u]);
            }
        }
    }
    out8[i] = lab_pack(o, U.c.w);
}

