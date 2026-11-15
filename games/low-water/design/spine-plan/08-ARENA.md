<!-- writing-profile: research -->
# Spine plan 8: the inner arena, where the self-lies are made flesh

Part of [../SPINE-PLAN.md](../SPINE-PLAN.md). **PROPOSAL for the author.** The author's idea, relayed
verbatim by the coordinator, 2026-10-22: "What if the bossfights and arena can be the mettle in which
the primary character can improve their skills or dispositions and character flaws; and the
enemies/bosses are monstrous iterations and metamorphosis' of self in these terrible amalgamations of
the internal flaws."

## 1. What exists to build on

- **The arena mode** (`PROGRESS.md:223-226`, steps 154 to 156): eight archetypes with elites, two bosses
  with learnable phases, the Foreman and the Warden (`game/engine/combat/data/bosses.mjs`), a ladder of
  rounds with a boss every fourth (`game/engine/combat/arena/run.mjs`), a ring with no way out
  (`run.mjs:101`), and four boons, Edge, Frame, Wind and Footwork
  (`game/engine/combat/arena/runui.mjs:10`).
- **The Quota's external reskin**: the bread fights behind the Orme mill in eras 2 and 3, the boxing
  club in eras 4 and 5 (`design/quota/05-ARENA.md:12-15`). Men fight for a loaf, and "every loaf won is
  one a named family didn't get".
- **The self-lies**: voice lines tagged `{self: id}` and their `@selflie` records
  (`content/quota/q_readback.lwd:38-66`), kept in `G.state.selfLies` when heard
  (`game/engine/world/readback.mjs:70-73`). Five in the slice: SUM's "Nobody can say you didn't"
  (`content/quota/q_ned.lwd:71`), SUM's "You only add up what they send" (`content/quota/q_office.lwd:31`),
  PRIDE's "Nobody's going to come and check" (`q_office.lwd:109`), BALLAST's "forty go tomorrow"
  (`content/quota/q_will.lwd:63`), PRIDE's "You've never once lifted a hand to that boy"
  (`content/quota/q_dinner.lwd:191`).
- **Fight exits other than winning**: an encounter already maps `win`, `yield`, `fled`, `down` and a
  timed `talk` (`content/quota/q_community.lwd:259-267`).
- **Convictions as a precedent for a gain with a cost**: each `cv.*` raises some voices and lowers
  others (`design/THEMES.md:127-145`).

## 2. Two arenas, kept apart

| | The yard (external) | The inner arena (new) |
|---|---|---|
| Where | Behind the Orme mill; the club under the hoist (`05-ARENA.md:14-15`) | The same yard at night, in the morph look of the dream (`design/sensory/01-LOOKS.md`, L6 and L10) |
| Who fights | Real men in the fiction: the thresher, the doorman, the requisition corporal (`05-ARENA.md:24-31`) | The character's own self-lies |
| How it is entered | Walking in | Falling asleep in the chair by the stove, as on day 41 (`content/quota/q_dreams.lwd:32`), or the nip of spirit |
| What it changes | Bread, standing in the yard, a named family's loaf | The character's disposition |

The story fights at the granary door and on clearance day stay external and human: Holt and Leon
Brack are men (`05-ARENA.md:38-43`). Only the inner arena is monstrous.

## 3. The bosses are the self-lies made flesh

**Built from what this run heard.** Each `@selflie` gets a `@flaw` record. A flaw exists in a run only if
the character heard its self-lie and the player did not turn the voice away. Its body is assembled at
run time from the objects and the faces of the people that lie cost, chosen by the same conditions as
the self-lie's `happened:` lines. It speaks its own sentence, in the voice that first said it.

| Flaw (from the self-lie) | Built on | Its body, by route | How it fights | What resolves it |
|---|---|---|---|---|
| **The Pole** (BALLAST: "If one cart goes through without a pass, forty go tomorrow", `q_will.lwd:63`) | The Warden: hook, drag, whistle | A barrier pole jointed like an arm; a tally board for a face; on the arrest route it wears Tomas's brown coat with the cuffs turned back (`q_ned.lwd:83`) | It does not attack until the player approaches; it drags toward the district line; at half, it whistles, and forty carts come | **Lift the pole.** Walk through its drag without striking until it lets go. Beating it to the ground "proves" the order: the post holds, and BALLAST grows |
| **Received and Found Correct** (SUM: "Nobody can say you didn't", `q_ned.lwd:71`) | The Foreman | Ink, the good pen as a spine, a shine of India rubber where the face was; it carries Anni's tally pinned to it if Ned kept the tally | Slams that stamp; a sweep that rubs out the floor under the player | **Yield.** Put the pen down. Every blow the player lands signs another sheet |
| **Never Once** (PRIDE: "You've never once lifted a hand to that boy", `q_dinner.lwd:191`) | The grappler, made a boss | A man's arm across a table, too long, with a boy's shoulders hunched under it | Grabs, holds, leans; it never strikes first | **Lose.** It cannot be beaten. Going down under it plays Davey's shoulders and Edie's sleeve (`q_readback.lwd:66`). The loss is the truth |
| **Nobody Checks** (PRIDE, `q_office.lwd:109`) | The shield | Forty sacks stacked as a body, eighty painted on the front | Front blows glance off; it bashes | **Endure.** Survive its pattern without striking for the length of a count Will never made |
| **Only What They Send** (SUM, `q_office.lwd:31`) | The cutter swarm | Eleven chairmen's coats with nobody in them | They clap when one strikes | **Refuse.** Walk out of the ring. The exits are gone for every other fight (`run.mjs:101`); for this one there is a door, and the cost is waking with nothing changed |

**Somebody had to keep order** (`content/quota/q_lore.lwd:77`) is a family lie, not yet a tagged
self-lie. If the author tags it, its flaw is the Brack line's: a riot shield with Will's face, Leon's
knee and a thread caught on the rim. Defeating it by force is the lie proved, word for word. It
resolves only by enduring its drag to the end without the baton.

## 4. Rules that keep it from going soft

1. **Winning is not healing.** A flaw beaten by force hardens. Its voice's checks get easier to pass
   (its `dc` falls) and it speaks first at the next hinge. A hardened flaw can join the player's side
   in an external fight: BALLAST gives a boon at the granary door, in its own words. That is the
   horror, and it is the one place Celeste's ally-from-the-self is turned inside out.
2. **Some fights should be lost.** Never Once has no win state. A loss in the inner arena never ends a
   run (the frame forbids game-over cards, `design/QUOTA-DESIGN.md:42`); it plays what happened.
3. **Dispositions shift; they do not improve.** Every outcome writes a disposition on the convictions'
   pattern (`THEMES.md:127-145`): some voices up, others down, never a pure gain.
4. **Boons cost something the story takes away.** The four boons are renamed and priced:

| Boon (`runui.mjs:10`) | Renamed | What it costs, in the story |
|---|---|---|
| Edge, blows land harder | **The temper** | The next scene at the character's own table gains a beat: a child flinches |
| Frame, more standing | **Thick skin** | CONDOLENCE goes quiet for the rest of the era; lines it would have spoken are lost |
| Wind, more Breath | **The nip** | A `drink.taken` record (`PROGRESS.md:233`); the spouse's next line changes |
| Footwork, a longer dodge | **Keeping out of it** | "Step back" options come first in every later scene; the witness remembers him standing back |

5. **No fate can be touched.** No inner outcome writes `bowls`, `taken`, `members`, `end` or a witness
   beat. Tomas is dead on every route that holds him, whatever the player does in the yard at night.
6. **The persecution stays external and human.** No Hesh person, and no world perpetrator (Holt,
   Gedge, Pask, Krall), is ever a monster. The victims appear only as what the lie cost: a coat, a
   tally, a pair of shoulders, worn by the lie, never fought as enemies. The inner arena belongs to the
   player's character only; Bet's chapter and every Hesh character have none, so their suffering is
   never anyone's growth arena.
7. **Nothing is learned aloud.** No flaw speaks a lesson when it falls. No screen says what changed.
   The change shows in the next scene.
8. **No tally.** The arena's local run record (`PROGRESS.md:225`) is kept for the external yard only.
   The inner arena keeps no count of flaws beaten.

## 5. The lineage, and how this differs

From memory, high confidence on each title's form unless marked; method only.

| Work | What it does | How this differs |
|---|---|---|
| **Silent Hill 2** (Konami, 2001) | Monsters shaped by the protagonist's guilt and desire, Pyramid Head above all | These are assembled from the actual lines this run's character heard and the people this run harmed, so they differ per run; and defeating them is no step toward release |
| **Persona's Shadows** (Atlus, from Persona 3 and 4) | Accepting your Shadow turns it into a power | Acceptance here grants no power, only a shifted disposition with a price |
| **Hellblade: Senua's Sacrifice** (Ninja Theory, 2017) | Voices and battles drawn from a depiction of psychosis | These are moral evasions, never a mental illness; the handling rule "disorders as people, never labels" (`QUOTA-DESIGN.md:35`) forbids conflating them |
| **Psychonauts** (Double Fine, 2005) | Fighting inside minds to help their owners | Nothing here is therapy, and nothing is fixed |
| **OMORI**'s Something (OMOCAT, 2020) | A repressed act returning as a presence | The act is never hidden from the player; the presence is the lie told about it |
| **Celeste**'s Badeline (2018) | The inner adversary becomes an ally, and that is healing | When a flaw becomes an ally here, that is the lie winning |
| **Blasphemous**'s penitence (The Game Kitchen, 2019) | Guilt as a religion of pain, with relics and penance | Pain endured buys nothing; there is no penance mechanic. The penitent of the bread fights (`05-ARENA.md:30`) is a man in the fiction |

## 6. Files and checks

- **Records:** `@flaw` (id, `selflie:`, `boss:` built pattern, `parts:` with conditions, `resolve:` one or
  more of refuse, endure, yield, lose, and what force does). New content file `content/quota/q_flaws.lwd`.
- **Engine:** `game/engine/combat/arena/run.mjs` gains an inner ladder whose rounds are the run's
  flaws; `bosses.mjs` patterns are reused with parts swapped; dispositions write through the existing
  sheet and voice `dc` paths.
- **`tools/flawcheck.mjs` (new):** every `@flaw` names a `@selflie`; every flaw has a resolution that is
  not force; force always hardens; no part is a Hesh figure or a world perpetrator's figure; no inner
  outcome writes a fate field or a witness beat; no inner tally reaches the screen. Controls: a planted
  Hesh figure as a part fails; a planted force-win that softens a flaw fails.
