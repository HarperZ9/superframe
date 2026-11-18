// Host frame (evidence/host-frame-bounds.json): one full-screen triangle that writes a
// buffer of one float a pixel, top row first, into the host's render target. Bindings follow
// the RHI's raster convention: the uniform at b0, the storage buffer a root UAV at u0.
cbuffer C : register(b0) { uint width; uint height; uint pad0; uint pad1; };
RWStructuredBuffer<float> A : register(u0);
float4 vs(uint i : SV_VertexID) : SV_Position {
    return float4(i == 1u ? 3.0f : -1.0f, i == 2u ? -3.0f : 1.0f, 0.0f, 1.0f);
}
float4 fs(float4 at : SV_Position) : SV_Target0 {
    const uint x = min((uint)at.x, width - 1u);
    const uint y = min((uint)at.y, height - 1u);
    return float4(A[y * width + x], 0.0f, 0.0f, 1.0f);
}
