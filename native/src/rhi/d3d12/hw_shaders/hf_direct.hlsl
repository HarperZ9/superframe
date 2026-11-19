// Direct light. MODE 0: ReSTIR DI's candidates (RIS over the pixel's cluster) and temporal reuse
// from last frame's reservoir at the reprojected pixel. MODE 1: spatial reuse from neighbours,
// one shadow ray for the chosen sample, the moon, snow's glints; writes dDiff and dSpec.
// Without F_RESTIR, MODE 1 alone shades with plain RIS (hf_light.hlsli lampsRIS).
#include "hf_gbuf.hlsli"

[numthreads(8, 8, 1)]
void main(uint3 id : SV_DispatchThreadID) {
    const uint w = (uint)F.size.x, h = (uint)F.size.y;
    if (id.x >= w || id.y >= h) return;
    const uint i = id.y * w + id.x;
    Surf s; float3 v;
    const bool hasSurf = loadSurf(id.xy, s, v);
    Rng r = rngAt(id.xy, F.counts.x, 11u + MODE);
#if MODE == 0
    Resv R = emptyResv();
    if (hasSurf && s.kind != K_LAMP) {
        const uint c = clusterOf(s.p), n = clusterCount(c);
        const uint pool = n > 0u ? n : (uint)F.cluster.w;
        for (uint k = 0u; k < 16u && pool > 0u; k++) {
            const uint j = min(pool - 1u, uint(rnd(r) * float(pool))), li = n > 0u ? clusterLight(c, j) : j;
            const float2 u = rnd2(r);
            update(R, li, u, pHat(s, v, li, u) * float(pool), 1.0f, r);
        }
        // visibility reuse: a candidate the light cannot see is dropped before it is shared
        if (R.light != 0xFFFFFFFFu && on(F_SHADOW)) {
            const Light L = Lights[R.light];
            const float3 q = lightPoint(L, s.p, R.u), d = q - s.p;
            if (occluded(offsetRay(s.p, s.ng), normalize(d), length(d) - L.radius * 1.2f)) { R.wsum = 0.0f; }
        }
        // temporal: last frame's reservoir where this surface was, if it is the same surface
        const float2 pp = float2(id.xy) + 0.5f - gGeo[id.xy].yz;
        if (!on(F_RESET) && all(pp >= 0.0f) && all(pp < F.size.xy)) {
            const uint2 q = uint2(pp);
            const float4 gp = geoPrev[q];
            if (abs(gp.x - gGeo[id.xy].x) < 0.05f * gGeo[id.xy].x && dot(nrmPrev[q].xyz, s.n) > 0.9f) {
                // last frame's reservoir carries its contribution weight W (not its weight sum), so its
                // weight here is this surface's target times W times its count (Bitterli et al. 2020, eq. 6)
                Resv P = unpackResv(resvPrev[q.y * w + q.x]);
                P.M = min(P.M, 64.0f);
                const float ph = pHat(s, v, P.light, P.u);
                update(R, P.light, P.u, ph * P.wsum * P.M, P.M, r);
            }
        }
    }
    resv[i] = packResv(R);
#else
    if (!hasSurf) { dDiff[id.xy] = 0.0f; dSpec[id.xy] = 0.0f; return; }
    float3 diff = 0.0f, spec = 0.0f, gl = 0.0f;
    if (s.kind == K_LAMP) { dDiff[id.xy] = 0.0f; dSpec[id.xy] = 0.0f; return; }
    float3 md, ms;
    moonLight(s, v, r, md, ms, gl, footprintAt(length(F.eye.xyz - s.p)));
    diff += md; if (!glossy(s)) spec += ms;
    if (on(F_RESTIR)) {
        Resv R = unpackResv(resv[i]);
        // spatial: three neighbours within 18 pixels that look like the same surface
        for (uint k = 0u; k < 3u; k++) {
            const float a = rnd(r) * 2.0f * PI, d = 3.0f + rnd(r) * 15.0f;
            const int2 q = int2(id.xy) + int2(cos(a) * d, sin(a) * d);
            if (any(q < 0) || q.x >= int(w) || q.y >= int(h)) continue;
            const float4 gq = gGeo[q];
            if (abs(gq.x - gGeo[id.xy].x) > 0.06f * gGeo[id.xy].x || dot(gNormal[q].xyz, s.n) < 0.85f) continue;
            const Resv N = unpackResv(resv[q.y * w + q.x]);
            const float phq = pHat(s, v, N.light, N.u);
            Surf sq; float3 vq; loadSurf(uint2(q), sq, vq);
            const float phn = pHat(sq, vq, N.light, N.u), Wn = N.M > 0.0f && phn > 0.0f ? N.wsum / (N.M * phn) : 0.0f;
            update(R, N.light, N.u, phq * Wn * N.M, N.M, r);
        }
        if (R.light != 0xFFFFFFFFu && R.M > 0.0f) {
            const Light L = Lights[R.light];
            const float3 q = lightPoint(L, s.p, R.u);
            const LightSample ls = evalLight(s, v, L, q);
            const float ph = glossy(s) ? lum(ls.diff * max(s.albedo, 0.05f)) : ls.w;
            const float W = ph > 0.0f ? R.wsum / (R.M * ph) : 0.0f;
            const bool vis = !on(F_SHADOW) || !occluded(offsetRay(s.p, s.ng), ls.l, ls.dist - L.radius * 1.2f);
            if (vis) {
                diff += ls.diff * W; if (!glossy(s)) spec += ls.spec * W;
                gl += intensity(L, -ls.l) / max(ls.dist * ls.dist, 0.0025f) * glint(s, v, ls.l, footprintAt(length(F.eye.xyz - s.p))) * min(W, 4.0f);
            }
            // keep the shaded reservoir for next frame, its weight with this pixel's target
            // kept for next frame as its contribution weight W at this surface
            R.wsum = W; R.M = min(R.M, 64.0f);
        }
        if (R.light == 0xFFFFFFFFu || R.M <= 0.0f) R.wsum = 0.0f;
        resvPrev[i] = packResv(R);
    } else {
        float3 ld, lsp;
        lampsRIS(s, v, r, 8u, ld, lsp);
        diff += ld; if (!glossy(s)) spec += lsp;
    }
    dDiff[id.xy] = float4(diff, lum(gl));
    dSpec[id.xy] = float4(spec, 0.0f);
#endif
}
