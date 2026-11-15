<!-- writing-profile: research -->
# Voice bible: the prototype, the three tracks, the author's decisions

Part of [VOICE-BIBLE.md](../VOICE-BIBLE.md), split out on 2026-10-21 so no file passes 300 lines.  Section numbers are the bible's, kept across its files so references stay valid.

## 7. The prototype

**Scene.** Merrow at the Brine's stove (`brine.lwd`: arrive, the Damp, where, the light, the rope, the
sack, hiding it in Sabine's yard), 25 lines, five people and voices plus the narrator and the Damp. Chosen
for plain, spoken, concrete talk after the author rejected the recent aphoristic lines. The words are
the story lead's, unchanged; only the tags are new (`design/voice/merrow-stove.lwd`, 100% directed, 0
lint errors).

**Source.** Only the author's own consented voice: the private fine-tune
`<voice-private>/author-qwen3tts-ft-20261011` (Qwen3-TTS-12Hz-1.7B-Base, Apache-2.0, LoRA trained on the
author's 91 recorded clips), run locally. No paid API, no download, no other person's voice. The Damp is
a designed object timbre made from the same source.

**Method.** Same takes for both versions, so the difference is the method.
- *Old*: every line in the source voice as synthesised, even gaps, mono, no direction; inner voices sound
  like everyone else.
- *New*: per-character voices made by our own converter (the explainer guides' TD-PSOLA and formant
  warp), direction applied per line, cues placed, people in the Brine's room, inner voices in the head,
  the Damp at the hip, overlaps at `<cut>`.

**Files** (`game/capture/voice-2026-10-21/`, git-ignored; private, see section 9):
`old.wav` (2:13), `new.wav` (2:31), `inner-stem.wav` (the head alone), `timeline.json` (every line's time,
direction, space, portrait cue and jaw track), `script.json`, `sheet.png` (spectrograms and the stereo
layout), `measure.json` and `PROTOTYPE.md` (results and how to reproduce).

**Cost.** GPU: two jobs under `tools/gpu-lock.mjs`, 111 s and 125 s (53 segments batched 8 at a time).
CPU: the mix and the measurements under `--lock heavy-cpu`.

Results and their limits are in `PROTOTYPE.md`. The short form is in section 8.4.

## 8. Methodology: three tracks

### 8.1 The size of the job

Measured from the acts on 2026-10-21 (all branches, which a recording must cover even though one play
hears part of it): 132,200 words of spoken text: narration 67,500 (51%), people 46,700 across 44
speakers, inner voices 14,200, instruments 3,800; Lamb's spoken options add up to about 12,500 more.
At the author's own reading pace (about 150 words a minute, my estimate from 3.9 syllables a second)
that is about **16 hours of finished audio**, before retakes and alternates. Two speakers carry half of
it: the narrator and the inner voices together are 62%.

### 8.2 The tracks

| | A: human actors | B: synthesis from consented sources | C: hybrid (recommended) |
|---|---|---|---|
| Who | A cast directed from this bible and the tags | The author's own voice (fine-tuned, converted per character) and designed object voices; licensed voice data only with documented consent | Humans for the narrator, Lamb and the inner voices' source, and the principals in key scenes; synthesis for walk-ons, barks and crowd |
| Performance | Best. Actors find readings no tag predicts | Good for even, dry delivery; weak in high emotion, laughter, shouting and crying; voices far from the source (women and children from a male source) are the weakest | Human where it matters most; the risk of B sits only in short, low-stakes lines |
| Direction | Tags as the session sheet | Tags drive the renderer; a human reviews every line | Both |
| Cash | Talent, studio, director, editing. My estimate, low confidence, for quotes to replace: non-union indie rates about $25k to $60k for 16 hours; union scale (SAG-AFTRA) about $100k to $160k all in | About $0 cash; GPU time (about 2 s per second of speech at batch 8 on the RTX 4090, so roughly 30 GPU-hours for a full pass and 100 with retakes); a human review pass of 60 to 100 hours | Narrator and inner-voice source (about 8 of the 16 hours) plus principals' key scenes: my estimate $15k to $45k non-union |
| Time | Booking, sessions, pickups; months | Weeks, and it can start now | Synthesis first as scratch; human sessions replace it scene by scene |
| Obligations | Contracts; a union agreement's AI terms if any synthetic use of the performances is planned | Steam disclosure; written consent for every source; no likeness of a real person | Both |

### 8.3 Recommendation

Track C, in two phases.

1. **Now: synthesis as scratch voice for the whole game.** Every line voiced by the track B pipeline from
   the author's own voice, directed by the tags. It costs no cash, gives the game timing, portraits,
   lip sync and playtest audio, and exercises every tag. It also shows which scenes synthesis cannot
   carry, which tells the budget where actors matter.
2. **Before release: actors where synthesis is weakest and where the player listens hardest.** The
   narrator first (half the words, and the game's voice), then Lamb and the inner voices from one actor
   who consents in writing to their voice being processed into sixteen moods (the Disco Elysium choice of
   one performer for all the voices, made here with processing), then the principals' key scenes (the
   cuffs, Merrow's light, Wenna's stairs, the trial). Walk-ons, crowd and barks stay synthetic with
   designed voices.

Why not B alone: the prototype's weakest voices are the ones furthest from the source (Sabine, a woman
made from a man's voice), and the scenes this game is built on are grief, shame and anger, where
synthesis is weakest. Why not A alone: it costs the most and blocks on a budget the author has not set,
and a scratch pass is needed for timing anyway.

### 8.4 What the prototype shows and does not

From `PROTOTYPE.md` (instruments: Whisper large-v3 and WavLM-SV, neither shares weights with the voice
model; same takes in both mixes):
- Intelligibility held: 16 word errors in 407 for the new mix, 18 for the old, almost all names and
  numbers the scorer does not normalise.
- The people came apart: speaker similarity between characters fell from 0.94 to 0.985 (one voice) to
  0.69 to 0.83, except **Merrow and the narrator, still 0.961**, nearly one voice; the next pass moves them
  apart. The inner voices stay at 0.89 to 0.96 to Lamb, as designed.
- It does not show whether any voice sounds natural, in character or good, whether the inner voices read
  as internal, or whether Sabine (a woman's voice made from a man's) is acceptable. Only listening settles
  that, and the author has not listened yet.

### 8.5 Obligations

**Steam.** Steam's content survey asks a developer to disclose AI use in two kinds: pre-generated content,
"any kind of content that ships with your game and is consumed by players", described "in detail", and
live-generated content, which also needs a statement of guardrails (Steamworks, "Content Survey",
partner.steamgames.com/doc/gettingstarted/contentsurvey, read 2026-10-21). Press reports from 2024 say the
answers appear on the store page in a section titled "AI Generated Content Disclosure"
(videogameschronicle.com, 2024), and that Valve narrowed the rules in January 2026 to content players
experience, exempting AI tools used only for efficiency (videogameschronicle.com, 2026-01-17). The
Steamworks page I could read does not itself say what is shown on the store page; confidence that a
store-page disclosure is required for synthesized voice that ships: **high**; confidence in the exact
current wording of the form: **moderate**, so the author should read the live form when submitting.
Low Water's voice work would be pre-generated content. Synthesized scratch voice that is fully replaced
before release needs no disclosure; any synthetic line that ships does.

Draft disclosure for the author to edit: "Some character voices in Low Water are synthesized. They were
made on our own machine from recordings of the developer's own voice, with the developer's consent, and
from designed voices that imitate no real person. Every synthesized line was directed and reviewed by a
person. No voice actor's performance was used to train or create a synthetic voice." (The last sentence
holds only if track C contracts say so.)

**Consent norms** (from press and a law firm's summary, not the agreement's text; confidence moderate):
- SAG-AFTRA's Interactive Media Agreement, ratified July 2025, requires informed written consent for a
  digital replica of a performer's voice or likeness, a description of every intended use, the right to
  suspend consent during a strike, set minimum pay for replica use, and usage reports.
- The same norms run through Equity (UK) guidance and the voice-actor associations: consent per use,
  pay for use, a right to see and stop (from memory, low confidence on the details).
- Tennessee's ELVIS Act (2024) makes an unauthorized imitation of a person's voice actionable (from
  memory, moderate confidence).
- The EU AI Act's transparency article requires synthetic audio to be marked as such, with obligations
  phasing in from August 2026 (from memory, moderate confidence; check before an EU release).

House rules, whatever the track: never clone, imitate or prompt for the voice of an actor, a public figure
or any real person without their written consent for that use; keep every source's consent on file with
the source's hash (the author's is `2026-10-03-voice/MANIFEST.json`); a human hears every synthetic line
before it ships; the credits name every human voice and say which voices are synthetic.

## 9. Decisions only the author can make

1. **Using the author's own voice in a commercial game.** The author's recordings were made for site
   narration (RECORDING-GUIDE.md, 2026-10-03), and on 2026-10-11 the author approved character voices
   derived from his voice for the site's guides while keeping his unaltered voice for his own work. A
   Steam game is a new use. The prototype stays private until the author says yes, and the scratch pass in
   8.3 waits on the same yes.
2. **The budget for actors** (track C phase 2, or A), and union or non-union. Quotes replace my estimates.
3. **The disclosure wording** on Steam (draft in 8.5) and in the credits.
4. **Lamb voiced or silent.** Lamb's spoken options are about 12,500 words. A silent Lamb (the player's
   words on screen only) saves an actor and keeps the player's voice their own; the inner voices would then
   need their own source instead of Lamb's. My lean: Lamb voiced, quietly, because the voices are Lamb's
   voice and a silent Lamb breaks that link.
5. **Whether one actor plays the narrator and the inner voices** (the reference's choice) or Lamb's actor
   plays the voices (this bible's choice).

## 10. Next

- Tag the key scenes in the acts with the story lead (a voice pass adds tags only), starting with the five
  scenes in 8.3.
- Read the new sheets (`design/characters/`, 2026-10-21) against the profiles: where a sheet's
  `never_says` can be checked mechanically, add the rule to profiles.json; where a sheet's `register`
  and a profile's timbre disagree, settle it with the story lead.
- After the author listens: tune or replace Sabine's voice (the furthest from the source), then render a
  second scene with a principal from each people.
- Give the talk screen a voice track: play the line's take, drive the portrait from `portraitCue` and the
  jaw track, place inner voices in the head (the runner already hands every line its `dir` and `cues`).
