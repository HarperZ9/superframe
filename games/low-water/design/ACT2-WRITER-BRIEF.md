<!-- writing-profile: procedure -->
# Writer's brief: one district of Act 2

From the director, 2026-10-17. Private. Working folder `games/low-water/`.

## Read, in this order

1. `bible/WORLD-BIBLE.md` (sections 2 and 7 govern every line).
2. `design/REWORK-PLAN.md` (the story spine, the five play styles, the path matrix section 3.2,
   the verbs, fights that matter, the brevity rule).
3. `design/ACT2-PLAN.md` (the night, the districts, the cast and schedules, the beat sheet, the
   strippers setting, quests, fights, protected moments).
4. `design/EDITOR-NOTES.md` (the story editor's notes on Act 1, all accepted) and
   `design/REWORK-ADDENDUM.md` "For every district": these are the lessons. Do not repeat Act 1's
   faults: voices that translate, stacked similes, a deduction explained twice, a confession that
   costs nothing, a fight that opens nothing, a disguise that opens nothing.
5. `design/LWD1-FORMAT.md`, then `content/act2/rules2.lwd`, `world2.lwd`, `facts2.lwd` and the
   Act 1 shared records they include (`content/act1/rules.lwd`, `places.lwd`, `facts.lwd`,
   `combat.lwd`). Use these ids; do not redefine them; do not edit these files.
6. A finished Act 1 district for the voice (`content/act1/gut.lwd` or `floor.lwd`).

## Write

- One file: `content/act2/<district>.lwd`, starting with a comment naming the district. New ids
  at the top under `# ---- new ids`, prefixed with your district.
- Your hub node is `<district>.hub` with `hub: yes`. Travel options to other Act 2 hubs
  (`quay2.hub`, `brine2.hub`, `weigh2.hub`, `mole2.hub`, `gut2.hub`, `hill.hub`, `gasholder.hub`,
  `ropewalk.hub`, `spit.hub`) are allowed even before those files exist; the lint will list them
  until they do.
- **Five routes for every gate** your district owns in the path matrix (REWORK-PLAN 3.2): Fist,
  Tongue, Shadow, Hands, Eye. Each route is a different thing to do in the world with its own price
  and an interesting failure. Tag world actions with their verb: `{verb: rig, noise: 0.2}`.
  Fist wins set the fact. No evidence is free.
- **Guises open scenes** (`guise == pilgrim`, `lamplighter`, `floor`, `keeper`, `guild`).
- **The Record:** Act 1 left `said.*`, `struck.*`, `book.*`, `cause.*`, `seenas_*`, favour,
  `day.*` flags and the lamp states. React to them where it changes something.
- **Fights** in your file: the encounters in rules2.lwd for your district; write all four outcome
  nodes; every fight has its talk, sneak or tool route beside it; violence costs favour and brings
  Lamplighters (more if `book.violence`).
- **Brevity:** a line earns its place by changing what the player knows, what someone thinks of
  Lamb, what the town looks like, or what Lamb can do next. Of two lines that do the same, the
  shorter wins. One image per beat. A protected moment lands at its peak in two lines or fewer.
  Voices argue, tempt and notice; they never translate the scene. No thesis said aloud.
- Lamb has no gender. No em dashes. No "genuinely", "really", "truly", "actually".
- Original writing only (clean-room rule: never open any reference game's files).

## Fights: the four ways through (combat engineer, 2026-10-17)

An `@encounter` may carry, besides its foes and outcome nodes:
- `opening: sneak | alerted | open`. A Shadow route that ends in a fight should use a sneak
  variant of the encounter (see `e.strippers.sneak` in rules2.lwd) through
  `if: <shadow flag> => fight(e.x.sneak)` and `if: !<shadow flag> => fight(e.x)`.
- `prop: lamp x z | cut x z | sluice x z x0 z0 x1 z1 rise | flood x0 z0 x1 z1 rise | snare x z ? cond`:
  a Hands setup made earlier pays off inside the fight (a rope Lamb rigged becomes a snare; a lamp
  Lamb put out is out). Write coordinates `0 0` where the arena does not exist yet.
- `talk: <node> | <label> ? <condition>`: a mid-fight exit into words, with conditions such as
  `fight_seconds >= 10`, `fight_struck >= 1`, `fight_lamb_standing >= 4`, `fight_foes_yielding`.
  The node is a short scene that then goes to the encounter's own yield, win or down node.
- `char:` on any @foe that is a named person, so `struck.<char>` is set.
The Act 2 encounters in rules2.lwd already carry talk exits (`fx2.*` nodes) and sneak variants
where planned. Add your own in your file for any encounter you define there.

## Check

```
node content/tools/lwd1_lint.mjs content/act2/act2.lwd --file <district>.lwd
node game/engine/tools/validate.mjs content/act2/act2.lwd
python content/tools/extract_prose.py content/act2 content/act2/.prose_<district>
articulate check --mode literary-fiction/narrate --verbose content/act2/.prose_<district>/<district>.txt
```

Before you run the checks, the director adds your file to `content/act2/act2.lwd`'s includes; if it
is not there yet, add one `include: <district>.lwd` line yourself (the only edit allowed outside
your file). Lint at 0 errors apart from targets in Act 2 files not yet written. Fix Articulate high
and medium findings where they point at a real weakness. District-prefixed scratch files only.

## Report back

Node and word counts; each gate's five routes with node ids; the protected moment's peak, quoted;
Articulate high and medium; new ids; anything you need from another district.
