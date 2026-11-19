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
    float3 tan;        // hair: along the strand
    float sheen, thick;   // cloth: sheen weight; skin: thickness 0 (thin: ears, nostrils) .. 1
};

// a material's uv: metres times its scale; a negative scale turns the texture a quarter (grain along v)
float2 matUV(Mat m, float2 uv) { return m.uvScale < 0.0f ? uv.yx * -m.uvScale : uv * m.uvScale; }
float2 matD(Mat m, float2 d) { return m.uvScale < 0.0f ? d.yx * -m.uvScale : d * m.uvScale; }
float4 texA(Mat m, float2 uv, float lod) { return m.texA < 0 ? float4(1, 1, 1, 0.5f) : Tex[NonUniformResourceIndex(m.texA)].SampleLevel(sWrap, matUV(m, uv), lod); }
float4 texB(Mat m, float2 uv, float lod) { return m.texB < 0 ? float4(0.5f, 0.5f, 0.5f, 1) : Tex[NonUniformResourceIndex(m.texB)].SampleLevel(sWrap, matUV(m, uv), lod); }
float4 texAg(Mat m, float2 uv, float2 dx, float2 dy) { return m.texA < 0 ? float4(1, 1, 1, 0.5f) : Tex[NonUniformResourceIndex(m.texA)].SampleGrad(sWrap, matUV(m, uv), matD(m, dx), matD(m, dy)); }
float4 texBg(Mat m, float2 uv, float2 dx, float2 dy) { return m.texB < 0 ? float4(0.5f, 0.5f, 0.5f, 1) : Tex[NonUniformResourceIndex(m.texB)].SampleGrad(sWrap, matUV(m, uv), matD(m, dx), matD(m, dy)); }

float hash21(float2 p) { p = frac(p * float2(123.34f, 456.21f)); p += dot(p, p + 45.32f); return frac(p.x * p.y); }

float n2(float2 p) { const float2 i = floor(p), f = frac(p), u = f * f * (3.0f - 2.0f * f); return lerp(lerp(hash21(i), hash21(i + float2(1, 0)), u.x), lerp(hash21(i + float2(0, 1)), hash21(i + 1.0f), u.x), u.y); }
// a soft-edged mask of a rectangle (for silhouettes and strokes)
float rectMask(float2 p, float2 lo, float2 hi, float e) { const float2 d = max(lo - p, p - hi); return 1.0f - saturate(max(d.x, d.y) / e + 0.5f); }

// The room behind a window (interior mapping, van Dongen 2008): a box `depth` deep seen through the
// glass. Lit rooms are warm, with a lamp glow near the ceiling, shelves of things on the back wall,
// a table and chair in the middle distance, curtains drawn back at the sides and, on some sills, a
// potted plant as a dark shape against the light. uv: 0..1 across the glass; v: the view ray in the
// glass's frame (z out of the wall). c: lit, seed, depth, curtains.
float3 interior(float2 uv, float3 v, float4 c) {
    const float lit = c.x, seed = c.y, depth = c.z;
    if (lit <= 0.0f) return float3(0.002f, 0.002f, 0.0025f);
    const float3 o = float3(uv * 2.0f - 1.0f, 0.0f), dir = normalize(float3(v.xy, max(1e-3f, -v.z)));
    const float3 tWall = (sign(dir) * float3(1, 1, depth) - float3(o.xy, 0)) / dir;
    const float t = min(min(tWall.x, tWall.y), tWall.z);
    const float3 h = o + dir * t;
    const float3 warm = lerp(float3(1.0f, 0.62f, 0.30f), float3(1.0f, 0.82f, 0.58f), frac(seed * 7.1f));
    float3 col;
    if (t == tWall.z) {
        col = warm * (0.55f + 0.2f * hash21(floor(h.xy * 2.0f + seed * 10)));
        for (int k = 0; k < 2; k++) {
            const float sy = 0.1f + 0.45f * float(k);
            col *= 1.0f - 0.7f * rectMask(h.xy, float2(-0.9f, sy), float2(0.9f, sy + 0.03f), 0.01f);
            const float cell = floor(h.x * 9.0f), hgt = 0.08f + 0.18f * hash21(float2(cell, seed * 3 + k));
            if (hash21(float2(cell + 7, k + seed)) > 0.35f) col *= 1.0f - 0.55f * rectMask(float2(frac(h.x * 9.0f), h.y), float2(0.15f, sy + 0.03f), float2(0.85f, sy + 0.03f + hgt), 0.03f);
        }
    } else if (t == tWall.y) col = warm * (dir.y > 0 ? 0.9f : 0.32f + 0.08f * frac(h.z * 2.0f));
    else col = warm * 0.5f * (0.8f + 0.2f * frac(h.z * 3.0f + seed));
    const float2 lamp = float2(frac(seed * 3) - 0.5f, depth * 0.6f);
    const float glow = exp(-dot(h.xz - lamp, h.xz - lamp) * 2.0f) * (h.y > 0.5f ? 2.0f : 0.6f);
    col *= 0.8f + glow;
    if (frac(seed * 5.3f) > 0.3f) {
        const float2 q = o.xy + dir.xy * (depth * (0.45f + 0.2f * frac(seed * 11)) / dir.z);
        const float table = rectMask(q, float2(-0.55f, -0.45f), float2(0.35f, -0.38f), 0.02f) + rectMask(q, float2(-0.5f, -1.0f), float2(-0.44f, -0.4f), 0.02f) + rectMask(q, float2(0.27f, -1.0f), float2(0.33f, -0.4f), 0.02f);
        const float chair = rectMask(q, float2(0.45f, -1.0f), float2(0.5f, -0.1f), 0.02f) + rectMask(q, float2(0.45f, -0.55f), float2(0.75f, -0.5f), 0.02f);
        col *= 1.0f - 0.8f * saturate(max(table, chair));
    }
    if (frac(seed * 13.7f) > 0.5f) {
        const float2 q = o.xy + dir.xy * (0.12f / dir.z), pc = float2(frac(seed * 17) * 1.2f - 0.6f, -0.82f);
        const float pot = rectMask(q, pc + float2(-0.1f, -0.18f), pc + float2(0.1f, 0.0f), 0.02f);
        const float leaves = saturate(1.0f - length((q - pc - float2(0, 0.17f)) * float2(1.2f, 1.0f)) / 0.22f) * step(0.35f, n2(q * 9.0f + seed));
        col *= 1.0f - 0.92f * saturate(pot + leaves * 1.5f);
    }
    if (c.w > 0.5f && abs(uv.x - 0.5f) > 0.32f) col = warm * (0.4f + 0.12f * sin(uv.x * 60.0f + seed * 9));
    return col * lit * 3.0f;
}

// a glyph: a cell of a sign holds a character drawn as three to five strokes picked by its seed
// (bars, posts, diagonals and dots), so a board reads as writing from across the street
float glyph(float2 p, float s) {
    float m = 0.0f;
    for (int k = 0; k < 5; k++) {
        const float h = hash21(float2(s * 13.1f + k, s * 7.7f - k)), h2 = hash21(float2(s + k * 3.3f, k + 0.5f));
        if (k > 2 && h2 < 0.4f) continue;
        if (h < 0.3f) m = max(m, rectMask(p, float2(0.15f, 0.15f + 0.6f * h2), float2(0.85f, 0.25f + 0.6f * h2), 0.03f));
        else if (h < 0.6f) m = max(m, rectMask(p, float2(0.2f + 0.5f * h2, 0.1f), float2(0.3f + 0.5f * h2, 0.9f), 0.03f));
        else if (h < 0.85f) { const float2 a = float2(0.2f, 0.2f), b = h2 < 0.5f ? float2(0.8f, 0.85f) : float2(0.8f, 0.2f), ab = b - a; const float tt = saturate(dot(p - a, ab) / dot(ab, ab)); m = max(m, saturate((0.07f - length(p - a - ab * tt)) / 0.03f)); }
        else m = max(m, saturate((0.09f - length(p - float2(0.3f + 0.4f * h2, 0.75f))) / 0.03f));
    }
    return saturate(m);
}
// the signs: painted boards (c.x < 2: ground by c.x, seed c.y, lamp-lit c.z) and light boxes
// (c.x 2..5: the hue, lit from inside), each lettered in a row of glyphs along its long side
float3 signPaint(float2 uv, float4 c, out float3 emis) {
    const bool box = c.x >= 2.0f;
    const float3 hues[4] = { float3(1.0f, 0.92f, 0.8f), float3(1.0f, 0.5f, 0.3f), float3(0.7f, 1.0f, 0.8f), float3(0.75f, 0.85f, 1.0f) };
    const float3 ground = box ? hues[min(3u, (uint)c.x - 2u)] * 0.9f : lerp(float3(0.42f, 0.08f, 0.05f), float3(0.08f, 0.1f, 0.12f), step(0.5f, c.x));
    const float3 ink = box ? float3(0.05f, 0.03f, 0.03f) : float3(0.85f, 0.78f, 0.6f);
    const float2 q = box ? float2(uv.y, uv.x) : uv;
    const float n = box ? 4.0f : 6.0f, cellI = floor(q.x * n);
    const float2 inCell = float2(frac(q.x * n), (q.y - 0.15f) / 0.7f);
    const float g = all(inCell >= 0.0f) && all(inCell <= 1.0f) ? glyph(inCell, cellI + c.y * 97.0f) : 0.0f;
    const float3 col = lerp(ground, ink, g);
    emis = box ? col * (1.0f - g * 0.9f) * 1.6f : col * c.z * 0.12f;
    return col;
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
