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
    float3 o = float3(0.844834328, -0.475793004, 1.69647741);
    float3 d = float3(0.409607708, -0.196549982, -0.890836477);
    outT[0] = trace(o, d, 1e-4);
    outT[1] = trace(o, d, 1e-3);
    outT[2] = trace(o, d, 0.0);
    float3 c = (float3(0.808620453, -0.571152925, 1.75837445) + float3(0.745668173, -0.542841613, 1.69002175)
              + float3(0.879887938, -0.433270901, 1.68160832)) / 3.0;
    outT[3] = trace(c + float3(0, 0, 5e-5), float3(0, 0, -1), 1e-4);
    outT[4] = trace(c + float3(0, 0, 0.5), float3(0, 0, -1), 1.0);    // hit at 0.5, TMin 1.0: expect none
    outT[5] = trace(c + float3(0, 0, 0.5), float3(0, 0, -1), 0.49);   // expect 0.5
    outT[6] = trace(o - d * 0.5, d, 1.0);                             // oblique hit near 0.5, TMin 1.0: expect none
    outT[7] = trace(c + float3(0, 0, 5e-3), float3(0, 0, -1), 1e-2);  // hit at 5e-3, TMin 1e-2: expect none
}
