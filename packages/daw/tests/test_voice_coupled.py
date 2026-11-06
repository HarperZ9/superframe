# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Folds coupled to a time-domain tract, the nasal branch, and the oesophageal voice."""
import sys
from pathlib import Path

import numpy as np
from scipy.signal import find_peaks

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import folds as G  # noqa: E402
from daw import kl_tract as K  # noqa: E402
from daw import tract as T  # noqa: E402
from daw import voice as V  # noqa: E402

FS, C = 48000, 352.0
OPEN = (np.r_[np.full(9, 1e-4), np.full(8, 7e-4)], np.full(17, 0.01))


def test_waveguide_tract_rings_at_the_chain_matrix_formants():
    for areas, lengths in (V.uniform_tract(), OPEN):
        sec = K.resample_area(areas, lengths, C, FS)
        tract = K.Tract(sec, c=C)
        y = np.array([tract.step(1.0 if i == 0 else 0.0)[1] for i in range(FS)])
        fr = np.fft.rfftfreq(len(y), 1 / FS)
        pk, _ = find_peaks(20 * np.log10(np.abs(np.fft.rfft(y)) + 1e-12), prominence=10)
        want = [f for f, _ in T.formants_and_bandwidths(sec, np.full(len(sec), C / FS), C, lips=False)[:3]]
        assert np.allclose(fr[pk][:3], want, rtol=0.02), (fr[pk][:3], want)


def test_the_tract_pushes_back_on_the_folds():
    areas, lengths = V.uniform_tract()
    a, u, _ = K.coupled(800.0, 0.25, FS, areas, lengths)
    f0 = G.pitch_and_open_quotient(a, FS)[0]
    assert K.flow_skew(a, u, FS, f0) > 0.03                    # the flow peak lags the opening
    a0, u0, _ = K.coupled(800.0, 0.25, FS, areas, lengths, coupled=False)
    f00 = G.pitch_and_open_quotient(a0, FS)[0]
    assert K.flow_skew(a0, u0, FS, f00) < 0.01                 # planted: no tract load, no lag


def test_nasal_branch_puts_an_antiresonance_at_c_over_2l():
    areas, lengths = V.uniform_tract()
    f = np.arange(50.0, 4000.0, 1.0)
    nas = (8, np.full(10, 2e-4), np.full(10, 0.011))
    h = np.abs(T.transfer(f, areas, lengths, C, nasal=nas))
    h0 = np.abs(T.transfer(f, areas, lengths, C))
    band = (f > 1200) & (f < 2000)
    zero = f[band][np.argmin(h[band])]
    assert abs(zero / (C / (2 * 0.11)) - 1) < 0.01
    i = int(np.argmin(np.abs(f - zero)))
    assert 20 * np.log10(h0[i] / h[i]) > 20                    # without the branch nothing is cancelled there


def test_oesophageal_voice_is_low_and_stops_when_the_air_runs_out():
    fs = 16000
    a, u, end = G.oesophageal(600.0, 40e-6, 1.0, fs)
    f0 = G.pitch_and_open_quotient(a[:int(end * fs)], fs)[0]
    assert abs(f0 / G.pe_linear_frequencies()[0] - 1) < 0.15 and f0 < 0.5 * G.linear_frequencies()[0]
    assert end is not None and abs(u[:int(end * fs)].sum() / fs - 40e-6) < u.max() / fs
    _, _, end2 = G.oesophageal(600.0, 80e-6, 1.0, fs)
    assert abs(end2 / end - 2) < 0.15                          # twice the air, about twice as long
