<!-- writing-profile: research -->
# The Quota: full design

Game director, 2026-10-21. The author chose The Quota. Verbatim answer to "Should the director
develop The Quota into the full design?": "yes".

This file is the index and the decisions. The design is split into linked files so none passes 300
lines:

| File | Contents |
|---|---|
| [quota/01-WORLD.md](quota/01-WORLD.md) | World bible: the plain and Edrin, the Upper Town's streets, the peoples, each era's state, the movements of era 5 |
| [quota/02-HOUSEHOLDS.md](quota/02-HOUSEHOLDS.md) | Ten households across five eras, the six family-trade lines and the Haldanes |
| [quota/03-STORY.md](quota/03-STORY.md) | Per era: hinge, beats (spoken or told through the world), perspective pair, dinner, story fights, runtime |
| [quota/04-SYSTEMS.md](quota/04-SYSTEMS.md) | The community model as a build spec; lenses; the record, read-back and cross-run world record; class paths; the lore graph and its lint |
| [quota/05-ARENA.md](quota/05-ARENA.md) | The arena reskin: the bread fights behind the mill, then the boxing club |
| [quota/06-KEEP-CUT.md](quota/06-KEEP-CUT.md) | Keep, change and cut against the current build |
| [quota/07-PRODUCTION.md](quota/07-PRODUCTION.md) | The vertical slice, milestones to Steam, owners, the internal content list, the sensitivity read, the author's decisions, and the slice briefs per agent |

## Binding, carried in from PITCHES.md

All of these govern The Quota as written, and the files below only apply them:

- PITCHES.md revision 4 to 4.3: the shape (one place falling across five eras), the community model, the
  instruments of exclusion and the hinge in every era, the wide and narrow lenses, the research anchors.
- Section 3a (peoples, contempt and rhetoric), 3b (the culture war named plainly, every side at full
  strength, the player takes positions, the slur rule), 3c (lore in the world, hidden paths, variability).
- From round 3: the seven accountability pillars; Perspectives and its handling rules; Decay and its
  constraints; What they tell themselves and its rules.
- The two-books answer: the reckoning keeps the character's book; the community keeps its own.
- The handling rules: invented states, parties, leaders and peoples; no real politicians, parties,
  journalists or influencers; no real slurs against real ethnic, national or religious groups; real slurs
  for groups that exist as themselves where a character would use them; abuse shown on screen
  (author, 2026-10-22: "Abuse may also be shown explicitly in the game through actions and cutscenes.
  There is no reason to obscure the seriousness of what occurs in this world."): beatings, torture,
  domestic and institutional abuse, the violence of removal and massacre, and harm to children,
  shown in play and in cutscenes without cutting away. Two lines hold: nothing sexual involving a
  minor, ever, in any form; and sexual violence between adults is shown as coercion, threat, the act's
  violence and its aftermath, never as sexual content or nudity. Every act on screen belongs to a
  named person with a history; nothing is spectacle for its own sake; disorders as people, never labels; the
  perpetrator's view inhabitable and never excused; slurs spoken in full, each with a speaker who has a
  history and someone who hears it; never from the narrator or interface. The rating comes from the
  platform's process, with no game-authored warning screen (design/RATING.md; author, 2026-10-22).
- The writing standard: design/DIALOGUE-STANDARD.md (read-aloud test, concrete stakes, section 3a
  confession), design/VOICE-CALIBRATION.md v2, checked with `articulate dialogue`.
- The frame: a 5 to 6 hour main story; two story fights on the biggest choices; an arena in the fiction;
  a world layer with little dialogue; the lighthouse-game exclusions (no beacon to keep, no sanity meter,
  no loyalty bar, nothing that sleeps below, no game-over cards, no 1-bit isometric look).

## Decisions taken in this design

1. **The Price of Bread's price mechanism is folded in.** Edrin's market starves people as surely as the
   requisition does: in era 2 grain is in the exchange while the wage of a day hand buys less each week,
   so the Hesh hands and the Tarn cottars starve before the farmers (Sen's entitlement mechanism, high
   confidence on the mechanism). The model carries both: requisition takes the grain, and the price
   takes the rest. See 04-SYSTEMS.md.

2. **A foreign grain buyer, in eras 2 and 4: yes.** The coordinator suggested it to carry the author's
   East-West and globalisation-against-nation axes. The decision is yes, as the Halvard Grain Company of
   the Sund, a federation to the west. Why:
   - It joins the two famine mechanisms. In era 2 the capital sells the plain's grain to Halvard for hard
     currency to pay for machinery while the plain goes hungry; exports continued through the 1932 to
     1933 famines (high confidence) and rice left Bengal early in 1943 (moderate confidence). The export
     lifts the price in Edrin and the quota together.
   - It gives the globalist position in 3b a person and a balance sheet: Halvard's regional man in era 4
     buys the mill, moves the milling abroad and closes it, and he is right that cheap bread fed millions
     elsewhere.
   - It puts West and East on the same plain without a stereotype: western money buys the grain and later
     the mill; eastern refugees (the Vell) arrive when the mill closes; the town blames the second for
     what the first did.
   - The risk is the "foreign financiers" trope, which is antisemitic in its history. Guards: Halvard is a
     company with named, ordinary staff; the decision to export is Arl's own ministers'; the rhetoric
     that blames "Sund money" is shown, examined and traced to who profits from it, like every other.

3. **Lamb, Gullet and the harbour are cut as setting and protagonist;** the techniques and the tools stay.
   See 06-KEEP-CUT.md.

4. **Every memory-based claim carries a confidence label.** Nothing historical is named in the game.

5. **The spine (author, 2026-10-22).** The boy who did not come home; the failing parent as the moral engine;
   the Haldane table as the place; the famine and the falsified count as the world's pressure. Persecution,
   ethnic cleansing and genocide are central, the Hesh their target across five eras (spine-plan/04). Story
   lives in the writing, not in numbers: no figure on the player's surface (`@meta numbers: off`).

6. **Fates are decided by named people, never by a threshold** (spine-plan/03; `@fate`, tools/fatecheck.mjs).

7. **Each era closes on a witness, not a document** (spine-plan/02; world/witness.mjs). Era 2's is Anni at
   forty, with the player's own man old at her table.

8. **Working title: The Prayer for the Water** (DECISIONS-2026-10-22.md, question 5). Reversible.

9. **Plague follows the famine and drives the persecution** (author, 2026-10-22): typhus, dysentery, hunger
   oedema; the poisoned-well accusation against the keepers of the Well is the bridge to era 3's killing
   (spine-plan/04 section 10). The contrast beats stay, so the hell is in the rhythm.

10. **The inner arena is adopted** (spine-plan/08, 10-INFERNO); its build waits for the mechanics lead.
