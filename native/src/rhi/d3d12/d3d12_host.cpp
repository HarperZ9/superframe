// Host frames on D3D12 (raw/rhi/host.hpp): a device on a host's device and queue, a host's
// textures as texture records, and a submission in three steps (record, send, retire) so it
// can be ordered against the host's fence. Nothing here creates or destroys a host object.
#include "d3d12_device.hpp"
#include <cstdlib>
#include <cstring>
namespace raw::rhi::d3d12 {
namespace {
bool envOn(const char* name){ const char* v = std::getenv(name); return v && std::strcmp(v, "1") == 0; }
// COM identity: two interface pointers name one object when their IUnknowns are equal.
bool sameObject(IUnknown* a, IUnknown* b){
    ComPtr<IUnknown> ua, ub;
    return a && b && SUCCEEDED(a->QueryInterface(IID_PPV_ARGS(&ua))) && SUCCEEDED(b->QueryInterface(IID_PPV_ARGS(&ub))) && ua == ub;
}
// A view slot: one a forgotten host texture gave back, or the heap's next.
bool viewSlot(Heap& h, std::vector<UINT>& freed, UINT& slot, const char* what, std::string& err){
    if (!freed.empty()){ slot = freed.back(); freed.pop_back(); return true; }
    if (h.next >= h.capacity){ err = std::string("d3d12: out of ") + what + " slots"; return false; }
    slot = h.next++;
    return true;
}
}  // namespace
D3D12_RESOURCE_STATES d3dState(TextureState s){
    switch (s){
        case TextureState::ShaderResource: return D3D12_RESOURCE_STATE_PIXEL_SHADER_RESOURCE | D3D12_RESOURCE_STATE_NON_PIXEL_SHADER_RESOURCE;
        case TextureState::RenderTarget: return D3D12_RESOURCE_STATE_RENDER_TARGET;
        case TextureState::CopySrc: return D3D12_RESOURCE_STATE_COPY_SOURCE;
        case TextureState::CopyDst: return D3D12_RESOURCE_STATE_COPY_DEST;
        case TextureState::Common: break;
    }
    return D3D12_RESOURCE_STATE_COMMON;
}

bool D3d12Device::initAdopted(const HostDevice& host, std::string& err){
    auto* dev = static_cast<ID3D12Device*>(host.device);
    auto* queue = static_cast<ID3D12CommandQueue*>(host.queue);
    if (!dev || !queue){ err = "d3d12: a host device needs its ID3D12Device and its ID3D12CommandQueue"; return false; }
    if (queue->GetDesc().Type != D3D12_COMMAND_LIST_TYPE_DIRECT){ err = "d3d12: the host's queue is not a direct queue"; return false; }
    ComPtr<ID3D12Device> owner;
    if (FAILED(queue->GetDevice(IID_PPV_ARGS(&owner))) || !sameObject(owner.Get(), dev)){
        err = "d3d12: the host's queue belongs to another device"; return false; }
    D3D12_FEATURE_DATA_SHADER_MODEL sm{D3D_SHADER_MODEL_6_0};
    if (FAILED(dev->CheckFeatureSupport(D3D12_FEATURE_SHADER_MODEL, &sm, sizeof sm)) || sm.HighestShaderModel < D3D_SHADER_MODEL_6_0){
        err = "d3d12: the host's device has no shader model 6.0"; return false; }
    device_ = dev; queue_ = queue; adopted_ = true; retireMs_ = host.retireTimeoutMs;
    if (host.debugLayerErrorsFail || envOn("RAW_NATIVE_D3D12_DEBUG")){
        if (FAILED(device_.As(&infoQueue_))){ err = "d3d12: the host's device was made without the debug layer, so its errors cannot fail a submission"; return false; }
    }
    // The adapter is looked up only to describe it; a host device with no listed adapter
    // still works and reports empty strings.
    ComPtr<IDXGIFactory4> f;
    if (SUCCEEDED(CreateDXGIFactory2(0, IID_PPV_ARGS(&f)))) f->EnumAdapterByLuid(dev->GetAdapterLuid(), IID_PPV_ARGS(&adapter_));
    describeAdapter();
    return initSubmission(err);
}

TextureHandle D3d12Device::importTexture(const ExternalTextureDesc& desc, std::string& err){
    auto* res = static_cast<ID3D12Resource*>(desc.resource);
    if (!res){ err = "d3d12: importTexture needs the host's ID3D12Resource"; return {}; }
    ComPtr<ID3D12Device> owner;
    if (FAILED(res->GetDevice(IID_PPV_ARGS(&owner))) || !sameObject(owner.Get(), device_.Get())){
        err = "d3d12: the host's texture belongs to another device"; return {}; }
    const D3D12_RESOURCE_DESC rd = res->GetDesc();
    if (rd.Dimension != D3D12_RESOURCE_DIMENSION_TEXTURE2D || rd.DepthOrArraySize != 1 || rd.MipLevels != 1 || rd.SampleDesc.Count != 1){
        err = "d3d12: a host texture is 2D with one mip level, one layer and one sample"; return {}; }
    if (isDepth(desc.format)){ err = "d3d12: a depth-stencil texture is not imported; depth crosses as R32Float"; return {}; }
    if (rd.Format != dxgiFormat(desc.format)){
        err = "d3d12: the host's texture has DXGI format " + std::to_string((int)rd.Format) + ", the description says " + std::to_string((int)dxgiFormat(desc.format)); return {}; }
    const bool target = has(desc.usage, TextureUsage::RenderTarget), sampled = has(desc.usage, TextureUsage::Sampled);
    const bool allowsTarget = (rd.Flags & D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET) != 0;
    if ((target || desc.state == TextureState::RenderTarget) && !allowsTarget){ err = "d3d12: the host's texture does not allow render targets"; return {}; }
    if (sampled && (rd.Flags & D3D12_RESOURCE_FLAG_DENY_SHADER_RESOURCE)){ err = "d3d12: the host's texture denies shader resource views"; return {}; }
    if (!srvCpu.heap && !initHeaps(err)) return {};
    TexRec t;
    t.res = res;   // one reference, released when the record goes
    t.w = (uint32_t)rd.Width; t.h = rd.Height; t.usage = desc.usage; t.format = desc.format;
    t.external = true; t.boundary = t.state = d3dState(desc.state);
    if (sampled && !viewSlot(srvCpu, srvFree_, t.srv, "SRV", err)) return {};
    if (target && !viewSlot(rtvCpu, rtvFree_, t.rtv, "RTV", err)){ if (sampled) srvFree_.push_back(t.srv); return {}; }
    if (sampled){
        D3D12_SHADER_RESOURCE_VIEW_DESC sv{};
        sv.Format = rd.Format; sv.ViewDimension = D3D12_SRV_DIMENSION_TEXTURE2D;
        sv.Shader4ComponentMapping = D3D12_DEFAULT_SHADER_4_COMPONENT_MAPPING; sv.Texture2D.MipLevels = 1;
        device_->CreateShaderResourceView(res, &sv, cpuAt(srvCpu, t.srv));
    }
    if (target) device_->CreateRenderTargetView(res, nullptr, cpuAt(rtvCpu, t.rtv));
    const auto id = textures_.insert(std::move(t));
    externals_.push_back({id.index, id.gen});
    return {id.index, id.gen};
}

bool D3d12Device::endRecording(std::string& err){
    if (!open_){ err = "d3d12: no command list is open"; return false; }
    open_ = false;
    // Each host texture leaves the submission in the state the host gave for it.
    for (TextureHandle h : externals_) if (TexRec* t = texture(h)) cmd_.transition(*t, t->boundary);
    if (cmd_.timestampsUsed > 0 && tsHeap_)   // the slots into the readback buffer, read by timestampSeconds
        list_->ResolveQueryData(tsHeap_.Get(), D3D12_QUERY_TYPE_TIMESTAMP, 0, cmd_.timestampsUsed, tsReadback_.Get(), 0);
    tsResolved_ = cmd_.timestampsUsed;
    const HRESULT hr = list_->Close();
    if (!cmd_.error.empty()){ err = cmd_.error; cmd_.staging.clear(); return false; }
    if (FAILED(hr)){ err = hrError("command list Close", hr); cmd_.staging.clear(); return false; }
    closed_ = true;
    return true;
}

// Wait, the list, Signal: all three are queue operations, so the GPU runs them in this order
// whatever the CPU does next.
bool D3d12Device::submit(const FenceSync& sync, std::string& err){
    if (open_ && !endRecording(err)) return false;
    if (!closed_){ err = "d3d12: no recorded command list to submit"; return false; }
    auto* fence = static_cast<ID3D12Fence*>(sync.fence);
    if ((sync.wait || sync.signal) && !fence){ err = "d3d12: a fence wait or signal needs the host's ID3D12Fence"; return false; }
    HRESULT hr;
    if (sync.wait && FAILED(hr = queue_->Wait(fence, sync.waitValue))){ err = hrError("queue Wait on the host's fence", hr); return false; }
    closed_ = false;
    ID3D12CommandList* lists[] = {list_.Get()};
    queue_->ExecuteCommandLists(1, lists);
    pending_ = true;
    bool ok = true;
    if (sync.signal && FAILED(hr = queue_->Signal(fence, sync.signalValue))){ err = hrError("queue Signal on the host's fence", hr); ok = false; }
    if (FAILED(hr = queue_->Signal(fence_.Get(), ++fenceValue_))){ if (ok) err = hrError("queue Signal", hr); ok = false; }
    return ok;
}

WaitResult D3d12Device::retire(uint32_t timeoutMs, std::string& err){
    if (!pending_) return WaitResult::Done;
    const uint64_t v = fenceValue_;
    const ULONGLONG start = GetTickCount64();
    while (fence_->GetCompletedValue() < v){
        const ULONGLONG spent = GetTickCount64() - start;
        if (timeoutMs != INFINITE && spent >= timeoutMs){
            err = "d3d12: the submission did not finish in " + std::to_string(timeoutMs) + " ms; a fence it waits on may never be signalled";
            return WaitResult::TimedOut;
        }
        const HRESULT hr = fence_->SetEventOnCompletion(v, event_);
        if (FAILED(hr)){ err = hrError("SetEventOnCompletion", hr); return WaitResult::Failed; }
        // The event resets itself and may carry a wake from an older wait, so the loop reads
        // the fence again instead of trusting the wake.
        WaitForSingleObject(event_, timeoutMs == INFINITE ? INFINITE : (DWORD)(timeoutMs - spent));
    }
    pending_ = false;
    const HRESULT removed = device_->GetDeviceRemovedReason();
    if (FAILED(removed)){ err = hrError("the D3D12 device was removed", removed); return WaitResult::Failed; }
    if (!debugErrors(err)) return WaitResult::Failed;   // staging stays: a failed list may have left the GPU reading it
    cmd_.staging.clear();
    return WaitResult::Done;
}
}  // namespace raw::rhi::d3d12

namespace raw::rhi {
std::unique_ptr<Device> adoptDevice(const HostDevice& host, std::string& err){
    auto d = std::make_unique<d3d12::D3d12Device>();
    std::string e;
    if (!d->initAdopted(host, e)){ err = e; return nullptr; }
    return d;
}
}
