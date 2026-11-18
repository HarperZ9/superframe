// The host-frame check: see raw/renderer/host_frame.hpp. No D3D12 header: the host's side
// is raw/rhi/host_rig.hpp, the renderer's side is the RHI.
#include "raw/renderer/host_frame.hpp"
#include "raw/renderer/post.hpp"
#include "raw/renderer/raster.hpp"
#include "raw/rhi/host.hpp"
#include "raw/rhi/host_rig.hpp"
#include "raw/scene/scene.hpp"
#include "gpu_util.hpp"
#include "post_params.hpp"
#include "shaders/post_layout.hpp"
#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstring>
namespace raw::gpu_check {
namespace {
using namespace util;
using rhi::Access;
using rhi::BufferUsage;
using rhi::TextureFormat;
using rhi::TextureState;
using rhi::WaitResult;
// Fence values. The control's pair comes first, so the frame after it also shows that the
// queue works again once the host released it.
constexpr uint64_t kNever = 1000, kAfterNever = 1001, kProduced = 1002, kRendered = 1003;
constexpr uint32_t kFrameMs = 120000;   // WARP runs GTAO on the CPU

struct Imports { rhi::TextureHandle depth, pos, nrm, target; };
struct PackParams { uint32_t width, height, depthStride, wideStride; };

// One recorded submission that only reads `t`: the smallest frame that needs its state.
bool recordRead(rhi::Device& dev, Gpu& gpu, rhi::TextureHandle t, int size, std::string& err) {
    const rhi::BufferHandle b = gpu.make(uint64_t(rhi::textureRowPitch(uint32_t(size), TextureFormat::R32Float)) * uint32_t(size),
                                         BufferUsage::Storage | BufferUsage::CopyDst, "host read");
    rhi::CommandList* c = gpu.err.empty() ? dev.begin(gpu.err) : nullptr;
    if (!c) { err = gpu.err; return false; }
    const rhi::BufferBarrier in[1] = {{b, Access::Undefined, Access::CopyDst}};
    c->barrier(in);
    c->copyTextureToBuffer(t, b);
    return dev.endRecording(err);
}
// The frame: the host's three planes into buffers, interleaved, post_gtao, and its output
// drawn into the host's target. Recorded and closed; nothing is queued.
bool recordFrame(rhi::Device& dev, Gpu& gpu, const Imports& im, const post::ViewGBuffer& v, std::string& err) {
    const uint32_t w = uint32_t(v.w), h = uint32_t(v.h), n = w * h;
    const uint32_t thin = rhi::textureRowPitch(w, TextureFormat::R32Float), wide = rhi::textureRowPitch(w, TextureFormat::RGBA32Float);
    static constexpr rhi::Binding packLayout[5] = {rhi::Binding::Uniform, rhi::Binding::StorageRead, rhi::Binding::StorageRead,
                                                   rhi::Binding::StorageRead, rhi::Binding::StorageReadWrite};
    static constexpr rhi::RasterBinding resolveLayout[2] = {rhi::RasterBinding::Uniform, rhi::RasterBinding::StorageRead};
    const rhi::PipelineHandle pack = dev.createComputePipeline({"host_pack", rhi::host_rig::shader("host_pack"), packLayout}, gpu.err);
    const auto& L = post_passes::kPasses[0];
    const rhi::PipelineHandle gtao = gpu.err.empty() ? compute(dev, L.name, L.binds, L.bindCount, gpu.err) : rhi::PipelineHandle{};
    rhi::RasterPipelineDesc rd;
    rd.label = "host_resolve"; rd.vertex = rhi::host_rig::shader("host_resolve_vs"); rd.fragment = rhi::host_rig::shader("host_resolve_fs");
    rd.layout = resolveLayout; rd.targets[0] = TextureFormat::R32Float;
    const rhi::RasterPipelineHandle resolve = gpu.err.empty() ? dev.createRasterPipeline(rd, gpu.err) : rhi::RasterPipelineHandle{};
    const PackParams pp{w, h, thin / 4, wide / 4};
    const PostParamsGpu gp = params(v.w, v.h, v.tanHalf, v.aspect, v.nearZ, 0);
    const rhi::BufferHandle up = gpu.upload(&pp, sizeof pp, BufferUsage::Uniform, "host pack params");
    const rhi::BufferHandle ug = gpu.upload(&gp, sizeof gp, BufferUsage::Uniform, "post params");
    const rhi::BufferHandle ur = gpu.upload(&pp, sizeof pp, BufferUsage::Uniform, "host resolve params");
    const rhi::BufferHandle db = gpu.make(uint64_t(thin) * h, BufferUsage::Storage | BufferUsage::CopyDst, "host depth");
    const rhi::BufferHandle pb = gpu.make(uint64_t(wide) * h, BufferUsage::Storage | BufferUsage::CopyDst, "host position");
    const rhi::BufferHandle nb = gpu.make(uint64_t(wide) * h, BufferUsage::Storage | BufferUsage::CopyDst, "host normal");
    const rhi::BufferHandle gb = gpu.make(uint64_t(n) * 32, BufferUsage::Storage, "view gbuffer");
    const rhi::BufferHandle ob = gpu.make(uint64_t(n) * 4, BufferUsage::Storage, "post out");
    rhi::CommandList* c = gpu.err.empty() ? dev.begin(gpu.err) : nullptr;
    if (!c) { err = gpu.err; return false; }
    for (auto& f : gpu.pre) f(*c);
    gpu.pre.clear();
    const rhi::BufferBarrier a[6] = {{up, Access::CopyDst, Access::Uniform}, {ug, Access::CopyDst, Access::Uniform}, {ur, Access::CopyDst, Access::Uniform},
                                     {db, Access::Undefined, Access::CopyDst}, {pb, Access::Undefined, Access::CopyDst}, {nb, Access::Undefined, Access::CopyDst}};
    c->barrier(a);
    c->copyTextureToBuffer(im.depth, db);
    c->copyTextureToBuffer(im.pos, pb);
    c->copyTextureToBuffer(im.nrm, nb);
    const rhi::BufferBarrier b[4] = {{db, Access::CopyDst, Access::StorageRead}, {pb, Access::CopyDst, Access::StorageRead},
                                     {nb, Access::CopyDst, Access::StorageRead}, {gb, Access::Undefined, Access::StorageWrite}};
    c->barrier(b);
    const rhi::BufferHandle packBinds[5] = {up, db, pb, nb, gb};
    c->dispatch(pack, packBinds, (n + 63) / 64, 1, 1);
    const rhi::BufferBarrier d[2] = {{gb, Access::StorageWrite, Access::StorageRead}, {ob, Access::Undefined, Access::StorageWrite}};
    c->barrier(d);
    const rhi::BufferHandle gtaoBinds[3] = {ug, gb, ob};
    c->dispatch(gtao, gtaoBinds, postGroupsX(n), postGroupsY(n), 1);
    const rhi::BufferBarrier e[1] = {{ob, Access::StorageWrite, Access::StorageRead}};
    c->barrier(e);
    rhi::RenderPassDesc rp;
    rp.color[0].texture = im.target;
    c->beginRenderPass(rp);
    const rhi::RasterBind draw[2] = {{ur, {}, {}}, {ob, {}, {}}};
    c->draw(resolve, draw, 3);
    c->endRenderPass();
    return dev.endRecording(err);
}
// The host's target against the CPU reference, post_parity's way: pixels with geometry only.
void compare(const std::vector<uint8_t>& bytes, const post::ViewGBuffer& v, const std::vector<double>& ref, long& pixels, long& outside, double& worst) {
    pixels = outside = 0; worst = 0.0;
    for (std::size_t i = 0; i < ref.size(); ++i) {
        if (v.depth[i] < 0.0f) continue;
        float f; std::memcpy(&f, bytes.data() + i * 4, 4);
        const double err = std::fabs(double(f) - ref[i]);
        ++pixels; worst = std::max(worst, err); outside += err > 1e-3;
    }
}
}  // namespace

bool HostFrame::pass() const {
    return error.empty() && skipped.empty() && adoptRefusesNothing && sameAdapter && importRefusesWrongFormat && frame() && fenceSignalled &&
           targetBeforeDiffers && unsignalledTimesOut && unsignalledBlocksBegin && releasedRetires && rightStatePasses && wrongStateFails &&
           texturesSurvive && hostObjectsReleased;
}

HostFrame hostFrame(int size) {
    HostFrame r; r.size = size;
    const std::unique_ptr<rhi::host_rig::Rig> rig = rhi::host_rig::Rig::create(r.skipped);
    if (!rig) return r;
    r.hostAdapter = rig->adapter();
    const Scene s = buildTestScene(size, size);
    RasterOptions ro; ro.perspectiveDepth = true;
    const post::ViewGBuffer v = post::viewGBuffer(rasterize(s, size, size, nullptr, nullptr, ro), s.camera);
    const std::vector<double> ref = post::gtao(v);
    const std::size_t n = std::size_t(size) * std::size_t(size);
    std::vector<float> pos(n * 4, 0.0f), nrm(n * 4, 0.0f), empty(n, -1.0f);
    for (std::size_t i = 0; i < n; ++i) for (std::size_t k = 0; k < 3; ++k) { pos[i * 4 + k] = v.pos[i * 3 + k]; nrm[i * 4 + k] = v.nrm[i * 3 + k]; }

    // The host's objects. The depth starts empty: the producer writes the real depth only
    // after the RHI has recorded the frame, and signals the fence after that write.
    const uint32_t w = uint32_t(size);
    rhi::HostDevice host = rig->host();
    host.retireTimeoutMs = 250;
    void* const depth = rig->texture(w, w, TextureFormat::R32Float, false, TextureState::Common, empty.data(), r.error);
    void* const posT = depth ? rig->texture(w, w, TextureFormat::RGBA32Float, false, TextureState::ShaderResource, pos.data(), r.error) : nullptr;
    void* const nrmT = posT ? rig->texture(w, w, TextureFormat::RGBA32Float, false, TextureState::CopySrc, nrm.data(), r.error) : nullptr;
    void* const target = nrmT ? rig->texture(w, w, TextureFormat::R32Float, true, TextureState::Common, nullptr, r.error) : nullptr;
    void* const stateT = target ? rig->texture(w, w, TextureFormat::R32Float, true, TextureState::RenderTarget, nullptr, r.error) : nullptr;
    if (!stateT) return r;
    void* const all[5] = {depth, posT, nrmT, target, stateT};
    unsigned long textureRefs[5];
    for (int k = 0; k < 5; ++k) textureRefs[k] = rig->references(all[k]);
    // Counted once the textures exist: each of them holds a reference on its device.
    const unsigned long deviceRefs = rig->references(host.device), queueRefs = rig->references(host.queue), fenceRefs = rig->references(rig->fence());
    std::vector<uint8_t> before, after, again;
    long px = 0, off = 0; double worst = 0.0;
    std::string e;
    {
        r.adoptRefusesNothing = !rhi::adoptDevice(rhi::HostDevice{}, e);
        const std::unique_ptr<rhi::Device> dev = rhi::adoptDevice(host, r.error);
        if (!dev) return r;
        r.backend = dev->backendName(); r.adapter = dev->adapter().description;
        r.sameAdapter = !r.adapter.empty() && r.adapter == r.hostAdapter;
        Gpu gpu(*dev);
        r.importRefusesWrongFormat = !dev->importTexture({depth, TextureFormat::RGBA8Unorm, rhi::TextureUsage::None, TextureState::Common}, e).valid();
        Imports im;
        im.depth = dev->importTexture({depth, TextureFormat::R32Float, rhi::TextureUsage::None, TextureState::Common}, r.error);
        im.pos = dev->importTexture({posT, TextureFormat::RGBA32Float, rhi::TextureUsage::None, TextureState::ShaderResource}, r.error);
        im.nrm = dev->importTexture({nrmT, TextureFormat::RGBA32Float, rhi::TextureUsage::None, TextureState::CopySrc}, r.error);
        im.target = dev->importTexture({target, TextureFormat::R32Float, rhi::TextureUsage::RenderTarget, TextureState::Common}, r.error);
        if (!im.depth.valid() || !im.pos.valid() || !im.nrm.valid() || !im.target.valid()) return r;

        // Control: the queue waits on a value nobody signals.
        if (!recordRead(*dev, gpu, im.depth, size, r.error) || !dev->submit({rig->fence(), true, kNever, true, kAfterNever}, r.error)) return r;
        const auto t0 = std::chrono::steady_clock::now();
        const WaitResult stuck = dev->retire(750, e);
        r.unsignalledWaitMs = uint32_t(std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0).count());
        r.unsignalledTimesOut = stuck == WaitResult::TimedOut && rig->completed() < kNever;
        r.unsignalledBlocksBegin = dev->begin(e) == nullptr;
        rig->cpuSignal(kNever);
        r.releasedRetires = dev->retire(kFrameMs, e) == WaitResult::Done && rig->completed() == kAfterNever;
        if (!r.releasedRetires) { r.error = "the queue did not recover after the host signalled: " + e; return r; }

        // Control: the target as the host left it, before any pass.
        if (!rig->readback(target, TextureState::Common, before, r.error)) return r;
        compare(before, v, ref, px, off, worst);
        r.targetBeforeDiffers = double(off) > 1e-3 * double(px);

        // The frame: recorded first, sent after the producer wrote the depth and signalled.
        if (!recordFrame(*dev, gpu, im, v, r.error)) return r;
        if (!rig->fill(depth, TextureState::Common, v.depth.data(), r.error) || !rig->producerSignal(kProduced, r.error)) return r;
        if (!dev->submit({rig->fence(), true, kProduced, true, kRendered}, r.error)) return r;
        if (dev->retire(kFrameMs, r.error) != WaitResult::Done) return r;
        r.fenceSignalled = rig->completed() == kRendered;
        if (!rig->readback(target, TextureState::Common, after, r.error)) return r;
        compare(after, v, ref, r.pixels, r.gtaoOutside, r.gtaoWorst);

        // Control: one texture the host keeps as a render target, read with the right stated
        // state and then with a wrong one. Only the debug layer can tell them apart.
        const rhi::TextureHandle right = dev->importTexture({stateT, TextureFormat::R32Float, rhi::TextureUsage::None, TextureState::RenderTarget}, r.error);
        if (!right.valid() || !recordRead(*dev, gpu, right, size, r.error) || !dev->submit({}, r.error)) return r;
        r.rightStatePasses = dev->retire(kFrameMs, r.error) == WaitResult::Done;
        dev->destroyTexture(right);
        if (!r.rightStatePasses) return r;
        const rhi::TextureHandle wrong = dev->importTexture({stateT, TextureFormat::R32Float, rhi::TextureUsage::None, TextureState::Common}, r.error);
        if (!wrong.valid() || !recordRead(*dev, gpu, wrong, size, r.error) || !dev->submit({}, r.error)) return r;
        r.wrongStateFails = dev->retire(kFrameMs, r.wrongStateMessage) == WaitResult::Failed && r.wrongStateMessage.find("debug layer") != std::string::npos;
        dev->destroyTexture(wrong);
        for (rhi::TextureHandle h : {im.depth, im.pos, im.nrm, im.target}) dev->destroyTexture(h);
    }
    // The RHI device is gone. The host still owns everything it handed over.
    r.texturesSurvive = rig->readback(target, TextureState::Common, again, r.error) && again == after;
    for (int k = 0; k < 5; ++k) r.texturesSurvive = r.texturesSurvive && rig->references(all[k]) == textureRefs[k];
    r.hostObjectsReleased = rig->references(host.device) == deviceRefs && rig->references(host.queue) == queueRefs && rig->references(rig->fence()) == fenceRefs;
    return r;
}
}  // namespace raw::gpu_check
