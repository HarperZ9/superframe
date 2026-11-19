// The hero characters in the hero frame (see lwframe.hpp): each person's .glb (bind pose, JOINTS_0
// and WEIGHTS_0) and .char.json (skeleton, clips, materials, lantern light) from
// games/low-water/characters/hero/build.mjs, appended to the scene as skinned vertices; their
// materials bound to the CC0 cloth and leather sets; and each frame's joint palette, posed on the
// CPU by raw/scene/skin.hpp (the same functions the parity check uses) and skinned on the GPU.
#include "lwframe.hpp"
#include "raw/assets/gltf.hpp"
#include "raw/assets/json.hpp"
#include <algorithm>
#include <cmath>
#include <cstring>
#include <fstream>
#include <iterator>
#include <map>
namespace raw::lwframe {
namespace {
bool readFile(const std::string& p, std::vector<uint8_t>& out){ std::ifstream f(p, std::ios::binary); if (!f) return false; out.assign(std::istreambuf_iterator<char>(f), {}); return true; }
std::array<double, 3> vec3(const assets::Json& a, const char* w){ return {a.at(0).number(w), a.at(1).number(w), a.at(2).number(w)}; }
// a scanned set by its folder name: ambientCG under the characters' folder, else Poly Haven
MaterialSpec setSpec(const std::string& root, const std::string& set){
    MaterialSpec m; m.name = set;
    if (set.rfind("Fabric", 0) == 0 || set.rfind("Leather", 0) == 0){
        m.dir = root + "/cc0-ambientcg-2026-11-18-characters/" + set; const std::string b = set + "_2K-PNG_";
        m.color = b + "Color.png"; m.normal = b + "NormalGL.png"; m.rough = b + "Roughness.png"; m.disp = b + "Displacement.png"; m.ao = b + "AmbientOcclusion.png";
    } else {
        m.dir = root + "/cc0-polyhaven-2026-11-18/" + set; const std::string b = set + "_";
        m.color = b + "diff_2k.png"; m.normal = b + "nor_dx_2k.png"; m.rough = b + "rough_2k.png"; m.ao = b + "ao_2k.png"; m.disp = b + "disp_2k.png"; m.normalDx = true;
    }
    m.kind = 9;
    return m;
}
// the highest surface under (x, z) among the scene's first `tris` triangles (the street, before the
// characters are added), below 0.8 m so porch roofs, eaves and lamps are skipped
double groundAt(const rhi::hw::FrameScene& S, size_t tris, double x, double z){
    double best = -1e9;
    for (size_t t = 0; t < tris; ++t){
        const float* a = S.vertices[S.indices[t * 3]].p; const float* b = S.vertices[S.indices[t * 3 + 1]].p; const float* c = S.vertices[S.indices[t * 3 + 2]].p;
        if (x < std::min({a[0], b[0], c[0]}) || x > std::max({a[0], b[0], c[0]}) || z < std::min({a[2], b[2], c[2]}) || z > std::max({a[2], b[2], c[2]})) continue;
        const double d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (std::fabs(d) < 1e-12) continue;
        const double u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d, v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d, w = 1 - u - v;
        if (u < 0 || v < 0 || w < 0) continue;
        const double y = u * a[1] + v * b[1] + w * c[1];
        if (y < 0.8 && y > best) best = y;
    }
    return best > -1e8 ? best : 0.0;
}
uint32_t kindOf(const std::string& k){ return k == "skin" ? 8u : k == "cloth" ? 9u : k == "eye" ? 10u : k == "hair" ? 11u : k == "glass" ? 3u : k == "lamp" ? 5u : 0u; }
}  // namespace

bool loadCharacters(const std::string& listPath, const std::string& assetRoot, rhi::hw::FrameScene& S, Cast& cast, std::string& err){
    std::vector<uint8_t> lj;
    if (!readFile(listPath, lj)){ err = "lwframe: cannot read " + listPath; return false; }
    try {
        const assets::Json list = assets::parseJson(std::string_view(reinterpret_cast<const char*>(lj.data()), lj.size()));
        const std::string dir = list.get("dir")->s;
        S.skinFirstVertex = uint32_t(S.vertices.size()); S.skinFirstIndex = uint32_t(S.indices.size());
        std::vector<MaterialSpec> sets; std::map<std::string, uint32_t> setIndex;
        std::vector<uint32_t> tailIdx, tailMat;
        struct Pending { uint32_t person; std::string name; const assets::Json* m; };
        std::vector<assets::Json> docs; docs.reserve(list.get("people")->a.size());
        for (const assets::Json& pj : list.get("people")->a){
            Person P; P.id = pj.get("id")->s; P.lod = uint32_t(pj.get("lod") ? pj.get("lod")->number("lod") : 0);
            P.x = pj.get("x")->number("x"); P.z = pj.get("z")->number("z"); P.y = pj.get("y") ? pj.get("y")->number("y") : groundAt(S, S.skinFirstIndex / 3, P.x, P.z); P.yaw = pj.get("yaw")->number("yaw");
            P.clip = pj.get("clip") ? pj.get("clip")->s : "idle"; P.phase = pj.get("phase") ? pj.get("phase")->number("phase") : 0; P.walks = pj.get("walks") && pj.get("walks")->b;
            std::vector<uint8_t> cj, glb;
            if (!readFile(dir + "/" + P.id + ".char.json", cj)){ err = "lwframe: cannot read " + dir + "/" + P.id + ".char.json"; return false; }
            docs.push_back(assets::parseJson(std::string_view(reinterpret_cast<const char*>(cj.data()), cj.size())));
            const assets::Json& doc = docs.back();
            std::vector<anim::JointDesc> jd;
            for (const assets::Json& j : doc.get("joints")->a){
                anim::JointDesc d; d.name = j.get("name")->s; d.parent = int(j.get("parent")->number("parent")); d.t = vec3(*j.get("t"), "t");
                for (int k = 0; k < 4; ++k) d.r[size_t(k)] = j.get("r")->at(size_t(k)).number("r");
                jd.push_back(d);
            }
            P.sk = anim::makeSkeleton(jd, err); if (!err.empty()) return false;
            for (const auto& [name, c] : doc.get("clips")->o){
                Clip C; C.fps = c.get("fps")->number("fps"); C.frames = uint32_t(c.get("frames")->number("frames"));
                C.speed = c.get("speed") ? c.get("speed")->number("speed") : 0;
                for (const assets::Json& f : c.get("rot")->a) for (const assets::Json& q : f.a) C.rot.push_back({q.at(0).number("q"), q.at(1).number("q"), q.at(2).number("q"), q.at(3).number("q")});
                for (const assets::Json& f : c.get("root")->a) C.root.push_back(vec3(f, "root"));
                P.clips[name] = std::move(C);
            }
            if (!P.clips.count(P.clip)){ err = "lwframe: " + P.id + " has no clip " + P.clip; return false; }
            P.jointBase = S.joints; S.joints += uint32_t(P.sk.joints.size());
            // the materials: a scanned set each (shared), tinted per person
            std::map<std::string, uint32_t> matIndex;
            for (const auto& [mname, m] : doc.get("materials")->o){
                rhi::hw::FrameMaterial fm{}; fm.kind = kindOf(m.get("kind")->s);
                if (const assets::Json* t = m.get("tint")) for (int k = 0; k < 3; ++k) fm.tint[k] = float(t->at(size_t(k)).number("tint"));
                if (const assets::Json* st = m.get("set")){
                    if (!setIndex.count(st->s)){ setIndex[st->s] = uint32_t(sets.size()); sets.push_back(setSpec(assetRoot, st->s)); }
                    fm.texA = int32_t(S.textures.size() + setIndex[st->s] * 2); fm.texB = fm.texA + 1;
                    fm.uvScale = 1.0f / float(m.get("tile") ? m.get("tile")->number("tile") : 0.3);
                }
                if (const assets::Json* rb = m.get("roughBias")) fm.roughBias = float(rb->number("roughBias"));
                if (const assets::Json* mt = m.get("metal")) fm.metal = float(mt->number("metal"));
                if (const assets::Json* r = m.get("rough")){ fm.roughScale = 0; fm.roughBias = float(r->number("rough")); }
                if (const assets::Json* sh = m.get("sheen")) fm.pad = float(sh->number("sheen"));
                matIndex[mname] = uint32_t(S.materials.size()); S.materials.push_back(fm);
            }
            const std::string glbPath = dir + "/" + P.id + ".lod" + std::to_string(P.lod) + ".glb";
            if (!readFile(glbPath, glb)){ err = "lwframe: cannot read " + glbPath; return false; }
            const assets::GltfModel model = assets::loadGltf(glb);
            P.firstVertex = uint32_t(S.vertices.size()); P.firstTriangle = uint32_t(S.indices.size() / 3);
            for (const assets::GltfMesh& m : model.meshes){
                const auto it = matIndex.find(m.material);
                if (it == matIndex.end()){ err = "lwframe: " + P.id + " has no material " + m.material; return false; }
                if (m.joints.empty()){ err = "lwframe: " + glbPath + " primitive " + m.material + " has no JOINTS_0"; return false; }
                const uint32_t base = uint32_t(S.vertices.size());
                for (size_t i = 0; i < m.positions.size(); ++i){
                    rhi::hw::FrameVertex v{}; rhi::hw::FrameSkinVertex k{};
                    v.p[0] = k.p[0] = m.positions[i].x; v.p[1] = k.p[1] = m.positions[i].y; v.p[2] = k.p[2] = m.positions[i].z;
                    v.n[0] = k.n[0] = m.normals[i].x; v.n[1] = k.n[1] = m.normals[i].y; v.n[2] = k.n[2] = m.normals[i].z;
                    if (!m.tangents.empty()){ std::memcpy(v.t, &m.tangents[i * 4], 16); std::memcpy(k.t, &m.tangents[i * 4], 16); } else { v.t[0] = k.t[0] = 1; v.t[3] = k.t[3] = 1; }
                    if (!m.uv.empty()) std::memcpy(v.uv, &m.uv[i * 2], 8);
                    if (!m.colors.empty()) std::memcpy(v.c, &m.colors[i * 4], 16);
                    const uint16_t* j = &m.joints[i * 4];
                    k.j01 = (P.jointBase + j[0]) | ((P.jointBase + j[1]) << 16); k.j23 = (P.jointBase + j[2]) | ((P.jointBase + j[3]) << 16);
                    std::memcpy(k.w, &m.weights[i * 4], 16);
                    S.vertices.push_back(v); S.skin.push_back(k);
                    P.bindPos.insert(P.bindPos.end(), {k.p[0], k.p[1], k.p[2]});
                    for (int q = 0; q < 4; ++q){ P.joints.push_back(j[q]); P.weights.push_back(m.weights[i * 4 + size_t(q)]); }
                }
                const uint32_t kind = S.materials[it->second].kind;
                std::vector<uint32_t>& dst = kind == 3u || kind == 5u ? tailIdx : S.indices;
                for (uint32_t ix : m.indices) dst.push_back(base + ix);
                (kind == 3u || kind == 5u ? tailMat : S.triMaterial).insert((kind == 3u || kind == 5u ? tailMat : S.triMaterial).end(), m.indices.size() / 3, it->second);
            }
            P.vertexCount = uint32_t(S.vertices.size()) - P.firstVertex; P.triangles = uint32_t(S.indices.size() / 3) - P.firstTriangle;
            if (const assets::Json* ls = doc.get("lights")) for (const assets::Json& l : ls->a){
                const std::string jn = l.get("joint")->s;
                for (size_t q = 0; q < P.sk.joints.size(); ++q) if (P.sk.joints[q].name == jn) P.lightJoint = int(q);
                P.lightOffset = vec3(*l.get("offset"), "offset");
                rhi::hw::FrameLight L{}; for (int k = 0; k < 3; ++k) L.col[k] = float(l.get("col")->at(size_t(k)).number("col"));
                L.power = float(l.get("power")->number("power")); L.radius = float(l.get("radius")->number("radius"));
                P.light = int(S.lights.size()); P.lightProto = L; S.lights.push_back(L);
            }
            cast.people.push_back(std::move(P));
        }
        S.skinRayIndexEnd = uint32_t(S.indices.size());
        S.indices.insert(S.indices.end(), tailIdx.begin(), tailIdx.end()); S.triMaterial.insert(S.triMaterial.end(), tailMat.begin(), tailMat.end());
        std::vector<rhi::hw::FrameTexture> tex;
        if (!cookMaterials(sets, tex, err)) return false;
        S.textures.insert(S.textures.end(), std::make_move_iterator(tex.begin()), std::make_move_iterator(tex.end()));
    } catch (const std::exception& e){ err = std::string("lwframe characters: ") + e.what(); return false; }
    return true;
}

// one person's skinning matrices at time t (seconds), the placement (and the walk's travel) applied
std::vector<anim::Mat> skinAt(const Person& P, double t, double extraYaw, anim::Vec3d* lightPos){
    const Clip& C = P.clips.at(P.clip);
    const double f = std::fmod(std::max(0.0, t * C.fps + P.phase * C.frames), double(C.frames));
    const uint32_t f0 = uint32_t(f) % C.frames, f1 = (f0 + 1) % C.frames; const double a = f - std::floor(f);
    const size_t nj = P.sk.joints.size();
    anim::Pose pose(nj);
    for (size_t j = 0; j < nj; ++j){
        anim::Quat q0 = C.rot[f0 * nj + j], q1 = C.rot[f1 * nj + j];
        if (q0[0] * q1[0] + q0[1] * q1[1] + q0[2] * q1[2] + q0[3] * q1[3] < 0) for (double& v : q1) v = -v;
        anim::Quat q; double l = 0; for (int k = 0; k < 4; ++k){ q[size_t(k)] = q0[size_t(k)] * (1 - a) + q1[size_t(k)] * a; l += q[size_t(k)] * q[size_t(k)]; }
        for (double& v : q) v /= std::sqrt(l);
        pose[j].hasR = true; pose[j].r = q;
    }
    pose[0].hasT = true; for (int k = 0; k < 3; ++k) pose[0].t[size_t(k)] = C.root[f0][size_t(k)] * (1 - a) + C.root[f1][size_t(k)] * a;
    const std::vector<anim::Mat> world = anim::poseSkeleton(P.sk, pose);
    std::vector<anim::Mat> M = anim::skinMatrices(world, P.sk.invBind);
    const double yaw = P.yaw + extraYaw, d = P.walks ? C.speed * t : 0.0;
    const anim::Vec3d at{P.x + std::sin(P.yaw) * d, P.y, P.z + std::cos(P.yaw) * d};
    const anim::Mat place = anim::compose(at, anim::quatAxisAngle({0, 1, 0}, yaw));
    for (anim::Mat& m : M) m = anim::mul(place, m);
    if (lightPos && P.lightJoint >= 0) *lightPos = anim::apply(anim::mul(place, world[size_t(P.lightJoint)]), P.lightOffset);
    return M;
}

void castFrame(const Cast& cast, double t, std::vector<float>& palette, std::vector<std::pair<int, rhi::hw::FrameLight>>& lights, double extraYaw0){
    palette.clear(); lights.clear();
    for (size_t i = 0; i < cast.people.size(); ++i){
        const Person& P = cast.people[i];
        anim::Vec3d lp{};
        const std::vector<anim::Mat> M = skinAt(P, t, i == 0 ? extraYaw0 : 0.0, &lp);
        for (const anim::Mat& m : M) for (int r = 0; r < 3; ++r) for (int c = 0; c < 4; ++c) palette.push_back(float(m[size_t(c * 4 + r)]));
        if (P.light >= 0){
            rhi::hw::FrameLight L = P.lightProto; L.p[0] = float(lp[0]); L.p[1] = float(lp[1]); L.p[2] = float(lp[2]);
            lights.push_back({P.light, L});
        }
    }
}

}  // namespace raw::lwframe
