<!-- writing-profile: research -->
# Low Water: the dialogue standard

Story lead, 2026-10-21. Written after the author's verdict on the thematic pass, verbatim:
"that writing is pretty damn bad... 'You want me wicked, wicked is cheap, you could hang it, I am
arithmetic,' that doesn't really make sense to a human being. It might make sense to you as a model,
but the writing needs to be from a human perspective... characters... should also be at least
human-esque or humanoid in some way, and the political and content should be human-focused." The
author is right. Too many of the pass's lines were compressed epigrams: people speaking in theses.
This page is the rule every spoken line meets. It governs `line:` records and Lamb's spoken options.
The house voice of the narration (bible section 2) is unchanged.

## 1. The read-aloud test

Every line must pass one question: would this person say this out loud, in this place, to this
person, right now? Read it aloud in their voice, with what they are holding and who is listening. If
it only works on the page, cut it or rewrite it.

## 2. Concrete stakes, never theses

The politics lives in what people pay, owe, earn and lose: wages, rent, coal in February, fish
prices, a sick child, a broken pump, who owes whom, what happened last Tuesday. Crake defends herself
with what she pays, whom she employs, and what goes dark if she stops, in plain words. Sorle answers
the slate with what his brother did with four pounds. Nobody names the theme. Nobody explains the
town's ideology to anybody else.

## 3. How people talk

- Indirectly. They dodge, change the subject when it hurts, answer a different question.
- They interrupt and are interrupted. They repeat themselves. They get facts slightly wrong.
- They are funny without trying, from habit and from their trade.
- Subtext over stated meaning. What a person will not say is usually the point of the line.
- Every person speaks from their own sheet in design/characters/: their background, their job,
  their body, their habits, what they know and what they cannot know.

## 3a. Confession

Added 2026-10-21, after the author's note on the calibration scene. Paraphrased: "I'm the man who
put his hand through a pump and wrote weather" is weak. What led up to it was decent, but the summary
line carries no impact, and the scene needs far more self-deprecation and to feel personal and human.
- A confession never ends on a neat summary image. A line that sums the person up in one picture is
  the writer talking, not the person. Cut it and end earlier, on something smaller or worse.
- People circle the thing. They start somewhere beside it, come at it, back off, and come again.
- They deflect: a joke, a question back, a fact about somebody else, the weather.
- They run themselves down, and the running down is a way of not saying the real thing. It should
  sound like a habit, practised.
- They laugh at the wrong moment, and it is not a laugh.
- They bring up the small humiliating detail they did not mean to: the keyring chip, the 2 a.m.
  phone call from a boy who thinks they are better than they are, the shirt they had cleaned, the
  dinner they let somebody buy them.
- The praise they get is part of the wound. What people thank them for is often what lets them
  avoid the act.
- The listener does not absolve, summarise or explain them back to themselves.

Test: if the last line of a confession would work on a poster, it is the wrong last line.

## 3b. Plain voice (2026-10-23, supersedes the self-deprecation note in 3a)

The author, 2026-10-23, verbatim: "This even infected the game and its writing and plot events. It feels
like almost every sentence you share with me is presented in that self deprecating, and 'what this does not
prove' approach. Which is quite tiresome." Earlier the same day: "respect for verification, truth,
objectivity, fallibility, provenance, re-derivability... are shown through actions, outputs, architecture,
and tooling. Not in a claim... Plainness, and clear concise explanations are much more valuable."

The evidence voice of the developer's tools does not belong in the fiction. In speech, narration, props and
plot beats:
- People are certain, wrong, proud, afraid, funny or cruel. Nobody audits their own claim, corrects
  themself for fairness or accuracy ("No. That's not fair."), or closes a line on a hedge ("I don't know
  why I remember that", "as it happens", "that anybody's heard").
- Running yourself down is a trait of particular people, used where it is theirs. It is not the house way
  of confessing. Section 3a's circling and deflection stand; its call for "far more self-deprecation" does
  not.
- Narration shows and does not rule on what a beat means or whether a line is true ("It'll be true, and
  nobody will know it is", "The lie takes her four seconds", "which proves nothing"). What is true comes out
  through what happens and what the world shows: an object, a mark, a consequence.
- No scene is built around checking a source or correcting a record for accuracy. Records, ledgers and
  certificates are things people sign, hide, burn and carry. What matters is what that costs them.

## 4. Banned forms (the dialogue lint flags them)

| Form | Example from the pass | Why |
|---|---|---|
| Abstraction defined in a sentence | "A slate is a promise somebody will still be here in February." | People say what they do, not what a thing is |
| Self-definition by a noun | "I am arithmetic." "I'm the room." | Nobody calls themself a concept out loud |
| Two places balanced | "In Kell a man can be poor among kin. Here a man can be free among creditors." | An essay's sentence |
| Mirrored pair on a hinge word | "They don't want the truth. They want somebody to have it." | Antithesis; the author's rules ban it |
| Corrective negation | "It's not a kindness. It's a habit with a ribbon in it." | Same |
| Semicolon balance | "Wicked is cheap; you could hang it." | Same |
| Closing zinger | "That's the price of the light." | A summary beat in a character's mouth |

The author's prose rules (global standard, 2026-08-04) already ban antithesis, corrective negation,
contrasting pairs, negative parallelism, summary beats and landing sentences. They apply to speech
with more force, because people do not talk like that.

A flagged line is not automatically wrong. Keel's "The Board is present. The Board is always
present." is his tic, and a tic is allowed to repeat. A flag sends the line to the read-aloud test.

## 5. People are people

Every speaker is human, with wants, a history, a job, a body and habits. Anything not human is
unmistakably so: Mother is the lamp the town calls Mother; the Lantern Man is a rumour; the
instruments of the Kit are instruments; the voices are Lamb's own habits of mind. A person never
speaks as if they were a symbol.

## 6. Checks

- `python content/tools/dialogue_lint.py` (stdlib): flags the forms in section 4 across all acts.
  `--list` prints each line, `--speaker NAME` narrows it, `--articulate` adds the local Articulate
  check's counts on the same lines. On 2026-10-21 it read 2,399 spoken lines and flagged 269
  (11.2 percent). Of the 151 lines the thematic pass added, it flagged 33 (22 percent), about twice
  the rate of the rest of the game. On a reading of 20 random mirrored-pair flags, about half were
  true epigrams and half were ordinary repetition (a tic, a list, a joke), so the mirrored-pair rule
  is a pointer for review and not a gate. The other six rules flagged the four lines the author named
  and nothing in a hand check of the approved lines (Teague's "four thousand times", Spratt's
  herring).
- The local Articulate check (literary-fiction/narrate) found none of the author's four named
  epigrams on 2026-10-21. Its counts on the same lines: rule-of-three 30, contrast-pair 13, anaphora 6,
  corrective-negation 3. The Articulate engineer's dialogue and character-voice checks
  (design/VOICE-AUDIT.md) replace this lint when they land.
- Regex rules for single speakers (Keel never says I; Merrow never asks; Gorm only asks; Sorle uses
  no contractions) live in design/voice/profiles.json and the direction lint.
