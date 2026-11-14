<!-- writing-profile: research -->
# The Quota, 5: the arena reskin

Part of [QUOTA-DESIGN.md](../QUOTA-DESIGN.md). The arena built on the test page (commits 0403cbf,
c57f002, 8c1ff4f) has eight archetypes with elite variants (`combat/data/archetypes.mjs`) and two bosses
with learnable phases (`combat/data/bosses.mjs`), plus boons with focus and a ring with no exits. (The
coordinator's count of ten may include the two bosses; the data file holds eight archetypes.) It was built
content-neutral. This file gives it The Quota's fiction without changing its mechanics.

## Two venues, one yard

| Venue | Eras | What it is | Who keeps the book | What a purse costs |
|---|---|---|---|---|
| **The bread fights** | 2 and 3 | Behind the Orme mill at night, men fight for a loaf, then for a sack | George Orme's yard foreman; the miller takes a cut | Every loaf won is one a named family didn't get; the board by the gate chalks whose |
| **The boxing club** | 4 and 5 | The same yard, the mill shut, a ring under the old hoist | The promoter, a Furrow League man; the purses are paid by the ring-road syndicate | Every purse is rent money from the Upper Town's houses; the board names the street it came from |

The mechanics stay as built: escalating ladders, learnable bosses, seeds and modifiers, boons, local
records only, no online leaderboard.

## The archetypes, reskinned

| Built (from) | Signature | The bread fights (eras 2 and 3) | The boxing club (eras 4 and 5) |
|---|---|---|---|
| sweeper (f.lamplighter) | The sweep | **The thresher**, a farm hand with a flail | **The swinger**, all hooks and reach |
| shield (f.panbearer) | The bash | **The doorman**, the mill's man with a sack-board | **The guard**, a southpaw who hides behind the gloves |
| cutter (f.gutter) | The flurry | **The sickle boy**, fast and close | **The jabber**, quick hands, no weight |
| hound (f.dog) | The pounce | **The mill dogs** | **The rusher**, a kid who comes straight in |
| swarm (f.gulls) | The peck | **The rats** in the granary | **Tag bouts**: three lads in turn |
| grappler (f.conger) | The grab | **The sack man**, who lifts and throws | **The clincher**, who holds and leans |
| zealot (f.zealot) | The frenzy | **The penitent**, a Furrow revival man who fights to be hurt | **The brawler**, who fights angry and drunk |
| captain (f.stripper_lead) | The hook | **The requisition corporal**, with a grain hook | **The ex-copper**, who fights dirty and knows the referee |

## The bosses, reskinned

| Built | Phases as built | The Quota |
|---|---|---|
| **foreman** (f.keel, the hammer): slam, sweep, sweep, charge; ring slam below 60%; no rest below 25%; the shout calls the yard | Three | Era 2 and 3: **the Yard Foreman**, Orme's man with the mill hammer, champion of the bread fights. Era 4 and 5: **the Club Champion**, the same moveset with gloves (the slam a straight right, the ring a body shot that shakes the floor) |
| **warden** (f.warden, hook and chain): hook pull, chain spin, thrust; below 50% whistles two hands in, drags toward the deep water | Two | Era 2 and 3: **the Requisition Captain**, grain hook and chain, who drags toward the open grain chute instead of the deep water; also the story-fight boss at the granary door. Era 4 and 5: **the Debt Man**, the promoter's collector, with a chain and a ledger, who drags toward the ropes |

**The story fights use the same machinery:** the granary door (era 2) is the Requisition Captain on the
granary's own ground; the clearance day (era 5) is **the Clearance Sergeant**, Leon Brack, a new boss built
on the warden's pattern with a riot shield in place of the chain (a shield bash on the pull, a baton in
the thrust's slot, two constables on the whistle).

## Boons, reskinned

The built boons with focus become what a fighter is given between bouts: a crust (stamina), a nip of
spirit (focus, and it goes in the record), the corner man's advice (a telegraph read sooner), a better
pair of boots (footing). Each boon has a source on the board: who gave it, and what it cost them.

## What the arena still needs for The Quota

- Dressing per venue: the mill yard at night with braziers (era 2) and the ring under the hoist (era 4).
- Figures in Quota dress for each archetype, two eras each.
- The board by the gate as a prop with names, fed by the community model (whose loaf, whose rent).
- Hit identity per tool and per glove in sound and in the painter's mark (no audio layer exists yet).
