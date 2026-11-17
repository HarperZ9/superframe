// The five scenes of the AO comparison: see ao_scenes.hpp.
#include "ao_scenes.hpp"
#include "raw/tools/cli_params.hpp"
#include "raw/tools/model_scene.hpp"
#include "raw/tools/owned_assets.hpp"
namespace raw::aobench {

std::vector<std::pair<std::string, Scene>> scenes(int w, int h) {
    CliParams p; p.width = w; p.height = h;
    std::vector<std::pair<std::string, Scene>> out{{"test-scene", sceneFromParams(p, nullptr)}};
    out.push_back({"test-scene-near", out[0].second});
    out[1].second.camera.eye = {1.8f, 3.2f, 2.4f};
    out[1].second.camera.center = {0.8f, 0.2f, 1.0f};
    out.push_back({"raw-hero", owned::inTestScene(owned::hero(), w, h)});
    const owned::Asset hall = owned::hall();
    out.push_back({"raw-hall-nave", owned::hallScene(hall)});
    out.push_back({"raw-hall-gallery", owned::hallScene(hall, true)});
    // Every camera gets the frame's aspect, so a wide frame widens the view rather than stretching it.
    for (auto& s : out) s.second.camera.aspect = float(w) / float(h);
    return out;
}

}  // namespace raw::aobench
