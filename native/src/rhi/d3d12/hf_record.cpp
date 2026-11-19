// The hero frame's passes, recorded in order with a GPU timestamp after each (hf_device.hpp).
#include "hf_device.hpp"
#include <cstring>
namespace raw::rhi::d3d12::hf {
namespace {
constexpr uint32_t kCluster = 32 * 18 * 48;
void stamp(Ctx& c, Recorded& r, const char* name){ c.q.timestamp(r.stamps++); r.names.push_back(name); }
void clearStamp(Ctx& c, Recorded& r){ c.q.timestamp(r.stamps++); }
uint32_t gx(Ctx& c){ return (c.w + 7) / 8; }
uint32_t gy(Ctx& c){ return (c.h + 7) / 8; }
void copy(Ctx& c, UINT dst, UINT src){
    transition(c, c.uav[dst], D3D12_RESOURCE_STATE_COPY_DEST); transition(c, c.uav[src], D3D12_RESOURCE_STATE_COPY_SOURCE);
    c.cl->CopyResource(c.uav[dst].res.Get(), c.uav[src].res.Get());
    transition(c, c.uav[dst], D3D12_RESOURCE_STATE_UNORDERED_ACCESS); transition(c, c.uav[src], D3D12_RESOURCE_STATE_UNORDERED_ACCESS);
}
void viewport(Ctx& c){
    D3D12_VIEWPORT vp{0, 0, float(c.w), float(c.h), 0, 1}; D3D12_RECT sc{0, 0, LONG(c.w), LONG(c.h)};
    c.cl->RSSetViewports(1, &vp); c.cl->RSSetScissorRects(1, &sc);
    c.cl->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
}
void gbuffer(Ctx& c){
    for (UINT s : {0u, 1u, 2u, 3u}) transition(c, c.uav[s], D3D12_RESOURCE_STATE_RENDER_TARGET);
    D3D12_CPU_DESCRIPTOR_HANDLE rt[4] = {c.rtv(0), c.rtv(1), c.rtv(2), c.rtv(3)};
    const float zero[4] = {0, 0, 0, 0};
    for (auto& h : rt) c.cl->ClearRenderTargetView(h, zero, 0, nullptr);
    const auto dsv = c.dsvHeap->GetCPUDescriptorHandleForHeapStart();
    c.cl->ClearDepthStencilView(dsv, D3D12_CLEAR_FLAG_DEPTH, 0.0f, 0, 0, nullptr);
    c.cl->OMSetRenderTargets(4, rt, FALSE, &dsv);
    bindCommon(c, true);
    c.cl->SetPipelineState(c.gbufPso.Get());
    viewport(c);
    c.cl->DrawInstanced(c.triangles * 3, 1, 0, 0);
    for (UINT s : {0u, 1u, 2u, 3u}) transition(c, c.uav[s], D3D12_RESOURCE_STATE_UNORDERED_ACCESS);
}
// the fast GTAO's PostParams sit after the frame constants in the same upload buffer
void gtao(Ctx& c){
    const uint32_t hw = (c.w + 1) / 2, hh = (c.h + 1) / 2;
    dispatch(c, "hf_gtao_pack", (hw + 7) / 8, (hh + 7) / 8);
    uavBarrier(c);
    const uint64_t n = uint64_t(hw) * hh;
    const D3D12_GPU_VIRTUAL_ADDRESS G = c.uav[33].res->GetGPUVirtualAddress(), O = c.uav[34].res->GetGPUVirtualAddress();
    const D3D12_GPU_VIRTUAL_ADDRESS bind[5] = {G, O, G + n * 4 * 5, G + n * 4 * 7, G + n * 4};   // Z, O, D, T, N
    c.cl->SetComputeRootSignature(c.gtaoRs.Get());
    c.cl->SetComputeRootConstantBufferView(0, c.cb->GetGPUVirtualAddress() + 2048);
    for (UINT r = 0; r < 5; ++r) c.cl->SetComputeRootUnorderedAccessView(r + 1, bind[r]);
    c.cl->SetPipelineState(c.pso["hf_gtao_fpack"].Get()); c.cl->Dispatch(UINT((n + 63) / 64), 1, 1); uavBarrier(c);
    c.cl->SetPipelineState(c.pso["hf_gtao_fmain"].Get()); c.cl->Dispatch((hw + 7) / 8, (hh + 7) / 8, 1); uavBarrier(c);
    c.cl->SetPipelineState(c.pso["hf_gtao_fblur"].Get()); c.cl->Dispatch((hw + 7) / 8, (hh + 7) / 8, 1); uavBarrier(c);
    bindCommon(c, false);
    dispatch(c, "hf_gtao_unpack", gx(c), gy(c));
}
void snow(Ctx& c){
    transition(c, c.uav[13], D3D12_RESOURCE_STATE_RENDER_TARGET);
    const auto rt = c.rtv(4), dsv = c.dsvHeap->GetCPUDescriptorHandleForHeapStart();
    c.cl->OMSetRenderTargets(1, &rt, FALSE, &dsv);
    bindCommon(c, true);
    c.cl->SetPipelineState(c.snowPso.Get());
    viewport(c);
    c.cl->DrawInstanced(140000 * 6, 1, 0, 0);
    transition(c, c.uav[13], D3D12_RESOURCE_STATE_UNORDERED_ACCESS);
    bindCommon(c, false);
}
}  // namespace

void bindCommon(Ctx& c, bool graphics){
    ID3D12DescriptorHeap* heaps[] = {c.heap.Get()};
    c.cl->SetDescriptorHeaps(1, heaps);
    const D3D12_GPU_VIRTUAL_ADDRESS srv[7] = {c.tlas->GetGPUVirtualAddress(), c.verts->GetGPUVirtualAddress(), c.idx->GetGPUVirtualAddress(),
                                              c.triMat->GetGPUVirtualAddress(), c.mats->GetGPUVirtualAddress(), c.lights->GetGPUVirtualAddress(),
                                              c.smoke->GetGPUVirtualAddress()};
    // without skinned vertices the skinning slots point at the vertex buffer (bound, never read)
    const D3D12_GPU_VIRTUAL_ADDRESS vb = c.verts->GetGPUVirtualAddress();
    const D3D12_GPU_VIRTUAL_ADDRESS skin[5] = {c.prevP ? c.prevP->GetGPUVirtualAddress() : vb, vb, c.prevP ? c.prevP->GetGPUVirtualAddress() : vb,
                                               c.skinV ? c.skinV->GetGPUVirtualAddress() : vb, c.palette ? c.palette->GetGPUVirtualAddress() : vb};
    if (graphics){
        c.cl->SetGraphicsRootSignature(c.rs.Get());
        c.cl->SetGraphicsRootConstantBufferView(0, c.cb->GetGPUVirtualAddress());
        for (UINT i = 0; i < 7; ++i) c.cl->SetGraphicsRootShaderResourceView(2 + i, srv[i]);
        c.cl->SetGraphicsRootDescriptorTable(9, c.gpu(kTexBase));
        c.cl->SetGraphicsRootDescriptorTable(10, c.gpu(0));
        for (UINT i = 0; i < 5; ++i){ if (i == 1 || i == 2) c.cl->SetGraphicsRootUnorderedAccessView(11 + i, skin[i]); else c.cl->SetGraphicsRootShaderResourceView(11 + i, skin[i]); }
    } else {
        c.cl->SetComputeRootSignature(c.rs.Get());
        c.cl->SetComputeRootConstantBufferView(0, c.cb->GetGPUVirtualAddress());
        for (UINT i = 0; i < 7; ++i) c.cl->SetComputeRootShaderResourceView(2 + i, srv[i]);
        c.cl->SetComputeRootDescriptorTable(9, c.gpu(kTexBase));
        c.cl->SetComputeRootDescriptorTable(10, c.gpu(0));
        for (UINT i = 0; i < 5; ++i){ if (i == 1 || i == 2) c.cl->SetComputeRootUnorderedAccessView(11 + i, skin[i]); else c.cl->SetComputeRootShaderResourceView(11 + i, skin[i]); }
    }
}
void dispatch(Ctx& c, const char* pso, uint32_t x, uint32_t y, uint32_t z, const uint32_t* pc){
    const uint32_t zero[16] = {};
    c.cl->SetPipelineState(c.pso[pso].Get());
    c.cl->SetComputeRoot32BitConstants(1, 16, pc ? pc : zero, 0);
    c.cl->Dispatch(x, y, z);
}

void recordFrame(Ctx& c, const hw::FrameOptions& o, Recorded& r){
    bindCommon(c, false);
    clearStamp(c, r);
    recordSkin(c, &r);
    bindCommon(c, false);
    dispatch(c, "hf_cluster", (kCluster + 63) / 64, 1); uavBarrier(c); stamp(c, r, "clusters");
    gbuffer(c); stamp(c, r, "gbuffer");
    bindCommon(c, false);
    gtao(c); uavBarrier(c); stamp(c, r, "gtao");
    if (o.restir){ dispatch(c, "hf_direct_initial", gx(c), gy(c)); uavBarrier(c); }
    dispatch(c, "hf_direct_shade", gx(c), gy(c)); uavBarrier(c); stamp(c, r, "direct");
    dispatch(c, "hf_gi", gx(c), gy(c)); uavBarrier(c); stamp(c, r, "gi");
    dispatch(c, "hf_reflect", gx(c), gy(c)); uavBarrier(c); stamp(c, r, "reflect");
    dispatch(c, "hf_fog_inject", 20, 12, 96); uavBarrier(c);
    dispatch(c, "hf_fog_integrate", 20, 12, 1); uavBarrier(c); stamp(c, r, "fog");
    dispatch(c, "hf_temporal", gx(c), gy(c)); uavBarrier(c);
    for (uint32_t k = 0; k < 4; ++k){ const uint32_t pc[16] = {1u << k, k & 1u}; dispatch(c, "hf_atrous", gx(c), gy(c), 1, pc); uavBarrier(c); }
    stamp(c, r, "denoise");
    if (c.skinCount && o.skinSss){ dispatch(c, "hf_sss_h", gx(c), gy(c)); uavBarrier(c); dispatch(c, "hf_sss_v", gx(c), gy(c)); uavBarrier(c); stamp(c, r, "skin_sss"); }
    dispatch(c, "hf_composite", gx(c), gy(c)); uavBarrier(c); stamp(c, r, "composite");
    if (o.snow){ snow(c); }
    stamp(c, r, "snow");
}

void recordReference(Ctx& c, const hw::FrameOptions& o, uint32_t first, uint32_t spp, uint32_t row0, uint32_t rows, Recorded& r){
    bindCommon(c, false);
    clearStamp(c, r);
    const uint32_t pc[16] = {spp, o.referenceBounces, first, 0, 0, 0, 0, 0, row0};
    dispatch(c, "hf_pt", gx(c), (rows + 7) / 8, 1, pc); uavBarrier(c);
    stamp(c, r, "reference");
}

void recordPost(Ctx& c, const hw::FrameOptions& o, Recorded& r, uint32_t taaN){
    bindCommon(c, false);
    if (o.reference){ dispatch(c, "hf_pt_resolve", gx(c), gy(c)); uavBarrier(c); }
    const uint32_t tp[16] = {taaN};
    dispatch(c, "hf_taa", gx(c), gy(c), 1, tp); uavBarrier(c); stamp(c, r, "taa");
    for (uint32_t lv = 0; lv < 7; ++lv){ const uint32_t pc[16] = {lv}; dispatch(c, "hf_bloom_down", ((c.w >> (lv + 1)) + 7) / 8 + 1, ((c.h >> (lv + 1)) + 7) / 8 + 1, 1, pc); uavBarrier(c); }
    for (int lv = 5; lv >= 0; --lv){ const uint32_t pc[16] = {uint32_t(lv)}; dispatch(c, "hf_bloom_up", ((c.w >> (lv + 1)) + 7) / 8 + 1, ((c.h >> (lv + 1)) + 7) / 8 + 1, 1, pc); uavBarrier(c); }
    dispatch(c, "hf_tonemap", gx(c), gy(c)); uavBarrier(c); stamp(c, r, "post");
    // this frame becomes last frame
    copy(c, 30, 3); copy(c, 31, 1); copy(c, 35, 9); copy(c, 36, 10); copy(c, 14, 15);
    stamp(c, r, "history");
}

}  // namespace raw::rhi::d3d12::hf
