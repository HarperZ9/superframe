// Our fast GTAO for the AO comparison (bench/ao/README.md). The integral is the engine's
// (src/renderer/gpu/shaders/hlsl/post_gtao.hlsl; Jimenez et al. 2016, eq. 10, with a hard radius,
// the quantity the ray-cast reference measures). What changes is how few samples it can afford:
//   1. It reads what XeGTAO reads, hardware (NDC) depth and a view-normal texture, not a G-buffer:
//      CSPack turns NDC depth into view depth once, so each horizon sample is one 4-byte read.
//   2. CSMain turns the slices and shifts the steps by a 4 x 4 interleaved pattern, so 16
//      neighbouring pixels together cover 16 times the slice directions and step offsets.
//   3. CSBlur averages each 4 x 4 block of the pattern back, skipping neighbours off the
//      pixel's plane by more than 2% of its depth (read from the dense depth alone).
//   4. Horizon samples snap to pixel centres, whose surface points are exact: one read a step;
//      far steps read a decimated level (one kept pixel a block), so they stay in cache.
// Bindings: b0 params (ssr.x, ssr.y: the NDC depth unpack, view depth = x / (y - ndc));
// u1 Z (NDC depth, 1 where empty); u2 O (final AO); u3 D (view depth, -1 where empty);
// u4 T (raw AO); u5 N (view normal, 4 floats a pixel).
struct PostParams {
    uint width; uint height; uint slices; uint steps;
    uint refine; uint flags; uint ssr_steps; uint pad1;
    float4 view;   // tan(fovy / 2), aspect, near plane, radius
    float4 ssr;
    float4 taa;
};
static const float PI = 3.14159265358979f;
ConstantBuffer<PostParams> P : register(b0);
RWStructuredBuffer<float> Z : register(u1);
RWStructuredBuffer<float> O : register(u2);
RWStructuredBuffer<float> D : register(u3);
RWStructuredBuffer<float> T : register(u4);
RWStructuredBuffer<float> N : register(u5);

// Depth levels: level 0 is every pixel; level m keeps one pixel of each 2^m x 2^m block, the one at
// (2^(m-1), 2^(m-1)) inside it, unaveraged, so a coarse sample is still an exact surface point.
static const uint kLevels = 5u;
uint levelW(uint m) { return (P.width + (1u << m) - 1u) >> m; }
uint levelH(uint m) { return (P.height + (1u << m) - 1u) >> m; }
uint levelBase(uint m) {
    uint b = 0u;
    for (uint j = 0u; j < m; j++) b += levelW(j) * levelH(j);
    return b;
}

[numthreads(64, 1, 1)]
void CSPack(uint3 gid : SV_DispatchThreadID) {
    if (gid.x >= P.width * P.height) return;
    const float z = Z[gid.x];
    const float d = z >= 1.0f ? -1.0f : P.ssr.x / (P.ssr.y - z);
    D[gid.x] = d;
    const uint x = gid.x % P.width, y = gid.x / P.width;
    for (uint m = 1u; m < kLevels; m++) {
        const uint half_ = 1u << (m - 1u), mask = (1u << m) - 1u;
        if ((x & mask) == half_ && (y & mask) == half_) D[levelBase(m) + (y >> m) * levelW(m) + (x >> m)] = d;
    }
}

float depthAt(int x, int y) {
    if (x < 0 || y < 0 || x >= int(P.width) || y >= int(P.height)) return -1.0f;
    return D[uint(y) * P.width + uint(x)];
}
// A horizon sample at (fx, fy) from level m: the depth of the block's kept pixel, and that
// pixel's centre in `at`. -1 off screen, or where the block's kept pixel lies off screen or is empty.
float depthLevel(float fx, float fy, uint m, out float2 at) {
    at = float2(0.0f, 0.0f);
    if (fx < 0.0f || fy < 0.0f) return -1.0f;
    const uint cx = uint(fx) >> m, cy = uint(fy) >> m;
    if (cx >= levelW(m) || cy >= levelH(m)) return -1.0f;
    const uint off = m == 0u ? 0u : 1u << (m - 1u);
    const uint px = (cx << m) + off, py = (cy << m) + off;
    if (px >= P.width || py >= P.height) return -1.0f;
    at = float2(float(px) + 0.5f, float(py) + 0.5f);
    return D[levelBase(m) + cy * levelW(m) + cx];
}
float2 projectPx(float3 p) {
    const float w = -p.z;
    return float2((p.x / (w * P.view.x * P.view.y) * 0.5f + 0.5f) * float(P.width), (1.0f - (p.y / (w * P.view.x) * 0.5f + 0.5f)) * float(P.height));
}
// The cosine-weighted visible arc of one slice (the engine pass's slice body).
float slice(int x, int y, float3 pp, float3 nn, float3 vv, float3 dir, float rpx, float jit) {
    const float2 s0 = projectPx(pp), s1 = projectPx(pp + dir * (1.0e-3f * -pp.z));
    const float ddl = length(s1 - s0);
    if (ddl < 1.0e-12f) return 0.0f;
    const float2 sd = (s1 - s0) / ddl;
    const float3 od = dir - dot(dir, vv) * vv;
    const float3 ax = normalize(cross(od, vv));
    const float3 pn = nn - ax * dot(nn, ax);
    const float pnl = length(pn);
    if (pnl < 1.0e-9f) return 0.0f;
    const float cn = clamp(dot(pn, vv) / pnl, 0.0f, 1.0f);
    const float nang = (dot(od, pn) >= 0.0f ? 1.0f : -1.0f) * acos(cn);
    float hc[2] = {cos(nang + PI / 2.0f), cos(nang - PI / 2.0f)};
    [unroll] for (uint side = 0u; side < 2u; side++) {
        const float sg = side == 0u ? 1.0f : -1.0f;
        for (uint k = 0u; k < P.steps; k++) {
            const float off = sg * max(1.0f, rpx * (float(k) + jit) / float(P.steps));
            // Snapped to the centre of the pixel the step lands in, whose surface point is exact:
            // one read, and no bias from giving an off-centre position a neighbour's depth.
            // Far steps read coarser levels, as XeGTAO reads coarser depth MIPs (its offset 3.3).
            const uint m = uint(clamp(log2(abs(off)) - 3.3f, 0.0f, float(kLevels - 1u)));
            float2 at;
            const float dd = depthLevel(float(x) + 0.5f + off * sd.x, float(y) + 0.5f + off * sd.y, m, at);
            if (dd < 0.0f) continue;
            const float fx = at.x, fy = at.y;
            const float3 q = float3((fx / float(P.width) * 2.0f - 1.0f) * dd * P.view.x * P.view.y, (1.0f - fy / float(P.height) * 2.0f) * dd * P.view.x, -dd);
            const float3 dv = q - pp;
            const float dl = length(dv);
            if (dl < 1.0e-9f || dl > P.view.w) continue;
            // The snapped point lies a little off the slice plane: measure its horizon in the plane.
            const float3 dp = dv - ax * dot(dv, ax);
            const float dpl = length(dp);
            if (dpl > 1.0e-9f) hc[side] = max(hc[side], dot(dp, vv) / dpl);
        }
    }
    const float h1 = nang + min(acos(clamp(hc[0], -1.0f, 1.0f)) - nang, PI / 2.0f);
    const float h0 = nang + max(-acos(clamp(hc[1], -1.0f, 1.0f)) - nang, -PI / 2.0f);
    const float sn2 = sin(nang);
    return pnl * ((cn + 2.0f * h0 * sn2 - cos(2.0f * h0 - nang)) + (cn + 2.0f * h1 * sn2 - cos(2.0f * h1 - nang))) / 4.0f;
}

[numthreads(8, 8, 1)]
void CSMain(uint3 gid : SV_DispatchThreadID) {
    const int x = int(gid.x), y = int(gid.y);
    if (x >= int(P.width) || y >= int(P.height)) return;
    const uint i = uint(y) * P.width + uint(x);
    T[i] = 1.0f;
    const float dc = D[i];
    if (dc < 0.0f) return;
    const float3 pp = float3(((float(x) + 0.5f) / float(P.width) * 2.0f - 1.0f) * dc * P.view.x * P.view.y, (1.0f - (float(y) + 0.5f) / float(P.height) * 2.0f) * dc * P.view.x, -dc);
    const float3 nn = float3(N[i * 4u], N[i * 4u + 1u], N[i * 4u + 2u]);
    const float3 vv = -pp / length(pp);
    const float rpx = P.view.w * float(P.height) / (2.0f * P.view.x * dc);
    float3 tt = float3(1.0f - vv.x * vv.x, -vv.x * vv.y, -vv.x * vv.z);
    tt = tt / length(tt);
    const float3 bb = cross(vv, tt);
    // 4 x 4 interleave: a Bayer-ordered slice turn and an offset R2 step jitter.
    const uint cell = (uint(x) & 3u) | ((uint(y) & 3u) << 2u);
    const uint bayer[16] = {0u, 8u, 2u, 10u, 12u, 4u, 14u, 6u, 3u, 11u, 1u, 9u, 15u, 7u, 13u, 5u};
    const float turn = (float(bayer[cell]) + 0.5f) / 16.0f;
    const float jit = frac(0.5f + float(cell) * 0.7548776662f);
    float total = 0.0f;
    for (uint s = 0u; s < P.slices; s++) {
        const float phi = PI * (float(s) + turn) / float(P.slices);
        total += slice(x, y, pp, nn, vv, cos(phi) * tt + sin(phi) * bb, rpx, jit);
    }
    T[i] = total / float(P.slices);
}

[numthreads(8, 8, 1)]
void CSBlur(uint3 gid : SV_DispatchThreadID) {
    const int x = int(gid.x), y = int(gid.y);
    if (x >= int(P.width) || y >= int(P.height)) return;
    const uint i = uint(y) * P.width + uint(x);
    O[i] = 1.0f;
    const float dc = D[i];
    if (dc < 0.0f) return;
    const float3 pp = float3(((float(x) + 0.5f) / float(P.width) * 2.0f - 1.0f) * dc * P.view.x * P.view.y, (1.0f - (float(y) + 0.5f) / float(P.height) * 2.0f) * dc * P.view.x, -dc);
    const float3 nn = float3(N[i * 4u], N[i * 4u + 1u], N[i * 4u + 2u]);
    float sum = 0.0f, wsum = 0.0f;
    [unroll] for (int dy = -2; dy < 2; dy++) [unroll] for (int dx = -2; dx < 2; dx++) {
        const int qx = x + dx, qy = y + dy;
        const float dd = depthAt(qx, qy);
        if (dd < 0.0f) continue;
        // The neighbour's surface point, from its depth alone; kept when it lies on this pixel's plane.
        const float3 q = float3((float(qx) + 0.5f) / float(P.width) * 2.0f - 1.0f, 1.0f - (float(qy) + 0.5f) / float(P.height) * 2.0f, 0.0f);
        const float3 qv = float3(q.x * dd * P.view.x * P.view.y, q.y * dd * P.view.x, -dd);
        if (abs(dot(qv - pp, nn)) > 0.02f * -pp.z) continue;
        sum += T[uint(qy) * P.width + uint(qx)]; wsum += 1.0f;
    }
    O[i] = wsum > 0.0f ? sum / wsum : T[i];
}
