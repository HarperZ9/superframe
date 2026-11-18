// The reference: a path tracer over the hero frame's scene, materials and lights (the real-time
// frame's ground truth for FLIP). Next-event estimation to the moon and to one lamp by RIS, both
// with shadow rays; BSDF sampling (cosine diffuse, GGX visible normals); glowing surfaces and the
// moon count only where a camera ray or a glossy bounce meets them, since the lamps and the moon
// are already sampled directly; the fog by delta tracking against the same density with multiple
// scattering (Henyey-Greenstein). PC.a: samples this dispatch, bounces, the first sample's index.
#include "hf_light.hlsli"

float hgPhase(float c, float g) { const float g2 = g * g; return (1.0f - g2) / (4.0f * PI * pow(max(1e-4f, 1.0f + g2 - 2.0f * g * c), 1.5f)); }
float3 hgSample(float3 w, float g, float2 u) {
    const float q = (1.0f - g * g) / (1.0f + g - 2.0f * g * u.x);
    const float c = abs(g) < 1e-3f ? 1.0f - 2.0f * u.x : clamp((1.0f + g * g - q * q) / (2.0f * g), -1.0f, 1.0f), sn = sqrt(max(0.0f, 1.0f - c * c));
    const float3x3 B = basis(w);
    return normalize(B[0] * (sn * cos(2.0f * PI * u.y)) + B[1] * (sn * sin(2.0f * PI * u.y)) + w * c);
}
float n3(float3 p) {
    const float3 i = floor(p), f = frac(p), u = f * f * (3.0f - 2.0f * f);
    float r = 0.0f;
    [unroll] for (uint k = 0u; k < 8u; k++) { const float3 o = float3(k & 1u, (k >> 1) & 1u, (k >> 2) & 1u); const float3 q = i + o; r += frac(sin(dot(q, float3(12.9898f, 78.233f, 37.719f))) * 43758.5453f) * lerp(1.0f - u.x, u.x, o.x) * lerp(1.0f - u.y, u.y, o.y) * lerp(1.0f - u.z, u.z, o.z); }
    return r;
}
float density(float3 p) {
    const float3 wind = float3(F.timeParams.z, 0.0f, F.timeParams.w) * F.timeParams.x;
    const float base = F.fog.x * exp(-max(0.0f, p.y - F.eye.y + 2.0f) * F.fog.y);
    return base * (0.55f + 0.9f * n3(p * 0.06f - wind * 0.05f) * n3(p * 0.21f + wind * 0.11f));
}
float3 sampleVndf(float3 v, float a, float2 u) {
    const float3 vh = normalize(float3(a * v.x, a * v.y, v.z));
    const float lensq = vh.x * vh.x + vh.y * vh.y;
    const float3 T1 = lensq > 0 ? float3(-vh.y, vh.x, 0) * rsqrt(lensq) : float3(1, 0, 0), T2 = cross(vh, T1);
    const float r = sqrt(u.x), phi = 2.0f * PI * u.y, t1 = r * cos(phi);
    float t2 = r * sin(phi);
    const float s = 0.5f * (1.0f + vh.z);
    t2 = (1.0f - s) * sqrt(1.0f - t1 * t1) + s * t2;
    const float3 nh = t1 * T1 + t2 * T2 + sqrt(max(0.0f, 1.0f - t1 * t1 - t2 * t2)) * vh;
    return normalize(float3(a * nh.x, a * nh.y, max(0.0f, nh.z)));
}
// light scattered at a point of fog toward -w: the moon and one lamp, each through a shadow ray
float3 fogNEE(float3 p, float3 w, inout Rng r) {
    float3 L = 0.0f;
    const float3 l = coneDir(F.moonDir.xyz, 0.99996f, rnd2(r));
    if (!on(F_SHADOW) || !occluded(p, l, 1500.0f)) L += F.moonRad.rgb * F.moonRad.w * hgPhase(dot(w, l), F.fog.z);
    const uint n = (uint)F.cluster.w;
    if (n > 0u) {
        const Light Lt = Lights[min(n - 1u, uint(rnd(r) * float(n)))];
        const float3 q = lightPoint(Lt, p, rnd2(r)), d = q - p; const float dist = length(d);
        if (!on(F_SHADOW) || !occluded(p, d / dist, dist - Lt.radius * 1.2f)) L += intensity(Lt, -d / dist) / max(dist * dist, 0.04f) * hgPhase(dot(w, d / dist), F.fog.z) * float(n);
    }
    return L;
}

float3 pathSample(float2 px, inout Rng r, uint bounces) {
    float3 o = F.eye.xyz, d = viewRay(px), thr = 1.0f, L = 0.0f;
    bool countEmit = true;
    const float sMax = F.fog.x * 1.5f;
    for (uint b = 0u; b <= bounces; b++) {
        const Hit h = trace(o, d, 2000.0f);
        // the fog between here and the hit, by delta tracking
        if (on(F_FOG) && sMax > 0.0f) {
            float t = 0.0f; bool scattered = false; const float tEnd = min(h.t, F.fog.w * 1.5f);
            for (uint k = 0u; k < 64u; k++) {
                t -= log(1.0f - rnd(r)) / sMax;
                if (t >= tEnd) break;
                if (rnd(r) < density(o + d * t) / sMax) { scattered = true; break; }
            }
            if (scattered) {
                const float3 p = o + d * t;
                L += thr * fogNEE(p, d, r);
                o = p; d = hgSample(d, F.fog.z, rnd2(r)); countEmit = false;
                continue;
            }
        }
        if (!h.hit) { L += thr * (sky(d) + (countEmit ? moonDisc(d) : 0.0f)); break; }
        const Surf s = surfaceAtHit(h, d, 0.0f);
        const float3 v = -d;
        if (s.kind == K_LAMP) { if (countEmit) L += thr * s.emis; break; }
        if (s.kind == K_GLASS) {
            const float fr = lum(F_schlick(specF0(s), dot(s.n, v)));
            if (countEmit) L += thr * s.emis * (1.0f - fr);
            thr *= fr; o = offsetRay(s.p, s.n); d = reflect(d, s.n); countEmit = true;
            continue;
        }
        if (countEmit) L += thr * s.emis;
        const bool gl = s.rough < 0.35f || s.kind == K_ICE;
        float3 md, ms, g, ld, ls;
        moonLight(s, v, r, md, ms, g, 0.01f);
        lampsRIS(s, v, r, 8u, ld, ls);
        L += thr * (s.albedo * (1.0f - s.metal) / PI * (md + ld) + (gl ? 0.0f : ms + ls) + (b == 0u ? g * 0.5f : 0.0f));
        if (b == bounces) break;
        // the next direction: the specular lobe with the weight of its albedo, else diffuse
        const float3 sa = specAlbedo(s, v);
        const float ps = clamp(lum(sa) / max(lum(sa) + lum(s.albedo * (1.0f - s.metal)), 1e-4f), 0.05f, 0.95f);
        const float3x3 B = basis(s.n);
        if (rnd(r) < ps) {
            const float3 vt = float3(dot(v, B[0]), dot(v, B[1]), dot(v, B[2])), m = sampleVndf(vt, max(s.rough * s.rough, 0.001f), rnd2(r));
            const float3 mt = B[0] * m.x + B[1] * m.y + B[2] * m.z;
            d = reflect(-v, mt);
            if (dot(d, s.n) <= 0.0f) break;
            thr *= sa / ps; countEmit = gl;
        } else {
            d = cosineDir(s.n, rnd2(r));
            thr *= s.albedo * (1.0f - s.metal) / (1.0f - ps); countEmit = false;
        }
        o = offsetRay(s.p, s.n);
        if (b >= 2u) { const float q = clamp(lum(thr), 0.05f, 0.95f); if (rnd(r) > q) break; thr /= q; }
    }
    return min(L, 400.0f);
}

[numthreads(8, 8, 1)]
void main(uint3 id : SV_DispatchThreadID) {
    if (id.x >= (uint)F.size.x || id.y >= (uint)F.size.y) return;
    float3 sum = 0.0f;
    for (uint k = 0u; k < PC.a.x; k++) {
        Rng r = rngAt(id.xy, PC.a.z + k, 5u);
        sum += pathSample(float2(id.xy) + rnd2(r), r, PC.a.y);
    }
    const float4 prev = PC.a.z == 0u ? 0.0f : ptAcc[id.xy];
    ptAcc[id.xy] = prev + float4(sum, float(PC.a.x));
}
