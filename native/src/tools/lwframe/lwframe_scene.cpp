// The hero frame's scene from the kit's .glb and .frame.json (see lwframe.hpp).
#include "lwframe.hpp"
#include "raw/assets/gltf.hpp"
#include "raw/assets/json.hpp"
#include <cmath>
#include <cstring>
#include <fstream>
#include <iterator>
#include <map>
namespace raw::lwframe {
namespace {
bool readFile(const std::string& p, std::vector<uint8_t>& out){
    std::ifstream f(p, std::ios::binary);
    if (!f) return false;
    out.assign(std::istreambuf_iterator<char>(f), {});
    return true;
}
MaterialSpec acg(const std::string& root, const char* name, const char* id, float sizeM, uint32_t kind, bool ao = true){
    MaterialSpec m; m.name = name; m.dir = root + "/cc0-ambientcg-2026-11-18/" + id;
    const std::string b = std::string(id) + "_2K-PNG_";
    m.color = b + "Color.png"; m.normal = b + "NormalGL.png"; m.rough = b + "Roughness.png"; m.disp = b + "Displacement.png";
    if (ao) m.ao = b + "AmbientOcclusion.png";
    m.uvScale = 1.0f / sizeM; m.kind = kind;
    return m;
}
MaterialSpec ph(const std::string& root, const char* name, const char* id, float sizeM){
    MaterialSpec m; m.name = name; m.dir = root + "/cc0-polyhaven-2026-11-18/" + id;
    const std::string b = std::string(id) + "_";
    m.color = b + "diff_2k.png"; m.normal = b + "nor_dx_2k.png"; m.rough = b + "rough_2k.png"; m.ao = b + "ao_2k.png"; m.disp = b + "disp_2k.png";
    m.normalDx = true; m.uvScale = 1.0f / sizeM;
    return m;
}
}  // namespace

// The binding of the kit's material names (walk/build/hero) to scanned sets, with each set's size
// in metres, parallax depth, tint and roughness adjustment. The four ground layers follow the
// ground, in the order hf_surface.hlsli blends them: packed, trodden, cobbles, earth.
std::vector<MaterialSpec> materialSpecs(const std::string& r){
    std::vector<MaterialSpec> v;
    auto snow = acg(r, "snow", "Snow010A", 1.5f, 1); snow.roughBias = 0.25f; v.push_back(snow);
    auto ground = acg(r, "ground", "Snow010A", 1.5f, 2); ground.roughBias = 0.25f; v.push_back(ground);
    auto boards = acg(r, "boards", "WoodSiding008", 2.0f, 0); boards.uvScale = -boards.uvScale; boards.heightScale = 0.006f; v.push_back(boards);
    auto cedar = ph(r, "cedar", "japanese_cedar_planks", 1.13f); cedar.heightScale = 0.004f; cedar.tint[0] = 0.62f; cedar.tint[1] = 0.5f; cedar.tint[2] = 0.42f; v.push_back(cedar);
    auto timber = ph(r, "timber", "medieval_wood", 2.0f); timber.heightScale = 0.008f; v.push_back(timber);
    auto stone = acg(r, "stone", "Rock030", 2.0f, 0); stone.heightScale = 0.025f; v.push_back(stone);
    auto shingle = ph(r, "shingle", "grey_roof_01", 8.0f); shingle.heightScale = 0.012f; v.push_back(shingle);
    auto iron = acg(r, "iron", "Metal055B", 1.0f, 0, false); iron.metal = 0.7f; iron.tint[0] = iron.tint[1] = iron.tint[2] = 0.28f; v.push_back(iron);
    auto ice = acg(r, "ice", "Ice002", 1.0f, 4, false); v.push_back(ice);
    auto plaster = acg(r, "plaster", "Plaster007", 2.0f, 0); plaster.heightScale = 0.004f; plaster.tint[0] = 0.92f; plaster.tint[1] = 0.88f; plaster.tint[2] = 0.8f; v.push_back(plaster);
    auto bark = ph(r, "bark", "medieval_wood", 0.8f); bark.tint[0] = 0.45f; bark.tint[1] = 0.36f; bark.tint[2] = 0.3f; bark.roughBias = 0.15f; v.push_back(bark);
    MaterialSpec logend; logend.name = "logend"; logend.kind = 7; v.push_back(logend);
    MaterialSpec glass; glass.name = "glass"; glass.kind = 3; v.push_back(glass);
    MaterialSpec lamp; lamp.name = "lamp"; lamp.kind = 5; v.push_back(lamp);
    MaterialSpec sign; sign.name = "sign"; sign.kind = 6; v.push_back(sign);
    // snow is a rough scatterer: the scans' roughness maps read low (their icy grains), so each snow
    // layer is lifted; trodden snow keeps a little sheen where feet have glazed it
    auto packed = acg(r, "ground_packed", "Snow006", 2.5f, 1); packed.roughBias = 0.25f; v.push_back(packed);
    auto trodden = acg(r, "ground_trodden", "Snow013", 2.0f, 1, false); trodden.roughBias = 0.15f; v.push_back(trodden);
    auto cob = acg(r, "ground_cobble", "PavingStones046", 1.5f, 0); v.push_back(cob);
    v.push_back(acg(r, "ground_earth", "Ground054", 3.5f, 0));
    return v;
}

bool loadScene(const std::string& glbPath, const std::string& framePath, const std::string& assetRoot, const std::string& hdr,
               rhi::hw::FrameScene& S, Cameras& cams, std::string& err){
    std::vector<uint8_t> glb, fj;
    if (!readFile(glbPath, glb)){ err = "lwframe: cannot read " + glbPath; return false; }
    if (!readFile(framePath, fj)){ err = "lwframe: cannot read " + framePath; return false; }
    const std::vector<MaterialSpec> specs = materialSpecs(assetRoot);
    std::map<std::string, uint32_t> byName;
    for (uint32_t i = 0; i < specs.size(); ++i) byName[specs[i].name] = i;
    try {
        const assets::GltfModel model = assets::loadGltf(glb);
        for (const assets::GltfMesh& m : model.meshes){
            const auto it = byName.find(m.material);
            if (it == byName.end()){ err = "lwframe: no texture set for material '" + m.material + "'"; return false; }
            const uint32_t base = uint32_t(S.vertices.size());
            for (size_t i = 0; i < m.positions.size(); ++i){
                rhi::hw::FrameVertex v{};
                v.p[0] = m.positions[i].x; v.p[1] = m.positions[i].y; v.p[2] = m.positions[i].z;
                v.n[0] = m.normals[i].x; v.n[1] = m.normals[i].y; v.n[2] = m.normals[i].z;
                if (!m.tangents.empty()) std::memcpy(v.t, &m.tangents[i * 4], 16); else { v.t[0] = 1; v.t[3] = 1; }
                if (!m.uv.empty()) std::memcpy(v.uv, &m.uv[i * 2], 8);
                if (!m.colors.empty()) std::memcpy(v.c, &m.colors[i * 4], 16);
                S.vertices.push_back(v);
            }
            for (uint32_t ix : m.indices) S.indices.push_back(base + ix);
            S.triMaterial.insert(S.triMaterial.end(), m.indices.size() / 3, it->second);
        }
        const assets::Json j = assets::parseJson(std::string_view(reinterpret_cast<const char*>(fj.data()), fj.size()));
        for (const assets::Json& l : j.get("lights")->a){
            rhi::hw::FrameLight L{};
            for (int k = 0; k < 3; ++k){ L.p[k] = float(l.get("p")->a[k].number("p")); L.col[k] = float(l.get("col")->a[k].number("col")); }
            L.power = float(l.get("power")->number("power")); L.radius = float(l.get("radius")->number("radius"));
            if (const assets::Json* a = l.get("aim")){ for (int k = 0; k < 3; ++k) L.aim[k] = float(a->a[k].number("aim")); L.cone = float(l.get("cone")->number("cone")); }
            S.lights.push_back(L);
        }
        if (const assets::Json* sm = j.get("smoke")) for (const assets::Json& q : sm->a)
            S.smoke.push_back({float(q.a[0].number("smoke")), float(q.a[1].number("smoke")), float(q.a[2].number("smoke")), float(q.a[3].number("smoke"))});
        auto cam = [](const assets::Json& c){ rhi::hw::FrameCamera o{}; for (int k = 0; k < 3; ++k) o.eye[k] = float(c.get("eye")->a[k].number("eye"));
            o.yaw = float(c.get("yaw")->number("yaw")); o.pitch = float(c.get("pitch")->number("pitch")); o.fovDeg = float(c.get("fov")->number("fov")); return o; };
        const assets::Json* cs = j.get("cameras");
        cams.main = cam(*cs->get("main"));
        if (const assets::Json* c = cs->get("close")){ cams.close = cam(*c); cams.hasClose = true; }
        if (const assets::Json* w = cs->get("walk")) for (const assets::Json& c : w->a) cams.walk.push_back(cam(c));
    } catch (const std::exception& e){ err = std::string("lwframe: ") + e.what(); return false; }
    // materials and their textures
    if (!cookMaterials(specs, S.textures, err)) return false;
    for (uint32_t i = 0; i < specs.size(); ++i){
        const MaterialSpec& s = specs[i];
        rhi::hw::FrameMaterial m{};
        const bool tex = !s.dir.empty();
        m.texA = tex ? int32_t(i * 2) : -1; m.texB = tex ? int32_t(i * 2 + 1) : -1;
        m.uvScale = s.uvScale; m.heightScale = s.heightScale; std::memcpy(m.tint, s.tint, sizeof m.tint);
        m.roughScale = s.roughScale; m.roughBias = s.roughBias; m.metal = s.metal; m.kind = s.kind;
        if (s.name == "ground"){ const uint32_t layer = byName["ground_packed"]; std::memcpy(&m.pad, &layer, 4); }
        S.materials.push_back(m);
    }
    return loadSky(hdr, cams.main.yaw, S, err);
}

}  // namespace raw::lwframe
