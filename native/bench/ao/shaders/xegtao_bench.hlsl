// Entry points that run XeGTAO (third_party/xegtao, MIT, Intel) unchanged for the AO comparison
// (bench/ao/README.md). This file is ours: it does what XeGTAO's README asks of an integration,
// as its own sample (vaGTAO.hlsl) does: constants, resources, a normal loader and a noise source.
// Built with dxc -T cs_6_0 -E <entry>; XE_GTAO_USE_DEFAULT_CONSTANTS 1 is XeGTAO as shipped,
// 0 lets the bench set every heuristic.
#include "XeGTAO.h"

#define VA_SATURATE saturate   // vaShared.hlsl's name for it, used by XeGTAO.hlsli's packing helpers

cbuffer GTAOConstantBuffer : register(b0) { GTAOConstants g_GTAOConsts; }

#include "XeGTAO.hlsli"

SamplerState                g_samplerPointClamp     : register(s0);

Texture2D<float>            g_srcRawDepth           : register(t0);   // NDC depth, D3D convention
RWTexture2D<lpfloat>        g_outWorkingDepthMIP0   : register(u0);
RWTexture2D<lpfloat>        g_outWorkingDepthMIP1   : register(u1);
RWTexture2D<lpfloat>        g_outWorkingDepthMIP2   : register(u2);
RWTexture2D<lpfloat>        g_outWorkingDepthMIP3   : register(u3);
RWTexture2D<lpfloat>        g_outWorkingDepthMIP4   : register(u4);

Texture2D<lpfloat>          g_srcWorkingDepth       : register(t0);
Texture2D<float4>           g_srcNormalmap          : register(t1);   // view-space normal, XeGTAO's axes
RWTexture2D<uint>           g_outWorkingAOTerm      : register(u0);
RWTexture2D<unorm float>    g_outWorkingEdges       : register(u1);

Texture2D<uint>             g_srcWorkingAOTerm      : register(t0);
Texture2D<lpfloat>          g_srcWorkingEdges       : register(t1);
RWTexture2D<uint>           g_outFinalAOTerm        : register(u0);

lpfloat3 LoadNormal(int2 pos) { return (lpfloat3)normalize(g_srcNormalmap.Load(int3(pos, 0)).xyz); }

// XeGTAO's own noise: a Hilbert-curve index driving the R2 sequence (no temporal index here).
lpfloat2 SpatioTemporalNoise(uint2 pixCoord, uint temporalIndex) {
    uint index = HilbertIndex(pixCoord.x, pixCoord.y);
    index += 288 * (temporalIndex % 64);
    return lpfloat2(frac(0.5 + index * float2(0.75487766624669276005, 0.5698402909980532659114)));
}

[numthreads(8, 8, 1)]
void CSPrefilterDepths16x16(uint2 dispatchThreadID : SV_DispatchThreadID, uint2 groupThreadID : SV_GroupThreadID) {
    XeGTAO_PrefilterDepths16x16(dispatchThreadID, groupThreadID, g_GTAOConsts, g_srcRawDepth, g_samplerPointClamp,
        g_outWorkingDepthMIP0, g_outWorkingDepthMIP1, g_outWorkingDepthMIP2, g_outWorkingDepthMIP3, g_outWorkingDepthMIP4);
}

#define XE_BENCH_MAIN(NAME, SLICES, STEPS) \
[numthreads(XE_GTAO_NUMTHREADS_X, XE_GTAO_NUMTHREADS_Y, 1)] \
void NAME(const uint2 pixCoord : SV_DispatchThreadID) { \
    XeGTAO_MainPass(pixCoord, SLICES, STEPS, SpatioTemporalNoise(pixCoord, g_GTAOConsts.NoiseIndex), LoadNormal(pixCoord), \
                    g_GTAOConsts, g_srcWorkingDepth, g_samplerPointClamp, g_outWorkingAOTerm, g_outWorkingEdges); \
}
XE_BENCH_MAIN(CSGTAOLow, 1, 2)
XE_BENCH_MAIN(CSGTAOMedium, 2, 2)
XE_BENCH_MAIN(CSGTAOHigh, 3, 3)
XE_BENCH_MAIN(CSGTAOUltra, 9, 3)

[numthreads(XE_GTAO_NUMTHREADS_X, XE_GTAO_NUMTHREADS_Y, 1)]
void CSDenoisePass(const uint2 dispatchThreadID : SV_DispatchThreadID) {
    XeGTAO_Denoise(dispatchThreadID * uint2(2, 1), g_GTAOConsts, g_srcWorkingAOTerm, g_srcWorkingEdges, g_samplerPointClamp, g_outFinalAOTerm, false);
}

[numthreads(XE_GTAO_NUMTHREADS_X, XE_GTAO_NUMTHREADS_Y, 1)]
void CSDenoiseLastPass(const uint2 dispatchThreadID : SV_DispatchThreadID) {
    XeGTAO_Denoise(dispatchThreadID * uint2(2, 1), g_GTAOConsts, g_srcWorkingAOTerm, g_srcWorkingEdges, g_samplerPointClamp, g_outFinalAOTerm, true);
}
