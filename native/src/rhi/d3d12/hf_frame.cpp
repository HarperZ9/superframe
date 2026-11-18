// The hero frame renderer (raw/rhi/hw_frame.hpp): camera, frame constants, the frame loop, the
// path-traced reference's sample loop, GPU timing and read-back.
#include "hf_device.hpp"
#include "d3d12_device.hpp"
#include "hw_accel.hpp"
#include "raw/rhi/hw.hpp"
#include <algorithm>
#include <cmath>
#include <cstring>
namespace raw::rhi::hw {
namespace {
using namespace raw::rhi::d3d12;
using M4 = std::array<double, 16>;   // row-major
M4 mul(const M4& a, const M4& b){ M4 r{}; for (int i = 0; i < 4; ++i) for (int j = 0; j < 4; ++j){ double s = 0; for (int k = 0; k < 4; ++k) s += a[i * 4 + k] * b[k * 4 + j]; r[i * 4 + j] = s; } return r; }
M4 inverse(const M4& m){
    M4 a = m, inv{}; for (int i = 0; i < 4; ++i) inv[i * 5] = 1;
    for (int c = 0; c < 4; ++c){
        int p = c; for (int r = c + 1; r < 4; ++r) if (std::fabs(a[r * 4 + c]) > std::fabs(a[p * 4 + c])) p = r;
        for (int k = 0; k < 4; ++k){ std::swap(a[c * 4 + k], a[p * 4 + k]); std::swap(inv[c * 4 + k], inv[p * 4 + k]); }
        const double d = a[c * 4 + c]; if (std::fabs(d) < 1e-30) return inv;
        for (int k = 0; k < 4; ++k){ a[c * 4 + k] /= d; inv[c * 4 + k] /= d; }
        for (int r = 0; r < 4; ++r) if (r != c){ const double f = a[r * 4 + c]; for (int k = 0; k < 4; ++k){ a[r * 4 + k] -= f * a[c * 4 + k]; inv[r * 4 + k] -= f * inv[c * 4 + k]; } }
    }
    return inv;
}
// HLSL reads a cbuffer matrix column-major: write the transpose so mul(M, v) is M times v
void put(float* dst, const M4& m){ for (int i = 0; i < 4; ++i) for (int j = 0; j < 4; ++j) dst[j * 4 + i] = float(m[i * 4 + j]); }
struct Cam { M4 view, proj, vp; double fwd[3], tanY, aspect; };
// view space: x right, y up, z forward; reverse-Z infinite projection (depth = near / z)
Cam camera(const FrameCamera& c, uint32_t w, uint32_t h, double jx, double jy){
    Cam o;
    const double cy = std::cos(c.yaw), sy = std::sin(c.yaw), cp = std::cos(c.pitch), sp = std::sin(c.pitch);
    const double f[3] = {sy * cp, sp, -cy * cp}, r[3] = {cy, 0, sy}, u[3] = {r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]};
    const double e[3] = {c.eye[0], c.eye[1], c.eye[2]};
    auto d = [&](const double* a){ return -(a[0] * e[0] + a[1] * e[1] + a[2] * e[2]); };
    o.view = {r[0], r[1], r[2], d(r), u[0], u[1], u[2], d(u), f[0], f[1], f[2], d(f), 0, 0, 0, 1};
    o.tanY = std::tan(c.fovDeg * 3.14159265358979 / 360.0); o.aspect = double(w) / h;
    const double fy = 1.0 / o.tanY, n = 0.05;
    o.proj = {fy / o.aspect, 0, 0, 0, 0, fy, 0, 0, 0, 0, 0, n, 0, 0, 1, 0};
    (void)jx; (void)jy;
    o.vp = mul(o.proj, o.view);
    std::memcpy(o.fwd, f, sizeof f);
    return o;
}
double halton(uint32_t i, uint32_t b){ double f = 1, r = 0; while (i){ f /= b; r += f * (i % b); i /= b; } return r; }

class D3d12Frame final : public FrameRenderer {
public:
    hf::Ctx c;
    FrameScene scene;     // the moon and sky constants (geometry is on the GPU)
    uint32_t frame{0}, taaN{0};
    M4 prevVP{};
    bool havePrev{false};
    std::vector<std::vector<double>> passHist;

    bool constants(const FrameCamera& cam, const FrameOptions& o, bool reset, uint32_t ptCount){
        const double jx = o.reference || !o.taa ? 0 : halton(frame % 16 + 1, 2) - 0.5, jy = o.reference || !o.taa ? 0 : halton(frame % 16 + 1, 3) - 0.5;
        const Cam k = camera(cam, c.w, c.h, jx, jy);
        hf::FrameCB f{};
        put(f.viewProj, k.vp); put(f.prevViewProj, havePrev && !reset ? prevVP : k.vp); put(f.invViewProj, inverse(k.vp)); put(f.view, k.view);
        f.eye[0] = cam.eye[0]; f.eye[1] = cam.eye[1]; f.eye[2] = cam.eye[2]; f.eye[3] = float(k.tanY);
        f.size[0] = float(c.w); f.size[1] = float(c.h); f.size[2] = 1.0f / c.w; f.size[3] = 1.0f / c.h;
        f.jitter[0] = float(jx); f.jitter[1] = float(jy);
        const double ca = std::cos(scene.moonHalfAngle);
        f.moonDir[0] = scene.moonDir[0]; f.moonDir[1] = scene.moonDir[1]; f.moonDir[2] = scene.moonDir[2]; f.moonDir[3] = float(ca);
        const float omega = float(2.0 * 3.14159265358979 * (1.0 - ca));
        // the night sky's map is bright beside the lamps; scaled so a street lamp at five metres gives
        // the street about forty times the moon's light, as a lit street at full moon does
        constexpr float kSky = 0.05f;
        f.moonRad[0] = scene.moonRadiance[0] * kSky; f.moonRad[1] = scene.moonRadiance[1] * kSky; f.moonRad[2] = scene.moonRadiance[2] * kSky; f.moonRad[3] = omega;
        f.skyParams[0] = scene.skyRotate; f.skyParams[1] = kSky; f.skyParams[2] = 0.0f; f.skyParams[3] = float(std::pow(2.0, -0.5 + o.exposureEV));
        f.cluster[0] = 0.2f; f.cluster[1] = 400.0f; f.cluster[2] = float(std::log(400.0 / 0.2)); f.cluster[3] = float(c.lightCount);
        f.fog[0] = 0.018f; f.fog[1] = 0.08f; f.fog[2] = 0.55f; f.fog[3] = 220.0f;
        uint32_t fl = (o.gi ? 1u : 0) | (o.reflect ? 2u : 0) | (o.gtao ? 4u : 0) | (o.fog ? 8u : 0) | (o.restir ? 16u : 0) | (o.snow ? 32u : 0) | (o.taa ? 64u : 0) |
                      (o.glints ? 128u : 0) | (o.sss ? 256u : 0) | (o.shadows ? 512u : 0) | (o.pom ? 1024u : 0) | (o.bloom ? 2048u : 0) | (reset ? 4096u : 0);
        f.counts[0] = frame; f.counts[1] = fl; f.counts[2] = c.skyIndex; f.counts[3] = ptCount;
        f.timeParams[0] = o.time; f.timeParams[1] = 1.1f; f.timeParams[2] = 0.35f; f.timeParams[3] = 0.15f;
        f.dbg[0] = o.debugView; f.dbg[1] = c.smokeCount;
        f.fwd[0] = float(k.fwd[0]); f.fwd[1] = float(k.fwd[1]); f.fwd[2] = float(k.fwd[2]); f.fwd[3] = float(k.aspect);
        // the fast GTAO's PostParams at 2048: size, slices, steps, refine, flags, ssr steps, pad; view; ssr (depth unpack); taa
        uint8_t* p = nullptr;
        if (FAILED(c.cb->Map(0, nullptr, reinterpret_cast<void**>(&p)))) return false;
        std::memcpy(p, &f, sizeof f);
        const uint32_t pp[8] = {(c.w + 1) / 2, (c.h + 1) / 2, 2, 6, 8, 0, 0, 0};   // half resolution; 2 slices, 6 steps
        const float pv[12] = {float(k.tanY), float(k.aspect), 0.05f, 1.2f, 1.0f, 1.0f, 0, 0, 0, 0, 0, 0};
        std::memcpy(p + 2048, pp, sizeof pp); std::memcpy(p + 2048 + 32, pv, sizeof pv);
        c.cb->Unmap(0, nullptr);
        prevVP = k.vp; havePrev = true;
        return true;
    }
    bool oneFrame(const FrameCamera& cam, const FrameOptions& o, bool reset, std::vector<double>* times, std::vector<std::string>* names, std::string& err){
        if (!constants(cam, o, reset, 0) || !c.q.begin(err)) return err.empty() ? (err = "frame constants", false) : false;
        hf::Recorded r;
        hf::recordFrame(c, o, r);
        taaN = reset ? 1 : std::min<uint32_t>(taaN + 1, 4096);
        hf::recordPost(c, o, r, o.frames > 1 ? std::max<uint32_t>(16, taaN) : 16);
        if (!c.q.submitAndWait(r.stamps, err)) return false;
        if (times){ times->clear(); for (uint32_t i = 1; i < r.stamps; ++i) times->push_back(1000.0 * double(c.q.ticks(i - 1, i)) / c.q.ticksPerSecond()); }
        if (names) *names = r.names;
        ++frame;
        return true;
    }
    bool readBack(FrameResult& R, std::string& err){
        if (!c.q.begin(err)) return false;
        auto& L = c.uav[18], &H = c.uav[15];
        hf::transition(c, L, D3D12_RESOURCE_STATE_COPY_SOURCE); hf::transition(c, H, D3D12_RESOURCE_STATE_COPY_SOURCE);
        for (int k = 0; k < 2; ++k){
            hf::Target& t = k ? H : L;
            D3D12_TEXTURE_COPY_LOCATION s{}; s.pResource = t.res.Get(); s.Type = D3D12_TEXTURE_COPY_TYPE_SUBRESOURCE_INDEX;
            D3D12_TEXTURE_COPY_LOCATION d{}; d.pResource = (k ? c.readHdr : c.readLdr).Get(); d.Type = D3D12_TEXTURE_COPY_TYPE_PLACED_FOOTPRINT;
            d.PlacedFootprint.Footprint = {t.fmt, c.w, c.h, 1, (c.w * (k ? 8u : 4u) + 255u) & ~255u};
            c.cl->CopyTextureRegion(&d, 0, 0, 0, &s, nullptr);
        }
        hf::transition(c, L, D3D12_RESOURCE_STATE_UNORDERED_ACCESS); hf::transition(c, H, D3D12_RESOURCE_STATE_UNORDERED_ACCESS);
        if (!c.q.submitAndWait(0, err)) return false;
        const uint32_t pl = (c.w * 4 + 255) & ~255u, ph = (c.w * 8 + 255) & ~255u;
        std::vector<uint8_t> a(size_t(pl) * c.h), b(size_t(ph) * c.h);
        if (!c.q.readBack(c.readLdr.Get(), a.data(), a.size(), err) || !c.q.readBack(c.readHdr.Get(), b.data(), b.size(), err)) return false;
        R.ldr.resize(size_t(c.w) * c.h * 4); R.hdr.resize(size_t(c.w) * c.h * 4);
        for (uint32_t y = 0; y < c.h; ++y){
            std::memcpy(&R.ldr[size_t(y) * c.w * 4], &a[size_t(y) * pl], size_t(c.w) * 4);
            const uint16_t* row = reinterpret_cast<const uint16_t*>(&b[size_t(y) * ph]);
            for (uint32_t x = 0; x < c.w * 4; ++x){ const uint16_t hbits = row[x]; const uint32_t sg = (hbits & 0x8000u) << 16, e = (hbits >> 10) & 0x1F, m = hbits & 0x3FF;
                uint32_t bits = e == 0 ? sg : e == 31 ? (sg | 0x7F800000u | (m << 13)) : (sg | ((e + 112) << 23) | (m << 13)); float fv; std::memcpy(&fv, &bits, 4); R.hdr[size_t(y) * c.w * 4 + x] = fv; }
        }
        return true;
    }
    void stats(FrameResult& R){
        R.buildMs = c.buildMs; R.triangles = c.triangles; R.blasBytes = c.blasBytes; R.tlasBytes = c.tlasBytes; R.textureBytes = c.texBytes; R.targetBytes = c.targetBytes;
    }
    FrameResult render(const FrameCamera& cam, const FrameOptions& o) override;
    FrameResult step(const FrameCamera& cam, const FrameOptions& o) override;
};

FrameResult D3d12Frame::render(const FrameCamera& cam, const FrameOptions& o){
    FrameResult R; stats(R);
    if (o.width != c.w || o.height != c.h){ R.error = "the renderer was made for another size"; return R; }
    if (o.reference){
        uint32_t done = 0;
        const uint32_t per = 1;
        double total = 0;
        while (done < o.referenceSpp){
            const uint32_t n = std::min(per, o.referenceSpp - done);
            if (!constants(cam, o, done == 0, done)) return R;
            const uint32_t band = 272;   // rows a submission, a multiple of 8
            for (uint32_t row = 0; row < c.h; row += band){
                if (!c.q.begin(R.error)) return R;
                hf::Recorded r; hf::recordReference(c, o, done, n, row, std::min(band, c.h - row), r);
                if (!c.q.submitAndWait(r.stamps, R.error)) return R;
                total += 1000.0 * double(c.q.ticks(0, 1)) / c.q.ticksPerSecond();
            }
            done += n;
        }
        if (!c.q.begin(R.error)) return R;
        hf::Recorded r; hf::recordPost(c, o, r, 1);
        if (!c.q.submitAndWait(r.stamps, R.error)) return R;
        R.passes.push_back({"reference", total});
        R.frameMs = total;
    } else {
        std::vector<std::vector<double>> times;
        std::vector<std::string> names;
        for (uint32_t k = 0; k < std::max(1u, o.frames); ++k){
            std::vector<double> t;
            if (!oneFrame(cam, o, k == 0, &t, &names, R.error)) return R;
            if (k + 16 >= o.frames) times.push_back(t);    // the last frames, for medians
        }
        for (size_t i = 0; i < names.size(); ++i){
            std::vector<double> v; for (auto& t : times) if (i < t.size()) v.push_back(t[i]);
            std::sort(v.begin(), v.end());
            R.passes.push_back({names[i], v.empty() ? 0 : v[v.size() / 2]});
            R.frameMs += v.empty() ? 0 : v[v.size() / 2];
        }
    }
    if (!readBack(R, R.error)) return R;
    R.ran = true;
    return R;
}
FrameResult D3d12Frame::step(const FrameCamera& cam, const FrameOptions& o){
    FrameResult R; stats(R);
    std::vector<double> t; std::vector<std::string> names;
    if (!oneFrame(cam, o, false, &t, &names, R.error) || !readBack(R, R.error)) return R;
    for (size_t i = 0; i < names.size() && i < t.size(); ++i){ R.passes.push_back({names[i], t[i]}); R.frameMs += t[i]; }
    R.ran = true;
    return R;
}
}  // namespace

std::unique_ptr<FrameRenderer> FrameRenderer::create(Device& dev, const FrameScene& s, uint32_t width, uint32_t height, std::string& err){
    auto f = std::make_unique<D3d12Frame>();
    ID3D12Device* d = static_cast<d3d12::D3d12Device&>(dev).d3d();
    if (!d3d12::hwRayQueryOn(d)){ err = disabled(kRayQuery) ? "ray query forced off" : "the device has no DXR tier 1.1"; return nullptr; }
    f->scene.moonHalfAngle = s.moonHalfAngle; f->scene.skyRotate = s.skyRotate;
    std::memcpy(f->scene.moonDir, s.moonDir, sizeof s.moonDir); std::memcpy(f->scene.moonRadiance, s.moonRadiance, sizeof s.moonRadiance);
    if (!hf::initDevice(f->c, d, err) || !hf::uploadScene(f->c, s, err) || !hf::rootSignatures(f->c, err) || !hf::pipelines(f->c, err) ||
        !hf::makeTargets(f->c, width, height, err)) return nullptr;
    return f;
}

}  // namespace raw::rhi::hw
