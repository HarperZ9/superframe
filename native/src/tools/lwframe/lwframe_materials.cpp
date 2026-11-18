// The hero frame's materials: each glTF material name bound to a scanned CC0 texture set on disk
// (ambientCG and Poly Haven, 2K PNG; their SOURCE.txt and SHA256SUMS sit beside them), cooked to
// two RGBA8 textures with a full mip chain: albedo (sRGB) + height, and normal (OpenGL
// convention) + roughness + ambient occlusion. Roughness in each mip grows by the spread of the
// normals it averages (Toksvig 2005), so distant surfaces do not sparkle.
// Not done: BC7 and BC5 block compression (no encoder in the tree yet); the textures are
// uncompressed, four times the memory a shipping cook would use.
#include "lwframe.hpp"
#include "raw/platform/image_codec.hpp"
#include <algorithm>
#include <cmath>
#include <future>
namespace raw::lwframe {
namespace {
float s2l(float c){ return c <= 0.04045f ? c / 12.92f : std::pow((c + 0.055f) / 1.055f, 2.4f); }
float l2s(float c){ return c <= 0.0031308f ? c * 12.92f : 1.055f * std::pow(c, 1.0f / 2.4f) - 0.055f; }
uint8_t q8(float v){ return uint8_t(std::clamp(v, 0.0f, 1.0f) * 255.0f + 0.5f); }

struct Maps { uint32_t w{0}, h{0}; std::vector<float> albedo, height, normal, rough, ao; };   // linear albedo rgb, normal xyz

bool load(const std::string& path, platform::Image16& im, std::string& err){ return platform::decodeImage(path, im, err); }

bool readSet(const MaterialSpec& m, Maps& o, std::string& err){
    platform::Image16 c, n, r, a, d;
    if (!load(m.dir + "/" + m.color, c, err) || !load(m.dir + "/" + m.normal, n, err) || !load(m.dir + "/" + m.rough, r, err)) return false;
    const bool hasAo = !m.ao.empty() && load(m.dir + "/" + m.ao, a, err), hasH = !m.disp.empty() && load(m.dir + "/" + m.disp, d, err);
    err.clear();
    o.w = c.width; o.h = c.height;
    const size_t np = size_t(o.w) * o.h;
    for (const platform::Image16* im : {&n, &r}) if (im->width != o.w || im->height != o.h){ err = "lwframe: maps of " + m.name + " differ in size"; return false; }
    o.albedo.resize(np * 3); o.normal.resize(np * 3); o.rough.resize(np); o.ao.assign(np, 1.0f); o.height.assign(np, 0.5f);
    for (size_t p = 0; p < np; ++p){
        for (int k = 0; k < 3; ++k) o.albedo[p * 3 + k] = s2l(c.rgba[p * 4 + k] / 65535.0f);
        float nx = n.rgba[p * 4] / 65535.0f * 2 - 1, ny = n.rgba[p * 4 + 1] / 65535.0f * 2 - 1, nz = n.rgba[p * 4 + 2] / 65535.0f * 2 - 1;
        if (m.normalDx) ny = -ny;
        const float l = std::sqrt(nx * nx + ny * ny + nz * nz) + 1e-9f;
        o.normal[p * 3] = nx / l; o.normal[p * 3 + 1] = ny / l; o.normal[p * 3 + 2] = nz / l;
        o.rough[p] = r.rgba[p * 4] / 65535.0f;
        if (hasAo && a.width == o.w && a.height == o.h) o.ao[p] = a.rgba[p * 4] / 65535.0f;
        if (hasH && d.width == o.w && d.height == o.h) o.height[p] = d.rgba[p * 4] / 65535.0f;
    }
    return true;
}

// both textures with all their mips; each level from the one above by a 2 x 2 box
void cook(const Maps& m, rhi::hw::FrameTexture& A, rhi::hw::FrameTexture& B){
    uint32_t w = m.w, h = m.h, mips = 1; while ((w >> mips) && (h >> mips)) ++mips;
    A = {m.w, m.h, mips, true, {}}; B = {m.w, m.h, mips, false, {}};
    std::vector<float> al = m.albedo, hg = m.height, nr = m.normal, rg = m.rough, ao = m.ao;
    for (uint32_t lv = 0; lv < mips; ++lv){
        for (size_t p = 0; p < size_t(w) * h; ++p){
            A.rgba.insert(A.rgba.end(), {q8(l2s(al[p * 3])), q8(l2s(al[p * 3 + 1])), q8(l2s(al[p * 3 + 2])), q8(hg[p])});
            const float l = std::sqrt(nr[p * 3] * nr[p * 3] + nr[p * 3 + 1] * nr[p * 3 + 1] + nr[p * 3 + 2] * nr[p * 3 + 2]) + 1e-6f;
            const float var = std::max(0.0f, (1.0f - l) / l), a = rg[p] * rg[p], rough = std::sqrt(std::sqrt(a * a + var));
            B.rgba.insert(B.rgba.end(), {q8(nr[p * 3] / l * 0.5f + 0.5f), q8(nr[p * 3 + 1] / l * 0.5f + 0.5f), q8(std::min(1.0f, rough)), q8(ao[p])});
        }
        if (lv + 1 == mips) break;
        const uint32_t w2 = std::max(1u, w / 2), h2 = std::max(1u, h / 2);
        auto down = [&](std::vector<float>& v, int comps){
            std::vector<float> o(size_t(w2) * h2 * comps);
            for (uint32_t y = 0; y < h2; ++y) for (uint32_t x = 0; x < w2; ++x) for (int k = 0; k < comps; ++k){
                float s = 0; for (uint32_t dy = 0; dy < 2; ++dy) for (uint32_t dx = 0; dx < 2; ++dx) s += v[(size_t(std::min(h - 1, y * 2 + dy)) * w + std::min(w - 1, x * 2 + dx)) * comps + k];
                o[(size_t(y) * w2 + x) * comps + k] = s * 0.25f;
            }
            v.swap(o);
        };
        down(al, 3); down(hg, 1); down(nr, 3); down(rg, 1); down(ao, 1);
        w = w2; h = h2;
    }
}
}  // namespace

bool cookMaterials(const std::vector<MaterialSpec>& specs, std::vector<rhi::hw::FrameTexture>& out, std::string& err){
    out.assign(specs.size() * 2, {});
    std::vector<std::future<std::string>> jobs;
    size_t next = 0;
    // four at a time: each set holds about 0.3 GB while it is decoded
    while (next < specs.size() || !jobs.empty()){
        while (next < specs.size() && jobs.size() < 4){
            const size_t i = next++;
            jobs.push_back(std::async(std::launch::async, [&, i]{
                Maps m; std::string e;
                if (specs[i].dir.empty()){ out[i * 2] = out[i * 2 + 1] = {1, 1, 1, false, {255, 255, 255, 255}}; return std::string(); }
                if (!readSet(specs[i], m, e)) return e;
                cook(m, out[i * 2], out[i * 2 + 1]);
                return std::string();
            }));
        }
        std::string e = jobs.front().get(); jobs.erase(jobs.begin());
        if (!e.empty()){ for (auto& j : jobs) j.wait(); err = e; return false; }
    }
    return true;
}

}  // namespace raw::lwframe
