# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Parsers on recorded sampler output. Live metering stays manual (it needs RAPL and an NVIDIA GPU).

fixtures/samplers-2026-10-30.json holds real stdout from typeperf, nvidia-smi and nvidia-smi pmon on
one Windows workstation. The power and attribution CSVs below are built in the exact format that
joules.log and attrib.Attributor write, since those are this package's own output.
"""
import io
import json
import math
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1]))

import joules as J  # noqa: E402

FIX = json.loads((HERE.parent / "fixtures" / "samplers-2026-10-30.json").read_text(encoding="utf-8"))


def lines(text):
    """Lines as subprocess.Popen(text=True) yields them: universal newlines, so CR LF becomes LF."""
    return list(io.StringIO(text, newline=None))


def test_typeperf_rows_parse_to_watts_and_the_header_is_skipped():
    got = [r for r in map(J.parse_cpu, lines(FIX["typeperf"])) if r]
    assert len(got) == 4
    assert got[0] == pytest.approx({"cpu_pkg_w": 117.150027012, "cpu_core_w": 115.490016245})
    for r in got:
        assert 0 < r["cpu_core_w"] <= r["cpu_pkg_w"] < 1000  # milliwatts were divided by 1000
    assert J.parse_cpu('"(PDH-CSV 4.0)","a","b"\n') == {}
    assert J.parse_cpu("Exiting, please wait...\n") == {}


def test_nvidia_smi_power_lines_parse():
    got = [r["gpu_w"] for r in map(J.parse_gpu, lines(FIX["nvidia_smi"])) if r]
    assert len(got) >= 4
    assert got[:3] == [56.30, 58.99, 60.24]
    assert all(20 < w < 700 for w in got)
    assert J.parse_gpu("[N/A]\n") == {}


def test_pmon_batches_split_on_repeated_pid_and_read_dash_as_zero():
    pytest.importorskip("psutil")
    import attrib
    batches = list(attrib.pmon_samples(lines(FIX["pmon"])))
    assert len(batches) == 1  # the second sample stays open: the stream ended without a header
    b = batches[0]
    assert len(b) == 18
    assert b[19260] == 4.0
    assert sum(1 for v in b.values() if v == 0.0) == 17


def test_sample_flags_stale_and_impossible_readings(monkeypatch):
    monkeypatch.setattr(J, "latest", {"cpu_pkg_w": (50.0, 10.0), "cpu_core_w": (60.0, 10.0),
                                      "gpu_w": (100.0, 7.0)})
    values, flags = J.sample(10.5)
    assert values == {"cpu_pkg_w": 50.0, "cpu_core_w": 60.0, "gpu_w": None}
    assert flags == ["stale_gpu_w", "core_gt_pkg"]


def test_total_integrates_by_trapezoid_and_skips_bad_rows(tmp_path):
    p = tmp_path / "power.csv"
    p.write_text("time,cpu_pkg_w,cpu_core_w,gpu_w,flags\n"
                 "2026-10-30T21:45:42,100.00,90.00,50.00,\n"
                 "2026-10-30T21:45:43,120.00,110.00,,stale_gpu_w\n"
                 "2026-10-30T21:45:43,999.00,999.00,999.00,\n"   # duplicate time: skipped
                 "not-a-time,1,1,1,\n"                           # malformed: skipped
                 "2026-10-30T21:45:45,80.00,70.00,60.00,\n", encoding="utf-8")
    j = J.total(str(p), "2026-10-30T21:45:42", "2026-10-30T21:45:45")
    assert math.isclose(j["cpu_pkg_w"], (100 + 120) / 2 + 2 * (120 + 80) / 2)
    assert math.isclose(j["cpu_core_w"], (90 + 110) / 2 + 2 * (110 + 70) / 2)
    assert j["gpu_w"] == 0.0  # each step touches the blank reading, so none integrates


def test_total_by_tag_sums_watts_times_span(tmp_path):
    pytest.importorskip("psutil")
    import attrib
    p = tmp_path / "procs.csv"
    p.write_text(",".join(attrib.FIELDS) + "\n"
                 "2026-10-30T21:45:42,2.00,2026-10-29-x,0.5000,40.00,0.250,25.00\n"
                 "2026-10-30T21:45:44,3.00,2026-10-29-x,0.5000,10.00,0.000,0.00\n"
                 "2026-10-30T21:45:44,3.00,idle,0.0000,20.00,0.000,30.00\n", encoding="utf-8")
    got = attrib.total_by_tag(str(p), "2026-10-30T21:45:40", "2026-10-30T21:45:50")
    assert got == {"2026-10-29-x": [110.0, 50.0], "idle": [60.0, 90.0]}
    assert attrib.Attributor.split(100.0, {"a": 0.25}, 20.0) == {"a": 20.0, "idle": 80.0}
