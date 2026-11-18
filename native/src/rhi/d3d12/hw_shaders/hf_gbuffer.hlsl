// The G-buffer: every triangle rastered by vertex pulling (one draw over the index buffer), the
// material evaluated with texture gradients, parallax occlusion mapping (MAT POM: Tatarchuk 2006)
// on materials with a height map, written to four targets (see hf_common.hlsli gAlbedo..gGeo).
#include "hf_surface.hlsli"

struct VOut {
    float4 pos : SV_Position;
    float3 wp : WP;
    float3 n : NRM;
    float4 t : TAN;
    float2 uv : UV;
    float4 c : COL;
    float4 prev : PREV;
    float4 cur : CUR;
};

VOut vs(uint vid : SV_VertexID) {
    const Vtx v = Verts[Idx[vid]];
    VOut o;
    const float4 c = mul(F.viewProj, float4(v.p, 1.0f));
    o.cur = c;
    o.prev = mul(F.prevViewProj, float4(v.p, 1.0f));
    o.pos = c + float4(F.jitter.xy * float2(2.0f, -2.0f) * F.size.zw * c.w, 0, 0);
    o.wp = v.p; o.n = v.n; o.t = v.t; o.uv = v.uv; o.c = v.c;
    return o;
}

struct POut { float4 albedo : SV_Target0; float4 normal : SV_Target1; float4 emis : SV_Target2; float4 geo : SV_Target3; };

// march the height field along the view ray in tangent space; returns the shifted uv
float2 parallax(Mat m, float2 uv, float3 vt, float dist) {
    if (m.heightScale <= 0.0f || m.texA < 0 || dist > 18.0f || !on(F_POM)) return uv;
    const float fade = saturate((18.0f - dist) / 6.0f), hs = m.heightScale * fade;   // metres of relief
    const uint steps = (uint)lerp(32.0f, 10.0f, saturate(vt.z));
    const float2 delta = -vt.xy / max(vt.z, 0.15f) * hs / float(steps);
    float layer = 1.0f, prevH = 0.0f; float2 p = uv, prevP = uv;
    float h = Tex[NonUniformResourceIndex(m.texA)].SampleLevel(sWrap, matUV(m, p), 1).a;
    for (uint i = 0u; i < steps && h < layer; i++) {
        prevP = p; prevH = h - layer; layer -= 1.0f / float(steps); p += delta;
        h = Tex[NonUniformResourceIndex(m.texA)].SampleLevel(sWrap, matUV(m, p), 1).a;
    }
    const float after = h - layer, w = after / max(after - prevH, 1e-5f);
    return lerp(p, prevP, saturate(w));
}

POut ps(VOut i, uint prim : SV_PrimitiveID, bool front : SV_IsFrontFace) {
    const uint mi = TriMat[prim];
    const Mat m = Mats[mi];
    const float3 toEye = F.eye.xyz - i.wp, vdir = normalize(toEye);
    float3 ng = normalize(cross(ddx(i.wp), ddy(i.wp)));
    if (dot(ng, vdir) < 0.0f) ng = -ng;
    Vtx v; v.p = i.wp; v.n = normalize(i.n); v.t = i.t; v.uv = i.uv; v.c = i.c;
    if (m.kind == K_OPAQUE || m.kind == K_ICE) {
        const float3 n = dot(v.n, ng) < 0 ? -v.n : v.n, T = normalize(v.t.xyz - n * dot(v.t.xyz, n) + 1e-6f), B = cross(n, T) * (v.t.w < 0 ? -1.0f : 1.0f);
        v.uv = parallax(m, v.uv, float3(dot(vdir, T), dot(vdir, B), dot(vdir, n)), length(toEye));
    }
    const Surf s = surface(mi, v, ng, -vdir, -1.0f, ddx(i.uv), ddy(i.uv));
    POut o;
    o.albedo = float4(s.albedo, s.rough);
    o.normal = float4(s.n, s.metal);
    o.emis = float4(s.emis, float(s.kind) + s.ao * 0.5f);
    const float2 pc = i.cur.xy / i.cur.w, pp = i.prev.xy / i.prev.w;
    const float2 motion = (pc - pp) * float2(0.5f, -0.5f) * F.size.xy;
    o.geo = float4(dot(i.wp - F.eye.xyz, F.fwd.xyz), motion, s.f0);
    return o;
}
