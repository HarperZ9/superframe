// Lights into the view's froxel clusters (LGT clustered shading): each cluster keeps up to MAXL
// lights whose reach (where their intensity falls under a floor) meets the cluster's box, in the
// order of the light list when there are more (counted in the findings as a limit).
#include "hf_light.hlsli"

// a light reaches as far as its intensity stays over 0.06 (about a twentieth of what the snow under a
// street lamp receives); past that the cluster leaves it out
float reach(Light L) { return sqrt(max(L.col.r, max(L.col.g, L.col.b)) * L.power * LSCALE / 0.06f); }

[numthreads(64, 1, 1)]
void main(uint3 id : SV_DispatchThreadID) {
    const uint c = id.x;
    if (c >= CX * CY * CZ) return;
    const uint x = c % CX, y = (c / CX) % CY, z = c / (CX * CY);
    const float z0 = F.cluster.x * exp(float(z) / float(CZ) * F.cluster.z), z1 = F.cluster.x * exp(float(z + 1u) / float(CZ) * F.cluster.z);
    const float tanY = F.eye.w, tanX = tanY * F.fwd.w;
    const float2 n0 = float2(float(x) / float(CX) * 2.0f - 1.0f, 1.0f - float(y + 1u) / float(CY) * 2.0f), n1 = float2(float(x + 1u) / float(CX) * 2.0f - 1.0f, 1.0f - float(y) / float(CY) * 2.0f);
    float3 lo = 1e30f, hi = -1e30f;
    for (uint k = 0u; k < 8u; k++) {
        const float zz = (k & 1u) ? z1 : z0, nx = (k & 2u) ? n1.x : n0.x, ny = (k & 4u) ? n1.y : n0.y;
        const float3 p = float3(nx * tanX * zz, ny * tanY * zz, zz);
        lo = min(lo, p); hi = max(hi, p);
    }
    const uint base = c * (MAXL + 1u), total = (uint)F.cluster.w;
    uint n = 0u;
    for (uint i = 0u; i < total && n < MAXL; i++) {
        const Light L = Lights[i];
        const float3 v = mul(F.view, float4(L.p, 1.0f)).xyz;
        const float3 q = clamp(v, lo, hi);
        const float r = reach(L);
        if (dot(q - v, q - v) <= r * r) { clusterBuf[base + 1u + n] = i; n++; }
    }
    clusterBuf[base] = n;
}
