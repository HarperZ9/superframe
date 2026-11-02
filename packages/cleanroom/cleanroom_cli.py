# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Launcher: python -I packages/cleanroom/cleanroom_cli.py <command> ...
-I keeps the current directory and PYTHONPATH off sys.path, so this file adds only its own folder."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cleanroom.__main__ import main  # noqa: E402

main()
