<!-- writing-profile: research -->
# Fidelity targets for the Quota slice plates

Rendering lead, 2026-10-21. Three references from the author's inspiration batch
(notes/2026-10-21-x-research/RENDER-INSPIRATION-2026-10-21.md) fit the slice best. Each gets
a target we can measure on our own plates. Inspiration only: nothing is copied.

| Reference (section) | Why it fits the Quota | What we measure on our plates | Target |
|---|---|---|---|
| The painterly portrait of a sleeping marble figure (4): big flat planes following form, warm light on cool grey | The portraits and the kitchens: one light, value planes over detail | Value range (p95 - p5 of luminance over the subject) and edge coherence (render/v2/language.mjs `measures`) | portraits and interiors: value range at least 0.55, edge coherence at least 0.6 |
| The folk-horror ritual at dusk (9): white figures round a fire against a dark forest wall | The granary door at night and the road post's brazier: fire against a dark mass, people as pale shapes | The firelit pool's luminance against the dark mass behind it, and the share of the frame in the dark family | firelit pool at least 4 times the mass behind it; 55 to 75 percent of the frame in the shadow family |
| One dock shot graded through green, sepia, red and night (5): the same place made different by the grade | The five eras and decay on one street: the era must read in the palette alone | Palette entropy (4 bits a channel) and value range per era on the same plate | era 1 above era 2 above era 5 in entropy, each step at least 0.3 bits; era 5's value range under 0.4 |

## Where we stand (Exchange Square at dawn, half-size preview, paint language applied)

Palette entropy: before the language 3.74 bits; era 1 4.33, era 2 3.81, era 5 2.66 (the ordering holds; the
steps are 0.52 and 1.15 bits). Value range: 0.50 before, 0.54, 0.51 and 0.36. Edge coherence 0.60, 0.60,
0.60, 0.63. Proof sheet: game/capture/paint/lang/square/sheet.png (feat/paint).

## Blocked

The side-by-side sheets at the same framing need frames from the reference clips; none are on disk (the
batch was read as video), and downloads wait on the coordinator. Until frames arrive the targets above are
checked on our plates only, against these numbers, not against the references themselves.
