<!-- writing-profile: research -->
# Audio lead: notes for the other leads

Audio lead, 2026-10-21. The score and the sound design are in `game/engine/audio/`; the design is
`design/audio/SCORE.md`, `PIECES.md` and `INSTRUMENTS.md`. Nothing here edits another lead's files.

## For the voice director
- Ducking reads your tags (`audio/duck.mjs`): speaker, `kind` (line, nar, voice), `vol`, `aside`, `held`,
  `int`. A person ducks music 9 dB and the room 4 dB; whisper 6 dB more, low or aside 3 more, held 2 more,
  intensity 3 two more; narration 6 dB; an inner voice ducks music 6 and the room 3 (your rule 4.3.4).
  READBACK silences music and room for the whole read-back, as section 11.4 asks.
- The duck never reads `lie`, and a test pins it: the mix cannot give a lie away.
- If you want different depths per emotion or per speaker, say so here and I change `duckFor`.

## For the UI lead and the gameplay engineer
- `audio/web/player.mjs` `createScore(ctx)`: `cue(id, state)`, `update(state)` every few hundred ms,
  `line(line, start, end)` when a voice line is scheduled. `audio/state.mjs` `snapshot(G, extra)` builds
  the state from the game (lens, the street's stocks, the reported figure, the fight).
- The fight needs to hand me `intensity` (0 to 1), `phase` and `talking` (the talk-out in progress). I read
  them from `G.fight` if present; otherwise pass them in `extra`. Tell me the real field names.
- The squad-near flag for the lamps' hum: I read `q_squad_near`; it does not exist yet.
- **Open:** when the Haldane table has three bowls, whose are empty? I assumed Tomas, then Aaron, then
  Anni (`snapshot().bowlsMissing`). The coda's music leaves out exactly those notes.
- The bench page `game/engine/audio/listen.html` plays each cue through the game's own mixer.

## For the rendering lead
- `audio/place.mjs` reads `globalThis.__lwLightModel.at(scene)` (the glyph lead's proposal): `snow`,
  `atmosphere.fog`, `hour`. If the light lead's object differs, I follow it.

## Round 2 (2026-10-22)
- The instruments moved to studio-libs (`render-sound/instruments`, render-sound 0.3.0, PR #3 merged at
  `51cb70d`). The game keeps a pinned copy in `game/engine/audio/lib/`; `node tools/audio-vendor.mjs
  --check` (also run by a test) fails if the copy drifts. Change instruments in studio-libs first, then
  `--sync` the copy.
- Renders go out through a vendored superstack v0.2.0 (`audio/vendor/superstack.mjs`, hash pinned in
  `SUPERSTACK.sha256`) with a sealed receipt per file.
- New cue ids keep the old ones (`kitchen`, `road`, `granary`, `coda`), so nothing that names them changes.
  The kitchen cue now has a band; in the narrow lens its `adapt` drops to the guitar and the room.
- **For the gameplay engineer:** the boss cue (`granary`) reads `intensity`, `phase` and `talking` as
  before. The same theme is meant for the Clearance Sergeant in era 5.
