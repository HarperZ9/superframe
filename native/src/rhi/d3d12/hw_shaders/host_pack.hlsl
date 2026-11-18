// Host frame (evidence/host-frame-bounds.json): the host's depth, position and normal
// textures, each copied into a buffer with its rows `stride` floats apart, interleaved into
// the view G-buffer post_gtao reads (8 floats a pixel: position, view depth, normal, back
// depth). The values are moved, never recomputed. Bindings follow the RHI's compute
// convention: binding 0 is the uniform, binding i a root UAV at u<i>.
cbuffer C : register(b0) { uint width; uint height; uint depthStride; uint wideStride; };
RWStructuredBuffer<float> D : register(u1);
RWStructuredBuffer<float> P : register(u2);
RWStructuredBuffer<float> N : register(u3);
RWStructuredBuffer<float> G : register(u4);
[numthreads(64, 1, 1)]
void main(uint3 id : SV_DispatchThreadID) {
    const uint i = id.x;
    if (i >= width * height) { return; }
    const uint x = i % width;
    const uint y = i / width;
    const uint w = y * wideStride + x * 4u;
    const float depth = D[y * depthStride + x];
    G[i * 8u] = P[w];
    G[i * 8u + 1u] = P[w + 1u];
    G[i * 8u + 2u] = P[w + 2u];
    G[i * 8u + 3u] = depth;
    G[i * 8u + 4u] = N[w];
    G[i * 8u + 5u] = N[w + 1u];
    G[i * 8u + 6u] = N[w + 2u];
    G[i * 8u + 7u] = depth;
}
