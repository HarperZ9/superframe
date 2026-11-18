// The G-buffer packed for the engine's fast GTAO (bench/ao/shaders/ours_gtao_fast.hlsl, unchanged;
// bench/ao/README.md has its scores against XeGTAO and a ray-cast reference), MODE 0, and its
// visibility unpacked to a target, MODE 1. The fast kernel reads a depth it turns into view depth
// as ssr.x / (ssr.y - z) (here z = 1 - 1 / view depth, so x = y = 1; 1 where empty) and a view
// normal of 4 floats a pixel, in post_gtao's view space (x right, y up, z toward the eye).
// gtaoG holds Z (n floats), N (4n), D (2n, the kernel's depth levels) and T (n, its raw AO).
#include "hf_common.hlsli"

[numthreads(8, 8, 1)]
void main(uint3 id : SV_DispatchThreadID) {
    const uint w = (uint)F.size.x, h = (uint)F.size.y;
    if (id.x >= w || id.y >= h) return;
    const uint i = id.y * w + id.x;
#if MODE == 0
    const float4 g = gGeo[id.xy];
    const uint n = w * h;
    if (g.x <= 0.0f) { gtaoG[i] = 1.0f; return; }
    const float3 vn = mul((float3x3)F.view, gNormal[id.xy].xyz);
    gtaoG[i] = 1.0f - 1.0f / max(g.x, 1.0001f);
    gtaoG[n + i * 4u] = vn.x; gtaoG[n + i * 4u + 1u] = vn.y; gtaoG[n + i * 4u + 2u] = -vn.z; gtaoG[n + i * 4u + 3u] = 0.0f;
#else
    aoOut[id.xy] = on(F_GTAO) ? saturate(gtaoO[i]) : 1.0f;
#endif
}
