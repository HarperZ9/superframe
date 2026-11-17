#pragma once
// The GPU side of the AO comparison (bench/ao/README.md): one frame's inputs as ao_export wrote
// them, and the runners for our passes and for XeGTAO. Each runner dispatches its whole chain
// `iters` times with a timestamp pair around each repeat, then reads the last result back.
#include "dx.hpp"
#include <string>
#include <vector>
namespace raw::aobench {

struct Frame {
    std::string name;
    int w{0}, h{0};
    double tanHalf{0}, aspect{1}, nearZ{0.1}, farZ{100}, radius{0.5};
    int rays{0};
    std::vector<float> gbuf;      // 8 floats a pixel (ao_export.cpp)
    std::vector<float> ref;       // the ray-cast reference
    std::vector<uint8_t> valid;   // geometry drawn
};
bool loadFrame(const std::string& dir, const std::string& line, Frame& f, std::string& err);

struct Run {
    std::vector<float> ao;        // visibility a pixel, 1 where nothing was drawn
    std::vector<double> ms;       // GPU time of each repeat, milliseconds
};
// A compiled shader: the bytes of DIR/<file>.cso.
bool loadCso(const std::string& dir, const std::string& file, std::vector<char>& out, std::string& err);
ComPtr<ID3D12PipelineState> pipeline(Dx& dx, ID3D12RootSignature* root, const std::vector<char>& cso);

// Our GTAO pass (src/renderer/gpu/shaders/hlsl/post_gtao.hlsl) or a variant with its layout.
struct OursConfig { std::string name, shader{"post_gtao"}; int slices{16}, steps{16}; double radius{0.5}; };
bool runOurs(Dx& dx, const std::string& csoDir, const Frame& f, const OursConfig& c, int iters, Run& out);

// XeGTAO: prefilter, main pass and one denoise pass. defaults: the shipped heuristics
// (XE_GTAO_USE_DEFAULT_CONSTANTS 1); otherwise radius multiplier, falloff and final power as set.
struct XeConfig {
    std::string name;
    bool defaults{true};
    int quality{2};               // 0 low, 1 medium, 2 high, 3 ultra
    bool denoise{true};
    float radiusMultiplier{1.0f}, falloffRange{0.1f}, finalValuePower{1.0f};
};
bool runXe(Dx& dx, const std::string& csoDir, const Frame& f, const XeConfig& c, int iters, Run& out);

}  // namespace raw::aobench
