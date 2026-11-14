<!-- writing-profile: research -->
# Sensory 5: care

Part of [SENSORY.md](../SENSORY.md). What exists, what is missing, and a measurable rule for each.

## 1. What exists

| Setting or rule | Where |
|---|---|
| Reduced motion ("No fades or slides"), also from the system's `prefers-reduced-motion` | game/engine/ui/settings.mjs:22; game/engine/ui/tokens.css:41; design/UI-SYSTEM.md:126-127 |
| Close looks on or off; never under reduced motion | game/engine/ui/settings.mjs:23; game/engine/ui/examinecam.mjs:7-8 |
| "Reduce bright flashes" (lens): fewer, smaller flares | game/engine/ui/prefs.mjs:21; game/engine/ui/platecam.mjs:83 |
| Effects flicker full, reduced or off; effects motion full or reduced | design/state/light.md:109-110 |
| Camera shake full, reduced, off; controller rumble on or off | game/engine/ui/settings.mjs:27-28 |
| Text size 0.88 to 1.5, interface scale, high-contrast dialogue, plain text | game/engine/ui/settings.mjs:19-25; game/engine/ui/prefs.mjs:10-11 |
| Pace of scenes: full, half, stepped | game/engine/ui/settings.mjs:31 |
| Never colour alone; every screen passes in greyscale | design/UI-SYSTEM.md:79-81 |
| Inner voices read as internal in mono; the voice name always on screen; pan can be turned off | design/VOICE-BIBLE.md:72-74 |
| Age rating through the platform's own process; no game-authored warning screen (author, 2026-10-22) | design/RATING.md |

## 2. Photosensitivity: a measurable rule

**The rule** (after WCAG 2.x's general flash and red flash thresholds, from memory, high confidence on
the three-per-second limit, moderate on the exact area figure):

1. **No more than three flashes in any one-second window**, anywhere on screen. A flash is a pair of
   opposing changes in relative luminance of 10% or more of the maximum relative luminance (1.0), where the darker state
   is below 0.80 relative luminance.
2. **Area.** A change counts when it covers more than 1/16 of the frame in any one place (480 x 270 at
   1920 x 1080). WCAG's own area is a quarter of a 10-degree field at a typical viewing distance;
   1/16 of the frame is the stricter of the two for a television at couch distance. Flagged as a
   judgement, to recheck against a Harding-style analyser if the author buys one.
3. **Red.** Any pair of opposing transitions to or from saturated red counts as a flash regardless of
   its luminance change. Saturated red: R / (R + G + B) of 0.8 or more in linear light.
4. **Red saturation ceiling.** No region over 1/16 of the frame holds saturated red (rule 3's test) with
   R above 0.5 linear for more than 0.5 s, outside the in-world posters and the hot mark.
5. **Under "Reduce bright flashes"**, the limit in rule 1 drops to one flash a second and the luminance
   swing allowed in any 1/16 window drops to 5% of the maximum relative luminance (0.05).

Wording changed 2026-10-22 (coordinator, design/spine-plan/DECISIONS-2026-10-22.md, "Inner arena staging calls" 1):
rule 1 read "10% or more of the brighter value", stricter than WCAG 2.x, and on a dark ground it counted changes
of a few thousandths of full luminance as flashes, which took nearly all light out of blows. It now follows WCAG's
published definition (10% of 1.0). The three-a-second limit, the red rules and the reduced-flash setting stand.

**Known risks in the current design, to fix before they are built:**

| Source | Risk | Fix |
|---|---|---|
| Era 5 police blue "strobing in pairs" (design/art/LIGHT.md:39, 100) | A double strobe is two flashes; two pairs a second breaks rule 1 | At most one pair every 1.2 s; its pool held under 1/16 of the frame or its swing under 10%; under the setting, a steady 0.5 Hz pulse with a 5% swing |
| The dream cue: the full dream look for one frame (game/engine/paint/dream.mjs:4-5) | A whole-frame change; brightness rises 8% and hue rotates (dream.mjs:22) | The cue stays a look change and never a luminance change of 10%; if a cue repeats within a second, the second is dropped |
| Hit dab, 3 frames in the colour of the light (design/LOOK-UNIFIED.md:93-96) | Small, but in the hot light under the state's carbide | Area well under 1/16; counted by the checker anyway |
| Muzzle flash at the granary door ("The guards fired") | Large and white in a dark room | One frame of flash at most once a second, area under 1/16; under the setting none, sound carries it |
| Failing fluorescent tubes, era 4 (design/art/LIGHT.md:100) | A flickering tube fills an office | Flicker swing under 10% when the tube's pool is over 1/16; `?fxflicker=off` steadies it |

**The checker** (proposed `tools/flashcheck.mjs`): reads frames from the harness's captures, computes
relative luminance per 480 x 270 window (sliding by half a window) and the red test per pixel, counts
opposing transitions per one-second window, and fails a scene that breaks any rule. **Controls:** a
planted full-screen 5 Hz flash and a planted 2 Hz saturated-red pulse over a quarter of the frame must
both fail; a slow 0.5 Hz breath of 5% must pass.

## 3. Colour-blind-safe verdict cues

The interface already passes in greyscale (design/UI-SYSTEM.md:79-81) and gear tiers widen with tier as
well as change hue (PROGRESS.md step 112). The world's own cues need the same care:

| Cue | Colour | Second channel that must carry it |
|---|---|---|
| A foe hidden behind paint | Red silhouette (PROGRESS.md step 106) | A hatched fill or a broken outline |
| The player's own hidden body | Dim teal silhouette | A solid fill |
| The state's light (carbide, police blue) | Hard white, blue | Value: the brightest thing in view; the lamp hum in sound |
| Era 5 hot mark | Police blue (game/engine/paint/glyph/eras.mjs:22) | Shape and the one-hot-mark rule |
| Surreal break | A look, not a colour | The sound signature (03-SURREAL.md) |

**Test** (proposed): every pair above, simulated for protan, deutan and tritan vision (Machado,
Oliveira and Fernandes 2009 matrices, from memory, high confidence on the method), must keep an OKLab
lightness difference of 0.12 or more or differ in its second channel. **Control:** a planted red-on-green
pair of equal lightness must fail for deutan.

## 4. Subtitles and captions for sound

Today the voice's name is always on screen; no caption system for non-speech sound was found in the
shell. Proposed rules:

- Every line has a subtitle with the speaker's name in Conso small capitals, as the talk panel does.
- **Captions for sound** in brackets, on their own line: "[The train brakes in the square.]". The
  harness lists every placed sound with gameplay meaning and fails one that has no caption.
- **The threat signal is captioned.** "[A lamp hums.]" whenever the requisition lamps' hum plays, so a
  deaf player gets the same warning (design/audio/SCORE.md:32).
- **Captions describe sound, never meaning the mix withholds.** The hollowed fifth after a false figure
  is never captioned as "[the music sours]"; the mix does not give the lie away (SCORE.md:142-143) and
  neither do the captions.
- Delivery tags show when they change meaning: [whispered], [over her]. Slurs are captioned as spoken.
- Settings: captions on or off, size (the text sizes), a paper background (on by default), speaker
  colour off by default (colour is never needed).

## 5. Ducking and loudness

Exists: ducking from the voice director's tags (person 9 dB under music, room 4 dB; whisper 6 dB more;
the read-back silences music and room; lines under 0.8 s apart share one duck), and renders measured to
BS.1770-4 with a -1 dBTP ceiling (design/audio/SCORE.md:139-156; design/state/audio.md:8-13;
game/engine/audio/master.mjs). Today's in-game anchor is dialogue at about -18 LUFS with music 5 to
10 dB under it (SCORE.md:154-156).

Proposed targets, as player profiles:

| Profile | Dialogue scenes, integrated | Other scenes | True peak | Loudness range |
|---|---|---|---|---|
| Speakers and headphones (default) | -16 LUFS plus or minus 1 LU | -18 plus or minus 2 | -1 dBTP | 12 LU or less |
| Home theatre | -24 LUFS plus or minus 2 (Sony's console guidance, from memory, moderate confidence) | -24 plus or minus 2 | -1 dBTP | 18 LU or less |
| Night | -16 LUFS | -18 | -3 dBTP | 7 LU or less |

The default profile raises today's anchor by 2 dB; the measured renders in PIECES.md would take a master
offset, not a remix. **Gate:** the harness renders each scene's mix for its scripted run and measures it
with game/engine/audio/analysis.mjs; a scene outside its band fails. Separate sliders for dialogue,
music, sound and voices in the head; a "dialogue boost" that deepens every duck by 6 dB.

## 6. Haptics

An intensity setting from 0 to 100% in steps of 25, scaling every motor value in 04-SENSES.md section
6; 0 is off. The existing on/off (game/engine/ui/settings.mjs:28) becomes this slider. No haptic carries
information that sound or picture does not also carry.

## 7. Rating, scene notes and a steady-world option

- **No warning screen.** The author, 2026-10-22: "The rating should be left up to the discretion of a
  rating board, and be done in the typical fashion ... the big warning is too much. Let people come to
  their own conclusions." The game shows no list of topics before the title. The age rating and the
  store page's content notice come from the platform's process (design/RATING.md). Boot shows only
  the short photosensitivity notice from design/RATING.md section 4.
- The internal content list (design/quota/07-PRODUCTION.md) feeds the rating survey and the
  sensitivity read. Add to it: flashing lights (residual, under the rule above), sudden loud sounds
  (gunfire at the granary door), and sequences where reality breaks.
- **Scene notes (proposed):** an accessibility setting that shows a one-line note on paper before a
  scene carrying a listed topic, with the choice to go on or step past, where stepping past is a story
  option that the record notes neutrally. Off by default, and listed in the settings menu with the
  other accessibility options. Nothing announces it at boot.
- **Steady world (proposed):** for players for whom unannounced breaks in reality are distressing,
  every surreal break is shown inside an era-window frame (a visible frame in the world), keeps its
  sound signature, and comes with its caption. Breaks are still there; they are never unannounced.
- **The read-back** cannot be skipped by design (design/quota/04-SYSTEMS.md:128-130). With "Pace of
  scenes" stepped, it advances one row per press, so a player can stop.
