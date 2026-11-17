// XeGTAO (third_party/xegtao, MIT, Intel) on the bench's D3D12 context: its three passes as its
// own sample runs them (prefilter depths into five MIPs, main pass, one denoise pass).
#include "ao_gpu.hpp"
#include <cassert>
#include <cmath>
#include "../../third_party/xegtao/XeGTAO.h"
namespace raw::aobench {
namespace {
constexpr D3D12_RESOURCE_STATES kUav = D3D12_RESOURCE_STATE_UNORDERED_ACCESS, kSrv = D3D12_RESOURCE_STATE_NON_PIXEL_SHADER_RESOURCE;

// b0 root CBV; t0..t1 and u0..u4 as tables; s0 a point-clamp sampler (what vaGTAO.hlsl expects).
ComPtr<ID3D12RootSignature> xeRoot(Dx& dx) {
    D3D12_DESCRIPTOR_RANGE srv{D3D12_DESCRIPTOR_RANGE_TYPE_SRV, 2, 0, 0, D3D12_DESCRIPTOR_RANGE_OFFSET_APPEND};
    D3D12_DESCRIPTOR_RANGE uav{D3D12_DESCRIPTOR_RANGE_TYPE_UAV, 5, 0, 0, D3D12_DESCRIPTOR_RANGE_OFFSET_APPEND};
    D3D12_ROOT_PARAMETER p[3]{};
    p[0].ParameterType = D3D12_ROOT_PARAMETER_TYPE_CBV; p[0].Descriptor.ShaderRegister = 0;
    p[1].ParameterType = D3D12_ROOT_PARAMETER_TYPE_DESCRIPTOR_TABLE; p[1].DescriptorTable = {1, &srv};
    p[2].ParameterType = D3D12_ROOT_PARAMETER_TYPE_DESCRIPTOR_TABLE; p[2].DescriptorTable = {1, &uav};
    D3D12_STATIC_SAMPLER_DESC s{};
    s.Filter = D3D12_FILTER_MIN_MAG_MIP_POINT;
    s.AddressU = s.AddressV = s.AddressW = D3D12_TEXTURE_ADDRESS_MODE_CLAMP;
    s.MaxLOD = D3D12_FLOAT32_MAX; s.ShaderVisibility = D3D12_SHADER_VISIBILITY_ALL;
    D3D12_ROOT_SIGNATURE_DESC d{3, p, 1, &s, D3D12_ROOT_SIGNATURE_FLAG_NONE};
    ComPtr<ID3DBlob> blob, error;
    HRESULT hr = D3D12SerializeRootSignature(&d, D3D_ROOT_SIGNATURE_VERSION_1, &blob, &error);
    if (FAILED(hr)) { dx.fail("D3D12SerializeRootSignature (XeGTAO)", hr); return nullptr; }
    ComPtr<ID3D12RootSignature> r;
    if (FAILED(hr = dx.dev->CreateRootSignature(0, blob->GetBufferPointer(), blob->GetBufferSize(), IID_PPV_ARGS(&r)))) { dx.fail("CreateRootSignature (XeGTAO)", hr); return nullptr; }
    return r;
}

// XeGTAO's inputs from our view G-buffer: D3D NDC depth (near 0, far 1) of a left-handed
// projection with the frame's near and far planes, and view normals in XeGTAO's axes (x right,
// y up, z away from the camera: ours with z negated).
void inputs(const Frame& f, std::vector<float>& ndc, std::vector<float>& nrm, float proj[16]) {
    const double n = f.nearZ, fa = f.farZ, mul = n * fa / (fa - n), add = fa / (fa - n);
    const std::size_t px = std::size_t(f.w) * std::size_t(f.h);
    ndc.assign(px, 1.0f); nrm.assign(px * 4, 0.0f);
    for (std::size_t i = 0; i < px; ++i) {
        const float* g = &f.gbuf[i * 8];
        nrm[i * 4 + 2] = -1.0f;
        if (g[3] < 0.0f) continue;
        ndc[i] = float(add - mul / double(g[3]));
        nrm[i * 4] = g[4]; nrm[i * 4 + 1] = g[5]; nrm[i * 4 + 2] = -g[6];
    }
    for (int k = 0; k < 16; ++k) proj[k] = 0.0f;   // row-major, as GTAOUpdateConstants reads it
    proj[0] = float(1.0 / (f.tanHalf * f.aspect)); proj[5] = float(1.0 / f.tanHalf);
    proj[10] = float(add); proj[11] = 1.0f; proj[14] = float(-mul);
}

struct XeTex { ComPtr<ID3D12Resource> raw, nrm, depth, edges, term, fin; };
bool makeTextures(Dx& dx, const Frame& f, XeTex& t) {
    const uint32_t w = uint32_t(f.w), h = uint32_t(f.h);
    const auto U = D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS;
    t.raw = dx.texture(w, h, DXGI_FORMAT_R32_FLOAT, 1, D3D12_RESOURCE_FLAG_NONE, D3D12_RESOURCE_STATE_COPY_DEST);
    t.nrm = dx.texture(w, h, DXGI_FORMAT_R32G32B32A32_FLOAT, 1, D3D12_RESOURCE_FLAG_NONE, D3D12_RESOURCE_STATE_COPY_DEST);
    t.depth = dx.texture(w, h, DXGI_FORMAT_R16_FLOAT, XE_GTAO_DEPTH_MIP_LEVELS, U, kUav);   // vaGTAO's default: 16-bit
    t.edges = dx.texture(w, h, DXGI_FORMAT_R8_UNORM, 1, U, kUav);
    t.term = dx.texture(w, h, DXGI_FORMAT_R8_UINT, 1, U, kUav);
    t.fin = dx.texture(w, h, DXGI_FORMAT_R8_UINT, 1, U, kUav);
    return t.raw && t.nrm && t.depth && t.edges && t.term && t.fin;
}
// Descriptor tables: [0] prefilter, [1] main, [2] denoise; each 2 SRVs then 5 UAVs.
uint32_t makeTables(Dx& dx, const XeTex& t) {
    const uint32_t b = dx.reserve(21);
    dx.srvTex(b, t.raw.Get(), DXGI_FORMAT_R32_FLOAT, 1); dx.nullSrv(b + 1);
    for (uint32_t m = 0; m < 5; ++m) dx.uavTex(b + 2 + m, t.depth.Get(), DXGI_FORMAT_R16_FLOAT, m);
    dx.srvTex(b + 7, t.depth.Get(), DXGI_FORMAT_R16_FLOAT, XE_GTAO_DEPTH_MIP_LEVELS); dx.srvTex(b + 8, t.nrm.Get(), DXGI_FORMAT_R32G32B32A32_FLOAT, 1);
    dx.uavTex(b + 9, t.term.Get(), DXGI_FORMAT_R8_UINT, 0); dx.uavTex(b + 10, t.edges.Get(), DXGI_FORMAT_R8_UNORM, 0);
    for (uint32_t k = 11; k < 14; ++k) dx.nullUav(b + k);
    dx.srvTex(b + 14, t.term.Get(), DXGI_FORMAT_R8_UINT, 1); dx.srvTex(b + 15, t.edges.Get(), DXGI_FORMAT_R8_UNORM, 1);
    dx.uavTex(b + 16, t.fin.Get(), DXGI_FORMAT_R8_UINT, 0);
    for (uint32_t k = 17; k < 21; ++k) dx.nullUav(b + k);
    return b;
}
const char* kMain[4] = {"CSGTAOLow", "CSGTAOMedium", "CSGTAOHigh", "CSGTAOUltra"};
}  // namespace

bool runXe(Dx& dx, const std::string& csoDir, const Frame& f, const XeConfig& c, int iters, Run& out) {
    const std::string v = c.defaults ? "xe1_" : "xe0_";
    std::vector<char> c0, c1, c2;
    if (!loadCso(csoDir, v + "CSPrefilterDepths16x16", c0, dx.err) || !loadCso(csoDir, v + kMain[c.quality], c1, dx.err) ||
        !loadCso(csoDir, v + "CSDenoiseLastPass", c2, dx.err)) return false;
    ComPtr<ID3D12RootSignature> root = xeRoot(dx);
    if (!root) return false;
    ComPtr<ID3D12PipelineState> pre = pipeline(dx, root.Get(), c0), main = pipeline(dx, root.Get(), c1), den = pipeline(dx, root.Get(), c2);
    XeTex t;
    if (!pre || !main || !den || !makeTextures(dx, f, t)) return false;
    std::vector<float> ndc, nrm;
    float proj[16];
    inputs(f, ndc, nrm, proj);
    XeGTAO::GTAOSettings s;
    s.QualityLevel = c.quality; s.DenoisePasses = c.denoise ? 1 : 0; s.Radius = float(f.radius);
    if (!c.defaults) { s.RadiusMultiplier = c.radiusMultiplier; s.FalloffRange = c.falloffRange; s.FinalValuePower = c.finalValuePower; }
    XeGTAO::GTAOConstants k{};
    XeGTAO::GTAOUpdateConstants(k, f.w, f.h, s, proj, true, 0);
    auto cb = dx.buffer(256, D3D12_HEAP_TYPE_DEFAULT, D3D12_RESOURCE_FLAG_NONE, D3D12_RESOURCE_STATE_COPY_DEST);
    dx.uploadBuffer(cb.Get(), &k, sizeof k);
    dx.uploadTexture(t.raw.Get(), ndc.data(), uint32_t(f.w), uint32_t(f.h), 4);
    dx.uploadTexture(t.nrm.Get(), nrm.data(), uint32_t(f.w), uint32_t(f.h), 16);
    dx.transition(cb.Get(), D3D12_RESOURCE_STATE_COPY_DEST, D3D12_RESOURCE_STATE_VERTEX_AND_CONSTANT_BUFFER);
    dx.transition(t.raw.Get(), D3D12_RESOURCE_STATE_COPY_DEST, kSrv);
    dx.transition(t.nrm.Get(), D3D12_RESOURCE_STATE_COPY_DEST, kSrv);
    dx.used = 0;   // the previous run's tables are finished with
    const uint32_t tb = makeTables(dx, t);
    if (!dx.submit()) return false;
    ID3D12DescriptorHeap* heaps[] = {dx.heap.Get()};
    const auto pass = [&](ID3D12PipelineState* p, uint32_t table, uint32_t gx, uint32_t gy) {
        dx.list->SetPipelineState(p);
        dx.list->SetComputeRootDescriptorTable(1, dx.gpu(tb + table * 7));
        dx.list->SetComputeRootDescriptorTable(2, dx.gpu(tb + table * 7 + 2));
        dx.list->Dispatch(gx, gy, 1);
    };
    const uint32_t W = uint32_t(f.w), H = uint32_t(f.h);
    for (int r = 0; r < iters; ++r) {
        dx.stamp(uint32_t(2 * r));
        dx.list->SetDescriptorHeaps(1, heaps);
        dx.list->SetComputeRootSignature(root.Get());
        dx.list->SetComputeRootConstantBufferView(0, cb->GetGPUVirtualAddress());
        pass(pre.Get(), 0, (W + 15) / 16, (H + 15) / 16);
        dx.transition(t.depth.Get(), kUav, kSrv);
        pass(main.Get(), 1, (W + 7) / 8, (H + 7) / 8);
        dx.transition(t.term.Get(), kUav, kSrv); dx.transition(t.edges.Get(), kUav, kSrv);
        pass(den.Get(), 2, (W + 15) / 16, (H + 7) / 8);
        dx.uavBarrier();
        dx.stamp(uint32_t(2 * r + 1));
        if (r % 4 == 3 && !dx.submit()) return false;   // short lists: a slow method must not trip the GPU watchdog
        dx.transition(t.depth.Get(), kSrv, kUav); dx.transition(t.term.Get(), kSrv, kUav); dx.transition(t.edges.Get(), kSrv, kUav);
    }
    std::vector<double> ts;
    if (!dx.submit() || !dx.stamps(uint32_t(2 * iters), ts)) return false;
    out.ms.clear();
    for (int r = 0; r < iters; ++r) out.ms.push_back(1e3 * (ts[std::size_t(2 * r + 1)] - ts[std::size_t(2 * r)]));
    std::vector<uint8_t> raw8(std::size_t(W) * H);
    dx.transition(t.fin.Get(), kUav, D3D12_RESOURCE_STATE_COPY_SOURCE);
    if (!dx.readTexture(t.fin.Get(), W, H, 1, raw8.data())) return false;
    out.ao.assign(raw8.size(), 1.0f);
    for (std::size_t i = 0; i < raw8.size(); ++i) out.ao[i] = f.valid[i] ? float(raw8[i]) / 255.0f : 1.0f;
    return true;
}

}  // namespace raw::aobench
