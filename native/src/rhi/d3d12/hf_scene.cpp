// The hero frame's scene on the GPU: vertex, index and table buffers, the material textures with
// their mips, and one bottom-level acceleration structure over every triangle (indexed, opaque,
// built for fast trace) under a one-instance top level.
#include "hf_device.hpp"
#include <chrono>
#include <cstring>
namespace raw::rhi::d3d12::hf {
namespace {
// copy bytes into a new DEFAULT-heap buffer through an upload buffer kept until `keep` is cleared
bool upload(Ctx& c, const void* data, uint64_t bytes, ComPtr<ID3D12Resource>& out, std::vector<ComPtr<ID3D12Resource>>& keep, std::string& err){
    ComPtr<ID3D12Resource> stage;
    if (!c.q.uploadBuffer(data, bytes, stage, err) || !defaultBuffer(c, bytes, out, err, false)) return false;
    D3D12_RESOURCE_BARRIER b{}; b.Type = D3D12_RESOURCE_BARRIER_TYPE_TRANSITION; b.Transition.pResource = out.Get();
    b.Transition.StateBefore = D3D12_RESOURCE_STATE_COMMON; b.Transition.StateAfter = D3D12_RESOURCE_STATE_COPY_DEST; b.Transition.Subresource = 0;
    c.cl->ResourceBarrier(1, &b);
    c.cl->CopyBufferRegion(out.Get(), 0, stage.Get(), 0, bytes);
    b.Transition.StateBefore = D3D12_RESOURCE_STATE_COPY_DEST; b.Transition.StateAfter = D3D12_RESOURCE_STATE_NON_PIXEL_SHADER_RESOURCE | D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE;
    c.cl->ResourceBarrier(1, &b);
    keep.push_back(stage);
    return true;
}
bool uploadTexture(Ctx& c, const hw::FrameTexture& t, DXGI_FORMAT fmt, ComPtr<ID3D12Resource>& out, std::vector<ComPtr<ID3D12Resource>>& keep, std::string& err){
    D3D12_HEAP_PROPERTIES hp{}; hp.Type = D3D12_HEAP_TYPE_DEFAULT;
    D3D12_RESOURCE_DESC rd{}; rd.Dimension = D3D12_RESOURCE_DIMENSION_TEXTURE2D; rd.Width = t.width; rd.Height = t.height; rd.DepthOrArraySize = 1;
    rd.MipLevels = UINT16(t.mips); rd.Format = fmt; rd.SampleDesc.Count = 1;
    HRESULT hr = c.dev->CreateCommittedResource(&hp, D3D12_HEAP_FLAG_NONE, &rd, D3D12_RESOURCE_STATE_COPY_DEST, nullptr, IID_PPV_ARGS(&out));
    if (FAILED(hr)){ err = hrError("hero frame texture", hr); return false; }
    std::vector<D3D12_PLACED_SUBRESOURCE_FOOTPRINT> fp(t.mips);
    std::vector<UINT> rows(t.mips); std::vector<UINT64> rowBytes(t.mips); UINT64 total = 0;
    c.dev->GetCopyableFootprints(&rd, 0, t.mips, 0, fp.data(), rows.data(), rowBytes.data(), &total);
    std::vector<uint8_t> staged(total, 0);
    const uint32_t texel = fmt == DXGI_FORMAT_R16G16B16A16_FLOAT ? 8 : 4;
    size_t src = 0;
    for (uint32_t m = 0; m < t.mips; ++m){
        const uint32_t w = std::max(1u, t.width >> m), h = std::max(1u, t.height >> m);
        // BC7 rows are rows of 4 x 4 blocks, 16 bytes a block
        const uint32_t rowsN = t.bc7 ? (h + 3) / 4 : h; const size_t rowB = t.bc7 ? size_t((w + 3) / 4) * 16 : size_t(w) * texel;
        for (uint32_t y = 0; y < rowsN; ++y) std::memcpy(&staged[fp[m].Offset + uint64_t(y) * fp[m].Footprint.RowPitch], &t.rgba[src + size_t(y) * rowB], rowB);
        src += rowB * rowsN;
    }
    ComPtr<ID3D12Resource> stage;
    if (!c.q.uploadBuffer(staged.data(), total, stage, err)) return false;
    for (uint32_t m = 0; m < t.mips; ++m){
        D3D12_TEXTURE_COPY_LOCATION d{}; d.pResource = out.Get(); d.Type = D3D12_TEXTURE_COPY_TYPE_SUBRESOURCE_INDEX; d.SubresourceIndex = m;
        D3D12_TEXTURE_COPY_LOCATION s{}; s.pResource = stage.Get(); s.Type = D3D12_TEXTURE_COPY_TYPE_PLACED_FOOTPRINT; s.PlacedFootprint = fp[m];
        c.cl->CopyTextureRegion(&d, 0, 0, 0, &s, nullptr);
    }
    D3D12_RESOURCE_BARRIER b{}; b.Type = D3D12_RESOURCE_BARRIER_TYPE_TRANSITION; b.Transition.pResource = out.Get();
    b.Transition.StateBefore = D3D12_RESOURCE_STATE_COPY_DEST; b.Transition.StateAfter = D3D12_RESOURCE_STATE_NON_PIXEL_SHADER_RESOURCE | D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE;
    b.Transition.Subresource = D3D12_RESOURCE_BARRIER_ALL_SUBRESOURCES;
    c.cl->ResourceBarrier(1, &b);
    keep.push_back(stage);
    c.texBytes += total;
    return true;
}
bool accelBuffer(Ctx& c, uint64_t bytes, ComPtr<ID3D12Resource>& out, std::string& err){ return c.q.accelBuffer(bytes, out, err); }
}  // namespace

bool uploadScene(Ctx& c, const hw::FrameScene& s, std::string& err){
    std::vector<ComPtr<ID3D12Resource>> keep;
    if (!c.q.begin(err)) return false;
    if (FAILED(c.q.list()->QueryInterface(IID_PPV_ARGS(&c.cl)))){ err = "the command list has no DXR interface"; return false; }
    c.triangles = uint32_t(s.indices.size() / 3); c.lightCount = uint32_t(s.lights.size());
    std::vector<hw::FrameLight> lights = s.lights;
    if (lights.empty()) lights.push_back({});
    if (!upload(c, s.vertices.data(), s.vertices.size() * sizeof(hw::FrameVertex), c.verts, keep, err) ||
        !upload(c, s.indices.data(), s.indices.size() * 4, c.idx, keep, err) || !upload(c, s.triMaterial.data(), s.triMaterial.size() * 4, c.triMat, keep, err) ||
        !upload(c, s.materials.data(), s.materials.size() * sizeof(hw::FrameMaterial), c.mats, keep, err) ||
        !upload(c, lights.data(), lights.size() * sizeof(hw::FrameLight), c.lights, keep, err)) return false;
    std::vector<std::array<float, 4>> smoke = s.smoke;
    c.smokeCount = uint32_t(smoke.size());
    if (smoke.empty()) smoke.push_back({0, -1e9f, 0, 0});
    if (!upload(c, smoke.data(), smoke.size() * 16, c.smoke, keep, err)) return false;
    // textures: the materials' (RGBA8; sRGB where marked), then the sky (RGBA16F) last
    c.textures.resize(s.textures.size() + 1);
    for (size_t i = 0; i < s.textures.size(); ++i)
        if (!uploadTexture(c, s.textures[i], s.textures[i].bc7 ? (s.textures[i].srgb ? DXGI_FORMAT_BC7_UNORM_SRGB : DXGI_FORMAT_BC7_UNORM) : s.textures[i].srgb ? DXGI_FORMAT_R8G8B8A8_UNORM_SRGB : DXGI_FORMAT_R8G8B8A8_UNORM, c.textures[i], keep, err)) return false;
    hw::FrameTexture sky; sky.width = s.skyW; sky.height = s.skyH; sky.mips = 1; sky.rgba.resize(size_t(s.skyW) * s.skyH * 8);
    for (size_t p = 0; p < size_t(s.skyW) * s.skyH; ++p){
        const auto half = [](float f){ uint32_t x; std::memcpy(&x, &f, 4); const uint32_t sg = (x >> 16) & 0x8000u; int e = int((x >> 23) & 0xFF) - 127 + 15; uint32_t m = (x >> 13) & 0x3FFu;
            if (e <= 0) return uint16_t(sg); if (e >= 31) return uint16_t(sg | 0x7BFFu); return uint16_t(sg | (uint32_t(e) << 10) | m); };
        const uint16_t v[4] = {half(s.sky[p * 3]), half(s.sky[p * 3 + 1]), half(s.sky[p * 3 + 2]), half(1.0f)};
        std::memcpy(&sky.rgba[p * 8], v, 8);
    }
    c.skyIndex = uint32_t(s.textures.size());
    if (!uploadTexture(c, sky, DXGI_FORMAT_R16G16B16A16_FLOAT, c.textures.back(), keep, err)) return false;
    c.texCount = uint32_t(c.textures.size());
    for (uint32_t i = 0; i < c.texCount; ++i) c.dev->CreateShaderResourceView(c.textures[i].Get(), nullptr, c.cpu(kTexBase + i));
    // the acceleration structures
    D3D12_RAYTRACING_GEOMETRY_DESC g{}; g.Type = D3D12_RAYTRACING_GEOMETRY_TYPE_TRIANGLES; g.Flags = D3D12_RAYTRACING_GEOMETRY_FLAG_OPAQUE;
    g.Triangles.VertexBuffer = {c.verts->GetGPUVirtualAddress(), sizeof(hw::FrameVertex)}; g.Triangles.VertexFormat = DXGI_FORMAT_R32G32B32_FLOAT;
    g.Triangles.VertexCount = UINT(s.vertices.size()); g.Triangles.IndexBuffer = c.idx->GetGPUVirtualAddress(); g.Triangles.IndexFormat = DXGI_FORMAT_R32_UINT;
    g.Triangles.IndexCount = UINT(s.indices.size());
    D3D12_BUILD_RAYTRACING_ACCELERATION_STRUCTURE_INPUTS bi{}; bi.Type = D3D12_RAYTRACING_ACCELERATION_STRUCTURE_TYPE_BOTTOM_LEVEL;
    bi.Flags = D3D12_RAYTRACING_ACCELERATION_STRUCTURE_BUILD_FLAG_PREFER_FAST_TRACE; bi.NumDescs = 1; bi.DescsLayout = D3D12_ELEMENTS_LAYOUT_ARRAY; bi.pGeometryDescs = &g;
    D3D12_RAYTRACING_ACCELERATION_STRUCTURE_PREBUILD_INFO pb{}; c.dev->GetRaytracingAccelerationStructurePrebuildInfo(&bi, &pb);
    D3D12_RAYTRACING_INSTANCE_DESC inst{}; inst.Transform[0][0] = inst.Transform[1][1] = inst.Transform[2][2] = 1.0f; inst.InstanceMask = 0xFF;
    D3D12_BUILD_RAYTRACING_ACCELERATION_STRUCTURE_INPUTS ti{}; ti.Type = D3D12_RAYTRACING_ACCELERATION_STRUCTURE_TYPE_TOP_LEVEL; ti.NumDescs = 1;
    ti.DescsLayout = D3D12_ELEMENTS_LAYOUT_ARRAY; ti.Flags = D3D12_RAYTRACING_ACCELERATION_STRUCTURE_BUILD_FLAG_PREFER_FAST_TRACE;
    D3D12_RAYTRACING_ACCELERATION_STRUCTURE_PREBUILD_INFO tp{}; c.dev->GetRaytracingAccelerationStructurePrebuildInfo(&ti, &tp);
    if (!accelBuffer(c, pb.ResultDataMaxSizeInBytes, c.blas, err) || !accelBuffer(c, tp.ResultDataMaxSizeInBytes, c.tlas, err) ||
        !defaultBuffer(c, std::max(pb.ScratchDataSizeInBytes, tp.ScratchDataSizeInBytes), c.scratch, err) || !c.q.uploadBuffer(&inst, sizeof inst, c.inst, err)) return false;
    c.blasBytes = pb.ResultDataMaxSizeInBytes; c.tlasBytes = tp.ResultDataMaxSizeInBytes;
    D3D12_RESOURCE_BARRIER sb{}; sb.Type = D3D12_RESOURCE_BARRIER_TYPE_TRANSITION; sb.Transition.pResource = c.scratch.Get();
    sb.Transition.StateBefore = D3D12_RESOURCE_STATE_COMMON; sb.Transition.StateAfter = D3D12_RESOURCE_STATE_UNORDERED_ACCESS; sb.Transition.Subresource = 0;
    c.cl->ResourceBarrier(1, &sb);
    c.q.timestamp(0);
    D3D12_BUILD_RAYTRACING_ACCELERATION_STRUCTURE_DESC bd{}; bd.Inputs = bi; bd.DestAccelerationStructureData = c.blas->GetGPUVirtualAddress(); bd.ScratchAccelerationStructureData = c.scratch->GetGPUVirtualAddress();
    c.cl->BuildRaytracingAccelerationStructure(&bd, 0, nullptr);
    D3D12_RESOURCE_BARRIER ub{}; ub.Type = D3D12_RESOURCE_BARRIER_TYPE_UAV; ub.UAV.pResource = nullptr;   // the scratch is shared by both builds
    c.cl->ResourceBarrier(1, &ub);
    inst.AccelerationStructure = c.blas->GetGPUVirtualAddress();
    void* p = nullptr; c.inst->Map(0, nullptr, &p); std::memcpy(p, &inst, sizeof inst); c.inst->Unmap(0, nullptr);
    ti.InstanceDescs = c.inst->GetGPUVirtualAddress();
    D3D12_BUILD_RAYTRACING_ACCELERATION_STRUCTURE_DESC td{}; td.Inputs = ti; td.DestAccelerationStructureData = c.tlas->GetGPUVirtualAddress(); td.ScratchAccelerationStructureData = c.scratch->GetGPUVirtualAddress();
    c.cl->BuildRaytracingAccelerationStructure(&td, 0, nullptr);
    ub.UAV.pResource = c.tlas.Get(); c.cl->ResourceBarrier(1, &ub);
    c.q.timestamp(1);
    if (!c.q.submitAndWait(2, err)) return false;
    c.buildMs = 1000.0 * double(c.q.ticks(0, 1)) / c.q.ticksPerSecond();
    return true;
}

}  // namespace raw::rhi::d3d12::hf
