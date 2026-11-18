#pragma once
// Low Water's native shell, milestone N0 (src/tools/lwshell/, games/low-water/runtime/README.md).
//   lwShellCommand        the game on Windows: window, devices, D3D12, input and frame traces
//   lwShellReplayCommand  replay an input trace on its tile with no window or GPU
namespace raw {
int lwShellCommand(int argc, char** argv);
int lwShellReplayCommand(int argc, char** argv);
}
