# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Standard-library reference for the named RGB spaces (bld/rgbspace.bld, bld/transfer.bld).

Every expression keeps the operation order of the kernel, so a Python float and the kernel's f64 carry the
same bits. Spaces: 0 sRGB, 1 Display P3, 2 Rec. 2020. Whites: 0 D65, 1 D50.
"""
OK, OUTSIDE, BAD_NAME = 0, 2, 6

# Chromaticities in ten-thousandths: x and y of red, green, blue, then of the D65 white.
XY = (
    (6400, 3300, 3000, 6000, 1500, 600, 3127, 3290),    # sRGB, IEC 61966-2-1
    (6800, 3200, 2650, 6900, 1500, 600, 3127, 3290),    # Display P3, SMPTE EG 432-1 primaries, D65
    (7080, 2920, 1700, 7970, 1310, 460, 3127, 3290),    # Rec. 2020, ITU-R BT.2020
)
BRADFORD = (8951, 2664, -1614, -7502, 17135, 367, 389, -685, 10296)
D50 = (9642, 10000, 8249)                               # ICC.1:2010 profile connection white


def _i64(value):
    if isinstance(value, bool) or not isinstance(value, int) or not -2 ** 63 <= value < 2 ** 63:
        raise TypeError("the kernel takes whole numbers of 64 bits here")
    return value


def _f64(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError("the kernel takes a float here")
    if isinstance(value, int) and abs(value) > 2 ** 53:
        raise ValueError("a whole number this large has no exact float")
    return float(value)


def _tenk(k):
    return float(k) / float(10000)


def _col(space, j, c):
    x = _tenk(XY[space][2 * j])
    y = _tenk(XY[space][2 * j + 1])
    if c == 0:
        return x / y
    if c == 1:
        return 1.0
    return (1.0 - x - y) / y


def _det3(a, b, c, d, e, f, g, h, i):
    return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)


def _solve3(k, m, x, y, z):
    a, b, c, d, e, f, g, h, i = m
    den = _det3(a, b, c, d, e, f, g, h, i)
    if k == 0:
        return _det3(x, b, c, y, e, f, z, h, i) / den
    if k == 1:
        return _det3(a, x, c, d, y, f, g, z, i) / den
    return _det3(a, b, x, d, e, y, g, h, z) / den


def _amount(space, k, x, y, z):
    m = [_col(space, j, c) for c in range(3) for j in range(3)]
    return _solve3(k, m, x, y, z)


def _scale(space, k):
    return _amount(space, k, _col(space, 3, 0), _col(space, 3, 1), _col(space, 3, 2))


def _bfd(i):
    return _tenk(BRADFORD[i])


def _cone(c, x, y, z):
    return _bfd(3 * c) * x + _bfd(3 * c + 1) * y + _bfd(3 * c + 2) * z


def _white(w, c):
    if w == 0:
        return _col(0, 3, c)
    return 1.0 if c == 1 else _tenk(D50[c])


def _moved(c, src_white, dst_white, x, y, z):
    src = _cone(c, _white(src_white, 0), _white(src_white, 1), _white(src_white, 2))
    dst = _cone(c, _white(dst_white, 0), _white(dst_white, 1), _white(dst_white, 2))
    return _cone(c, x, y, z) * (dst / src)


def _adapt(k, src_white, dst_white, x, y, z):
    if src_white == dst_white:
        return (x, y, z)[k]
    m = [_bfd(i) for i in range(9)]
    return _solve3(k, m, _moved(0, src_white, dst_white, x, y, z), _moved(1, src_white, dst_white, x, y, z),
                   _moved(2, src_white, dst_white, x, y, z))


def _finite(v):
    return v - v == 0.0


def _named(space, white):
    return 0 <= _i64(space) <= 2 and 0 <= _i64(white) <= 1


def modern_rgb_to_xyz(space, white, r, g, b):
    """(status, (X, Y, Z)): linear RGB of a named space as CIE XYZ under the chosen white."""
    r, g, b = _f64(r), _f64(g), _f64(b)
    if not _named(space, white):
        return BAD_NAME, None
    if not (_finite(r) and _finite(g) and _finite(b)):
        return OUTSIDE, None
    tr = _scale(space, 0) * r
    tg = _scale(space, 1) * g
    tb = _scale(space, 2) * b
    x = _col(space, 0, 0) * tr + _col(space, 1, 0) * tg + _col(space, 2, 0) * tb
    y = _col(space, 0, 1) * tr + _col(space, 1, 1) * tg + _col(space, 2, 1) * tb
    z = _col(space, 0, 2) * tr + _col(space, 1, 2) * tg + _col(space, 2, 2) * tb
    return OK, tuple(_adapt(k, 0, white, x, y, z) for k in range(3))


def modern_xyz_to_rgb(space, white, x, y, z):
    """(status, (r, g, b)): CIE XYZ under the chosen white as linear RGB of a named space."""
    x, y, z = _f64(x), _f64(y), _f64(z)
    if not _named(space, white):
        return BAD_NAME, None
    if not (_finite(x) and _finite(y) and _finite(z)):
        return OUTSIDE, None
    ax, ay, az = (_adapt(k, white, 0, x, y, z) for k in range(3))
    return OK, tuple(_amount(space, k, ax, ay, az) / _scale(space, k) for k in range(3))


def _ipow(y, n):
    p = 1.0
    for _ in range(n):
        p = p * y
    return p


def _root(x, q):
    qf = float(q)
    y = 1.0
    for _ in range(48):
        y = ((qf - 1.0) * y + x / _ipow(y, q - 1)) / qf
    return y


def _ratpow(x, num, den):
    return _ipow(_root(x, den), num)


def _frac(num, den):
    return float(num) / float(den)


def modern_encode(space, v):
    """(status, encoded value): linear light through the transfer function of the space."""
    v = _f64(v)
    if not 0 <= _i64(space) <= 2:
        return BAD_NAME, None
    if not 0.0 <= v <= 1.0:
        return OUTSIDE, None
    if space == 2:
        if v < _frac(181, 10000):
            return OK, _frac(45, 10) * v
        return OK, _frac(10993, 10000) * _ratpow(v, 9, 20) - _frac(993, 10000)
    if v <= _frac(31308, 10000000):
        return OK, _frac(1292, 100) * v
    return OK, _frac(1055, 1000) * _ratpow(v, 5, 12) - _frac(55, 1000)


def modern_decode(space, e):
    """(status, linear light): the inverse of modern_encode."""
    e = _f64(e)
    if not 0 <= _i64(space) <= 2:
        return BAD_NAME, None
    if not 0.0 <= e <= 1.0:
        return OUTSIDE, None
    if space == 2:
        if e < _frac(45, 10) * _frac(181, 10000):
            return OK, e / _frac(45, 10)
        return OK, _ratpow((e + _frac(993, 10000)) / _frac(10993, 10000), 20, 9)
    if e <= _frac(4045, 100000):
        return OK, e / _frac(1292, 100)
    return OK, _ratpow((e + _frac(55, 1000)) / _frac(1055, 1000), 12, 5)
