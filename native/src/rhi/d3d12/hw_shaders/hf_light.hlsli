// Light of the hero frame: the moon (a disc, shadowed by a ray into its cone), and the lamps,
// spheres with a radius so their shadows are soft, aimed by a cone where they have a shade.
#ifndef HF_LIGHT
#define HF_LIGHT
#include "hf_surface.hlsli"

static const float LSCALE = 2.0f;    // a light's power to radiant intensity, in the sky's units

// radiant intensity toward a direction d leaving the light
float3 intensity(Light L, float3 d) {
    float k = 1.0f;
    if (dot(L.aim, L.aim) > 0.0f) k = smoothstep(L.cone - 0.35f, L.cone + 0.25f, dot(d, L.aim));
    return L.col * L.power * LSCALE * k;
}
// a point on the light's sphere, toward the shading point p, and its direction and distance
float3 lightPoint(Light L, float3 p, float2 u) {
    const float3 c = L.p - p, w = normalize(c);
    const float3x3 B = basis(-w);
    const float r = L.radius * sqrt(u.x), a = 2.0f * PI * u.y;
    return L.p + (B[0] * cos(a) + B[1] * sin(a)) * r - w * L.radius * 0.3f;
}
// the unshadowed contribution of a light, split diffuse (no albedo) and specular; its weight for RIS
struct LightSample { float3 diff; float3 spec; float3 l; float dist; float w; };
LightSample evalLight(Surf s, float3 v, Light L, float3 q) {
    LightSample o;
    const float3 d = q - s.p;
    o.dist = length(d); o.l = d / max(o.dist, 1e-4f);
    const float3 I = intensity(L, -o.l) / max(o.dist * o.dist, 0.0025f);
    o.diff = I * diffuseTerm(s, o.l);
    o.spec = I * specTerm(s, v, o.l);
    o.w = lum(o.diff * max(s.albedo, 0.05f) + o.spec);
    return o;
}
// the moon: irradiance from the disc, the shadow by one ray into a cone a little wider than the
// disc (the night's thin haze softens it); returns diffuse (no albedo) and specular
void moonLight(Surf s, float3 v, inout Rng r, out float3 diff, out float3 spec, out float3 glintOut, float footprint) {
    const float3 E = F.moonRad.rgb * F.moonRad.w;
    const float3 l = coneDir(F.moonDir.xyz, 0.99996f, rnd2(r));
    float vis = 1.0f;
    if (on(F_SHADOW) && dot(s.ng, l) > -0.2f) vis = occluded(offsetRay(s.p, s.ng), l, 2000.0f) ? 0.0f : 1.0f;
    diff = E * diffuseTerm(s, F.moonDir.xyz) * vis;
    spec = E * specTerm(s, v, F.moonDir.xyz) * vis;
    glintOut = E * glint(s, v, F.moonDir.xyz, footprint) * vis;
}
// the cluster's lights for a point (or none outside the view)
uint clusterCount(uint c) { return c == 0xFFFFFFFFu ? 0u : min(clusterBuf[c * (MAXL + 1u)], MAXL); }
uint clusterLight(uint c, uint i) { return clusterBuf[c * (MAXL + 1u) + 1u + i]; }

// one light by RIS from the cluster (or, outside the view, from every light by power), with a
// shadow ray: the estimate of all of them. M candidates.
void lampsRIS(Surf s, float3 v, inout Rng r, uint M, out float3 diff, out float3 spec) {
    diff = 0.0f; spec = 0.0f;
    const uint c = clusterOf(s.p), n = clusterCount(c), total = (uint)F.cluster.w;
    const uint pool = n > 0u ? n : total;
    if (pool == 0u) return;
    float wsum = 0.0f; LightSample pick; pick.diff = 0; pick.spec = 0; pick.l = 0; pick.dist = 0; pick.w = 0; uint pickL = 0u;
    for (uint k = 0u; k < M; k++) {
        const uint j = min(pool - 1u, uint(rnd(r) * float(pool)));
        const uint li = n > 0u ? clusterLight(c, j) : j;
        const Light L = Lights[li];
        const LightSample ls = evalLight(s, v, L, lightPoint(L, s.p, rnd2(r)));
        const float w = ls.w * float(pool);
        wsum += w;
        if (rnd(r) * wsum < w) { pick = ls; pickL = li; }
    }
    if (wsum <= 0.0f || pick.w <= 0.0f) return;
    const float W = wsum / (float(M) * pick.w);
    if (on(F_SHADOW) && occluded(offsetRay(s.p, s.ng), pick.l, pick.dist - Lights[pickL].radius * 1.2f)) return;
    diff = pick.diff * W; spec = pick.spec * W;
}
// Light scattered by fog at p toward travel direction w from one lamp, chosen by RIS among M lamps
// drawn uniformly from every light (no cluster: the many far lamps add up in the haze), shadowed.
float hgPhaseL(float c, float g) { const float g2 = g * g; return (1.0f - g2) / (4.0f * PI * pow(max(1e-4f, 1.0f + g2 - 2.0f * g * c), 1.5f)); }
float3 fogLampRIS(float3 p, float3 w, inout Rng r, uint M) {
    const uint n = (uint)F.cluster.w;
    if (n == 0u) return 0.0f;
    float wsum = 0.0f, pw = 0.0f; float3 pickL = 0.0f, pl = 0.0f; float pd = 0.0f; uint pi = 0u;
    for (uint k = 0u; k < M; k++) {
        const uint li = min(n - 1u, uint(rnd(r) * float(n)));
        const Light L = Lights[li];
        const float3 q = lightPoint(L, p, rnd2(r)), d = q - p; const float dist = length(d); const float3 l = d / max(dist, 1e-4f);
        const float3 c = intensity(L, -l) / max(dist * dist, 0.04f) * hgPhaseL(dot(w, l), F.fog.z);
        const float wi = lum(c) * float(n);
        wsum += wi;
        if (wi > 0.0f && rnd(r) * wsum < wi) { pickL = c; pw = lum(c); pl = l; pd = dist - L.radius * 1.2f; pi = li; }
    }
    if (pw <= 0.0f) return 0.0f;
    if (on(F_SHADOW) && occluded(p, pl, pd)) return 0.0f;
    return pickL * (wsum / (float(M) * pw));
}
#endif
