// Falling snow (SKY weather): flakes in a box that travels with the eye, each falling at its own
// speed with a sway and the wind, drawn as a soft disc drawn out along its motion over the
// shutter, lit by the moon (forward scattering) and the lamps of its cluster, over the composite.
#include "hf_light.hlsli"

static const float3 BOX = float3(48.0f, 22.0f, 48.0f);
struct SOut { float4 pos : SV_Position; float2 q : Q; float3 col : COL; float a : A; float tail : TAIL; };

float3 h3(uint i) { return float3(pcg(i) & 0xFFFFu, pcg(i + 7u) & 0xFFFFu, pcg(i + 13u) & 0xFFFFu) / 65535.0f; }
float3 flakeAt(uint i, float t) {
    const float3 r = h3(i), fall = float3(F.timeParams.z, -F.timeParams.y * (0.7f + 0.6f * r.y), F.timeParams.w);
    float3 p = r * BOX + fall * t + float3(sin(t * (0.8f + r.x) + r.z * 6.0f), 0.0f, cos(t * (0.7f + r.z) + r.x * 6.0f)) * 0.25f;
    const float3 lo = F.eye.xyz - BOX * float3(0.5f, 0.4f, 0.5f);
    return lo + fmod(fmod(p - lo, BOX) + BOX, BOX);
}

SOut vs(uint vid : SV_VertexID) {
    const uint i = vid / 6u, k = vid % 6u;
    const float t = F.timeParams.x;
    const float3 p = flakeAt(i, t), p0 = flakeAt(i, t - 1.0f / 60.0f);
    const float rad = 0.0035f + 0.0045f * h3(i + 99u).x;
    const float4 c = mul(F.viewProj, float4(p, 1.0f)), c0 = mul(F.viewProj, float4(p0, 1.0f));
    SOut o;
    const float2 corner = float2(k == 1u || k == 2u || k == 4u ? 1.0f : -1.0f, k == 2u || k == 4u || k == 5u ? 1.0f : -1.0f);
    // the disc in pixels, at least a pixel and a half across; drawn out toward where it was
    const float2 sc = c.xy / max(c.w, 1e-3f) * 0.5f * F.size.xy, s0 = c0.xy / max(c0.w, 1e-3f) * 0.5f * F.size.xy;
    const float rpx = max(1.5f, rad / max(c.w, 1e-3f) / F.eye.w * 0.5f * F.size.y);
    float2 axis = sc - s0; const float len = length(axis);
    axis = len > 1e-3f ? axis / len : float2(1, 0);
    const float2 side = float2(-axis.y, axis.x);
    const float2 off = side * corner.y * rpx + axis * (corner.x > 0 ? rpx : -rpx - len);
    o.pos = float4((sc + off) / (0.5f * F.size.xy) * c.w, c.z, c.w);
    o.q = float2(corner.x > 0 ? 1.0f : -1.0f - len / rpx, corner.y);
    o.tail = len / rpx;
    const float coverage = saturate(rpx * rpx / max(rpx * (rpx + len), 1e-3f));
    // light: the moon scattered forward through the flake, and the lamps nearest it
    const float3 v = normalize(F.eye.xyz - p);
    float3 L = F.moonRad.rgb * F.moonRad.w * (0.2f + 1.5f * pow(saturate(dot(-v, F.moonDir.xyz)), 8.0f)) + sky(float3(0, 1, 0)) * 0.6f;
    const uint cl = clusterOf(p), n = min(clusterCount(cl), 8u);
    for (uint j = 0u; j < n; j++) { const Light Lt = Lights[clusterLight(cl, j)]; const float3 d = Lt.p - p; L += intensity(Lt, -normalize(d)) / max(dot(d, d), 0.04f) * (0.5f + 1.5f * pow(saturate(dot(-v, normalize(d))), 4.0f)); }
    o.col = L * 0.85f / PI;
    o.a = coverage * saturate(1.0f - c.w / 40.0f) * (c.w < 0.25f ? 0.0f : 1.0f) * 0.9f;
    return o;
}
float4 ps(SOut i) : SV_Target0 {
    const float dx = i.q.x > 0.0f ? i.q.x : (i.q.x < -i.tail ? i.q.x + i.tail : 0.0f);
    const float r = length(float2(dx, i.q.y));
    return float4(i.col, i.a * saturate(1.0f - r * r));
}
