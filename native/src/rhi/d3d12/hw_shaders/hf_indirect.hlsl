// Indirect light by ray tracing. MODE 0, GI: one cosine-weighted ray a pixel (GI-* one-bounce RT
// GI with screen feedback). At its hit the light is last frame's accumulated irradiance where the
// hit is on screen (so bounces add up frame over frame), else the moon and one lamp with shadow
// rays; a miss sees the sky. Stored as irradiance (pi times radiance) without the albedo.
// MODE 1, reflections: one GGX ray (visible normals, Heitz 2018) for glossy pixels, the hit lit the
// same way plus what glows; a miss sees the sky and the moon.
#include "hf_gbuf.hlsli"

float3 sampleVndf(float3 v, float a, float2 u) {
    const float3 vh = normalize(float3(a * v.x, a * v.y, v.z));
    const float lensq = vh.x * vh.x + vh.y * vh.y;
    const float3 T1 = lensq > 0 ? float3(-vh.y, vh.x, 0) * rsqrt(lensq) : float3(1, 0, 0), T2 = cross(vh, T1);
    const float r = sqrt(u.x), phi = 2.0f * PI * u.y, t1 = r * cos(phi);
    float t2 = r * sin(phi);
    const float s = 0.5f * (1.0f + vh.z);
    t2 = (1.0f - s) * sqrt(1.0f - t1 * t1) + s * t2;
    const float3 nh = t1 * T1 + t2 * T2 + sqrt(max(0.0f, 1.0f - t1 * t1 - t2 * t2)) * vh;
    return normalize(float3(a * nh.x, a * nh.y, max(0.0f, nh.z)));
}

// light leaving a hit toward the ray's origin; emissive surfaces count only for reflections
static float2 originPx;
float3 radianceAt(Hit hh, float3 dir, inout Rng r, bool emissive) {
    if (!hh.hit) return sky(dir) + (emissive ? moonDisc(dir) : 0.0f);
    const Surf s = surfaceAtHit(hh, dir, clamp(log2(1.0f + hh.t * 2.0f), 0.0f, 8.0f));
    const float3 v = -dir;
    float3 e = emissive ? s.emis : 0.0f;
    if (s.kind == K_LAMP || s.kind == K_GLASS) return e;
    // screen feedback: last frame's irradiance at the hit, if the hit was on screen and visible
    const float4 c = mul(F.prevViewProj, float4(s.p, 1.0f));
    if (c.w > 0.05f) {
        const float2 px = (c.xy / c.w * float2(0.5f, -0.5f) + 0.5f) * F.size.xy;
        // ... and only a hit at least a few pixels from where the ray left counts as last frame's light there
        if (all(px >= 1.0f) && all(px < F.size.xy - 1.0f) && !on(F_RESET) && length(px - originPx) > 3.0f) {
            const float4 gp = geoPrev[uint2(px)];
            if (abs(gp.x - dot(s.p - F.eye.xyz, F.fwd.xyz)) < 0.03f * gp.x + 0.05f && dot(nrmPrev[uint2(px)].xyz, s.n) > 0.7f)
                return e + s.albedo * (1.0f - s.metal) / PI * histDiffPrev[uint2(px)].rgb;
        }
    }
    float3 md, ms, g, ld, ls;
    moonLight(s, v, r, md, ms, g, 1.0f);
    lampsRIS(s, v, r, 4u, ld, ls);
    return e + s.albedo * (1.0f - s.metal) / PI * (md + ld) + ms + ls;
}

[numthreads(8, 8, 1)]
void main(uint3 id : SV_DispatchThreadID) {
    const uint w = (uint)F.size.x, h = (uint)F.size.y;
    if (id.x >= w || id.y >= h) return;
    Surf s; float3 v;
    Rng r = rngAt(id.xy, F.counts.x, 31u + MODE);
    originPx = float2(id.xy) + 0.5f;
#if MODE == 0
    if (!on(F_GI) || !loadSurf(id.xy, s, v) || s.kind == K_LAMP || s.kind == K_GLASS) { giRaw[id.xy] = 0.0f; return; }
    float3 d = cosineDir(s.n, rnd2(r));
    if (dot(d, s.ng) < 0.0f) d = reflect(d, s.ng);
    Hit hh = trace(offsetRay(s.p, s.ng), d, 400.0f);
    // a ray that meets the surface it left (the reconstructed point a hair under a bevel or a board's
    // edge) would feed the pixel its own light back and run away over frames: such a hit is no bounce
    float3 L = 0.0f;
    if (!(hh.hit && hh.t < 0.03f)) L = radianceAt(hh, d, r, false);
    giRaw[id.xy] = float4(L * PI, hh.t);
#else
    if (!loadSurf(id.xy, s, v) || !glossy(s)) { rfRaw[id.xy] = 0.0f; return; }
    const float3x3 B = basis(s.n);
    const float3 vt = float3(dot(v, B[0]), dot(v, B[1]), dot(v, B[2]));
    const float a = max(s.rough * s.rough, 0.001f);
    const float3 m = sampleVndf(vt, a, rnd2(r));
    const float3 mt = B[0] * m.x + B[1] * m.y + B[2] * m.z;
    float3 d = reflect(-v, mt);
    if (dot(d, s.ng) <= 0.0f) d = reflect(d, s.ng);
    // far enough for water to double a shore a kilometre off
    const Hit hh = trace(offsetRay(s.p, s.ng), d, 1500.0f);
    rfRaw[id.xy] = float4(radianceAt(hh, d, r, true), hh.t);
#endif
}
