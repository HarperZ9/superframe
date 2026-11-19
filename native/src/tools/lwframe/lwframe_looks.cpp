// The versions of one place (lwframe.hpp runLooks): each look sets the camera, the weather, the
// sky, the grade and a camera mode over the physical frame, renders to convergence and saves.
#include "lwframe.hpp"
#include "raw/assets/json.hpp"
#include <cstdio>
#include <fstream>
#include <iterator>
namespace raw::lwframe {
namespace {
rhi::hw::FrameCamera camOf(const assets::Json& c){
    rhi::hw::FrameCamera o{};
    for (int k = 0; k < 3; ++k) o.eye[k] = float(c.get("eye")->a.at(size_t(k)).number("eye"));
    o.yaw = float(c.get("yaw")->number("yaw")); o.pitch = float(c.get("pitch")->number("pitch")); o.fovDeg = float(c.get("fov")->number("fov"));
    return o;
}
float num(const assets::Json& j, const char* k, float d){ const assets::Json* v = j.get(k); return v ? float(v->number(k)) : d; }
void vec3(const assets::Json& j, const char* k, float* out){ if (const assets::Json* v = j.get(k)) for (int i = 0; i < 3; ++i) out[i] = float(v->a.at(size_t(i)).number(k)); }
}  // namespace

bool runLooks(rhi::hw::FrameRenderer& R, const Cameras& cams, const rhi::hw::FrameOptions& base, const std::string& path,
              const std::function<bool(const char*, const rhi::hw::FrameResult&)>& save, std::string& err){
    std::ifstream f(path, std::ios::binary);
    if (!f){ err = "lwframe: cannot read " + path; return false; }
    const std::string text((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
    try {
        const assets::Json j = assets::parseJson(text);
        for (const assets::Json& L : j.get("looks")->a){
            const std::string name = L.get("name")->s;
            rhi::hw::FrameCamera cam = cams.main;
            if (const assets::Json* c = L.get("camera")){
                if (c->is(assets::Json::Kind::Object)) cam = camOf(*c);
                else if (c->s == "close" && cams.hasClose) cam = cams.close;
                else if (c->s != "main"){
                    const auto it = cams.views.find(c->s);
                    if (it == cams.views.end()){ err = "lwframe: look " + name + ": no view named " + c->s; return false; }
                    cam = it->second;
                }
            }
            if (const assets::Json* c = L.get("aim")){   // nudges on the named camera: yaw, pitch, fov
                cam.yaw += float(c->a.at(0).number("aim")); cam.pitch += float(c->a.at(1).number("aim")); cam.fovDeg = float(c->a.at(2).number("aim"));
            }
            rhi::hw::FrameOptions o = base;
            o.exposureEV = num(L, "ev", base.exposureEV);
            o.frames = uint32_t(num(L, "frames", float(base.frames)));
            o.time = num(L, "time", base.time);
            if (const assets::Json* g = L.get("fog")){
                o.fogDensity = float(g->a.at(0).number("fog")); o.fogFalloff = float(g->a.at(1).number("fog"));
                o.fogG = float(g->a.at(2).number("fog")); o.fogMax = float(g->a.at(3).number("fog"));
            }
            o.skyScale = num(L, "sky", base.skyScale); o.moonScale = num(L, "moon", base.moonScale);
            if (const assets::Json* s = L.get("snow")){
                if (s->is(assets::Json::Kind::Bool)) o.snow = s->b && base.snow;
                else { o.snowSpeed = float(s->a.at(0).number("snow")); o.windX = float(s->a.at(1).number("snow")); o.windZ = float(s->a.at(2).number("snow"));
                       o.snowFlakes = uint32_t(s->a.at(3).number("snow")); }
            }
            vec3(L, "wb", o.whiteBalance); vec3(L, "lift", o.lift);
            o.saturation = num(L, "saturation", 1.0f); o.contrast = num(L, "contrast", 1.0f); o.vignette = num(L, "vignette", 0.0f);
            if (const assets::Json* l = L.get("lens")) o.lens = l->s == "tilt" ? 1u : l->s == "oil" ? 2u : l->s == "ink" ? 3u : 0u;
            o.fogAmbient = num(L, "fogAmbient", base.fogAmbient);
            o.skyTurn = num(L, "skyTurn", 0.0f);
            o.lensFocus = num(L, "focus", 0.55f); o.lensBand = num(L, "band", 0.1f); o.lensStrength = num(L, "strength", 1.0f);
            const rhi::hw::FrameResult r = R.render(cam, o);
            if (!r.ran){ err = "lwframe: look " + name + ": " + r.error; return false; }
            if (!save(name.c_str(), r)) return false;
            // "flip": SPP renders the FLIP pair for this look: the realtime frame and the path tracer, both
            // with the falling snow off and no lens, so the comparison is of the physical frame alone
            if (const assets::Json* fs = L.get("flip")){
                rhi::hw::FrameOptions q = o; q.snow = false; q.lens = 0;
                const rhi::hw::FrameResult a = R.render(cam, q);
                if (!a.ran || !save(("flip-realtime-" + name).c_str(), a)){ err = "lwframe: look " + name + ": flip realtime " + a.error; return false; }
                q.reference = true; q.referenceSpp = uint32_t(fs->number("flip"));
                const rhi::hw::FrameResult b = R.render(cam, q);
                if (!b.ran || !save(("flip-reference-" + name).c_str(), b)){ err = "lwframe: look " + name + ": flip reference " + b.error; return false; }
            }
        }
    } catch (const std::exception& e){ err = std::string("lwframe: ") + path + ": " + e.what(); return false; }
    return true;
}

}  // namespace raw::lwframe
