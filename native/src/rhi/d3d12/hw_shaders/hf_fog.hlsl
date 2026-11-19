// Froxel volumetric fog (SKY-04, Hillaire 2015 / Wronski 2014). MODE 0: each froxel of a 160 x 90
// x 128 grid (exponential in depth) takes its density from height and drifting noise, and its
// in-scattered light from the moon and up to twelve of its cluster's lamps, each through an RT
// shadow ray, blended with last frame's froxel. MODE 1: integrated front to back per column.
#include "hf_light.hlsli"
#include "hf_medium.hlsli"

float hgPhase(float c, float g) { const float g2 = g * g; return (1.0f - g2) / (4.0f * PI * pow(max(1e-4f, 1.0f + g2 - 2.0f * g * c), 1.5f)); }
float3 froxelWorld(float3 f) {
    const float vz = froxelZ(f.z);
    const float2 ndc = float2(f.x / float(FX) * 2.0f - 1.0f, 1.0f - f.y / float(FY) * 2.0f);
    const float3 right = float3(F.view[0][0], F.view[0][1], F.view[0][2]), up = float3(F.view[1][0], F.view[1][1], F.view[1][2]);
    return F.eye.xyz + F.fwd.xyz * vz + right * ndc.x * F.eye.w * F.fwd.w * vz + up * ndc.y * F.eye.w * vz;
}

#if MODE == 0
[numthreads(8, 8, 1)]
void main(uint3 id : SV_DispatchThreadID) {
    if (id.x >= FX || id.y >= FY || id.z >= FZ) return;
    if (!on(F_FOG)) { fogScat[id] = 0.0f; return; }
    Rng r = rngAt(id.xy + uint2(0, id.z * FY), F.counts.x, 77u);
    const float3 jit = float3(rnd(r), rnd(r), rnd(r));   // jittered in all three, then blended over frames
    const float3 p = froxelWorld(float3(id) + jit), vdir = normalize(p - F.eye.xyz);
    const float sigma = density(p);
    float3 Lin = sky(float3(0, 1, 0)) * 0.6f / (4.0f * PI) * 4.0f * PI * 0.25f;
    // the moon
    {
        const float3 l = coneDir(F.moonDir.xyz, 0.99996f, rnd2(r));
        const bool vis = !on(F_SHADOW) || !occluded(p, l, 1500.0f);
        Lin += vis ? F.moonRad.rgb * F.moonRad.w * hgPhase(dot(vdir, F.moonDir.xyz), F.fog.z) : 0.0f;
    }
    // the lamps: three picks, each by RIS over 12 lamps drawn from every light, each shadowed
    for (uint k = 0u; k < 3u; k++) Lin += fogLampRIS(p, vdir, r, 12u) * (1.0f / 3.0f);
    // multiple scattering: the haze is optically thick down the street (about 3 along the view), so light
    // scattered more than once adds about half again to what the froxels see once; the factor is fitted to the
    // path-traced reference on the committed view (an approximation in the spirit of Hillaire 2020's
    // isotropic multiple-scattering term), not derived
    const float kMultiple = 1.15f;
    float4 cur = float4(Lin * sigma * kMultiple, sigma);
    // last frame's froxel at this point, where it was in view
    const float4 pc = mul(F.prevViewProj, float4(p, 1.0f));
    if (pc.w > 0.05f && !on(F_RESET)) {
        const float2 ndc = pc.xy / pc.w;
        const float3 pf = float3((ndc.x * 0.5f + 0.5f) * float(FX), (0.5f - ndc.y * 0.5f) * float(FY), froxelS(dot(p - F.eye.xyz, F.fwd.xyz)));
        if (all(pf >= 0.0f) && all(pf < float3(FX, FY, FZ))) cur = lerp(cur, fogPrev[uint3(pf)], 0.96f);
    }
    fogScat[id] = cur;
}
#else
[numthreads(8, 8, 1)]
void main(uint3 id : SV_DispatchThreadID) {
    if (id.x >= FX || id.y >= FY) return;
    float3 acc = 0.0f; float T = 1.0f, zPrev = 0.0f;
    for (uint z = 0u; z < FZ; z++) {
        const float zz = froxelZ(float(z) + 1.0f), dz = (zz - zPrev) / max(1e-4f, dot(normalize(froxelWorld(float3(id.xy, z) + 0.5f) - F.eye.xyz), F.fwd.xyz));
        // a 3 x 3 tent over neighbouring froxels of the slice takes the speckle out of the sampled lamps
        float4 s = 0.0f; float ws = 0.0f;
        for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
            const int2 q = clamp(int2(id.xy) + int2(dx, dy), int2(0, 0), int2(FX - 1, FY - 1));
            const float wk = (dx == 0 ? 2.0f : 1.0f) * (dy == 0 ? 2.0f : 1.0f);
            s += fogScat[uint3(q, z)] * wk; ws += wk;
        }
        s /= ws;
        const float ext = max(s.w, 1e-7f), tr = exp(-ext * dz);
        acc += T * s.rgb * (1.0f - tr) / ext;          // energy-conserving step (Hillaire 2015)
        T *= tr;
        fogInt[uint3(id.xy, z)] = float4(acc, T);
        fogPrev[uint3(id.xy, z)] = fogScat[uint3(id.xy, z)];
        zPrev = zz;
    }
}
#endif
