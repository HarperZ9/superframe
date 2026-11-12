<!-- writing-profile: procedure -->
# Fix pass: Act 1 after the story editor's second read

From the director, 2026-10-17. The editor's pass 2 is at the end of `design/EDITOR-NOTES.md`
("Pass 2"). Of the 34 accepted notes, the text carries 23 fully, 8 partly and 2 not at all. A note
is done only when the text carries it. This pass makes the text carry them. Same rules and checks
as before (lint, validator, crossrefs, Articulate); write only your district file; back it up to
`content/act1/.orig3/<district>.lwd` first; district-prefixed scratch files.

## Measure yourself

```
python content/tools/brevity.py content/act1 <district>.lwd
```

It prints your narration share and similes per 1,000 words. Targets for this pass:

| District | Narration share now | Target | Similes per 1,000 now | Target |
|---|---|---|---|---|
| quay | 55% | 48% or less | 3.6 | 3.0 or less |
| brine | 46% | 39% or less | 4.3 | 3.0 or less |
| weigh | 66% | 55% or less | 5.5 | 3.0 or less |
| floor | 72% | 60% or less | 6.3 | 3.0 or less |
| mole | 65% | 55% or less | 4.1 | 3.0 or less |
| gut | 52% | 45% or less | 3.8 | 3.0 or less |

## The two notes the text did not carry

- **L6, narration.** The new routes were written as narration. Turn route narration into what the
  player does and what people say, or cut it. A route node of two to four lines does not need a
  sentence describing the weather or the room again.
- **L4 and L10, similes.** At most one image in a node, and in a node of three lines or fewer, the
  image is the beat or it goes. Keep the best; make the rest plain.

## Every district

- **S11a, fight outcomes:** one voice per outcome node, never the set of CARBON replay, CONDOLENCE
  moral and PRIDE tag. No "Fled. From X. In Y." shape anywhere.
- **S8:** UNDERTOW lines that annotate go (UNDERTOW tempts; it does not explain).
- Lamb has no gender; no em dashes; protect the lines in L7.

## By district

- **quay:** S1a (cut the narration line in `quay.keel.light`; Penhallow's "met one wrecker, and he
  was the weather" leaves the berth; the brine writer takes it), S7 (Penhallow's quay lines become
  bearings and log entries, never proverbs), L10 (`quay.appt.search.talk.fail`,
  `quay.appt.search.run.fail` made plain; keep `quay.appt.search.rig`), L11 (restore "I heard" in
  `quay.hobb.switch`), L12 (`quay.gauze`: "I put it on the night they first lit the arc, and a man
  went in off the mole.").
- **brine:** S1a (take Penhallow's weather line, after 23:30, beside "sent me out").
- **weigh:** S3a (in `weigh.pip.tin` Pip gives only the tin and "It thumped. Out of hours."; the
  seven-month link is SUM's alone, behind its check), P1a (`weigh.trial.fallback` and the after-vote
  fallback resolve on BALLAST or GRIP; SMELL stays as the blindfolded option), P8a
  (`weigh.appt.fist` written per version, five short scenes, or routed to each version's own
  district scene), P10 (`weigh.infer`: replace `has(met.crake)` with `has(quay.crake.said_restrikes)
  | has(quay.crake.slip)`).
- **floor:** S11a eels (fighting through costs 3 minutes on a win, going round the ribs 8, losing 8
  and soaked), C5 (Cockle's count on the floor uses the Brine's: only the very low Low Nights; she
  walked to the door on her first, aged five), S7 ("Manners" on the floor becomes a count).
- **mole:** the brevity targets.
- **gut:** S9 (fold the three remaining "The Gut has heard" openings in `gut.prov.*` into the hub).

## Report back

Narration share and similes before and after; each note above with its node ids; Articulate high
and medium; anything you could not do.
