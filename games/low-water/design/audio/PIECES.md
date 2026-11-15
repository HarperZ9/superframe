<!-- writing-profile: research -->
# The Quota: the slice's pieces

Audio lead, 2026-10-21. Part of [SCORE.md](SCORE.md). Each piece is code in
`game/engine/audio/pieces/<id>.mjs`: its form, its harmony, its stems, how it follows the game (`adapt`),
and a listening script that plays it through the game's own mixer. Renders: `game/capture/audio-2026-10-21/`
(git-ignored), made with `node tools/audio-render.mjs` from `game/engine`. Every render is a pure function
of seed 1. The reference idioms are named here for the author; none is named in the game, and nothing is
quoted from them.

## The pieces

**The dawn tower** (`dawn.wav`; wide lens, `q.tower`; 32 bars at 54, a loop; the render plays it twice).
The square from the bell tower on day 41. A D drone with its sub holds the whole cue; a harp walks the drone's
fifth and ninth with the Hesh rain falling into it now and then; in B a piano far off in the long room plays
the five bowls of the Haldane table over four chords on the pedal; in C the export train leaves and iron
rubs a semitone above the drone while the church bell counts the new rows; in A' a breathy flute and its
shadow play the Hesh phrase, ending a step up, and the cue thins back to the drone. Yamaoka's method frames
it (the train is in the music, the room is huge, the dread is a semitone); Coltrane's harp-over-drone and
Sakamoto's far, decaying piano are the colour. The second pass is heard after an inflated report: from bar
41 the drone's fifth is a semitone low, and from bar 57 the Hesh layer is gone.

**A kitchen at night** (`kitchen.wav`; `q.furrowe_kitchen`, `q.brack_kitchen`; the kitchen theme, THEMES.md
3; 32 bars of 4/4 at 66, swung, AABA, a loop; played twice). Round 2 rewrote it as a small cool-jazz band
in the Twin Peaks manner, kept quiet: a clean guitar with a slow amplitude tremolo and a little echo
sings the tune, an electric piano comps on one and the swung and-of-two with a slow auto-pan, an upright
bass walks with half-step approaches, fingers snap on two and four, a brush sweeps, a pad holds the
chords. The chords carry the sourness (D minor with a major seventh; B flat minor six under the home key).
In the narrow lens the band drops away and leaves the guitar and the room. The second pass is after an
inflated report: the fifths fall a semitone and the home F becomes D flat major seven.

**The district office** (`office.wav`; `q.returns`, `q.office`; 24 bars at 72, a loop; played twice). The
notice press is the pulse, one cycle a bar; a sub drone on D; the ledger, a muted guitar spelling the
reported figure in eighths, three to a figure against four beats; in B four low piano chords and rubbed iron.
Yamaoka's machine-as-rhythm and distance, with the ledger as the one tune. The render plays the inspector's
true 205 (E, rest, A), and at bar 29 the figure is written: the ledger spells 290 (E, high E, rest), the
drone's and the iron's fifths drop, crossfaded over two bars on the bar line. Nothing else marks it.

**The requisition road** (`road.wav`; `q.post`; the road theme, THEMES.md 4; 40 bars at 76, half-time, a
loop; played twice). Round 2 gave it a tune: the doubled-course guitar in tremolo sings the road theme
over the lamps' 100 Hz hum; strings hold the chords and the bass walks the Brack drag; a slow broken beat
with iron in it enters for the second half; four bars of only the hum and the wind where the cart is
turned back; the tune again an octave up with the strings doubling it below and a low wordless choir
(oh): the cue's one release; then the hum alone. The second pass is after the blamed report.

**The granary door: the Requisition Captain** (`granary.wav`; story fight 1; the Captain's theme, THEMES.md
5; 16 bars at 92, a loop; played five times). Round 2 made it a boss theme, liturgical and wrong: a choir
in octaves with a fifth under it chants the theme, a full organ holds the chords, strings drive in
eighths, procession drums and a broken beat with iron, the church bell every four bars; the B half moves
up a minor third to F minor, a tritone off the D it returns to. Passes: 1 the organ pedal, chute and drums;
2 adds strings and bass; 3 adds the choir, organ and bell; 4 adds the chain and the choir an octave up
(phase 2); 5 the talk-out: everything falls away on the bar and the true figure plays on a harp over a
pad. Godskin-style weight (choir, organ) as colour on Yamaoka's industrial beat.

**The coda at the Haldane table** (`coda.wav` electric piano and pads; `coda-piano.wav` solo piano;
`coda-3bowls.wav`; the Haldane theme, THEMES.md 1; 50 bars of 3/4 at 63, linear). Round 2 rewrote it
around the full Haldane theme, after the *Unbreakable* idea of a quiet ostinato and a slow build to one
release: four bars of a broken-chord ostinato alone; the theme on top, the bowls with Tomas's note a rest;
the theme an octave down in the strings while pads open and a wordless choir enters; the bridge with
everything, the cue's only loud moment; the theme's last phrase on the electric piano alone, the hole still
there; the ostinato thinning to an open E. `coda.wav` voices it for electric piano, pads, strings and choir
(the Twin Peaks colour, where synthesis is strongest); `coda-piano.wav` is the same music on the rebuilt
piano with its soundboard and sympathetic strings.

**The read-back** (`readback.wav`, `readback-hinges.wav`; linear). The rule is silence (QUOTA-VOICES 11.4).
`readback.wav` is the threshold: the coda's room fading over two bars, then sixteen seconds of digital
silence. `readback-hinges.wav` is option B: the same, then one low piano note in the gap before each of
five hinges, the five bowls once each across the record, never under a line.

**The bread fights** (`arena.wav`; behind the Orme mill at night; 32 bars at 100, a loop; played twice). The
yard is the band: the mill's stones, a hand on a crate, stamps and claps, iron from the hoist, a bass vamp on
D dorian, a reed calling and answering itself. Lateef's soul-jazz vamp and flute-or-reed lead are the
colour, with Yamaoka's found-sound percussion. The script brings the layers in (crate, then bass and stamps,
then claps and iron, then the reed), and at bar 49 the bout ends: the next bar line drops the fight's
layers, exactly as it brought them in, with no flourish.

**The theme suite** (`suite.wav`; linear, about four minutes). The five themes of THEMES.md in turn, each
in its own tempo and arrangement: the Upper Town on electric piano over strings; the Haldane theme with
the ostinato, strings and pads; the kitchen's A sections with the band; the road's first half in tremolo
over strings and the hum; the Captain's chant with organ, strings and drums.

**The motif sheet** (`motifs.wav`; linear). Each leitmotif of SCORE.md section 4 once, four bars each.

**Sound design** (`sfx-square.wav`, `sfx-kitchen.wav`, `sfx-office.wav`, `sfx-post.wav`). The square from
the tower (wind and frost at the tower, the queue at 50 m, the export train standing then leaving at 150 m,
a cart crossing, the church bell); the Haldane kitchen close (the stove, five bowls set down, spoons, a week
later four); the returns room (the ledger pen, the press and the corridor through the wall); the road post
(the lamps, the cart arriving and turned back, steps in snow, frost). Each placed by `place.mjs` for its
lens.

## Measurements

Measured on the renders with `audio/analysis.mjs` (BS.1770-4 K-weighting and gating; true peak by 4x oversampling), 2026-10-21, seed 1. Targets: -18 LUFS (-16 for the fights, -20 for the quiet rooms, -26 for the read-back), ceiling -1 dBTP. Where a piece sits below its target (road -19.5, arena -17.2, office -18.3), its transients hit the ceiling first; I left the dynamics alone rather than squash them. The seam's jump ratio is the step across the loop point against the piece's typical sample step: a click would read in the tens or hundreds, and every loop reads under 3.2. The head-against-tail level is large where a loop starts on a downbeat (the kitchen, the granary, the arena): that is the music, not a seam.

| File | Length | Integrated LUFS | Short-term max | True peak dBTP | Clipped samples | Loop seam (jump ratio; head against tail) | In-game offset |
|---|---|---|---|---|---|---|---|
| dawn | 4:44 | -18.0 | -14.0 | -1.3 | 0 | 0.73; 1.6 dB | -6 dB |
| kitchen | 2:55 | -20.0 | -18.0 | -2.5 | 0 | 0.51; 11.8 dB | -10 dB |
| office | 2:40 | -18.3 | -14.9 | -1.3 | 0 | 0.28; 0.2 dB | -8 dB |
| road | 3:22 | -19.5 | -16.8 | -1.0 | 0 | 0.83; 4.4 dB | -7 dB |
| granary | 2:47 | -16.2 | -13.1 | -1.2 | 0 | 0.45; 14.0 dB | -5 dB |
| coda | 2:08 | -20.0 | -18.6 | -2.2 | 0 | linear | -9 dB |
| coda-3bowls | 2:08 | -20.0 | -18.3 | -2.8 | 0 | linear | -9 dB |
| coda-5bowls | 2:08 | -20.0 | -18.9 | -3.3 | 0 | linear | -9 dB |
| readback | 1:12 | -26.0 | -23.8 | -9.2 | 0 | linear | -12 dB |
| readback-hinges | 1:12 | -27.1 | -24.9 | -7.9 | 0 | linear | -12 dB |
| arena | 2:34 | -17.2 | -14.8 | -1.1 | 0 | 3.15; 11.7 dB | -6 dB |
| motifs | 2:48 | -18.0 | -12.4 | -4.8 | 0 | linear | 0 dB |
| sfx-square | 1:08 | -20.1 | -14.0 | -1.3 | 0 | linear | 0 dB |
| sfx-kitchen | 1:08 | -20.9 | -17.4 | -1.2 | 0 | linear | 0 dB |
| sfx-office | 1:08 | -20.1 | -19.8 | -1.0 | 0 | linear | 0 dB |
| sfx-post | 1:08 | -20.0 | -18.2 | -7.2 | 0 | linear | 0 dB |

## What to listen for first, and questions for the author

1. **The coda's piano, alone.** It is the most exposed instrument in the slice and the one synthesis does
   least well (INSTRUMENTS.md). If it does not hold up, the fix is a sampled piano (a download the
   coordinator must approve) or a pianist.
2. **The office at bar 29.** Can you hear the figure being written, without a sting? If you cannot, the
   change is too subtle; if it sounds like a cue, it is too strong.
3. **Vocals.** Yamaoka's method puts a song with a voice at key moments. The synthetic hum cannot do it.
   Is there a singer, and where: the coda, the read-back's end, era 5?
4. **Whose bowls are empty at three?** I assumed Tomas, then Aaron. The gameplay engineer's model decides;
   the music follows it.
5. **The read-back: silence or option B?** The voice bible says no music under it; option B plays only in
   the gaps. Your call.
6. **The lamps' hum.** Is the 100 Hz hum against D the right irritant, or too much for a long scene?
