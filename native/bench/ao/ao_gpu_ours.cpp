// Our AO passes on the bench's D3D12 context, plus the frame loader and pipeline helpers.
#include "ao_gpu.hpp"
#include <cstdio>
#include <cstring>
#include <iterator>
#include <fstream>
#include <sstream>
namespace raw::aobench {

static bool readAll(const std::string& path, std::vector<char>& out, std::string& err) {
    std::ifstream f(path, std::ios::binary);
    if (!f) { err = "cannot open " + path; return false; }
    out.assign(std::istreambuf_iterator<char>(f), std::istreambuf_iterator<char>());
    return true;
}

bool loadFrame(const std::string& dir, const std::string& line, Frame& f, std::string& err) {
    std::istringstream in(line);
    in >> f.name >> f.w >> f.h >> f.tanHalf >> f.aspect >> f.nearZ >> f.farZ >> f.radius >> f.rays;
    if (!in || f.w <= 0 || f.h <= 0) { err = "bad scenes.txt line: " + line; return false; }
    const std::size_t n = std::size_t(f.w) * std::size_t(f.h);
    std::vector<char> g, r;
    if (!readAll(dir + "/" + f.name + ".gbuf", g, err) || !readAll(dir + "/" + f.name + ".ref", r, err)) return false;
    if (g.size() != n * 32 || r.size() != n * 4) { err = f.name + ": file sizes do not match " + std::to_string(f.w) + " x " + std::to_string(f.h); return false; }
    f.gbuf.resize(n * 8); f.ref.resize(n); f.valid.resize(n);
    std::memcpy(f.gbuf.data(), g.data(), g.size());
    std::memcpy(f.ref.data(), r.data(), r.size());
    for (std::size_t i = 0; i < n; ++i) f.valid[i] = f.gbuf[i * 8 + 3] >= 0.0f;
    return true;
}

bool loadCso(const std::string& dir, const std::string& file, std::vector<char>& out, std::string& err) {
    return readAll(dir + "/" + file + ".cso", out, err);
}

ComPtr<ID3D12PipelineState> pipeline(Dx& dx, ID3D12RootSignature* root, const std::vector<char>& cso) {
    D3D12_COMPUTE_PIPELINE_STATE_DESC d{};
    d.pRootSignature = root; d.CS = {cso.data(), cso.size()};
    ComPtr<ID3D12PipelineState> p;
    const HRESULT hr = dx.dev->CreateComputePipelineState(&d, IID_PPV_ARGS(&p));
    if (FAILED(hr)) { dx.fail("CreateComputePipelineState", hr); return nullptr; }
    return p;
}

namespace {
struct PostParamsGpu { uint32_t width, height, slices, steps, refine, flags, ssrSteps, pad1; float view[4], ssr[4], taa[4]; };
static_assert(sizeof(PostParamsGpu) == 80, "PostParams layout");

// b0 root constant buffer, u1 and u2 root UAVs: the registers post_gtao.hlsl declares.
ComPtr<ID3D12RootSignature> oursRoot(Dx& dx) {
    D3D12_ROOT_PARAMETER p[3]{};
    p[0].ParameterType = D3D12_ROOT_PARAMETER_TYPE_CBV; p[0].Descriptor.ShaderRegister = 0;
    p[1].ParameterType = D3D12_ROOT_PARAMETER_TYPE_UAV; p[1].Descriptor.ShaderRegister = 1;
    p[2].ParameterType = D3D12_ROOT_PARAMETER_TYPE_UAV; p[2].Descriptor.ShaderRegister = 2;
    D3D12_ROOT_SIGNATURE_DESC d{3, p, 0, nullptr, D3D12_ROOT_SIGNATURE_FLAG_NONE};
    ComPtr<ID3DBlob> blob, error;
    HRESULT hr = D3D12SerializeRootSignature(&d, D3D_ROOT_SIGNATURE_VERSION_1, &blob, &error);
    if (FAILED(hr)) { dx.fail("D3D12SerializeRootSignature (ours)", hr); return nullptr; }
    ComPtr<ID3D12RootSignature> r;
    if (FAILED(hr = dx.dev->CreateRootSignature(0, blob->GetBufferPointer(), blob->GetBufferSize(), IID_PPV_ARGS(&r)))) { dx.fail("CreateRootSignature (ours)", hr); return nullptr; }
    return r;
}
}  // namespace

bool runOurs(Dx& dx, const std::string& csoDir, const Frame& f, const OursConfig& c, int iters, Run& out) {
    std::vector<char> cso;
    if (!loadCso(csoDir, c.shader, cso, dx.err)) return false;
    ComPtr<ID3D12RootSignature> root = oursRoot(dx);
    ComPtr<ID3D12PipelineState> pso = root ? pipeline(dx, root.Get(), cso) : nullptr;
    if (!pso) return false;
    const uint32_t n = uint32_t(f.w * f.h);
    const PostParamsGpu prm{uint32_t(f.w), uint32_t(f.h), uint32_t(c.slices), uint32_t(c.steps), 8, 0, 0, 0,
                            {float(f.tanHalf), float(f.aspect), float(f.nearZ), float(c.radius)}, {0, 0, 0, 0}, {0, 0, 0, 0}};
    auto cb = dx.buffer(256, D3D12_HEAP_TYPE_DEFAULT, D3D12_RESOURCE_FLAG_NONE, D3D12_RESOURCE_STATE_COPY_DEST);
    auto gb = dx.buffer(uint64_t(n) * 32, D3D12_HEAP_TYPE_DEFAULT, D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS, D3D12_RESOURCE_STATE_COPY_DEST);
    auto ob = dx.buffer(uint64_t(n) * 4, D3D12_HEAP_TYPE_DEFAULT, D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS, D3D12_RESOURCE_STATE_UNORDERED_ACCESS);
    if (!cb || !gb || !ob) return false;
    dx.uploadBuffer(cb.Get(), &prm, sizeof prm);
    dx.uploadBuffer(gb.Get(), f.gbuf.data(), uint64_t(n) * 32);
    dx.transition(cb.Get(), D3D12_RESOURCE_STATE_COPY_DEST, D3D12_RESOURCE_STATE_VERTEX_AND_CONSTANT_BUFFER);
    dx.transition(gb.Get(), D3D12_RESOURCE_STATE_COPY_DEST, D3D12_RESOURCE_STATE_UNORDERED_ACCESS);
    if (!dx.submit()) return false;
    for (int k = 0; k < iters; ++k) {
        dx.stamp(uint32_t(2 * k));
        dx.list->SetComputeRootSignature(root.Get());
        dx.list->SetPipelineState(pso.Get());
        dx.list->SetComputeRootConstantBufferView(0, cb->GetGPUVirtualAddress());
        dx.list->SetComputeRootUnorderedAccessView(1, gb->GetGPUVirtualAddress());
        dx.list->SetComputeRootUnorderedAccessView(2, ob->GetGPUVirtualAddress());
        dx.list->Dispatch((n + 63) / 64, 1, 1);
        dx.uavBarrier();
        dx.stamp(uint32_t(2 * k + 1));
    }
    std::vector<double> t;
    if (!dx.submit() || !dx.stamps(uint32_t(2 * iters), t)) return false;
    out.ms.clear();
    for (int k = 0; k < iters; ++k) out.ms.push_back(1e3 * (t[std::size_t(2 * k + 1)] - t[std::size_t(2 * k)]));
    out.ao.assign(n, 1.0f);
    dx.transition(ob.Get(), D3D12_RESOURCE_STATE_UNORDERED_ACCESS, D3D12_RESOURCE_STATE_COPY_SOURCE);
    return dx.readBuffer(ob.Get(), uint64_t(n) * 4, out.ao.data());
}

}  // namespace raw::aobench
