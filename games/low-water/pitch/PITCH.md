<!-- writing-profile: research -->
# Low Water: pitch

Private draft, 2026-10-16. Working title. Not for sending.

**A loss assessor on the night shift. A tidal harbour town. The night its great lamp went dark.**

The claim arrived three hours before the dark did. By dawn you must write down whose fault the dark
is, in a town where everyone did one small, reasonable thing.

## What you do

You walk a painted harbour town through one night, sunset to dawn, and you notice things. You read
the world with five instruments that answer back: a vain light meter, a gossiping barometer, a tide
table with a grudge against the moon, a hygrometer made from a dead colleague's hair, and a tin
weathercock. There are no dice. Every check reads the weather, the tide, the wind and the light as
they are at that minute, and the game tells you why it came out as it did.

- **Rain erases footprints.** Read them before 23:35 or lose them.
- **Fog lets you overhear.** The wind carries the conversation to you; the fog hides you from it.
- **Low tide opens the floor.** The drowned lighthouse is reachable for an hour and a half a year.
- **Sodium light eats colour.** Under the quay lamps, a green prism is grey. Carry it to a fire.
- **A blackout makes the town honest and dangerous.** Pull the switch yourself, if you dare.

## Why it is good

- A thriller that is tense, funny and sad, with no gun, no monster and no jump scare. The fear is
  social: who knew, and who saw you ask.
- A grotesque, warm town: a fishmongers' union that votes by smell in the dark, a congregation that
  prays to a broken light bulb, a harbourmaster who has been wet for eleven years.
- A verdict with costs. No answer is marked correct. The town's next night is lit by what you wrote.

## Why it shows off the engine

Every distinctive raw-native feature carries play: paint-over projection makes every place an
illustration you walk through; the spectral sodium pass makes colour disappear exactly where the
game says it does; dither-quantised lighting draws every blackout and the fogbound Flats; palette
lighting cycles the Gut; the lens suite gives the lamps and the great beam their weight; look keys
grade the night across eight slots; and one environment state ties weather, tide and light to the
rules.

## What exists today

- Story and world bible: `bible/WORLD-BIBLE.md` (town, four districts, seven factions, eight
  characters, the night minute by minute, the mystery's truth, lies and sixteen clues).
- Systems design: `design/SYSTEMS.md` (check grammar, tide clock, sodium rule, blackout, rumour,
  economy, saving; mapped to what the engine has built).
- A vertical slice of one hour on Lamp Quay, written in full: `slice/lamp_quay_2300.lwd` (about
  6,300 words, five provisional verdicts).
- A playable prototype of that hour: `game/`.
- Eight key frames and an eight-slot strip: `frames/`, described in `design/LOOK-BIBLE.md`.
- A 78-second mood film: `pitch/film/low-water-mood-film-1280x720.mp4`.

The prototype runs on the engine's web game loop; the full runtime follows the renderer milestones.
