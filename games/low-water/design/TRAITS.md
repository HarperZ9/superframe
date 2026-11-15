<!-- writing-profile: research -->
# The traits: every quality he carries is a being he fights

The traits pass, 2026-10-23. The author, verbatim, 2026-10-23: "shift the low water plot, and internal
combat narrative and names; this is each trait embodied, and fought. make it intense and immersive."

This file is the design of record for the character's traits and the inner arena that embodies them. The data is
`game/engine/combat/data/traits.mjs` (names, compartments, the being for each trait, the sins they feed), the boss
records in `combat/data/flaws*.mjs` and the fights in `combat/data/fights-*.mjs`. The rename of every old name is a
checklist in `design/TRAITS-RENAME.md`. Each decision taken by testing is in
`design/spine-plan/DECISIONS-2026-10-22.md`, section "The traits pass".

## 1. What changed, in one page

The sheet used to be a claims case: four compartments (THE COAT, THE NOSE, THE PEN, THE HAT) and sixteen voices
named for paper and office work (FORM LETTER, SMALL PRINT, PRECEDENT, CARBON, THE CHIT, HEARSAY). The author ruled
the bookkeeping plot out on 2026-10-23. The inner arena was the character's self-lies made flesh, fused with the
people each lie cost.

Now every compartment and every voice is a human quality or vice the character carries. Each one has a body in the
inner arena, a moveset that is the trait in action, a ground, a weakness that says something true about it, and a
voice that talks to him while he fights it. The self-lies stay: each one is now spoken by the trait that becomes
its being. Raising a trait and fighting it are one story. Every outcome of a fight changes the trait in him, and
every boon is paid for by a named person in the world. The great sins form out of the traits he fed, and the last
fight is the combined monstrosity made of them. The outer world stays human. Only the inner arena is monstrous.

## 2. Raising a trait and fighting it are the same story

- **A trait works for him.** Each voice scales tools and fight numbers as before (`combat/data/build.mjs`): APPETITE
  breaks poise and drives the hammer, DREAD and NERVE lengthen dodges, PRUDENCE makes swings cheaper. In talk the
  trait speaks more often the higher it is (`voice:` lines pass on its level).
- **A trait is as big inside as he made it.** The story's hinge sends the sheet's levels into the dream
  (`combat/innerhook.mjs` `sheetLevels`). The being's standing, harm and height scale with his level in its trait:
  5 is a middling man; each point above adds 6 % standing and 4 % harm, each point below takes the same off, within
  0.82 and 1.5 (`traits.mjs` `EMBODY`, `combat/arena/innerspawn.mjs` `embody`). Ned's PRUDENCE is 8, so his Steady
  Hand has 18 % more standing than a middling man's would.
- **Every ending changes him.** The run emits `trait.change` (`combat/arena/inner.mjs`); the hinge keeps it in
  `G.state.inner.marks`, and the sheet reads it as a modifier named for the night (`innerMods`), so every later check
  and every later fight sees it.

| Ending | Verbs | What it does to the trait | What it costs |
|---|---|---|---|
| Beaten by force | force | Cut back: -1. The tools it scaled lose it; its voice speaks less | It comes back in the Descent (winning isn't healing). Its boon, if taken, is paid by a named person in the next scene |
| Terms made | yield, endure, refuse, name | Kept, with his ear: +1 | The scene that follows carries it (the beat in the record) |
| Lost to | lose | It has him: +2. His hands are stronger with it; it speaks in more scenes | It is bigger when he meets it again, it arms its gate, and it becomes a limb of the Host |

A test holds each row (`game/engine/tests/traits.test.mjs`): the level moves by the mark, the sheet names the night
as the reason, and the cue for it plays on waking.

## 3. The twenty traits

Ids are the old ones (section 1 of TRAITS-RENAME.md has the table). Each trait under a great trait shares its
pillar. Lines are PROPOSALS for the author, in the read-aloud register of `design/DIALOGUE-STANDARD.md`.

### 3.1 The four great traits (the compartments)

| Trait (id) | Pillar | Body | At its gate |
|---|---|---|---|
| HARDNESS (coat) | Endure | A man poured in concrete, slab on slab, the shuttering's board marks across every block, the sacks he carried set into his chest like stones in a wall, rebar out of his fists | "You carried me all the way down here. You've carried worse. Stand up, then." |
| FEAR (nose) | Evade | A tall figure painted in stripes, and the stripes run out across the walls as bands, so it is only where the bands bend. Seventies supergraphic; no face | "Go on. Run. You know the way out of every room you've ever been in." |
| SUSPICION (pen) | Read | An art-deco stepped column with a sunburst for a head; every ray an eye-slit, the centre an eye that turns to follow him; when it winds up, the rays point at him | "I saw you. Every time. I knew what was in the sack before you lifted it." |
| AUTHORITY (hat) | End | A stepped tower of a man in a crown of iron rays, a polished face that shows him himself, small; he stands on a plinth of wet clay and will not kneel to it | "Kneel. No? Nor did I. Not to them, not to anyone. Look where it's got us." |

A great trait is met once, at its gate in the Descent (section 5). It fights as the trait under it he fed most, on
that trait's ground, in its last phase, half again its height, with the next most-fed trait's plain blows added.

### 3.2 SUSPICION's traits

**PRUDENCE (sum).** Knows what a thing weighs and what it's worth, and keeps quiet about it. Feeds avarice.
- Body: a broad man whose right arm is the exchange scale's iron beam, bolted at the shoulder; the pan swings off its
  end on two chains; his head is three brass weights, the top one polished by a thumb. Steady Hand, Ned, era 2.
- Ground: the returns room, the desk and the racks of iron weights; the room closes on the desk in the last phase.
- Moves: the cuff string, the backhand, the beam (a guard-breaking hammer), the pan swung low on its chains, the
  lunge, the seize; at his call two weighers in coats come in; his signature drops the beam on its stop and the
  ceiling's plaster comes down where he stands. Phases: the desk, the weighers, the eye.
- Weakness: he commits only when he is sure, and then the beam stays on its stop for a second. The careful man is
  safest to hit just after he finally acts.
- Voice: "Good man. You never made a fuss. Lovely steady hand." / "You knew it was light before it touched the pan.
  Nobody can say you didn't." / "Think of the girls. Think of the coal in the shed. Then do what you like."
- Force: A Clear Hand (light strikes quicker), paid by Walter Mott, who comes to Ned first: "You're the one that does
  as he's told." Terms: put the case down and the room gives way to the post road, with Tomas stamping his feet. Lost:
  Ned wakes on the boards with his arm twisted under him.

**LOYALTY (precedent).** Your family's words in your mouth. Feeds wrath, the vengeance a family calls order.
- Body: three Brack men in one riot shield, three helmets over the rim, six arms through each other's sleeves.
  Order, Will at the Well House (era 3), Leon on Mill Street (era 5).
- Ground: Mill Street over the allocation square's stones; the street walls off from the left as it goes.
- Moves: the baton over the rim, the bash, the drag of the locked wall, constables at its call, the shield line driven
  down the street as its signature. Front blows glance.
- Weakness: it guards its front and never looks behind it. Go round.
- Voice: "Your grandad held this street. Your dad held it. You going to be the one that didn't?" / "Somebody had to,
  and it was us. It's always us." / "Go on, then. Put it down. We'll hold it without you."
- Force: The Line (a front guard), paid when Ann says it to Leon as a family saying. Terms: drop the baton and outlast
  three drags; the three walk on up the street. Lost: Leon wakes on his kitchen floor with the baton in his hand.

**COWARDICE (smallprint).** Finds the reason it was never your job. Feeds false witness.
- Body: a long barn that walks on its own beams, its doors always open on the far side so he never sees its front.
  The Long Barn, the line in era 2, Ruth in era 4.
- Ground: the granary floor, the chute's throat, the train beyond; beams fall, and in the last phase the floor goes
  from the far end.
- Moves: the slap, the rib (late and early), the drag to the throat, the hug, the charge, the whistle.
- Weakness: it runs, and it runs head first into the walls it was running from: stand with a wall behind you and
  step aside, and it dazes itself.
- Voice: "It's the Company's grain. It was never ours to give." / "Not your street. Not your sign. You were only
  holding the box." / "It was his can. He'd have sprayed it somewhere whatever you did." (was "You didn't choose. You
  walked. Walking's not choosing.", rewritten 2026-11-09 for the read-aloud test)
- Force: A Crust (Breath), paid by the Tesks at the back of the queue. Terms: stand in the throat and do not feed it.
  Lost: he wakes in the chute's dust with his pockets turned out.

**GUILT (carbon).** Puts the scene back as it happened and makes you stand in it. Feeds despair.
- Body: a stooped figure stitched from sacking and twine, Ned's coat across it, a frosted window where its face
  should be. The Figure, Pell, era 3.
- Ground: Pell's surveyor's office over the allocation map, which freezes into the river.
- Moves: it answers his last string with the same string (the echo of his light, heavy and charged blows), jabs, a
  hook, a grab on the ice, a shock across the floor; the ice cracks in rings round him in the last phase.
- Weakness: it can only do what he has just done. Break the rhythm and it has nothing to answer with.
- Voice: "You did it like this. Then like this. Watch. I'll show you." / "Hit me, then. You hit like him. Same hand."
- Force: no boon. Terms: survive its rounds without a blow and it sits down on the ice. Lost: Pell wakes at his
  drawing board and keeps his careful father.

### 3.3 HARDNESS's traits

**WEARINESS (knees).** Wants to sit down; gets you through by wanting less. Feeds sloth.
- Body: a chairman made of eleven empty coats round a long table at noon, the twelfth chair kept for him; the light
  never moves. Only, Ned, era 2.
- Ground: the district office at noon, the long table, the chairs, one door.
- Moves: the press string, the gavel, the motion, the chair (a grab that sits him in the twelfth chair), the coats
  called to their feet, the clap that sends them all in at once, the vote down the long table.
- Weakness: it sits the moment it can and gets up slowly. Only a man who keeps moving beats it; enduring it is a trap,
  because noon has no end.
- Voice: "You only do what they send you to do. Then you sit down." / "It's only noon. It's been noon a while." /
  "Only a desk. Only till the spring. Your legs are gone, look at them."
- Force: Patience (Breath back faster), paid at the coda when Ned says "only" once more and Mary does not answer.
  Terms: refuse, by the door. Lost: Ned wakes in the twelfth chair, and the coat on it is his.

**OBEDIENCE (ballast).** Holds the line it's given. Feeds complicity, taking part because you were told.
- Body: a man who is the road barrier, his arm the striped pole hinged at his hip, a lantern for a head; carts come
  when he whistles. Forty Carts, Will, era 2.
- Ground: the road post in snow, the hut and its lantern, the dip in the road; the road freezes by phase.
- Moves: the hook that pulls him in, the drag to the district line, the thrust strings, the whistle that sends carts
  down the road in lanes.
- Weakness: it strikes along the line its arm points. Step off the line and it has to swing the whole pole round.
- Voice: "One cart. Then forty. Then there's no post. There's you on a road." / "You don't make the rule. You hold the
  rope." / "Hold it. That's all a post is. A man holding something."
- Force: Ballast (grabs no longer put him down), paid when Aaron looks at Will from the horse's head. Terms: lift the
  pole and walk through its drag. Lost: Will wakes with Holt's order in his ears.

**VANITY (pride).** Needs to be seen and liked. Feeds pride.
- Body: a good hat and a good coat with nobody in them, hung on the hands' strings from the barn's beams; it bows.
  Fond of Them, Abel, era 1.
- Ground: the harvest supper in Orme's barn, the long table, the hat's place at its head.
- Moves: a careful duellist who catches a careless blow and heals from the catch, then ripostes; plates down the
  table; the bow is a grab; the toast calls the room.
- Weakness: it needs to be struck at. Give it nothing to catch: feint, let the catch go by, punish its recovery.
- Voice: "Sit down, sit down. There's plenty." / "They're fond of you, the hands. Swing at me, go on. They're all
  watching." / "There. You see? You bow lovely. Your father bowed lovely."
- Force: The Good Hat (poise), paid when Ilo eats in the yard with his plate on his knees. Terms: refuse the toast and
  walk out, or endure without bowing. Lost: he wakes with his head down on the long table.

**APPETITE (grip).** The hands' wanting: the bread, the door, the man. Feeds gluttony, the eating of what was his to
keep.
- Body: the father bent under the kitchen ceiling, too big for the room, mouth open, hands longer than the table.
  Saturn at his son. Friday, Will, era 2.
- Ground: the Brack kitchen stretched tall, the table, the lamp; a boy's shoulders on the north wall are every tell.
- Moves: the backhand, the cuff, the overhead (late and early), the reach (a grab), the lean, the table slam down its
  length, the belt.
- Weakness: everything it does is a reach, and a reach leaves it open. Roll through the grab and the arm is out.
- Voice: "It's Friday. You know what Friday is." / "I never once did it for nothing." / "You're the same. Look at your
  hand. It's on the bread again."
- Force: Friday (heavy blows harder), paid when Davey moves his chair one place further from Will. Its own end is to
  go under the arm, which is losing on purpose.

### 3.4 AUTHORITY's traits

**TENDERNESS (condolence).** Sees the hurt in people and holds on too long. Feeds the betrayed bond, custody called
care.
- Body: a clay giant that walks beside him with its arm round his shoulders, a word cut in its brow, a cell door for
  a chest. It grows by phase. He's With Me (the Golem), Will, era 2.
- Ground: Haldane Yard at night, closing to the end cell.
- Moves: heavy fists, a hold that drags him to the cell, a charge that dazes it on the wall, a stomp that rings out.
- Weakness: the hold is the attack. Stay out of its arm, and reach its brow to rub the word out.
- Voice: "He's with me. He's all right. He's with me." / "Come here. You're freezing. Nobody touches him but me." /
  "Where is he, then. Where've I put him."
- Force: Clay (standing), paid at the Crown when a man tells the bar about a Hesh lad with a knife and stands Will a
  drink. Terms: rub the word out. Lost: Will wakes with clay under his nails.

**CONTEMPT (formletter).** Talks down. Feeds the refusal to bow, Iblis's "I am better than him".
- Body: a stack of sacks with a full, painted front and nothing behind, that never turns to look. Nobody Checks, a
  lesser being, the Descent only.
- Ground: the district office.
- Moves: the shove string, the bash, the slam, the sweep, the crush, sacks toppled round him.
- Weakness: it guards its face and nothing else. Behind it, it is hollow.
- Voice: "Nobody's going to come and check." / "Them? They can't count past their fingers. Go round, then. Nobody
  ever goes round."

**JEALOUSY (chit).** Sees what the other man has and what he paid. Feeds envy. New in this pass.
- Body: a hoarding fence that walks, one wet eye in a hole cut at eye height, long arms reaching over the top. A
  lesser being, the Descent only.
- Ground: Mill Street.
- Moves: the reach (a narrow string, early and late), the reach over the top, the take (a grab that drags him to the
  hole and takes his breath), the lunge, the boards coming down in a lane.
- Weakness: it sees one thing through one hole. Every blow it throws is narrow; stand at its side.
- Voice: "Look at his coat. Look at the tap. Two rooms and a tap." / "You'd have done more with it. You know you
  would." / "It should have been yours. All of it."

**SPITE (hearsay).** Says the thing that will hurt, where it will spread. Feeds slander.
- Body: a crier's tin horn at a man's head height with no man under it, and the lit screens that grow round it, each
  a mouth. Everybody Says, era 5, every line.
- Ground: the ring road's verge at night, one stone at a wrong angle; the verge narrows in the last phase.
- Moves: the push string, the sink (it comes up under him), the grab, the throng of heads, the post, the chorus, the
  spread of posts across the verge.
- Weakness: break the one that started it and the rest go home.
- Voice: "I'm not saying it's them. I'm saying I've not heard anybody say different." / "There was no corner. There
  was a verge. Go on, tell them. They'll believe you."
- Force: Reach (longer light strikes), paid when Ryan quotes his post back word for word. Terms: stand by the stone.

### 3.5 FEAR's traits

**DISGUST (smell).** Wants to wash its hands of people. Feeds the hatred of a people, the poisoned-well lie.
- Body: a low, heavy thing of wet fleece and soot crouched in a mud fold, a dragon on a hoard it dreamed. Under the
  Goats, Will in era 2, Ann in era 4.
- Ground: Tesk's fold on the hill in snow; pits spread across it by phase.
- Moves: the swing (early and late), the heave, the fling, the dive into the mud and up under him, the burial that
  pins him, the heap.
- Weakness: it fouls the ground and comes up from below. Keep moving off the patch you stand on.
- Voice: "There. Under the fold. Smell it?" / "That's them. That's how they live. You'll have it in your coat for a
  week." / "Dig. It's not stealing if it was always ours. Wash your hands after."
- Force: The Nose (tells read sooner), paid when Dorrah Tesk turns a child's face away from Will. Terms: put the spade
  down and stand on the bare rock.

**DREAD (dark).** Knows what's coming before it comes. Feeds flight from the field. New in this pass.
- Body: a black door frame walking in a long coat hung from the lintel, the door open on nothing. A lesser being.
- Ground: the road post in snow.
- Moves: the wait (a blow held long), the short wait, the door (a heavy blow with no armour), the come (a lunge out of
  the dark), the take (a hand out of the door), the coat swung round, and the dark itself, patches of floor going out.
- Weakness: the wait is longer than the blow, and the big ones carry no armour. Walk into the wait with a heavy blow
  and stop it before it comes. A man who only stands in its face swinging gets the hand and the coat, which do not stop.
- Voice: "You've seen that table. That's where this is going." / "Not yet. Not yet. Count yours." / "It's on the
  stairs. You can hear it. It's been on the stairs since you were six."

**SHAME (undertow).** Knows what people hide because it hides things too. Feeds concealment. New in this pass.
- Body: a hunched figure wound in wet grey sheets, its head turned away over its shoulder, water running off the hem.
  A lesser being.
- Ground: the Brack kitchen.
- Moves: the back string (early and late), the elbow, the pull from across the room (the undertow), the sheet thrown
  over him, the turn, a ring of wet floor.
- Weakness: it cannot stand to be looked at. Blows to its front, to the face it keeps turned away, land half again as
  hard. The answer is to stand square in front of it, the last place he wants to be.
- Voice: "Your hand's shaking. Put it in your lap." / "He thanked you. He'll thank people for the rest of his life." /
  "Don't look at me. Don't. Come here, then. Closer."

**NERVE (salt).** The will to go first. Feeds murder, the killing of a soul unjustly.
- Body: a bull in a greatcoat in the granary's maze, head down. Nearest One (the Minotaur), Will, era 2.
- Ground: the granary's sack stacks as corridors, opening on the wicket.
- Moves: the gore strings, the horns, the charge down the corridor, the pounce, the bellow that brings sacks down.
- Weakness: it goes at everything, and the stacks it hits stun it.
- Voice: "Go first. Somebody has to go first, and it's always you." / "Same boy. Same door. At least it's you."
- Force: The Way Out, paid by Edie finding a blue thread in his pocket. Terms: let the thread go.

### 3.6 How every fight is measured

`combat/tools/innerduel.mjs` fights each being twelve times with a skilled scripted player and an unskilled one. The
targets: the skilled player dies in half the attempts or fewer, the unskilled in 70 % or more, and the kill takes 60
to 180 seconds. All sixteen beings and the Adversary's three movements meet them
(`combat/tests/innerduel.json`). The three new beings measured: JEALOUSY 77 s, unskilled deaths 1.0; DREAD 75 s, 0.75;
SHAME 65 s, 0.92. Every move meets the telegraph rule T9.

## 4. The plot, shifted, era by era

The spine holds: the boy who did not come home, the failing parent, the Haldane table. The outer stakes hold: famine,
the plague and the poisoned-well lie, persecution, the fire, the dead. What shifts is what the inner arc is about.
Before, each era's protagonist met a lie he told himself. Now each era's protagonist meets a part of himself that the
era fed, and the line carries the traits down the generations: what a father feeds, his son is born carrying.

- **Era 1, The Exchange (year 0).** Abel meets VANITY at the harvest supper, the night the barn laughs at the toast and
  Ilo eats in the yard. Josh, for the militia line, meets OBEDIENCE in its first form at the road post after the frost
  list (The Lantern, designed in era1.md, not built; its self-lie is voiced by OBEDIENCE). The traits are small and
  courteous. A first-time player will beat them, and beating them cuts them back, and
  the cut ones come back.
- **Era 2, The Quota (year 12).** The night after day forty-one, Ned meets PRUDENCE (the beam that watched the arm go
  down) and WEARINESS (noon in the office). Will meets OBEDIENCE (the post and the carts), then APPETITE at his own
  table (Saturn at Davey), TENDERNESS in the yard (the Golem that keeps Tomas "with him"), and NERVE in the granary
  maze (the bull that goes first, "at least it's you"). CONTEMPT waits for the Descent. Tomas is held and dies in this
  era; nothing inside changes that.
- **Era 3, Allocation (year 20).** The fever and the Well House fire. Pell meets GUILT, the figure that does what his
  father did back at him. Will meets LOYALTY in its first full form at the fire: "Somebody has to keep them back off
  the fire." This is the era SHAME is fed (the fever's cart, the door barred or opened), and it is met only at the
  gate.
- **Era 4, The Closure (year 70).** Ruth meets COWARDICE, the barn that runs into its own walls: "It's the Company's
  grain." Ann meets DISGUST under the sign, the smell off the Row the night it burns.
- **Era 5, The Clearance (year 115).** Everyone meets SPITE, the share already on his phone. Leon meets LOYALTY
  returned, three generations in the shield. JEALOUSY rises (two rooms and a tap) and is met only at the gate. Then the
  Descent and the Adversary.

Each sin is formed from the traits the player fed, and only those: a run that cut its VANITY back and lost to its
APPETITE meets an AUTHORITY gate and a HARDNESS gate made of what is left.

## 5. The Descent and the combined monstrosity

- **The Descent** (`combat/arena/descent.mjs`) is four gates, one per great trait, from the weakest in him to the
  strongest, so the deepest gate is the part of him he fed most. A gate is armed when a trait under it was fed to
  level 7 or more (`FED`), cut back by force, lost to, or (for a lesser being) its self-lie was heard. An armed gate's
  being is the great trait's body fighting as its most-fed trait, with the next trait's blows in its hands. That is
  the sin, and it is never named on screen. A gate where nothing was fed is a yard in snow with the stove door open.
- **The Adversary** (`combat/data/host.mjs`) is three movements. The Accuser no longer reads a record: he is the one
  who stood at his shoulder for every fight, and at each of his phases he speaks the first words of one of the run's
  fed traits in that trait's own voice ("Good man. You never made a fuss."). The Host is the combined monstrosity: its
  limbs are the traits he cut back and the traits that took him, each on a cord of its own stuff. The One Who
  Withdraws is a trait that is never gone: "It will be back."
- The models of the demonic stay as they were drawn in `design/spine-plan/10-INFERNO.md` (the Accuser of Job,
  Iblis refusing to bow to the one made of clay, now AUTHORITY's plinth and CONTEMPT, Mephistopheles, Dante's ice, the
  folk demons, the Golem). The faiths stay fictional (the Furrow Church, the Hesh faith of the Well). No prophet is
  shown.

## 6. Felt in the body

Before the night opens, the trait he is about to meet is felt where he sits; when he wakes, what the night did to it
is felt the same way (`content/quota/traits.lwd`, fired by the hinge, played by `ui/senseplayer.mjs`, kept in
`G.state.cues`).

| Trait | Before the night |
|---|---|
| PRUDENCE | an iron arm settling on its stop somewhere in the house; two slow pulses in the pad; he goes still |
| LOYALTY | boots in step on the boards, more than one pair; he straightens |
| COWARDICE | voices through the wall deciding something without him; he turns away |
| GUILT | his own heart, loud; the room dims |
| WEARINESS | a long breath out; a long low rumble; he slumps |
| OBEDIENCE | cart wheels on a frozen road, coming |
| VANITY | a room going quiet as he comes in, a chair pulled out for him |
| APPETITE | a spoon scraping a bowl; three hungry pulses; his hand reaches |
| TENDERNESS | a child's breathing against him, asleep |
| CONTEMPT | a cuff pulled straight |
| JEALOUSY | a board creaking on the other side of the fence |
| SPITE | somebody in the next room telling it, and laughing; he flinches |
| DISGUST | a wet cough through the wall; the light goes sour |
| DREAD | a stair taking a weight and nobody on it; the edges close in; he trembles |
| SHAME | water dripping on the boards; he stoops |
| NERVE | wind on the shutters and his heart going hard |

On waking: cut back is something giving in his hands and a hard jolt; terms is a slow breath let go; taken is a slow
heavy heart, the edges closing, and the pad going on and on. Inside the arena, every line is captioned with its trait's
name, and the traits' presence is in the forms and the ground. The arena page has no sound of its own yet; that waits
on the audio package (ledger AU1).

## 7. How the set was chosen

Recorded as decisions in DECISIONS-2026-10-22.md, "The traits pass". In short:

- **Names by reading the lines.** Every existing line a voice speaks (`voice: <id>:` in `content/quota`, 292
  lines) was read under each candidate name. The name stayed when most of its lines read as that quality
  talking. Examples: APPETITE over WRATH and HUNGER for grip, because "Your hand's on the bread again" and "Under your
  knee. The give." both read as the hands wanting; PRUDENCE over GREED for sum, because "The arm says what it says.
  You only watch the arm" reads as the careful man and not the greedy one; COWARDICE for smallprint ("You didn't say
  anything. You stood still."); TENDERNESS over PITY for condolence, because a tender trait that holds too hard is
  the more uncomfortable fight.
- **No trait names a sin.** The game keeps sins off the player's surface (notallycheck R3). PRIDE, ENVY and GREED
  failed that rule, so the hat compartment is AUTHORITY, the chit is JEALOUSY, the pride voice is VANITY.
- **The build sheet reads as a person.** Ned's sheet now reads SUSPICION 4, HARDNESS 2, AUTHORITY 3, FEAR 2, with
  PRUDENCE, LOYALTY, COWARDICE and GUILT trained; Will's reads HARDNESS 4, FEAR 3 with WEARINESS, OBEDIENCE, VANITY and
  APPETITE trained. Read aloud, those are two men.
- **Each fight a distinct body.** The silhouette check (`judgeSilhouettes`) keeps every new form apart from the
  others: the closest pair among the new bodies is HARDNESS against FEAR at 0.67 overlap.

## 8. What this does not do yet

- The bodies are the project's placeholder 2D forms, drawn in values at game scale. The authored pipeline (D1) will
  replace them; these set the anatomy and the silhouette it must keep.
- Ten of the sixteen beings have hinges in the story (Steady Hand, Only, Forty Carts, Friday, Fond of Them, The Figure,
  Under the Goats, The Long Barn, Order and Everybody Says). He's With Me and Nearest One wait for their NEW LINE
  self-lies, as before. CONTEMPT, JEALOUSY, DREAD and SHAME are met only at the gates.
- Every new line is a PROPOSAL and waits for the author's approval (ledger S14).
- The arena page plays no sound; the presence cues play in the scene before and after.
