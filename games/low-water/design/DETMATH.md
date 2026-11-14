<!-- writing-profile: research -->
# Deterministic math for the combat sim

Combat engineer, 2026-10-23, package P0 of COMBAT-SPEC section 11. The JS combat sim and AI call
`game/engine/combat/sim/math.mjs` for every transcendental function. The C++ port implements the same
algorithms from this page and must give the same bits for the same inputs.

## 1. Rules for both implementations

- Doubles only (IEEE 754 binary64), round to nearest even.
- Allowed operations: `+ - * /`, `sqrt`, `floor`, `abs`, comparisons, `min` and `max`. Each one is
  correctly rounded or exact in both languages.
- C++ compiles the math and the sim with `-ffp-contract=off` and without `-ffast-math`, `/fp:fast` or
  x87 code (use SSE2 or later). A fused multiply-add changes the last bit, so contraction stays off.
- Evaluate each expression in the order written below. Do not reassociate.
- `Math.hypot`, `Math.pow` and the libm functions are out of the sim. A test fails the build if one
  comes back (`combat/tests/detmath.test.mjs`).

The names: `dsin dcos datan datan2 dasin dacos dexp dhypot`, and `DPI = 3.141592653589793`.

## 2. The algorithms

### 2.1 Constants

| Name | Value |
|---|---|
| PIO2 | DPI / 2 (exact) |
| PIO2_HI | 1.57079632673412561417 |
| PIO2_LO | 6.07710050650619224932e-11 |
| INV_PIO2 | 6.36619772367581382433e-1 |
| PIO6 | DPI / 6 (one rounded division) |
| SQRT3 | sqrt(3) |
| TAN_PI12 | 2 - SQRT3 |
| LN2_HI | 6.93147180369123816490e-1 |
| LN2_LO | 1.90821492927058770002e-10 |
| INV_LN2 | 1.44269504088896338700 |

The sine and cosine kernel coefficients are the fdlibm minimax set:
S1 to S6 = -1.66666666666666324348e-1, 8.33333333332248946124e-3, -1.98412698298579493134e-4,
2.75573137070700676789e-6, -2.50507602534068634195e-8, 1.58969099521155010221e-10.
C1 to C6 = 4.16666666666666019037e-2, -1.38888888888741095749e-3, 2.48015872894767294178e-5,
-2.75573143513906633035e-7, 2.08757232129817482790e-9, -1.13596475577881948265e-11.

### 2.2 Sine and cosine

1. Non-finite input gives NaN.
2. `k = floor(x * INV_PIO2 + 0.5)`; `r = (x - k * PIO2_HI) - k * PIO2_LO`; `q = ((k mod 4) + 4) mod 4`
   with a truncating mod (C++ `fmod`, JS `%`). Exact while |k| < 2^20, so for |x| under about 1.6e6.
3. `z = r * r`.
   `ksin(r) = r + r * z * (S1 + z * (S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)))))`.
   `kcos(r) = 1 - 0.5 * z + z * z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))))`.
4. sin: q 0, 1, 2, 3 gives `ksin`, `kcos`, `-ksin`, `-kcos`. cos: `kcos`, `-ksin`, `-kcos`, `ksin`.

### 2.3 Arctangent

- `AT[n] = s / (2n + 1)` for n = 0 to 15, with s = +1 for even n and -1 for odd n, one rounded division each.
- `katan(t)`: `z = t * t`; `p = AT[15]`; for n = 14 down to 0, `p = AT[n] + z * p`; return `t * p`.
- `datan(x)`: NaN gives NaN. Negative x gives `-datan(-x)`. +Infinity gives PIO2. If x > 1, set
  `x = 1 / x`, `base = PIO2`, `sign = -1`, else `base = 0`, `sign = 1`. If x > TAN_PI12,
  `r = PIO6 + katan((x * SQRT3 - 1) / (x + SQRT3))`, else `r = katan(x)`. Return `base + sign * r`.
- `datan2(y, x)` follows C's `atan2` for zeros, signs and infinities. For finite non-zero inputs,
  `a = datan(abs(y / x))`; for x > 0 the result is `a` with y's sign; otherwise `DPI - a` with y's sign.
- `dasin(x) = datan2(x, sqrt((1 - x) * (1 + x)))` and `dacos(x) = datan2(sqrt((1 - x) * (1 + x)), x)`,
  NaN outside [-1, 1].

### 2.4 Exponential

- Above 709.782712893384 gives +Infinity; below -745.1332191019412 gives 0; NaN gives NaN.
- `k = floor(x * INV_LN2 + 0.5)`; `r = (x - k * LN2_HI) - k * LN2_LO`.
- `EC[0] = 1`, `EC[n] = EC[n-1] / n` for n = 1 to 13. `p = EC[13]`; for n = 12 down to 0, `p = EC[n] + r * p`.
- `pow2(j)` is the double with biased exponent j + 1023 and a zero mantissa, built from its bits.
  If k > 1023: `p * pow2(1023) * pow2(k - 1023)`. If k < -1000: `p * pow2(k + 1000) * pow2(-1000)`.
  Otherwise `p * pow2(k)`.

### 2.5 Hypotenuse

`dhypot(x, y) = sqrt(x * x + y * y)`. It does not guard against overflow; the sim's distances are
under 100 m.

### 2.6 Accuracy

Against the platform libm over 20,000 random inputs in the sim's range: sine and cosine within 1.2e-16,
atan2, asin and acos within 4.5e-16, exp within 2.3e-16 relative. The swap from libm left all 155
combat tests passing with no golden changed.

## 3. Golden values

`combat/tests/detmath-golden.json` holds the bit patterns of these 12 calls, in this order. The C++ math
test checks the same list.

| Call | Result | Bits |
|---|---|---|
| dsin(0.5) | 0.479425538604203 | 3fdeaee8744b05f0 |
| dsin(-2.75) | -0.38166099205233167 | bfd86d2239c183fb |
| dcos(1.25) | 0.3153223623952687 | 3fd42e3dd88bd952 |
| dcos(10) | -0.8390715290764524 | bfead9ac890c6b1f |
| datan2(1, 3) | 0.32175055439664213 | 3fd4978fa3269ee0 |
| datan2(-2, -0.5) | -1.8157749899217608 | bffd0d6a1369bd34 |
| dasin(0.3) | 0.30469265401539747 | 3fd380159e14f6fe |
| dacos(-0.7) | 2.34619382340565 | 4002c501446cd5f2 |
| dexp(-0.0333) | 0.9672483415560369 | 3feef3b2cb42fd44 |
| dexp(4.2) | 66.68633104092515 | 4050abecd907c034 |
| dhypot(1.5, 2.25) | 2.704163456597992 | 4005a22073490377 |
| dsin(1000) | 0.8268795405320026 | 3fea75cc150a206c |

## 4. Combat records in the run traces

`combat/tools/trace.mjs` writes a fight as JSON lines in the format of the story trace recorder
(`game/engine/tools/tracer.mjs`, commit 8366a8b): one object a line, `"t"` first, the rest in a fixed
order, nested objects with sorted keys, no spaces. Every combat record carries `"s":"h"`, which marks
it as the host's, so the story VM's replayer passes it through and never checks it. The type names all
start with `c` and none collides with the story types (`begin node line offer take var flag time place
end rng h ev talk next scene after stop`). The manifest writer `tools/trace-manifest.mjs` reads the
files unchanged (format `lw-trace/1`).

| Record | Fields | When |
|---|---|---|
| `cbegin` | `v` (1), `seed`, `arena`, `fighters` [{`id team kind x z face`}] | once, first |
| `cin` | `tick`, `lamb` (the input: `hold mx mz press`) | each frame whose input differs from the frame before |
| `cev` | `tick`, `n` (the event type), `d` (its other fields, keys sorted) | every event `W.step` returns, in order |
| `cstate` | `tick`, `hash` (`W.hash()`), `f` [[`id x z hp st`]] | every 60 ticks |
| `cend` | `tick`, `outcome`, `reason`, `hash` | once, last |

Numbers are written the way `JSON.stringify` writes a double, the shortest string that reads back to
the same bits. The C++ writer uses `std::to_chars` with no precision argument, which follows the same
rule. A non-finite number is written `null`.

The corpus: `node combat/tools/trace.mjs <dir> 40 900` writes 40 fights, seeds 1 to 40, cycling the 14
outer arenas with a spawn table and every foe archetype in `data/foes.mjs`, two foes a fight, the test
pilot as Lamb, 900 frames at most. On 2026-10-23 two separate runs gave 40 files, 2,845,097 bytes,
and identical manifests. The inner arenas and the story's authored encounters are not in this corpus
yet; their fights go through the same `traceFight` when the C++ inner arena (P10) needs them.

## 5. What this does not prove

Identical bytes across two JS runs prove the JS sim is deterministic on one machine and one V8. They do
not prove the C++ port matches; that is the P3 parity test. The golden table is the first check the
C++ side can run, before any of the sim exists.

## 6. Move data: `combat/data/moves.json`

Package P1. One versioned JSON file holds the move data that the JS loads now and the C++ port loads
later. The JS modules in `combat/data/` import it and export the same names as before, so no table
lives in two places.

| Key | What it holds | JS export |
|---|---|---|
| `format`, `version`, `fps` | `"lw-moves"`, 1, 60 | |
| `common` | the moves every body has: flinch, stagger, parried, knockdown, getup and the rest | `COMMON` |
| `body` | dodges, riposte, shove, grapple, takedown, item uses | `BODY` |
| `bodyMoveset` | which body move each action names, by load band | `BODY_MOVESET` |
| `toolClasses` | the seven tool classes' settings: weight, reach, arc, speed, chain, damage, catch window | `TOOL_CLASSES` |
| `tools` | the tools by id, each with its class and any override | `TOOLS` |
| `foeSpecials` | the foe archetypes' own specials | `SPECIALS`, after the arena specials |
| `bossSpecials` | the outer bosses' specials | `BOSS_SPECIALS` |
| `arenaSpecials` | the arena archetypes' specials | `ARENA_SPECIALS` |

Tool strikes are not stored. `buildToolMoves` in `combat/data/tools.mjs` expands a tool's settings
into its light string, heavy, charged heavy and catch, scaled by speed, a slow grip and the wind-up
(1 for Lamb, `FOE_WINDUP` 1.6 for foes). The C++ port reimplements that generator.

The check for both sides is `combat/tests/moves-expanded.golden.json`, written by
`node combat/tools/export-data.mjs golden`. It holds every move after `defineMoves` fills the
defaults: 104 base moves (the tables plus each tool class at Lamb's wind-up) and, for each of the 8
tools, its strikes at Lamb's wind-up, with a slow grip, and at the foes' wind-up. The JS test
`movedata.test.mjs` requires the expansion to equal it byte for byte; the C++ test will compare its
own expansion against the same file. The audit in COMBAT-SPEC section 10 counted 121 moves. The 104
here count each arena special once; the audit's dump listed the arena specials both on their own and
inside the foe specials. That reading is inferred from the counts; nobody recounted the audit's dump.

Comments that sat inside the old JS tables moved with the export line as a notes block in each module.
