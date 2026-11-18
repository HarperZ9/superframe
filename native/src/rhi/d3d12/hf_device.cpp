// The hero frame's device objects: descriptor heaps, the root signatures, every pipeline and the
// frame targets (see hf_device.hpp).
#include "hf_device.hpp"
#include "raw_hf_dxil.hpp"
#include <cstring>
namespace raw::rhi::d3d12::hf {
namespace {
const HfDxilBlob* blob(const char* name){
    for (const HfDxilBlob& b : kHfDxil) if (std::strcmp(b.name, name) == 0) return &b;
    return nullptr;
}
bool heapOf(ID3D12Device* d, D3D12_DESCRIPTOR_HEAP_TYPE t, UINT n, bool visible, ComPtr<ID3D12DescriptorHeap>& out, std::string& err){
    D3D12_DESCRIPTOR_HEAP_DESC hd{}; hd.Type = t; hd.NumDescriptors = n;
    hd.Flags = visible ? D3D12_DESCRIPTOR_HEAP_FLAG_SHADER_VISIBLE : D3D12_DESCRIPTOR_HEAP_FLAG_NONE;
    const HRESULT hr = d->CreateDescriptorHeap(&hd, IID_PPV_ARGS(&out));
    if (FAILED(hr)){ err = hrError("hero frame descriptor heap", hr); return false; }
    return true;
}
bool serialize(ID3D12Device* d, const D3D12_ROOT_SIGNATURE_DESC& rd, ComPtr<ID3D12RootSignature>& out, std::string& err){
    ComPtr<ID3DBlob> b, msg;
    HRESULT hr = D3D12SerializeRootSignature(&rd, D3D_ROOT_SIGNATURE_VERSION_1, &b, &msg);
    if (FAILED(hr)){ err = hrError(std::string("hero frame root signature: ") + (msg ? (const char*)msg->GetBufferPointer() : ""), hr); return false; }
    if (FAILED(hr = d->CreateRootSignature(0, b->GetBufferPointer(), b->GetBufferSize(), IID_PPV_ARGS(&out)))){ err = hrError("CreateRootSignature", hr); return false; }
    return true;
}
D3D12_ROOT_PARAMETER rootDesc(D3D12_ROOT_PARAMETER_TYPE t, UINT reg){
    D3D12_ROOT_PARAMETER p{}; p.ParameterType = t; p.Descriptor.ShaderRegister = reg; p.ShaderVisibility = D3D12_SHADER_VISIBILITY_ALL;
    return p;
}
}  // namespace

bool initDevice(Ctx& c, ID3D12Device* d, std::string& err){
    if (FAILED(d->QueryInterface(IID_PPV_ARGS(&c.dev)))){ err = "the device has no ID3D12Device5 (DXR)"; return false; }
    if (!c.q.init(d, D3D12_COMMAND_LIST_TYPE_DIRECT, 64, err)) return false;
    if (!heapOf(d, D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV, 2048, true, c.heap, err) ||
        !heapOf(d, D3D12_DESCRIPTOR_HEAP_TYPE_RTV, 16, false, c.rtvHeap, err) || !heapOf(d, D3D12_DESCRIPTOR_HEAP_TYPE_DSV, 2, false, c.dsvHeap, err)) return false;
    c.inc = d->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_CBV_SRV_UAV);
    c.rtvInc = d->GetDescriptorHandleIncrementSize(D3D12_DESCRIPTOR_HEAP_TYPE_RTV);
    return true;
}

bool rootSignatures(Ctx& c, std::string& err){
    D3D12_DESCRIPTOR_RANGE tex{D3D12_DESCRIPTOR_RANGE_TYPE_SRV, c.texCount ? c.texCount : 1, 0, 1, 0};
    D3D12_DESCRIPTOR_RANGE uav{D3D12_DESCRIPTOR_RANGE_TYPE_UAV, kUavSlots, 0, 0, 0};
    std::vector<D3D12_ROOT_PARAMETER> p;
    p.push_back(rootDesc(D3D12_ROOT_PARAMETER_TYPE_CBV, 0));
    D3D12_ROOT_PARAMETER k{}; k.ParameterType = D3D12_ROOT_PARAMETER_TYPE_32BIT_CONSTANTS; k.Constants.ShaderRegister = 1; k.Constants.Num32BitValues = 16; k.ShaderVisibility = D3D12_SHADER_VISIBILITY_ALL;
    p.push_back(k);
    for (UINT t = 0; t < 6; ++t) p.push_back(rootDesc(D3D12_ROOT_PARAMETER_TYPE_SRV, t));
    D3D12_ROOT_PARAMETER t1{}; t1.ParameterType = D3D12_ROOT_PARAMETER_TYPE_DESCRIPTOR_TABLE; t1.DescriptorTable = {1, &tex}; t1.ShaderVisibility = D3D12_SHADER_VISIBILITY_ALL;
    D3D12_ROOT_PARAMETER t2 = t1; t2.DescriptorTable = {1, &uav};
    p.push_back(t1); p.push_back(t2);
    D3D12_STATIC_SAMPLER_DESC s[2]{};
    for (int i = 0; i < 2; ++i){
        s[i].Filter = i == 0 ? D3D12_FILTER_ANISOTROPIC : D3D12_FILTER_MIN_MAG_MIP_LINEAR; s[i].MaxAnisotropy = 16;
        const auto a = i == 0 ? D3D12_TEXTURE_ADDRESS_MODE_WRAP : D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
        s[i].AddressU = s[i].AddressV = s[i].AddressW = a; s[i].MaxLOD = D3D12_FLOAT32_MAX; s[i].ShaderRegister = UINT(i);
        s[i].ShaderVisibility = D3D12_SHADER_VISIBILITY_ALL;
    }
    D3D12_ROOT_SIGNATURE_DESC rd{}; rd.NumParameters = UINT(p.size()); rd.pParameters = p.data(); rd.NumStaticSamplers = 2; rd.pStaticSamplers = s;
    if (!serialize(c.dev.Get(), rd, c.rs, err)) return false;
    // the fast GTAO's own (bench/ao/ao_gpu_ours.cpp): a CBV at b0 and five buffers as root UAVs u1..u5
    D3D12_ROOT_PARAMETER g[6] = {rootDesc(D3D12_ROOT_PARAMETER_TYPE_CBV, 0)};
    for (UINT i = 1; i < 6; ++i) g[i] = rootDesc(D3D12_ROOT_PARAMETER_TYPE_UAV, i);
    D3D12_ROOT_SIGNATURE_DESC gd{}; gd.NumParameters = 6; gd.pParameters = g;
    return serialize(c.dev.Get(), gd, c.gtaoRs, err);
}

namespace {
bool compute(Ctx& c, const char* name, ID3D12RootSignature* rs, ComPtr<ID3D12PipelineState>& out, std::string& err){
    const HfDxilBlob* b = blob(name);
    if (!b){ err = std::string("this build has no ") + name + " shader"; return false; }
    D3D12_COMPUTE_PIPELINE_STATE_DESC pd{}; pd.pRootSignature = rs; pd.CS = {b->bytes, b->size};
    const HRESULT hr = c.dev->CreateComputePipelineState(&pd, IID_PPV_ARGS(&out));
    if (FAILED(hr)){ err = hrError(std::string("hero frame pipeline ") + name, hr); return false; }
    return true;
}
bool raster(Ctx& c, const char* vs, const char* ps, bool snow, ComPtr<ID3D12PipelineState>& out, std::string& err){
    const HfDxilBlob *v = blob(vs), *p = blob(ps);
    if (!v || !p){ err = std::string("this build has no ") + vs + " shader"; return false; }
    D3D12_GRAPHICS_PIPELINE_STATE_DESC d{};
    d.pRootSignature = c.rs.Get(); d.VS = {v->bytes, v->size}; d.PS = {p->bytes, p->size};
    d.RasterizerState.FillMode = D3D12_FILL_MODE_SOLID; d.RasterizerState.CullMode = D3D12_CULL_MODE_NONE; d.RasterizerState.DepthClipEnable = TRUE;
    d.SampleMask = UINT_MAX; d.PrimitiveTopologyType = D3D12_PRIMITIVE_TOPOLOGY_TYPE_TRIANGLE; d.SampleDesc.Count = 1;
    d.DepthStencilState.DepthEnable = TRUE; d.DepthStencilState.DepthFunc = D3D12_COMPARISON_FUNC_GREATER;
    d.DepthStencilState.DepthWriteMask = snow ? D3D12_DEPTH_WRITE_MASK_ZERO : D3D12_DEPTH_WRITE_MASK_ALL; d.DSVFormat = DXGI_FORMAT_D32_FLOAT;
    if (snow){
        d.NumRenderTargets = 1; d.RTVFormats[0] = DXGI_FORMAT_R16G16B16A16_FLOAT;
        auto& b = d.BlendState.RenderTarget[0];
        b.BlendEnable = TRUE; b.SrcBlend = D3D12_BLEND_SRC_ALPHA; b.DestBlend = D3D12_BLEND_INV_SRC_ALPHA; b.BlendOp = D3D12_BLEND_OP_ADD;
        b.SrcBlendAlpha = D3D12_BLEND_ZERO; b.DestBlendAlpha = D3D12_BLEND_ONE; b.BlendOpAlpha = D3D12_BLEND_OP_ADD; b.RenderTargetWriteMask = 0xF;
    } else {
        d.NumRenderTargets = 4;
        d.RTVFormats[0] = d.RTVFormats[1] = d.RTVFormats[2] = DXGI_FORMAT_R16G16B16A16_FLOAT; d.RTVFormats[3] = DXGI_FORMAT_R32G32B32A32_FLOAT;
        for (int i = 0; i < 4; ++i) d.BlendState.RenderTarget[i].RenderTargetWriteMask = 0xF;
    }
    const HRESULT hr = c.dev->CreateGraphicsPipelineState(&d, IID_PPV_ARGS(&out));
    if (FAILED(hr)){ err = hrError(std::string("hero frame raster pipeline ") + vs, hr); return false; }
    return true;
}
}  // namespace

bool pipelines(Ctx& c, std::string& err){
    static const char* kCompute[] = {"hf_cluster", "hf_gtao_pack", "hf_gtao_unpack", "hf_direct_initial", "hf_direct_shade", "hf_gi", "hf_reflect",
        "hf_fog_inject", "hf_fog_integrate", "hf_temporal", "hf_atrous", "hf_composite", "hf_taa", "hf_bloom_down", "hf_bloom_up",
        "hf_tonemap", "hf_pt_resolve", "hf_pt"};
    for (const char* n : kCompute) if (!compute(c, n, c.rs.Get(), c.pso[n], err)) return false;
    for (const char* n : {"hf_gtao_fpack", "hf_gtao_fmain", "hf_gtao_fblur"}) if (!compute(c, n, c.gtaoRs.Get(), c.pso[n], err)) return false;
    return
           raster(c, "hf_gbuffer_vs", "hf_gbuffer_ps", false, c.gbufPso, err) && raster(c, "hf_snow_vs", "hf_snow_ps", true, c.snowPso, err);
}

bool defaultBuffer(Ctx& c, uint64_t bytes, ComPtr<ID3D12Resource>& out, std::string& err, bool uav){
    D3D12_HEAP_PROPERTIES hp{}; hp.Type = D3D12_HEAP_TYPE_DEFAULT;
    D3D12_RESOURCE_DESC rd{}; rd.Dimension = D3D12_RESOURCE_DIMENSION_BUFFER; rd.Width = bytes < 256 ? 256 : bytes; rd.Height = 1; rd.DepthOrArraySize = 1;
    rd.MipLevels = 1; rd.SampleDesc.Count = 1; rd.Layout = D3D12_TEXTURE_LAYOUT_ROW_MAJOR; rd.Flags = uav ? D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS : D3D12_RESOURCE_FLAG_NONE;
    const HRESULT hr = c.dev->CreateCommittedResource(&hp, D3D12_HEAP_FLAG_NONE, &rd, D3D12_RESOURCE_STATE_COMMON, nullptr, IID_PPV_ARGS(&out));
    if (FAILED(hr)){ err = hrError("hero frame buffer (" + std::to_string(bytes) + " bytes)", hr); return false; }
    return true;
}

void transition(Ctx& c, Target& t, D3D12_RESOURCE_STATES to){
    if (t.state == to) return;
    D3D12_RESOURCE_BARRIER b{}; b.Type = D3D12_RESOURCE_BARRIER_TYPE_TRANSITION;
    b.Transition.pResource = t.res.Get(); b.Transition.StateBefore = t.state; b.Transition.StateAfter = to; b.Transition.Subresource = D3D12_RESOURCE_BARRIER_ALL_SUBRESOURCES;
    c.cl->ResourceBarrier(1, &b);
    t.state = to;
}
void uavBarrier(Ctx& c){
    D3D12_RESOURCE_BARRIER b{}; b.Type = D3D12_RESOURCE_BARRIER_TYPE_UAV;
    c.cl->ResourceBarrier(1, &b);
}

}  // namespace raw::rhi::d3d12::hf
