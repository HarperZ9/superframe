#pragma once
// A minimal D3D12 compute context for the AO comparison (bench/ao/README.md): one device on the
// chosen adapter, one queue and command list used synchronously, one shader-visible descriptor
// heap and a timestamp query heap. Textures are needed here (XeGTAO samples a depth mip chain),
// which the engine RHI's compute path does not bind, so the bench keeps its own small context.
#ifndef NOMINMAX
#define NOMINMAX   // windows.h must not define min and max over std::min and std::max
#endif
#include <d3d12.h>
#include <dxgi1_6.h>
#include <wrl/client.h>
#include <cstdint>
#include <string>
#include <vector>
namespace raw::aobench {
using Microsoft::WRL::ComPtr;

struct Dx {
    ComPtr<ID3D12Device> dev;
    ComPtr<ID3D12CommandQueue> queue;
    ComPtr<ID3D12CommandAllocator> alloc;
    ComPtr<ID3D12GraphicsCommandList> list;
    ComPtr<ID3D12Fence> fence;
    void* event{nullptr};
    uint64_t fenceValue{0};
    ComPtr<ID3D12DescriptorHeap> heap;
    uint32_t inc{0}, used{0};
    static constexpr uint32_t kHeapSize = 256, kQueries = 1024;
    ComPtr<ID3D12QueryHeap> queries;
    ComPtr<ID3D12Resource> queryReadback;
    std::string adapter, err;
    std::vector<ComPtr<ID3D12Resource>> keep;   // upload buffers alive until the next submit

    // The adapter whose description contains `want` (any hardware adapter when empty).
    bool init(const std::string& want);
    ComPtr<ID3D12Resource> buffer(uint64_t bytes, D3D12_HEAP_TYPE type, D3D12_RESOURCE_FLAGS flags, D3D12_RESOURCE_STATES state);
    ComPtr<ID3D12Resource> texture(uint32_t w, uint32_t h, DXGI_FORMAT fmt, uint16_t mips, D3D12_RESOURCE_FLAGS flags, D3D12_RESOURCE_STATES state);
    // Recorded into the open list; the source bytes are copied now.
    void uploadBuffer(ID3D12Resource* dst, const void* data, uint64_t bytes);
    void uploadTexture(ID3D12Resource* dst, const void* data, uint32_t w, uint32_t h, uint32_t texelBytes);
    // Copy into a readback buffer, submit, wait and copy out (a texture: mip 0, tightly packed).
    bool readBuffer(ID3D12Resource* src, uint64_t bytes, void* out);
    bool readTexture(ID3D12Resource* src, uint32_t w, uint32_t h, uint32_t texelBytes, void* out);
    void transition(ID3D12Resource* r, D3D12_RESOURCE_STATES from, D3D12_RESOURCE_STATES to);
    void uavBarrier();
    bool submit();   // close, execute, wait, reset the list
    // `count` consecutive descriptors in the shader-visible heap; returns the first index.
    uint32_t reserve(uint32_t count);
    D3D12_CPU_DESCRIPTOR_HANDLE cpu(uint32_t index) const;
    D3D12_GPU_DESCRIPTOR_HANDLE gpu(uint32_t index) const;
    void srvTex(uint32_t index, ID3D12Resource* r, DXGI_FORMAT fmt, uint32_t mips);
    void uavTex(uint32_t index, ID3D12Resource* r, DXGI_FORMAT fmt, uint32_t mip);
    void nullSrv(uint32_t index);
    void nullUav(uint32_t index);
    void stamp(uint32_t slot);
    bool stamps(uint32_t count, std::vector<double>& seconds);   // after submit
    bool fail(const char* what, long hr);
};

}  // namespace raw::aobench
