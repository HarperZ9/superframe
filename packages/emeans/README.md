# emeans

K-means where each centre forgets, written in BuildLang, with a study of when it escapes the traps
that the classic method cannot.

```
buildc run packages/emeans/bld/emeans.bld
```

The program prints 69 lines in about three minutes. The same lines are stored in
`results/emeans.txt`, and two runs on one machine gave byte-identical output. Everything is in one
BuildLang file: the kernel, the classic method beside it, the random stream, the toy problems and
the controls. No other language is involved.

## The method

A cluster keeps a sum `S` and a count `N`. Its centre is `S / N`. A batch of points adds its own
sum `s` and count `n`, and one rule covers three algorithms:

| Rule | Update | Algorithm |
|---|---|---|
| forget | `S = (1 - a) S + a s`, `N = (1 - a) N + a n` | e-means |
| keep | `S = S + s`, `N = N + n` | MacQueen 1967, Sculley 2010 |
| replace | `S = s`, `N = n` | Lloyd 1957, when the batch is the whole dataset |

The kernel also has the three parts the e-means authors add: a cluster whose count falls under a
tenth of the mean takes half of a large one (checked every five batches), the forgetting rate `a`
falls along a cosine to a tenth of its start, and after the last pass each centre becomes the exact
mean of the points it was given in that pass.

The method is from the e-means paper as explained by Jia-Bin Huang (video, 12 November 2026). The
paper's two scaling laws for batch size and forgetting rate are not implemented: their constants
were not in the source we worked from, and the paper says they do not fit small, low-dimensional
data, which is what this study uses.

## What we tested

The claim under test: batch noise lets a centre cross a gap, so e-means ends stuck less often than
Lloyd. A run is **stuck** when clumps and centres do not pair off one to one, so one clump holds
two centres and another holds none.

Four toy problems, 200 random starts each, every method from the same start. Clumps have standard
deviation 1. These are our own problems; the paper's toy configurations were not available, so
this is a test of the idea and not a replication of the paper's figures.

1. Five clumps on a line, 10 apart.
2. One clump of 800 points and two of 100.
3. A three by three grid, 10 apart.
4. Four clumps around a centre, 10 out.

The headline setting was fixed before the first run: 5 passes, batch 64, starting rate 0.3.

## Results

### At the setting fixed in advance, e-means did not escape

Stuck starts out of 200:

| Problem | Lloyd | e-means | e-means, no revival | keep rule |
|---|---|---|---|---|
| 1. line | 110 | 110 | 112 | 129 |
| 2. unequal | 39 | 31 | 35 | 37 |
| 3. grid | 166 | 155 | 157 | 169 |
| 4. ring | 59 | 59 | 60 | 60 |

Mean error was lower for e-means on all four (by 0.04, 11.5, 8.4 and 2.6 percent). Lloyd took 5.4
to 10.5 passes to converge, so 5 passes of e-means is a similar budget.

### Escape depends on how noisy the updates are

Stuck starts out of 200 for e-means at 5 passes, by batch size and starting rate:

| Problem | Lloyd | batch 32, rate 0.6 | batch 64, rate 0.6 | batch 64, rate 0.3 | batch 256, rate 0.3 |
|---|---|---|---|---|---|
| 1. line | 110 | 89 | 103 | 110 | 127 |
| 2. unequal | 39 | 0 | 5 | 31 | 34 |
| 3. grid | 166 | 52 | 134 | 155 | 164 |
| 4. ring | 59 | 59 | 59 | 59 | 58 |

All twelve settings per problem are in `results/emeans.txt`. Small batches with a high rate escape
on problems 2 and 3, help a little on 1, and do nothing on 4.

### Escape depends on how far apart the clumps are

This sweep was added after the first results were read, to test one explanation for them. Five
clumps on a line, spacing varied. Stuck starts out of 200:

| Spacing | Lloyd | e-means 5 passes, batch 64, rate 0.3 | 5 passes, batch 32, rate 0.6 | 20 passes, batch 32, rate 0.6 |
|---|---|---|---|---|
| 3 | 0 | 12 | 0 | 0 |
| 4 | 37 | 54 | 3 | 0 |
| 6 | 86 | 90 | 50 | 5 |
| 10 | 112 | 105 | 86 | 60 |

With clumps 4 apart, noisy e-means almost never sticks (3 of 200 against Lloyd's 37). At 10 apart
it still sticks 86 times in 5 passes. More passes keep helping. The quieter setting is worse than
Lloyd when clumps are close: at spacing 3 it ends 5 passes with 12 unpaired answers where Lloyd has
none.

### Palette-sized data: three dimensions

8,000 synthetic colour points in the unit cube, eight clusters of unequal share, 50 starts. No
image was read.

| k | e-means passes | Mean error, Lloyd | Mean error, e-means | e-means lower in |
|---|---|---|---|---|
| 8 | 2 | 0.008889 | 0.009061 | 6 of 50 |
| 8 | 5 | 0.008889 | 0.008824 | 18 of 50 |
| 16 | 2 | 0.004225 | 0.004064 | 10 of 50 |
| 16 | 5 | 0.004225 | 0.004052 | 25 of 50 |

Lloyd needed 38.9 passes on average at k = 8 and 52.7 at k = 16. Five passes of e-means reached a
mean error 0.7 percent lower at k = 8 and 4.1 percent lower at k = 16. It won fewer than half the
individual starts at k = 8, so its lower mean comes from avoiding Lloyd's worst starts. Passes are
counted here; wall-clock time was not measured.

## What this supports

- Lloyd is a corner of the general rule: the replace rule over the whole dataset reproduced
  Lloyd's centres to the last bit in all 800 starts.
- The keep rule is the weakest of the three on every problem, as the paper says.
- Forgetting plus batch noise does escape traps, when the noise is large relative to the gap. On
  our problems that needed batch 32 with rate 0.6, and it still failed on the ring.
- For palette-sized clustering, 5 passes of e-means match or beat converged Lloyd on mean error
  with about a tenth of the passes.

## What it does not support

- "Never stuck." We did not see that at any setting on problems 1, 3 or 4.
- Any speed claim. Nothing here was timed against another implementation.
- The paper's scaling laws, which this package does not contain.

## Controls

The program runs four before anything else and prints `controls passed 4 of 4`: the stuck test
reports stuck for a planted answer with two centres in one clump; it reports not stuck for the
true centres; the planted answer has the higher error; and the random stream repeats for one seed
and differs for another.

## Verified

- Checked: `results/emeans.txt` equals the program's output. By: two consecutive runs with buildc
  1.10.0 on Windows, compared byte for byte. Result: identical.
- Checked: the first 57 lines were unchanged when the spacing sweep was added. Result: identical.
- Not checked: other compiler versions, other machines, real images, timing.
