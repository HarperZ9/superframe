// A G-buffer pixel as a surface (the screen passes' view of hf_gbuffer.hlsl's targets).
#ifndef HF_GBUF
#define HF_GBUF
#include "hf_light.hlsli"

bool loadSurf(uint2 px, out Surf s, out float3 v) {
    const float4 g = gGeo[px];
    s = (Surf)0; v = 0;
    if (g.x <= 0.0f) return false;
    const float4 a = gAlbedo[px], n = gNormal[px], e = gEmis[px];
    s.p = worldAt(px, g.x); s.n = normalize(n.xyz); s.ng = s.n; s.albedo = a.rgb; s.rough = a.w; s.metal = n.w;
    s.emis = e.rgb; s.kind = (uint)floor(e.w + 1e-3f); s.ao = saturate(frac(e.w + 1e-3f) * 2.0f); s.f0 = g.w;
    v = normalize(F.eye.xyz - s.p);
    return true;
}
// the screen size of a pixel at distance d, in metres
float footprintAt(float d) { return d * 2.0f * F.eye.w * F.size.w; }
// reflections are traced for these; everything else takes the lamps' and moon's analytic specular
bool glossy(Surf s) { return on(F_REFLECT) && (s.rough < 0.35f || s.kind == K_GLASS || s.kind == K_ICE); }

// the reservoir of ReSTIR DI (Bitterli et al. 2020, LGT-04): a light, the two numbers that pick
// its point, the running weight sum and the number of candidates seen
struct Resv { uint light; float2 u; float wsum; float M; };
uint4 packResv(Resv r) { return uint4(r.light, (uint(saturate(r.u.x) * 65535.0f) << 16) | uint(saturate(r.u.y) * 65535.0f), asuint(r.wsum), asuint(r.M)); }
Resv unpackResv(uint4 q) { Resv r; r.light = q.x; r.u = float2(float(q.y >> 16), float(q.y & 0xFFFFu)) / 65535.0f; r.wsum = asfloat(q.z); r.M = asfloat(q.w); return r; }
Resv emptyResv() { Resv r; r.light = 0xFFFFFFFFu; r.u = 0; r.wsum = 0; r.M = 0; return r; }
// the target function: the unshadowed luminance the light gives this surface
float pHat(Surf s, float3 v, uint li, float2 u) {
    if (li == 0xFFFFFFFFu) return 0.0f;
    const Light L = Lights[li];
    const LightSample ls = evalLight(s, v, L, lightPoint(L, s.p, u));
    return glossy(s) ? lum(ls.diff * max(s.albedo, 0.05f)) : ls.w;
}
bool update(inout Resv r, uint li, float2 u, float w, float M, inout Rng rng) {
    r.wsum += w; r.M += M;
    if (w > 0.0f && rnd(rng) * r.wsum < w) { r.light = li; r.u = u; return true; }
    return false;
}
#endif
