// The shell's loop (see lwshell_run.hpp). Each frame: wait on the swapchain's frame latency object,
// pump the window and read the devices, advance the game in fixed ticks of 1/60 s for the real time
// that passed, draw and present. Every tick's input is kept, so the run can be written as an input
// trace and replayed to the same state hash.
#include "lwshell_run.hpp"
#include "lwshell_frametrace.hpp"
#include "lwshell_render.hpp"
#include "lwshell_tier.hpp"
#include "lwshell_trace.hpp"
#include "raw/platform/input.hpp"
#include "raw/platform/window.hpp"
#include "raw/rhi/hw.hpp"
#include "raw/rhi/rhi.hpp"
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <memory>
namespace raw::lwshell {
namespace {
using Clock = std::chrono::steady_clock;
constexpr double kTickS = 1.0 / 60.0;
constexpr int kMaxTicksPerFrame = 8;
std::string baseName(const std::string& p){
    const size_t s = p.find_last_of("/\\");
    return s == std::string::npos ? p : p.substr(s + 1);
}
int fail(int code, const std::string& what){ std::fprintf(stderr, "lw_shell: %s\n", what.c_str()); return code; }

class Shell {
public:
    explicit Shell(const Options& o) : o_(o), t0_(Clock::now()) { sum_.mainEntryMs = platform::processUptimeMs(); }
    int run();
private:
    int load();
    int openDevices();
    void chooseGraphics();
    bool pumpWindow();
    void advance(const Tick& live);
    bool drawFrame(const LwView& v);
    void record(Clock::time_point fs, Clock::time_point fw, Clock::time_point fi, Clock::time_point fsim, Clock::time_point fp);
    int finish();
    double us(Clock::time_point t) const { return std::chrono::duration<double, std::micro>(t - t0_).count(); }

    const Options& o_;
    const Clock::time_point t0_;
    std::string err_, tileBytes_, capsJson_;
    InputTrace replay_, rec_;
    Game game_;
    LwView spawn_{};
    std::unique_ptr<platform::Window> win_;
    std::unique_ptr<rhi::Device> dev_;
    std::unique_ptr<rhi::Swapchain> sc_;
    Renderer r_;
    Summary sum_;
    std::vector<Zone> zones_;
    std::vector<GpuZone> gz_;
    double acc_{0};
    Clock::time_point last_{}, lastPresent_{};
    uint64_t frame_{0}, tick_{0};
    bool quit_{false}, walking_{false};
};

int Shell::load(){
    if (!readFile(o_.tile, tileBytes_)) return fail(2, "cannot read the tile " + o_.tile);
    if (!o_.replay.empty()){
        std::string text;
        if (!readFile(o_.replay, text) || !readTrace(text, replay_, err_)) return fail(2, o_.replay + ": " + err_);
    }
    if (!game_.open(tileBytes_, o_.cell, err_)) return fail(2, err_);
    spawn_ = game_.view();
    rec_.tile = baseName(o_.tile); rec_.tileHash = fnv1a(tileBytes_.data(), tileBytes_.size()); rec_.cell = o_.cell;
    return 0;
}

// The graphics tier, chosen once from the adapter; every later system branches on it.
void Shell::chooseGraphics(){
    const rhi::hw::Probe caps = rhi::hw::probe(*dev_);
    std::string want = o_.tier;
    if (want.empty()){ const char* env = std::getenv("LW_TIER"); if (env) want = env; }
    const TierChoice tier = chooseTier(caps, want);
    std::printf("graphics: tier %s on %s (%s)", tierName(tier.tier), caps.adapter.c_str(), tier.reason.c_str());
    if (!want.empty()) std::printf(", override %s: %s", want.c_str(), tier.overrideResult.c_str());
    std::printf("\n");
    capsJson_ = capabilitiesJson(caps, tier);
}

int Shell::openDevices(){
    platform::WindowDesc wd; wd.title = "Low Water"; wd.width = o_.width; wd.height = o_.height; wd.visible = !o_.hidden;
    win_ = platform::createWindow(wd, err_);
    if (!win_){ std::printf("SKIP: %s\n", err_.c_str()); return 77; }
    dev_ = rhi::createDevice(err_);
    if (!dev_){ std::printf("SKIP: %s\n", err_.c_str()); return 77; }
    chooseGraphics();
    if (!o_.caps.empty() && !writeFile(o_.caps, capsJson_ + "\n")) return fail(3, "cannot write " + o_.caps);
    rhi::SwapchainDesc sd;
    sd.window = win_->native().window; sd.width = win_->clientWidth(); sd.height = win_->clientHeight();
    sd.allowTearing = o_.syncInterval == 0; sd.waitable = true;
    sc_ = dev_->createSwapchain(sd, err_);
    if (!sc_) return fail(3, err_);
    if (!r_.init(*dev_, sc_->format(), game_.raw(), sc_->width(), sc_->height(), err_)) return fail(3, err_);
    if (o_.fullscreen) win_->setFullscreen(true);
    const rhi::AdapterInfo& a = dev_->adapter();
    sum_.adapter = a.description + " (driver " + a.driver + ")"; sum_.backend = dev_->backendName();
    sum_.input = o_.replay.empty() ? (o_.autowalk ? "autowalk script" : platform::inputBackend()) : "input trace " + baseName(o_.replay);
    sum_.tile = baseName(o_.tile); sum_.syncInterval = o_.syncInterval; sum_.warmup = o_.warmup;
    sum_.refreshHz = sc_->refreshHz(); sum_.terrainTriangles = r_.terrainTriangles(); sum_.capabilities = capsJson_;
    return 0;
}

bool Shell::pumpWindow(){
    for (const platform::WindowEvent& e : win_->pump()){
        using K = platform::WindowEvent::Kind;
        if (e.kind == K::CloseRequested) quit_ = true;
        else if (e.kind == K::ToggleFullscreen) win_->setFullscreen(!win_->fullscreen());
        else if ((e.kind == K::Resized || e.kind == K::Restored) && e.width && e.height){
            if (!sc_->resize(e.width, e.height, err_) || !r_.resize(*dev_, e.width, e.height, err_)) return false;
        }
    }
    return true;
}

// Fixed ticks for the real time that passed, at most kMaxTicksPerFrame (a long stall drops the
// backlog instead of spiralling). The input of each tick comes from the trace, the script or the devices.
void Shell::advance(const Tick& live){
    const Clock::time_point now = Clock::now();
    acc_ += std::fmin(std::chrono::duration<double>(now - last_).count(), 0.25);
    last_ = now;
    int steps = 0;
    while (acc_ >= kTickS && steps < kMaxTicksPerFrame && !(o_.ticks && tick_ >= o_.ticks)){
        Tick t = live;
        if (!o_.replay.empty()){
            if (tick_ >= replay_.ticks.size()){ quit_ = true; break; }
            t = replay_.ticks[size_t(tick_)];
        } else if (o_.autowalk) t = autowalk(tick_);
        game_.step(t);
        rec_.ticks.push_back(t);
        ++tick_; ++steps; acc_ -= kTickS;
    }
    if (steps == kMaxTicksPerFrame) acc_ = 0;
    if (o_.ticks && tick_ >= o_.ticks) quit_ = true;
}

bool Shell::drawFrame(const LwView& v){
    if (win_->minimised()) return true;
    const std::string shot = frame_ == o_.shotFrame ? o_.shot : std::string();
    rhi::PresentStatus ps{};
    if (!r_.frame(*dev_, *sc_, v, o_.syncInterval, shot, gz_, ps, err_)){ err_ = "frame " + std::to_string(frame_) + ": " + err_; return false; }
    if (ps == rhi::PresentStatus::DeviceLost){ err_ = "the device was lost"; return false; }
    return true;
}

void Shell::record(Clock::time_point fs, Clock::time_point fw, Clock::time_point fi, Clock::time_point fsim, Clock::time_point fp){
    if (sum_.firstPresentMs < 0) sum_.firstPresentMs = platform::processUptimeMs();
    const LwView v = game_.view();
    if (!walking_ && std::fabs(v.x - spawn_.x) + std::fabs(v.z - spawn_.z) > 0.01){ walking_ = true; sum_.walkingMs = platform::processUptimeMs(); }
    if (frame_ >= o_.warmup && lastPresent_ != Clock::time_point{})
        sum_.intervalsMs.push_back(std::chrono::duration<double, std::milli>(fp - lastPresent_).count());
    lastPresent_ = fp;
    zones_.push_back({"cpu.wait", 1, us(fs), us(fw) - us(fs), frame_});
    zones_.push_back({"cpu.input", 1, us(fw), us(fi) - us(fw), frame_});
    zones_.push_back({"cpu.sim", 1, us(fi), us(fsim) - us(fi), frame_});
    zones_.push_back({"cpu.render_submit_present", 1, us(fsim), us(fp) - us(fsim), frame_});
    for (const GpuZone& g : gz_) zones_.push_back({g.name, 2, us(fsim) + g.startMs * 1e3, g.durMs * 1e3, frame_});
}

int Shell::finish(){
    sum_.frames = frame_; sum_.ticks = tick_; sum_.width = sc_->width(); sum_.height = sc_->height();
    sum_.finalHash = game_.hash();
    rec_.hasHash = true; rec_.finalHash = sum_.finalHash;
    r_.release(*dev_);
    sc_.reset();
    if (!o_.record.empty() && !writeFile(o_.record, writeTrace(rec_))) return fail(3, "cannot write " + o_.record);
    if (!o_.trace.empty() && !writeFile(o_.trace, frameTraceJson(sum_, zones_))) return fail(3, "cannot write " + o_.trace);
    std::printf("lw_shell: %llu frames, %llu ticks on %s\n", (unsigned long long)frame_, (unsigned long long)tick_, sum_.adapter.c_str());
    std::printf("cold start (process creation to): main %.1f ms, first present %.1f ms, walking %.1f ms\n", sum_.mainEntryMs, sum_.firstPresentMs, sum_.walkingMs);
    std::printf("present interval: p50 %.3f ms, p99 %.3f ms over %zu frames\n", percentile(sum_.intervalsMs, 0.5), percentile(sum_.intervalsMs, 0.99), sum_.intervalsMs.size());
    std::printf("state hash %s\n", hex64(sum_.finalHash).c_str());
    if (o_.replay.empty()) return 0;
    const bool full = tick_ == replay_.ticks.size();
    const bool same = full && replay_.hasHash && sum_.finalHash == replay_.finalHash;
    std::printf("replay of %s: %s (recorded %s)\n", baseName(o_.replay).c_str(), same ? "same hash" : full ? "DIFFERENT hash" : "did not reach the last tick",
                hex64(replay_.finalHash).c_str());
    return same ? 0 : 1;
}

int Shell::run(){
    if (const int rc = load()) return rc;
    if (const int rc = openDevices()) return rc;
    last_ = Clock::now();
    while (!quit_){
        const Clock::time_point fs = Clock::now();
        if (!sc_->waitForFrame(1000)) std::fprintf(stderr, "lw_shell: frame %llu: swapchain wait timed out\n", (unsigned long long)frame_);
        const Clock::time_point fw = Clock::now();
        if (!pumpWindow()) return fail(3, err_);
        const platform::InputSnapshot snap = platform::pollInput(win_->nativeHandle());
        if (o_.replay.empty() && !o_.autowalk && quitRequested(snap)) quit_ = true;
        const Clock::time_point fi = Clock::now();
        advance(mapInput(snap));
        const Clock::time_point fsim = Clock::now();
        if (!drawFrame(game_.view())) return fail(3, err_);
        record(fs, fw, fi, fsim, Clock::now());
        ++frame_;
        if (o_.frames && frame_ >= o_.frames) quit_ = true;
    }
    return finish();
}
}  // namespace

int runShell(const Options& o){ Shell s(o); return s.run(); }
}  // namespace raw::lwshell
