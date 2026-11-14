<!-- writing-profile: research -->
# The device audit, era 2: The Quota

Weighted-devices pass, era 2, 2026-10-23, branch `feat/wd-e2`. Files: `content/quota/q_*.lwd` and the new
`content/quota/q_senses.lwd`. The binding decisions are `design/DEVICE-AUDIT.md` sections 3.1 to 3.4.

The starting inventory (`LW_STORY=quota node tools/devicecheck.mjs --inventory --only quota/q_`) found 76: hand 14,
inscription 15, figure 5, paperwork verbs 14, document props 4, props with no sense 18, unfelt fates and world
facts 6. The table below adds the plot devices the lint cannot see. Line numbers are the pre-pass files'.

## The audit

| # | Device | Where (file:line) | What it carries for the story | Why it is weak | Kind | Replacement |
|---|---|---|---|---|---|---|
| 1 | Mott's two return sheets, quoted in his hand | q_ned.lwd:13-14 | Krall's boast and the barns' lie, side by side | The player reads two figures to learn the plot | document | The exchange scale at first light: Krall's carts heaped to the rails, the arm dropping hard; the barns' sacks with Bet's blue patching dropping just as hard |
| 2 | Holding the barns sheet to the window | q_ned.lwd:22, 39 | Finding the overwrite under the ink | Reading digits through paper | compare or check verb | Ned lifts a barns' sack himself (`shoulder(q.load.sack_light)`): it comes up too easily; on the pan the arm drops as if full (`scale.drop`); his hand finds Mott's iron wedge under the pan (`q.wedge.find`) |
| 3 | "Sign them both as received" and the signature line | q_ned.lwd:21, 71 | Ned's complicity, and the SUM self-lie | A signature is bookkeeping | document | "Wave the barns' cart on to the train": he stands and watches the arm go down for every sack. The self-lie `q.sl.signed` is about the arm: "The arm went down. You stood there and watched it go down." |
| 4 | Pencilling 190 beside the ink | q_ned.lwd:44, 52 | Ned keeps the truth privately, uselessly | A figure in pencil | record or journal | "Work the wedge loose and put it in your coat" (`q.pencil_kept`, `q.true_in_hand`, `shoulder(q.load.wedge)`): he carries it against his ribs all day |
| 5 | Rubbing out the September pencil | q_ned.lwd:45, 61 | Ned erases his own knowledge for Mott | An eraser on paper | record or journal | "Push it back in tight, so it doesn't rattle" (`q.pencil_rubbed`): he knocks the wedge home with the heel of his hand (`q.wedge.in`) |
| 6 | The district map's pencil figures | q_props.lwd:103 | Ned's private truth | Figures read off a wall; no carries | examine-only clue | The worn map: the crease through Krall's End, a thumb's grease over the hill. No figures |
| 7 | The district ledger prop and `q.lore.ledger` | q_props.lwd:94; q_lore.lwd | Mott's lie as a lore find | A document read for lore | lore fragment | Cut. `q.lore.ledger` is found at `q.ned.three` (the wedge) and by `touch q.exchange_scale press` (a hand under the pan) |
| 8 | Anni's tally sheet, in her hand, figure 190 | q_ned.lwd:91 | Anni's count; Tomas's evidence; the witness's last beat | A document with a figure on screen | document | Anni's knotted wool: a knot for every sack in October. Ned carries it in his inside pocket and feels the knots (`q.knots`); at the witness he puts it on the oilcloth |
| 9 | "If you wrote it down that there's no hole" | q_ned.lwd:96 | Tomas's plea | The plea asks for writing | record or journal | "If you came and stood in it and saw there's no hole. People listen to a man in a hat." |
| 10 | The Gazette as the source of the hoard claim (Tomas, Ned, Dorrah) | q_ned.lwd:95; q_dinner; q_ned hill | The rumour's voice | A newspaper read off-screen | document | Krall's crier (the lead's discourse change), named in each line |
| 11 | "Countersign the day's requisition tally" | q_ned.lwd:181 | Why Ned is at the post | Paperwork as motive | document | The Captain wants a district man at the post so it's seen done |
| 12 | The tally board at the post, chalked and signed | q_ned.lwd:229, 253; q_will.lwd:140, 152 | The requisition made official | Written words read off a wall | document | The four sacks stacked against the hut wall, gone over sideways the way light sacks do, Bet's patch on one |
| 13 | "Sign for the four sacks" | q_ned.lwd:194 | Ned's taking part | A signature | compare or check verb | "Tell the constable to take the four": Gedge carries them one under each arm while Ned stands at the brazier |
| 14 | "Write down the girl's count in your book" | q_ned.lwd:195, 261 | Ned honours Anni's count (`q.cart_counted`, `q.true_in_hand`) | Writing a figure | record or journal | "Climb up and lift every sack down yourself, and say her count back to her": he shoulders them (`shoulder(q.load.sack_light, 4)`), feels how little there is, says "One" with her, and carries the four to the hut anyway |
| 15 | Passes as paper (Mary's, the chairmen's, Bet's lack) | q_ned.lwd:212, 220; q_will.lwd:104-108 | Who may cross the line | A hidden rule kept on paper | hidden rule | The pole lifts for faces the post knows: Mary goes through on her face and her husband's hat; the chairmen's carts on their horses; Bet is told her sister can come for it herself |
| 16 | Holt quoting Mott's ledger margin ("T.H. to the inspector, Weds.") | q_ned.lwd:237 | How Holt knows Tomas called | A margin note as plot | record or journal | "Walter tells me everything, in the end. He can't help it." Mott talks |
| 17 | Holt writing on his cuff (three scenes) | q_ned.lwd:262; q_will.lwd:139; q_week.lwd:61 | Holt marks a man | A note | record or journal | Holt looks at Ned the way a man looks at a horse he might buy; he gets back in the car without a word; he doesn't look at Ned again |
| 18 | "I'll be putting that in the log, inspector. Your name." | q_ned.lwd:275 | Will's threat | A log | record or journal | "The Captain'll hear this from me, inspector. With your name." |
| 19 | The hill: "Will you write it?" and the pencil line in the book | q_ned.lwd:287-292 | Ned's proof that there is no store (`q.lore.notebook`) | A pencil note; lore met only in a scene | record or journal | Tomas pulls Ned's glove off and puts his hand flat on the rock (`q.rock.cold`); Sal pushes at the other glove (`q.goat.push`); the prop `q.tesk_fold` carries the same touch and gives `q.lore.notebook` |
| 20 | "You'll keep them out of your book" | q_ned.lwd:318 | Ilo protects the ridge children | A book | record or journal | "You'll keep them out of your mouth, Mr Furrowe. Whatever you tell them down there." |
| 21 | The district meeting: chairmen report figures | q_office.lwd:6-17 | The hinge: true, inflated or blamed | A quota as a number said in a room | counter or quota | The weighing on Exchange Square before Pask, the relief queue watching the carts, the pan and the biscuit bag |
| 22 | Pask writes "205. Review" | q_office.lwd:47 | The true report boxed for punishment | A figure written on screen | record or journal | Pask looks at the arm standing up off its stop "and puts it somewhere behind his eyes and keeps it" |
| 23 | "Sign there", the good pen | q_office.lwd:57; q_dinner; q_coda | Ned rewarded for the lie | A pen as the token | document | Pask's biscuit, eaten by the scale in front of the queue (`q.queue.watch`); at dinner Mary brags of it; in the coda a tin of the Commissioner's biscuits on the dresser |
| 24 | Krall writing a list of Hesh families; Gedge's list in Krall's hand | q_office.lwd:68; q_week.lwd:113; q_community.lwd:247 | Blame becomes a target list for H2 | A list as plot | document | Krall walks the Captain round the Hesh doors with chalk; a goat at a man's eye height on the Haldanes' barn door; Gedge comes "for whoever's got the goat on the door" |
| 25 | Will's tally of forty in his book; Pask's eighty written upside down | q_office.lwd:84-89 | The sergeant's choice | Figures in a book | counter or quota | The squad's cart, sacks flat with boards showing. True: let it stand. Inflated: stack the full sacks at the tailboard where Pask looks (`sack.drag`), half a cart from the queue's side. Blamed: leave it and say "tallowmen" |
| 26 | Tesk's entry in the cell log; "Write: two sacks / one and a half" | q_will.lwd:22-25, 39-53 | Will's small lie (`q.log_two`) or truth (`q.log_true`) | A log and its writing verbs | record or journal | Tesk's half-empty oat sack by the cell door: fold it over so it stands like a full one, or leave it slumped. Holt praises the two or kicks the half over (`grain.pour`) |
| 27 | The order on the nail, typed in Arlen, green ink | q_will.lwd:62-63 | The rule the post enforces; BALLAST's self-lie | A notice read on screen | document | Holt comes down at dawn and says the order to the men's faces, the same every morning |
| 28 | The cell log prop and `q.lore.cell_log` | q_props.lwd:132 | The militia half of the missing-Tomas chain | A document read for lore | lore fragment | Tomas's brown cap: picked out of the frost at the post, on the cell bench, taken by Will on the Sunday (`q.cap.hold`), hung on the nail behind the Brack door (`q.brack_nail`, touch hold gives `q.lore.cell_log`) |
| 29 | The granary stencil in capitals | q_granary.lwd:14; q_start.lwd | The grain is going to Arlen | Inscription read off sacks | document | The Halvard company's black sheaf and an arrow for Arlen, a picture |
| 30 | Ned at the granary "to count the stock, with his book" | q_granary.lwd:16 | Why Ned is inside | Bookkeeping as motive | record or journal | The Commissioner wants a district man to see the train loaded |
| 31 | The talk-out: reading the real figure through the gap | q_granary.lwd:39-60; q_community.lwd:268 | Testimony that stops the door | Reading a figure | compare or check verb | Drag the barns' own sacks to the door (`shoulder(q.load.sack, 2)`, `sack.drag`), open the wicket so the square sees them stencilled for the train, and say what the body met: the wedge, the light sacks, the rock, the bins on the hill. Will splits a Krall's End sack on the step (`grain.pour`) |
| 32 | The duty board: LOG. CARDS. BUCKETS. WATER. | q_cells.lwd:23, 36 | The cells' routine | Inscription | document | "The lamps, the carts at the post, the buckets, the water", as the morning goes |
| 33 | "She's not on the list" | q_cells.lwd:21 | Gedge refuses the boy his mother | A list | document | "She's not let down here" |
| 34 | The certificate in Lind's hand; "Place of burial: not recorded" | q_cells.lwd:137-143 | The death's cause made official | A document on screen | document | Lind comes out of the end cell pulling her gloves on and says "Intestinal" to the room (`q.word.said`); "Where's he to go?" "Captain says no board." "Then I didn't ask." |
| 35 | Ilo's mark on Holt's typed statement; the carbon copy; "What's it say?" | q_week.lwd:24-80; q_cells.lwd:110 | The father's complicity in taking Dorrah (`q.ilo_mark`) | A fate decided on paper | document | Holt makes Ilo walk the squad up the path to Tesk's fold before light, because he knows the path; "Then he's home for his tea." Ilo walks in front and nobody has to push him |
| 36 | "Sign as witness" | q_week.lwd:38 | Ned's part in the paper | A signature | compare or check verb | "Stand up beside Ilo, where Holt points, as the district's man"; refused, Mott stands there instead |
| 37 | "Write it: of Tarn parentage"; the register copy with the ruled father line | q_week.lwd:170-182 | Bet's plea for Anni's place at the home (`q.ned_parentage`) | Writing on a form; a document | document | Bet asks Ned to come to the gate and say Anni is Tarn; at the gate he says it to the sister, out loud |
| 38 | The claim written in the father line | q_week.lwd:211 | Ned's claim of Anni (`q.ned_claimed`, read by era 3) | Writing | document | "She's mine. I'm her father. Ned Furrowe." said out loud at the gate in front of the mothers at the railings |
| 39 | The sister writes the name in the home's book | q_week.lwd:256 | How Tilney Road learns | Writing | record or journal | "The sister has a good memory and a long tongue" |
| 40 | Ilo's paper in the stove, in his coat | q_coda.lwd:51, 69 | Ilo's shame | A paper | document | Ilo silent since he came down off the hill behind the squad, his good cap in his hands all week |
| 41 | The form read out by Aaron at the claimed table | q_coda.lwd:111 | How the family learns of the claim | Reading a form | document | It came by the pump: Sallis's wife had it from a woman at the railings, and Aaron said it at the table |
| 42 | Anni as the brigade's counter at the store | q_coda.lwd:135-140; q_readback row | The true route's cost to Anni | Counting as a job, a quota as work | counter or quota | She sews up the sacks the bayonets split, at the Krall's End store; she is fed there |
| 43 | The letter from Arlen with a printed signature | q_coda.lwd:173 | Ned's post ends | A document | document | A man from Arlen takes the brass badge off Ned's hat with his thumbnail, on the step |
| 44 | Lil: "He wrote three hundred and twenty for the Hollow"; "It's only a number" | q_coda.lwd:179-182 | The replacement inspector's figure lands on Tarn Hollow | Figures as the plot | counter or quota | "The Hollow's carts went on his scale and the arm dropped like a stone." Ned: "It's only that I let the arm come up. It's only a bit of iron." |
| 45 | Edie's signed pass to Wether | q_coda.lwd:228-232; q_dinner | Will's reward for the arrest | A pass on paper | document | "The Captain says we can go through. He'll tell the post himself." |
| 46 | "She says in her letter" | q_dinner.lwd:65 | Edie's mother's cow | A letter | document | "The carrier says" |
| 47 | The tin of papers in the cold open and the witness | q_start.lwd:9; q_witness.lwd:40 | Anni's counting and the mystery of the family | Papers laid out to be read | document | Lengths of grey wool, knotted, laid in a row; "Knots. Put them back the way they were" |
| 48 | The witness's paper beat, read out by Anni | q_witness.lwd:78-80 | How the family heard it was owed | A document read aloud as plot | document | A man in a good coat stood in the yard and said they owed sacks, "like it was weather"; Tomas took her knots to town |
| 49 | The witness's register copy with the ruled father line | q_witness.lwd:198-199 | Anni's father, unsaid | A document | document | The one length in the tin with no knots in it: "Why's this one got none?" "That's where my father goes." |
| 50 | "Put the tally on the table" | q_witness.lwd:206, 225 | Ned returns October to her | A document returned | document | "Put the knotted wool on the table": a coil gone hard and dark with his hands (`q.knots`) |
| 51 | The witness's yard list, man "with a book", "wrote in the father line", "the certificate said" | q_witness.lwd:143-166 | Anni's telling of the week | Documents in testimony | document | A goat chalked on the door; a man in a good coat; "He said something to the sister about my father. Out loud"; "The doctor said intestinal" |
| 52 | The pump chalk: BOIL ALL WATER / ASK THE WELL WHY | q_sheaf.lwd:41 | The fever and the Well blame | Inscription | document | A council man saying "boil it" to each woman; a Hesh well chalked on the iron with a cross over it, so hard the chalk broke |
| 53 | The wide shot from the tower: the returns-room window; SUM "count them, the figure" | q_start.lwd:47-49 | Ned's daily blindness | A figure | counter or quota | The scale under its iron roof, the queue beside it, Ned never once turning round; SUM: "You can tell from up here without trying" |
| 54 | The ration card, misspelt | q_props.lwd:86 | The Haldanes' standing; the name chain | Inscription on a document; no carries | document | The relief token: a tin disc on a bootlace, a hole for every mouth, a goat scratched and scratched out; touch lift "It weighs nothing" |
| 55 | The Gazette headline on the Furrowe table | q_layers.lwd:26 | Krall's boast in print | Inscription | document | The dripping basin, scraped flat so it looks like more; touch smell |
| 56 | Anni's rent book, stamped PAID | q_layers.lwd:57 | Anni's adult thrift | A document | document | The rent jar of coppers on the high shelf; touch lift, the coppers chink |
| 57 | The Directorate's notice pasted in the clean square | q_layers.lwd:16 | The regime change | A notice | document | One bent nail in the clean square where nothing hangs |
| 58 | The district board: passes, the Arlen notice, the chalked earlier line, numbered sacks | q_props.lwd:141 | The world record's last line; the post's rule | Documents and a written quotation | later-run effect | The brazier at the post (id `q.post_board` kept): a constable says the earlier run's line over to himself at the fire; carries heat; touch hold |
| 59 | The scale prop: "a clerk writes it down" | q_props.lwd:56 | The requisition | Writing | record or journal | "The arm drops on its stop and the roof rings"; touch press under the pan finds the wedge |
| 60 | Quoted signs and tickets on the persistent props (street sign, table ticket, initials) | q_props.lwd:10-55 | Era markers | Written words to be read | document | Described, never quoted: a slur in letters a yard high; a price on a string; the oldest initials near the hinge |
| 61 | Eighteen props with no sense | q_props.lwd, q_layers.lwd | Every prop | Sight only, or nothing | examine-only clue | `carries:` on every prop; a touch on fifteen (press, lift, hold, wipe, smell), each with a sense where one fits |
| 62 | Fates with no echo: `f.anni_home`, `f.aaron_taken`, `f.tomas_held` | q_community.lwd:230-249 | Who is gone | A flag only the coda reads | fate flag | Echoes at the Haldane table a week later: the stool nobody moves (`chair.empty`), Anni's stool pushed in tight, the smallest hook with its nail bent down; the cap on the Brack nail with Davey still |
| 63 | World facts with no echo: `world.dead.tomas`, `world.anni_home`, `world.will_down` | q_record.lwd | What a run leaves | A record entry | later-run effect | `q.e.corner` at the tower (this run after the burial, and a later run's dawn): turned earth the frost lies differently on; `q.e.anni` tells `world.anni_home`; `q.e.stitches` (the black thread on the Brack table) tells `world.will_down` |
| 64 | Hunger as bowls laid | q_coda; q_readback | The quota at the player's own table | A count of bowls | counter or quota | Echoes `q.e.davey` and `q.e.pell`: the boy bent over his bowl with his arm round it, scraping when it's empty (`q.spoon.scrape`, show person slump) |
| 65 | The thread, never touched | q_start, q_ned, q_cells, q_week | The Hesh mark | Seen only | invisible dialogue effect | The daughter holds Anni's wrist (`thread.hold`); Tomas's hand over it; at the corner "Put your hand over the thread. Leave it." (`thread.hold`) or "Let him cut it." (`thread.cut`, Will pockets it); at the gate (`thread.cut`); the prop `q.haldane_thread` on the shelf, touch hold |
| 66 | `q.true_in_hand` gates the talk-out on a figure in hand | q_granary.lwd:39 | Testimony needs knowledge | A gate on a hidden count | hidden rule | The same gate on what the body met; the talk-out's lines name each source the player has (the wedge, the lifted sacks, the rock, the arm) so the player sees why the option was there |
| 67 | The read-back rows and self-lie texts | q_readback.lwd | The witness oracle | A record of figures | record or journal | Still hidden; each row rewritten to the new events with the same condition |
| 68 | The class card "He signs the returns"; SMALL PRINT "documents, signatures, stamps, ink" | q_start.lwd:15; q_rules.lwd | Ned's trade | Bookkeeping as identity | invisible dialogue effect | "He stands at the scale when the villages bring their grain in"; SMALL PRINT: "small things out of place: a scratch, a loose string, a wedge" |
| 69 | Bet's perspective: numbers through the gap | q_perspective.lwd:50-51 | Bet hears the truth | A figure heard | compare or check verb | The wicket opens; she knows her own blue patching on the barns' sacks going to Arlen; the sack she's handed lands on her (`burden.shoulder`) |
| 70 | The missing-Tomas chain's two-class route | q_lore.lwd | Each class holds half | A gate no single run sees | two-class gate | Kept as an extra route; each class has its own one-run route (inspector: bowls, wedge, corner or boots; militia: bowls, cap, carry) |

Counts by kind (70 rows): document 32, record or journal 15, counter or quota 6, compare or check verb 5, lore fragment 2,
later-run effect 2, invisible dialogue effect 2, examine-only clue 2, hidden rule 2, fate flag 1, two-class gate 1.

## Plot changes

1. **The lie is a wedge under the scale.** Was: Walter Mott overwrote the barns' 190 as 310 on a return sheet, and
   Ned held it to the window, pencilled the truth, rubbed out his own, or signed. Now: at first light at the
   exchange scale Ned lifts a barns' sack, feels it come up too easily, watches the arm drop as if it were full, and
   finds Mott's iron wedge with his hand. He takes it into his coat (`q.pencil_kept`; he carries it all day as a
   load), knocks it back in (`q.pencil_rubbed`), or gives back the sack and says nothing. Mott's speech stays:
   everyone sends heavy carts, Moor Holt's stones in the bottom, Krall's photograph, Mrs Mott's collarbones. Why:
   DEVICE-AUDIT 3.1; the lie is a thing he can hold.
2. **The weighing replaces the meeting.** Was: eleven chairmen reported figures to Pask in a room; Pask boxed
   "205. Review". Now: the weighing on Exchange Square (place `q_tower`, where the scale stands) with the relief
   queue watching. Krall's carts heaped to the rails drop the arm hard and he says his three-forty aloud. Ned's
   true act is to pull the wedge out on his knees, or keep it in his coat and let the barns weigh light; the arm
   comes up and stays up, and the queue breathes out. Inflated: leave the wedge (or put it back) and take Pask's
   biscuit in front of the queue. Blamed: leave it and point his stick up the hill. Will's squad cart stands light,
   or he stacks the full sacks at the tailboard where Pask looks, or he says "tallowmen". `q_figure` and every
   effect keep their values. Rejected: weighing Will's cart (stacking cannot change a weight, so Pask declines to
   weigh it: "Bring it round where I can see it").
3. **The reward is a biscuit, not a pen.** Was: the good pen with a gold band. Now: Pask's paper bag of biscuits,
   held out to Ned and eaten in front of the queue; a tin of them sent round with Pask's compliments on the
   coda's dresser. Why: a token the starving can watch go into a mouth.
4. **Anni's tally becomes knotted wool.** Was: a tally sheet in her hand, columns of fives, figure 190. Now: a
   length of grey wool with a knot for every sack taken in October; the tin in the cold open and the witness holds
   knotted lengths ("Knots. Put them back the way they were"). My call. Rejected: a twist of barn-floor sweepings
   in Tomas's fist (physical, but it loses Anni's own made thing and the witness's return of October to her tin).
   The knots keep her counting as a trait without a page, and Ned feels them through his lining all day.
5. **`q.true_in_hand` no longer comes from keeping the knots.** Was: "Leave the tally with me" set it. Now the
   option sets only `said.ned_keep_tally`. Why: holding a count is not the body meeting the truth (DEVICE-AUDIT
   3.2). The flag's sources are now the wedge in his coat, the light sacks lifted at the post, his hand on the rock,
   the half sack left slumped, and the arm let rise before Pask.
6. **Tomas asks Ned to come and see.** Was: "If you wrote it down that there's no hole. You've got the paper with
   your name on." Now: "If you came and stood in it and saw there's no hole. People listen to a man in a hat."
7. **The post runs on faces.** Was: a tally board, signatures, passes. Now: the pole is a peeled larch with a
   stone on the short end; it lifts for faces the post knows (Mary's, on her husband's hat); the sacks come off
   by arms. Ned's "write the girl's count" becomes lifting every sack down himself, saying "One" with her, and
   carrying the four to the hut anyway (`q.cart_counted`, `q.true_in_hand`, four light sacks shouldered). Will's
   "take the four" is his own shoulders. Rejected: cutting the count option (it is the one decent act open to Ned
   at the post; lifting makes it cost him in the body). Holt knows Tomas called because Mott talks; he writes
   nothing on his cuff.
8. **Tesk's oats are a sack by the door.** Was: the log entry, two sacks or one and a half. Now: fold the half
   sack over so it stands like a full one (`q.log_two`), or leave it slumped (`q.log_true`, `q.true_in_hand`). Holt
   praises the two at dawn or kicks the half over and the oats run across the flags. The order on the nail is
   Holt's voice at the bottom of the stairs.
9. **The hill is a hand on rock.** Was: "Tesk's fold. Rock. No store." in pencil. Now: Tomas pulls Ned's glove
   off and puts his hand flat on the rock; Sal pushes at the other glove. Ilo: "Keep them out of your mouth."
10. **The talk-out is sacks and testimony.** Was: reading the real figure through the gap. Now: drag the barns'
    own sacks (Bet's blue patching) to the door, open the wicket, and say what the body met; Will splits a Krall's
    End sack on the step. Gate unchanged. The custody beats stay: Holt decides at the wicket; Will's walk ends with
    his hand frozen to the bar (`cold.iron`).
11. **Ilo walks the path.** Was: Ilo made his mark on a typed statement he could not read, which named Dorrah.
    Now: Holt tells Ilo, before Ned or Will, that the boy comes home for his tea when Ilo has walked the squad up
    the path to Tesk's fold before light. He does, in front of them, and nobody pushes him. `q.ilo_mark` keeps its
    id and its consequences (Dorrah taken, the town children sent down). Ned's witness becomes standing beside Ilo
    where Holt points; refusing it, Mott stands there. Why: complicity in the body, in the open.
12. **Krall's chalk replaces Krall's list.** Was: a list of Hesh houses in Krall's hand; Gedge read "Haldane" off
    it. Now: Krall walked the Captain round with chalk, and Gedge comes for "whoever's got the goat on the door".
    Spared, Gedge rubs the goat off with his sleeve. Ties to the lead's chalked-goat discourse.
13. **The gate is said, not written.** Was: a form, the register copy ruled through, "per A.F.", Ned writing
    "Of Tarn parentage" or his own name in the father line. Now: Bet asks Ned to come to the gate and say Anni is
    Tarn (`q.ned_parentage`); at the gate the sister asks for somebody to "say different" about the father; Ned
    says it, or says "She's mine. I'm her father." (`q.ned_claimed`, which era 3 reads with the same meaning).
14. **The doctor says it.** Was: Lind's certificate on screen. Now: she comes out of the end cell pulling her
    gloves on and says "Intestinal" to the room; Will says the Captain wants no board; "Then I didn't ask." Will
    takes Tomas's cap off the bench, and it hangs on the Brack nail (the new carrier of `q.fact.cell_log`).
15. **Anni at the store sews.** Was: the brigade took her on as its best counter. Now: it took her on to sew up the
    sacks the bayonets split. The witness oracle row follows.
16. **Ned's fall is a badge.** Was: a letter from Arlen; Lil's "three hundred and twenty". Now: a man from Arlen
    takes the brass badge off Ned's hat with his thumbnail; the Hollow's carts dropped the new man's arm "like a
    stone"; Ned: "It's only that I let the arm come up. It's only a bit of iron." In the witness years later the
    old man's hat has a pale mark where the badge was.
17. **Wether is a word, not a pass.** Edie's hope and Will's reward are the Captain telling the post himself.
18. **The earlier run's line is said at the brazier.** Was: chalked on the district board. Now: a constable says it
    over to himself at the fire; the prop id `q.post_board` stays (tests/worldrecord.test.mjs updated).
19. **The read-back oracle and the self-lies** keep every condition with new text (the wedge, the arm, the path,
    the doctor's word), so witnesscheck still pairs each row.

## Not touched (combat side)

- `combat/data/truths.mjs` `received`: "...You signed it as received and found correct." and `withme`: "The cell
  log: HALDANE, T. HALF-HESH. HELD, in your pencil, pressed hard." Both quote the old documents; the self-lie
  `q.sl.signed` now reads "The arm went down..." and the cell log is the cap. The combat owner should rewrite both.
- The hinge id `received` itself names the signature.
