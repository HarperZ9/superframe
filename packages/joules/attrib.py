# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Split measured machine power across processes, grouped by study.

Allocation rule (a model, not a measurement): each scan (a process scan takes about
2 to 6 s on this machine, recorded per row as span_s), the mean CPU package watts are
split in proportion to each process's CPU time in that second, and GPU board watts
in proportion to each process's SM utilisation from `nvidia-smi pmon`. Whatever share
no process used goes to the tag "idle", so every row's tags sum to the measured total.
With --cpu-idle-w / --gpu-idle-w set, that baseline goes to "idle" first and only the
power above it is split (marginal attribution).

A process is tagged with the dated study directory in its command line or working
directory (2026-10-29-<name>), else with its executable name.

Known gaps: a process that starts and exits between two scans is never seen, so its
CPU time lands in "idle"; a process born mid-scan is counted from its creation. A
scan takes seconds, so short bursts are smeared across the scan's span. Child processes inherit
nothing: a worker whose command line names no study is tagged by its own name.
"""
import csv, os, re, subprocess, sys, threading, time

import psutil

# a dated study dir as the workspace names them: absolute or relative (../2026-10-29-x/...)
TAG_RE = re.compile(r"(?:^|[\\/\s\"';])(20\d{2}-\d{2}-\d{2}-[A-Za-z0-9_.-]+)")
FIELDS = ["time", "span_s", "tag", "cpu_share", "cpu_w", "gpu_sm", "gpu_w"]
gpu_sm = {}  # pid -> SM % from the latest pmon sample
gpu_lock = threading.Lock()


def tag_of(proc, depth=3):
    """Own study tag; a worker with none (or only the shared runner's) takes its parent's."""
    tag = own_tag(proc)
    if depth and (not tag.startswith("20") or tag.endswith("-pipelines")):
        try:
            parent = proc.parent()
        except (psutil.Error, OSError):
            parent = None
        if parent is not None:
            up = tag_of(parent, depth - 1)
            if up.startswith("20") and not up.endswith("-pipelines"):
                return up
    return tag


def own_tag(proc):
    """Dated study dir from the command line, else the working directory, else the exe name.
    The shared runner's dir (-pipelines) loses to any other study dir named alongside it."""
    try:
        name = proc.name()
    except (psutil.Error, OSError):
        return "unknown"
    for source in (lambda: " ".join(proc.cmdline()), proc.cwd):
        try:
            found = TAG_RE.findall(source())
        except (psutil.Error, OSError):
            continue
        # the shared runner lives in 2026-10-29-pipelines; the study is the other named dir
        studies = [d for d in found if not d.endswith("-pipelines")]
        if studies or found:
            return (studies or found)[-1]
    return name


def pmon_samples(lines):
    """Per-pid SM% batches from `nvidia-smi pmon -s u` output, one dict per finished sample.

    A sample ends at a header line or when a pid repeats; the last sample of a stream stays
    open until one of those arrives, so a closed stream drops it. A "-" reads as 0.0.
    """
    batch = {}
    for line in lines:
        if line.startswith("#"):
            if batch:
                yield batch
                batch = {}
            continue
        parts = line.split()
        if len(parts) >= 4 and parts[1].isdigit():
            pid = int(parts[1])
            if pid in batch:  # a repeated pid means the next sample has started
                yield batch
                batch = {}
            sm = parts[3]
            batch[pid] = float(sm) if sm.replace(".", "", 1).isdigit() else 0.0


def read_pmon():
    """Keep the newest per-pid SM% from a streaming pmon; log when it stops."""
    cmd = ["nvidia-smi", "pmon", "-s", "u", "-d", "1"]
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, text=True)
    except OSError as e:
        print(f"attrib: pmon failed to start: {e}", file=sys.stderr, flush=True)
        return
    for batch in pmon_samples(proc.stdout):
        with gpu_lock:
            gpu_sm.clear()
            gpu_sm.update(batch)
    print(f"attrib: pmon stopped with code {proc.wait()}", file=sys.stderr, flush=True)


class Attributor:
    def __init__(self, out, cpu_idle_w=None, gpu_idle_w=None):
        self.out, self.cpu_idle_w, self.gpu_idle_w = out, cpu_idle_w, gpu_idle_w
        self.prev = {}   # pid -> (cpu seconds, tag)
        self.prev_t = None
        self.prev_wall = None  # wall-clock time of the last scan, to count new processes
        self.ncpu = psutil.cpu_count() or 1
        threading.Thread(target=read_pmon, daemon=True).start()
        self.f = open(out, "a", newline="")
        self.w = csv.writer(self.f)
        if self.f.tell() == 0:
            self.w.writerow(FIELDS)

    def cpu_deltas(self, now):
        cur, deltas = {}, {}
        for p in psutil.process_iter(["cpu_times", "create_time"]):
            t = p.info["cpu_times"]
            if t is None:
                continue
            secs = t.user + t.system
            old = self.prev.get(p.pid)
            tag = old[1] if old else tag_of(p)
            cur[p.pid] = (secs, tag)
            if old and secs >= old[0]:
                deltas[tag] = deltas.get(tag, 0.0) + secs - old[0]
            elif not old and self.prev_wall and (p.info["create_time"] or 0) >= self.prev_wall:
                deltas[tag] = deltas.get(tag, 0.0) + secs  # born since the last scan
        self.prev_wall = time.time()
        span = (now - self.prev_t) if self.prev_t else None
        self.prev, self.prev_t = cur, now
        return deltas, span

    @staticmethod
    def split(total_w, shares, idle_w):
        """Watts per tag: idle baseline first (if set), the rest by share, leftover to idle."""
        if total_w is None:
            return {}
        base = min(idle_w, total_w) if idle_w is not None else 0.0
        used = sum(shares.values())
        out = {t: (total_w - base) * s for t, s in shares.items()}
        out["idle"] = out.get("idle", 0.0) + base + (total_w - base) * max(0.0, 1.0 - used)
        return out

    def step(self, stamp, cpu_w, gpu_w):
        deltas, span = self.cpu_deltas(time.monotonic())
        if not span:
            return  # first pass only primes the CPU-time baseline
        cpu_shares = {t: d / (span * self.ncpu) for t, d in deltas.items() if d > 0}
        with gpu_lock:
            sm = dict(gpu_sm)
        gpu_by_tag = {}
        for pid, pct in sm.items():
            if pct <= 0:
                continue
            try:
                tag = self.prev[pid][1] if pid in self.prev else tag_of(psutil.Process(pid))
            except (psutil.Error, OSError):
                tag = "unknown"
            gpu_by_tag[tag] = gpu_by_tag.get(tag, 0.0) + pct / 100.0
        cpu_split = self.split(cpu_w, cpu_shares, self.cpu_idle_w)
        gpu_split = self.split(gpu_w, gpu_by_tag, self.gpu_idle_w)
        for tag in sorted(set(cpu_split) | set(gpu_split)):
            cw, gw = cpu_split.get(tag, 0.0), gpu_split.get(tag, 0.0)
            if cw < 0.01 and gw < 0.01:
                continue
            self.w.writerow([stamp, f"{span:.2f}", tag, f"{cpu_shares.get(tag, 0.0):.4f}", f"{cw:.2f}",
                             f"{gpu_by_tag.get(tag, 0.0):.3f}", f"{gw:.2f}"])
        self.f.flush()


def total_by_tag(path, start, end, tag=None):
    """Joules per tag between start and end: mean watts over each row's span times the span."""
    import datetime as dt
    t0, t1 = dt.datetime.fromisoformat(start), dt.datetime.fromisoformat(end)
    joules = {}
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            if tag and tag.lower() not in row["tag"].lower():
                continue
            if t0 <= dt.datetime.fromisoformat(row["time"]) <= t1:
                j = joules.setdefault(row["tag"], [0.0, 0.0])
                span = float(row["span_s"])
                j[0] += float(row["cpu_w"]) * span
                j[1] += float(row["gpu_w"]) * span
    return joules
