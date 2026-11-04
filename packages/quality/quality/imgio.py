# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Shared image loading for the quality tools.

load(path) returns (rgb, bits): rgb is a float64 array H x W x 3 in code values
of the file's own depth (0..255 for 8-bit, 0..65535 for 16-bit), bits is 8 or 16.
Alpha is dropped after compositing over black, which is how a canvas on a dark
page reads. EXR is read through OpenCV when it was built with OpenEXR support.
"""
from __future__ import annotations

import os

import cv2
import numpy as np

os.environ.setdefault("OPENCV_IO_ENABLE_OPENEXR", "1")


def load(path: str):
    img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if img is None:
        raise FileNotFoundError(f"cannot decode image: {path}")
    if img.dtype == np.uint16:
        bits = 16
    elif img.dtype in (np.float32, np.float64):
        bits = 32
    else:
        bits = 8
    img = img.astype(np.float64)
    if img.ndim == 2:
        img = np.stack([img] * 3, axis=-1)
    if img.shape[2] == 4:
        a = img[..., 3:4] / (65535.0 if bits == 16 else 255.0 if bits == 8 else 1.0)
        img = img[..., :3] * a
    img = img[..., ::-1].copy()  # BGR to RGB
    return img, bits


def luma(rgb: np.ndarray) -> np.ndarray:
    """Rec. 709 luma on code values (no linearisation; matches how banding is seen on screen)."""
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def to8(rgb: np.ndarray, bits: int) -> np.ndarray:
    if bits == 8:
        return rgb
    if bits == 16:
        return rgb / 257.0
    return np.clip(rgb, 0, 1) * 255.0


def crop(rgb: np.ndarray, box):
    if not box:
        return rgb
    x, y, w, h = box
    return rgb[y:y + h, x:x + w]
