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

// b0 root constant buffer, u1..u5 root UAVs: the registers post_gtao.hlsl (u1, u2) and
// ours_gtao_fast.hlsl (u1..u5) declare.
ComPtr<ID3D12RootSignature> oursRoot(Dx& dx) {
    D3D12_ROOT_PARAMETER p[6]{};
    p[0].ParameterType = D3D12_ROOT_PARAMETER_TYPE_CBV; p[0].Descriptor.ShaderRegister = 0;
    for (UINT k = 1; k < 6; ++k) { p[k].ParameterType = D3D12_ROOT_PARAMETER_TYPE_UAV; p[k].Descriptor.ShaderRegister = k; }
    D3D12_ROOT_SIGNATURE_DESC d{6, p, 0, nullptr, D3D12_ROOT_SIGNATURE_FLAG_NONE};
    ComPtr<ID3DBlob> blob, error;
    HRESULT hr = D3D12SerializeRootSignature(&d, D3D_ROOT_SIGNATURE_VERSION_1, &blob, &error);
    if (FAILED(hr)) { dx.fail("D3D12SerializeRootSignature (ours)", hr); return nullptr; }
    ComPtr<ID3D12RootSignature> r;
    if (FAILED(hr = dx.dev->CreateRootSignature(0, blob->GetBufferPointer(), blob->GetBufferSize(), IID_PPV_ARGS(&r)))) { dx.fail("CreateRootSignature (ours)", hr); return nullptr; }
    return r;
}
// The passes of a method: post_gtao alone (one dispatch a pixel, 64 a group), or the fast
// chain: pack (64 a group), main and blur (8 x 8 tiles).
struct Pass { ComPtr<ID3D12PipelineState> pso; bool tiled; };
bool passes(Dx& dx, const std::string& dir, ID3D12RootSignature* root, const std::string& shader, std::vector<Pass>& out) {
    const std::vector<std::pair<std::string, bool>> names = shader == "fast"
        ? std::vector<std::pair<std::string, bool>>{{"fast_CSPack", false}, {"fast_CSMain", true}, {"fast_CSBlur", true}}
        : std::vector<std::pair<std::string, bool>>{{shader, false}};
    for (const auto& [n, tiled] : names) {
        std::vector<char> cso;
        if (!loadCso(dir, n, cso, dx.err)) return false;
        Pass p{pipeline(dx, root, cso), tiled};
        if (!p.pso) return false;
        out.push_back(p);
    }
    return true;
}
// The fast chain's inputs, the ones XeGTAO reads: NDC depth of the same left-handed projection
// (ao_gpu_xe.cpp), 1 where empty, and view normals (ours, 4 floats a pixel).
void fastInputs(const Frame& f, std::vector<float>& ndc, std::vector<float>& nrm, float& mul, float& add) {
    const double n = f.nearZ, fa = f.farZ;
    mul = float(n * fa / (fa - n)); add = float(fa / (fa - n));
    const std::size_t px = std::size_t(f.w) * std::size_t(f.h);
    ndc.assign(px, 1.0f); nrm.assign(px * 4, 0.0f);
    for (std::size_t i = 0; i < px; ++i) {
        const float* g = &f.gbuf[i * 8];
        if (g[3] < 0.0f) continue;
        ndc[i] = float(double(add) - double(mul) / double(g[3]));
        for (int k = 0; k < 3; ++k) nrm[i * 4 + std::size_t(k)] = g[4 + k];
    }
}
}  // namespace

bool runOurs(Dx& dx, const std::string& csoDir, const Frame& f, const OursConfig& c, int iters, Run& out) {
    ComPtr<ID3D12RootSignature> root = oursRoot(dx);
    std::vector<Pass> ps;
    if (!root || !passes(dx, csoDir, root.Get(), c.shader, ps)) return false;
    const bool fast = c.shader == "fast";
    const uint32_t n = uint32_t(f.w * f.h);
    std::vector<float> ndc, nrm;
    float mul = 0, add = 0;
    if (fast) fastInputs(f, ndc, nrm, mul, add);
    const PostParamsGpu prm{uint32_t(f.w), uint32_t(f.h), uint32_t(c.slices), uint32_t(c.steps), 8, 0, 0, 0,
                            {float(f.tanHalf), float(f.aspect), float(f.nearZ), float(c.radius)}, {mul, add, 0, 0}, {0, 0, 0, 0}};
    const auto U = D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS;
    const auto UA = D3D12_RESOURCE_STATE_UNORDERED_ACCESS, CD = D3D12_RESOURCE_STATE_COPY_DEST;
    auto cb = dx.buffer(256, D3D12_HEAP_TYPE_DEFAULT, D3D12_RESOURCE_FLAG_NONE, CD);
    auto gb = dx.buffer(uint64_t(n) * (fast ? 4 : 32), D3D12_HEAP_TYPE_DEFAULT, U, CD);   // fast: NDC depth; else the G-buffer
    auto nb = dx.buffer(uint64_t(n) * 16, D3D12_HEAP_TYPE_DEFAULT, U, CD);
    auto ob = dx.buffer(uint64_t(n) * 4, D3D12_HEAP_TYPE_DEFAULT, U, UA);
    auto db = dx.buffer(uint64_t(n) * 8,   // every depth level fits in twice the pixels
                        D3D12_HEAP_TYPE_DEFAULT, U, UA);
    auto tb = dx.buffer(uint64_t(n) * 4, D3D12_HEAP_TYPE_DEFAULT, U, UA);
    if (!cb || !gb || !nb || !ob || !db || !tb) return false;
    dx.uploadBuffer(cb.Get(), &prm, sizeof prm);
    if (fast) { dx.uploadBuffer(gb.Get(), ndc.data(), uint64_t(n) * 4); dx.uploadBuffer(nb.Get(), nrm.data(), uint64_t(n) * 16); }
    else dx.uploadBuffer(gb.Get(), f.gbuf.data(), uint64_t(n) * 32);
    dx.transition(cb.Get(), CD, D3D12_RESOURCE_STATE_VERTEX_AND_CONSTANT_BUFFER);
    dx.transition(gb.Get(), CD, UA);
    dx.transition(nb.Get(), CD, UA);
    if (!dx.submit()) return false;
    const ID3D12Resource* binds[5] = {gb.Get(), ob.Get(), db.Get(), tb.Get(), nb.Get()};
    for (int k = 0; k < iters; ++k) {
        dx.stamp(uint32_t(2 * k));
        dx.list->SetComputeRootSignature(root.Get());
        dx.list->SetComputeRootConstantBufferView(0, cb->GetGPUVirtualAddress());
        for (UINT r = 0; r < 5; ++r) dx.list->SetComputeRootUnorderedAccessView(r + 1, const_cast<ID3D12Resource*>(binds[r])->GetGPUVirtualAddress());
        for (const Pass& p : ps) {
            dx.list->SetPipelineState(p.pso.Get());
            if (p.tiled) dx.list->Dispatch((uint32_t(f.w) + 7) / 8, (uint32_t(f.h) + 7) / 8, 1);
            else dx.list->Dispatch((n + 63) / 64, 1, 1);
            dx.uavBarrier();
        }
        dx.stamp(uint32_t(2 * k + 1));
        if (k % 4 == 3 && !dx.submit()) return false;   // short lists: a slow method must not trip the GPU watchdog
    }
    std::vector<double> t;
    if (!dx.submit() || !dx.stamps(uint32_t(2 * iters), t)) return false;
    out.ms.clear();
    for (int k = 0; k < iters; ++k) out.ms.push_back(1e3 * (t[std::size_t(2 * k + 1)] - t[std::size_t(2 * k)]));
    out.ao.assign(n, 1.0f);
    dx.transition(ob.Get(), UA, D3D12_RESOURCE_STATE_COPY_SOURCE);
    return dx.readBuffer(ob.Get(), uint64_t(n) * 4, out.ao.data());
}

}  // namespace raw::aobench
