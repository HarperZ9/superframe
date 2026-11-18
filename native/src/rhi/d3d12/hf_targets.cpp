// The hero frame's targets, each at its fixed UAV slot of hf_common.hlsli, with RTVs for the
// G-buffer and the HDR target and a reverse-Z depth buffer.
#include "hf_device.hpp"
namespace raw::rhi::d3d12::hf {
namespace {
constexpr DXGI_FORMAT F16 = DXGI_FORMAT_R16G16B16A16_FLOAT, F32 = DXGI_FORMAT_R32G32B32A32_FLOAT;
uint32_t bpp(DXGI_FORMAT f){ return f == F32 ? 16 : f == F16 ? 8 : f == DXGI_FORMAT_R16_FLOAT ? 2 : 4; }

bool texture(Ctx& c, Target& t, DXGI_FORMAT f, uint32_t w, uint32_t h, uint32_t d, bool rt, std::string& err){
    D3D12_HEAP_PROPERTIES hp{}; hp.Type = D3D12_HEAP_TYPE_DEFAULT;
    D3D12_RESOURCE_DESC rd{}; rd.Dimension = d > 1 ? D3D12_RESOURCE_DIMENSION_TEXTURE3D : D3D12_RESOURCE_DIMENSION_TEXTURE2D;
    rd.Width = w; rd.Height = h; rd.DepthOrArraySize = UINT16(d); rd.MipLevels = 1; rd.Format = f; rd.SampleDesc.Count = 1;
    rd.Flags = D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS | (rt ? D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET : D3D12_RESOURCE_FLAG_NONE);
    const HRESULT hr = c.dev->CreateCommittedResource(&hp, D3D12_HEAP_FLAG_NONE, &rd, D3D12_RESOURCE_STATE_UNORDERED_ACCESS, nullptr, IID_PPV_ARGS(&t.res));
    if (FAILED(hr)){ err = hrError("hero frame target", hr); return false; }
    t.fmt = f; t.w = w; t.h = h; t.d = d; t.state = D3D12_RESOURCE_STATE_UNORDERED_ACCESS;
    c.targetBytes += uint64_t(w) * h * d * bpp(f);
    return true;
}
void uavView(Ctx& c, UINT slot, const Target& t){
    D3D12_UNORDERED_ACCESS_VIEW_DESC u{}; u.Format = t.fmt;
    if (t.d > 1){ u.ViewDimension = D3D12_UAV_DIMENSION_TEXTURE3D; u.Texture3D.WSize = t.d; }
    else u.ViewDimension = D3D12_UAV_DIMENSION_TEXTURE2D;
    c.dev->CreateUnorderedAccessView(t.res.Get(), nullptr, &u, c.cpu(slot));
}
void bufferView(Ctx& c, UINT slot, ID3D12Resource* r, UINT count, UINT stride){
    D3D12_UNORDERED_ACCESS_VIEW_DESC u{}; u.Format = DXGI_FORMAT_UNKNOWN; u.ViewDimension = D3D12_UAV_DIMENSION_BUFFER;
    u.Buffer.NumElements = count; u.Buffer.StructureByteStride = stride;
    c.dev->CreateUnorderedAccessView(r, nullptr, &u, c.cpu(slot));
}
}  // namespace

bool makeTargets(Ctx& c, uint32_t w, uint32_t h, std::string& err){
    c.w = w; c.h = h; c.uav.assign(kUavSlots, Target{});
    struct Spec { UINT slot; DXGI_FORMAT f; uint32_t w, h, d; bool rt; };
    std::vector<Spec> specs = {{0, F16, w, h, 1, true}, {1, F16, w, h, 1, true}, {2, F16, w, h, 1, true}, {3, F32, w, h, 1, true},
        {4, DXGI_FORMAT_R16_FLOAT, w, h, 1, false}, {5, F16, w, h, 1, false}, {6, F16, w, h, 1, false}, {7, F16, w, h, 1, false},
        {8, F16, w, h, 1, false}, {9, F16, w, h, 1, false}, {10, F16, w, h, 1, false}, {11, F16, w, h, 1, false}, {12, F16, w, h, 1, false},
        {13, F16, w, h, 1, true}, {14, F16, w, h, 1, false}, {15, F16, w, h, 1, false}, {16, F16, 240, 136, 128, false}, {17, F16, 240, 136, 128, false},
        {18, DXGI_FORMAT_R8G8B8A8_UNORM, w, h, 1, false}, {29, F32, w, h, 1, false}, {30, F32, w, h, 1, false}, {31, F16, w, h, 1, false},
        {32, F16, 240, 136, 128, false}, {35, F16, w, h, 1, false}, {36, F16, w, h, 1, false}};
    for (UINT k = 0; k < 7; ++k) specs.push_back({22 + k, F16, std::max(1u, w >> (k + 1)), std::max(1u, h >> (k + 1)), 1, false});
    for (const Spec& s : specs){
        if (!texture(c, c.uav[s.slot], s.f, s.w, s.h, s.d, s.rt, err)) return false;
        uavView(c, s.slot, c.uav[s.slot]);
    }
    const uint64_t npx = uint64_t(w) * h;
    const UINT clusterWords = 32 * 18 * 48 * 64;
    struct Buf { UINT slot; uint64_t count, stride; };
    for (const Buf& b : {Buf{19, clusterWords, 4}, Buf{20, npx, 16}, Buf{21, npx, 16}, Buf{33, npx * 8, 4}, Buf{34, npx, 4}}){
        if (!defaultBuffer(c, b.count * b.stride, c.uav[b.slot].res, err)) return false;
        c.uav[b.slot].state = D3D12_RESOURCE_STATE_COMMON;
        bufferView(c, b.slot, c.uav[b.slot].res.Get(), UINT(b.count), UINT(b.stride));
        c.targetBytes += b.count * b.stride;
    }
    // RTVs: the G-buffer's four, then the HDR target
    UINT r = 0;
    for (UINT slot : {0u, 1u, 2u, 3u, 13u}){
        c.uav[slot].rtv = r;
        c.dev->CreateRenderTargetView(c.uav[slot].res.Get(), nullptr, c.rtv(r++));
    }
    // depth
    D3D12_HEAP_PROPERTIES hp{}; hp.Type = D3D12_HEAP_TYPE_DEFAULT;
    D3D12_RESOURCE_DESC rd{}; rd.Dimension = D3D12_RESOURCE_DIMENSION_TEXTURE2D; rd.Width = w; rd.Height = h; rd.DepthOrArraySize = 1; rd.MipLevels = 1;
    rd.Format = DXGI_FORMAT_D32_FLOAT; rd.SampleDesc.Count = 1; rd.Flags = D3D12_RESOURCE_FLAG_ALLOW_DEPTH_STENCIL;
    D3D12_CLEAR_VALUE cv{}; cv.Format = DXGI_FORMAT_D32_FLOAT; cv.DepthStencil.Depth = 0.0f;
    HRESULT hr = c.dev->CreateCommittedResource(&hp, D3D12_HEAP_FLAG_NONE, &rd, D3D12_RESOURCE_STATE_DEPTH_WRITE, &cv, IID_PPV_ARGS(&c.depth.res));
    if (FAILED(hr)){ err = hrError("hero frame depth", hr); return false; }
    c.depth.state = D3D12_RESOURCE_STATE_DEPTH_WRITE; c.targetBytes += npx * 4;
    c.dev->CreateDepthStencilView(c.depth.res.Get(), nullptr, c.dsvHeap->GetCPUDescriptorHandleForHeapStart());
    // the frame constants, and read-back buffers for the HDR and tone-mapped images
    D3D12_HEAP_PROPERTIES up{}; up.Type = D3D12_HEAP_TYPE_UPLOAD;
    D3D12_RESOURCE_DESC bd{}; bd.Dimension = D3D12_RESOURCE_DIMENSION_BUFFER; bd.Width = 4096; bd.Height = 1; bd.DepthOrArraySize = 1; bd.MipLevels = 1;
    bd.SampleDesc.Count = 1; bd.Layout = D3D12_TEXTURE_LAYOUT_ROW_MAJOR;
    if (FAILED(hr = c.dev->CreateCommittedResource(&up, D3D12_HEAP_FLAG_NONE, &bd, D3D12_RESOURCE_STATE_GENERIC_READ, nullptr, IID_PPV_ARGS(&c.cb)))){ err = hrError("frame constants", hr); return false; }
    return c.q.readbackBuffer(uint64_t(w) * 8 * h + 65536, c.readHdr, err) && c.q.readbackBuffer(uint64_t(w) * 4 * h + 65536, c.readLdr, err);
}

}  // namespace raw::rhi::d3d12::hf
