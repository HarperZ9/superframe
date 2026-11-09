# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Checks on the checks: a kernel built with a planted defect must fail its equality suite."""
import pytest

from colourmix import controls


def test_every_kernel_has_a_planted_defect():
    assert {defect[1] for defect in controls.DEFECTS} == {"mayer", "lambert", "benson", "modern"}
    assert len(controls.DEFECTS) == 12


@pytest.mark.parametrize("defect", controls.DEFECTS, ids=[d[0] for d in controls.DEFECTS])
def test_planted_defect_is_caught(kernels, defect):
    cases, mismatches = controls.run(defect)
    assert cases > 0 and mismatches > 0


def test_a_defect_text_that_is_missing_is_an_error():
    with pytest.raises(ValueError):
        controls.mutated(("absent", "mayer", "text that is not in the source", ""))
