// The host-frame check's record as JSON: see raw/renderer/host_frame.hpp.
#include "raw/renderer/host_frame.hpp"
#include <cstdio>
namespace raw::gpu_check {
namespace {
std::string esc(const std::string& in) {
    std::string o;
    for (char ch : in) { if (ch == '"' || ch == '\\') o += '\\'; o += ch == '\n' ? ' ' : ch; }
    return o;
}
const char* tf(bool x) { return x ? "true" : "false"; }
}  // namespace

std::string HostFrame::json() const {
    std::string s = "{\n \"check\": \"host frame\",\n \"backend\": \"" + backend + "\",\n \"adapter\": \"" + esc(adapter) + "\",\n \"host_adapter\": \"" +
                    esc(hostAdapter) + "\",\n \"error\": \"" + esc(error) + "\",\n \"skipped\": \"" + esc(skipped) + "\",\n";
    char t[1024];
    std::snprintf(t, sizeof t,
                  " \"size\": %d,\n"
                  " \"adoption\": {\"refuses_a_host_with_no_device\": %s, \"reports_the_host_adapter\": %s, \"import_refuses_a_wrong_format\": %s},\n"
                  " \"frame\": {\"pass\": \"post_gtao\", \"pixels\": %ld, \"gtao_outside_1e-3\": %ld, \"gtao_worst\": %.3e, \"host_fence_signalled\": %s, \"within_bound\": %s},\n"
                  " \"controls_fail\": {\"target_before_the_pass\": %s, \"fence_value_never_signalled\": %s, \"wrong_initial_state\": %s},\n"
                  " \"fence_control\": {\"asked_ms\": 750, \"answered_ms\": %u, \"begin_refused_while_pending\": %s, \"ended_after_host_signal\": %s},\n"
                  " \"state_control\": {\"right_state_passes\": %s, \"message\": \"",
                  size, tf(adoptRefusesNothing), tf(sameAdapter), tf(importRefusesWrongFormat), pixels, gtaoOutside, gtaoWorst, tf(fenceSignalled), tf(frame()),
                  tf(targetBeforeDiffers), tf(unsignalledTimesOut), tf(wrongStateFails), unsignalledWaitMs, tf(unsignalledBlocksBegin), tf(releasedRetires),
                  tf(rightStatePasses));
    s += t + esc(wrongStateMessage) + "\"},\n";
    std::snprintf(t, sizeof t, " \"ownership\": {\"textures_survive\": %s, \"host_objects_released\": %s},\n \"pass\": %s\n}\n", tf(texturesSurvive),
                  tf(hostObjectsReleased), tf(pass()));
    return s + t;
}
}  // namespace raw::gpu_check
