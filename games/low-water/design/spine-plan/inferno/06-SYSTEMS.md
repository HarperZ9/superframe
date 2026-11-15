<!-- writing-profile: research -->
# Inferno 6: systems, on the arena code that exists

Part of [../10-INFERNO.md](../10-INFERNO.md). **Every item is PROPOSAL** with an effort estimate in agent
days (S is half a day, M one to two days, L three to five), from reading the code on 2026-10-22. No code
is changed by this plan.

## 1. What exists, and what each boss is built on

| Exists | Where | Used for |
|---|---|---|
| Ten archetypes with signatures and elites | `game/engine/combat/data/archetypes.mjs`; costs and first rounds in `game/engine/combat/arena/run.mjs`, `POOL` | Summons inside boss fights: the host of carts (swarm), the Hydra's heads (cutter), the coats (holder), Nobody Checks (shield) |
| Bosses with phases by standing left, a fixed pattern per phase, a rest after each round of it, openings once per phase | `game/engine/combat/data/bosses.mjs`; `game/engine/combat/ai/boss.mjs` | Every boss. A phase change already emits `boss.phase` and refills poise with a roar |
| Reskins: a boss with no phases plays its model's | `bosses.mjs`, last line | Fond of Them and Received and Found Correct on the foreman; Forty Carts, He's With Me and Nearest One on the warden; the Long Barn on the captain (`captain.drag` toward the chute); Order on the sergeant (`frontGuard`, `sergeant.bash`) |
| Moves that use the arena: drag toward an anchor, a wall stun, a summon | `bosses.mjs` specials: `toward: "chute"`, `wallStun`, `summon` | The Pole's drag to the district line, the Barn's chute |
| The ladder: rounds, waves, a boss every fourth, offers between | `run.mjs`, `LADDER`, `planRound`, `offers` | The external yard only. The inner run is new (section 3) |
| Boons that act at once, with focus | `run.mjs`, `BOONS`; names in `game/engine/combat/arena/runui.mjs:10` | Renamed and priced (section 4) |
| A venue boon written to a story record when taken | `run.mjs`, `choose`, `record: true` and `onRecord` (the nip of spirit, `skins-quota.mjs:26`) | The pattern every inner boon's cost follows |
| Fight outcomes: win, yield (the other side gave in), fled, down, talk, lose | `game/engine/combat/sim/world.mjs:214-230` | Mapped below |
| A timed talk exit from a fight to a node | `content/quota/q_community.lwd:263` | The naming verb |
| Self-lies heard, kept in `G.state.selfLies` | `game/engine/world/readback.mjs:70-73` | Which flaws exist in a run |

## 2. New verbs and outcomes

| Verb | What the player does | Engine | Outcome | Effort |
|---|---|---|---|---|
| **Refuse** | Walks out through a door this fight alone has | `run.mjs` passes `exits: []` today; the inner run passes the flaw's own door. The fled timer (`world.mjs:228`) ends it | `fled`, read by the inner run as refuse | S |
| **Endure** | Survives the boss's pattern without landing a blow | The boss brain emits `boss.rest` after each full round of its pattern (`boss.mjs`). New: the world counts the player's landed hits on the boss; when `rests >= flaw.endure.rounds` with no hit landed, end | New `endured` | M |
| **Yield** | Lays the tool down and takes the act the lie forbids: puts the pen down, lifts the pole, rubs out the word, drops the baton, opens the hand | New player action, `lay`: hold guard and the interact input for 1 s; the tool drops; a flaw may name a held follow-up (`rub`, `lift`, `release`) at an anchor | New `laid`, or a flaw-specific scripted end | M |
| **Lose** | Goes down | `down` exists (`world.mjs:217`). The inner run plays the flaw's loss node and never ends the run | `down`, routed to a node | S |
| **Name** | Chooses, from a lie's read-back row, what happened over what was told | The timed talk exit pattern, opened as an overlay over a live fight: the world keeps running, so naming costs standing | `talk` with the row id | M |

**Rules the engine keeps.** The paper UI, the telegraphs and the ways out never break
(`design/sensory/03-SURREAL.md`, rule 6). Every new outcome is announced by sound and picture, never by
a banner saying what it meant (08-ARENA rule 7).

## 3. The inner run, the Descent, and the ladder

- **The inner run (new, `game/engine/combat/arena/inner.mjs`).** Not the ladder. It is armed by hinges:
  after a scene whose self-lie was heard and kept, the night's sleep opens the stove door
  ([01-SOURCES.md](01-SOURCES.md) section 9) and plays that one flaw. One fight, then the morning. Its API
  mirrors `createRun`: `createInnerRun({ flaws, kept, onRecord })`, `stage()`, `world(G, arena)`,
  `finish(W)`, `choose(i)`. **Effort L.**
- **No tally.** The inner run keeps no records, has no `record()`, writes nothing to storage, and its end
  card does not exist: the next scene is the morning (08-ARENA rule 8; critic rule 4, the fight ends at a
  table). **Effort S, plus the check in section 6.**
- **Kept flaws.** A flaw beaten by force is kept: it hardens, joins as an ally at one external fight in
  its own words (08-ARENA rule 1), and returns in the Descent and the Adversary.
- **The Descent (the author's "arena of intense battle").** Once, at the end of era 5, before the
  Adversary. The run's kept flaws return in era order, in rings after Cocytus, from the outer yard to the
  ice. Each enters in its last phase. Between them there is no offer card and no mend beyond the ladder's
  `mendWave`; the arena narrows ring by ring (the arena's walls are anchors; each ring removes one).
  Flaws resolved without force do not return: their ring is empty, a yard in snow with the stove door
  open, and the player walks through it. A run that resolved everything without force walks the Descent
  in silence to the ice. **Effort M.**
- **Intensity without volume.** Escalation comes from phases, morphs, a shrinking arena, faster rests
  (the boss data's `rest` frames fall per phase, as the Foreman's do, 110 to 72 to 40) and the sound
  design, and from size only where a lie stops fitting the house: a single-sin boss in its first form
  stays under the Brack kitchen's ceiling (its horror is that it is the size of a man at your table);
  the amalgamations (the Host) and every morph phase may exceed the room, and the room gives way round
  them (the ceiling splits, the walls lean out). Changed 2026-10-22 by the coordinator
  (DECISIONS-2026-10-22.md, "Inner arena staging calls" 2), after the author's "terrible amalgamations"
  and "up to 11"; before, only Saturn reached the ceiling (critic's volume test,
  `design/critic/07-INFERNO.md`, section 3).
- **The external ladder stays as it is.** The bread fights and the club keep `LADDER`, records and
  boons. The arena menu mode never offers inner bosses: a farmable inner gym is the self-help arc the
  critic rejects (`design/critic/06-BOSSES.md`, section 2.4). This is where I agree with the critic
  against the author's "arena" in its broadest reading.

## 4. Boons with costs

- **Only after force.** The offer card appears only after a force outcome. Refusing, enduring, yielding
  and losing offer nothing.
- **One offer, the boss's own.** No choice of three. The player can decline it.
- **Each boon is the harmful verb sharpened** (critic rule 3): a clearer signature, a harder Friday
  blow, a nose for the hoard. The skill improves; the man does not.
- **The cost is recorded at once** on the existing `onRecord` path, as the nip of spirit is: an event
  `boon.cost { flaw, boon, who, node, beat }`. The named person's later scene reads it and plays the
  beat. 08-ARENA's renamed four (the temper, thick skin, the nip, keeping out of it) stay as the inner
  run's generic boons with their costs.
- **Never a fate.** A cost is a beat in a scene: a moved chair, a turned face, a silence. It never
  writes `bowls`, `taken`, `members`, `end` or a witness beat (08-ARENA rule 5).
- **Effort M** (offer card, cost event, the scene-side read for twelve beats).

## 5. Bosses: data and brain

| Change | Where | Effort |
|---|---|---|
| `@flaw` record, extended from 08-ARENA: `selflie`, `town` (the virtue name), `sin` (designer label, never shown), `hinge`, `boss` (a `BOSSES` id to reskin), `phases` with `morph` (a style state, an arena change, a summon), `resolve` (`refuse`, `endure`, `yield`, `lose`, `name`, each with its node), `force` (outcome node and `dc` shifts), `boon` with `cost`, `faces`, `objects`, `anchor` | New `content/quota/q_flaws.lwd`; loader in `game/engine/world/` | M |
| **On-strike effects**, per phase: `heal` (Fond of Them's bows), `sign` (Received), `summon` (the Hydra, two per blow), `grow` (He's With Me), `freeze` (the Host, footing worsens) | `boss.mjs` reads the phase; `world.mjs` emits the player's landed hit with its target | M |
| **Unbeatable** floor: standing never falls below a share, and the fight ends by another verb or by the player going down | `bosses.mjs` field `floor`; `world.mjs` clamps | S |
| **Morph phases** that change the arena: shrink the floor, add or remove exits, swap the arena's look | `boss.phase` events already fire; the arena page listens and calls the style-state field and arena edits | M, plus the rendering lead's style-state work (`design/sensory/02-MORPHS.md`) |
| **The father's shadow tells** (Friday): a telegraph drawn as a wall shadow, not on the boss | `game/engine/ui/fightways.mjs` draw path, a new tell kind `shadow` | S |
| **The Adversary.** A: a reading encounter with the naming overlay and a struck-line list; B: a boss with limbs as sub-targets, each removed only by `name`; C: no boss, a walk with the naming overlay | New; reuses the overlay | L for A or B, M for C |

## 6. Checkers to write

All in the house style: static, then played over the builds and routes, each with planted controls that
must fail (as `tools/surrealcheck.mjs` is specified, `03-SURREAL.md`, section 5.1).

| Check | Fails when | Controls that must fail | Effort |
|---|---|---|---|
| **`tools/flawcheck.mjs`** (08-ARENA's, extended) | A `@flaw` names no `@selflie` and no pending TAG; a flaw has no non-force resolution; a force outcome raises any `dc` (softens); an outcome writes a fate field or a witness beat; a face is not of the Furrowe or Brack line; a part names a Hesh, Vell or Saro person, a child or a world perpetrator | A planted Hesh face; a planted force win that raises a `dc`; a planted flaw with force as its only end | M |
| **`tools/forcecheck.mjs`** (played) | On the simulator, two scripted players per boss over two seeds: a force bot and a resolution bot. The resolution bot fails to reach its resolution within the time limit, or the force bot ever reaches a non-force outcome, or a boss marked `meantToLose` can be won by the force bot with its lie disproved | A boss with an `endure` count it can never reach; a `meantToLose` boss with a reachable clean win | M |
| **`tools/boonledger.mjs`** | A boon has no `cost`; the cost's `who` is not a named person in the cast; its node or beat does not exist; on a played run, taking the boon does not make its beat play | A planted boon with `cost: none`; a cost on a node that never plays | S |
| **`tools/notallycheck.mjs`** | The inner run writes storage, shows a count, or reaches any player-facing total; a flaw's resolution is shown as a number | A planted inner record write; a planted "flaws beaten: 3" | S |
| **`tools/humanworldcheck.mjs`** | A world node's `do:` reads an inner outcome except through a disposition or `dc` field; a world line uses a devil word (Accuser, Tallowman, the Dry One, or a real name if option 3) without a speaker and a hearer (the slur rule, `design/QUOTA-DESIGN.md:35-37`); narration or interface uses one | A planted narration line "the Tallowman's work"; a planted world `do:` that sets a fate from `laid` | S |
| **`tools/infernoimagecheck.mjs`** (art manifest) | A boss asset is tagged with a people, a child body, a starved body or a sacred object; a boss exceeds the height cap; any real sacred symbol appears inverted or defiled | Planted tags of each kind | S |
| **`tools/complicitycheck.mjs`** (from `04-PERSECUTION.md`, section 6), extended | The Accuser's struck-line trade opens any story, item or lore fragment, or a name given reaches a later scene as a reward | A planted lore fragment behind a name given | S |
| **`tools/flashcheck.mjs`** and **`tools/surrealcheck.mjs`** (already proposed) | Every boss's phases and morphs pass the flash rule and the surreal record's bounds, or carry a dream-scene exemption that the record states | As specified | none new |
| **The grey test** (protocol, not code) | A boss fight played in greyscale with the music off loses its force in a blind review | The same fight with its score and colour, so reviewers can be shown to notice the difference | S per boss |
| **The trailer test** (protocol) | Any inner boss is chosen for a trailer or a capsule image before the table scenes are | None: a release rule | none |

## 7. Order of work, if adopted

1. The `@flaw` record and `flawcheck` with its controls (M). 2. The five verbs, endure and yield first
(M each). 3. The inner run with no tally and `notallycheck` (L). 4. Two bosses end to end as the proof:
Forty Carts (warden reskin, lift) and Received and Found Correct (foreman reskin, signature, pen down)
(M each). 5. `forcecheck` on those two (M). 6. Boons with costs and `boonledger` (M). 7. The other ten
bosses (about M each, content and a reskin). 8. The Descent (M). 9. The Adversary variant the author
picks (M or L). 10. The sensitivity read on the boss pages before step 7 reaches content.

Total, from memory of similar work in this repo and low confidence: about 30 to 40 agent days of engine,
content and checks, not counting art, rendering's style states, voice recording or the readers.
