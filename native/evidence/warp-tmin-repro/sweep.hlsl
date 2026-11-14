// out[0..2]: the reported oblique ray at TMin 1e-4, 1e-3, 0. out[3]: axis-aligned control, origin 5e-5 above the
// triangle centroid along +z, TMin 1e-4 (expected: no hit).
RaytracingAccelerationStructure scene : register(t0);
RWStructuredBuffer<float> outT : register(u0);

float trace(float3 o, float3 d, float tmin) {
    RayDesc r; r.Origin = o; r.Direction = d; r.TMin = tmin; r.TMax = 1e30;
    RayQuery<RAY_FLAG_FORCE_OPAQUE> q; q.TraceRayInline(scene, 0, 0xFF, r); q.Proceed();
    return q.CommittedStatus() == COMMITTED_TRIANGLE_HIT ? q.CommittedRayT() : -1.0;
}

[numthreads(1, 1, 1)] void main() {
    float3 c = (float3(0.808620453, -0.571152925, 1.75837445) + float3(0.745668173, -0.542841613, 1.69002175)
              + float3(0.879887938, -0.433270901, 1.68160832)) / 3.0;
    const float h[8] = { 1e-2, 1e-2, 1e-2, 1e-2, 1e-2, 1e-2, 1e-2, 1e-2 };
    for (int i = 0; i < 8; ++i) outT[i] = trace(c + float3(0, 0, h[i]), float3(0, 0, -1), h[i] * (1.0 + 0.5 * (i + 1)));
}
