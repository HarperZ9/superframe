#pragma once
// The hero frame's D3D12 state (private to src/rhi/d3d12/; the public API is raw/rhi/hw_frame.hpp).
// One root signature for every pass: b0 the frame constants (a root CBV), b1 sixteen pass
// constants, t0 the TLAS and t1..t5 the scene buffers as root SRVs, a table of the material
// textures (space1) and a table of every frame target at its fixed UAV slot (hf_common.hlsli).
#include "hw_queue.hpp"
#include "raw/rhi/hw_frame.hpp"
#include <cstdint>
#include <map>
#include <string>
#include <vector>
namespace raw::rhi::d3d12::hf {

inline constexpr uint32_t kUavSlots = 37;           // u0..u36
inline constexpr uint32_t kTexBase = 64;            // the material textures' first descriptor
struct Target {
    ComPtr<ID3D12Resource> res;
    DXGI_FORMAT fmt{DXGI_FORMAT_UNKNOWN};
    uint32_t w{0}, h{0}, d{1};
    D3D12_RESOURCE_STATES state{D3D12_RESOURCE_STATE_UNORDERED_ACCESS};
    UINT rtv{~0u};
};
// The frame constants, laid out as hf_common.hlsli's Frame.
struct FrameCB {
    float viewProj[16], prevViewProj[16], invViewProj[16], view[16];
    float eye[4], size[4], jitter[4], moonDir[4], moonRad[4], skyParams[4], cluster[4], fog[4];
    uint32_t counts[4];
    float timeParams[4], fwd[4];
};

struct Ctx {
    HwQueue q;
    ComPtr<ID3D12Device5> dev;
    ComPtr<ID3D12GraphicsCommandList4> cl;
    ComPtr<ID3D12DescriptorHeap> heap, rtvHeap, dsvHeap;
    UINT inc{0}, rtvInc{0};
    ComPtr<ID3D12RootSignature> rs, gtaoRs;
    std::map<std::string, ComPtr<ID3D12PipelineState>> pso;
    ComPtr<ID3D12PipelineState> gbufPso, snowPso;
    // scene
    ComPtr<ID3D12Resource> verts, idx, triMat, mats, lights, blas, tlas, inst, scratch;
    std::vector<ComPtr<ID3D12Resource>> textures;
    uint32_t texCount{0}, skyIndex{0}, triangles{0}, lightCount{0};
    // targets by u slot, then depth, and the plain buffers
    std::vector<Target> uav;
    Target depth;
    ComPtr<ID3D12Resource> cb, readHdr, readLdr;
    uint32_t w{0}, h{0};
    uint64_t texBytes{0}, targetBytes{0}, blasBytes{0}, tlasBytes{0};
    double buildMs{0};

    D3D12_CPU_DESCRIPTOR_HANDLE cpu(UINT i) const { auto h = heap->GetCPUDescriptorHandleForHeapStart(); h.ptr += SIZE_T(i) * inc; return h; }
    D3D12_GPU_DESCRIPTOR_HANDLE gpu(UINT i) const { auto h = heap->GetGPUDescriptorHandleForHeapStart(); h.ptr += UINT64(i) * inc; return h; }
    D3D12_CPU_DESCRIPTOR_HANDLE rtv(UINT i) const { auto h = rtvHeap->GetCPUDescriptorHandleForHeapStart(); h.ptr += SIZE_T(i) * rtvInc; return h; }
};

// hf_device.cpp
bool initDevice(Ctx& c, ID3D12Device* d, std::string& err);
bool rootSignatures(Ctx& c, std::string& err);
bool pipelines(Ctx& c, std::string& err);
bool makeTargets(Ctx& c, uint32_t w, uint32_t h, std::string& err);
void transition(Ctx& c, Target& t, D3D12_RESOURCE_STATES to);
void uavBarrier(Ctx& c);
bool defaultBuffer(Ctx& c, uint64_t bytes, ComPtr<ID3D12Resource>& out, std::string& err, bool uav = true);
// hf_scene.cpp
bool uploadScene(Ctx& c, const hw::FrameScene& s, std::string& err);
// hf_record.cpp
struct Recorded { std::vector<std::string> names; uint32_t stamps{0}; };
void bindCommon(Ctx& c, bool graphics);
void dispatch(Ctx& c, const char* pso, uint32_t gx, uint32_t gy, uint32_t gz = 1, const uint32_t* pc = nullptr);
void recordFrame(Ctx& c, const hw::FrameOptions& o, Recorded& r);
void recordReference(Ctx& c, const hw::FrameOptions& o, uint32_t first, uint32_t spp, Recorded& r);
void recordPost(Ctx& c, const hw::FrameOptions& o, Recorded& r, uint32_t taaN);

}  // namespace raw::rhi::d3d12::hf
