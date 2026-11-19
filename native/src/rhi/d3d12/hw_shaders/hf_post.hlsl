// The frame's screen passes after lighting.
//   MODE 0 composite: albedo times filtered diffuse, specular (a small bilateral on it), emission
//          (glass lets its room through by 1 - Fresnel), glints, sky and moon, then the fog
//   MODE 1 TAA: Catmull-Rom history at the reprojected pixel, clipped to the 3x3 neighbourhood in
//          YCoCg (AA-* TAA, Karis 2014), blended 1/16 (1/n while a still converges)
//   MODE 2 bloom down (13 taps, Jimenez 2014), MODE 3 bloom up (tent), PC.a.x the level
//   MODE 4 tone map: exposure, bloom, ACES filmic (the Hill fit of the RRT and ODT), sRGB
//   MODE 5 the path tracer's mean into hdr
//   MODE 6 the lens (F.lens.x): tilt-shift miniature, oil (anisotropic Kuwahara over the structure
//          tensor, Kyprianidis 2009) or oil and ink, from the graded frame in filtA into ldr
#include "hf_gbuf.hlsli"

float3 fogAt(float2 px, float vz, float3 c) {
    if (!on(F_FOG)) return c;
    // a little jitter per pixel and frame, so the froxel grid's trilinear steps dissolve under TAA
    Rng jr = rngAt(uint2(px), F.counts.x, 91u);
    const float3 f = float3(px.x * F.size.z * float(FX), px.y * F.size.w * float(FY), froxelS(vz)) + (float3(rnd2(jr), rnd(jr)) - 0.5f) * float3(0.9f, 0.9f, 0.6f);
    const float3 b = clamp(f - 0.5f, 0.0f, float3(FX, FY, FZ) - 1.001f), i = floor(b), t = b - i;
    float4 r = 0.0f;
    [unroll] for (uint k = 0u; k < 8u; k++) { const uint3 o = uint3(k & 1u, (k >> 1) & 1u, (k >> 2) & 1u); r += fogInt[uint3(i) + o] * lerp(1.0f - t.x, t.x, o.x) * lerp(1.0f - t.y, t.y, o.y) * lerp(1.0f - t.z, t.z, o.z); }
    return c * r.a + r.rgb;
}
float3 toYCoCg(float3 c) { return float3(dot(c, float3(0.25f, 0.5f, 0.25f)), dot(c, float3(0.5f, 0.0f, -0.5f)), dot(c, float3(-0.25f, 0.5f, -0.25f))); }
float3 fromYCoCg(float3 c) { return float3(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z); }
float4 loadClamp(RWTexture2D<float4> t, int2 q) { return t[clamp(q, 0, int2(F.size.xy) - 1)]; }
float4 bilinear(RWTexture2D<float4> t, float2 p) {
    const float2 b = p - 0.5f, f = frac(b); const int2 o = int2(floor(b));
    return lerp(lerp(loadClamp(t, o), loadClamp(t, o + int2(1, 0)), f.x), lerp(loadClamp(t, o + int2(0, 1)), loadClamp(t, o + int2(1, 1)), f.x), f.y);
}
float3 aces(float3 x) {
    const float3x3 i = float3x3(0.59719f, 0.35458f, 0.04823f, 0.07600f, 0.90834f, 0.01566f, 0.02840f, 0.13383f, 0.83777f);
    const float3x3 o = float3x3(1.60475f, -0.53108f, -0.07367f, -0.10208f, 1.10813f, -0.00605f, -0.00327f, -0.07276f, 1.07602f);
    float3 v = mul(i, x);
    v = (v * (v + 0.0245786f) - 0.000090537f) / (v * (0.983729f * v + 0.4329510f) + 0.238081f);
    return saturate(mul(o, v));
}
float3 srgb(float3 c) { return select(c <= 0.0031308f, c * 12.92f, 1.055f * pow(max(c, 0.0f), 1.0f / 2.4f) - 0.055f); }

[numthreads(8, 8, 1)]
void main(uint3 id : SV_DispatchThreadID) {
#if MODE == 2 || MODE == 3
    const uint lv = PC.a.x;
    const uint2 dsz = uint2(max(1u, (uint)F.size.x >> (lv + 1u)), max(1u, (uint)F.size.y >> (lv + 1u)));
#endif
#if MODE == 0
    if (id.x >= (uint)F.size.x || id.y >= (uint)F.size.y) return;
    Surf s; float3 v;
    const float2 px = float2(id.xy) + 0.5f;
    if (!loadSurf(id.xy, s, v)) {
        const float3 d = viewRay(px);
        hdr[id.xy] = float4(fogAt(px, F.fog.w, sky(d) + moonDisc(d)), 1.0f);
        return;
    }
    float3 sp = 0; float sw = 0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        const int2 q = clamp(int2(id.xy) + int2(x, y), 0, int2(F.size.xy) - 1);
        const float wq = (x == 0 && y == 0 ? 2.0f : 1.0f) * pow(saturate(dot(gNormal[q].xyz, s.n)), 32.0f) * exp(-abs(gGeo[q].x - gGeo[id.xy].x) / (0.02f * gGeo[id.xy].x));
        sp += histSpec[q].rgb * wq; sw += wq;
    }
    float3 c = s.albedo * (1.0f - s.metal) / PI * filtA[id.xy].rgb + sp / max(sw, 1e-4f);
    const float fr = s.kind == K_GLASS ? lum(F_schlick(specF0(s), dot(s.n, v))) : 0.0f;
    c += s.emis * (1.0f - fr);
    c += dDiff[id.xy].w * F.moonRad.rgb / max(lum(F.moonRad.rgb), 1e-6f) * 0.5f;
    if (F.dbg.x == 1u) c = giRaw[id.xy].rgb / PI; else if (F.dbg.x == 2u) c = dDiff[id.xy].rgb / PI; else if (F.dbg.x == 3u) c = s.albedo;
    hdr[id.xy] = float4(finite3(F.dbg.x > 0u ? c : fogAt(px, gGeo[id.xy].x, c)), 1.0f);
#elif MODE == 1
    if (id.x >= (uint)F.size.x || id.y >= (uint)F.size.y) return;
    const float3 cur = finite3(hdr[id.xy].rgb);
    if (!on(F_TAA)) { taaB[id.xy] = float4(cur, 1); return; }
    float3 m1 = 0, m2 = 0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { const float3 q = toYCoCg(loadClamp(hdr, int2(id.xy) + int2(x, y)).rgb / (1.0f + lum(loadClamp(hdr, int2(id.xy) + int2(x, y)).rgb))); m1 += q; m2 += q * q; }
    m1 /= 9.0f; m2 /= 9.0f;
    const float3 sd = sqrt(max(m2 - m1 * m1, 0.0f));
    const float2 pp = float2(id.xy) + 0.5f - gGeo[id.xy].yz;
    if (on(F_RESET) || any(pp < 0.0f) || any(pp >= F.size.xy)) { taaB[id.xy] = float4(cur, 1); return; }
    const float4 hst = bilinear(taaA, pp);
    float3 hy = toYCoCg(hst.rgb / (1.0f + lum(hst.rgb)));
    const float3 lo = m1 - 1.25f * sd, hi = m1 + 1.25f * sd, ctr = 0.5f * (lo + hi), ext = max(0.5f * (hi - lo), 1e-5f);
    const float3 dv = (hy - ctr) / ext, a = abs(dv); const float mx = max(a.x, max(a.y, a.z));
    if (mx > 1.0f) hy = ctr + dv / mx * ext;
    // back from the tone-weighted space; a clipped colour near the top of that space would blow up
    float3 hc = fromYCoCg(hy); hc = max(hc, 0.0f) * (min(lum(hc), 0.97f) / max(lum(hc), 1e-6f)); hc = hc / (1.0f - lum(hc));
    const float n = min(hst.w + 1.0f, PC.a.x > 0u ? float(PC.a.x) : 16.0f);
    taaB[id.xy] = float4(finite3(lerp(finite3(hc), cur, 1.0f / n)), n);
#elif MODE == 2
    if (id.x >= dsz.x || id.y >= dsz.y) return;
    const float2 p = (float2(id.xy) + 0.5f) * 2.0f;
    float3 c = 0; float wsum = 0;
    const float2 o[13] = { float2(0, 0), float2(-1, -1), float2(1, -1), float2(-1, 1), float2(1, 1), float2(-2, -2), float2(0, -2), float2(2, -2), float2(-2, 0), float2(2, 0), float2(-2, 2), float2(0, 2), float2(2, 2) };
    const float wt[13] = { 0.125f, 0.125f, 0.125f, 0.125f, 0.125f, 0.03125f, 0.0625f, 0.03125f, 0.0625f, 0.0625f, 0.03125f, 0.0625f, 0.03125f };
    for (uint k = 0u; k < 13u; k++) {
        const int2 q = int2(p + o[k] - 0.5f);
        const float3 t = lv == 0u ? taaB[clamp(q, 0, int2(F.size.xy) - 1)].rgb : bloom[lv - 1u][clamp(q, 0, int2(dsz * 2u) - 1)].rgb;
        // the first level weights each tap by 1 / (1 + luma) (Karis 2014), so one hot pixel cannot bloom a disc
        const float kw = lv == 0u ? 1.0f / (1.0f + lum(t)) : 1.0f;
        c += t * kw * wt[k]; wsum += kw * wt[k];
    }
    c /= max(wsum, 1e-6f);
    bloom[lv][id.xy] = float4(min(c, 2000.0f), 1);
#elif MODE == 3
    if (id.x >= dsz.x || id.y >= dsz.y) return;
    float3 c = 0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { const int2 q = clamp(int2(float2(id.xy) * 0.5f) + int2(x, y), 0, int2(max(1u, dsz.x >> 1), max(1u, dsz.y >> 1)) - 1); c += bloom[lv + 1u][q].rgb * (x == 0 ? 2.0f : 1.0f) * (y == 0 ? 2.0f : 1.0f) / 16.0f; }
    bloom[lv][id.xy] = float4(bloom[lv][id.xy].rgb + c, 1);
#elif MODE == 4
    if (id.x >= (uint)F.size.x || id.y >= (uint)F.size.y) return;
    float3 c = taaB[id.xy].rgb;
    if (on(F_BLOOM)) { const float2 q = float2(id.xy) * 0.5f; c = lerp(c, bloom[0][min(uint2(q), uint2(F.size.xy) / 2u - 1u)].rgb, 0.035f); }
    c *= F.skyParams.w;
    c *= F.grade0.rgb;   // white balance (default a little warmer than the moon: moonlight cool, sodium still amber)
    float3 g = aces(c);
    // the grade after the tone map: contrast about mid grey in a perceptual space, saturation about luma, lift into the shadows, vignette
    g = pow(saturate((pow(max(g, 0.0f), 1.0f / 2.2f) - 0.5f) * F.grade1.w + 0.5f), 2.2f);
    g = max(lerp(lum(g).xxx, g, F.grade0.w), 0.0f);
    g = g + F.grade1.rgb * (1.0f - saturate(lum(g) * 3.0f));
    const float2 uvv = (float2(id.xy) + 0.5f) * F.size.zw - 0.5f;
    g *= 1.0f - F.grade2.x * saturate(dot(uvv, uvv) * 2.2f);
    if (F.lens.x != 0u) filtA[id.xy] = float4(saturate(g), 1.0f); else ldr[id.xy] = float4(srgb(saturate(g)), 1.0f);
#elif MODE == 6
    if (id.x >= (uint)F.size.x || id.y >= (uint)F.size.y) return;
    const int2 P = int2(id.xy);
    float3 c = filtA[P].rgb;
    const float sc = F.size.y / 2160.0f;
    if (F.lens.x == 1u) {
        // tilt-shift: a disc blur that grows away from the focus band, so the world reads as a model
        const float dy = abs((float(id.y) + 0.5f) * F.size.w - F.grade2.y);
        const float r = 22.0f * sc * F.grade2.w * smoothstep(F.grade2.z, F.grade2.z + 0.28f, dy);
        if (r > 0.6f) {
            float3 acc = c; float wsum = 1.0f;
            [loop] for (uint k = 1u; k < 64u; k++) {
                const float a = float(k) * 2.39996323f, rr = r * sqrt(float(k) / 64.0f);
                const float3 q = loadClamp(filtA, P + int2(round(float2(cos(a), sin(a)) * rr))).rgb;
                const float w = 1.0f + 2.0f * lum(q);   // bright points open into bokeh, as a real lens does
                acc += q * w; wsum += w;
            }
            c = acc / wsum;
        }
    } else {
        // the structure tensor from Sobel on luma, its eigenvector the stroke direction
        float3 gx = 0, gy = 0;
        [unroll] for (int y = -1; y <= 1; y++) [unroll] for (int x = -1; x <= 1; x++) {
            const float3 q = loadClamp(filtA, P + int2(x, y)).rgb;
            const float wx = float(x) * (y == 0 ? 2.0f : 1.0f), wy = float(y) * (x == 0 ? 2.0f : 1.0f);
            gx += q * wx; gy += q * wy;
        }
        const float E = dot(gx, gx), Fq = dot(gx, gy), G = dot(gy, gy);
        const float l1 = 0.5f * (E + G + sqrt((E - G) * (E - G) + 4.0f * Fq * Fq)), l2 = 0.5f * (E + G - sqrt((E - G) * (E - G) + 4.0f * Fq * Fq));
        float2 t = float2(l1 - E, -Fq); t = dot(t, t) > 1e-8f ? normalize(t) : float2(0, 1);
        const float A = (l1 + l2) > 1e-6f ? (l1 - l2) / (l1 + l2) : 0.0f;
        const float R = 7.0f * sc * F.grade2.w;
        const float ax = R * (1.0f + A), ay = R / (1.0f + A);   // brush stretched along the stroke
        float3 m[4] = { (float3)0, (float3)0, (float3)0, (float3)0 }, s2[4] = { (float3)0, (float3)0, (float3)0, (float3)0 }; float n[4] = { 0, 0, 0, 0 };
        [loop] for (int yy = -8; yy <= 8; yy++) [loop] for (int xx = -8; xx <= 8; xx++) {
            const float2 v = float2(xx, yy) / 8.0f;
            if (dot(v, v) > 1.0f) continue;
            const float2 o = float2(t.x * v.x * ax - t.y * v.y * ay, t.y * v.x * ax + t.x * v.y * ay);
            const float3 q = loadClamp(filtA, P + int2(round(o))).rgb;
            const uint sct = (v.x >= 0.0f ? 0u : 1u) + (v.y >= 0.0f ? 0u : 2u);
            m[sct] += q; s2[sct] += q * q; n[sct] += 1.0f;
        }
        float best = 1e9f; float3 pick = c;
        [unroll] for (uint k = 0u; k < 4u; k++) {
            const float3 mu = m[k] / max(n[k], 1.0f), var = s2[k] / max(n[k], 1.0f) - mu * mu;
            const float vs = var.r + var.g + var.b;
            if (vs < best) { best = vs; pick = mu; }
        }
        c = pick;
        if (F.lens.x == 3u) {
            // ink: a dark line where luma changes fast, thicker where the change is strong
            const float e = sqrt(lum(gx) * lum(gx) + lum(gy) * lum(gy));
            c *= 1.0f - 0.9f * smoothstep(0.03f, 0.16f, e);
        }
        // the paper's tooth: a faint fixed grain, the same every frame
        Rng gr = rngAt(id.xy, 0u, 7u);
        c *= 0.97f + 0.06f * rnd(gr);
    }
    ldr[id.xy] = float4(srgb(saturate(c)), 1.0f);
#elif MODE == 5
    if (id.x >= (uint)F.size.x || id.y >= (uint)F.size.y) return;
    const float4 a = ptAcc[id.xy];
    hdr[id.xy] = float4(a.rgb / max(a.w, 1.0f), 1.0f);
#endif
}
