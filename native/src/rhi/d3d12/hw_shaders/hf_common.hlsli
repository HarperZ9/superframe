// The hero frame's shared declarations (raw/rhi/hw_frame.hpp). One root signature serves every
// pass (src/rhi/d3d12/hf_device.cpp): the frame constants, sixteen pass constants, the scene as
// root SRVs, the material textures bindless, and every frame target at a fixed UAV slot.
#ifndef HF_COMMON
#define HF_COMMON

struct Frame {
    float4x4 viewProj, prevViewProj, invViewProj, view;
    float4 eye;              // xyz, w: tan(fovy / 2)
    float4 size;             // w, h, 1/w, 1/h
    float4 jitter;           // this frame's sub-pixel jitter (pixels) xy, last frame's zw
    float4 moonDir;          // xyz toward the moon, w cos of its half angle
    float4 moonRad;          // radiance of the disc, w: its solid angle
    float4 skyParams;        // rotation (radians), sky scale, ambient floor, exposure (linear)
    float4 cluster;          // near, far, log(far / near), lights
    float4 fog;              // density at the street, height falloff (1/m), anisotropy g, max distance
    uint4 counts;            // frame index, flags (F_*), the sky's bindless index, path-traced samples so far
    float4 timeParams;       // seconds, snow fall speed, wind x, wind z
    float4 fwd;              // camera forward xyz, w aspect
};
ConstantBuffer<Frame> F : register(b0);
struct PassC { uint4 a; float4 b; uint4 c; float4 d; };
ConstantBuffer<PassC> PC : register(b1);

// flags in F.counts.y
static const uint F_GI = 1u, F_REFLECT = 2u, F_GTAO = 4u, F_FOG = 8u, F_RESTIR = 16u, F_SNOW = 32u, F_TAA = 64u,
                  F_GLINT = 128u, F_SSS = 256u, F_SHADOW = 512u, F_POM = 1024u, F_BLOOM = 2048u, F_RESET = 4096u;
bool on(uint f) { return (F.counts.y & f) != 0u; }

struct Vtx { float3 p; float3 n; float4 t; float2 uv; float4 c; };
struct Mat { int texA; int texB; float uvScale; float heightScale; float3 tint; float roughScale; float roughBias; float metal; uint kind; float pad; };
struct Light { float3 p; float radius; float3 col; float power; float3 aim; float cone; };
// material kinds
static const uint K_OPAQUE = 0u, K_SNOW = 1u, K_GROUND = 2u, K_GLASS = 3u, K_ICE = 4u, K_LAMP = 5u, K_SIGN = 6u;

RaytracingAccelerationStructure Scene : register(t0);
StructuredBuffer<Vtx> Verts : register(t1);
StructuredBuffer<uint> Idx : register(t2);
StructuredBuffer<uint> TriMat : register(t3);
StructuredBuffer<Mat> Mats : register(t4);
StructuredBuffer<Light> Lights : register(t5);
Texture2D<float4> Tex[] : register(t0, space1);    // material textures; the sky is the last
SamplerState sWrap : register(s0);                  // anisotropic, wrap
SamplerState sClamp : register(s1);                 // linear, clamp

// frame targets (u slots are fixed in hf_device.cpp)
RWTexture2D<float4> gAlbedo : register(u0);     // albedo, roughness
RWTexture2D<float4> gNormal : register(u1);     // shading normal, metal
RWTexture2D<float4> gEmis : register(u2);       // emission, kind
RWTexture2D<float4> gGeo : register(u3);        // view depth (0 sky), motion xy (pixels), specular F0
RWTexture2D<float> aoOut : register(u4);        // GTAO, unpacked
RWTexture2D<float4> dDiff : register(u5);       // direct diffuse irradiance (demodulated) + w: glint
RWTexture2D<float4> dSpec : register(u6);       // direct specular radiance
RWTexture2D<float4> giRaw : register(u7);       // GI irradiance, w hit distance
RWTexture2D<float4> rfRaw : register(u8);       // reflected radiance, w hit distance
RWTexture2D<float4> histDiff : register(u9);    // accumulated diffuse, w history length
RWTexture2D<float4> histSpec : register(u10);   // accumulated specular, w history length
RWTexture2D<float4> filtA : register(u11);      // a-trous ping
RWTexture2D<float4> filtB : register(u12);      // a-trous pong
RWTexture2D<float4> hdr : register(u13);        // composited HDR
RWTexture2D<float4> taaA : register(u14);       // TAA history (read)
RWTexture2D<float4> taaB : register(u15);       // TAA history (write)
RWTexture3D<float4> fogScat : register(u16);    // froxel in-scatter, extinction
RWTexture3D<float4> fogInt : register(u17);     // integrated scatter, transmittance
RWTexture2D<float4> ldr : register(u18);        // tone-mapped output
RWStructuredBuffer<uint> clusterBuf : register(u19);   // per cluster: count, then MAXL light indices
RWStructuredBuffer<uint4> resv : register(u20);        // ReSTIR reservoirs, this frame
RWStructuredBuffer<uint4> resvPrev : register(u21);    // last frame's
RWTexture2D<float4> bloom[7] : register(u22);          // bloom chain, half size down
RWTexture2D<float4> ptAcc : register(u29);             // the reference path tracer's sum
RWTexture2D<float4> geoPrev : register(u30);           // last frame's gGeo (for reprojection)
RWTexture2D<float4> nrmPrev : register(u31);           // last frame's gNormal
RWTexture3D<float4> fogPrev : register(u32);           // last frame's froxels
RWStructuredBuffer<float> gtaoG : register(u33);       // post_gtao's view-space G-buffer, 8 floats a pixel
RWStructuredBuffer<float> gtaoO : register(u34);       // post_gtao's visibility
RWTexture2D<float4> histDiffPrev : register(u35);      // last frame's accumulated diffuse
RWTexture2D<float4> histSpecPrev : register(u36);      // last frame's accumulated specular
static const uint FX = 160u, FY = 90u, FZ = 128u;      // froxel grid
float froxelZ(float s) { return F.cluster.x * exp(s / float(FZ) * log(F.fog.w / F.cluster.x)); }   // slice to view depth
float froxelS(float vz) { return log(max(vz, F.cluster.x) / F.cluster.x) / log(F.fog.w / F.cluster.x) * float(FZ); }

static const float PI = 3.14159265f;
static const uint CX = 32u, CY = 18u, CZ = 48u, MAXL = 63u;   // cluster grid and lights a cluster

// hashing and random numbers
uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
struct Rng { uint s; };
Rng rngAt(uint2 px, uint frame, uint salt) { Rng r; r.s = pcg(px.x + pcg(px.y + pcg(frame * 9781u + salt))); return r; }
float rnd(inout Rng r) { r.s = pcg(r.s); return float(r.s >> 8) * (1.0f / 16777216.0f); }
float2 rnd2(inout Rng r) { return float2(rnd(r), rnd(r)); }
// a value that is not finite (a degenerate sample) becomes 0 before it can spread through history and bloom
float3 finite3(float3 c) { return all(isfinite(c)) ? c : 0.0f; }
float lum(float3 c) { return dot(c, float3(0.2126f, 0.7152f, 0.0722f)); }

float3x3 basis(float3 n) {
    const float s = n.z >= 0.0f ? 1.0f : -1.0f, a = -1.0f / (s + n.z), b = n.x * n.y * a;
    return float3x3(float3(1.0f + s * n.x * n.x * a, s * b, -s * n.x), float3(b, s + n.y * n.y * a, -n.y), n);
}
float3 cosineDir(float3 n, float2 u) {
    const float r = sqrt(u.x), phi = 2.0f * PI * u.y;
    const float3x3 B = basis(n);
    return normalize(B[0] * (r * cos(phi)) + B[1] * (r * sin(phi)) + n * sqrt(max(0.0f, 1.0f - u.x)));
}
float3 coneDir(float3 d, float cosMax, float2 u) {
    const float c = 1.0f - u.x * (1.0f - cosMax), s = sqrt(max(0.0f, 1.0f - c * c)), phi = 2.0f * PI * u.y;
    const float3x3 B = basis(d);
    return normalize(B[0] * (s * cos(phi)) + B[1] * (s * sin(phi)) + d * c);
}

// the sky: equirectangular radiance, rotated about up, the moon taken out (added analytically)
float3 sky(float3 d) {
    const float a = atan2(d.x, -d.z) + F.skyParams.x, u = frac(a / (2.0f * PI) + 0.5f), v = acos(clamp(d.y, -1.0f, 1.0f)) / PI;
    const uint last = F.counts.z;     // the bindless index of the sky texture
    return max(Tex[NonUniformResourceIndex(last)].SampleLevel(sClamp, float2(u, v), 0).rgb * F.skyParams.y, F.skyParams.z);
}
float3 moonDisc(float3 d) { return dot(d, F.moonDir.xyz) > F.moonDir.w ? F.moonRad.rgb : 0.0f; }

// camera
float3 viewRay(float2 px) {
    const float2 ndc = float2(px.x * F.size.z * 2.0f - 1.0f, 1.0f - px.y * F.size.w * 2.0f);
    const float4 h = mul(F.invViewProj, float4(ndc, 1.0f, 1.0f));
    return normalize(h.xyz / h.w - F.eye.xyz);
}
float3 worldAt(uint2 px, float vz) { const float3 r = viewRay(float2(px) + 0.5f); return F.eye.xyz + r * (vz / max(1e-4f, dot(r, F.fwd.xyz))); }

// rays
bool occluded(float3 o, float3 d, float tmax) {
    RayQuery<RAY_FLAG_ACCEPT_FIRST_HIT_AND_END_SEARCH | RAY_FLAG_SKIP_PROCEDURAL_PRIMITIVES | RAY_FLAG_FORCE_OPAQUE> q;
    RayDesc r; r.Origin = o; r.Direction = d; r.TMin = 0.0f; r.TMax = tmax;
    q.TraceRayInline(Scene, 0, 0xFF, r);
    q.Proceed();
    return q.CommittedStatus() == COMMITTED_TRIANGLE_HIT;
}
struct Hit { bool hit; float t; uint tri; float2 bary; };
Hit trace(float3 o, float3 d, float tmax) {
    RayQuery<RAY_FLAG_SKIP_PROCEDURAL_PRIMITIVES | RAY_FLAG_FORCE_OPAQUE> q;
    RayDesc r; r.Origin = o; r.Direction = d; r.TMin = 0.0f; r.TMax = tmax;
    q.TraceRayInline(Scene, 0, 0xFF, r);
    q.Proceed();
    Hit h; h.hit = q.CommittedStatus() == COMMITTED_TRIANGLE_HIT;
    h.t = h.hit ? q.CommittedRayT() : tmax; h.tri = h.hit ? q.CommittedPrimitiveIndex() : 0u; h.bary = h.hit ? q.CommittedTriangleBarycentrics() : 0.0f;
    return h;
}
float3 offsetRay(float3 p, float3 n) { return p + n * (0.004f + 0.0006f * length(p - F.eye.xyz)); }

// clusters: froxels of the view, exponential in depth
uint clusterOf(float3 wp) {
    const float4 c = mul(F.viewProj, float4(wp, 1.0f));
    if (c.w <= 1e-3f) return 0xFFFFFFFFu;
    const float2 ndc = c.xy / c.w;
    if (any(abs(ndc) > 1.0f)) return 0xFFFFFFFFu;
    const float vz = dot(wp - F.eye.xyz, F.fwd.xyz);
    const int z = int(log(max(vz, F.cluster.x) / F.cluster.x) / F.cluster.z * float(CZ));
    if (z >= int(CZ)) return 0xFFFFFFFFu;
    const uint x = min(CX - 1u, uint((ndc.x * 0.5f + 0.5f) * float(CX))), y = min(CY - 1u, uint((0.5f - ndc.y * 0.5f) * float(CY)));
    return (uint(max(z, 0)) * CY + y) * CX + x;
}
#endif
