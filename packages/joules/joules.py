# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Meter the machine's power and count joules.

Sources, each sampled about once a second:
  cpu_pkg_w   Intel RAPL package power, from the Windows "Energy Meter" counters (reported in mW)
  cpu_core_w  RAPL PP0 (cores only), same source
  gpu_w       NVIDIA board power, from nvidia-smi

Not measured: drives, fans, RAM (the DRAM RAPL domain reads 0 on this board), PSU loss.
Totals undercount wall power by that much.

  python joules.py log  [--out PATH] [--procs PATH]      append samples until stopped;
                                                          --procs also splits watts by study
  python joules.py sum  --start ISO --end ISO [--out PATH]  joules per source in a window
  python joules.py sum  --start ISO --end ISO --procs PATH [--tag TEXT]
                                                          joules per study tag (see attrib.py)
  python joules.py nvml                                   NVML total-energy counter support and value

GPU energy for a timed window: prefer nvml.Window (the counter's difference between the window's ends,
2026-10-30, after Yang, Adamek and Armour 2023). The logged gpu_w column stays for whole-machine
history; integrating it undercounts or overcounts short bursts (S3 study, FINDINGS).
"""
import argparse, csv, datetime as dt, os, subprocess, sys, threading, time

# JOULES_POWER_CSV names the log; the default sits in the gitignored out/ folder beside this file
DEFAULT_OUT = os.environ.get("JOULES_POWER_CSV") or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "out", "power.csv")
FIELDS = ["time", "cpu_pkg_w", "cpu_core_w", "gpu_w", "flags"]
STALE_S = 1.5  # a reading older than this is not written again
# Each value is device-reported (RAPL, nvidia-smi), not witnessed: nvidia-smi samples
# only part of runtime, and the two RAPL counters are read in one typeperf query.
latest = {"cpu_pkg_w": (None, 0.0), "cpu_core_w": (None, 0.0), "gpu_w": (None, 0.0)}
recent = []  # (cpu_pkg_w, gpu_w) per logged second, drained by the attribution thread
recent_lock = threading.Lock()


def stream(name, cmd, parse):
    """Run a sampler and keep its newest values with the time they arrived; log when it dies."""
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, text=True)
    except OSError as e:
        print(f"joules: {name} failed to start: {e}", file=sys.stderr, flush=True)
        return
    for line in proc.stdout:
        for key, value in parse(line).items():
            latest[key] = (value, time.monotonic())
    print(f"joules: {name} stopped with code {proc.wait()}", file=sys.stderr, flush=True)


def parse_cpu(line):
    row = next(csv.reader([line]), [])
    if len(row) != 3:
        return {}
    try:
        return {"cpu_pkg_w": float(row[1]) / 1000.0, "cpu_core_w": float(row[2]) / 1000.0}
    except ValueError:
        return {}  # header row or a PDH message


def parse_gpu(line):
    try:
        return {"gpu_w": float(line.strip())}
    except ValueError:
        return {}


def read_cpu():
    stream("cpu", ["typeperf", r"\Energy Meter(rapl_package0_pkg)\Power",
                   r"\Energy Meter(rapl_package0_pp0)\Power", "-si", "1"], parse_cpu)


def read_gpu():
    stream("gpu", ["nvidia-smi", "--query-gpu=power.draw", "--format=csv,noheader,nounits",
                   "-l", "1"], parse_gpu)


def sample(now):
    """One row: fresh values only, plus flags for anything a reader should not trust."""
    values, flags = {}, []
    for key, (value, at) in latest.items():
        fresh = value is not None and now - at <= STALE_S
        values[key] = value if fresh else None
        if value is not None and not fresh:
            flags.append(f"stale_{key}")
    pkg, core = values["cpu_pkg_w"], values["cpu_core_w"]
    if pkg is not None and core is not None and core > pkg:
        flags.append("core_gt_pkg")  # physically impossible; the counters were read out of step
    return values, flags


def log(out, procs=None, cpu_idle_w=None, gpu_idle_w=None):
    for reader in (read_cpu, read_gpu):
        threading.Thread(target=reader, daemon=True).start()
    if procs:  # its own thread, so a slow process scan never delays the main log
        from attrib import Attributor
        attributor = Attributor(procs, cpu_idle_w, gpu_idle_w)
        threading.Thread(target=attribute_loop, args=(attributor,), daemon=True).start()
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    new = not os.path.exists(out)
    with open(out, "a", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(FIELDS)
        while True:
            time.sleep(1.0)
            values, flags = sample(time.monotonic())
            stamp = dt.datetime.now().isoformat(timespec="seconds")
            w.writerow([stamp] +
                       ["" if values[k] is None else f"{values[k]:.2f}" for k in FIELDS[1:4]] +
                       [";".join(flags)])
            f.flush()
            with recent_lock:
                recent.append((values["cpu_pkg_w"], values["gpu_w"]))


def mean(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def attribute_loop(attributor):
    while True:
        time.sleep(1.0)
        with recent_lock:
            batch = recent[:]
            recent.clear()
        stamp = dt.datetime.now().isoformat(timespec="seconds")
        try:  # the scan itself takes seconds; the watts are the mean over that span
            attributor.step(stamp, mean(c for c, _ in batch), mean(g for _, g in batch))
        except Exception as e:  # attribution must never stop the main log
            print(f"joules: attribution failed at {stamp}: {e!r}", file=sys.stderr, flush=True)


def total(out, start, end):
    """Integrate watts over time (trapezoid rule) between start and end."""
    t0, t1 = dt.datetime.fromisoformat(start), dt.datetime.fromisoformat(end)
    joules = {k: 0.0 for k in FIELDS[1:4]}
    prev = None
    with open(out, newline="") as f:
        for row in csv.DictReader(f):
            try:
                t = dt.datetime.fromisoformat(row["time"])
            except (TypeError, ValueError):
                print(f"joules: skipped malformed row {row!r}", file=sys.stderr)
                continue
            if prev is not None and t <= prev[0]:
                continue  # duplicate or out-of-order timestamp
            if not t0 <= t <= t1:
                continue
            if prev is not None:
                step = (t - prev[0]).total_seconds()
                for k in joules:
                    if row[k] and prev[1][k]:
                        joules[k] += step * (float(row[k]) + float(prev[1][k])) / 2
            prev = (t, row)
    return joules


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("mode", choices=["log", "sum", "nvml"])
    p.add_argument("--out", default=DEFAULT_OUT)
    p.add_argument("--start")
    p.add_argument("--end")
    p.add_argument("--procs", help="per-process attribution CSV")
    p.add_argument("--tag", help="sum only tags containing this text")
    p.add_argument("--cpu-idle-w", type=float, help="CPU baseline kept out of the split")
    p.add_argument("--gpu-idle-w", type=float, help="GPU baseline kept out of the split")
    a = p.parse_args()
    if a.mode == "log":
        log(a.out, a.procs, a.cpu_idle_w, a.gpu_idle_w)
        return
    if a.mode == "nvml":
        import nvml
        mj = nvml.total_energy_mj()
        print(f"total-energy counter: {'supported' if mj is not None else 'NOT supported'}"
              + (f", {mj / 1000.0:.1f} J since driver load; power now {nvml.power_mw() / 1000.0:.1f} W" if mj else ""))
        return
    if not (a.start and a.end):
        sys.exit("sum needs --start and --end")
    if a.procs:
        from attrib import total_by_tag
        for tag, (cj, gj) in sorted(total_by_tag(a.procs, a.start, a.end, a.tag).items(),
                                    key=lambda kv: -sum(kv[1])):
            print(f"{tag:40s} cpu {cj:10.1f} J  gpu {gj:10.1f} J  total {(cj + gj) / 3600:.3f} Wh")
        return
    j = total(a.out, a.start, a.end)
    j["machine_measured"] = j["cpu_pkg_w"] + j["gpu_w"]
    for k, v in j.items():
        print(f"{k:18s} {v:12.1f} J  ({v / 3600:.3f} Wh)")


if __name__ == "__main__":
    main()
