// A surface at a ray hit or a raster fragment, and the BRDF every pass shares.
#ifndef HF_SURFACE
#define HF_SURFACE
#include "hf_material.hlsli"

// interpolated vertex data of triangle `tri` at barycentrics b
Vtx vtxAt(uint tri, float2 b) {
    const Vtx a = Verts[Idx[tri * 3]], c1 = Verts[Idx[tri * 3 + 1]], c2 = Verts[Idx[tri * 3 + 2]];
    const float w0 = 1.0f - b.x - b.y;
    Vtx v;
    v.p = a.p * w0 + c1.p * b.x + c2.p * b.y;
    v.n = normalize(a.n * w0 + c1.n * b.x + c2.n * b.y);
    v.t = a.t * w0 + c1.t * b.x + c2.t * b.y;
    v.uv = a.uv * w0 + c1.uv * b.x + c2.uv * b.y;
    v.c = a.c * w0 + c1.c * b.x + c2.c * b.y;
    return v;
}
float3 faceNormal(uint tri) {
    const float3 a = Verts[Idx[tri * 3]].p, b = Verts[Idx[tri * 3 + 1]].p, c = Verts[Idx[tri * 3 + 2]].p;
    return normalize(cross(b - a, c - a));
}

// Fill everything but lighting. lod < 0: use gradients dx, dy (the raster); else that mip level.
Surf surface(uint mi, Vtx v, float3 ng, float3 viewDir, float lod, float2 dx, float2 dy) {
    const Mat m = Mats[mi];
    Surf s;
    s.p = v.p; s.ng = ng; s.n = v.n; s.c = v.c; s.uv = v.uv; s.kind = m.kind;
    s.emis = 0.0f; s.ao = 1.0f; s.f0 = 0.04f; s.metal = 0.0f;
    if (dot(s.ng, viewDir) > 0.0f) { s.ng = -s.ng; }
    if (dot(s.n, s.ng) < 0.0f) { s.n = -s.n; }
    const float3 T = normalize(v.t.xyz - s.n * dot(v.t.xyz, s.n) + 1e-6f);
    const float B = v.t.w < 0.0f ? -1.0f : 1.0f;
    if (m.kind == K_LAMP) {
        s.albedo = 0.6f; s.rough = 0.6f; s.emis = v.c.rgb * v.c.a * 5.0f;
        return s;
    }
    if (m.kind == K_SIGN) {
        float3 e; s.albedo = signPaint(v.uv, v.c, e); s.rough = 0.55f; s.emis = e;
        return s;
    }
    if (m.kind == K_LOGEND) {
        // a cut log's end: growth rings that wander, darker late wood, heartwood, radial checks and a
        // bark rim, all from the log's own seed (c.x), check count (c.y) and turn (c.z)
        const float r = length(v.uv), a = atan2(v.uv.y, v.uv.x) + v.c.z, seed = v.c.x;
        const float wob = 0.06f * sin(a * 3.0f + seed * 20.0f) + 0.04f * sin(a * 7.0f + seed * 9.0f);
        const float ringN = 9.0f + 7.0f * seed, ring = frac((r + wob * r) * ringN + seed * 3.0f);
        const float late = smoothstep(0.65f, 0.95f, ring);
        const float fresh = v.c.w;   // most ends are a winter old: grey-brown; a few are fresh cuts
        float3 wood = lerp(lerp(float3(0.24f, 0.2f, 0.16f), float3(0.46f, 0.34f, 0.21f), fresh), lerp(float3(0.15f, 0.12f, 0.1f), float3(0.3f, 0.2f, 0.12f), fresh), late * 0.7f) * lerp(0.75f, 1.1f, frac(seed * 13.7f));
        wood = lerp(wood, float3(0.32f, 0.3f, 0.28f), smoothstep(0.5f, 0.85f, r) * 0.45f * frac(seed * 5.1f));   // weathered grey toward the bark
        wood = lerp(wood * float3(0.78f, 0.62f, 0.5f), wood, smoothstep(0.25f, 0.55f, r));
        float crack = 0.0f;
        for (uint k = 0u; k < (uint)v.c.y + 1u; k++) { const float ca = frac(seed * 7.3f + k * 0.37f) * 6.2832f; crack = max(crack, saturate(1.0f - abs(sin((a - ca) * 0.5f)) * r * 60.0f) * smoothstep(0.15f, 0.5f, r)); }
        wood *= 1.0f - 0.8f * crack;
        s.albedo = r > 0.9f ? float3(0.12f, 0.09f, 0.07f) * (0.8f + 0.4f * hash21(float2(a * 20.0f, seed))) : wood;
        s.rough = 0.85f; s.ao = 1.0f - 0.5f * crack;
        return s;
    }
    if (m.kind == K_GLASS) {
        s.albedo = 0.0f; s.rough = 0.03f; s.f0 = 0.04f;
        const float3 bt = cross(s.n, T) * B;
        const float3 lv = float3(dot(viewDir, T), dot(viewDir, bt), dot(viewDir, s.n));
        s.emis = interior(v.uv, lv, v.c);
        return s;
    }
    if (m.kind == K_GROUND) {
        const uint base = asuint(m.pad);
        const Mat L0 = Mats[base], L1 = Mats[base + 1], L2 = Mats[base + 2], L3 = Mats[base + 3];
        const float4 a0 = lod < 0 ? texAg(m, v.uv, dx, dy) : texA(m, v.uv, lod);
        const float4 a1 = lod < 0 ? texAg(L0, v.uv, dx, dy) : texA(L0, v.uv, lod), a2 = lod < 0 ? texAg(L1, v.uv, dx, dy) : texA(L1, v.uv, lod);
        const float4 a3 = lod < 0 ? texAg(L2, v.uv, dx, dy) : texA(L2, v.uv, lod), a4 = lod < 0 ? texAg(L3, v.uv, dx, dy) : texA(L3, v.uv, lod);
        const float4 w = groundBlend(saturate(v.c), a0.a, float4(a1.a, a2.a, a3.a, a4.a));
        const float w0 = saturate(1.0f - dot(w, 1.0f));
        const float4 b0 = lod < 0 ? texBg(m, v.uv, dx, dy) : texB(m, v.uv, lod), b1 = lod < 0 ? texBg(L0, v.uv, dx, dy) : texB(L0, v.uv, lod);
        const float4 b2 = lod < 0 ? texBg(L1, v.uv, dx, dy) : texB(L1, v.uv, lod), b3 = lod < 0 ? texBg(L2, v.uv, dx, dy) : texB(L2, v.uv, lod), b4 = lod < 0 ? texBg(L3, v.uv, dx, dy) : texB(L3, v.uv, lod);
        float4 A = a0 * w0 + a1 * w.x + a2 * w.y + a3 * w.z + a4 * w.w;
        A.rgb = a0.rgb * m.tint * w0 + a1.rgb * L0.tint * w.x + a2.rgb * L1.tint * w.y + a3.rgb * L2.tint * w.z + a4.rgb * L3.tint * w.w;
        const float4 N = b0 * w0 + b1 * w.x + b2 * w.y + b3 * w.z + b4 * w.w;
        Mat mm = m; mm.tint = 1.0f;
        mm.roughScale = m.roughScale * w0 + L0.roughScale * w.x + L1.roughScale * w.y + L2.roughScale * w.z + L3.roughScale * w.w;
        mm.roughBias = m.roughBias * w0 + L0.roughBias * w.x + L1.roughBias * w.y + L2.roughBias * w.z + L3.roughBias * w.w;
        shadeTextures(s, mm, T, B, A, N);
        // snow where the blend is mostly snow (fresh, packed, trodden): its scattering and glints
        s.kind = (w0 + w.x + w.y) > 0.5f ? K_SNOW : K_OPAQUE;
        s.c = float4(0.2f, w.z * 0.6f, 0.0f, 0.5f);
        return s;
    }
    const float4 A = lod < 0 ? texAg(m, v.uv, dx, dy) : texA(m, v.uv, lod), N = lod < 0 ? texBg(m, v.uv, dx, dy) : texB(m, v.uv, lod);
    shadeTextures(s, m, T, B, A, N);
    // detail: a fine grain at eight times the texture's repeat, fading out by six metres (the
    // scans run out of resolution under a metre)
    if (lod <= 0.0f) {
        const float fade = saturate(1.0f - length(v.p - F.eye.xyz) / 6.0f);
        if (fade > 0.0f) {
            const float2 q = matUV(m, v.uv) * 8.0f, e = float2(0.02f, 0.0f);
            const float h0 = n2(q * 16.0f), hx = n2((q + e.xy) * 16.0f), hy = n2((q + e.yx) * 16.0f);
            const float3 bt = cross(s.n, T) * B;
            s.n = normalize(s.n + (T * (h0 - hx) + bt * (h0 - hy)) * 2.5f * fade);
            s.albedo *= 1.0f + (h0 - 0.5f) * 0.12f * fade;
        }
    }
    weather(s);
    if (m.kind == K_ICE) { s.albedo = lerp(float3(0.55f, 0.72f, 0.8f), s.albedo, 0.25f); s.rough = 0.04f; s.f0 = 0.018f; }
    return s;
}

Surf surfaceAtHit(Hit h, float3 rayDir, float lod) {
    const Vtx v = vtxAt(h.tri, h.bary);
    return surface(TriMat[h.tri], v, faceNormal(h.tri), rayDir, lod, 0.0f, 0.0f);
}

// GGX with height-correlated Smith visibility and Schlick Fresnel
float D_ggx(float a2, float nh) { const float d = nh * nh * (a2 - 1.0f) + 1.0f; return a2 / (PI * d * d); }
float V_smith(float a2, float nv, float nl) {
    const float gv = nl * sqrt(nv * nv * (1.0f - a2) + a2), gl = nv * sqrt(nl * nl * (1.0f - a2) + a2);
    return 0.5f / max(gv + gl, 1e-6f);
}
float3 F_schlick(float3 f0, float vh) { return f0 + (1.0f - f0) * pow(1.0f - saturate(vh), 5.0f); }
float3 specF0(Surf s) { return lerp(float3(s.f0, s.f0, s.f0), s.albedo, s.metal); }
// the diffuse response to a light from l (not times albedo: the denoiser divides albedo out)
float diffuseTerm(Surf s, float3 l) {
    const float nl = dot(s.n, l);
    if (s.kind == K_SNOW && on(F_SSS)) { const float w = 0.35f; return saturate((nl + w) / (1.0f + w)) / (1.0f + w) * step(0.0f, dot(s.ng, l) + 0.25f); }
    return saturate(nl) * step(0.0f, dot(s.ng, l));
}
float3 specTerm(Surf s, float3 v, float3 l) {
    const float3 h = normalize(v + l);
    const float nl = saturate(dot(s.n, l)), nv = saturate(dot(s.n, v)) + 1e-4f, nh = saturate(dot(s.n, h)), a = max(s.rough * s.rough, 0.002f), a2 = a * a;
    return D_ggx(a2, nh) * V_smith(a2, nv, nl) * F_schlick(specF0(s), dot(v, h)) * nl;
}
// a split-sum style estimate of the specular albedo, used to demodulate reflections
float3 specAlbedo(Surf s, float3 v) {
    const float nv = saturate(dot(s.n, v)), r = s.rough;
    const float4 c0 = float4(-1, -0.0275f, -0.572f, 0.022f), c1 = float4(1, 0.0425f, 1.04f, -0.04f);
    const float4 q = r * c0 + c1;
    const float a004 = min(q.x * q.x, exp2(-9.28f * nv)) * q.x + q.y;
    const float2 ab = float2(-1.04f, 1.04f) * a004 + q.zw;
    return specF0(s) * ab.x + ab.y;
}

// glints of snow: facets on a grid at the pixel's footprint, each a mirror with its own tilt; a
// facet that reflects the light toward the eye flashes (stable under the camera, fades with size)
float glint(Surf s, float3 v, float3 l, float footprint) {
    if (s.kind != K_SNOW || !on(F_GLINT)) return 0.0f;
    const float cell = max(0.0025f, footprint);
    const float3 g = floor(s.p / cell);
    const float r1 = hash21(g.xz + g.y * 17.0f), r2 = hash21(g.zy + 3.1f), r3 = hash21(g.xy + 7.7f);
    if (r3 > 0.12f) return 0.0f;
    const float3x3 B = basis(s.n);
    const float3 fn = normalize(s.n + (B[0] * (r1 - 0.5f) + B[1] * (r2 - 0.5f)) * 0.9f);
    const float3 h = normalize(v + l);
    const float k = pow(saturate(dot(fn, h)), 4000.0f);
    return k * 60.0f * saturate(dot(s.n, l)) * (0.0025f / cell);
}
#endif
