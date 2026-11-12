# Low Water: Lamp Quay, 23:00 to 00:00

Reading copy, generated from the LWD/0 data by `lwd_check.mjs --print`. The data file is the source.

### arrive

- *(fact: arrived)*
- *(fact: claim.time)*
- *(fact: memory.low_light)*
- *(fact: spray.mole)*
- *(fact: walked.mole)*
Lamp Quay, a little after eleven. The tide is out further than the town has seen in nineteen years, and the town has gone down onto the floor of the harbour with lanterns to look at what the sea forgot.

Three sodium lamps hang over the quay on bent necks. Under them the houses are five storeys of the same colour, which is the colour of a lamp. At the end of the mole, Mother stands with her great head dark.

The assessor's coat is wet on the left side from the mole. It had been dry for eleven years.

**THE VANE**: West, six metres a second. The mole's been spitting since nine. You walked through it. So did anyone else who came this way.

**CANDLEMAS**: Sodium. I see one colour and I will not call it a colour.

**THE ALMANAC**: Low water at two minutes to eleven. The floor will be the floor until about twenty to twelve. After that it will be the sea again, and nobody's footprints.

- -> arrive.claim

### arrive.claim

CLAIM 4471/G. Harbour Board of Gullet against the Mutual Indemnity of the Lower Shelf. Nature of loss: darkness, malicious. Time of claim: 18:30. Time of loss, according to the Board's own telegram, unknown at the time of writing.

The assessor reads the line again under the lamp. It does not improve.

And on the ferry, at twenty-four minutes past ten by the ship's clock, a light low on the water where no light should be, and the deck tilting as the helm went over. The assessor has filed that too.

- -> hub

### hub

The quay. The steps go down to the floor at its middle. The Brine squats on the left in its upturned hull. The weigh-house wears the town balance on its roof. The mole runs out to Mother.

- *Go to the top of the steps, where the harbourmaster is dripping.* -> keel.start (if !has(met.keel))
- *Go back to the harbourmaster.* -> keel.again (if has(met.keel))
- *Go down the steps to the floor.* -> steps.down (if tide < -0.27)
- *Look down at the floor from the top of the steps.* -> steps.flooded (if tide >= -0.27)
- *Go into the Brine.* -> brine.enter
- *Go round the back of the Brine.* -> yard.enter
- *Go to the weigh-house.* -> weigh.outside
- *Walk the mole to Mother.* -> mole.walk
- *Go into the harbour office.* -> harbour.enter (if has(met.keel))

### keel.start

- *(fact: met.keel)*
At the top of the steps stands the harbourmaster, very tall, very straight, in a greatcoat that has given up being blue. Water runs from his cuffs and from the brim of his hat. He is standing in a puddle that he has brought with him.

Item: one harbourmaster, wet. The assessor declines to estimate how wet. The estimate would be challenged.

**KEEL**: You will be the Shelf. The Board telegraphed. The Board is gratified.

**KEEL**: Absalom Keel, harbourmaster. Do not stand there; that is where the Board stands. You will find it is already wet.

**THE DAMP**: Saturated. Completely. I can't read him. I've never been able to read him. Nobody can.

- -> keel.menu

### keel.again

The harbourmaster has not moved. The puddle has grown by the width of a hand.

**KEEL**: The Shelf returns.

- -> keel.menu

### keel.menu

- *What happened to the lamp?* -> keel.story
- *Your claim was sent at half past six. She went dark at twenty to ten.* -> keel.time (if has(claim.time))
- *I saw a light in the drowned lamp from the ferry. It turned us off the Spit.* -> keel.light (if has(memory.low_light))
- *Who keeps the weigh-house office?* -> keel.key (if !has(key.office))
- CLAIM *You signed the works order that put Mother on the quay board.* -> keel.order.ok / keel.order.fail (holds if has(works.order) & has(claim.time))
- *Leave him dripping.* -> hub

### keel.story

- *(if power.quay == off)* -> keel.story.dark
**KEEL**: Wreckers. The word is old and so is the crime. A light goes out, a ship goes in, and in the morning there is copper on the mud and nobody's footprints.

**KEEL**: The Low Company has wanted Mother dark since the Trust closed the Old Light to salvage. Their master, Merrow, said in the Brine before witnesses that he would "see her blind". The Board has the witnesses' names.

**KEEL**: Tonight she went dark, and tonight Merrow is on the floor with a sack. The Board does not believe in coincidence. The Board believes in tides.

Under the lamp he is fluent. He has said this before, or practised it, and the water running off him keeps time.

- -> keel.menu

### keel.story.dark

- *(fact: keel.rattled)*
In the dark the harbourmaster is a tall noise.

**KEEL**: Wreckers. The word is old and. The crime is old. A light goes out and a ship. The Board.

**KEEL**: The Board would like the lamps back on before it continues.

Without the lamp he has lost his place, the way a man reading aloud loses it when someone takes the page.

- -> keel.menu

### keel.time

**KEEL**: The Board anticipated. That is the Board's function. Merrow's threat was made on Tuesday; the Board's duty was to the policy, and the policy rewards the prudent.

**KEEL**: You would have preferred the Board to wait until she was dark? Until the ferry was on the Spit?

He says "until she was dark" as if it were a date he had written down.

**THE GLASS**: Oh, he knew. He knew the hour. Pressure in the Board is very low, darling.

- -> keel.menu

### keel.light

**KEEL**: A light. In the Old Light. Then he was there, the wrecker, with his lantern, signalling.

**KEEL**: You understand that a false light is the oldest trick of the trade. A ship sees a lamp where no lamp should be, and steers for it, and is lost.

The ferry did not steer for it. The ferry steered away from it, and was not lost. The assessor does not say so yet.

- -> keel.menu

### keel.key

- *(if has(met.marrow) | hour >= 23:30)* -> keel.key.give
**KEEL**: The Board keeps the office. The Board's papers are the Board's.

His hand goes to a pocket and stays there, the way a hand guards a thing that weighs more than a key should.

- -> keel.menu

### keel.key.give

- *(fact: key.office)*
**KEEL**: The Guild are in the weigh-house drinking to their strike, and the Shelf will want the scales' book for the claim. Take it. Bring it back. The Board will know if anything is moved; the Board is very sensitive to damp.

The key is wet. Of course it is.

- -> keel.menu

### keel.order.ok

- *(fact: keel.rattled)*
The assessor holds up the works order. The harbourmaster's signature is on it in a neat, dry hand: the only dry thing about him.

**KEEL**: The Trust required. The Alderman required. The Board signs what it is required to sign.

**KEEL**: The Guild's vote is a fishmongers' superstition. The Board could not be expected to rewire the town for a superstition.

**LAMB**: But you knew it would happen on Low Night. You filed at half past six.

For a moment the water stops running from his cuffs. Then it starts again, faster.

**KEEL**: The Board. Would ask the Shelf. To consider the town. A new lens, assessor. A whole new lens. You have not seen what is in that lamp.

- *(if light >= 0.3 & !has(gorm.warned))* -> keel.gorm
- -> keel.menu

### keel.order.fail

**KEEL**: The Board signs a great many things. The Board does not recall them individually. Do you have something in writing, or only a feeling?

The assessor has only a feeling and a time. A time is not enough, yet.

- -> keel.menu

### keel.gorm

- *(fact: gorm.warned)*
A woman in a dark coat with a brass pole longer than she is has been standing under the next lamp. She has a book open. She writes in it.

**GORM**: And who might you be, at this hour? And would the Alderman like to hear what you have been asking the harbourmaster? Or shall I tell her myself?

She does not wait for an answer. She walks to the harbour office, and the door closes behind her, and the telephone in it rings once.

- -> keel.menu

### harbour.enter

The harbour office: a stove, a chart of the bay under glass, a chair with a hole drilled in its seat. The telephone is on the wall, and it is ringing.

- *Answer it.* -> crake.call
- *Leave it ringing.* -> hub

### crake.call

- *(fact: crake.call)*
**CRAKE**: Absalom? No. You are the Shelf. Good evening. This is Ottilie Crake, for the Trust and for the Municipal. I gather you've been asking about wiring.

**CRAKE**: Let me save you an evening. Mother is automatic now. She comes on with the quay and goes off with the quay. It's modern, it's cheap, and it has worked every night for seven months.

**LAMB**: Except tonight.

**CRAKE**: Tonight a fishmongers' club interfered with municipal equipment. I've asked Sergeant Gorm to write it down.

- *Who restrikes the arc when the power comes back?* -> crake.restrike
- *Why does the keeper sit in the Brine every night?* -> crake.keeper
- *Goodnight, Alderman.* -> crake.bye

### crake.restrike

**CRAKE**: The arc restrikes itself.

A pause on the line, of the length it takes to read something you wrote seven months ago.

**CRAKE**: When cool. When cool, it restrikes itself. If it's hot there's a lockout, and a button. The engineer was very attached to his button. Colour is a daytime extravagance, assessor, and so are keepers.

- *Why does the keeper sit in the Brine every night?* -> crake.keeper
- *Goodnight, Alderman.* -> crake.bye

### crake.keeper

**CRAKE**: Nobody was dismissed. A post was reviewed. The review is ongoing. I am sure it will be favourable.

**CRAKE**: Mrs Tallow is very attached to that lamp. People are very attached to things in Gullet. It is a town that cannot let go of a fish.

- -> crake.bye

### crake.bye

**CRAKE**: I've told the Shelf's office I'll expect your verdict by dawn. They agreed. They always agree. Goodnight.

The line goes dead, and then, very faintly, does something a dead line should not do, which is click twice.

- -> hub

### steps.down

The steps go down further than steps should. Each one is wetter than the one above it. Halfway down, the sodium gives up and the light comes from the floor instead: lanterns, a dozen of them, moving slowly among the pools.

- *(if !has(met.fennick))* -> fennick.start
- -> steps.bottom

### fennick.start

- *(fact: met.fennick)*
On the lowest dry step a man in a white surplice over oilskins is blessing the mud. He has a glass bell jar under one arm, carried the way another man carries a hat. Behind him a dozen of the Congregation of the Filament kneel on the steps with jars over their heads, and their breath clouds the glass.

**FENNICK**: Low water, low light. You've come at the right hour. The sea is showing us its floor, and the floor is a kind of altar.

**FENNICK**: Ambrose Fennick. Deacon. You will have heard that we pray to a broken bulb. We do not say it broke. We say it was opened.

- -> fennick.menu

### fennick.menu

- *What did you see when the lamps went out?* -> fennick.pink
- *The Congregation keeps relics. Splinters of the Eye.* -> fennick.relic.lit (if light >= 0.1)
- *Show me the splinter. Here, in the dark.* -> fennick.relic.dark (if light < 0.1)
- *Step down with me, off the steps, out of the lamp.* -> fennick.stepdown (if light >= 0.1 & tide < -0.27)
- *Go on down to the floor.* -> steps.bottom (if tide < -0.27)
- *Go back up to the quay.* -> hub

### fennick.pink

- *(fact: lamps.pink)*
**FENNICK**: We were at prayer in the Brine's lee. At twenty to ten the quay went out, and Mother with it, all at once, as if someone had taken a breath. We sang. It is what you do.

**FENNICK**: Then the lamps came back, pink. Pink, assessor, like a cut. They go pink when they wake; the Municipal will tell you it is the neon in them, and the Congregation will tell you it is something else. Both are true.

**FENNICK**: Mother did not wake. We waited for her for half an hour. That was the first time I was afraid tonight.

**CANDLEMAS**: He is right about the neon. A low-pressure sodium lamp starts in the red and takes ten minutes to come to its orange. If they were pink when he looked, they had been dark until a few minutes before ten.

- -> fennick.menu

### fennick.relic.lit

**FENNICK**: The splinters come to us by grace, washed up at low water. The sea returns what the Eye lets fall. Every Low Night, a splinter or two.

He says it in the voice of a man reading a notice he has nailed up himself. The lamp above them hums.

**FENNICK**: Under the lamp is not the place, assessor. The Lamplighters read lips. Low light, low voices.

- -> fennick.menu

### fennick.stepdown

They step down off the last stair into mud that takes the assessor's boots to the ankle. The sodium is behind them now, a smear on the fog.

- -> fennick.menu

### fennick.relic.dark

- *(fact: prism.numbered)*
In the dark he opens the bell jar's base. Inside, on velvet, is a wedge of glass the length of a finger, sharp along every edge, with a number cut into its spine.

**FENNICK**: One hundred and thirteen. Every splinter of the Eye is numbered. The Lord is an engineer, assessor. He leaves a schedule.

**CANDLEMAS**: Hold it to the lantern. There. Look how it splits the light: clean, red to violet, not a fringe out of place. That is crown glass from a lens-maker's mould. The sea did not make this. The sea frosts everything it keeps.

**FENNICK**: I did not say the sea made it. I said the sea returned it.

**LAMB**: Who sold it to you, deacon?

**FENNICK**: Speak to me in the dark and I will tell you something true. That is not the same as telling you everything.

- -> fennick.menu

### steps.flooded

The lowest steps are under water. Out on the floor, lanterns are coming back toward the quay in a hurry, and the pools between them have joined hands.

- -> hub

### steps.bottom

The harbour floor. Grey mud, black pools with lamps in them, ribs of an old hull, a fish the size of a cart lying on its side while children walk round it in respectful circles.

- *Look at the prints leading out toward the drowned lamp.* -> floor.prints (if !has(prints.read))
- *Cross the gully to the drowned lamp.* -> floor.gully (if tide < -0.35)
- *The gully has closed. Look across it.* -> floor.gully.closed (if tide >= -0.35)
- *Go back up the steps.* -> hub

### floor.prints

- *(if rain > 0.5)* -> floor.prints.gone
- *(fact: prints.read)*
A line of prints goes out from the foot of the steps toward the drowned lamp. Big boots. Size eleven, if the assessor is a judge, which professionally the assessor is.

Going out, the heels are shallow. Coming back, which they have not yet done, there are none. Beside the outgoing line, a second set, smaller and older, half filled with water: a Low Night walker who turned back at the gully.

**THE ALMANAC**: The floor opened past these steps at eight minutes past ten. Whoever this is went out after that. The gully opened at sixteen minutes past. They waited for it, or they knew.

**THE GLASS**: Rain in twenty minutes or so. These won't keep.

- -> steps.bottom

### floor.prints.gone

The rain has been at the floor. Where there were prints there are soft dents with water in them, like a sentence someone has rubbed out with a wet thumb. The assessor can tell that someone walked here. Not who, or how heavily.

- -> steps.bottom

### floor.gully

The gully is a ditch of moving water between the floor and the rock where the Old Light stands. It is knee-deep and colder than knees should be asked to bear.

The drowned lamp leans out of the mud like a tooth. There is a hole in its base, and in the hole, a lantern.

- *(if hour < 23:40 & !has(met.merrow))* -> merrow.start
- *(if hour < 23:40)* -> merrow.again
- -> drowned.empty

### drowned.empty

The lantern is still there, burning low. The man who hung it has gone. A coil of rope has gone with him, and the hole is lighter by a great deal of copper.

**THE ALMANAC**: Back across now, or swim later.

- *Go back across the gully.* -> steps.bottom (if tide < -0.35)
- *Go back across. It is deep now.* -> floor.wade.late (if tide >= -0.35)

### floor.wade.late

- *(fact: damp.saturated)*
The gully is at the assessor's thighs and then, briefly and memorably, at the assessor's ribs. The Damp in its case makes a sound like a man drowning politely.

**THE DAMP**: Saturated. I'm no use to you until a fire has had me.

- -> steps.bottom

### merrow.start

- *(fact: met.merrow)*
A short, wide man is inside the base of the tower, or as much of him as fits. He backs out with a sack that clanks. He looks at the assessor. He does not ask a question. He never asks questions.

**MERROW**: The Board sent you.

**LAMB**: The Shelf sent me. The Board sent for me.

**MERROW**: Same tide.

- -> merrow.menu

### merrow.again

Merrow is sitting on the rubble at the foot of the tower with his sack between his boots, as if it were a dog that might run.

- -> merrow.menu

### merrow.menu

- *Keel says you darkened Mother to wreck the ferry.* -> merrow.wreck
- *I was on the ferry. I saw your light. It turned us.* -> merrow.saved (if has(memory.low_light) & !has(merrow.trust))
- *Where were you when the lamps went out?* -> merrow.where
- *Read his trousers.* -> merrow.damp (if !has(damp.saturated) & !has(merrow.wet_thigh))
- *Leave him to his copper.* -> drowned.leave

### merrow.wreck

**MERROW**: If I wanted a ship on the Spit I'd wait for fog. Not for the Board's lamp. The Board's lamp's been half blind for years. Ask any master on the run. Green, they say. She's gone green.

**MERROW**: I said I'd see her blind. In the Brine. I'd had four. She is blind. I didn't do it.

- -> merrow.menu

### merrow.where

**MERROW**: Asleep on my boat.

His boat is on its side on the floor, a long way from here, and it is a long way from asleep.

- *(if has(merrow.trust))* -> merrow.where.true
- -> merrow.menu

### merrow.where.true

- *(fact: merrow.light)*
**MERROW**: All right. On the floor from just after ten. Waited for the gully. Over at sixteen past. Knocked the lantern out climbing in, at the hole, there. Lit it again at twenty-five past and hung it up so I could see what I was stealing.

**MERROW**: That's the truth and it hangs me either way. Copper off Trust property, or a false light on the rock.

Twenty-five past. The ferry turned at twenty past by the true clock. The assessor does the sum twice, as a matter of professional habit, and then does it a third time, as a matter of something else.

- -> merrow.menu

### merrow.saved

- *(fact: merrow.trust)*
The assessor tells him: the deck, the light low on the water on the wrong bearing, the master swearing and the wheel going over, the Spit going by close enough to read.

Merrow listens with his pipe in his teeth, cold. When the assessor finishes he takes the pipe out and looks at it.

**MERROW**: Nobody honest sleeps at low water. That's when the sea shows you what it took.

**MERROW**: I didn't see a ship. I saw a light on the water going the wrong way. Then it went the right way. I thought that was the sea's business.

- -> merrow.menu

### merrow.damp

- *(fact: merrow.wet_thigh)*
**THE DAMP**: Wet to the thigh, and the top of it fresher than the bottom. He crossed when it was shallow and he's been in it again since, deeper. He hasn't been near a boat. Boats are dry on the inside. Usually.

- -> merrow.menu

### drowned.leave

- *Go back across the gully.* -> steps.bottom (if tide < -0.35)
- *Go back across. It is deep now.* -> floor.wade.late (if tide >= -0.35)

### floor.gully.closed

The gully is full and moving. On the far side the drowned lamp's lantern still burns in its hole, very small, as if it had been left on for someone.

- -> steps.bottom

### brine.enter

The Brine is a boat that gave up and lay down on the quay with its keel to the sky. Inside it is warm, and smells of paraffin, vinegar, wet wool and bread. The light is yellow and honest, and the assessor's coat is suddenly the colour it is.

**CANDLEMAS**: Paraffin. At last. Ask me anything about anything's colour.

- *(if !has(met.sabine))* -> brine.sabine.start
- -> brine.menu

### brine.sabine.start

- *(fact: met.sabine)*
Behind the bar a wide, quick woman is fishing an egg out of a jar with a fork she then puts behind her ear like a pencil.

**SABINE**: Pickled egg, a penny. A straight answer, tuppence. I'm out of straight answers. The egg's very good.

**SABINE**: Sabine Brine. You'll be the Shelf. Your chits are good here tonight. Tomorrow I'll see.

- -> brine.menu

### brine.menu

By the stove, a small woman in an oilskin sits with her back to the room and her face to the fire, the way people sit who are waiting for something to stop being true.

- *Talk to the woman by the stove.* -> wenna.start (if !has(met.wenna))
- *Talk to Wenna again.* -> wenna.menu (if has(met.wenna))
- *Ask Sabine when the keeper left tonight.* -> sabine.alibi
- *Look at the slate behind the bar.* -> sabine.tab (if !has(tab.wenna))
- *Ask about the bread oven.* -> sabine.oven (if !has(prism.green_oven))
- *Dry the Damp at the stove.* -> brine.dry (if has(damp.saturated))
- *Talk to Merrow, steaming by the door.* -> merrow.brine (if hour >= 23:45)
- *Go back out to the quay.* -> hub

### brine.dry

The assessor holds the Damp to the stove until the hair in it stops weeping. It takes ten minutes. Nobody in the Brine finds this strange.

**THE DAMP**: Thank you. I was a man's hair once. He used to sit like this.

- -> brine.menu

### sabine.alibi

**SABINE**: Wenna? Left at nine to light up. I remember because the clock struck and she didn't.

**CANDLEMAS**: Look at the clock.

The Brine's clock says nine minutes to eleven. The assessor's watch says two minutes past.

**SABINE**: It's slow. Eleven minutes. Has been since my husband dropped it. Everyone knows. I add it on without thinking.

So the clock struck nine at eleven minutes past. Wenna, if she left at all, left at eleven minutes past nine. Sabine has added eleven minutes to everything tonight except that.

- -> brine.menu

### sabine.tab

- *(if fog > 0.03 | has(overheard.last_three))* -> sabine.tab.read
The slate is behind Sabine, and Sabine is in front of it, and Sabine is wider than the slate.

**SABINE**: Customers' accounts are customers' business, love.

- -> brine.menu

### sabine.tab.read

- *(fact: tab.wenna)*
Sabine has gone to the back door; someone in the yard is calling her about the fog and the bread. The slate is unguarded.

Chalk marks, a column to a customer. In the column marked with a little drawing of a lighthouse: a round at a quarter to ten. A round at ten past ten. A pie.

Wenna did not leave at nine. Wenna did not leave.

- -> brine.menu

### sabine.oven

- *(fact: prism.green_oven)*
The bread oven is in the wall behind the bar, iron-doored, still ticking with heat. Sabine does not stop the assessor opening it. She watches with her arms folded, which is a kind of stopping.

On the oven's floor, among the loaves, a wedge of glass in a clay mould, still warm. In the Brine's paraffin light it is green. Bottle green. The green of the Brine's own empties, stacked to the ceiling in the corner.

**CANDLEMAS**: Green. Unarguably, vulgarly green. That's no lens-maker's glass. It bends the light like a drunk turning a corner.

**SABINE**: Bottles? I sell what's in them. What's left is between me and the oven.

- -> brine.menu

### wenna.start

- *(fact: met.wenna)*
Up close she is small and round-backed, with a head too large for her collar and white hair cropped short with something that was not scissors. Her hands, folded on her knee, are shiny with old burns.

**LAMB**: Mrs Tallow. The keeper.

**WENNA**: That's me. You've come about her.

**WENNA**: She's not dark. She's got her eye shut. There's a difference, and you'll learn it or you'll go home on the morning boat.

- -> wenna.menu

### wenna.menu

- *Where were you when she went out?* -> wenna.where (if !has(wenna.confessed))
- *Read her coat.* -> wenna.coat.read (if !has(damp.saturated) & !has(coat.wenna_dry))
- CLAIM *Your coat is dry, Mrs Tallow.* -> wenna.coat.ok / wenna.coat.fail (holds if has(coat.wenna_dry) & has(spray.mole) & !has(wenna.confessed))
- CLAIM *You were here all night. The slate says so.* -> wenna.tab.ok / wenna.tab.fail (holds if has(tab.wenna) & !has(wenna.confessed))
- *Tell me about the green glass.* -> wenna.glass (if has(wenna.confessed) & (has(prism.green_oven) | has(lens.green) | has(prism.numbered)))
- *Come with me to the lamp room.* -> wenna.come (if has(wenna.confessed) & !has(mother.relit))
- *Leave her to the fire.* -> brine.menu

### wenna.where

**WENNA**: In the lamp room. Where I always am. She went out, quick, the way they do. She's old. I came down for a man to look at her.

**WENNA**: A hundred and twelve stairs. You count them, after a while.

She does not turn from the fire while she says it.

- -> wenna.menu

### wenna.coat.read

- *(fact: coat.wenna_dry)*
**THE DAMP**: Dry. Bone dry, apart from a drop of beer on the left cuff. Nobody's walked that mole in this coat tonight. I would know. I'm from there.

- -> wenna.menu

### wenna.coat.ok

- *(fact: wenna.confessed)*
The assessor says it plainly: the mole has been spray-swept since nine; anyone who walked it from the lamp house is wet on the windward side, as the assessor is; her coat, by the Damp, is dry.

She looks at the coat for a long time. She smooths it over her knee as if it were a cat.

**WENNA**: It's a good coat.

**WENNA**: All right. I was here. I've been here every night for three years. The stairs, and the money. They stopped the money, you know. Six years. Pending a review.

**WENNA**: She comes on by herself now. With the quay. I sit here and I see her through the window, over the mole, and I know she's lit, and I have my pie.

**WENNA**: Tonight I heard her motor stop. Twenty to ten. You can hear it, if you've heard it for thirty years. And I sat. I sat with my pie, and I thought, she'll come back with the quay, and the quay came back, pink, and she didn't.

- -> wenna.menu

### wenna.coat.fail

**WENNA**: It's an oilskin. It's what they're for. Water runs off.

She has a point, and the assessor has no reading to answer it with.

- -> wenna.menu

### wenna.tab.ok

- *(fact: wenna.confessed)*
A round at a quarter to ten. A round at ten past. A pie. The slate does not lie because the slate does not care.

**WENNA**: Sabine and her chalk. She'll put me in the ground with a bill.

**WENNA**: All right. I was here. I heard her stop at twenty to ten and I didn't go. I'm sixty-four and I've a hundred and twelve stairs and a fire and nobody's paid me since the sodium came. I didn't go.

- -> wenna.menu

### wenna.tab.fail

**WENNA**: You've not seen any slate. You've seen Sabine's back.

- -> wenna.menu

### wenna.glass

**WENNA**: Glass is glass. She doesn't know the difference. Ships might. Ships are fussy.

**WENNA**: The deacon pays in coin and he doesn't ask. Sabine fires the oven on bread nights and I bring her the moulds. One prism a month, for six years. Seventy-two, near enough. A third of her.

**WENNA**: She's dimmer. I know she's dimmer. Nobody in town can tell, because of the sodium. You can't see her from under it. You can't see anything from under it.

**WENNA**: I kept her lit. That's my job. Nobody said I had to keep her honest.

- -> wenna.menu

### wenna.come

**WENNA**: My knees.

**WENNA**: All right. All right. Somebody ought to see her before they take her eye out and sell it to the Shelf.

She stands, in stages, like a ladder being put up.

- -> mole.walk.wenna

### merrow.brine

Merrow is standing by the Brine's door, steaming. His sack is under the bench with Sabine's boot on it.

**MERROW**: The sea came for the gully. I came for the stove. Neither of us waited to be asked.

- *(if has(merrow.trust))* -> merrow.brine.trust
**MERROW**: Asleep on my boat.

- -> brine.menu

### merrow.brine.trust

**MERROW**: You told me about the ferry. I'll tell you about the lantern. Knocked it out climbing in at eighteen past. Lit it at twenty-five past. In between, it was dark in there. I'd know. I was in it.

- *(fact: merrow.light)*
Twenty past, the ferry turned. Twenty-five past, the lantern was lit. The assessor writes both times down and draws no line between them.

- -> brine.menu

### yard.enter

Behind the Brine: barrels, a mangle, a stack of empty bottles taller than a man, all green. The back door is propped open and lets out heat and the smell of bread.

- *(if fog > 0.03 & !has(overheard.last_three) & hour < 23:45)* -> yard.overhear
- *(if !has(overheard.last_three))* -> yard.seen
- -> yard.quiet

### yard.overhear

- *(fact: overheard.last_three)*
The fog has the yard. The assessor is a shape among barrels and nobody looks for shapes. Through the door, two women's voices, low, carried by the wind straight from the oven to the stack of bottles where the assessor stands.

**SABINE**: That's the last three. I'm not firing that oven for glass again, Wenna. Not with the Shelf on the quay.

**WENNA**: She needs three more for the bottom ring. The bottom ring's the one the ships see.

**SABINE**: The ships can see the Spit, then. Eat your pie.

**THE VANE**: Straight from the door to your ear. Lucky. Or I'm good.

- -> yard.quiet

### yard.seen

The yard is open to the quay lamps and the assessor is lit like a shop window. Inside, two voices stop at once. Sabine's face appears in the door, looks, and smiles.

**SABINE**: Bottles are a penny a dozen, love. The fog's a penny for nothing.

- -> yard.quiet

### yard.quiet

- *Look at the bottles.* -> yard.bottles
- *Go back to the quay.* -> hub

### yard.bottles

Some of the bottles have their bottoms knocked out, neatly, all the same way. A glass punt, a ring of thick green glass. Exactly the weight of glass that would go into a mould the length of a finger.

- -> yard.quiet

### weigh.outside

The weigh-house: brick, squat, the town balance on its roof with a pan at each end of the beam, the pans tilted toward the harbour as if weighing it. Inside, men are singing. On the wall under the eave, an iron box with a handle and a painted word: QUAY.

- *Look at the switch box.* -> weigh.switch (if !has(scales.switch))
- *Go in to the after-vote.* -> weigh.in
- *Try the office door.* -> office.door
- *Pull the quay switch.* -> blackout.pull (if power.quay == on)
- *Put the quay switch back.* -> blackout.restore (if power.quay == off)
- *Go back to the quay.* -> hub

### weigh.switch

- *(if rain > 0.5 & hour >= 23:50)* -> weigh.switch.gone
- *(if light < 0.1)* -> weigh.switch.dark
- *(fact: scales.switch)*
The handle of the switch box is smeared and bright. Fish scales, a dozen of them, stuck flat to the iron, catching the lamp like sequins on a widow.

**THE VANE**: West wind, and the eave keeps this side dry. When the wind goes round, the rain gets in under there. Read it while you can.

- -> weigh.outside

### weigh.switch.gone

The rain is driving in under the eave from the south-west. The handle of the switch box is clean, wet iron. Whatever was on it has gone into the gutter with everything else.

**THE VANE**: Told you. South-west. Everything under that eave has been washed.

- -> weigh.outside

### weigh.switch.dark

In the dark the switch box is a box. The assessor's fingers find iron, and something slick, and nothing they can swear to.

- -> weigh.outside

### weigh.in

Inside, the Guild of the Gut is drinking to its strike. Forty men and women in aprons, blindfolds pushed up on their foreheads like a second pair of eyebrows. On a board on the far wall, chalk tallies: FOR, and a column of little fish; AGAINST, and fewer.

- *(if !has(met.marrow))* -> marrow.start
- -> marrow.menu

### marrow.start

- *(fact: met.marrow)*
The largest man in the room comes through it the way a boat comes through a crowd of smaller boats. His forearms shine with scales that will never wash off.

**MARROW**: The Shelf. You smell of train and paper. A flatfish. Both eyes on one side of your head, lying on the bottom, looking up at everyone.

**MARROW**: Marrow Dunlin, steward. We've won, assessor. By a nose. You've come on a good night.

- -> marrow.menu

### marrow.menu

- *How does the Guild vote?* -> marrow.vote
- *Who pulled the quay switch at twenty to ten?* -> marrow.switch.ask (if !has(marrow.switch))
- CLAIM *There are scales on the switch handle, and the lamps came back pink at ten.* -> marrow.switch.ok / marrow.switch.fail (holds if has(scales.switch) & has(lamps.pink) & !has(marrow.switch))
- *Mother was on that switch. Did you know?* -> marrow.knew (if has(marrow.switch))
- *Go back outside.* -> weigh.outside

### marrow.vote

**MARROW**: In the dark, by the nose, blindfolded. Two fish on the pans: this year's price and last year's. You smell them both and you stand by the one you'd sell your mother for.

**MARROW**: We vote in the dark because in the light a man votes with his face.

- -> marrow.menu

### marrow.switch.ask

**MARROW**: The Guild was at the vote all night, assessor. Nobody touched anything.

He says it loudly. He says everything loudly. The room goes on singing around the sentence, a little more carefully.

- -> marrow.menu

### marrow.switch.ok

- *(fact: marrow.switch)*
The scales on the handle. The lamps coming back pink at ten. The assessor lays them down one beside the other, like two fish on a slab.

Marrow is quiet. When Marrow is quiet the whole room hears it.

**MARROW**: Thirty years that switch has gone down and come up. My father pulled it. Lights out for the nose. Thirty years nothing went with it.

**MARROW**: Twenty-two minutes to ten I pulled it. Eight minutes to I put it back. Fourteen minutes. The quay came back, pink, like it does. I came out to piss and looked at the mole and she wasn't there.

- -> marrow.menu

### marrow.switch.fail

**MARROW**: Scales? On the quay? In Gullet? You'll find scales on the Alderman's teacups, flatfish.

- -> marrow.menu

### marrow.knew

**MARROW**: Know? Who'd tell us? The Trust doesn't tell the Guild what time it is. If they put her on our switch, they put her there quiet.

**MARROW**: I guessed. Ten o'clock, out in the rain, looking at the mole. I guessed and I said nothing, because a guess is what they hang a Guild for.

- *(if !has(key.office) & !has(works.order))* -> marrow.office
- -> marrow.menu

### marrow.office

**MARROW**: If there's paper, it's in that office. The Board keeps it locked. The window's got no catch, mind, if you were small and nobody could see you. We smell a lot of things in this town. We don't see much.

- -> marrow.menu

### office.door

- *(if has(key.office))* -> office.enter
- *(if fog > 0.05 | power.quay == off)* -> office.window
The office door is locked. Its window faces the quay, under the lamp, and a Lamplighter is leaning on the next post, writing in her book.

- -> weigh.outside

### office.window

The fog has come up to the window sill, or the lamps have gone, and nobody on the quay can see a shape at a window. The window has no catch. The assessor goes in the way an assessor should never go anywhere.

- -> office.enter

### office.enter

The office: ledgers of the town balance, a desk, a pneumatic tube that ends in a brass mouth on the wall, and a cabinet with a drawer marked BOARD, WORKS.

- *Read the drawer marked WORKS.* -> office.order (if !has(works.order))
- *Look at the pneumatic tube.* -> office.tube
- *Leave.* -> weigh.outside

### office.order

- *(fact: works.order)*
A works order, seven months old. Gullet Head Light: supply to be transferred from the Light's own feeder to the Lamp Quay board, weigh-house, for economy and automatic operation at dusk. Approved: O. Crake, for the Trust. Signed: A. Keel, for the Board.

Pinned behind it, the engineer's specification. One clause is crossed out in yellow ink: "After any interruption of supply the arc shall be restruck by the keeper on duty at the lamp-room panel." In the margin, in the same yellow: "No keeper. Saving."

**CANDLEMAS**: Yellow ink. She writes in the one colour that disappears under her own lamps.

- -> office.enter

### office.tube

The tube's brass mouth is cold. A card is tucked behind it in a child's careful hand: TUBE MINDED BY P. GANNET, 1s A WEEK. Underneath, a strip of paper from the Shelf, typed, the letter e sticking all through it.

"Shelf requires provisional cause by midnight. Chits honoured till dawn. Shelf regrets nothing."

- -> office.enter

### blackout.pull

- *(fact: blackout)*
The assessor pulls the handle down. It goes with a sound like a drawer of knives.

Lamp Quay goes out. The three lamps die to embers and then to nothing, and the houses that were one colour become no colour, and the fog is suddenly white instead of orange, and everyone on the quay stops talking at once and then starts again much more quietly.

Inside the weigh-house the singing stops. A man's voice says, "Was that us?"

**CANDLEMAS**: Dark. Two parts in a hundred. You are invisible now, and so is everyone else, and so is the edge of the quay.

- -> weigh.outside

### blackout.restore

The handle goes up. The quay lamps wake pink, as Fennick said, a raw pink like a cut, and begin the ten minutes it takes them to forget the colour of anything.

- -> weigh.outside

### mole.walk

The mole runs out into the dark with the sea on both hands, a little lower than usual and a great deal louder. Spray comes over the windward side in sheets. The assessor's left side, which had begun to dry, gives up.

- *(if rain > 0.5 & !has(damp.saturated))* -> mole.walk.rain
- *(if fog > 0.05)* -> mole.walk.fog
- -> lamp.door

### mole.walk.rain

- *(fact: damp.saturated)*
Spray from the left, rain from the right, and the assessor in the middle like a letter in a puddle.

**THE DAMP**: Saturated. I can't tell you a wet thing from a dry one until a fire's had me.

- *(if fog > 0.05)* -> mole.walk.fog
- -> lamp.door

### mole.walk.fog

In the fog the mole has no end. Mother is a shape above the fog, a great swollen head on a stalk, looking at nothing.

- -> lamp.door

### mole.walk.wenna

They walk the mole together. Wenna is slow and does not take the assessor's arm. Spray comes over and soaks her oilskin on the windward side in the first twenty yards. Now it is a coat that has walked the mole.

**WENNA**: There. Now I've been.

- -> lamp.door

### lamp.door

A hundred and twelve stairs. The assessor counts them going up, and understands something about the keeper by the ninetieth.

The lamp room is a glass drum with the night all round it. In the middle, on a brass pedestal, stands the lens: a beehive of glass rings taller than a man, every ring a prism, and in its heart the arc, dead.

- *(if has(wenna.confessed) & at(lamproom))* -> lamp.wenna
- -> lamp.menu

### lamp.wenna

**WENNA**: There she is. Don't touch her. I'll touch her.

Wenna puts her hand flat on the bottom ring, the way you put a hand on a horse.

- -> lamp.menu

### lamp.menu

- *Read the panel on the wall.* -> lamp.panel (if !has(panel.restrike))
- *Read the log on the desk.* -> lamp.log (if !has(log.ahead))
- *Restrike the arc.* -> lamp.restrike (if has(panel.restrike) & mother == dark & power.quay == on)
- *The quay switch is down. Nothing here will light.* -> lamp.nopower (if power.quay == off)
- *Look at the lens.* -> lamp.lens (if !has(lens.green))
- *Go back down to the quay.* -> lamp.down

### lamp.panel

- *(fact: panel.restrike)*
A brass panel, a red button the size of a coin, and a card under glass, typed by an engineer who believed in buttons: RESTRIKE REQUIRED. If the arc is hot when supply returns, the lamp will not relight of itself. Press and hold for five seconds. KEEPER TO ATTEND AFTER ANY LOSS OF SUPPLY.

**CANDLEMAS**: The arc has been cold for an hour. Press it now and she will light. Press it at ten o'clock and she would have lit then.

- -> lamp.menu

### lamp.log

- *(fact: log.ahead)*
The log lies open on the desk. Every night a line in a round hand: lit at dusk, all well, extinguished at dawn. Tonight's line is there: "Lit 19.12. All well." So is tomorrow's. So is every night to the end of the month.

**THE DAMP**: Same ink, same day. Somebody sat down once and wrote a month of nights.

- -> lamp.menu

### lamp.nopower

The panel's pilot light is out. The quay switch takes Mother with it; the assessor knows that now in the hands as well as on paper.

- -> lamp.menu

### lamp.lens

- *(if mother == burning)* -> lamp.lens.lit
In the dark the lens is a hive of grey glass. Candlemas will not commit.

**CANDLEMAS**: Give me light inside it and I will tell you what it's made of. Glass keeps its secrets in the dark like everyone else in this town.

- -> lamp.menu

### lamp.lens.lit

- *(fact: lens.green)*
Lit from inside, the lens is a beehive of light, ring above ring. And a third of the rings are green. Not tinted. Green: the green of a bottle in a hedge, the green of the Brine's corner, the green of the thing in the oven.

**CANDLEMAS**: Crown glass, crown glass, bottle, crown, bottle, bottle, crown. I could weep. I won't. Someone has to keep counting.

- -> lamp.menu

### lamp.restrike

- *(fact: mother.relit)*
The assessor presses the red button and holds it, and counts five, as the card says, in the voice the assessor uses for counting money.

Something in the pedestal ticks. Then the arc catches, with a sound like a breath taken in through teeth, and the lens fills from the inside, and the lamp room is suddenly too bright to stand in.

The beam goes out over the fog and lies on it. It turns, slowly, a great blade the fog cannot decide whether to hold or to let pass. Below, on the quay, people come out of doors to look, and the assessor can hear, very faintly, a Guild cheer.

- *(if has(wenna.confessed))* -> lamp.restrike.wenna
- -> lamp.menu

### lamp.restrike.wenna

**WENNA**: There she is. Look at her. She's green. You can see it now, from in here. Every ship from here to Hesk can see it.

**WENNA**: I kept her lit. Nobody said I had to keep her honest.

- -> lamp.menu

### lamp.down

A hundred and twelve stairs, counted the other way. The quay at the bottom is where the assessor left it, slightly wetter.

- -> hub

### midnight

Midnight. Somewhere in the weigh-house a brass mouth coughs, and a cylinder drops into its basket with the sound of a cork. The Shelf requires a provisional cause.

The assessor opens the Daybook under whatever light there is, and reads back what the night has given.

- *(if mother == burning)* -> midnight.relit
- -> midnight.choose

### midnight.relit

Over the quay, Mother's beam turns, green at its edges if anyone knows to look, and some do now.

- -> midnight.choose

### midnight.choose

- *Provisional cause: malicious darkening by wreckers, as claimed.* -> end.wreckers
- *Provisional cause: the Guild's interference with the quay switch.* -> end.guild (if has(marrow.switch) | (has(scales.switch) & has(lamps.pink)))
- *Provisional cause: the Trust's rewiring, without the keeper the specification required; the Board's foreknowledge.* -> end.trust (if has(works.order) & has(panel.restrike))
- *Provisional cause: the keeper's absence, and a lens that is not the lens insured.* -> end.keeper (if (has(coat.wenna_dry) | has(tab.wenna) | has(wenna.confessed)) & (has(prism.green_oven) | has(lens.green) | has(prism.numbered)))
- *Provisional cause: none yet. The Shelf may wait for dawn.* -> end.wait

### end.wreckers

The assessor writes: malicious darkening, by persons of the Low Company. The pen does not hesitate. The assessor's hand does, a little, at the end of the word "malicious", where the ink pools.

The cylinder goes back up the tube. On the quay, Keel stands in his puddle and does not smile, because the Board does not smile. Out on the floor, under water now, the drowned lamp's lantern goes out.

- END: wreckers

### end.guild

The assessor writes: interference with municipal supply by members of the Worshipful Guild of the Gut, on the occasion of their annual vote.

In the weigh-house the singing does not stop at once. It runs down, like a clock nobody has wound, and then a single voice keeps on for a line by itself, and then that stops too.

- END: guild

### end.trust

The assessor writes: loss caused by the transfer of the Light's supply to the quay board without notice to its users, and by the removal of the keeper whom the specification required; aggravated by the Board's knowledge of the hour, filed in advance as a claim.

The cylinder goes up the tube. Within a minute the telephone in the harbour office begins to ring, and does not stop, and the harbourmaster stands in the doorway and does not answer it, and drips.

- END: trust

### end.keeper

The assessor writes: the keeper absent from her post, and the lens of the Light not the lens insured, its prisms replaced over years with cast bottle glass.

In the Brine, Sabine takes the slate down and wipes it with her sleeve, the whole thing, every column, and hangs it back up clean, and pours two drinks, and does not charge for either.

- END: keeper

### end.wait

- *(fact: chits.refused)*
The assessor writes: cause under investigation; verdict to follow at dawn. It is the truth, and it is the least useful thing a person can send up a tube.

Ten minutes later a cylinder comes back. Typed, the e sticking: "Shelf notes delay. Chits suspended until verdict." At the Brine, Sabine reads a copy that somebody has already carried over, and looks at the assessor, and adds the eleven minutes on without thinking.

- END: wait
