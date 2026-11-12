<!-- writing-profile: procedure -->
# Restore pass: Act 1, after the story editor's third read

From the director, 2026-10-17. The editor's pass 3 (`design/EDITOR-NOTES.md`, "Pass 3") confirms
every open item is now carried in the text, and finds that the fix pass overshot: the rate targets
were applied as an even trim, and the cuts took character, comedy and consequence lines, the
"second clause" where a plain observation turns strange, and left note-form fragments. The author
asked for impact and brevity, not the thinnest text.

**The rates are ceilings, not goals.** Narration share and similes per 1,000 must stay under the
fix-pass targets (FIXPASS-BRIEF.md), and every district now has room under them. Use it.

## What to do

1. Read your district's list: `content/act1/RESTORE-<district>.txt`. It shows every node that lost
   more than 40 percent of its words in the fix pass, with the lines before and after. For each,
   ask one question: did the cut take the line that was doing the work (the exact joke, the
   character detail, the consequence, the beat that ends the scene, the strange second clause)?
   If yes, restore that line, from the BEFORE text, trimmed only of a second image or of logistics.
   If the cut was right, leave it.
2. Restore the editor's ten named lines (T1) that are in your district:
   - quay: `quay.keel.cuffs` ("They are wet from inside, the way a spring is."); `quay.hobb.dark.walk`
     ("a cat the assessor once assessed"; "at the pace of the slower of them, which is not always
     Hobb"); `quay.relic.lend.fail` (Fennick's short soft laugh, surprised at himself).
   - brine: `brine.hair.lamb` ("the assessor has a face, and hair, and has not looked at either with
     interest for some years."); `brine.brawl.turned.fail` ("The fight, which had been about the
     Shelf's word, discovers that it can be about the Shelf."); `brine.slate.caught` ("She turns
     the slate to the wall. Its back is a second slate, kept for exactly this.").
   - weigh: `weigh.quiet.keeper` ("The bottle weighs what a bottle weighs, and the town has decided
     that it is enough."); `weigh.arrive` ("The assessor counts three verses about the same eel.");
     `weigh.roof.light` (the whole quay sees it at once, and from below a Guild cheer if the Guild is
     there to give one).
   - floor: `floor.run.fish.win` (Dilly "turns away before her face can do anything").
3. Fix every note-form fragment into a sentence in the report's voice: for example "Wick, fill,
   chimney." (`weigh.roof.light`), "From there: a new cable" and the subjectless "Then the gutter
   lets go" (`weigh.climb.fail`).
4. Your one-line fixes:
   - quay (T3): `quay.pen.wreckers` says "twenty-two twenty-four" by the ship's clock, as her log does
     at the berth; the correction to 22:20 stays the player's (the SUM check in `quay.pen.clock`).
   - weigh (T4): `weigh.pip.tin.sum` must show something on any success, including a strained pass:
     make its line an ungated `voice: sum:` or a `nar:`. The list file flags any other success node
     in your district with the same problem (lines starting `!!`).

## Check

Lint, validator and Articulate as before; `python content/tools/brevity.py content/act1 <district>.lwd`
must stay under the fix-pass ceilings. Backup first to `content/act1/.orig4/<district>.lwd`.

## Report back

How many listed nodes you restored and how many you left cut, the ten named lines, the fragments
fixed, the one-line fixes, and the brevity numbers after (they will rise; that is intended).
