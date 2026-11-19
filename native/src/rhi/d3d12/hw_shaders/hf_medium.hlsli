// The participating medium shared by the froxel fog and the path tracer: street haze thinning with
// height and drifting in the wind, plus the smoke of each drawing chimney, a plume that rises, bends
// downwind, widens and thins. Smoke is listed in Smoke (t6): x y z of the chimney top, w its strength;
// F.dbg.y of them.
#ifndef HF_MEDIUM
#define HF_MEDIUM
#include "hf_common.hlsli"
StructuredBuffer<float4> Smoke : register(t6);

float n3(float3 p) {
    const float3 i = floor(p), f = frac(p), u = f * f * (3.0f - 2.0f * f);
    float r = 0.0f;
    [unroll] for (uint k = 0u; k < 8u; k++) { const float3 o = float3(k & 1u, (k >> 1) & 1u, (k >> 2) & 1u); const float3 q = i + o; r += frac(sin(dot(q, float3(12.9898f, 78.233f, 37.719f))) * 43758.5453f) * lerp(1.0f - u.x, u.x, o.x) * lerp(1.0f - u.y, u.y, o.y) * lerp(1.0f - u.z, u.z, o.z); }
    return r;
}
float smokeAt(float3 p) {
    const float3 wind = float3(F.timeParams.z, 0.0f, F.timeParams.w);
    float s = 0.0f;
    for (uint i = 0u; i < F.dbg.y; i++) {
        const float4 c = Smoke[i];
        const float h = p.y - c.y;
        if (h < 0.0f || h > 10.0f) continue;
        const float3 axis = c.xyz + float3(0, h, 0) + wind * (h * 0.9f + h * h * 0.05f) / max(length(wind), 1e-3f) * 0.6f;
        const float r = 0.25f + 0.13f * h, d2 = dot(p.xz - axis.xz, p.xz - axis.xz);
        if (d2 > 9.0f * r * r) continue;
        const float t = F.timeParams.x;
        const float curl = n3(p * 1.7f - float3(0, t * 0.9f, 0)) * n3(p * 0.6f + float3(t * 0.2f, 0, 0));
        s += c.w * 0.55f * exp(-h / 5.0f) * exp(-d2 / (r * r)) * (0.35f + 1.3f * curl);
    }
    return min(s, 1.1f);   // bounded, so the path tracer's delta tracking has a true majorant
}
float density(float3 p) {
    const float3 wind = float3(F.timeParams.z, 0.0f, F.timeParams.w) * F.timeParams.x;
    const float base = F.fog.x * exp(-max(0.0f, p.y - F.eye.y + 2.0f) * F.fog.y);
    return base * (0.55f + 0.9f * n3(p * 0.06f - wind * 0.05f) * n3(p * 0.21f + wind * 0.11f)) + smokeAt(p);
}
#endif
