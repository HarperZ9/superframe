<!-- writing-profile: research -->
# Spine plan 3: fates decided by people, never by thresholds

Part of [../SPINE-PLAN.md](../SPINE-PLAN.md). The rule this file applies, from the assessment: "A
child's removal ... must be a written scene with a named person who decides it ... The model may set
the conditions; a person acts" (`design/STORY-ASSESSMENT.md:293`). Extended here to every adult as well.

## 0. Every rule found that decides a person's fate

| Rule or branch | Where | What decides now | Verdict |
|---|---|---|---|
| H1, "a bowl goes" | `content/quota/q_community.lwd:227-234` | `food < 0.15` sends a child to the home | Scene (section 1) |
| H2, "taken in" | `q_community.lwd:245-252` | `protection.hesh < 0.45` takes "a Hesh son" | Scene (section 2) |
| H3, "held" | `q_community.lwd:236-243` | Follows `q.tomas_held`, set in a scene the player saw | Keep (`STORY-ASSESSMENT.md:294`); fix its input, section 3 |
| The granary's custody | `content/quota/q_granary.lwd:89-91`, `:101`, `:122` | The fight's outcome sets `q.tomas_held`; an unnamed guard drags in "the nearest one" | Scene beat with a named decider (section 3) |
| The coda's routing | `content/quota/q_coda.lwd:26-32` | Reads H1 and H2 through `stock(food, haldane)` and `stock(taken, haldane)` | Reads the scenes' flags instead (section 4) |
| The world fact "Anni at the home" | `content/quota/q_record.lwd:9-11` | `stock(food, haldane) < 0.15` | Reads `has(q.anni_sent)` |
| End states rose, fell, left, ended, absorbed | `design/quota/02-HOUSEHOLDS.md:11-14` | "The community model decides which" | Pressure only; each a scene (section 5) |
| R13 breakup, R15 leaving, R22 clearance (designed, unbuilt) | `design/quota/04-SYSTEMS.md:63`, `:65`, `:72` | Stocks rise; "households evicted" | Pressure only; scenes (section 5) |
| Gullet: the dawn verdict by weights, the vote on a counter | `content/act1/facts.lwd:3-4`; `content/act3/brine3.lwd:553-556` (as cited, `STORY-ASSESSMENT.md:108`) | Numbers | Out of scope while the Gullet acts are archived (`design/quota/06-KEEP-CUT.md:10`) |

## 1. H1 as a scene: "The gate on Tilney Road"

**Who decides: Bet Haldane.** PROPOSAL. Anni offers herself first; Bet decides whether to let her.

**What the model feeds in, without deciding.** H1's condition becomes a pressure: the household's food
after the requisition below 0.15. While it holds, Bet's shelf is bare and the scene is armed. The model
never removes the bowl.

**What Bet weighs, in her words, not as a sum:** a meal a day at the home against the family's table;
whether Tomas is already gone ("I'm not losing two"); whether Aaron is ill; and the home's price, which
is persecution by kindness: the Furrow Church takes the child in under a Tarn spelling and the thread
comes off at the door. That ties H1 to the first stage of the persecution arc, naming and registration
(04-PERSECUTION.md section 2).

**What the player can do, by class, earlier in the week (the coda's cut becomes two cuts):**
- **Ned.** Bet comes to the returns room on the Tuesday. She asks him to write a line for the home that
  the child is "of Tarn parentage", which the blank father column on Anni's register entry lets her
  say. Ned is Anni's father (decided 2026-10-22, 09-ANNI.md), so the line is true and he writes it as
  if it were a guess. He can write it (a record event, `certify.parentage`, a true line with no name
  on it, which puts the author's records thesis on trial), refuse, send food from his own table
  (`shift(portion, -x, furrowe)`), which may lift the pressure and cost the Furrowe bowls, or, at the
  gate itself, put his own name in the father line (09-ANNI.md section 6). Bet still decides.
- **Will.** The heel of bread he keeps touching (`content/quota/q_will.lwd:12`) becomes the means. He
  can leave it at Haldane Yard on his way past, or not. Taking the post's bread off a cart is theft he
  has already done; giving it away is the first thing he does with it that he would not tell Gedge.
- **Either.** Do nothing, and Bet decides alone.

**Outcomes (Bet's, not the model's):** Anni goes in, without the thread (`set(q.anni_sent)`; the bowl
leaves the table by the scene's `do:`); Bet refuses and keeps her (the model keeps pressing, and the
next pressure is Aaron's health, never a bowl removed by a rule); or the pressure lifted before the
Wednesday and the scene never arms.

**PROPOSAL, sample** (the gate; approve before content):

> SISTER: She can come in today. The thread comes off at the door, mind. We don't have that in here.
> BET: It's a bit of wool.
> SISTER: Then she'll not miss it.
> ANNI: I'll take it off, Mum. It's fine. I'll take it off.
> BET: If she comes in today, does she get her dinner today?
> SISTER: She gets what they all get.
> BET: That's not what I asked you.

**Files.** New nodes in `content/quota/q_coda.lwd` or a new `q_fates.lwd`; the `@rule H1` record
becomes a `@fate` (section 6); `q_coda.lwd:26-30` and `q_record.lwd:9-11` read `has(q.anni_sent)`;
`q_readback.lwd:32-33` rows follow, as oracle rows.

## 2. H2 as a scene: "Gedge at the yard"

**The fault first.** H2 takes "a Hesh son" (`q_community.lwd:252`); PROGRESS says Aaron
(`PROGRESS.md:227`); the coda reads it as Tomas (`q_coda.lwd:29`, `:39`). On a run where H2 fires and
Tomas is not held, the table shows the wrong boy missing. The scene below names who is taken.

**Who decides: Constable Gedge.** He has a history in the slice already: his father drove Mr Orme's
carts and gave the boy at the horse a sweet (`q_will.lwd:34`), and he whistles while he chalks six
sacks (`q_will.lwd:165`). He is the perpetrator who enjoys it, which the craft notes ask for
(`design/literary/08-CRAFT.md:59-61`).

**What the model feeds in.** H2's condition becomes a pressure: the Hesh's protection in Haldane Yard
below 0.45, which in the slice comes from patrols aimed where the notices point (R9,
`q_community.lwd:185-192`). On the blamed route there is also the list "in Jonah Krall's hand"
(`content/quota/q_readback.lwd:87`). The model sets the day the patrol comes. It names no one.

**What Gedge weighs:** the list, which says HALDANE; the order on the nail, "GRAIN FOUND IS HOARDING"
(`q_will.lwd:60`); Holt's eye on him; that a man fights and a boy does not; and that it is a good day for
him.

**Who is in the door: Ilo.** PROPOSAL (revised, 07-GRIP.md revision 4). Ilo does not offer himself.
He stands in the door and says the boy is nine, and when Gedge says "Get his coat" Ilo goes and gets
the coat. Bet sees him do it. That is Ilo's failure as a parent, and it is why she cannot look at him in
era 3. Gedge decides; if his sergeant is standing there, he may decide on nobody.

**What the player can do:**
- **Will** is Gedge's sergeant. He can be at the yard and send Gedge on ("Leave it. Next door."), at the
  cost Gedge has already named, the Captain (`q_will.lwd:157`); take the boy himself "so he's with me",
  which is custody by another name; or be at the Crown and hear about it after.
- **Ned** can be at the yard because he is bringing Anni's tally back, as he promised
  (`content/quota/q_ned.lwd:112`), and vouch with his name, which goes on Holt's cuff; or keep walking.
- **Dorrah** may already have the boy on the hill, if the player warned the Haldanes or the hill is
  where the family sent him. Then the yard has no boy in it, and the lie "up at Mrs Tesk's" is, for
  this child, true (04-PERSECUTION.md section 3).

**Handling.** Harm to children only through consequence (`design/QUOTA-DESIGN.md:33-34`). The camera
stays on the door and on Ilo's back. If a child is taken, the scene cuts before hands, and the table
carries it.

**PROPOSAL, sample:**

> GEDGE: I'm not here for you, Ilo. I'm here for whoever's on the list. The list says Haldane.
> ILO: That's me. Your lot wrote it.
> GEDGE: And him.
> ILO: He's nine.
> GEDGE: Then he'll be quick. In and out. Get his coat.

Ilo goes in for the coat. The camera stays in the yard with Gedge, who whistles.

**Files.** The `@rule H2` record becomes a `@fate`; new nodes as for H1; the coda's alternatives and the
readback oracle rows key on `has(q.aaron_taken)` or `has(q.ilo_taken)`; the lens's `taken (an empty
chair)` (`q_community.lwd:134`) stays as the narrow lens's sign.

## 3. The granary's custody: a named decider

Today the guards "drag in the nearest one ... It's Tomas. One guard does it on his own."
(`q_granary.lwd:91`), and winning the fight is what puts him there (`:89`). PROPOSAL:

- **Who decides: Captain Holt**, who wants "someone to show for the night" (`q_granary.lwd:91`). He
  gives the order to a guard who now has a name and one line. The fight sets only whether the door
  held.
- **What the player can do inside, after the fight:** tell Holt the boy is eleven; go out with the guard;
  say nothing. Holt weighs what he already weighs at the talk-out, "who was out there to hear that, and
  whether the Gazette's woman with the camera is one of them" (`q_granary.lwd:78`), and whatever the
  player's name has cost him today.
- **The militia line walks to the wicket (revised, 07-GRIP.md revision 10; recommended, author
  decides).** Holt sends Will himself: "Nearest one, Sergeant." The player walks the figure to the gap.
  Nobody is chosen from a menu: the nearest face is whoever the crowd has pushed to the door, and on the
  routes where Tomas is there it is Tomas, his braid out down his back (`q_granary.lwd:29`). The player
  can stop walking; then Holt sends the guard, and the guard takes the same boy. The player's hands
  were on it either way, or they were not. **Risk:** a walk that ends at a child's face can read as a
  shock built for its own sake. The guard: no contact on screen; the cut comes on Will's hand reaching
  the wicket bar.
- **The inspector line** cannot walk to the wicket; Ned is at the stock book. He can tell Holt the boy's
  age, and Holt answers as in the sample.

**PROPOSAL, sample:**

> HOLT: Somebody to show for the night. Nearest one.
> NED: That's Ilo Haldane's lad. He's eleven, Captain.
> HOLT: They're all somebody's lad. Nearest one, I said.

## 4. The coda reads people's decisions

`q.coda.who` (`q_coda.lwd:26-32`) routes on `has(q.tomas_held)`, `has(q.anni_sent)`, `has(q.aaron_taken)`
and `has(q.ilo_taken)`. The bowls on the shelf follow those flags, so `bowls(haldane)` keeps working for
the props (`content/quota/q_props.lwd:13`, `:26-27`) and the dream (`content/quota/q_dreams.lwd:15-16`).
The coda's opening already names people, "Ilo, Bet, Aaron, Anni. Tomas's bowl is on the shelf, upside
down." (`q_coda.lwd:39`); new branches follow that form.

## 5. End states and the unbuilt rules

The five end states stay as hidden labels (`STORY-ASSESSMENT.md:307`). Each is resolved by a person:
- **left**: someone packs, at a door, in a scene (R15 presses; a pass or a ticket is a person's act);
- **absorbed**: someone gives a Tarn name at a counter. Joss's brother's line "calls itself Tarn"
  (`02-HOUSEHOLDS.md:82`); the scene is the day he first says it to a clerk;
- **ended**: the last member's own scene, or a witness's account of it;
- **fell, rose**: shown at the table.

R13 (children sent away), R15 and R22 (households evicted, `04-SYSTEMS.md:72`) are written now as
pressures with a decider when they are built: a parent, a person at a door, a bailiff with a name.

## 6. The record, the engine and the checks

**`@fate` (PROPOSAL)**, in `game/engine/world/community.mjs`:

```
@fate f.anni_home
pressure: food < 0.15                  read for the household, as rules read today
subject: household haldane
decider: BET
scene: q.fate.gate                     played at the next cut that crosses the window
window: 7
```

- A call `pressure(<id>)` is true once the pressure has held on any day in the window. The coda's single
  week cut (`q_coda.lwd:16`) becomes two cuts with the fate scenes between.
- The loader refuses a `per: household` rule whose effects write `bowls`, `taken`, `members` or `end`,
  with the message "a person decides this: use @fate". The fields stay writable from a node's `do:`.
- Chains (`community.mjs:151-154`) end in a node id: `R2 > pressure(f.anni_home) > BET at q.fate.gate`.

**`tools/fatecheck.mjs` (new)**

| Check | Fails when |
|---|---|
| No fate by threshold | Any household rule writes a fate field |
| A decider speaks | A `@fate` scene has no line by its `decider` |
| Two ways | A `@fate` scene has fewer than two outcomes, or the player's earlier acts can change none of them |
| Played | On a run where a pressure held, its scene did not play before the coda |
| Cause | A fate field changed on a run with a cause path that ends in a rule rather than a node |

Controls: the old H1 record, planted, must fail; a `@fate` whose scene has no line by BET must fail.

**Other checks that change.** `tools/communitycheck.mjs` prints the new chains; its assertion that no
figure leaves every table as it was (`PROGRESS.md:230`) stays as a design test.
`tests/community.test.mjs:48` asserts `R2>H1` today and moves to the pressure path. `tools/dreamcheck.mjs`
reads `pressure()` inside the dream's copy of the model, since a copy no longer removes bowls by rule;
its hit-rate target is dropped, as the assessment advises (`STORY-ASSESSMENT.md:304`).
