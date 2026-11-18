// Low Water's native shell, milestone N0 (src/tools/lwshell/). Written for raw-native; no
// third-party source. Four passes, all pulled from vertex indices (RHI version 3 draws have no
// vertex buffers):
//   sky_vs / sky_fs          a full-screen triangle at the far plane: the sky from the view ray
//   terrain_vs / terrain_fs  the tile's cells, two triangles each, heights from a storage buffer
//   capsule_vs / capsule_fs  the walker: a capsule of rings and caps around its feet position
//   post_vs / post_fs        the scene's linear light, tone mapped into the 8-bit backbuffer
// The terrain splits every cell on the diagonal from (i + 1, j) to (i, j + 1), the split the
// game's lw_game_ground interpolates on (games/low-water/runtime/game/main.bld).

struct Frame {
    row_major float4x4 viewProj;   // world to clip: rows, times a column vector
    float4 eye;             // xyz eye position, w time of day (unused at N0)
    float4 sun;             // xyz direction toward the sun, w intensity
    float4 capsule;         // xyz feet position, w radius
    float4 heading;         // xz heading, z capsule height, w cell size in metres
    uint4 grid;             // tile vertices across (x) and deep (y), rings (z), segments (w)
    float4 invRow0, invRow1, invRow2, invRow3;   // clip to world
};
ConstantBuffer<Frame> F : register(b0);

float3 skyColour(float3 d){
    const float up = saturate(d.y * 0.5f + 0.5f);
    const float3 horizon = float3(0.92f, 0.78f, 0.62f);
    const float3 zenith = float3(0.18f, 0.32f, 0.62f);
    float3 c = lerp(horizon, zenith, pow(up, 0.6f));
    const float s = saturate(dot(normalize(d), normalize(F.sun.xyz)));
    c += float3(1.6f, 1.2f, 0.8f) * pow(s, 400.0f) * 6.0f + float3(0.6f, 0.4f, 0.2f) * pow(s, 8.0f) * 0.4f;
    return c;
}
float3 fogged(float3 c, float3 p){
    const float d = length(p - F.eye.xyz);
    const float3 dir = (p - F.eye.xyz) / max(d, 1e-3f);
    const float k = 1.0f - exp(-d * 0.00011f);
    return lerp(c, skyColour(float3(dir.x, max(dir.y, 0.02f), dir.z)), k);
}

// ---------------------------------------------------------------- sky

struct SkyOut { float4 clip : SV_Position; float2 ndc : TEXCOORD0; };
SkyOut sky_vs(uint i : SV_VertexID){
    const float x = float((i << 1u) & 2u) * 2.0f - 1.0f;
    const float y = 1.0f - float(i & 2u) * 2.0f;
    SkyOut o; o.clip = float4(x, y, 1.0f, 1.0f); o.ndc = float2(x, y);
    return o;
}
float4 sky_fs(SkyOut v) : SV_Target0 {
    const float4x4 inv = float4x4(F.invRow0, F.invRow1, F.invRow2, F.invRow3);
    float4 far = mul(inv, float4(v.ndc, 1.0f, 1.0f));
    const float3 d = normalize(far.xyz / far.w - F.eye.xyz);
    return float4(skyColour(d), 1.0f);
}

// ---------------------------------------------------------------- terrain

RWStructuredBuffer<float> H : register(u0);
float heightAt(uint i, uint j){ return H[j * F.grid.x + i]; }
float3 vertexAt(uint i, uint j){ return float3(float(i) * F.heading.w, heightAt(i, j), float(j) * F.heading.w); }
float3 normalAt(uint i, uint j){
    const uint i0 = i > 0u ? i - 1u : i, i1 = min(i + 1u, F.grid.x - 1u);
    const uint j0 = j > 0u ? j - 1u : j, j1 = min(j + 1u, F.grid.y - 1u);
    const float dx = (heightAt(i1, j) - heightAt(i0, j)) / (float(i1 - i0) * F.heading.w);
    const float dz = (heightAt(i, j1) - heightAt(i, j0)) / (float(j1 - j0) * F.heading.w);
    return normalize(float3(-dx, 1.0f, -dz));
}

struct TerrOut { float4 clip : SV_Position; float3 world : TEXCOORD0; float3 normal : TEXCOORD1; };
TerrOut terrain_vs(uint vid : SV_VertexID){
    const uint q = vid / 6u, k = vid % 6u;
    const uint cells = F.grid.x - 1u;
    const uint i = q % cells, j = q / cells;
    // corners: (i, j) (i + 1, j) (i, j + 1) and (i + 1, j + 1) (i, j + 1) (i + 1, j)
    const uint2 c[6] = { uint2(0, 0), uint2(1, 0), uint2(0, 1), uint2(1, 1), uint2(0, 1), uint2(1, 0) };
    const uint ci = i + c[k].x, cj = j + c[k].y;
    TerrOut o;
    o.world = vertexAt(ci, cj);
    o.normal = normalAt(ci, cj);
    o.clip = mul(F.viewProj, float4(o.world, 1.0f));
    return o;
}
float4 terrain_fs(TerrOut v) : SV_Target0 {
    const float3 n = normalize(v.normal);
    const float slope = 1.0f - n.y;
    const float h = v.world.y;
    float3 albedo = lerp(float3(0.20f, 0.27f, 0.12f), float3(0.33f, 0.30f, 0.24f), saturate(slope * 6.0f));
    albedo = lerp(albedo, float3(0.86f, 0.88f, 0.92f), saturate((h - 700.0f) / 300.0f) * saturate(1.0f - slope * 4.0f));
    albedo = lerp(float3(0.55f, 0.50f, 0.38f), albedo, saturate((h - 1.0f) / 4.0f));   // shore sand
    // a 2 m grid of faint lines so motion over the ground reads at N0
    const float2 g = abs(frac(v.world.xz / 2.0f) - 0.5f);
    albedo *= 1.0f - 0.08f * step(0.47f, max(g.x, g.y));
    const float3 L = normalize(F.sun.xyz);
    const float lit = saturate(dot(n, L)) * F.sun.w;
    const float3 c = albedo * (lit * float3(1.0f, 0.92f, 0.80f) + float3(0.20f, 0.24f, 0.32f) * (0.6f + 0.4f * n.y));
    return float4(fogged(c, v.world), 1.0f);
}

// ---------------------------------------------------------------- capsule

struct CapOut { float4 clip : SV_Position; float3 world : TEXCOORD0; float3 normal : TEXCOORD1; };
// A grid of (rings + 1) x (segments + 1) points from the bottom pole to the top pole; the middle
// two rings are the cylinder's ends.
float3 capsulePoint(uint r, uint s, out float3 n){
    const uint rings = F.grid.z, segs = F.grid.w;
    const float rad = F.capsule.w, len = F.heading.z - 2.0f * rad;
    const uint half = rings / 2u;
    const float pi = 3.14159265f;
    float lat, yc;
    if (r <= half){ lat = -0.5f * pi + 0.5f * pi * float(r) / float(half); yc = rad; }
    else { lat = 0.5f * pi * float(r - half - 1u) / float(rings - half - 1u); yc = rad + len; }
    const float lon = 2.0f * pi * float(s) / float(segs);
    n = float3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));
    return F.capsule.xyz + float3(0.0f, yc, 0.0f) + n * rad;
}
CapOut capsule_vs(uint vid : SV_VertexID){
    const uint q = vid / 6u, k = vid % 6u;
    const uint segs = F.grid.w;
    const uint r = q / segs, s = q % segs;
    const uint2 c[6] = { uint2(0, 0), uint2(0, 1), uint2(1, 0), uint2(1, 1), uint2(1, 0), uint2(0, 1) };
    float3 n;
    CapOut o;
    o.world = capsulePoint(r + c[k].x, s + c[k].y, n);
    o.normal = n;
    o.clip = mul(F.viewProj, float4(o.world, 1.0f));
    return o;
}
float4 capsule_fs(CapOut v) : SV_Target0 {
    const float3 n = normalize(v.normal);
    // the coat: a dark oilcloth with a lighter band across the chest, the heading marked by a lamp
    const float3 fwd = normalize(float3(F.heading.x, 0.0f, F.heading.y));
    const float front = saturate(dot(n, fwd));
    const float band = step(abs(v.world.y - F.capsule.y - 1.25f), 0.08f);
    float3 albedo = lerp(float3(0.10f, 0.11f, 0.12f), float3(0.55f, 0.42f, 0.20f), band);
    const float lit = saturate(dot(n, normalize(F.sun.xyz))) * F.sun.w;
    float3 c = albedo * (lit + 0.25f) + float3(1.6f, 1.1f, 0.5f) * pow(front, 24.0f) * step(abs(v.world.y - F.capsule.y - 1.45f), 0.12f);
    return float4(fogged(c, v.world), 1.0f);
}

// ---------------------------------------------------------------- post

Texture2D<float4> S : register(t0);
float4 post_vs(uint i : SV_VertexID) : SV_Position {
    const float x = float((i << 1u) & 2u);
    const float y = float(i & 2u);
    return float4(x * 2.0f - 1.0f, 1.0f - y * 2.0f, 0.0f, 1.0f);
}
float3 tonemap(float3 x){
    // a filmic curve (Hable's operator), then the sRGB encoding
    const float A = 0.22f, B = 0.30f, C = 0.10f, D = 0.20f, E = 0.01f, Fc = 0.30f;
    const float3 m = ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * Fc)) - E / Fc;
    const float w = 11.2f;
    const float wm = ((w * (A * w + C * B) + D * E) / (w * (A * w + B) + D * Fc)) - E / Fc;
    const float3 l = saturate(m / wm);
    return select(l <= 0.0031308f, l * 12.92f, 1.055f * pow(l, 1.0f / 2.4f) - 0.055f);
}
float4 post_fs(float4 q : SV_Position) : SV_Target0 {
    const float3 c = S.Load(int3(int2(q.xy), 0)).rgb * 2.2f;
    return float4(tonemap(c), 1.0f);
}
