// Skin's subsurface scattering in screen space (SSS: Jimenez et al. 2015, separable): the filtered
// diffuse irradiance (demodulated, so the albedo's detail stays sharp) of skin pixels is blurred
// along x (MODE 0, filtA to filtB) then y (MODE 1, filtB to filtA) by a profile that is a sum of
// two Gaussians a channel, wide in red and narrow in blue (a fit of the Burley profile of skin's
// mean free paths), measured in metres on the surface. A tap on another surface or off the skin
// takes the centre's value, so light does not bleed across a silhouette.
#include "hf_gbuf.hlsli"

[numthreads(8, 8, 1)]
void main(uint3 id : SV_DispatchThreadID) {
    const uint w = (uint)F.size.x, h = (uint)F.size.y;
    if (id.x >= w || id.y >= h) return;
    const float4 g = gGeo[id.xy];
#if MODE == 0
    const float4 c0 = filtA[id.xy];
#else
    const float4 c0 = filtB[id.xy];
#endif
    const uint kind = (uint)floor(gEmis[id.xy].w + 1e-3f);
    float4 o = c0;
    const float mpp = footprintAt(max(g.x, 1e-3f));
    const float3 s1 = float3(1.1f, 0.45f, 0.26f) * 1e-3f, s2 = float3(3.4f, 1.4f, 0.8f) * 1e-3f;
    const float reach = 2.5f * s2.r / mpp;   // pixels to the profile's tail
    if (g.x > 0.0f && kind == K_SKIN && on(F_SKINSSS) && reach >= 1.0f) {
        const int2 dir = MODE == 0 ? int2(1, 0) : int2(0, 1);
        const float stepPx = max(1.0f, reach / 10.0f);
        float3 sum = 0.0f, wsum = 0.0f;
        for (int k = -10; k <= 10; k++) {
            const int off = int(round(float(k) * stepPx));
            const int2 q = clamp(int2(id.xy) + dir * off, int2(0, 0), int2(w, h) - 1);
            const float r = float(off) * mpp;
#if MODE == 0
            float3 cq = filtA[q].rgb;
#else
            float3 cq = filtB[q].rgb;
#endif
            const float4 gq = gGeo[q];
            if (gq.x <= 0.0f || (uint)floor(gEmis[q].w + 1e-3f) != K_SKIN || abs(gq.x - g.x) > 0.012f) cq = c0.rgb;
            const float3 wk = 0.62f * exp(-0.5f * r * r / (s1 * s1)) / s1 + 0.38f * exp(-0.5f * r * r / (s2 * s2)) / s2;
            sum += cq * wk; wsum += wk;
        }
        o = float4(sum / max(wsum, 1e-6f), c0.w);
    }
#if MODE == 0
    filtB[id.xy] = o;
#else
    filtA[id.xy] = o;
#endif
}
