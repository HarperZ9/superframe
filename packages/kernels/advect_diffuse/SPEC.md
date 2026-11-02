# advect_diffuse 0.1.0: semi-Lagrangian advection plus explicit diffusion, 2-D

Mode: **bit-identical**, float64.

Source formulas: `slAdvect`, `sampC` and `diffuse` in the brackish simulator
(`the private study 2026-10-29-brackish-marbling`, read only). Differences from
the simulator, on purpose: the velocity here is collocated at cell centres (the
simulator uses a staggered MAC grid with `sampU`/`sampV`), both axes are periodic (the
simulator clamps z), and there are no solid cells or boundary masks. The simulator's
default scalar path is flux-form advection with a van Leer limiter; this kernel is its
semi-Lagrangian path. A van Leer flux kernel is the natural next kernel.

## Inputs

| Name | Shape, dtype | Meaning |
|---|---|---|
| `q` | [ny, nx] f64 | scalar field (salt, heat, ink, drum membrane) |
| `u`, `v` | [ny, nx] f64 | velocity at cell centres, x and z |
| `par` | [5] f64 | `dx, dt, 0.5*dt, a, nsub` |

The host computes the diffusion schedule as `diffuse()` does: `num = kappa*dt/dx^2`,
`nsub = ceil(num / 0.2)`, `a = num / nsub`, capped at 200 substeps with
`a = min(num/200, 0.24)`.

## Output

`q` [ny, nx] f64 after one step.

## Maths, in evaluation order

Sampler `samp(f, x, z)`, cell-centred bilinear with periodic wrap:

```
fx = x/h - 0.5;  fz = z/h - 0.5
fx = fx - N*floor(fx/N);  fz = fz - M*floor(fz/M);  (a value equal to N or M becomes 0)
i0 = int(fx), j0 = int(fz), tx = fx - i0, tz = fz - j0, i1 = (i0+1) mod N, j1 = (j0+1) mod M
samp = (f[j0,i0]*(1-tx) + f[j0,i1]*tx)*(1-tz) + (f[j1,i0]*(1-tx) + f[j1,i1]*tx)*tz
```

Advection, midpoint back-trace, per cell centre (x, z) = ((i+0.5)h, (j+0.5)h):

```
xm = x - (0.5 dt)*samp(u,x,z);  zm = z - (0.5 dt)*samp(v,x,z)
q' = samp(q, x - dt*samp(u,xm,zm), z - dt*samp(v,xm,zm))
```

Diffusion, `nsub` times, neighbours added in the simulator's order (left, right, below,
above), starting from an exact zero:

```
sm = (q[L]-qc) + (q[R]-qc);  sm = sm + (q[D]-qc);  sm = sm + (q[U]-qc);  q = qc + a*sm
```

## Known answers (checked)

Zero velocity and zero diffusivity give the identity, bit for bit. Diffusion conserves
the total to 4e-18 relative and never raises the maximum. A uniform velocity of one cell
per step equals `roll(q, 1)` to 1e-12.

## Cost model

Bytes: `cells*8*4` for the advection pass plus `nsub*cells*8*2`. Flops: about 118 per
cell for advection (5 samples at about 22 flops each) plus 10 per cell per substep.
The eager implementation materialises every temporary, so its real traffic is many
times the model; the roofline percent shows that gap.

## Open built-in

CUDA: `grid_sample` (bilinear, one back-trace step) plus `conv2d` Laplacian. CPU:
`scipy.ndimage.map_coordinates` plus `laplace`. A different algorithm (one-step
back-trace, reflection or wrap padding), so a cost reference only: max abs difference
8e-4 (CPU) and 4e-3 (CUDA) from this kernel at the check size.

## BuildLang port note

The float-contraction and GPU dispatch blockers from `blend/SPEC.md` apply. Specific
to this kernel: 2-D runtime-sized f64 grids. The docs ship fixed-size `Array<T, N>`
broadcasting and a 1-D `Vec<f64>` library; a stencil over an `ny x nx` grid needs a
runtime 2-D buffer (or a flat `Vec<f64>` with index arithmetic, which works today but
loses the shape check). BuildLang's invariant family (`conservation`, `bounded`) maps
directly onto the known answers above, which makes this kernel a good first port once
the grid type exists.
