# text-phase

Read a text the way a physicist reads a phase of matter: from how its correlations fall with distance.

## Mission

Give any symbol stream (prose, verse, code, model output, a parse, a rhyme scheme) the same small set of
order parameters, so that "this text is gas-like" or "crystal-like" becomes a measurement with a floor,
a fit and a control. A gas has no correlation beyond a short range. A crystal keeps perfect long-range
periodic order. A liquid has short-range order that decays at one scale. At a critical point the decay is
a power law with no scale. The library measures; it does not assume that text has phases.

## Ideals

- **Every curve carries its floor.** Mutual information is biased on finite text. Each I(d) is read
  against frequency-preserving shuffles of the same stream, and only points above that floor are fitted.
- **One rule reads every carrier.** The phase reading (`phase.read_phase`) is fixed in code, so a
  parse, a rhyme scheme and a call sequence are classified by the same law as plain characters.
- **Known answers first.** Each estimator is tested on a synthetic source whose phase is designed:
  independent symbols (gas), a finite Markov chain (liquid, exponential decay with a known length), a
  noisy period (crystal) and a branching tree grammar (critical, power-law decay).

## Order parameters

| Module | Quantity |
|---|---|
| `entropy.ppm_rate` | entropy rate, adaptive PPM-C to order 4 (primary) |
| `entropy.lz_rate` | entropy rate, LZMA code length (upper bound) |
| `entropy.block_rate` | block-entropy extrapolation, h_n = h + c/n over well-sampled n (secondary) |
| `entropy.susceptibility` | w times the variance of the window-mean code length |
| `mi.mi_curve`, `mi.floor` | I(d) with Miller-Madow correction, and its shuffle floor |
| `fits.fit_all` | flat, power, exponential (and a power-with-cutoff diagnostic), AIC and held-out error |
| `periodicity.periodicity` | largest recurrence of the match excess above its running minimum |
| `periodicity.repeat_share` | share of positions starting an already-seen 20-gram |
| `periodicity.comb_score` | detrended peak train at a given period (line length) |
| `structure` | carriers beyond characters: clause depth (rule-based fallback), rhyme classes, statement back-references, code token stream and call sequence |
| `phase.profile` | every quantity above for one stream, plus the phase reading |

## Use

```
python -I -B tests/test_textphase.py
```

```python
import numpy as np
from textphase import phase, symbols
seq = symbols.chars(open("book.txt", encoding="utf-8").read())
print(phase.profile(seq, symbols.N_CHAR, np.random.default_rng(0))["phase"])
```

## Limits

The plug-in MI estimator reaches only as far as the floor allows: about d = 100 characters on 2e5
characters of prose. Longer ranges need longer texts or curves averaged across documents. The clause
chunker is a word-list rule, not a parser. The rhyme key is a spelling suffix, not phonetics.
Requires numpy. Python 3.10 or later.
