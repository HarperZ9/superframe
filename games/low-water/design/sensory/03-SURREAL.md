<!-- writing-profile: research -->
# Sensory 3: the surreal grammar

Part of [SENSORY.md](../SENSORY.md). When reality breaks in The Quota, and how a player can still read it.

## 1. Why the game breaks reality at all

The Quota's subject is a record that lies and the people who believe it. Two things in the existing
design are already surreal: dreams that come true on some runs and not others, with both readings held
(design/THEMES.md:260-265; content/quota/q_dreams.lwd:18-19), and the page that holds a line before
it is spoken (design/THEMES.md:272-277). The surreal grammar extends that: reality breaks where the
record and the world disagree, where a person's memory overrules what is in front of them, or where the
future presses on the present. It never breaks for decoration, and never to frighten for its own sake:
the taste note is "tense, not jump scares" (design/ART-DIRECTION.md:42).

## 2. The rules

1. **Every break has a cause in the record.** A `@surreal` record (section 4) names its condition: a
   self-lie heard, a figure written over, a dream due, a perspective chapter, a stock past a threshold.
   The read-back can then list it, because the read-back already pairs what was told with what happened
   (game/engine/world/readback.mjs; design/quota/04-SYSTEMS.md:128-130).
2. **One anchor stays real.** Every break keeps one object in the base look, unchanged, inside the
   broken region: the table, a bowl, the ledger. The anchor is how the player knows where they are.
3. **One break per view.** Never two at once; the UI already keeps one hot mark per view
   (design/UI-SYSTEM.md:70), and the surreal follows the same economy.
4. **The break has a signature, the same every time,** so the grammar can be learned:
   - Sound first, about 0.5 s before the picture: the room's reverb swaps to the score's long "space"
     room (t60 6.5 s at the low band, game/engine/audio/ir.mjs:15) while the place's own bed keeps
     playing dry. The ear hears two rooms at once.
   - The picture breaks from the anchor outward, never from the screen edge.
   - Exit is the same in reverse: picture first, then the room comes back.
5. **Light keeps telling the truth about its source** in every break except one named set piece. A lamp
   in a broken region is where the lamp is in the room. The exception is a break that is about light
   itself (an era 5 sodium pool on era 2 snow with no lamp over it, L7).
6. **The paper UI, fight telegraphs and ways out never break** (02-MORPHS.md section 1, rules 2 and 3).
   Text the player must read is never warped.
7. **No fourth wall.** The fiction holds, as the rails scene already rules (design/THEMES.md:277).
8. **Never a people.** The surreal never draws the Tarn, Hesh or Vell as monsters, beasts or disease;
   the propaganda guard applies to every image of a people (design/quota/08-WORLD-MEDIA.md:30-33).
9. **No flash.** A break is a change of look, never a luminance flash; 05-CARE.md's flash rule applies.
10. **Bounded in size and time.** Outside a dream scene a break covers at most 35% of the frame and
    lasts at most 20 s unless the player stays still inside it.

## 3. The vocabulary of breaks

| Break | What happens | Cause | Anchor |
|---|---|---|---|
| **The written-over figure** | When an inflated figure is read aloud, the room's numbers on boards, sacks and chalk show the written figure; the sacks on screen do not change | The report at the district office (q_figure inflated) | Anni's tallies in the pocket (design/quota/08-WORLD-MEDIA.md:105) |
| **The empty place laid** | A bowl is on the table for someone who is not there, steaming, while the others are cold | A household member taken or dead; the five-bowl motif (design/audio/SCORE.md:73-77) | The table itself |
| **The far wall in another era** | One wall of a room is in a later era's look, as if the room were already the flat it will become | Premonition | The stove |
| **The crowd that repeats** | In a propaganda scene one figure in the crowd is the same figure, many times, as the poster draws it | A claim's volume past a threshold (game/engine/world/discourse.mjs) | The real person, whose portrait stays in the base look |
| **Scale out of true** | The ledger on the desk is the size of the desk; the cart is bigger than the horse, as the child drew it (design/quota/08-WORLD-MEDIA.md:106) | A self-lie heard about the thing | The hand holding it |
| **Time held** | Snow stops in the air; the train's steam stands still; only the player's character and the one who is speaking move | A confession, a hinge decision | The speaker |
| **The page before the line** | The note card shows the next line before it is said (design/THEMES.md:272-277) | The rails, Low Water's set piece; a Quota equivalent at the read-back's threshold | The Daybook |

## 4. The record

A `@surreal` record, for the gameplay engineer to adopt or change:

```
@surreal q.sur.written_figure
cause: q_figure == inflated & seen(q.office.report)
where: q_office
anchor: q.anni_tallies
look: s.written_figure          # a style state (02-MORPHS.md) or a content swap of prop states
sound: space                    # the room the signature swaps to
max_area: 0.35
max_secs: 20
steady: frame                   # under the steady-world option (05-CARE.md): shown inside an era-window frame
caption: [The numbers on the sacks read three hundred and ten.]
```

## 5. Checks, in the house style

### 5.1 `tools/surrealcheck.mjs` (static, then played)

As tools/proplint.mjs and tools/dreamcheck.mjs do for their records (PROGRESS.md steps 162 and 167):
every `@surreal` has a cause that parses and can be true on some harness route and false on another, an
anchor that exists in its place, an exit, `max_area` and `max_secs` inside rule 10, a sound signature,
a caption, and a steady-world fallback. Played over the builds and routes, each break fires on at least
one run and not on all. **Control:** eight bad records (no anchor, no cause, a cause always true, area
0.6, no caption, no exit, a people as the subject, a break inside fight bounds) must each fail with its
own message.

### 5.2 The notice test (blind, as the tool-naming test)

Method after PROGRESS.md steps 128 and 130: independent viewers, told only what to look for, judge
shuffled stimuli with no labels; the protocol is committed before any result.

- **Stimuli.** For each break, a 6 s clip of the scene with the break and the same 6 s with it removed
  (the control), from three starting spots. Shuffled per viewer.
- **Question.** "Did anything in this scene stop being real? If yes, point to where, and name the one
  thing that stayed the same."
- **Pass.** Noticed on the break clips: pooled Wilson 95% lower bound at 80% or more (as step 130).
  Located inside the break's region on 80% of the hits. The anchor named correctly on 60% or more.
- **False-alarm control.** The clips without the break must be called surreal on 10% or fewer. If the
  controls are flagged as often as the breaks, the cue is not what viewers are reacting to and the test
  says nothing.
- **Second control.** One planted break with the sound signature removed. Prediction: noticed less
  often and located later. If removing the sound changes nothing, rule 4's sound-first claim is
  unsupported and is dropped.

### 5.3 Readable while broken

The visual check's figure-to-surround band (0.25 to 1.6, design/RENDER-TARGET.md:36) and the
silhouette edge contrast must hold for every figure inside a break, on the same views the check already
runs. **Control:** a break with the anchor and figures restyled too must fail the band on at least one
view, or the check is not seeing the break.

### 5.4 What these tests do not show

Viewers in 5.2 judge clips, not play; all have been agents of one kind in past rounds (PROGRESS.md step
130's limit), and a human round is the stronger test. Noticing a break is not understanding it; the
read-back row for each break is where the meaning is checked, by a story review, not a metric.
