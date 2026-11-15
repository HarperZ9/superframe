<!-- writing-profile: research -->
# Low Water: voice samples for the author's approval

Story lead, 2026-10-21. Twelve of the worst lines from the thematic pass (1e1f667), each rewritten from that person's sheet in design/characters/, and one scene rewritten end to end. Nothing here is in the game yet. The rules are in design/DIALOGUE-STANDARD.md. The broad pass waits for the author's approval of this voice.

## Scores

| Set | Lines | Dialogue lint flags | Articulate check (local) |
|---|---|---|---|
| The twelve, before | 12 | 8 lines flagged (there-here 3, abstract-definition 2, self-definition 2, mirrored-pair 2, corrective-negation 1; a line can carry two) | No findings |
| The twelve, after | 12 | 0 | Gate ok, no findings; one advisory (a possible rule-of-three) |
| The scene, after | 12 spoken lines | 0 | Not run separately |

The local Articulate check found nothing in the before set either, so on its own it cannot tell the two apart. The Articulate engineer's dialogue and character-voice checks (design/VOICE-AUDIT.md) will be run on both sets when they land, and their scores added here. The dialogue lint is content/tools/dialogue_lint.py. A line the lint passes can still fail the read-aloud test; each note says what the rewrite is for.

## The twelve

### 1. CRAKE (`hill3.crake.case.her`)

Before: "You want me wicked. Wicked is cheap; you could hang it. I am arithmetic. Hang the arithmetic, and see who climbs those stairs for nothing."

After: "You'd like me to be a bad woman. I can see why, it's tidier. Thirty-eight people on this hill get their wages from me on a Friday. Mrs Pellow. Six Lamplighters. The substation men and their boys. I've paid the quay's coke for two years and the Board pays me back when it remembers. If I stop on Monday, the sodium's out by Wednesday, and then who goes up those stairs? Mrs Tallow went up them for nothing for six years. You won't. I won't."

Why: She defends herself with her payroll and the coke bill, which she knows to the week. "A bad woman" is what a sixty-year-old alderman would say. The last line is a fact she believes; she does not know Wenna stopped climbing three years ago.

### 2. CRAKE (`hill3.crake.case`)

Before: "The commons had this town for a hundred years, assessor. It lit one thing: a switch, pulled in the dark once a year by men in blindfolds. The Board drips. The Congregation steals glass and calls it grace, and the Brine bakes the glass. I paid."

After: "Before the sodium, the quay had four paraffin lamps and a man paid to light them, and two of them were out every Christmas because he drank. The Guild switches the whole quay off once a year to vote by smell, and the Board sends me the bill for the night. Nobody's ever thanked me for it. They come on, though."

Why: "The commons" is a word from a book. She talks about a man who drank and a bill. Her case is still strong; it is just hers.

### 3. CRAKE (`hill3.crake.case.sum`)

Before: "Yes. It is wrong. I can mend arithmetic, assessor. I cannot mend a character, not at sixty. Which would you rather I had?"

After: "Yes. All right. I wrote that. The keeper was eleven pounds a year in Mr Fisk's figures, and the bank wanted the whole job under four hundred, and I struck her out on a Thursday afternoon with the window open. I could write her back in tomorrow. (She takes the cap off her pen and doesn't write anything.) I'd have to tell the bank why."

Why: The incentive argument now lives in the bank's figure and a Thursday afternoon. The admission is in the pen she does not use.

### 4. SORLE (`brine.sorle.slate`)

Before: "In Kell a man can be poor among kin. Here a man can be free among creditors. I have seen both. I go home poorer and I sleep."

After: "My brother owed me four pounds for six years. At slack water last spring I told him it was gone. He cried, and then I think he bought the whole bar a drink with it. He never once said sorry. I still think about that, on the boat."

Why: Slack water told as one thing that happened to him, with its cost. Full forms, no contractions (profiles.json). The custom's good and its hurt are both in the story; neither is stated.

### 5. SORLE (`brine.sorle.serve`)

Before: "Thank you. In Kell that would be a debt. Here, I suppose, it is a transaction."

After: "Thank you. I will owe you one, landlady. You will have to tell me how that is done here. Do you write it on the board?"

Why: A careful foreigner's politeness, a small joke at the slate, and a real question.

### 6. SORLE (`brine3.trial`)

Before: "On my shore the old people say the thief and the one he robbed go out on the floor at low water together, and the sea does not ask which footprints were whose. When you hang one, you only choose whose footprints you will stop having to look at."

After: "At home they hanged a man when I was eight. For a boat. His sister kept house after, for the man who owned the boat, because there was no other work. Every morning she put his breakfast down in front of him. I used to watch her through the window. I do not know what you want me to say about your Alderman."

Why: The wanderer from the sea speaks from a memory, not a proverb, and refuses the room's question. That is his answer to the trial.

### 7. SABINE (`brine.sorle.wipe`)

Before: "Wipe it. Lovely. And when the Gut's coal runs out in February, who do they owe then? Nobody. And who gives them coal on nobody? Nobody. A slate is a promise somebody will still be here in February. Write that on your shore."

After: "Wipe it. Lovely. And in February when the Gut runs out of coal, where do they come? Here. And I chalk it, and they get warm, and in April they pay me back a bit. I've stood behind this bar thirty years, love. I'm going nowhere, and neither's the chalk."

Why: She says what she does with the slate, month by month, and where she has stood. No definition of a slate.

### 8. SABINE (`brine2.sabine.board`)

Before: "Then he's shame. He's not lies."

After: "Old Penrose. (She chalks something on the slate and rubs it out with her thumb.) All right. He paid his slate in coin last month, I remember, because I bit it. Him, then. The rest of them can pay in coin and I'll think about it."

Why: She concedes one man for a reason a landlady would have, and keeps her grudge against the rest in her own terms.

### 9. HESTER (`ropewalk3.tell`)

Before: "They don't want the truth, assessor. They want somebody to have it. Up the line somewhere, in a room, with a lamp. I'm the room."

After: "Mr Keel signs the harbour accounts every quarter, and every quarter he waits a week to hear if Hesk minds. Nobody in Hesk has ever minded. I've never had the heart to tell him. Mrs Spratt mended her chimney in June because the Shelf said it might send a man to look. I was the man. I looked out of that window. So you go and tell them, and then what's Mr Keel going to wait for?"

Why: The Grand Inquisitor's argument made of two neighbours and a chimney. She still ends on a question Lamb has to answer.

### 10. HESTER (`ropewalk3.tell.who`)

Before: "Somebody does. Mind, it's not a kindness. It's a habit with a ribbon in it."

After: "Somebody does. Don't make it sound nice. I've done it every Tuesday since Will, and I wouldn't know what to do with a Tuesday otherwise."

Why: Grief said as a day of the week.

### 11. FENNICK (`quay.boddy.rule`)

Before: "A rule is a jar for a whole Congregation. You would take it off us, assessor, in the middle of a noise like this?"

After: "There are forty of us, assessor, and somebody chalks our gate every Saturday. If Sister Gauze comes out tonight, Sister Maud wants a night off next week, and the Coyle boys start drinking at the Brine, and by Easter I've thirty. You want me to change the rule now? With him doing that?"

Why: A deacon afraid for a small, mocked congregation, counting heads. The control in the rule is in his fear, and the player can hear both.

### 12. ASH (`gasholder.ash.meet`)

Before: "They say on the quay you take our part. Thank you. You defend us so kindly you have never once read us."

After: "They say on the quay you've been sticking up for us. That's kind of you. Have you seen the book? (He turns the ledger round on the table.) Page forty. Go on. You'll want to know what you've been sticking up for."

Why: The challenge is an action, the ledger turned round, from a clerk who keeps honest books about a faith he loves.

## The scene, end to end: Crake's case (`hill3.crake.case`)

The current version is in content/act3/hill3.lwd at 474218d. Lamb's options are rewritten too, so Lamb also talks like a person. Twenty lines of narration, speech, options and voice.

```
@node hill3.crake.case
speaker: CRAKE
cost: 4
line: CRAKE: Why should it? It shouldn't, I expect. Open the shutter, if you like. Go on.
nar: Through the gap and the rain: the quay's three sodium lamps going on and off in the gusts, the Gut's wires swinging, the white lamps on the lane, and at the end of the mole, Mother, or the place where she is.
line: CRAKE: Before the sodium, the quay had four paraffin lamps and a man paid to light them, and two of them were out every Christmas because he drank. The Guild switches the whole quay off once a year to vote by smell, and the Board sends me the bill for the night. Nobody's ever thanked me for it. They come on, though.
line: CRAKE: You'll have my column in that book of yours. I've got yours. Seven shillings in the pound, six years. I'd thought you'd be taller. {when: trait(cv.ledger) == done}
opt: "You stopped Wenna Tallow's wages. That was you, with a pen." -> hill3.crake.case.her
opt: "You wrote that one open claim is cheaper than two. A man on the quay heard a price in it." -> hill3.crake.case.sum
opt: "The town could light its own lamps." -> hill3.crake.case.town
opt: "Go on." -> hill3.crake.case.on

@node hill3.crake.case.her
speaker: CRAKE
cost: 3
line: CRAKE: You'd like me to be a bad woman. I can see why, it's tidier.
line: CRAKE: Thirty-eight people on this hill get their wages from me on a Friday. Mrs Pellow. Six Lamplighters. The substation men and their boys. I've paid the quay's coke for two years and the Board pays me back when it remembers.
line: CRAKE: If I stop on Monday, the sodium's out by Wednesday, and then who goes up those stairs? Mrs Tallow went up them for nothing for six years. You won't. I won't.
voice: undertow: Thirty-eight wages, and one she stopped. She knows which one without looking it up. {dc: 5}
go: hill3.crake.menu

@node hill3.crake.case.sum
speaker: CRAKE
cost: 3
line: CRAKE: Yes. All right. I wrote that.
line: CRAKE: The keeper was eleven pounds a year in Mr Fisk's figures, and the bank wanted the whole job under four hundred, and I struck her out on a Thursday afternoon with the window open. I could write her back in tomorrow.
nar: She takes the cap off her pen and doesn't write anything.
line: CRAKE: I'd have to tell the bank why.
go: hill3.crake.menu

@node hill3.crake.case.town
speaker: CRAKE
cost: 3
line: CRAKE: On what? Mrs Brine's empties? Mr Merrow's copper?
line: CRAKE: They've three lamps lit tonight on their own oil, and you came up a hill in a gale because one of them might go out. Take them, then, all of them. I'll send the coke bills to the Guild hall on Monday and see how Mr Dunlin gets on.
go: hill3.crake.menu

@node hill3.crake.case.on
speaker: CRAKE
cost: 1
line: CRAKE: You came up here in a gale to hear me talk about coke. Most people only come up to be paid.
nar: She pours two small glasses from a decanter and leaves hers where it is.
go: hill3.crake.menu
```

## Next in line for the broad pass (flagged, not yet rewritten)

- BODDY: "The Low Company steals copper. These steal people."
- MARROW: "That's the price of the dark..." and "That's the price of the light."
- SPRATT: "Arithmetic doesn't hang. That's why they're so fond of it up the hill."
- ROOK: "I'm the wire. I'm not the paper."
- GAUZE: "I'm not at peace. I'm at a distance."
- SORLE: every "On my shore" line (six).
- Then the rest of the 33 thematic-pass lines the lint flags, then the 236 older ones, starting with the scenes the author is most likely to read first.
