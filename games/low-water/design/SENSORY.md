<!-- writing-profile: research -->
# Low Water: sensory design (index)

Art and sensory director, 2026-10-22. For the author, the rendering lead, the light and effects
lead, the glyph lead, the audio lead, the voice director, the UI lead and the engine owner. Nothing here
edits another lead's files, raw-native or any game content. The story it serves is The Quota
(design/QUOTA-DESIGN.md: one district across five eras), under the project name Low Water.

Author direction, 2026-10-22, verbatim: "Art Direction can morph and have crossover, and even be surreal,
covering many approaches visually and sensorily. Design covers all senses masterfully, and with care."

## The one decision under everything here

The look changes with the story's state and never with the game's mode. LOOK-UNIFIED forbids the look
alternating between walking, talking and fighting (design/LOOK-UNIFIED.md:5-15), and that rule stands.
What may change the look now is meaning: the era, a dream, a memory, whose eyes a chapter is seen
through, a state of mind, a place's own character, a piece of propaganda, and the read-back. Every such
change has a cause in the game's records (a flag, a `@dream`, a `@perspective`, a `@prop` state, a model
stock), so a player can learn why the world looks as it does. Oil and Ink stays the base and the place
every other look returns to.

## Files

Each file stays under about 300 lines (the house quality gate).

| File | Contents |
|---|---|
| [sensory/01-LOOKS.md](sensory/01-LOOKS.md) | Oil and Ink as base; twelve looks the game moves through, each with meaning, palette, line, light, texture, camera, motion, and the raw-native passes and parameters or the engine gap |
| [sensory/02-MORPHS.md](sensory/02-MORPHS.md) | How one look becomes another in space and time; the style-state field as an engine feature, with bounds written before code, a CPU reference check, the temporal-instability target and the frame budget |
| [sensory/03-SURREAL.md](sensory/03-SURREAL.md) | The surreal grammar: when reality breaks, how it stays readable, and control tests in the repo's style |
| [sensory/04-SENSES.md](sensory/04-SENSES.md) | Sound, score and leitmotifs, voice, room acoustics, the silence budget, haptics, UI motion and type, text pacing, smell, taste and touch carried by the other senses, and a per-scene-type table |
| [sensory/05-CARE.md](sensory/05-CARE.md) | Photosensitivity limits with a measurable rule, colour-blind-safe cues, captions for sound, loudness and ducking, haptics controls, the rating route and scene notes, a steady-world option |
| [sensory/06-INSPIRATIONS.md](sensory/06-INSPIRATIONS.md) | The author's named games first (2026-10-22), then painting, film, theatre, music and sound: the method taken from each, where it maps, how raw-native would make it, and the gap |
| [sensory/07-BUILD.md](sensory/07-BUILD.md) | The ten engine and game tasks that most raise the sensory bar, ranked, each with a target, a failure test and an effort estimate |
| [sensory/08-FOCUS.md](sensory/08-FOCUS.md) | Focus, the lens and light as storytelling: the observer camera, `focus:` scene tags for writers, the plate G-buffer request, light that moves with the lens, and the browser port, with bounds |

## Citation conventions

- Paths without a prefix are relative to this project folder (`games/low-water/`).
- `rn:` paths are in raw-native at `origin/main` eaa324f (2026-10-22, "Merge PR #208 feat/p14-clouds"),
  read through `git show` because the local checkout is on an older branch. `[p5]` marks files on the
  unmerged branch `origin/feat/p5-world-strokes`; `[p8gpu]` on `origin/feat/p8-noise-gpu`.
- Every number written as a target is a proposal for its owner to accept, change or refuse. Numbers
  quoted from existing evidence carry their file and line.

## What this does not prove

- Nothing here was rendered, heard or played. The looks are specifications; the stills that would show
  them are listed as build work in 07-BUILD.md.
- Starting parameter values for raw-native passes are first guesses to be tuned against stills and the
  measures named beside them, not results.
- Several inspirations were checked against public sources on 2026-10-22; facts that could not be
  confirmed are marked UNVERIFIED in 06-INSPIRATIONS.md.
