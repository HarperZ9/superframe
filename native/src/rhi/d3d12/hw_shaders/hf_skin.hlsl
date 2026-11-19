// Skinning (raw/rhi/hw_frame.hpp FrameSkinVertex): linear-blend skinning of each bind-pose vertex by
// its four joints' rows of the palette (world from bind, 3 x 4), into the vertex buffer the raster
// and the rays read. Last frame's position is kept first, for motion vectors (PC.a.z = 1 on the very
// first skin: no last frame, so it is this one). The CPU reference is native/src/scene/skin.cpp.
// PC.a: skinned vertices, the first one's index in the vertex buffer, first.
#include "hf_common.hlsli"
struct SkinV { float3 p; float3 n; float4 t; uint j01; uint j23; float4 w; };
StructuredBuffer<SkinV> SkinIn : register(t8);
StructuredBuffer<float4> Pal : register(t9);
RWStructuredBuffer<Vtx> VOut : register(u40);
RWStructuredBuffer<float4> PrevOut : register(u41);

[numthreads(64, 1, 1)]
void main(uint3 id : SV_DispatchThreadID) {
    if (id.x >= PC.a.x) return;
    const SkinV s = SkinIn[id.x];
    const uint j[4] = { s.j01 & 0xFFFFu, s.j01 >> 16, s.j23 & 0xFFFFu, s.j23 >> 16 };
    const float w[4] = { s.w.x, s.w.y, s.w.z, s.w.w };
    float4 r0 = 0.0f, r1 = 0.0f, r2 = 0.0f;
    [unroll] for (uint k = 0u; k < 4u; k++) { r0 += Pal[j[k] * 3u] * w[k]; r1 += Pal[j[k] * 3u + 1u] * w[k]; r2 += Pal[j[k] * 3u + 2u] * w[k]; }
    const float4 p4 = float4(s.p, 1.0f);
    const float3 p = float3(dot(r0, p4), dot(r1, p4), dot(r2, p4));
    const float3x3 M = float3x3(r0.xyz, r1.xyz, r2.xyz);
    const uint vi = PC.a.y + id.x;
    Vtx v = VOut[vi];
    PrevOut[id.x] = float4(PC.a.z != 0u ? p : v.p, 1.0f);
    v.p = p; v.n = normalize(mul(M, s.n)); v.t = float4(normalize(mul(M, s.t.xyz)), s.t.w);
    VOut[vi] = v;
}
