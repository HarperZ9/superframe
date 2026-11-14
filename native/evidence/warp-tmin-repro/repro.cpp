// One-triangle WARP RayQuery TMin repro. Build: cl /EHsc /O2 repro.cpp
// Run: repro.exe <path-to-cs.cso> [warp|hw] [debug]
#include <windows.h>
#include <d3d12.h>
#include <dxgi1_6.h>
#include <cstdio>
#include <cstring>
#include <vector>
#pragma comment(lib, "d3d12.lib")
#pragma comment(lib, "dxgi.lib")

#define CK(x) do { HRESULT hr_ = (x); if (FAILED(hr_)) { std::printf("FAIL 0x%08lx at %s:%d: %s\n", (unsigned long)hr_, __FILE__, __LINE__, #x); return 2; } } while (0)

static ID3D12Resource* buf(ID3D12Device* d, UINT64 size, D3D12_HEAP_TYPE heap, D3D12_RESOURCE_FLAGS fl, D3D12_RESOURCE_STATES st) {
    D3D12_HEAP_PROPERTIES hp = {}; hp.Type = heap;
    D3D12_RESOURCE_DESC rd = {}; rd.Dimension = D3D12_RESOURCE_DIMENSION_BUFFER; rd.Width = size; rd.Height = 1;
    rd.DepthOrArraySize = 1; rd.MipLevels = 1; rd.SampleDesc.Count = 1; rd.Layout = D3D12_TEXTURE_LAYOUT_ROW_MAJOR; rd.Flags = fl;
    ID3D12Resource* r = nullptr;
    if (FAILED(d->CreateCommittedResource(&hp, D3D12_HEAP_FLAG_NONE, &rd, st, nullptr, IID_PPV_ARGS(&r)))) return nullptr;
    return r;
}
static void upload(ID3D12Resource* r, const void* src, size_t n) { void* p; r->Map(0, nullptr, &p); std::memcpy(p, src, n); r->Unmap(0, nullptr); }
static float fbits(unsigned u) { float f; std::memcpy(&f, &u, 4); return f; }

int main(int argc, char** argv) {
    if (argc < 2) { std::printf("usage: repro <cs.cso> [warp|hw] [debug]\n"); return 1; }
    bool warp = !(argc > 2 && std::strcmp(argv[2], "hw") == 0);
    bool debug = argc > 3 && std::strcmp(argv[3], "debug") == 0;
    FILE* f = std::fopen(argv[1], "rb"); if (!f) { std::printf("no shader\n"); return 1; }
    std::vector<char> cso; char tmp[4096]; size_t n; while ((n = std::fread(tmp, 1, sizeof tmp, f)) > 0) cso.insert(cso.end(), tmp, tmp + n); std::fclose(f);

    if (debug) { ID3D12Debug* dbg; if (SUCCEEDED(D3D12GetDebugInterface(IID_PPV_ARGS(&dbg)))) dbg->EnableDebugLayer(); }
    IDXGIFactory4* fac; CK(CreateDXGIFactory2(0, IID_PPV_ARGS(&fac)));
    IDXGIAdapter1* ad = nullptr;
    if (warp) CK(fac->EnumWarpAdapter(IID_PPV_ARGS(&ad))); else CK(fac->EnumAdapters1(0, &ad));
    DXGI_ADAPTER_DESC1 desc; ad->GetDesc1(&desc);
    LARGE_INTEGER umd = {}; ad->CheckInterfaceSupport(__uuidof(IDXGIDevice), &umd);
    std::printf("adapter: %ls  umd %u.%u.%u.%u  debug=%d\n", desc.Description, HIWORD(umd.HighPart), LOWORD(umd.HighPart), HIWORD(umd.LowPart), LOWORD(umd.LowPart), debug);
    ID3D12Device5* dev; CK(D3D12CreateDevice(ad, D3D_FEATURE_LEVEL_12_1, IID_PPV_ARGS(&dev)));
    D3D12_FEATURE_DATA_D3D12_OPTIONS5 o5 = {}; dev->CheckFeatureSupport(D3D12_FEATURE_D3D12_OPTIONS5, &o5, sizeof o5);
    std::printf("raytracing tier: 0x%x\n", (unsigned)o5.RaytracingTier);
    if (o5.RaytracingTier < D3D12_RAYTRACING_TIER_1_1) { std::printf("no DXR 1.1\n"); return 3; }

    D3D12_COMMAND_QUEUE_DESC qd = {}; qd.Type = D3D12_COMMAND_LIST_TYPE_DIRECT;
    ID3D12CommandQueue* q; CK(dev->CreateCommandQueue(&qd, IID_PPV_ARGS(&q)));
    ID3D12CommandAllocator* ca; CK(dev->CreateCommandAllocator(D3D12_COMMAND_LIST_TYPE_DIRECT, IID_PPV_ARGS(&ca)));
    ID3D12GraphicsCommandList4* cl; CK(dev->CreateCommandList(0, D3D12_COMMAND_LIST_TYPE_DIRECT, ca, nullptr, IID_PPV_ARGS(&cl)));

    const unsigned vb[9] = { 0x3f4f01c0, 0xbf123714, 0x3fe1126a, 0x3f3ee41c, 0xbf0af7ab, 0x3fd852a2, 0x3f614056, 0xbeddd5af, 0x3fd73ef1 };
    ID3D12Resource* vbuf = buf(dev, sizeof vb, D3D12_HEAP_TYPE_UPLOAD, D3D12_RESOURCE_FLAG_NONE, D3D12_RESOURCE_STATE_GENERIC_READ);
    upload(vbuf, vb, sizeof vb);

    D3D12_RAYTRACING_GEOMETRY_DESC g = {}; g.Type = D3D12_RAYTRACING_GEOMETRY_TYPE_TRIANGLES; g.Flags = D3D12_RAYTRACING_GEOMETRY_FLAG_OPAQUE;
    g.Triangles.VertexFormat = DXGI_FORMAT_R32G32B32_FLOAT; g.Triangles.VertexCount = 3;
    g.Triangles.VertexBuffer.StartAddress = vbuf->GetGPUVirtualAddress(); g.Triangles.VertexBuffer.StrideInBytes = 12;
    D3D12_BUILD_RAYTRACING_ACCELERATION_STRUCTURE_INPUTS bi = {}; bi.Type = D3D12_RAYTRACING_ACCELERATION_STRUCTURE_TYPE_BOTTOM_LEVEL;
    bi.DescsLayout = D3D12_ELEMENTS_LAYOUT_ARRAY; bi.NumDescs = 1; bi.pGeometryDescs = &g;
    D3D12_RAYTRACING_ACCELERATION_STRUCTURE_PREBUILD_INFO pb = {}; dev->GetRaytracingAccelerationStructurePrebuildInfo(&bi, &pb);
    ID3D12Resource* blas = buf(dev, pb.ResultDataMaxSizeInBytes, D3D12_HEAP_TYPE_DEFAULT, D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS, D3D12_RESOURCE_STATE_RAYTRACING_ACCELERATION_STRUCTURE);
    ID3D12Resource* s1 = buf(dev, pb.ScratchDataSizeInBytes, D3D12_HEAP_TYPE_DEFAULT, D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS, D3D12_RESOURCE_STATE_UNORDERED_ACCESS);

    D3D12_RAYTRACING_INSTANCE_DESC inst = {}; inst.Transform[0][0] = inst.Transform[1][1] = inst.Transform[2][2] = 1.0f;
    inst.InstanceMask = 0xFF; inst.AccelerationStructure = blas->GetGPUVirtualAddress();
    ID3D12Resource* ibuf = buf(dev, sizeof inst, D3D12_HEAP_TYPE_UPLOAD, D3D12_RESOURCE_FLAG_NONE, D3D12_RESOURCE_STATE_GENERIC_READ);
    upload(ibuf, &inst, sizeof inst);
    D3D12_BUILD_RAYTRACING_ACCELERATION_STRUCTURE_INPUTS ti = {}; ti.Type = D3D12_RAYTRACING_ACCELERATION_STRUCTURE_TYPE_TOP_LEVEL;
    ti.DescsLayout = D3D12_ELEMENTS_LAYOUT_ARRAY; ti.NumDescs = 1; ti.InstanceDescs = ibuf->GetGPUVirtualAddress();
    D3D12_RAYTRACING_ACCELERATION_STRUCTURE_PREBUILD_INFO tp = {}; dev->GetRaytracingAccelerationStructurePrebuildInfo(&ti, &tp);
    ID3D12Resource* tlas = buf(dev, tp.ResultDataMaxSizeInBytes, D3D12_HEAP_TYPE_DEFAULT, D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS, D3D12_RESOURCE_STATE_RAYTRACING_ACCELERATION_STRUCTURE);
    ID3D12Resource* s2 = buf(dev, tp.ScratchDataSizeInBytes, D3D12_HEAP_TYPE_DEFAULT, D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS, D3D12_RESOURCE_STATE_UNORDERED_ACCESS);

    const int NOUT = 8;
    ID3D12Resource* out = buf(dev, NOUT * 4, D3D12_HEAP_TYPE_DEFAULT, D3D12_RESOURCE_FLAG_ALLOW_UNORDERED_ACCESS, D3D12_RESOURCE_STATE_UNORDERED_ACCESS);
    ID3D12Resource* rb = buf(dev, NOUT * 4, D3D12_HEAP_TYPE_READBACK, D3D12_RESOURCE_FLAG_NONE, D3D12_RESOURCE_STATE_COPY_DEST);
    if (!blas || !s1 || !tlas || !s2 || !out || !rb) { std::printf("alloc failed\n"); return 2; }

    D3D12_ROOT_PARAMETER rp[2] = {};
    rp[0].ParameterType = D3D12_ROOT_PARAMETER_TYPE_SRV; rp[0].Descriptor.ShaderRegister = 0;
    rp[1].ParameterType = D3D12_ROOT_PARAMETER_TYPE_UAV; rp[1].Descriptor.ShaderRegister = 0;
    D3D12_ROOT_SIGNATURE_DESC rsd = {}; rsd.NumParameters = 2; rsd.pParameters = rp;
    ID3DBlob* sig; ID3DBlob* err = nullptr; CK(D3D12SerializeRootSignature(&rsd, D3D_ROOT_SIGNATURE_VERSION_1, &sig, &err));
    ID3D12RootSignature* rs; CK(dev->CreateRootSignature(0, sig->GetBufferPointer(), sig->GetBufferSize(), IID_PPV_ARGS(&rs)));
    D3D12_COMPUTE_PIPELINE_STATE_DESC pd = {}; pd.pRootSignature = rs; pd.CS.pShaderBytecode = cso.data(); pd.CS.BytecodeLength = cso.size();
    ID3D12PipelineState* pso; CK(dev->CreateComputePipelineState(&pd, IID_PPV_ARGS(&pso)));

    D3D12_BUILD_RAYTRACING_ACCELERATION_STRUCTURE_DESC bd = {}; bd.Inputs = bi; bd.DestAccelerationStructureData = blas->GetGPUVirtualAddress(); bd.ScratchAccelerationStructureData = s1->GetGPUVirtualAddress();
    cl->BuildRaytracingAccelerationStructure(&bd, 0, nullptr);
    D3D12_RESOURCE_BARRIER ub = {}; ub.Type = D3D12_RESOURCE_BARRIER_TYPE_UAV; ub.UAV.pResource = blas; cl->ResourceBarrier(1, &ub);
    D3D12_BUILD_RAYTRACING_ACCELERATION_STRUCTURE_DESC td = {}; td.Inputs = ti; td.DestAccelerationStructureData = tlas->GetGPUVirtualAddress(); td.ScratchAccelerationStructureData = s2->GetGPUVirtualAddress();
    cl->BuildRaytracingAccelerationStructure(&td, 0, nullptr);
    ub.UAV.pResource = tlas; cl->ResourceBarrier(1, &ub);
    cl->SetComputeRootSignature(rs); cl->SetPipelineState(pso);
    cl->SetComputeRootShaderResourceView(0, tlas->GetGPUVirtualAddress());
    cl->SetComputeRootUnorderedAccessView(1, out->GetGPUVirtualAddress());
    cl->Dispatch(1, 1, 1);
    D3D12_RESOURCE_BARRIER tb = {}; tb.Type = D3D12_RESOURCE_BARRIER_TYPE_TRANSITION; tb.Transition.pResource = out;
    tb.Transition.StateBefore = D3D12_RESOURCE_STATE_UNORDERED_ACCESS; tb.Transition.StateAfter = D3D12_RESOURCE_STATE_COPY_SOURCE;
    tb.Transition.Subresource = D3D12_RESOURCE_BARRIER_ALL_SUBRESOURCES; cl->ResourceBarrier(1, &tb);
    cl->CopyResource(rb, out); CK(cl->Close());
    ID3D12CommandList* lists[] = { cl }; q->ExecuteCommandLists(1, lists);
    ID3D12Fence* fe; CK(dev->CreateFence(0, D3D12_FENCE_FLAG_NONE, IID_PPV_ARGS(&fe))); CK(q->Signal(fe, 1));
    HANDLE ev = CreateEventA(nullptr, FALSE, FALSE, nullptr); fe->SetEventOnCompletion(1, ev); WaitForSingleObject(ev, 30000);
    CK(dev->GetDeviceRemovedReason());
    float* r; rb->Map(0, nullptr, (void**)&r);
    const char* names[NOUT] = { "oblique TMin=1e-4", "oblique TMin=1e-3", "oblique TMin=0 (control)", "axis-aligned t~5e-5 TMin=1e-4", "axis-aligned t~0.5 TMin=1.0", "axis-aligned t~0.5 TMin=0.49", "oblique t~0.5 TMin=1.0", "axis-aligned t~5e-3 TMin=1e-2" };
    for (int i = 0; i < NOUT; ++i) { unsigned u; std::memcpy(&u, &r[i], 4); std::printf("%-34s committedT = %.7g [%08x]%s\n", names[i], r[i], u, r[i] < 0 ? "  (no hit)" : ""); }
    rb->Unmap(0, nullptr);
    return 0;
}
