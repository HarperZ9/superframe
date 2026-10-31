# blend 0.1.0: weighted N-source blend with gain and detune

Mode: **bit-identical**. CPU (numpy, 1 thread or split over time), CUDA (torch eager)
and the reference must produce equal bytes.

## Inputs

| Name | Shape, dtype | Meaning |
|---|---|---|
| `x` | [N, C, L] float32 | N periodic source tables, C channels, L samples each |
| `w` | [N, C] float32 | weight of source n on channel c |
| `ratio` | [N] float64 | read-rate ratio per source, from detune cents on the host |
| `gain` | [] float32 | output gain g |
| `t` | [T] float64 | output sample positions (normally 0..T-1) |

Detune: the host turns cents into `ratio_n = 2 ** (cents_n / 1200)` once, in Python
float64, and passes the ratios as an input. No device evaluates `exp2`, so the
transcendental never enters the bit-identical path. `spread(N, d)` places source i at
`d * (i - (N - 1) / 2)` cents.

## Output

`y` [C, T] float32.

## Maths, in evaluation order

For each channel c and output index j, with `acc = 0` (float32):

```
for n = 0 .. N-1:                       # fixed order, the only reduction
    p   = t[j] * ratio[n]               # float64
    fp  = p - L * floor(p / L)          # float64 wrap into [0, L)
    if fp >= L: fp = 0
    i0  = int(fp);  fr = float32(fp - i0);  i1 = (i0 + 1) mod L
    s   = x[n,c,i0] * (1 - fr) + x[n,c,i1] * fr      # float32, two products then one add
    acc = acc + w[n,c] * s                           # float32 product, then add: never fused
y[c,j] = g * acc
```

Every operation is a single correctly rounded IEEE operation, so its result is fixed
by its operands. The order is fixed by the loop. A fused multiply-add or a tree sum
over n changes the bits; the check carries both variants as controls and both are
caught (50.0 % and 56.7 % of outputs differ at the check size).

## Cost model (for the roofline)

Bytes: `N*C*T*2*4` (two table reads per output per source) + `T*8` + `N*C*4` + `C*T*4`.
Flops: `N*T*8` (position) + `N*C*T*5` (interpolate, weight, add) + `C*T`. The table
reads are gathers that mostly hit cache, so the byte count is an upper bound on DRAM
traffic and the roofline percent is a lower bound.

## Open built-in on the same machine

`einsum('nc,ncl->cl')` (numpy, torch). It does the weighted sum only, with no detuned
read, in a library order, so it is a cost floor for the reduction and not an equal
output.

## BuildLang port note

What blocks writing this kernel in BuildLang today (from the BuildLang docs):

1. No guaranteed no-contraction float mode. The spec says floating point "keeps the
   target backend's IEEE behavior", and the production path hands C to gcc, clang or
   MSVC. gcc's default outside strict ISO modes is `-ffp-contract=fast` (from memory,
   moderate confidence), so once the target enables FMA instructions (for example
   `-march=native`) `a*b + c` can become one fused operation, which breaks this contract. A `#[no_contract]` attribute or a fixed `-ffp-contract=off`
   / `/fp:precise` in the C backend would close it.
2. The GPU general-compute gap is open by the docs' own statement. `#[compute]` emits
   GLSL/HLSL compute entry points, SPIR-V is experimental, and there is no documented
   host-side dispatch and read-back, so there is no GPU half to compare.
3. Dynamic float32 arrays: the shipped vector library is over `Vec<f64>`; broadcasting
   is over fixed-size `Array<T, N>`. A runtime-sized float32 buffer with gathers is
   needed for the tables and the output.
4. CPU threads are listed for the standard library (`thread::spawn`) and planned under
   the built-in parallelism pillar; neither is documented as shipped.

What already fits: integer `floor`/`int` conversions, f32/f64, and the scientific
receipt (`buildc run --emit-receipt`) could seal this kernel's output hash directly.
