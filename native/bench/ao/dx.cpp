// The AO comparison's D3D12 context: see dx.hpp.
#include "dx.hpp"
#include <windows.h>
#include <cstdio>
#include <cstring>
namespace raw::aobench {

bool Dx::fail(const char* what, long hr) {
    char b[160];
    std::snprintf(b, sizeof b, "%s failed (hr 0x%08lx)", what, (unsigned long)hr);
    err = b;
    std::fprintf(stderr, "ao_bench: %s\n", b);
    return false;
}

static ComPtr<IDXGIAdapter1> pickAdapter(IDXGIFactory6* f, const std::string& want, std::string& name) {
    ComPtr<IDXGIAdapter1> a;
    for (UINT i = 0; f->EnumAdapterByGpuPreference(i, DXGI_GPU_PREFERENCE_HIGH_PERFORMANCE, IID_PPV_ARGS(&a)) != DXGI_ERROR_NOT_FOUND; ++i) {
        DXGI_ADAPTER_DESC1 d{};
        a->GetDesc1(&d);
        char n[128]{};
        WideCharToMultiByte(CP_UTF8, 0, d.Description, -1, n, sizeof n - 1, nullptr, nullptr);
        if (d.Flags & DXGI_ADAPTER_FLAG_SOFTWARE) continue;
        if (want.empty() || std::strstr(n, want.c_str())) { name = n; return a; }
    }
    return nullptr;
}

bool Dx::init(const std::string& want) {
    ComPtr<IDXGIFactory6> f;
    HRESULT hr = CreateDXGIFactory2(0, IID_PPV_ARGS(&f));
    if (FAILED(hr)) return fail("CreateDXGIFactory2", hr);
    ComPtr<IDXGIAdapter1> a = pickAdapter(f.Get(), want, adapter);
    if (!a) { err = "no adapter matches '" + want + "'"; return false; }
    if (FAILED(hr = D3D12CreateDevice(a.Get(), D3D_FEATURE_LEVEL_12_0, IID_PPV_ARGS(&dev)))) return fail("D3D12CreateDevice", hr);
    D3D12_COMMAND_QUEUE_DESC qd{}; qd.Type = D3D12_COMMAND_LIST_TYPE_DIRECT;
    if (FAILED(hr = dev->CreateCommandQueue(&qd, IID_PPV_ARGS(&queue)))) return fail("CreateCommandQueue", hr);
    if (FAILED(hr = dev->CreateCommandAllocator(D3D12_COMMAND_LIST_TYPE_DIRECT, IID_PPV_ARGS(&alloc)))) return fail("CreateCommandAllocator", hr);
    if (FAILED(hr = dev->CreateCommandList(0, D3D12_COMMAND_LIST_TYPE_DIRECT, alloc.Get(), nullptr, IID_PPV_ARGS(&list)))) return fail("CreateCommandList", hr);
    if (FAILED(hr = dev->CreateFence(0, D3D12_FENCE_FLAG_NONE, IID_PPV_ARGS(&fence)))) return fail("CreateFence", hr);
    event = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    D3D12_DESCRIPTOR_HEAP_DESC hd{}; hd.Type = D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV; hd.NumDescriptors = kHeapSize; hd.Flags = D3D12_DESCRIPTOR_HEAP_FLAG_SHADER_VISIBLE;
    if (FAILED(hr = dev->CreateDescriptorHeap(&hd, IID_PPV_ARGS(&heap)))) return fail("CreateDescriptorHeap", hr);
    inc = dev->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV);
    D3D12_QUERY_HEAP_DESC qh{}; qh.Type = D3D12_QUERY_HEAP_TYPE_TIMESTAMP; qh.Count = kQueries;
    if (FAILED(hr = dev->CreateQueryHeap(&qh, IID_PPV_ARGS(&queries)))) return fail("CreateQueryHeap", hr);
    queryReadback = buffer(uint64_t(kQueries) * 8, D3D12_HEAP_TYPE_READBACK, D3D12_RESOURCE_FLAG_NONE, D3D12_RESOURCE_STATE_COPY_DEST);
    return queryReadback != nullptr;
}

ComPtr<ID3D12Resource> Dx::buffer(uint64_t bytes, D3D12_HEAP_TYPE type, D3D12_RESOURCE_FLAGS flags, D3D12_RESOURCE_STATES state) {
    D3D12_HEAP_PROPERTIES hp{}; hp.Type = type;
    D3D12_RESOURCE_DESC d{};
    d.Dimension = D3D12_RESOURCE_DIMENSION_BUFFER; d.Width = bytes; d.Height = 1; d.DepthOrArraySize = 1; d.MipLevels = 1;
    d.SampleDesc.Count = 1; d.Layout = D3D12_TEXTURE_LAYOUT_ROW_MAJOR; d.Flags = flags;
    ComPtr<ID3D12Resource> r;
    const HRESULT hr = dev->CreateCommittedResource(&hp, D3D12_HEAP_FLAG_NONE, &d, state, nullptr, IID_PPV_ARGS(&r));
    if (FAILED(hr)) { fail("CreateCommittedResource (buffer)", hr); return nullptr; }
    return r;
}

ComPtr<ID3D12Resource> Dx::texture(uint32_t w, uint32_t h, DXGI_FORMAT fmt, uint16_t mips, D3D12_RESOURCE_FLAGS flags, D3D12_RESOURCE_STATES state) {
    D3D12_HEAP_PROPERTIES hp{}; hp.Type = D3D12_HEAP_TYPE_DEFAULT;
    D3D12_RESOURCE_DESC d{};
    d.Dimension = D3D12_RESOURCE_DIMENSION_TEXTURE2D; d.Width = w; d.Height = h; d.DepthOrArraySize = 1; d.MipLevels = mips;
    d.Format = fmt; d.SampleDesc.Count = 1; d.Flags = flags;
    ComPtr<ID3D12Resource> r;
    const HRESULT hr = dev->CreateCommittedResource(&hp, D3D12_HEAP_FLAG_NONE, &d, state, nullptr, IID_PPV_ARGS(&r));
    if (FAILED(hr)) { fail("CreateCommittedResource (texture)", hr); return nullptr; }
    return r;
}

void Dx::uploadBuffer(ID3D12Resource* dst, const void* data, uint64_t bytes) {
    ComPtr<ID3D12Resource> up = buffer(bytes, D3D12_HEAP_TYPE_UPLOAD, D3D12_RESOURCE_FLAG_NONE, D3D12_RESOURCE_STATE_GENERIC_READ);
    void* p = nullptr;
    up->Map(0, nullptr, &p);
    std::memcpy(p, data, bytes);
    up->Unmap(0, nullptr);
    list->CopyBufferRegion(dst, 0, up.Get(), 0, bytes);
    keep.push_back(up);
}

void Dx::uploadTexture(ID3D12Resource* dst, const void* data, uint32_t w, uint32_t h, uint32_t texelBytes) {
    D3D12_PLACED_SUBRESOURCE_FOOTPRINT fp{};
    UINT64 total = 0;
    const D3D12_RESOURCE_DESC d = dst->GetDesc();
    dev->GetCopyableFootprints(&d, 0, 1, 0, &fp, nullptr, nullptr, &total);
    ComPtr<ID3D12Resource> up = buffer(total, D3D12_HEAP_TYPE_UPLOAD, D3D12_RESOURCE_FLAG_NONE, D3D12_RESOURCE_STATE_GENERIC_READ);
    uint8_t* p = nullptr;
    up->Map(0, nullptr, reinterpret_cast<void**>(&p));
    for (uint32_t y = 0; y < h; ++y) std::memcpy(p + fp.Offset + uint64_t(y) * fp.Footprint.RowPitch, static_cast<const uint8_t*>(data) + uint64_t(y) * w * texelBytes, uint64_t(w) * texelBytes);
    up->Unmap(0, nullptr);
    D3D12_TEXTURE_COPY_LOCATION to{dst, D3D12_TEXTURE_COPY_TYPE_SUBRESOURCE_INDEX, {}}, from{up.Get(), D3D12_TEXTURE_COPY_TYPE_PLACED_FOOTPRINT, {}};
    to.SubresourceIndex = 0; from.PlacedFootprint = fp;
    list->CopyTextureRegion(&to, 0, 0, 0, &from, nullptr);
    keep.push_back(up);
}

bool Dx::readBuffer(ID3D12Resource* src, uint64_t bytes, void* out) {
    ComPtr<ID3D12Resource> rb = buffer(bytes, D3D12_HEAP_TYPE_READBACK, D3D12_RESOURCE_FLAG_NONE, D3D12_RESOURCE_STATE_COPY_DEST);
    list->CopyBufferRegion(rb.Get(), 0, src, 0, bytes);
    if (!submit()) return false;
    void* p = nullptr;
    rb->Map(0, nullptr, &p);
    std::memcpy(out, p, bytes);
    rb->Unmap(0, nullptr);
    return true;
}

bool Dx::readTexture(ID3D12Resource* src, uint32_t w, uint32_t h, uint32_t texelBytes, void* out) {
    D3D12_PLACED_SUBRESOURCE_FOOTPRINT fp{};
    UINT64 total = 0;
    const D3D12_RESOURCE_DESC d = src->GetDesc();
    dev->GetCopyableFootprints(&d, 0, 1, 0, &fp, nullptr, nullptr, &total);
    ComPtr<ID3D12Resource> rb = buffer(total, D3D12_HEAP_TYPE_READBACK, D3D12_RESOURCE_FLAG_NONE, D3D12_RESOURCE_STATE_COPY_DEST);
    D3D12_TEXTURE_COPY_LOCATION to{rb.Get(), D3D12_TEXTURE_COPY_TYPE_PLACED_FOOTPRINT, {}}, from{src, D3D12_TEXTURE_COPY_TYPE_SUBRESOURCE_INDEX, {}};
    to.PlacedFootprint = fp; from.SubresourceIndex = 0;
    list->CopyTextureRegion(&to, 0, 0, 0, &from, nullptr);
    if (!submit()) return false;
    uint8_t* p = nullptr;
    rb->Map(0, nullptr, reinterpret_cast<void**>(&p));
    for (uint32_t y = 0; y < h; ++y) std::memcpy(static_cast<uint8_t*>(out) + uint64_t(y) * w * texelBytes, p + fp.Offset + uint64_t(y) * fp.Footprint.RowPitch, uint64_t(w) * texelBytes);
    rb->Unmap(0, nullptr);
    return true;
}

void Dx::transition(ID3D12Resource* r, D3D12_RESOURCE_STATES from, D3D12_RESOURCE_STATES to) {
    D3D12_RESOURCE_BARRIER b{};
    b.Type = D3D12_RESOURCE_BARRIER_TYPE_TRANSITION; b.Transition.pResource = r;
    b.Transition.Subresource = D3D12_RESOURCE_BARRIER_ALL_SUBRESOURCES; b.Transition.StateBefore = from; b.Transition.StateAfter = to;
    list->ResourceBarrier(1, &b);
}

void Dx::uavBarrier() {
    D3D12_RESOURCE_BARRIER b{};
    b.Type = D3D12_RESOURCE_BARRIER_TYPE_UAV;
    list->ResourceBarrier(1, &b);
}

bool Dx::submit() {
    HRESULT hr = list->Close();
    if (FAILED(hr)) return fail("Close", hr);
    ID3D12CommandList* l = list.Get();
    queue->ExecuteCommandLists(1, &l);
    queue->Signal(fence.Get(), ++fenceValue);
    if (fence->GetCompletedValue() < fenceValue) { fence->SetEventOnCompletion(fenceValue, event); WaitForSingleObject(event, INFINITE); }
    if (FAILED(hr = dev->GetDeviceRemovedReason())) return fail("device removed", hr);
    keep.clear();
    alloc->Reset();
    list->Reset(alloc.Get(), nullptr);
    return true;
}

uint32_t Dx::reserve(uint32_t count) { const uint32_t i = used; used += count; return i; }
D3D12_CPU_DESCRIPTOR_HANDLE Dx::cpu(uint32_t i) const { D3D12_CPU_DESCRIPTOR_HANDLE h = heap->GetCPUDescriptorHandleForHeapStart(); h.ptr += SIZE_T(i) * inc; return h; }
D3D12_GPU_DESCRIPTOR_HANDLE Dx::gpu(uint32_t i) const { D3D12_GPU_DESCRIPTOR_HANDLE h = heap->GetGPUDescriptorHandleForHeapStart(); h.ptr += UINT64(i) * inc; return h; }

void Dx::srvTex(uint32_t i, ID3D12Resource* r, DXGI_FORMAT fmt, uint32_t mips) {
    D3D12_SHADER_RESOURCE_VIEW_DESC d{};
    d.Format = fmt; d.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D; d.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING;
    d.Texture2D.MipLevels = mips;
    dev->CreateShaderResourceView(r, &d, cpu(i));
}
void Dx::uavTex(uint32_t i, ID3D12Resource* r, DXGI_FORMAT fmt, uint32_t mip) {
    D3D12_UNORDERED_ACCESS_VIEW_DESC d{};
    d.Format = fmt; d.ViewDimension = D3D12_UAV_DIMENSION_TEXTURE2D; d.Texture2D.MipSlice = mip;
    dev->CreateUnorderedAccessView(r, nullptr, &d, cpu(i));
}
void Dx::nullSrv(uint32_t i) { srvTex(i, nullptr, DXGI_FORMAT_R32_FLOAT, 1); }
void Dx::nullUav(uint32_t i) { uavTex(i, nullptr, DXGI_FORMAT_R32_FLOAT, 0); }

void Dx::stamp(uint32_t slot) { list->EndQuery(queries.Get(), D3D12_QUERY_TYPE_TIMESTAMP, slot); }

// Resolves slots 0..count-1 into the readback buffer in a list of their own, after the work.
bool Dx::stamps(uint32_t count, std::vector<double>& seconds) {
    list->ResolveQueryData(queries.Get(), D3D12_QUERY_TYPE_TIMESTAMP, 0, count, queryReadback.Get(), 0);
    if (!submit()) return false;
    UINT64 freq = 0;
    queue->GetTimestampFrequency(&freq);
    const UINT64* t = nullptr;
    const D3D12_RANGE r{0, SIZE_T(count) * 8};
    queryReadback->Map(0, &r, reinterpret_cast<void**>(const_cast<UINT64**>(&t)));
    seconds.assign(count, 0.0);
    for (uint32_t i = 0; i < count; ++i) seconds[i] = double(t[i]) / double(freq);
    const D3D12_RANGE none{0, 0};
    queryReadback->Unmap(0, &none);
    return true;
}

}  // namespace raw::aobench
