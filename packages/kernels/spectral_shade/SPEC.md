# spectral_shade 0.1.0: n, k spectra + light + angle to reflectance to CIE XYZ

Mode: **bit-identical**, float32.

Source: `tools/materials` (read only): `optics.fresnel`, `spectral.to_xyz`, the 380 to
780 nm grid in 5 nm steps (81 samples), the CIE 1931 2-degree CMFs and D65. The kernel is
the smooth-interface specular term only; the library's GGX lobe and body term are not
part of it yet.

## Inputs

| Name | Shape, dtype | Meaning |
|---|---|---|
| `nA, kA, nB, kB` | [81] f32 | two materials' complex index on the grid |
| `light` | [81] f32 | light spectral power |
| `cmf` | [81, 3] f32 | xbar, ybar, zbar |
| `n_out` | [] f32 | real index of the outer medium |
| `wmix` | [P] f32 | per-pixel material mix, clamped to [0, 1] |
| `cosi` | [P] f32 | per-pixel incidence cosine, clamped to [0, 1] |

The angle enters as its cosine, so no device evaluates `cos`.

## Output

`xyz` [P, 3] f32, normalised so a perfect white reflector has Y = 1.

## Maths

Per pixel and wavelength: `n = nA*(1-w) + nB*w`, `k = kA*(1-w) + kB*w`. Fresnel with
complex N = n + ik, written in real operations only so every step is correctly rounded:

```
eta = N / n_out;  eta2 = (er^2 - ei^2, 2 er ei);  s2 = 1 - c^2
w   = sqrt(eta2 - s2)  (principal root: wr = sqrt((|z| + a)/2), wi = sign(b) sqrt((|z| - a)/2),
                         |z| = sqrt(a^2 + b^2), no hypot)
Rs  = |c - w|^2 / |c + w|^2          Rp = |eta2 c - w|^2 / |eta2 c + w|^2
R   = (Rs + Rp) / 2
```

Integration: `X_m = fixed_sum((R * S) * cmf_m) / fixed_sum(S * ybar)`, where `fixed_sum`
(`kcore/fixed.py`) pads 81 to 128 with zeros and halves seven times. The tree order is
fixed by the shape, so the sum is the same on every device.

## Known answers (checked)

Fresnel agrees with `tools/materials` `optics.fresnel` (complex, float64, cmath) to
1.2e-7 absolute; normal-incidence gold XYZ agrees with `spectral.to_xyz` to 1.2e-7
relative; glass n = 1.5 at normal incidence gives R = 0.04.

## Cost model

Bytes: 20 per pixel plus the spectra. Flops: about 60 per pixel per wavelength. The
eager implementation runs about 60 separate elementwise launches over [P, 81] or
[P, 128] temporaries, so it is far from this model's bound (0.03 % on CUDA in the
smoke run). One fused CUDA kernel compiled with `-fmad=false` and the same operation
order would keep the bits and remove that traffic; that is the next step for this kernel.

## Open built-in

None. Neither numpy nor torch ships a spectral Fresnel shader.

## BuildLang port note

Blockers from `blend/SPEC.md` apply, and this kernel is the closest to BuildLang's
shader lane: `#[fragment]` and `#[compute]` already emit HLSL and GLSL. The block is
determinism, not syntax: HLSL and GLSL compilers contract and reorder float maths
freely unless told otherwise (`precise` in HLSL, `precise`/`invariant` in GLSL), and
the shader guide does not document a way to emit those qualifiers.
