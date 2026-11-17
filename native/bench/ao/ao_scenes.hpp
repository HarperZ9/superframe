#pragma once
// The five scenes of the AO comparison (bench/ao/README.md), at any size: the built-in test
// scene from its own camera and from the near camera, raw-hero in the test scene, and raw-hall
// from its nave and its gallery. The same five scenes tests/test_post.cpp checks GTAO on.
#include "raw/scene/scene.hpp"
#include <string>
#include <utility>
#include <vector>
namespace raw::aobench {

std::vector<std::pair<std::string, Scene>> scenes(int w, int h);

}  // namespace raw::aobench
