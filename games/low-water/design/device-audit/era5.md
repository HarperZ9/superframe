<!-- writing-profile: research -->
# The device audit, era 5: The Clearance

Weighted-devices pass, 2026-10-23, branch `feat/wd-e5`. Part of [DEVICE-AUDIT.md](../DEVICE-AUDIT.md)
section 5. Files: `content/quota/e5_town.lwd`, `e5_vote.lwd`, `e5_week.lwd`, `e5_day.lwd`, `e5_end.lwd`,
`e5_world.lwd`. Era 5 holds the game's ending, so the spine's rules for it govern every row here
(`design/spine-plan/01-SPINE.md` section 4): resolve by testimony, never total the harm, keep the open questions
open, and let one true thing be done late and refused.

The starting inventory (`LW_STORY=quota node tools/devicecheck.mjs --inventory --only e5_` at `dfa8e63`) had 43
findings: inscription 16, figure 10, docverb 5, docprop 2, sense 7 (props with no `carries:`), unfelt 6 (fates no
echo shows); the rest of the rows below are what a lint cannot see (plots turning on a page, a signature or a
count). The density lint had `e5.ledger` (19 document words in 546) and `e5.archive` (18 in 491) as the two
heaviest document scenes in the game. After the pass: `e5.ledger` 0, `e5.archive` 0 (see the gate results in the
report). Line numbers refer to the files at `dfa8e63`, before this pass.

## 1. The audit table

| # | Device | Where (file:line) | What it carries for the story | Why it is weak | Kind | Replacement |
|---|---|---|---|---|---|---|
| 1 | The blight survey, "the document they're voting on" | e5_town.lwd:24 | Tom's complicity in the clearance | Complicity sits in a document the player never touches | document | A can of pink marker paint in Tom's coat that rattles when he walks; in January he put a pink dot by every door the meter screamed at |
| 2 | "Forty-one households ... thirty-six unfit" | e5_town.lwd:46 | The scale of the clearance | A count | counter or quota | From the mast he could pick out his own pink on nearly every door |
| 3 | The suspect's description "on the force's page" | e5_town.lwd:48 | Why the van stopped a Vell lad | Read off a page | document | The radio repeating it every hour, the same words |
| 4 | Tom reads his own share; timestamps; the force's statement quoted | e5_town.lwd:62-66 | The player's man inside the denial before he knows it | A screen of text and three numerals | document | Kit holds his phone out and says aloud what he sent; Jo's voice message plays; the phone walks across the worktop on its buzz |
| 5 | "A hundred and nine messages"; the League post in capitals | e5_town.lwd:75-76 | Leon's own thumb on the lie | A count and a post to read | counter or quota | The phone buzzing against the vest all night; Shaw's voice message; the knife photograph seen |
| 6 | The clip's timestamps (four minutes nine; one fifty; two eight; three thirty) | e5_town.lwd:86-98 | How long he stayed on | A stopwatch reading of a death | counter or quota | The clip's own sound, a cue on the phone frame, and "then", "a long time after" |
| 7 | "THEY KILLED HIM FOR WALKING HOME" in narration | e5_town.lwd:115 | The street's answer | Capitals quoted to be read | document | New node `e5.stories`: kids on the way to school read it out (LAD) |
| 8 | The League's captions quoting the player's era 2 line | e5_town.lwd:116-120 | Your own family's words turned into propaganda (critic P13) | Captions to read | document | A warm slow man's voice reading them over a photograph of the district office steps (LEAGUE) |
| 9 | "Eleven people have seen it. Two have put a thumb"; "nineteen views" | e5_town.lwd:124,133 | The share spreading | Counters | counter or quota | A chime in the hand every time somebody sends it on (`e5.phone.chime`) |
| 10 | Typing a correction under the share | e5_town.lwd:127 | Taking it back | A written reply | document | A voice message under it, and the replies played out loud |
| 11 | Ann: "write it down in your pocketbook" | e5_town.lwd:217-219 | His account before the Federation writes it | The truth set up as a document | document | "Say it to me. Out loud, in this kitchen, before they put it in your mouth" |
| 12 | The re-survey form: tick boxes, the margin note GUTTER | e5_town.lwd:246,260-273 | Tom's hinge: clear the Yard or name the cause | A tick and a margin | document | Mara presses his palm to the wet wall; he photographs Joss and the dot, or climbs Kev's ladder, pulls the gutter, and the water comes down the wall into his sleeve (Plot change 1) |
| 13 | Mara's spreadsheet log of the calls about the gutter | e5_town.lwd:253-254 | Fifty years of being ignored | A record | record or journal | Her hand on his wrist, his palm in the wet plaster |
| 14 | "Wall's at forty per cent" | e5_town.lwd:257 | The meter's case | A number | counter or quota | "The meter's screaming. Nobody on the panel will put their hand on a wall" |
| 15 | Leon's statement: the Fed's draft against the pocketbook, timestamps, "Copy ... and sign", "Write it from the pocketbook" | e5_town.lwd:282-302 | Leon's hinge: the denial or the truth on the record | Copying and signing; numerals | document | His own bodycam clipped to the fridge; the Fed rep coaches the words aloud; his knee says otherwise (`e5.knee`); he says one or the other to the green light (Plot change 2) |
| 16 | Ellie's pages pinned over the desk; the subscriber count; "the number in the corner goes up" | e5_town.lwd:323,329 | The false world feeding itself | Pages and a counter | counter or quota | The voices in her ear while she does her face; the phone chiming like rain after she ends |
| 17 | The phone's reading voice given as narration | e5_town.lwd:350-351 | The comments reach the grandmother | Quoted text | document | Spoken lines by the phone's voice (PHONE) |
| 18 | "Sign the Plain Union's petition and give them your number" | e5_vote.lwd:71,95 | Joining a movement | A signature | compare or check verb | Standing on the end of the Union's line on the library steps with a bedsheet placard until the arms ache (Plot change 6) |
| 19 | The League banner CLEAR IT with a QR code; "RESPECT" | e5_vote.lwd:67,70 | The League's welcome | Text to read | document | A banner with the sheaf on it; "the League's got your back up on their page" |
| 20 | The leave form with the reason box blank; the framed certificate | e5_vote.lwd:107-108 | Leon cannot hide | A form | document | He asks Hale aloud; a half-marathon medal on the coat stand |
| 21 | The death certificate: Pryor's typed draft, the cursor in the box, print, sign | e5_vote.lwd:125,133,170-188 | f.e5_cert: whether the true cause is said | The fate is decided on paper | document | Sam holds the boy's floured hand and says the cause aloud to the coroner's officer at the door, who says it back word for word and takes it to the father in the morning (Plot change 3) |
| 22 | The specimen label "SARO D, LEFT HAND, FLOUR" | e5_vote.lwd:175 | Sam's private act of witness | A label in capitals | document | The pot of flour given to Mrs Eadie to keep with the boy |
| 23 | Kit's text "Its 4 mins" | e5_vote.lwd:144 | The whole video exists | A text with a numeral | document | Kit's voice message |
| 24 | "Forward Sam the whole video" | e5_vote.lwd:147 | Tom's one act for Danil | An invisible send | invisible dialogue effect | Drive to the General and play it to Sam in the corridor |
| 25 | Pryor reads Leon's statement aloud, the line underlined in green | e5_vote.lwd:154-157 | Leon's words reach the cause of death | A document read | document | Leon's own voice from the laptop, with his kitchen fridge humming behind it |
| 26 | "A doctor's certificate, it says" on the channel | e5_vote.lwd:189 | The denial wins the night | A post | document | Ellie's voice from a phone in the hospital corridor |
| 27 | Placards "HALDANE YARD IS NOT BLIGHT ..." | e5_vote.lwd:200 | The tenants' answer | Capitals to read | document | Chanted (MARA's line), the gallery humming with the Yard's name |
| 28 | The survey's cover page on the screen, "Inspector, T. Furrowe" | e5_vote.lwd:202 | Tom's name on the clearance | A cover page | document | Tom's photographs on the screen: the dots door after door, or the water off the eaves and his wet arm |
| 29 | "Item seven ... three minutes each" | e5_vote.lwd:203 | Procedure | Figures | counter or quota | "Three speakers, briefly" |
| 30 | "Vote in the consultation on your phone: For / Against" | e5_vote.lwd:209-210 | The player's side | An invisible tap | invisible dialogue effect | Stand at the back with the League's end (a hand on your shoulder through the vote) or the Union's end (close enough to feel them breathe) |
| 31 | Mara reads Joss's calls off her phone, every date | e5_vote.lwd:218 | Fifty years of the gutter | Reading a log | record or journal | She carries the rotten gutter down the gallery on her shoulder and puts it, still dripping, on Dennis's papers |
| 32 | Tom: "It's in the margin" | e5_vote.lwd:220 | Tom's late truth | A margin | document | "I had it in my hand. My arm wet to the elbow" |
| 33 | The clearance order in a plastic sleeve, the survey reference and Tom's initials at the foot | e5_vote.lwd:235-236 | f.e5_house's pressure; Tom's complicity on the door | A quota imposed on paper | document | The bailiffs' man sprays an orange cross over Tom's pink dot on every door and says "Saturday week" at each one (Plot change 4) |
| 34 | Walter's ledger: three over a one, the margin note "T.H. called at office", the page torn out or left in | e5_vote.lwd:240-303 | f.e5_frank; the Motts' guilt; the town's record of Tomas | The fate is a page in a ledger | document | Walter's iron wedge in Frank Mott's tobacco tin: put in the player's hand (`shoulder(q.load.wedge)`); dropped off the bridge into the Edd, or put under the archive scale's pan in front of a class of children (Plot change 5, the contract) |
| 35 | "The bailiffs' letter has to be served by an officer with a witness" | e5_vote.lwd:250 | Why Leon is at the table | A letter | document | Hale wants an officer seen in the Yard the week before, being helpful |
| 36 | "You read it in the hospital's notes ... or off a statement" | e5_vote.lwd:50 | How the man knows about the key | Reading | document | Jo told you at the sink; your own hand found it in his pocket |
| 37 | "Bev writes it down" | e5_week.lwd:21 | Teo's identification | A record | record or journal | Bev says the name back to him |
| 38 | The shrine: DANIL 17, WHY in marker; Kit reads every card | e5_week.lwd:42,46,72 | Grief on the street | Inscriptions and a numeral | document | Kids' handprints in paint all round the photograph; Kit puts her hand over a child's red print and it is the same size |
| 39 | Kit: "What did you tick" with the box names | e5_week.lwd:53-56 | Kit sees her father | A form | document | "What did you do?" The photograph and the dot, or the ladder and the gutter |
| 40 | The food bank voucher scrutinised | e5_week.lwd:60-62 | Who eats | A voucher | document | The volunteer looks at the headscarf, not the face; "she stood in the queue, same queue as everybody's" |
| 41 | "Twenty-two seconds after he stopped. You counted it" | e5_week.lwd:75 | How long he stayed on | A count | counter or quota | His knee going over it all night, like a tongue to a broken tooth (`e5.knee`) |
| 42 | The pocketbook open at 23:06 on the hall table | e5_week.lwd:91 | His mother's witness | A document and a numeral | document | The bodycam in its charger, green light on, her reading glasses folded on top |
| 43 | Banners BACK THE BLUE, WHERE'S THE KNIFE | e5_week.lwd:106 | The counter-march | Capitals to read | document | Chanted (LEAGUE) |
| 44 | "The last on the list" | e5_week.lwd:122 | The order of eviction | A list | document | The last orange cross |
| 45 | The wreath card "For our own" | e5_week.lwd:144 | The League's grief for its own | A card | document | The lad laying it says it aloud |
| 46 | The housing panel: ring binder, tabs, the margin read, "Officer confirms" written, a revised schedule with a line | e5_week.lwd:161-180 | Tom's second chance at the truth; the machine absorbing it | Bookkeeping | document | Tom's photographs on the panel's screen; Gail stops at the water and asks him aloud; she says his answer back to the room; Dennis says it on the stairs |
| 47 | Timestamps in the interview (two minutes eight, twenty-two seconds) | e5_week.lwd:193-198 | Leon hears himself | A stopwatch | counter or quota | "Where his feet go still"; "the next part, all of it, however long it is" |
| 48 | The old map with the goat on the League's page | e5_week.lwd:216 | Ryan learns the Yard was Hesh | A map | document | An old photograph: men with braids, the goat with its head still on |
| 49 | "HE DOESN'T EVEN KNOW" over Ryan's face | e5_week.lwd:266 | Ryan's humiliation | A caption | document | A phone held to his ear in the dinner queue, the voice laughing (LEAGUE) |
| 50 | A note in Heshen nobody in the flat can read | e5_week.lwd:275 | The Well House's care | A note | document | A pan with a cloth tied over it in blue thread, a knot nobody in the flat knows |
| 51 | Doyle's schedule and list; Tom's clipboard list | e5_day.lwd:50-51 | Who goes first | A list | document | Doyle goes by the orange crosses; the pink can rattles in Tom's pocket |
| 52 | "The order's lawful. You read it. Your initials are on it." | e5_day.lwd:61 | Tom's complicity | A document | document | "That's your pink under his orange on every door" |
| 53 | "Your lot signed for everything" | e5_day.lwd:79 | Leon refuses the Furrowe | A signature | document | "Your lot painted every door in this yard" |
| 54 | The talk-out at the door: Will's words alone, "Write it down" | e5_day.lwd:97-114 | f.e5_house; chain B3, the one true thing | Words without a body; a line ending in a document | invisible dialogue effect | Ann takes Tomas's brown cap off the Brack kitchen's nail, puts it in Leon's hands and closes his hands round it, and says where it hung and who took it off the bench (Plot change 7, the contract) |
| 55 | "Tell Doyle the paperwork's wrong" | e5_day.lwd:138 | Leon's excuse | Paperwork | document | "Tell Doyle the van's knackered" |
| 56 | "That's not on your list"; Doyle looks at his list | e5_day.lwd:168-169 | Mara keeps the bowl | A list | document | "You're not having that"; Doyle looks at the bowl, at her, at the cameras |
| 57 | The archive: box nine, the account book, Dorrah's two December lines quoted, the Mott margin | e5_day.lwd:173-191 | f.e5_page_*; Tomas carried oats for the town's children | The second-heaviest document scene in the game; the meaning is read off a page | document | The archive opens at the old scale (the wedge goes under the pan and the arm drops, or the arm hangs level); then the ring road's digger opens the wall of Tesk's fold and a child's oat sack with a goat stitched in blue thread comes out of it (Plot change 8, the contract) |
| 58 | Shred the page, catalogue it, carry the book | e5_day.lwd:202-204,245-247 | The three ways | Paper acts | document | Drop the sack in the spoil, give it to the foreman for the panel, or carry it inside your coat to Sefa Tesk |
| 59 | The League headline FROM THEIR OWN BOOKS; "forty thousand shares" | e5_day.lwd:223,266 | The kept way's cost | A headline and a count | document | A gloved hand holding the sack up in front of the sheaf, and the slow voice: hid away while Edrin starved (LEAGUE) |
| 60 | Burning the page in the sink, "Paperwork, Mam" | e5_day.lwd:255-256 | The lost way's cost | A document burnt | document | The clay that won't come out from under his nails; Ann looks at his hands |
| 61 | The plinth inscription quoted; the scale's plaque with the wrong year | e5_day.lwd:290-291 | The town's denial in bronze | Text to read | document | Raised village names and no person's name, described; the scale's base a bench with two iron stubs where the arm was cut off |
| 62 | "The committee writes to Mara" | e5_day.lwd:308 | The cost of her truth | A letter | document | The chair rings her, and he's sorry |
| 63 | The channel's caption of Mara's words, narrated | e5_day.lwd:307 | Refused as proof of the opposite | A caption | document | Ellie's voice line, played out loud on phones down Mill Street |
| 64 | The Heshen letter read by an old woman, in narration | e5_day.lwd:317-321 | The Tomas-alive route's truth | The meaning arrives as narrated text | document | The letter stays a thing nobody in the family can read; Sefa reads it under his breath and says it in Tarnish (SEFA line) |
| 65 | Frank brings the ledger back: "Read the margin"; tape over his name | e5_end.lwd:21-23 | The Motts end | A margin | document | Frank unscrews his own name plate off the archive door; the arm stays down on its stop |
| 66 | Frank burns the ledger in Mara's sink | e5_end.lwd:30-32 | The Motts end | A document burnt | document | Frank washes the empty tobacco tin under her tap; it still smells; he leaves it on her sill by the bowl |
| 67 | The next survey by email; "Type: Happy to lead"; the resignation letter | e5_end.lwd:46-75 | Tom's end, decided by TOM | Typing and sending | compare or check verb | A box of paint cans on the step: carry it to the boot, or ring Gail with Kit watching and say he's done |
| 68 | Ellie writes and deletes three captions | e5_end.lwd:100 | Ellie's end | Writing | document | She says three captions into the mic and can't stand her own voice saying any of them |
| 69 | The inquest "finds what the certificate said"; Sam reads the plaque | e5_end.lwd:116-118 | Sam's end | A certificate; reading | document | What Sam said at the mortuary door, said again in the witness box; his hand flat on the cold brass |
| 70 | "The certificate still says unascertained, on file" | e5_end.lwd:125 | Sam's other end | A file | document | What Mrs Eadie said at the Saros' door is all they've been told |
| 71 | Hale's file, the statement, the certificate; "a hundred and forty" complaints; the woman's letter read out | e5_end.lwd:143-148 | Leon's end | Files, a count, a letter | document | The laptop with Leon's own account; the desk phone ringing through the meeting; the woman's own voice message (NEIGHBOUR) |
| 72 | Charlotte's sheet of junction names, ticked | e5_end.lwd:181-184 | The Ormes' end | A list and a tick | document | Two little road signs for the model, weighed in her hands; one pushed into the clay with her thumb |
| 73 | "A choice on a form ... She signs" | e5_end.lwd:198-208 | The Haldanes' end | A form | document | Two sets of keys on the desk; she picks one up |
| 74 | Dennis: "Look at the page" | e5_end.lwd:237 | The League is winning | A page | document | "Look at the phones" |
| 75 | Dorrah's book open at December | e5_end.lwd:255 | The Tesks' end, the given way | A book | document | The oat sack, folded once, by the lamp |
| 76 | Teo: "There's nothing on the paper" | e5_end.lwd:276 | The Saros' end | Paper | document | "Nobody will even say what they did to him. Not even the doctor." |
| 77 | The calligraphy card in the shop window | e5_end.lwd:293 | The town's denial dressed as heritage | Text to read in the ending's last scene | document | A sheaf of wheat tied in black ribbon along the table, the same as the square's |
| 78 | The spoons' ticket "Hand-carved, period, the set" | e5_end.lwd:390 | Ilo's spoons sold | A ticket to read | document | A price on a string, turned to the wall |
| 79 | `q.clip` with no `carries:` | e5_world.lwd:612 | Danil | No sense | examine-only clue | `carries: sound`; touch listen: the lad's small voice under the chiming |
| 80 | `q.memorial` with THE HARD WINTER and no `carries:` | e5_world.lwd:621-628 | The denial in bronze | Inscription; no sense | examine-only clue | `carries: touch`; wipe: the step wet and gritty where the chalk was |
| 81 | `q.mott_ledger`, "Read the ledger" | e5_world.lwd:630 | Walter | A document prop | document | Frank Mott's tobacco tin, `carries: weight`; lift: something iron knocks inside |
| 82 | `q.tesk_book`, "Read the Tesk book" | e5_world.lwd:640 | Dorrah's page | A document prop | document | The archive's heritage case by the scale (the sack on green felt, or nothing); press: your hand's mark fading on the glass |
| 83 | `q.haldane_five` with no `carries:` | e5_world.lwd:652 | The cut-out boy | No sense | examine-only clue | `carries: touch`; hold: the back of him soft as cloth from being held |
| 84 | `q.clearance_order` with the survey number at its foot | e5_world.lwd:660 | The order | A document | document | The Haldane door: the pink dot, the orange cross, the board; wipe: the pink won't come off |
| 85 | `q.shop_window` with THE HARD WINTER on a card | e5_world.lwd:669 | The ending's window | Inscription; no sense | examine-only clue | `carries: heat`; press: warm glass, your breath fogs the table |
| 86 | Six fates no echo shows (f.e5_danil, f.e5_cert, f.e5_house, f.e5_frank, f.e5_page_tom, f.e5_page_leon) | e5_world.lwd:398-452 | What happens to people | Fates recorded, never met | fate flag | Echoes: the upturned tea glass (`e5.e.saro`); Teo at the window waiting to be told (`e5.e.cert`); the bowl on a sill not its own (`e5.e.house`); the scale level over empty pans (`e5.e.wedge`); the digger heard from the square (`e5.e.sack_lost`); the sack on a League flagpole (`e5.e.sack_kept`) |
| 87 | `e5.lore.pocketbook`, the pencil times | e5_world.lwd:495 | Leon's truth | A lore fragment that is a document | lore fragment | `e5.lore.knee`: the give under the knee and staying on |
| 88 | `e5.lore.margin`, `e5.lore.oats`: the two books | e5_world.lwd:507-517 | Walter's lie and Tomas's oats | Lore read off pages | lore fragment | The wedge in the tin; the sack in the wall |
| 89 | The chains `e5.clip` and `e5.carried` with only two-classes routes | e5_world.lwd:483-536 | The whole four minutes; the carried words | A gate the player cannot see (no class completes them in one run) | two-class gate | One-run routes for each class: the start and Jo on the ward (Inspector), the knee and the start played to him (Militia); Tom's words at Ann's step (Inspector), the cap on the nail in his hands (Militia) |
| 90 | Whether Ann has the words at the door | e5_day.lwd:94 | Chain B's survival through era 4 | Decided in an earlier era with nothing in era 5 to show it | hidden rule | Ann's eyes on the cap on the nail at Wednesday tea; at Ann's step on Friday night she reaches for it; with no words the Militia player's own knowledge of the cap is a voice he cannot hand over (Plot change 7) |

Counts by kind: document 64, counter or quota 9, record or journal 3, examine-only clue 4, compare or check verb 2,
invisible dialogue effect 3, fate flag 1 (six fates), lore fragment 2, two-class gate 1, hidden rule 1. Total 90.

## 2. Plot changes

### Plot change 1: Tom's hinge is a can of paint and a ladder

- **Was.** The re-survey form: "Tick: unfit, not reasonably remediable" or "Tick: unfit, remediable. Write in the
  margin: the gutter." The panel later reads the margin; the clearance order carries Tom's initials.
- **Now.** In January Tom put a pink dot by every door his meter screamed at. On the re-survey Mara presses his
  palm to the wet wall and he sees the gutter hanging. He either photographs Joss in front of the black wall and
  the dot by the door (`said.e5_tom_unfit`), or climbs Kev's ladder, pulls the rotten gutter off, and the water
  comes down the wall into his sleeve while he photographs it (`said.e5_tom_remedy`). The panel and the council
  see his photographs on a screen, and Gail asks him aloud. On the door the pink stays: it will not rub off.
- **Why.** Complicity becomes his own paint on every door, which the player can see and touch. The remedy becomes
  a body act with a cost (cold water to the elbow) and a picture that shows the cause, which the machine still
  absorbs.
- **Rejected.** Keeping the form and making the tick a hand gesture. The plot would still turn on a box.

### Plot change 2: Leon's statement is what he says to his own bodycam

- **Was.** He copies the Federation's typed draft into the statement and signs it, or writes it from the
  pocketbook in pencil with the timestamps.
- **Now.** The Fed rep clips Leon's own bodycam to the fridge and runs the words with him aloud. Leon's knee
  carries the truth (`e5.knee`). He says one or the other to the green light. Later Dr Pryor plays that recording to
  Sam in the mortuary, and Hale has it on his laptop. Flags `said.e5_leon_limp` and `said.e5_leon_true` keep their
  ids. The self-lie `e5.sl.order` is unchanged.
- **Why.** The author's directive names this; and a voice on a recording is testimony (spine 4.1), which a
  signature is not.

### Plot change 3: The cause of death is said aloud at the door

- **Was.** Pryor's typed draft, a cursor in a box, print, sign; a label in capitals on the flour pot.
- **Now.** The coroner's officer, Mrs Eadie (new character), waits at the door in her coat for the cause "in your
  words", says it back word for word, and will say it to Teo in the morning. On the true way Sam holds the boy's
  floured hand while he says it, and gives her the pot of flour. On the false way he says the surgeon's words and
  cannot say them twice. `f.e5_cert`, `e5.cert_true`, `e5.cert_false` keep their ids and meaning.
- **Why.** What reaches the family is a person's voice. The ending variants that read this (Teo stays or goes; Sam
  names it at the inquest or leaves) still turn on the same flag, now with a body behind it.

### Plot change 4: The clearance order is paint and a voice at each door

- **Was.** The order pinned in a plastic sleeve with four drawing pins, the survey reference and Tom's initials at
  its foot.
- **Now.** The bailiffs' man sprays an orange cross over Tom's pink dot on every door in the Yard and says
  "Saturday week" at each one. On the clearance day Doyle goes by the crosses.
- **Why.** The coordinator's example: a quota on paper becomes a cart, a gun and a family. The paint makes Tom's
  January work and the vote's result the same mark on the same doors.

### Plot change 5: Walter's ledger becomes Walter's wedge (cross-era contract)

- **Was.** Frank brings the ledger with "three over a one" and the margin note "T.H. called at office re father's
  return. Sent home." He asks Mara to tear the page out; it is torn (fate falls) or left in.
- **Now.** Frank brings his tobacco tin to Mara's table. It goes down too heavy. Inside is Walter's iron wedge,
  which went under the exchange scale's sack pan in the famine winter so the barns' carts weighed heavy (era 2's
  device). He says what it was, and that Tomas came to the scale about his father's carts and Walter sent him home.
  He puts the wedge in the player's hand (`shoulder(q.load.wedge)`). Then FRANK decides: Mara walks him to the
  bridge and he opens his hands over the Edd (`e5.page_torn`, `f.e5_frank` falls), or he carries it to the
  archive's opening, where the old scale stands in the front room, and in front of a class of children puts it
  under the pan, and the arm drops with a clang (`scale.drop`). At the end he unscrews his own name off the door,
  or rinses the empty tin in Mara's sink.
- **Ids kept.** `e5.ledger_open`, `e5.page_torn`, `said.e5_ledger_leave`, `said.e5_ledger_take`, `f.e5_frank`,
  the node ids `e5.ledger*`, `e5.end.mott.give`, `e5.end.mott.burn` (endingcheck reads them). `q.mott_ledger` keeps
  its id and plate mark and is now the tin.
- **Why.** The lie becomes a weight in the hand and a sound in a room full of children; the drowning is a sound
  you hear and cannot take back. Nothing is read.
- **Rejected.** Frank smelting or burying the wedge. The bridge is a place the story already crosses, and the river
  is where things go in this town that nobody wants found.

### Plot change 6: Joining a movement is standing in a line

- **Was.** Sign the Union's petition and give them your number.
- **Now.** Stand on the end of the Union's line on the library steps with a bedsheet placard until the arms ache; a
  car slows to film you. The League, the Alliance, the Well House and going home are unchanged. The option texts
  still match the harness's movement patterns (`tools/quota-shell.mjs` MOVES).
- **Also.** The consultation vote on a phone becomes where the man stands in the gallery: with the League's end
  (`said.e5_voted_for`) or the Union's end (`said.e5_voted_against`).

### Plot change 7: The talk-out at the door is Tomas's cap in Leon's hands (cross-era contract)

- **Was.** Ann says Will's words to Leon at the door and ends "Write it down." (The contract's note had it as the
  cell log read to Leon; in the content at `dfa8e63` the gate was already the carried words, `e4.carry_b2` or
  `e5.carry_fb`.)
- **Now.** The boy's brown cap hangs on the nail by the Brack kitchen's back door, beside the cracked wedding
  photograph (`q.brack_cap`, an echo for the Militia line, `e5.e.cap`). Leon wore it as a child to play at police.
  At Wednesday tea Ann's eyes go to it. On the Inspector line, at Ann's step on Friday night, she looks down the
  hall at it, and after she shuts the door she reaches up to the nail. At the Haldane door she takes it out of her
  handbag, puts it in Leon's hands and closes his hands round it, and says where it hung, who took it off the bench
  in the end cell, and Will's words. The gate is unchanged: the carried words (`e4.carry_b2 | e5.carry_fb`), and the
  cap is shown only where Tomas was held (`q.tomas_held`). `e5.carry_b3`, `e5.house_down`, `e5.house_cleared`,
  `said.e5_leon_down` keep their ids.
- **The Militia player's own knowledge.** When Ann has no words and Tomas was held, the Militia player (who was Will
  in the cells in era 2) gets a voice at the door: he knows whose cap is on the nail at home, and there's nobody in
  the yard he could tell how he knows. It changes nothing. This is the spine's rule 4.2 (the player holds more than
  any character can know, with no way to hand it over in full).
- **Rejected.** Letting the player's era 2 knowledge (`q.fact.cell_log`) open the stand-down on its own. It would
  make the player's memory a key that a character's voice is supposed to be (`design/eras/INDEX.md` section 5:
  only a Brack's voice stands Leon down), and it would hand Ann's one true thing to the player.

### Plot change 8: Dorrah's page becomes the oat sack in the wall of Tesk's fold (cross-era contract)

- **Was.** In the archive's back room, box nine, Dorrah Tesk's burnt account book with two December lines, "T.H.
  carried" and "T.H. did not come back", read by the player; the page shredded, catalogued, or carried to Sefa.
- **Now.** The archive's opening is the scale scene (Plot change 5). That afternoon the player is at the ring road's
  cut, where the digger opens the dry-stone wall of Tesk's old fold, and pulls out of a gap a child's oat sack,
  mended at one corner, with a goat stitched in blue thread, its head turned back, and a few blackened oats in the
  seam. The three ways, with no comment from the game: drop it back in the spoil and wave the digger on
  (`e5.page_lost`); give it to the foreman for Krall's heritage panel (`e5.page_kept`), and by Friday a gloved hand
  holds it up in front of the sheaf on the League's video, with a voice saying it was hidden while Edrin starved;
  or carry it inside your coat to Sefa Tesk (`e5.page_given`), who says only that his great-aunt stitched those on
  the children's sacks. Node `e5.archive` keeps its id and becomes the opening; the new node `e5.fold` holds the
  dig.
- **Why.** The sack's meaning comes from what the player met in earlier eras (Tomas carrying oats down the hill,
  the blue thread, the goat with its head turned back on the table leg) and from the people who hold it up. The
  League's reading is a lie a thing can be made to tell, which is the era's subject.
- **Rejected.** Keeping the sack in the archive's box. The contract puts it in the wall, and the dig gives the scene
  a sound and a place the story already has (the cut over the burial ground).

### Plot change 9: Every household's end turns on a body or a thing

- Tom's end is a box of paint cans to the boot, or a phone call to Gail with Kit watching (`said.e5_tom_keep`,
  `said.e5_tom_resign`). Mara's is two sets of keys on a desk. Charlotte's is a road sign pushed into the model's
  clay. Leon's is the woman behind the net curtain's own voice on Hale's laptop. Sam's is the inquest witness box and
  his hand on the plaque, or leaving it untouched. Frank's is his name plate unscrewed, or the empty tin rinsed.
  Ellie's is her own voice saying three captions she cannot post. The ending's last image stays the table, with no
  card in the window and no count (endingcheck).

### Plot change 10: Posts and the clip are heard

- Every post, caption and comment is a voice: Kit holding the phone out, a voice message, the phone's reading
  voice, a lad reading the wall, the League's slow man, Ellie out of a phone in a corridor. New characters carry
  them: LAD, LEAGUE, PHONE, NEIGHBOUR, plus FED (the Federation rep) and EADIE (the coroner's officer). New node
  `e5.stories` holds the three stories, heard, between the clip and the share, so `e5.share` stays narration only
  (`tests/talkspeaker.test.mjs` pins its header to TOM).

## 3. Ids other eras or tools read, kept

`e5.house_cleared` (`q_props.lwd`, the bowl), `e5.house_down`, `e5.page_torn`, `e5.page_lost`, `e5.page_kept`,
`e5.page_given`, `e5.ledger_open`, `e5.archive_open`, `e5.cert_true`, `e5.cert_false`, `e5.mara_true`,
`e5.carry_b3`, `e5.carry_fb`, every `said.e5_*` the harness routes name (`tools/quota/policy.mjs`), every node
endingcheck orders (`e5.ends`, `e5.end.*`, `e5.shop`, `e5.w.*`), the movement option texts (`tools/quota-shell.mjs`),
the inner hinges (`e5.inner.says`, `e5.inner.order`, `e5.inner.descent`, `e5.inner.host`) and the self-lies.

## 4. Not touched (combat side)

- `combat/data/flaws-e5.mjs`, Everybody Says: "every blow posts"; "paper heads in old notice type, then lit glass ...
  each showing the player's own words from the record"; the `says.post` move "a sheet of paper slaps down"; the
  phase named "the notice"; the endure beat "In the morning the share has more views than the clip" (a count);
  the cost beat "Ryan ... quotes the player's post back at a friend on the Yard's wall" (a written post).
- `combat/data/host.mjs`, the Adversary: the Accuser "at his desk with one lamp reads the run's own record";
  "turns to a fresh page"; "the notices pasted on it like posters on a hoarding"; "the read-back's rows as type
  under the ice".
- `combat/data/truths.mjs` `withme`: "The cell log: HALDANE, T. HALF-HESH. HELD, in your pencil" (era 2's cell log,
  now the cap under the contract).
