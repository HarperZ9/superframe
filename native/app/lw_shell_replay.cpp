// lw_shell_replay: replay a Low Water input trace on its tile, with no window or GPU (milestone N0);
// see raw/tools/lwshell_cmd.hpp and src/tools/lwshell/lwshell_replay.cpp.
#include "raw/tools/lwshell_cmd.hpp"
int main(int argc, char** argv){ return raw::lwShellReplayCommand(argc, argv); }
