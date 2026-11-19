// The character shots of lw_frame (lwframe.hpp): Lamb (the cast's first person) and the
// townspeople in the street from the follow camera, a head-and-shoulders close-up under a street
// lamp, a turntable and a walk; the close-up path traced for FLIP; the GPU skinning checked against
// the CPU reference (raw/scene/skin.hpp) on the same palette.
#include "lwframe.hpp"
#include "raw/platform/image_codec.hpp"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <filesystem>
namespace raw::lwframe {
namespace {
using V3 = anim::Vec3d;
V3 sub(V3 a, V3 b){ return {a[0] - b[0], a[1] - b[1], a[2] - b[2]}; }
V3 add(V3 a, V3 b, double k = 1){ return {a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k}; }
rhi::hw::FrameCamera look(V3 eye, V3 at, float fov){
    const V3 d = sub(at, eye); const double l = std::hypot(d[0], d[1], d[2]);
    rhi::hw::FrameCamera c{}; for (int k = 0; k < 3; ++k) c.eye[k] = float(eye[size_t(k)]);
    c.yaw = float(std::atan2(d[0], -d[2])); c.pitch = float(std::asin(d[1] / l)); c.fovDeg = fov; return c;
}
// a joint's place in the world at time t
V3 jointAt(const Person& P, const char* name, double t, double extraYaw = 0){
    const std::vector<anim::Mat> M = skinAt(P, t, extraYaw, nullptr);
    for (size_t j = 0; j < P.sk.joints.size(); ++j) if (P.sk.joints[j].name == name){ const anim::Mat& b = P.sk.bind[j]; return anim::apply(M[j], {b[12], b[13], b[14]}); }
    return {P.x, P.y, P.z};
}
void pose(rhi::hw::FrameRenderer& R, const Cast& C, double t, bool rebuild, double extraYaw = 0){
    std::vector<float> pal; std::vector<std::pair<int, rhi::hw::FrameLight>> L;
    castFrame(C, t, pal, L, extraYaw); R.setJoints(pal, rebuild);
    for (auto& [i, l] : L) R.setLights(uint32_t(i), {l});
}
}  // namespace

bool characterShots(rhi::hw::FrameRenderer& R, const Cast& C, const rhi::hw::FrameOptions& base, const std::string& jobs, const std::string& out,
                    const std::function<bool(const char*, const rhi::hw::FrameResult&)>& save, std::string& log){
    auto has = [&](const char* j){ return ("," + jobs + ",").find(std::string(",") + j + ",") != std::string::npos; };
    const Person& L = C.people.front();
    const double fwdYaw = L.yaw; const V3 fwd{std::sin(fwdYaw), 0, std::cos(fwdYaw)}, right{-std::cos(fwdYaw), 0, std::sin(fwdYaw)}, up{0, 1, 0};
    auto run = [&](const char* name, const rhi::hw::FrameCamera& cam, const rhi::hw::FrameOptions& o){
        const rhi::hw::FrameResult r = R.render(cam, o);
        if (!r.ran){ std::fprintf(stderr, "lw_frame: %s: %s\n", name, r.error.c_str()); return false; }
        return save(name, r);
    };
    const double tStill = 0.4;
    // the follow camera: behind Lamb's right shoulder, looking down the street over the townspeople
    auto follow = [&](double t){ const V3 p = jointAt(L, "pelvis", t); const V3 base0{p[0], L.y, p[2]};
        return look(add(add(add(base0, fwd, -3.2), right, -0.55), up, 1.95), add(add(base0, fwd, 2.0), up, 1.15), 52.0f); };
    if (has("street")){ pose(R, C, tStill, true); if (!run("chars-street", follow(tStill), base)) return false; }
    // head and shoulders: the camera a metre ahead of the face, a little to its left, at eye height
    auto portrait = [&](double t, double yaw0){ const V3 h = jointAt(L, "head", t, yaw0); const V3 fw{std::sin(L.yaw + yaw0), 0, std::cos(L.yaw + yaw0)}, rt{-fw[2], 0, fw[0]};
        return look(add(add(add(h, fw, 0.95), rt, -0.2), up, 0.08), add(h, up, 0.03), 26.0f); };
    if (has("portrait")){ pose(R, C, tStill, true); if (!run("chars-portrait", portrait(tStill, 0), base)) return false; }
    if (has("charref")){
        pose(R, C, tStill, true);
        rhi::hw::FrameOptions o = base; o.snow = false;
        if (!run("chars-flip-realtime", portrait(tStill, 0), o)) return false;
        o.reference = true; o.referenceSpp = std::max(256u, base.referenceSpp);
        if (!run("chars-flip-reference", portrait(tStill, 0), o)) return false;
    }
    if (has("turn")){
        std::filesystem::create_directories(out + "/turn");
        rhi::hw::FrameOptions o = base; o.frames = 24;
        const V3 p = jointAt(L, "pelvis", tStill);
        const rhi::hw::FrameCamera cam = look(add(add({p[0], L.y, p[2]}, fwd, 3.4), up, 1.25), add({p[0], L.y, p[2]}, up, 1.0), 38.0f);
        for (int k = 0; k < 24; ++k){
            pose(R, C, tStill, true, k * 2.0 * 3.14159265358979 / 24.0);
            const rhi::hw::FrameResult r = R.render(cam, o);
            if (!r.ran){ std::fprintf(stderr, "lw_frame: turn %d: %s\n", k, r.error.c_str()); return false; }
            char n[64]; std::snprintf(n, sizeof n, "%s/turn/%02d.png", out.c_str(), k); std::string e;
            if (!platform::encodePng(n, base.width, base.height, r.ldr, e)) return false;
        }
    }
    if (has("cwalk")){
        // a walk at the follow camera: a new palette each frame, the skinned BLAS refit, timed
        std::filesystem::create_directories(out + "/cwalk");
        rhi::hw::FrameOptions o = base; o.frames = 24;
        pose(R, C, 0.0, true); R.render(follow(0.0), o);
        o.frames = 1;
        std::vector<std::vector<double>> times; std::vector<std::string> names;
        for (int k = 0; k < 90; ++k){
            const double t = k / 30.0;
            pose(R, C, t, k % 30 == 0);
            o.time = float(3.0 + t);
            const rhi::hw::FrameResult r = R.step(follow(t), o);
            if (!r.ran){ std::fprintf(stderr, "lw_frame: cwalk %d: %s\n", k, r.error.c_str()); return false; }
            char n[64]; std::snprintf(n, sizeof n, "%s/cwalk/%03d.png", out.c_str(), k); std::string e;
            if (!platform::encodePng(n, base.width, base.height, r.ldr, e)) return false;
            if (k % 30 != 0){ std::vector<double> t1; for (auto& ps : r.passes){ t1.push_back(ps.ms); if (times.empty()) names.push_back(ps.name); } times.push_back(t1); }
            if (k == 45) save("chars-walk-mid", r);
        }
        char b[96]; log += ",\"cwalk_median_ms\":{";
        for (size_t i = 0; i < names.size(); ++i){ std::vector<double> v; for (auto& t1 : times) if (i < t1.size()) v.push_back(t1[i]); std::sort(v.begin(), v.end());
            std::snprintf(b, sizeof b, "%s\"%s\":%.4f", i ? "," : "", names[i].c_str(), v.empty() ? 0.0 : v[v.size() / 2]); log += b; }
        log += "}";
    }
    if (has("parity")){
        // the GPU's skinned positions against raw::anim::skin with the same matrices, at a walk pose
        const double t = 0.37;
        pose(R, C, t, true);
        rhi::hw::FrameOptions o = base; o.frames = 1; R.render(follow(t), o);
        std::vector<float> gpu; std::string e;
        if (!R.readSkinned(gpu, e)){ std::fprintf(stderr, "lw_frame: parity: %s\n", e.c_str()); return false; }
        double worst = 0, sum = 0; size_t n = 0, off = 0;
        // the GPU array runs over every skinned vertex in scene order (the tail of glass is inside it)
        for (const Person& P : C.people){
            anim::SkinMesh m; m.pos = P.bindPos; m.joints = P.joints; m.weights = P.weights;
            const anim::SkinOutput cpu = anim::skin(m, skinAt(P, t, 0, nullptr), e);
            if (!e.empty()){ std::fprintf(stderr, "lw_frame: parity: %s\n", e.c_str()); return false; }
            for (size_t i = 0; i < cpu.pos.size(); ++i){ const double d = std::fabs(cpu.pos[i] - gpu[off + i]); worst = std::max(worst, d); sum += d; ++n; }
            off += cpu.pos.size();
        }
        char b[200]; std::snprintf(b, sizeof b, ",\"skin_parity\":{\"vertices\":%zu,\"max_abs_m\":%.3g,\"mean_abs_m\":%.3g}", n / 3, worst, n ? sum / double(n) : 0.0);
        log += b; std::printf("skin parity: %zu vertices, max |gpu - cpu| %.3g m, mean %.3g m\n", n / 3, worst, n ? sum / double(n) : 0.0);
    }
    return true;
}

}  // namespace raw::lwframe
