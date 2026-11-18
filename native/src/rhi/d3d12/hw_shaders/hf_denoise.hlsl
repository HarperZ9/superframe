// The denoiser (DNS: SVGF-style, Schied et al. 2017, without the variance-guided weights).
// MODE 0, temporal: diffuse = direct + GI (GI dimmed by GTAO), specular = direct + reflections,
// each blended with its history at the reprojected pixel when depth and normal agree; the history
// length grows to 64 (diffuse) and with roughness (specular) and resets on a disocclusion.
// MODE 1, a-trous: one level of the edge-stopping wavelet (PC.a.x the step) on the diffuse,
// from filtA to filtB or back (PC.a.y), guided by depth, normal and luminance.
#include "hf_gbuf.hlsli"

[numthreads(8, 8, 1)]
void main(uint3 id : SV_DispatchThreadID) {
    const uint w = (uint)F.size.x, h = (uint)F.size.y;
    if (id.x >= w || id.y >= h) return;
    const float4 g = gGeo[id.xy];
#if MODE == 0
    if (g.x <= 0.0f) { histDiff[id.xy] = 0.0f; histSpec[id.xy] = 0.0f; filtA[id.xy] = 0.0f; return; }
    const float ao = aoOut[id.xy];
    const float3 diff = finite3(dDiff[id.xy].rgb + giRaw[id.xy].rgb * lerp(1.0f, ao, 0.85f));
    Surf s; float3 v; loadSurf(id.xy, s, v);
    // specular fireflies (a lamp caught by one GGX sample on icy ruts) are clamped before they enter history
    float3 spec = dSpec[id.xy].rgb + rfRaw[id.xy].rgb * specAlbedo(s, v);
    spec = finite3(spec * min(1.0f, 24.0f / max(lum(spec), 1e-6f)));
    float4 hd = float4(diff, 1.0f), hs = float4(spec, 1.0f);
    const float2 pp = float2(id.xy) + 0.5f - g.yz;
    if (!on(F_RESET) && all(pp >= 0.5f) && all(pp < F.size.xy - 0.5f)) {
        // bilinear from the four history pixels that match this surface
        const float2 b = pp - 0.5f, f = frac(b);
        const int2 o = int2(floor(b));
        float4 sd = 0, ss = 0; float wsum = 0;
        for (uint k = 0u; k < 4u; k++) {
            const int2 q = o + int2(k & 1u, k >> 1);
            const float wb = (k & 1u ? f.x : 1.0f - f.x) * (k >> 1 ? f.y : 1.0f - f.y);
            const float4 gp = geoPrev[q];
            const bool ok = abs(gp.x - g.x) < 0.04f * g.x + 0.02f && dot(nrmPrev[q].xyz, s.n) > 0.9f;
            if (ok && wb > 1e-4f) { sd += histDiffPrev[q] * wb; ss += histSpecPrev[q] * wb; wsum += wb; }
        }
        if (wsum > 0.05f) {
            sd /= wsum; ss /= wsum;
            const float nd = min(sd.w + 1.0f, 64.0f), ns = min(ss.w + 1.0f, lerp(4.0f, 32.0f, saturate(s.rough * 2.5f)));
            hd = float4(lerp(sd.rgb, diff, 1.0f / nd), nd);
            // specular history is clamped to this frame's neighbourhood, so moving highlights do not smear
            float3 lo = 1e9f, hi = -1e9f;
            for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
                const int2 q = clamp(int2(id.xy) + int2(x, y), 0, int2(w, h) - 1);
                float3 c = dSpec[q].rgb + rfRaw[q].rgb * specAlbedo(s, v); c *= min(1.0f, 24.0f / max(lum(c), 1e-6f));
                lo = min(lo, c); hi = max(hi, c);
            }
            hs = float4(lerp(clamp(ss.rgb, lo - 0.05f * hi, hi * 1.5f + 0.01f), spec, 1.0f / ns), ns);
        }
    }
    histDiff[id.xy] = hd; histSpec[id.xy] = hs; filtA[id.xy] = hd;
#else
    const uint step = PC.a.x;
    const float4 c = PC.a.y == 0u ? filtA[id.xy] : filtB[id.xy];
    if (g.x <= 0.0f) { if (PC.a.y == 0u) filtB[id.xy] = c; else filtA[id.xy] = c; return; }
    const float3 n = gNormal[id.xy].xyz;
    const float l = lum(c.rgb), sigL = 4.0f / sqrt(max(c.w, 1.0f));
    const float k[3] = { 3.0f / 8.0f, 1.0f / 4.0f, 1.0f / 16.0f };
    float3 sum = 0; float wsum = 0;
    for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
        const int2 q = int2(id.xy) + int2(x, y) * int(step);
        if (any(q < 0) || q.x >= int(w) || q.y >= int(h)) continue;
        const float4 gq = gGeo[q];
        if (gq.x <= 0.0f) continue;
        const float4 cq = PC.a.y == 0u ? filtA[q] : filtB[q];
        const float wz = exp(-abs(gq.x - g.x) / (0.02f * g.x * float(step) + 1e-3f));
        const float wn = pow(saturate(dot(gNormal[q].xyz, n)), 64.0f);
        const float wl = exp(-abs(lum(cq.rgb) - l) / (sigL * (l + 0.02f) + 1e-4f));
        const float wk = k[abs(x)] * k[abs(y)] * wz * wn * wl;
        sum += cq.rgb * wk; wsum += wk;
    }
    const float4 o = float4(sum / max(wsum, 1e-6f), c.w);
    if (PC.a.y == 0u) filtB[id.xy] = o; else filtA[id.xy] = o;
#endif
}
