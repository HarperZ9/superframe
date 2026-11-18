// The stand-in host of the host-frame check: see raw/rhi/host_rig.hpp. Everything here is
// the host's side and uses D3D12 directly; none of it goes through the RHI.
#include "raw/rhi/host_rig.hpp"
#include "d3d12_device.hpp"
#include "raw_hw_dxil.hpp"
#include <cstdlib>
#include <cstring>
namespace raw::rhi::host_rig {
using d3d12::ComPtr;
using d3d12::hrError;

struct Rig::Impl {
    ComPtr<IDXGIAdapter1> adapter;
    ComPtr<ID3D12Device> dev;
    ComPtr<ID3D12InfoQueue> info;
    ComPtr<ID3D12CommandQueue> frameQueue, producerQueue;
    ComPtr<ID3D12CommandAllocator> alloc;
    ComPtr<ID3D12GraphicsCommandList> list;
    ComPtr<ID3D12Fence> shared, own;   // shared: handed to the RHI; own: the rig's CPU waits
    HANDLE event{};
    uint64_t ownValue{0};
    std::vector<ComPtr<ID3D12Resource>> textures;
    std::string description;
    ~Impl(){ if (event) CloseHandle(event); }

    bool pickAdapter(std::string& err){
        ComPtr<IDXGIFactory6> f;
        HRESULT hr = CreateDXGIFactory2(0, IID_PPV_ARGS(&f));
        if (FAILED(hr)){ err = hrError("CreateDXGIFactory2", hr); return false; }
        const char* warp = std::getenv("RAW_NATIVE_D3D12_WARP");
        if (warp && std::strcmp(warp, "1") == 0){
            if (FAILED(hr = f->EnumWarpAdapter(IID_PPV_ARGS(&adapter)))){ err = hrError("EnumWarpAdapter", hr); return false; }
            return true;
        }
        ComPtr<IDXGIAdapter1> a;
        for (UINT i = 0; f->EnumAdapterByGpuPreference(i, DXGI_GPU_PREFERENCE_HIGH_PERFORMANCE, IID_PPV_ARGS(&a)) != DXGI_ERROR_NOT_FOUND; ++i){
            DXGI_ADAPTER_DESC1 d{};
            a->GetDesc1(&d);
            if (!(d.Flags & DXGI_ADAPTER_FLAG_SOFTWARE) && d.VendorId != 0x1414){ adapter = a; return true; }
        }
        err = "no hardware D3D12 adapter (set RAW_NATIVE_D3D12_WARP=1 for the software one)";
        return false;
    }
    // The first error the debug layer stored, with the count; empty when there is none.
    std::string debugErrors(){
        std::string first; UINT64 errors = 0;
        for (UINT64 i = 0, n = info->GetNumStoredMessages(); i < n; ++i){
            SIZE_T len = 0;
            if (FAILED(info->GetMessage(i, nullptr, &len))) continue;
            std::vector<char> buf(len);
            auto* msg = (D3D12_MESSAGE*)buf.data();
            if (FAILED(info->GetMessage(i, msg, &len))) continue;
            if (msg->Severity != D3D12_MESSAGE_SEVERITY_ERROR && msg->Severity != D3D12_MESSAGE_SEVERITY_CORRUPTION) continue;
            if (errors++ == 0) first.assign(msg->pDescription, msg->DescriptionByteLength ? msg->DescriptionByteLength - 1 : 0);
        }
        info->ClearStoredMessages();
        return errors ? "the host's own commands raised " + std::to_string(errors) + " debug-layer error(s); first: " + first : std::string();
    }
    bool begin(std::string& err){
        HRESULT hr = alloc->Reset();
        if (SUCCEEDED(hr)) hr = list->Reset(alloc.Get(), nullptr);
        if (FAILED(hr)){ err = hrError("host list Reset", hr); return false; }
        return true;
    }
    // Run the list on `q` and wait for it on the rig's own fence.
    bool run(ID3D12CommandQueue* q, std::string& err){
        HRESULT hr = list->Close();
        if (FAILED(hr)){ err = hrError("host list Close", hr); return false; }
        ID3D12CommandList* lists[] = {list.Get()};
        q->ExecuteCommandLists(1, lists);
        const uint64_t v = ++ownValue;
        if (FAILED(hr = q->Signal(own.Get(), v))){ err = hrError("host Signal", hr); return false; }
        if (own->GetCompletedValue() < v){
            if (FAILED(hr = own->SetEventOnCompletion(v, event))){ err = hrError("host SetEventOnCompletion", hr); return false; }
            if (WaitForSingleObject(event, 60000) != WAIT_OBJECT_0){ err = "the host's own commands did not finish in 60 s"; return false; }
        }
        if (FAILED(hr = dev->GetDeviceRemovedReason())){ err = hrError("the host's device was removed", hr); return false; }
        err = debugErrors();
        return err.empty();
    }
    void move(ID3D12Resource* r, D3D12_RESOURCE_STATES from, D3D12_RESOURCE_STATES to){
        if (from == to) return;
        D3D12_RESOURCE_BARRIER b{};
        b.Type = D3D12_RESOURCE_BARRIER_TYPE_TRANSITION;
        b.Transition.pResource = r; b.Transition.Subresource = D3D12_RESOURCE_BARRIER_ALL_SUBRESOURCES;
        b.Transition.StateBefore = from; b.Transition.StateAfter = to;
        list->ResourceBarrier(1, &b);
    }
    bool buffer(UINT64 size, D3D12_HEAP_TYPE heap, ComPtr<ID3D12Resource>& out, std::string& err){
        D3D12_HEAP_PROPERTIES hp{}; hp.Type = heap;
        D3D12_RESOURCE_DESC rd{};
        rd.Dimension = D3D12_RESOURCE_DIMENSION_BUFFER; rd.Width = size; rd.Height = 1; rd.DepthOrArraySize = 1; rd.MipLevels = 1;
        rd.SampleDesc.Count = 1; rd.Layout = D3D12_TEXTURE_LAYOUT_ROW_MAJOR;
        const HRESULT hr = dev->CreateCommittedResource(&hp, D3D12_HEAP_FLAG_NONE, &rd,
            heap == D3D12_HEAP_TYPE_UPLOAD ? D3D12_RESOURCE_STATE_GENERIC_READ : D3D12_RESOURCE_STATE_COPY_DEST, nullptr, IID_PPV_ARGS(&out));
        if (FAILED(hr)){ err = hrError("host CreateCommittedResource (buffer)", hr); return false; }
        return true;
    }
    // Copy `texels` into `r`, which is in `from`, on queue `q`, and leave it in `to`.
    bool write(ID3D12Resource* r, D3D12_RESOURCE_STATES from, D3D12_RESOURCE_STATES to, const void* texels, ID3D12CommandQueue* q, std::string& err){
        const D3D12_RESOURCE_DESC rd = r->GetDesc();
        D3D12_PLACED_SUBRESOURCE_FOOTPRINT fp{}; UINT rows = 0; UINT64 rowBytes = 0, total = 0;
        dev->GetCopyableFootprints(&rd, 0, 1, 0, &fp, &rows, &rowBytes, &total);
        ComPtr<ID3D12Resource> up;
        unsigned char* p = nullptr; D3D12_RANGE none{0, 0};
        if (!buffer(total, D3D12_HEAP_TYPE_UPLOAD, up, err)) return false;
        HRESULT hr = up->Map(0, &none, (void**)&p);
        if (FAILED(hr)){ err = hrError("host upload Map", hr); return false; }
        for (UINT y = 0; y < rows; ++y){
            unsigned char* row = p + fp.Offset + size_t(y) * fp.Footprint.RowPitch;
            if (texels) std::memcpy(row, (const unsigned char*)texels + size_t(y) * rowBytes, (size_t)rowBytes);
            else std::memset(row, 0, (size_t)rowBytes);
        }
        up->Unmap(0, nullptr);
        if (!begin(err)) return false;
        move(r, from, D3D12_RESOURCE_STATE_COPY_DEST);
        D3D12_TEXTURE_COPY_LOCATION d{}, s{};
        d.pResource = r; d.Type = D3D12_TEXTURE_COPY_TYPE_SUBRESOURCE_INDEX;
        s.pResource = up.Get(); s.Type = D3D12_TEXTURE_COPY_TYPE_PLACED_FOOTPRINT; s.PlacedFootprint = fp;
        list->CopyTextureRegion(&d, 0, 0, 0, &s, nullptr);
        move(r, D3D12_RESOURCE_STATE_COPY_DEST, to);
        return run(q, err);   // `up` lives until the wait in run() is over
    }
};

std::unique_ptr<Rig> Rig::create(std::string& err){
    ComPtr<ID3D12Debug> dbg;
    if (FAILED(D3D12GetDebugInterface(IID_PPV_ARGS(&dbg)))){
        err = "the D3D12 debug layer is not installed (Windows Graphics Tools); the host-frame check needs it for its state control";
        return nullptr;
    }
    dbg->EnableDebugLayer();
    std::unique_ptr<Rig> r(new Rig);
    r->m = std::make_unique<Impl>();
    Impl& m = *r->m;
    if (!m.pickAdapter(err)) return nullptr;
    HRESULT hr = D3D12CreateDevice(m.adapter.Get(), D3D_FEATURE_LEVEL_11_0, IID_PPV_ARGS(&m.dev));
    if (FAILED(hr)){ err = hrError("host D3D12CreateDevice", hr); return nullptr; }
    DXGI_ADAPTER_DESC1 ad{};
    m.adapter->GetDesc1(&ad);
    for (const wchar_t* w = ad.Description; *w; ++w) m.description += *w < 128 ? char(*w) : '?';
    D3D12_COMMAND_QUEUE_DESC qd{};
    qd.Type = D3D12_COMMAND_LIST_TYPE_DIRECT;
    if (FAILED(hr = m.dev.As(&m.info))) err = hrError("host ID3D12InfoQueue", hr);
    else if (FAILED(hr = m.dev->CreateCommandQueue(&qd, IID_PPV_ARGS(&m.frameQueue)))) err = hrError("host frame queue", hr);
    else if (FAILED(hr = m.dev->CreateCommandQueue(&qd, IID_PPV_ARGS(&m.producerQueue)))) err = hrError("host producer queue", hr);
    else if (FAILED(hr = m.dev->CreateCommandAllocator(D3D12_COMMAND_LIST_TYPE_DIRECT, IID_PPV_ARGS(&m.alloc)))) err = hrError("host allocator", hr);
    else if (FAILED(hr = m.dev->CreateCommandList(0, D3D12_COMMAND_LIST_TYPE_DIRECT, m.alloc.Get(), nullptr, IID_PPV_ARGS(&m.list)))) err = hrError("host list", hr);
    else if (FAILED(hr = m.list->Close())) err = hrError("host list Close", hr);
    else if (FAILED(hr = m.dev->CreateFence(0, D3D12_FENCE_FLAG_NONE, IID_PPV_ARGS(&m.shared)))) err = hrError("host fence", hr);
    else if (FAILED(hr = m.dev->CreateFence(0, D3D12_FENCE_FLAG_NONE, IID_PPV_ARGS(&m.own)))) err = hrError("host fence", hr);
    else if (!(m.event = CreateEventW(nullptr, FALSE, FALSE, nullptr))) err = "host CreateEvent failed";
    if (!err.empty()) return nullptr;
    return r;
}
Rig::~Rig() = default;
HostDevice Rig::host() const { HostDevice h; h.device = m->dev.Get(); h.queue = m->frameQueue.Get(); h.debugLayerErrorsFail = true; return h; }
void* Rig::fence() const { return m->shared.Get(); }
std::string Rig::adapter() const { return m->description; }
uint64_t Rig::completed() const { return m->shared->GetCompletedValue(); }
void Rig::cpuSignal(uint64_t value){ m->shared->Signal(value); }
unsigned long Rig::references(void* object) const {
    auto* u = static_cast<IUnknown*>(object);
    u->AddRef();
    return u->Release();
}
bool Rig::producerSignal(uint64_t value, std::string& err){
    const HRESULT hr = m->producerQueue->Signal(m->shared.Get(), value);
    if (FAILED(hr)){ err = hrError("host producer Signal", hr); return false; }
    return true;
}

void* Rig::texture(uint32_t w, uint32_t h, TextureFormat f, bool target, TextureState state, const void* texels, std::string& err){
    D3D12_HEAP_PROPERTIES hp{}; hp.Type = D3D12_HEAP_TYPE_DEFAULT;
    D3D12_RESOURCE_DESC rd{};
    rd.Dimension = D3D12_RESOURCE_DIMENSION_TEXTURE2D; rd.Width = w; rd.Height = h; rd.DepthOrArraySize = 1; rd.MipLevels = 1;
    rd.Format = d3d12::dxgiFormat(f); rd.SampleDesc.Count = 1;
    rd.Flags = target ? D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET : D3D12_RESOURCE_FLAG_NONE;
    ComPtr<ID3D12Resource> t;
    const HRESULT hr = m->dev->CreateCommittedResource(&hp, D3D12_HEAP_FLAG_NONE, &rd, D3D12_RESOURCE_STATE_COPY_DEST, nullptr, IID_PPV_ARGS(&t));
    if (FAILED(hr)){ err = hrError("host CreateCommittedResource (texture)", hr); return nullptr; }
    if (!m->write(t.Get(), D3D12_RESOURCE_STATE_COPY_DEST, d3d12::d3dState(state), texels, m->frameQueue.Get(), err)) return nullptr;
    m->textures.push_back(t);
    return t.Get();
}
bool Rig::fill(void* texture, TextureState state, const void* texels, std::string& err){
    const D3D12_RESOURCE_STATES s = d3d12::d3dState(state);
    return m->write(static_cast<ID3D12Resource*>(texture), s, s, texels, m->producerQueue.Get(), err);
}
bool Rig::readback(void* texture, TextureState state, std::vector<uint8_t>& out, std::string& err){
    auto* r = static_cast<ID3D12Resource*>(texture);
    const D3D12_RESOURCE_DESC rd = r->GetDesc();
    D3D12_PLACED_SUBRESOURCE_FOOTPRINT fp{}; UINT rows = 0; UINT64 rowBytes = 0, total = 0;
    m->dev->GetCopyableFootprints(&rd, 0, 1, 0, &fp, &rows, &rowBytes, &total);
    ComPtr<ID3D12Resource> rb;
    if (!m->buffer(total, D3D12_HEAP_TYPE_READBACK, rb, err) || !m->begin(err)) return false;
    const D3D12_RESOURCE_STATES s = d3d12::d3dState(state);
    m->move(r, s, D3D12_RESOURCE_STATE_COPY_SOURCE);
    D3D12_TEXTURE_COPY_LOCATION d{}, src{};
    src.pResource = r; src.Type = D3D12_TEXTURE_COPY_TYPE_SUBRESOURCE_INDEX;
    d.pResource = rb.Get(); d.Type = D3D12_TEXTURE_COPY_TYPE_PLACED_FOOTPRINT; d.PlacedFootprint = fp;
    m->list->CopyTextureRegion(&d, 0, 0, 0, &src, nullptr);
    m->move(r, D3D12_RESOURCE_STATE_COPY_SOURCE, s);
    if (!m->run(m->frameQueue.Get(), err)) return false;
    const unsigned char* p = nullptr; D3D12_RANGE all{0, (SIZE_T)total};
    const HRESULT hr = rb->Map(0, &all, (void**)&p);
    if (FAILED(hr)){ err = hrError("host readback Map", hr); return false; }
    out.resize(size_t(rows) * size_t(rowBytes));
    for (UINT y = 0; y < rows; ++y) std::memcpy(out.data() + size_t(y) * rowBytes, p + fp.Offset + size_t(y) * fp.Footprint.RowPitch, (size_t)rowBytes);
    D3D12_RANGE none{0, 0}; rb->Unmap(0, &none);
    return true;
}

ShaderCode shader(const char* name){
    for (const HwDxilBlob& b : kHwDxil) if (std::strcmp(b.name, name) == 0) return {ShaderFormat::Dxil, b.bytes, b.size};
    return {};
}
}  // namespace raw::rhi::host_rig
