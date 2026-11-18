// Materials of the hero frame: the scanned texture sets, aged by each vertex's wear, wetness and
// dirt; the layered ground (fresh, packed and trodden snow, cobbles, earth, blended by height);
// snow with a scattering lobe and glints; windows with a lit room behind the glass (interior
// mapping); lamps and signs that glow. The raster G-buffer and every ray hit read the same code,
// so the path-traced reference and the real-time frame shade one material model.
#ifndef HF_MATERIAL
#define HF_MATERIAL
#include "hf_common.hlsli"

struct Surf {
    float3 p, n, ng, albedo, emis;
    float rough, metal, f0, ao;
    uint kind;
    float4 c;          // the vertex numbers
    float2 uv;
};

// a material's uv: metres times its scale; a negative scale turns the texture a quarter (grain along v)
float2 matUV(Mat m, float2 uv) { return m.uvScale < 0.0f ? uv.yx * -m.uvScale : uv * m.uvScale; }
float2 matD(Mat m, float2 d) { return m.uvScale < 0.0f ? d.yx * -m.uvScale : d * m.uvScale; }
float4 texA(Mat m, float2 uv, float lod) { return m.texA < 0 ? float4(1, 1, 1, 0.5f) : Tex[NonUniformResourceIndex(m.texA)].SampleLevel(sWrap, matUV(m, uv), lod); }
float4 texB(Mat m, float2 uv, float lod) { return m.texB < 0 ? float4(0.5f, 0.5f, 0.5f, 1) : Tex[NonUniformResourceIndex(m.texB)].SampleLevel(sWrap, matUV(m, uv), lod); }
float4 texAg(Mat m, float2 uv, float2 dx, float2 dy) { return m.texA < 0 ? float4(1, 1, 1, 0.5f) : Tex[NonUniformResourceIndex(m.texA)].SampleGrad(sWrap, matUV(m, uv), matD(m, dx), matD(m, dy)); }
float4 texBg(Mat m, float2 uv, float2 dx, float2 dy) { return m.texB < 0 ? float4(0.5f, 0.5f, 0.5f, 1) : Tex[NonUniformResourceIndex(m.texB)].SampleGrad(sWrap, matUV(m, uv), matD(m, dx), matD(m, dy)); }

float hash21(float2 p) { p = frac(p * float2(123.34f, 456.21f)); p += dot(p, p + 45.32f); return frac(p.x * p.y); }

// the room behind a window: a box `depth` deep seen through the glass, its walls, floor and
// ceiling lit warm when the room is lit, with a lamp glow near the ceiling (interior mapping:
// Joost van Dongen, 2008). uv: 0..1 across the glass; v: the view ray in the glass's frame.
float3 interior(float2 uv, float3 v, float4 c) {
    const float lit = c.x, seed = c.y, depth = c.z;
    if (lit <= 0.0f) return float3(0.002f, 0.002f, 0.0025f);
    const float3 o = float3(uv * 2.0f - 1.0f, 0.0f), dir = normalize(float3(v.xy, max(1e-3f, -v.z)));
    const float3 tWall = (sign(dir) * float3(1, 1, depth) - float3(o.xy, 0)) / dir;
    const float t = min(min(tWall.x, tWall.y), tWall.z);
    const float3 h = o + dir * t;
    const float3 warm = lerp(float3(1.0f, 0.62f, 0.30f), float3(1.0f, 0.82f, 0.58f), frac(seed * 7.1f));
    float3 col;
    if (t == tWall.z) col = warm * (0.55f + 0.25f * hash21(floor(h.xy * 3.0f + seed * 10)));            // back wall
    else if (t == tWall.y) col = warm * (dir.y > 0 ? 0.9f : 0.35f + 0.1f * frac(h.z * 2.0f));          // ceiling / floor
    else col = warm * 0.5f * (0.8f + 0.2f * frac(h.z * 3.0f + seed));                                  // side walls
    const float glow = exp(-dot(h.xz - float2(frac(seed * 3) - 0.5f, depth * 0.6f), h.xz - float2(frac(seed * 3) - 0.5f, depth * 0.6f)) * 2.0f) * (h.y > 0.5f ? 2.0f : 0.6f);
    const float curtain = c.w > 0.5f && abs(uv.x - 0.5f) > 0.3f ? 0.35f : 1.0f;
    return col * (0.8f + glow) * lit * 3.0f * curtain;
}

// the signs' painted boards: a ground colour and strokes of lettering from the seed, lit or not
float3 signPaint(float2 uv, float4 c) {
    const float3 ground = lerp(float3(0.42f, 0.08f, 0.05f), float3(0.08f, 0.1f, 0.12f), step(0.5f, c.x));
    const float2 g = floor(float2(uv.x * 7.0f, uv.y * 2.0f));
    const float stroke = step(0.55f, hash21(g + c.y * 13.0f)) * step(0.15f, frac(uv.x * 7.0f)) * step(frac(uv.x * 7.0f), 0.85f) * step(0.2f, frac(uv.y * 2.0f)) * step(frac(uv.y * 2.0f), 0.8f);
    return lerp(ground, float3(0.85f, 0.78f, 0.6f), stroke);
}

// height-blended ground layers: each layer's height (texture alpha) plus its weight decides
float4 groundBlend(float4 w, float h0, float4 h) {
    const float4 k = float4(w.x, w.y, w.z, w.w), base = 1.0f - saturate(dot(k, 1.0f));
    float4 s = k * 1.0f + h * 0.6f; const float s0 = base + h0 * 0.6f;
    const float top = max(max(max(s.x, s.y), max(s.z, s.w)), s0) - 0.18f;
    float4 r = max(s - top, 0.0f) * step(0.001f, k); const float r0 = max(s0 - top, 0.0f);
    return r / max(1e-4f, dot(r, 1.0f) + r0);
}

// Fill a surface from its material and textures: albedo (linear), normal, roughness, metal, ao
void shadeTextures(inout Surf s, Mat m, float3 T, float B, float4 A, float4 N) {
    s.albedo = A.rgb * m.tint;
    float2 nxy = N.xy * 2.0f - 1.0f;
    const float3 tn = float3(nxy, sqrt(saturate(1.0f - dot(nxy, nxy))));
    const float3 bt = cross(s.n, T) * B;
    s.n = normalize(T * tn.x + bt * tn.y + s.n * tn.z);
    s.rough = saturate(N.z * m.roughScale + m.roughBias);
    s.ao = N.w;
    s.metal = m.metal;
}

// age the surface by the vertex numbers: wear darkens and roughens, wetness darkens and smooths,
// dirt browns the foot of a wall (only on kinds that carry wear)
void weather(inout Surf s) {
    if (s.kind != K_OPAQUE) return;
    const float wear = s.c.x, wet = s.c.y, dirt = s.c.z, v = s.c.w;
    s.albedo *= lerp(1.0f, 0.62f + 0.3f * v, wear * 0.6f);
    s.albedo = lerp(s.albedo, s.albedo * float3(0.75f, 0.68f, 0.58f), dirt * 0.5f);
    s.albedo *= lerp(1.0f, 0.55f, wet * 0.7f);
    s.rough = lerp(s.rough, s.rough * 0.45f, wet * 0.8f);
    s.rough = saturate(s.rough + wear * 0.08f);
}
#endif
