// The characters' materials (lwframe_chars.cpp binds them; the hero generator in
// games/low-water/characters/hero writes the vertex numbers):
//   K_SKIN   tint the skin tone; c = (thickness, flush, stubble, cavity); uv round the head in metres.
//            Pores and mottling procedural; a wrapped diffuse with light through thin parts here,
//            the screen-space profile blur in hf_sss.hlsl, a random walk in hf_pt.hlsl.
//   K_CLOTH  a scanned set (wool, felt, linen, leather) or none (brass: metal); c = (cavity, wet,
//            dirt, seam); the material's pad is its sheen weight (Charlie sheen, Estevez and Kulla 2017).
//   K_EYE    uv the eye-local x, y over its radius, c.x forward; the iris under the cornea found by
//            refracting the view (parallax); c.z = 1 the tear line.
//   K_HAIR   tint the hair colour; tangent along the strand; c = (root to tip, the strand's random).
//            Marschner-style lobes R, TT, TRT in the Karis 2016 approximation.
#ifndef HF_CHARACTER
#define HF_CHARACTER
#include "hf_material.hlsli"

Surf charSurface(Surf s, Mat m, Vtx v, float3 T, float B, float3 viewDir, float lod, float2 dx, float2 dy) {
    const float3 bt = cross(s.n, T) * B;
    if (m.kind == K_SKIN) {
        const float flush = v.c.y, stub = v.c.z, cav = v.c.w, dist = length(v.p - F.eye.xyz);
        float3 a = m.tint;
        a = lerp(a, a * float3(1.16f, 0.7f, 0.68f), flush * 0.6f);
        a *= 0.9f + 0.12f * n2(v.uv * 150.0f) + 0.08f * n2(v.uv * 480.0f + 7.0f);
        const float follicle = step(0.6f, n2(v.uv * 2400.0f));
        a = lerp(a, a * float3(0.5f, 0.5f, 0.56f), stub * (0.3f + 0.55f * follicle));
        s.albedo = a * (1.0f - 0.3f * cav);
        const float fade = saturate(1.0f - dist / 2.5f);
        if (fade > 0.0f && lod <= 0.0f) {
            const float2 q = v.uv * 1100.0f; const float e = 0.12f;
            const float h0 = n2(q), hx = n2(q + float2(e, 0)), hy = n2(q + float2(0, e));
            const float g0 = n2(q * 0.31f + 3.0f), gx = n2((q + float2(e, 0)) * 0.31f + 3.0f), gy = n2((q + float2(0, e)) * 0.31f + 3.0f);
            s.n = normalize(s.n + (T * (h0 - hx + 0.6f * (g0 - gx)) + bt * (h0 - hy + 0.6f * (g0 - gy))) * 0.9f * fade);
        }
        s.rough = saturate(0.5f - 0.14f * flush - 0.08f * n2(v.uv * 40.0f) + 0.1f * stub);
        s.f0 = 0.028f; s.ao = 1.0f - 0.5f * cav; s.thick = v.c.x; s.metal = 0.0f;
        return s;
    }
    if (m.kind == K_CLOTH) {
        const float4 A = lod < 0 ? texAg(m, v.uv, dx, dy) : texA(m, v.uv, lod), N = lod < 0 ? texBg(m, v.uv, dx, dy) : texB(m, v.uv, lod);
        shadeTextures(s, m, T, B, A, N);
        const float occ = v.c.x, wet = v.c.y, dirt = v.c.z, seam = v.c.w;
        s.albedo *= 1.0f - 0.4f * occ; s.ao *= 1.0f - 0.5f * occ;
        s.albedo = lerp(s.albedo, s.albedo * float3(0.72f, 0.64f, 0.54f), dirt * 0.6f);
        s.albedo *= lerp(1.0f, 0.62f, wet); s.rough = lerp(s.rough, s.rough * 0.65f, wet);
        const float stitch = step(0.45f, frac((v.uv.x + v.uv.y) * 320.0f));
        s.albedo *= 1.0f - seam * (0.3f + 0.3f * stitch); s.ao *= 1.0f - 0.4f * seam;
        s.sheen = m.metal > 0.0f ? 0.0f : m.pad;
        return s;
    }
    if (m.kind == K_EYE) {
        s.f0 = 0.025f; s.rough = 0.025f; s.metal = 0.0f;
        if (v.c.z > 0.5f) { s.albedo = float3(0.5f, 0.3f, 0.28f); s.rough = 0.06f; return s; }
        const float3 tv = -viewDir;
        const float3 vt = float3(dot(tv, T), dot(tv, bt), dot(tv, s.n));
        const float2 e = v.uv; const float z = v.c.x, r0 = length(e), RI = 0.47f;
        float2 ie = e;
        if (z > 0.0f && r0 < RI + 0.08f) ie = e - vt.xy / max(vt.z, 0.3f) * (0.2f * saturate(1.0f - (r0 / RI) * (r0 / RI)) + 0.03f) * 0.73f;
        const float r = length(ie), ang = atan2(ie.y, ie.x);
        const float3 sclera = lerp(float3(0.78f, 0.74f, 0.7f), float3(0.72f, 0.48f, 0.44f), smoothstep(0.45f, 0.95f, abs(e.x)) * (0.25f + 0.35f * n2(e * 40.0f)));
        float3 a = sclera;
        if (z > 0.0f && r < RI + 0.04f) {
            const float fib = n2(float2(ang * 9.0f, r * 14.0f)) * 0.6f + n2(float2(ang * 31.0f, r * 40.0f)) * 0.4f;
            float3 iris = m.tint * (0.5f + 0.9f * fib);
            iris = lerp(iris, m.tint * 1.6f + 0.05f, exp(-((r - 0.24f) / 0.04f) * ((r - 0.24f) / 0.04f)) * 0.5f);   // the collarette
            iris *= lerp(1.0f, 0.35f, smoothstep(RI * 0.78f, RI, r));                                                // the limbal ring
            iris = r < 0.165f ? 0.008f : iris;                                                                        // the pupil
            a = lerp(iris, sclera, smoothstep(RI - 0.01f, RI + 0.04f, r));
        }
        s.albedo = a; s.ao = lerp(0.55f, 1.0f, smoothstep(-0.2f, 0.6f, z));
        return s;
    }
    // K_HAIR
    const float t = v.c.x, rnd = v.c.y;
    s.albedo = m.tint * (0.75f + 0.5f * rnd) * lerp(0.75f, 1.0f, t);
    s.rough = 0.35f; s.tan = normalize(v.t.xyz); s.ao = lerp(0.55f, 1.0f, t); s.metal = 0.0f;
    return s;
}

// hair: longitudinal Gaussians about the shifted half angle, azimuthal terms as fitted by Karis
float hairM(float x, float b) { return exp(-0.5f * x * x / (b * b)) / (b * 2.5066f); }
float3 hairSpec(Surf s, float3 v, float3 l) {
    const float3 t = s.tan;
    const float sl = clamp(dot(t, l), -1.0f, 1.0f), sv = clamp(dot(t, v), -1.0f, 1.0f);
    const float thL = asin(sl), thV = asin(sv), thH = 0.5f * (thL + thV), cosThD = cos(0.5f * (thL - thV));
    const float3 lp = l - sl * t, vp = v - sv * t;
    const float cosPhi = dot(lp, vp) * rsqrt(max(dot(lp, lp) * dot(vp, vp), 1e-8f)), cosHalfPhi = sqrt(saturate(0.5f + 0.5f * cosPhi));
    const float shift = 0.035f, b = 0.09f + 0.2f * s.rough;
    const float f = 0.0465f + (1.0f - 0.0465f) * pow(1.0f - saturate(cosThD * sqrt(saturate(0.5f + 0.5f * dot(l, v)))), 5.0f);
    const float R = hairM(thH + 2.0f * shift, b) * 0.25f * cosHalfPhi * f;
    const float3 TT = hairM(thH - shift, b * 0.5f) * exp(-3.65f * cosPhi - 3.98f) * pow(max(s.albedo, 1e-3f), 0.5f / max(cosThD, 0.2f)) * (1.0f - f) * (1.0f - f);
    const float3 TRT = hairM(thH - 3.0f * shift, b * 2.0f) * exp(17.0f * cosPhi - 16.78f) * pow(max(s.albedo, 1e-3f), 0.8f / max(cosThD, 0.2f)) * f;
    return (R + TT + TRT) * saturate(dot(s.n, l) * 0.4f + 0.6f);
}
#endif
