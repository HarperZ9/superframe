<!-- writing-profile: research -->
# Sensory 7: the ten tasks that most raise the sensory bar

Part of [SENSORY.md](../SENSORY.md). Ranked by how much each raises what a player sees, hears and feels
per unit of work, with care items ranked high because they gate a Steam release. Efforts are my
estimates for one owner working on it, low to moderate confidence; owners are suggestions for the
coordinator.

| # | Task | Owner | Target | Failure test | Effort |
|---|---|---|---|---|---|
| 1 | **Style-state field (P22)** in raw-native, and its interim form in the shell (02-MORPHS.md sections 2 and 3) | Engine owner; rendering lead for the shell | Bounds s1 to s10 met: exact identity on the CPU, seam instability at most 1.10 times the scene's edges, mid-state at most 1.25 times, no double strokes, 1.0 ms at 1080p on the RTX 4090 for two states | The screen-anchored control (s6) and the crossfade control (s5) must fail; if either passes, the test is void and the feature is not accepted | 3 to 4 weeks engine (bounds, CPU reference, WGSL and HLSL, evidence); 1 week shell |
| 2 | **Flash and red checker** (`tools/flashcheck.mjs`) and the fixes it forces: the era 5 police strobe, the dream cue, the granary muzzle flash, failing tubes (05-CARE.md section 2) | UI lead with the light and effects lead | Every harness capture passes rules 1 to 5; under "Reduce bright flashes", rule 5 | Planted 5 Hz full-screen flash and 2 Hz red pulse must fail; a 0.5 Hz 5% breath must pass | 3 days |
| 3 | **Captions for sound**, with the threat signal captioned and the rule that captions never reveal what the mix withholds (05-CARE.md section 4) | UI lead with the audio lead | Every placed sound that carries gameplay meaning has a caption; captions follow text size and contrast settings | A harness list of meaningful sounds with a planted uncaptioned one must fail; a caption that names the hollowed harmony must fail a lint | 4 to 6 days |
| 4 | **Room acoustics for every place and footing from the plate** (04-SENSES.md sections 1 and 4): twelve new rooms in ir.mjs, footsteps by surface kind, shelter switching sky slaps for the room | Audio lead | Each Quota plate has a room; each footstep picks its kind from the geo buffer under the foot | A planted wrong kind (snow sound on a flag) must be caught by a test that walks a route and logs kind against sound; a room's measured t60 within 10% of its spec | 1 week |
| 5 | **Painterly depth of field for the close look** (`fx/post.mjs` does not exist; examinecam's focus request is read by nothing, design/state/gameplay.md:202-203) | Light and effects lead | On examine, strokes outside the focus range broaden and soften by depth; the prop stays at full stroke detail; never under reduced motion | Stills of the six slice props: the prop's edge coherence (design/art/PAINT-LANGUAGE.md:98-99) within 5% of no-DOF while the background's falls 30% or more; a control with focus on the wrong depth must fail | 4 to 5 days |
| 6 | **Runtime era window and memory look** (L8) on the field: a window, mirror or photograph showing another era with a world-anchored edge | Rendering lead (era window owner, design/state/painted.md:12) | P21's bound: inside equals the other era, outside equals the base, seam stable on a camera move (rn:docs/architecture/ROADMAP.md:253) | A screen-anchored window must fail the stability check | 1 week after task 1 |
| 7 | **Surreal records and checks** (03-SURREAL.md): `@surreal`, `tools/surrealcheck.mjs`, the blind notice test, the readability check | Gameplay engineer with the story lead; test run by the coordinator | Lint and play pass; notice test pooled Wilson lower bound 80% or more; false alarms 10% or fewer | The eight bad records fail; the no-sound planted break must change the result or rule 4 is dropped | 1 week, plus a test round |
| 8 | **Loudness profiles and the per-scene loudness gate** (05-CARE.md section 5) | Audio lead | Dialogue scenes at -16 LUFS plus or minus 1 LU in the default profile, true peak -1 dBTP; home-theatre and night profiles | A scene planted 3 LU hot must fail the harness gate | 3 days |
| 9 | **Haptics vocabulary and an intensity slider** (04-SENSES.md section 6; 05-CARE.md section 6); Steam Input when the native shell lands | UI lead | The six patterns play from their events; 0 to 100% scales every motor; 0 sends nothing | A test with the slider at 0 must record no `playEffect` call; a planted event with no matching sound or picture cue must fail the "haptics never carry information alone" lint | 3 days web; native later |
| 10 | **Silence budget and the attention rule measured** (04-SENSES.md sections 1 and 5) | Audio lead with the harness owner | Per-era music-silent share within 10 points of target; no unauthored near-silence; no scene above two foreground sounds for more than 4 s | A planted loading gap must be flagged as unauthored silence; a scene with three planted foreground layers must fail | 3 to 4 days |

## Next after the ten

- A footprint-filtered world anchor for strokes, the follow-up the P5 run names after its inferred cause
  (bristle and weave aliasing on foreshortened surfaces, rn:evidence/p5-world-strokes-runs.json:18 [p5]).
- P16 to P19 in raw-native, which most looks in 01-LOOKS.md need for the Steam build.
- A human round of the notice test and the photosensitivity checker against a commercial analyser.

## Order and dependencies

Tasks 2, 3, 8 and 9 need nothing else and can start now. Task 1 gates tasks 6 and 7's visual side and
every region look. Tasks 4 and 10 share the harness's audio logging. Task 5 is independent of task 1 in
the shell and becomes a field state later.
