<!-- writing-profile: procedure -->
# Rework addendum: the story editor's notes

From the director, 2026-10-17. The independent story editor's notes are in
`design/EDITOR-NOTES.md`, each answered (all 34 accepted). They are **blocking** for the rework.
Read the notes the list below names for your district, then apply them to your file. Same checks
as REWORK-BRIEF.md (lint, validator, crossrefs, Articulate before and after).

## For every district

- **S8, L2:** voices argue, tempt and notice; they never translate the scene. Test each voice line:
  if it were deleted, would the player miss information? If not, cut it. Search your file for
  CONDOLENCE and UNDERTOW lines of the shape "He is not X. He is Y." and cut or rewrite them.
- **L4:** one image per beat. In each node keep the best simile ("like a", "as if", "the way a")
  and make the others plain. Peak moments first.
- **L1, S9:** the pink lamps are read once, as an instrument reading without the conclusion, at the
  first meeting; later, one line ("Pink.") or nothing. Provisional-cause reactions stay only where
  they change what Lamb can do; fold the rest into the hub's description.
- **S7:** tics break to be heard: Marrow's "flatfish" and Sabine's prices about half as often.
- **P2:** precedents now start with two ranks in each of their lead compartment's four voices and
  one in two voices of the second (rules.lwd). A specialist's voice is about 6 on bare level. Lower
  any Movement I check that is a style's signature route and has a target above 7.
- **P4:** every Shadow route names its verb (douse, hide, eavesdrop) and has a failure scene.
- **P8:** every appointment version in your district has a Fist way and a Shadow way in.
- **P9:** no evidence is free. Gate any route that costs nothing.
- **L7:** protect the editor's listed lines.
- Lamb has no gender. No he, she, lad, lass, sir or madam for Lamb.

## By district

- **quay:** S1 (no narrated deduction in `quay.claim.read`; SMALL PRINT's "insured an appointment"
  becomes a passive at 7; Candlemas no longer announces the low light; Penhallow's "That light sent
  me out" leaves the berth, the Brine takes it after 23:30). S2 (Fennick holds out on Night 1:
  remove his dark purchase confession, he keeps saying "by grace"; Crake holds out: no yellow-ink
  admission on Night 1, her "I struck a sentence. I did not strike a lamp." is kept for Act 2).
  S11.3 (Crake's lie told well, no self-correction). S12 (at first meeting Keel asks Lamb a question
  every answer records: the light, nothing, or a lie; he quotes whichever later). L3 (`quay.chart`).
  L5 (Keel's cuffs stopping only at the squall; his "The Board. Would ask the Shelf." speech once).
  L8 (`quay.dark.listen.fail` plain). P3 (the Lamplighter coat takes Lamb past Gorm into the harbour
  office and the cells; the bell jar into the kneeling row where Fennick shows his own). P9 (Hobb
  tells the switch only for favour or on the Tab). C2 (one line, Gauze: the old lamp came down and
  the arc went in twelve years ago; they lit it the next winter, eleven years ago, the night Keel
  fell).
- **brine:** S1 (take Penhallow's "That light sent me out", playing only after 23:30). S2 (Sabine's
  "left at nine" survives a casual check: Candlemas does not point at the clock in the same node;
  breaking it needs the slate and the clock together. Wenna's glass confession costs something).
  S7 (Penhallow speaks in bearings and log entries, never proverbs; Cockle counts in Low Nights by
  number; Sabine's prices halved; take one H-guess for Lamb's name from the weigh-house: Sabine).
  L2 (`brine.cockle.jory` SUM, `brine.teague.letter`, `brine.wenna.mother`, `brine.blackout.talk`
  CONDOLENCE lines cut). P6 (an Eye route: the slate read by SUM against the clock). C4. Also:
  Merrow's sack under the settle must check `floor.copper_sunk` as well as `floor.copper_taken`.
- **weigh:** S3 (Pip's tin at the midpoint: make `weigh.pip.tin` a self-contained scene that needs no
  check for its core reveal, the e started sticking the month Mother went onto the quay board; SUM
  may add the reading; a world event will send play there at 03:22 from anywhere, so it must work
  from any place and end with `exit: walk`). P1 (the trial of the pans: a consensual Guild challenge
  open to anyone before 00:40, whatever the midnight word; `do: fight(e.afterdark)` or a new
  encounter you define in your file; win and Marrow tells it, setting `afterdark.told`; lose and
  something still opens. Forcing the office door: win or down, both end with the works order).
  P7 (the HEAD LIGHT FEED tag shows on a successful climb too; the soot node sets `oven.inferred`
  when Lamb has `floor.cullet`). L3 (`weigh.restore.mother`, `weigh.marrow.dawn.stand`). L5
  (Keel's speech once; one of the three H-guesses moves out). L2 (`weigh.react.keeper` CONDOLENCE).
- **floor:** S4 (PRECEDENT's mirror line on the fish cut). L2 (`floor.dilly.book` SUM,
  `floor.dilly.slate.ok`, `floor.merrow.rope.ok` CONDOLENCE). L3 (`floor.lantern.leave`). L5 ("like
  aldermen" belongs to dawn now; change the floor's). L6 (narration is 65 percent here; cut it
  first). P1 (fight the salvors for access, not only for the copper: Merrow tells the five minutes to
  someone who earned it; Spratt's runner Gill caught on the floor and shaken, setting `vote.older`).
  P3 (the floor guise, oilskin and mud, gets Lugg's and Cockle's help without a favour; test
  `guise == floor`). P5 (at each run one non-COAT option in the moment: call to Lugg across the
  water; send Dilly's children for a spar). S11.2 (the animal fights change something: the eels
  cost the minutes that shut the gully, the conger guards the crown glass, the gulls decide the
  fish). P7 (the fish's channel fills at 23:40).
- **mole:** S6 (Keel's fall told once in the squall, on the first option chosen). C3 (gate "for the
  first time in the assessor's sight" on `seen(...)` or drop it). L3 (`mole.lamp.panel`: Candlemas
  gives the reading only, "Cold since about ten."; SUM keeps the subtraction). L5 (vary the tray of
  glasses between `mole.frost.walk` and `mole.frost.late.climb`; the cuffs stopping is told only
  here). L2 (`mole.wenna.chair.ok`, `mole.sq.wenna` CONDOLENCE). L6 (narration is 64 percent;
  cut it). P3 (the keeper's coat takes Lamb past a Lamplighter at the foot of the mole). P5 (shout
  up the stairwell so Keel stops on a landing: a non-COAT option at the frost run).
- **gut:** S4 (Marrow's "Everyone in this town is trying to keep a light on" is the act's only spoken
  thesis; keep it, cut any other). L2 (`gut.spratt.claim.ok` CONDOLENCE, `gut.smoke.marrow.look`
  UNDERTOW). L5 (the dead-mother card joke is Spratt's alone). S11.2 (the dogs guard the midden
  route into the Gut before 00:40, so fighting or feeding them opens it). P3 is done in your file
  (the blindfold at the lookouts); keep it.

## Report back

Which notes you applied, with node ids; Articulate high and medium after; anything rejected and why.
