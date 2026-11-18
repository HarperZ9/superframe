// Real-time ambient occlusion (raw/renderer/ao_realtime.hpp): the GTAO integral of post_gtao
// traced at half resolution with a few noisy samples, accumulated over frames along motion
// vectors, and resolved to full resolution with depth weights. Five full-screen passes through
// the RHI's raster convention: the uniform at b0 and textures at t0.. in binding order.
//   PASS 0  depth -> half-resolution view depth (one of each 2 x 2 pixels, chosen by `sub`)
//   PASS 1  one level of the view-depth hierarchy (half the size of its input)
//   PASS 2  the trace: visibility at half resolution
//   PASS 3  the resolve: depth-aware upsample, temporal accumulation, and the composite
// Bounds and the error curve against post_gtao: evidence/ao-realtime-bounds.json.
cbuffer P : register(b0) {
    uint W; uint H; uint hw; uint hh;                 // full and half size
    float projA; float projB; float tanHalf; float aspect;   // depth = A - B / viewZ
    float radius; float strength; uint slices; uint steps;
    uint frame; uint flags; uint subX; uint subY;     // flags: FLAG_* below
    float2 mvScale; float zTol; float maxHistory;     // previous uv = uv + motion * mvScale
    uint mode; uint noiseSize; float upSharp; float levelBias;   // mode: 0 pass through, 1 apply, 2 show visibility
};
static const uint FLAG_NOISE = 1u, FLAG_TEMPORAL = 2u, FLAG_LEVELS = 4u, FLAG_SPHEREMAP = 8u, FLAG_SRGB = 16u;
static const float PI = 3.14159265358979f;

float4 vs(uint i : SV_VertexID) : SV_Position {
    return float4(i == 1u ? 3.0f : -1.0f, i == 2u ? -3.0f : 1.0f, 0.0f, 1.0f);
}
// View depth of a depth-buffer value; negative where nothing was drawn.
float viewZ(float d) { return (d >= 1.0f || projA - d <= 0.0f) ? -1.0f : projB / (projA - d); }
// View-space position (x right, y up, z towards the viewer) of a full-resolution pixel centre.
float3 viewPos(float2 centre, float z) {
    const float2 ndc = float2(centre.x / float(W) * 2.0f - 1.0f, 1.0f - centre.y / float(H) * 2.0f);
    return float3(ndc.x * z * tanHalf * aspect, ndc.y * z * tanHalf, -z);
}

#if PASS == 0
Texture2D<float> Depth : register(t0);
float fs(float4 at : SV_Position) : SV_Target0 {
    const int2 p = min(int2(at.xy) * 2 + int2(subX, subY), int2(W, H) - 1);
    return viewZ(Depth.Load(int3(p, 0)));
}
#elif PASS == 1
// The mean of the texels that lie within 10 % of the nearest one: a level texel stands for the
// front surface of its block and never blends it with what lies behind.
Texture2D<float> Z : register(t0);
float fs(float4 at : SV_Position) : SV_Target0 {
    uint w, h;
    Z.GetDimensions(w, h);
    float z[4];
    float nearest = 1.0e30f;
    for (int q = 0; q < 4; q++) {
        z[q] = Z.Load(int3(min(int2(at.xy) * 2 + int2(q & 1, q >> 1), int2(w, h) - 1), 0));
        if (z[q] > 0.0f) { nearest = min(nearest, z[q]); }
    }
    if (nearest > 1.0e29f) { return -1.0f; }
    float sum = 0.0f, n = 0.0f;
    for (int k = 0; k < 4; k++) { if (z[k] > 0.0f && z[k] <= 1.1f * nearest) { sum += z[k]; n += 1.0f; } }
    return sum / n;
}
#elif PASS == 2
Texture2D<float> Z0 : register(t0);
Texture2D<float> Z1 : register(t1);
Texture2D<float> Z2 : register(t2);
Texture2D<float> Z3 : register(t3);
Texture2D<float4> Normal : register(t4);
Texture2D<float4> Noise : register(t5);
SamplerState Point : register(s0);

// View-space normal of a full-resolution pixel. Plain: rgb * 2 - 1. Spheremap: the Lambert
// azimuthal form xy / sqrt(8 - 8 z) + 0.5 of a normal whose z points into the screen.
float3 normalAt(int2 fp) {
    const float4 t = Normal.Load(int3(fp, 0));
    if ((flags & FLAG_SPHEREMAP) == 0u) { return normalize(t.xyz * 2.0f - 1.0f); }
    const float2 e = t.xy - 0.5f;
    const float s = min(dot(e, e), 0.25f);
    const float3 n = float3(e * (4.0f * sqrt(1.0f - 4.0f * s)), 8.0f * s - 1.0f);
    return float3(n.x, n.y, -n.z) / max(length(n), 1.0e-6f);
}
// Two blue-noise values of a pixel, moved each frame by the golden ratio and its square root
// partner (a rank-1 sequence in time on top of a blue-noise field in space).
float2 noise2(int2 p) {
    const uint m = noiseSize - 1u;
    const float4 a = Noise.Load(int3(uint2(p) & m, 0));
    const float4 b = Noise.Load(int3((uint2(p) + uint2(23u, 41u)) & m, 0));
    const float2 v = float2(a.x + a.y / 256.0f, b.x + b.y / 256.0f) * (255.0f / 256.0f);
    return frac(v + float(frame & 63u) * float2(0.61803399f, 0.75487767f));
}
// The view depth at a full-resolution position f, from level l: the four texels around it,
// interpolated in 1 / depth (linear on screen for a plane). Where one of the four is empty or
// they span more than 10 % in depth, the nearest texel alone answers, so two surfaces are
// never blended into a third. Negative: nothing there.
float depthAt(float2 f, uint l) {
    const float2 tc = ((f - float2(subX, subY) - 0.5f) * 0.5f + 0.5f) / float(1u << l);   // texel coordinates in level l
    const float2 size = float2(max(hw >> l, 1u), max(hh >> l, 1u));
    const float2 uv = tc / size;
    float4 g;
    if (l == 0u) { g = Z0.GatherRed(Point, uv); } else if (l == 1u) { g = Z1.GatherRed(Point, uv); }
    else if (l == 2u) { g = Z2.GatherRed(Point, uv); } else { g = Z3.GatherRed(Point, uv); }
    const float2 a = frac(tc - 0.5f);
    const float nearest = a.x < 0.5f ? (a.y < 0.5f ? g.w : g.x) : (a.y < 0.5f ? g.z : g.y);
    const float lo = min(min(g.x, g.y), min(g.z, g.w)), hi = max(max(g.x, g.y), max(g.z, g.w));
    if (lo <= 0.0f || hi > 1.1f * lo) { return nearest; }
    const float4 k = 1.0f / g;
    return 1.0f / lerp(lerp(k.w, k.z, a.x), lerp(k.x, k.y, a.x), a.y);
}

float fs(float4 at : SV_Position) : SV_Target0 {
    const int2 p = int2(at.xy);
    const float depth = Z0.Load(int3(p, 0));
    if (depth < 0.0f) { return 1.0f; }
    const int2 fp = min(p * 2 + int2(subX, subY), int2(W, H) - 1);
    const float3 pp = viewPos(float2(fp) + 0.5f, depth);
    const float3 nn = normalAt(fp);
    const float3 vv = -pp / length(pp);
    const float rpx = radius * float(H) / (2.0f * tanHalf * depth);   // the radius in full-resolution pixels
    float3 tt = float3(1.0f - vv.x * vv.x, -vv.x * vv.y, -vv.x * vv.z);
    tt = tt / length(tt);
    const float3 bb = cross(vv, tt);
    const bool noisy = (flags & FLAG_NOISE) != 0u;
    const float2 xi = noisy ? noise2(p) : float2(0.5f, 1.0f);
    // The level whose texels are about half the spacing of the steps: far steps read coarse,
    // cache-friendly texels and no step jumps a whole block of unread depth.
    const float spacing = rpx * 0.5f / float(steps);
    const uint level = (flags & FLAG_LEVELS) != 0u ? uint(clamp(floor(log2(max(spacing, 1.0f))) - levelBias, 0.0f, 3.0f)) : 0u;
    float total = 0.0f;
    for (uint s = 0u; s < slices; s++) {
        const float phi = PI * frac((float(s) + xi.x) / float(slices));
        const float3 dir = cos(phi) * tt + sin(phi) * bb;
        // The slice's screen direction: the derivative of the projection along dir (post_gtao).
        const float dsx = (dir.x * -pp.z + pp.x * dir.z) * float(W) / aspect;
        const float dsy = -(dir.y * -pp.z + pp.y * dir.z) * float(H);
        const float ddl = length(float2(dsx, dsy));
        if (ddl < 1.0e-12f) { continue; }
        const float2 sd = float2(dsx, dsy) / ddl;
        const float3 od = dir - dot(dir, vv) * vv;
        const float3 ax = normalize(cross(od, vv));
        const float3 pn = nn - ax * dot(nn, ax);
        const float pnl = length(pn);
        if (pnl < 1.0e-9f) { continue; }
        const float sgn = dot(od, pn) >= 0.0f ? 1.0f : -1.0f;
        const float cn = clamp(dot(pn, vv) / pnl, 0.0f, 1.0f);
        const float nang = sgn * acos(cn);
        float hc[2] = {cos(nang + PI / 2.0f), cos(nang - PI / 2.0f)};
        for (uint side = 0u; side < 2u; side++) {
            const float sg = side == 0u ? 1.0f : -1.0f;
            for (uint k = 0u; k < steps; k++) {
                const float off = sg * rpx * (float(k) + xi.y) / float(steps);
                const float2 f = float2(fp) + 0.5f + off * sd;   // full-resolution position
                if (f.x < 0.0f || f.y < 0.0f || f.x >= float(W) || f.y >= float(H)) { break; }
                if (abs(off) < 1.0f) { continue; }
                const float dd = depthAt(f, level);
                if (dd < 0.0f) { continue; }
                const float3 dv = viewPos(f, dd) - pp;
                const float dl = length(dv);
                if (dl < 1.0e-9f || dl > radius) { continue; }
                hc[side] = max(hc[side], dot(dv, vv) / dl);
            }
        }
        const float h1 = nang + min(acos(clamp(hc[0], -1.0f, 1.0f)) - nang, PI / 2.0f);
        const float h0 = nang + max(-acos(clamp(hc[1], -1.0f, 1.0f)) - nang, -PI / 2.0f);
        const float sn2 = sin(nang);
        const float a0 = (cn + 2.0f * h0 * sn2 - cos(2.0f * h0 - nang)) / 4.0f;
        const float a1 = (cn + 2.0f * h1 * sn2 - cos(2.0f * h1 - nang)) / 4.0f;
        total += pnl * (a0 + a1);
    }
    // One slice of an open surface can exceed 1; only the mean over slices is bounded, so the
    // clamp waits for the resolve.
    return max(total / float(slices), 0.0f);
}
#else
Texture2D<float> AoHalf : register(t0);
Texture2D<float> Z0 : register(t1);
Texture2D<float> Depth : register(t2);
Texture2D<float2> Motion : register(t3);
Texture2D<float4> History : register(t4);   // visibility, view depth, frames accumulated
Texture2D<float4> Frame : register(t5);
struct Out { float4 history : SV_Target0; float4 colour : SV_Target1; };

float3 toLinear(float3 c) { return lerp(c / 12.92f, pow((c + 0.055f) / 1.055f, 2.4f), step(0.04045f, c)); }
float3 toSrgb(float3 c) { return lerp(c * 12.92f, 1.055f * pow(c, 1.0f / 2.4f) - 0.055f, step(0.0031308f, c)); }

Out fs(float4 at : SV_Position) {
    const int2 p = min(int2(at.xy), int2(W, H) - 1);
    const float4 c = Frame.Load(int3(p, 0));
    Out o;
    o.history = float4(1.0f, -1.0f, 0.0f, 0.0f);
    o.colour = c;
    const float z = viewZ(Depth.Load(int3(p, 0)));
    if (mode == 0u) { return o; }
    if (z < 0.0f) { if (mode == 2u) { o.colour = float4(1.0f, 1.0f, 1.0f, 1.0f); } return o; }
    // This frame's visibility: the four half-resolution texels around the pixel, weighted by
    // distance and by how close each one's view depth is to the pixel's.
    const float2 f = (float2(p) - float2(subX, subY)) * 0.5f;
    const int2 base = int2(floor(f));
    const float2 a = f - float2(base);
    float sum = 0.0f, wsum = 0.0f;
    for (int q = 0; q < 4; q++) {
        const int2 t = clamp(base + int2(q & 1, q >> 1), int2(0, 0), int2(hw, hh) - 1);
        const float zt = Z0.Load(int3(t, 0));
        const float rel = (zt - z) / z;
        const float w = ((q & 1) ? a.x : 1.0f - a.x) * ((q >> 1) ? a.y : 1.0f - a.y) * exp2(-rel * rel * upSharp)
                        * (zt > 0.0f ? 1.0f : 0.0f) + 1.0e-6f;
        sum += w * AoHalf.Load(int3(t, 0));
        wsum += w;
    }
    float ao = sum / wsum, n = 0.0f, past = 0.0f;
    bool have = false;
    if ((flags & FLAG_TEMPORAL) != 0u) {
        // The surface's place in the last frame. A history texel counts when it is on screen
        // and held a surface at this depth; otherwise the pixel was just uncovered.
        const float2 prev = float2(p) + 0.5f + Motion.Load(int3(p, 0)) * mvScale * float2(W, H) - 0.5f;
        const int2 pb = int2(floor(prev));
        const float2 pa = prev - float2(pb);
        float hs = 0.0f, hn = 0.0f, hw2 = 0.0f;
        for (int k = 0; k < 4; k++) {
            const int2 t = pb + int2(k & 1, k >> 1);
            if (t.x < 0 || t.y < 0 || t.x >= int(W) || t.y >= int(H)) { continue; }
            const float4 h = History.Load(int3(t, 0));
            if (h.y <= 0.0f || abs(h.y - min(z, 65000.0f)) > zTol * z) { continue; }
            const float w = ((k & 1) ? pa.x : 1.0f - pa.x) * ((k >> 1) ? pa.y : 1.0f - pa.y);
            hs += w * h.x; hn += w * h.z; hw2 += w;
        }
        if (hw2 > 0.05f) { n = hn / hw2; past = hs / hw2; have = true; }
    }
    // A pixel is traced itself one frame in four; in the other three its value comes from its
    // neighbours. Its own trace counts in full and a borrowed value counts `kBorrowed`, so the
    // history converges on the pixel's own visibility and keeps full-resolution detail. `n` is
    // the weight gathered so far; a frame adds kMean on average.
    static const float kBorrowed = 0.15f, kMean = (1.0f + 3.0f * kBorrowed) / 4.0f;
    const float mine = (a.x == 0.0f && a.y == 0.0f) || !have ? 1.0f : kBorrowed;
    const float age = have ? n / kMean : 0.0f;   // frames of history
    n = have ? min(n + mine, maxHistory * kMean) : 1.0f;
    if (age < 7.0f && (flags & FLAG_NOISE) != 0u) {
        // Little or no history: the pixel was uncovered within the last few frames, or the
        // pass just started. Its few noisy slices are not enough, so this frame's value is
        // the depth-weighted mean of the 4 x 4 half-resolution texels around it, where the
        // blue noise averages out. The wide mean fades as the history grows.
        float ws = 0.0f, as = 0.0f;
        for (int k = 0; k < 16; k++) {
            const int2 t = clamp(base + int2(k & 3, k >> 2) - 1, int2(0, 0), int2(hw, hh) - 1);
            const float zt = Z0.Load(int3(t, 0));
            const float rel = (zt - z) / z;
            const float w = exp2(-rel * rel * upSharp * 0.25f) * (zt > 0.0f ? 1.0f : 0.0f) + 1.0e-6f;
            as += w * AoHalf.Load(int3(t, 0));
            ws += w;
        }
        ao = lerp(as / ws, ao, age / 7.0f);
    }
    if (have) { ao = lerp(past, ao, mine / n); }
    o.history = float4(ao, min(z, 65000.0f), n, 0.0f);
    if (mode == 2u) { o.colour = float4(ao, ao, ao, 1.0f); return o; }
    const float k = lerp(1.0f, saturate(ao), saturate(strength));
    o.colour = (flags & FLAG_SRGB) != 0u ? float4(toSrgb(toLinear(saturate(c.rgb)) * k), c.a) : float4(c.rgb * k, c.a);
    return o;
}
#endif
