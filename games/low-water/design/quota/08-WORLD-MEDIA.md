<!-- writing-profile: research -->
# The Quota, 8: world media (the Upper Town's art, print and screens as a storytelling layer)

Part of [QUOTA-DESIGN.md](../QUOTA-DESIGN.md). Game director, 2026-10-22.

**What the author said**, 2026-10-22, verbatim: "game artwork, and art materials, and game world placed
art and media could be used to improve the storytelling aspects".

This file lists the pictures, prints, crafts, signs and screens the people of the Upper Town make and
put up across the five eras, and what each one tells. It builds on what exists: props with per-era states
and close looks on examine (`@prop`, `world/props.mjs`, `ui/examinecam.mjs`), the propaganda kit with the
notice beside the person (`ui/propaganda/`, `ui/compare.mjs`), the lettering hands per character
(`ui/lettering/`, the `hand` field in `design/voice/quota-cast.json`), the Studio's paint-over
(`tools/studio/`), the painter, and the lore graph (`@lore`). The slice's facts are taken from
`content/quota/` as of dev 71ae9d0.

## 1. The rules

1. **Every piece is made by someone in the world.** It has a maker (a person, a firm, a press, a child), a
   date and a technique true to its era: an oil portrait in era 1, a woodcut notice in era 2, a lithograph
   out of register in era 3, a halftone photograph in era 4, a phone screen in era 5 (the print processes
   of the propaganda kit; the timeline is our analogue, moderate confidence that it reads as period-true).
   Its style fits its maker: a provincial painter is a little stiff; a child draws the cart bigger than
   the horse.
2. **Nothing is decorative only.** Every piece tells something about a person, a lie or a loss (the object
   rule of PITCHES 3c). A wall that only needs filling gets a stain, not a picture.
3. **Some pieces can be acted on:** examine, take, sell, hide, burn or deface. Each action is a choice with a
   cost, entered in the record like any other (pillar 6: everything has a source). Burning a photograph is
   a loss the Decay layer keeps; selling a Hesh spoon puts it in the antique shop of era 5 with a price tag.
4. **The propaganda kit's guard applies to every image of a people:** caricature lives only in in-world
   propaganda, built from the myth, props and dress, never from faces or bodies, never animal or vermin
   bodies, never harm to children, never disease. Real faces of the Tarn, Hesh and Vell stay distinct and
   dignified.
5. **The handling rules and the slur rule apply to what is written on walls and screens.** A slur in
   graffiti has a writer the player can find and someone who reads it.

## 2. The inventory, by type and era

Columns: the piece; its maker; where it hangs; how it changes by era and with the model's state; what the
record and Decay do to it; the lore it carries.

### Portraits of officials and benefactors

| Piece | Maker | Place | Across the eras | Record and Decay | Lore |
|---|---|---|---|---|---|
| The exchange's founders | A visiting painter from Arlen, oil | The exchange hall | Era 1 hung in gilt; era 2 the Crown Council's man painted over with the Directorate's Commissioner Pask (the old face shows at the collar in raking light); era 3 Pask taken down, a pale rectangle; era 4 Victor Orme's bank portrait; era 5 in the council archive, stacked face to the wall | The player can turn one round; in era 5 it reveals Pask's over-painting | Who ran the plain in era 2 |
| The district office's Commissioner | A Directorate studio, photograph retouched | The district office | Era 2 framed above the returns desk; era 3 its frame is reused for the allocation chairman | Defacing it in era 2 is a record event that brings the Militia | Pask signed the export order |
| The Orme benefactor | Oil, a better painter than the founders' | The Furrow Church hall | George Orme "who fed the parish" in era 1; still there in era 5 over the food bank queue | Its plaque's words change nothing; the queue under it grows with `hunger` | The night carts |

### Family photographs and their frames

| Piece | Maker | Place | Across the eras | Record and Decay | Lore |
|---|---|---|---|---|---|
| The Furrowe hat photograph | A studio on Exchange Street | The Furrowe parlour | Abel in his good hat, era 1; joined in era 2 by Ned's district photograph; in era 5 on Nan's sideboard, Abel's hat is the only thing Kit asks about | | The good hat (prop `q.good_hat`) |
| The Haldane five | A travelling photographer, about year 5, once all three children are born | The Haldane barn, later the Mott house room | Ilo, Bet and three children. In era 3 someone has cut Tomas out with scissors so the family can show it without questions; in era 5 Mara has the cut-out piece in an envelope | The cut is the family's lie made physical. The world record keeps the piece if a run found the cell log | The missing Tomas chain |
| The Brack wedding | Studio, era 2 | The Brack kitchen | Will and Edie; the glass cracked in the "house" perspective night, never replaced; Leon has it in era 5 | The crack is a Decay mark from that night | The house pair |
| The Saro phone album | Kasem and Mira, era 4 film, era 5 phone | The Saro flat; Danil's phone | The brother left at the border in the era 4 prints; missing from every later picture | | The Saro wound |

### Church icons and the altarpiece

| Piece | Maker | Place | Across the eras | Record and Decay | Lore |
|---|---|---|---|---|---|
| The Furrow altarpiece, "the Sower" | A guild painter, two centuries before era 1 | The Furrow Church | The Sower's field is the plain; in era 2 the parish covers it during Lent and leaves it covered through the famine; in era 5 it is restored with a grant from the ring-road syndicate, with a donor's line on the frame | `faith` shows in who sits under it | The syndicate's money |
| The Well's water cups | Hesh potters | The Well House | Era 1 shared cups on a shelf; era 3 hidden when the Well is called a fever risk; era 5 behind mesh | Hiding them is a Tesk family choice the player can help or report | The fever myth |

### Hesh craft

| Piece | Maker | Place | Across the eras | Record and Decay | Lore |
|---|---|---|---|---|---|
| The blue thread | Every Hesh child, at the wrist | On figures | Worn openly in era 1; taken off to pass in era 3; worn again as a choice in era 5 | Who still wears it is a readout of `standing` | Will's line in the coda: the thread left on the wrist |
| The carved spoons | Ilo Haldane, era 1 | The Haldane table | A spoon per child; the player can take Tomas's | Sold in era 4 for rent, in the antique shop in era 5 at a price | A spoon with a name cut in the handle |
| The weaving on the Tesk loom | Dorrah Tesk | The hills, then the Well House | Era 2 traded for flour; era 4 bought cheaply by a Halvard wife as "folk art"; era 5 in a museum case with no maker's name | Looting it in era 2 is a record event with a face | Dorrah hid two Haldane children |

### Murals and commemorative plaques

| Piece | Maker | Place | Across the eras | Record and Decay | Lore |
|---|---|---|---|---|---|
| The harvest mural | The Directorate's artists, era 3 | The exchange's outside wall | Tarn reapers under a red sky, "The Plain Rebuilt"; no Hesh in it | Painted over in era 4 with a Halvard advertisement, which peels | Who rebuilt the plain |
| The famine memorial | Commissioned by the council, era 5 | Exchange Square | A bronze sheaf and a list of villages, unveiled at the commemoration. It names the villages and no person, and says "the hard winter" | What it leaves out is the point. A player can add a name in chalk; the council washes it off the next morning | The read-back's hinges |
| The Haldane stone | Nobody, then someone | The burial ground's corner | Blank, or T. HALDANE on a later run (the world record) | Pillar 2 | The across-runs fragment |

### Graffiti and its painting-out

| Piece | Maker | Place | Across the eras | Record and Decay | Lore |
|---|---|---|---|---|---|
| The street sign | The council, enamel | Exchange Street | The PITCHES 3c states: whole, shot through, repainted, CHAFFERS OUT, painted over with the old letters showing | The model's `standing` for the Vell chooses the state | |
| "190" in chalk | Anni Haldane, era 2 | The district office door | Appears the morning after the return, if the player told Anni the true figure; washed off by the Militia by noon | A truth.costly event that a household pays for | The ledger |
| The Mill Street wall | Kids, the Furrow League, the residents' group | Mill Street | Era 4 slogans; era 5 a mural of Danil after the clip, then a slur over it, then paint over the slur | Each layer has a writer the player can find | The clip |

### Newspapers, posters and radio

| Piece | Maker | Place | Across the eras | Record and Decay | Lore |
|---|---|---|---|---|---|
| The hoarding notice, `cl.hesh_hoard` | The district office, woodcut | The road post board, the exchange | Era 2: THE HESH HAVE THE GRAIN UNDER THE GOATS. Torn or pasted over by the player (`did.tear`, `did.paste`) | The notice beside Anni (`ui/compare.mjs`) | The blame chain |
| The capital's paper, the bumper crop | Lena Ashby's photograph | The Crown, the Furrowe parlour | The one full granary, twice | The spiked negative of the boy at the door is its opposite | The photograph |
| The schoolbook, "The Plain Rebuilt" | Lena Ashby, era 3 | Every classroom | Heshen words struck out by a child's teacher in red | | Heshen banned |
| "Edrin for Edriners" | The campaign office (Paul Ashby) | Exchange Street | Era 4 poster, halftone collage | | The closure |
| The Halvard billboard | Halvard's agency | Over the mural | "Bread for the World", era 4 | Peels as `work` falls | |
| The radio in the Crown | The national broadcaster | The Crown | Era 2 the Directorate's figures read aloud; era 5 a phone-in about the clip | The volume of the carrier `pub` | |

### Children's drawings

| Piece | Maker | Place | Across the eras | Record and Decay | Lore |
|---|---|---|---|---|---|
| Anni's tallies | Anni Haldane, fourteen | A scrap in Ned's inside pocket (the slice) | Five-bar gates for the sacks: 190 | The read-back quotes it (q_readback) | The true figure |
| Davey's cart | Davey Brack | The Brack kitchen wall | A cart bigger than the horse, with a man on top, and his father beside it with a rifle bigger than the man | After the house night the drawing is gone from the wall; in era 5 it is in Leon's wallet | The house pair; the road post |
| The schoolroom wall, era 5 | Upper Town children | The school | Drawings of "my family", some with a figure crossed out | | |

### Shop signs and advertising

| Piece | Maker | Place | Across the eras | Record and Decay | Lore |
|---|---|---|---|---|---|
| ORME & SON, MILLERS | A sign painter | The mill gate | Era 1 gold leaf; era 4 HALVARD painted over; era 5 the boxing club's sign on the same board | | The sale |
| The Crown's sign | The publican | Mill Street | Stays the Crown across five eras, repainted by each landlord | | |
| Vell shopfronts | The Saros and their neighbours, era 5 | Mill Street | Vellish script and Tarnish beside it; one with its window boarded after the clip | `standing`, `entry` | |

### Era 5 phone screens and CCTV

| Piece | Maker | Place | Across the eras | Record and Decay | Lore |
|---|---|---|---|---|---|
| The clip | A girl from the Upper Town | Every phone at the table | Danil on Mill Street; its views and its comments move with the model's `volume` for the feeds | The comment that quotes the previous run's character (pillar 2) | The clip |
| Ellie Ashby's channel | Ellie Ashby | Phones, the Crown's screen | "The real Edrin" | The false-world pair | |
| The council's CCTV | The council | Mill Street, the estate | Grey stills used at the clearance vote | The archive holds the footage the vote didn't show | |

## 3. Production

| Kind | Tool | Owner |
|---|---|---|
| Painted portraits, the altarpiece, the over-painting | The Studio's paint-over (`tools/studio/`), with the era's look | Art-tools engineer, with the rendering lead |
| Photographs and their frames | The painter at portrait scale, then the era's print process (albumen, silver, hand-tint, faded colour) | Rendering lead |
| Notices, posters, papers, the schoolbook, advertising | The propaganda kit and its guard; `poster.mjs` | UI art lead; words from the story lead |
| Handwriting, chalk, tallies, graffiti | The lettering hands per character (`{hand: <who>}`) | UI art lead |
| Crafts, signs, plaques, the memorial | The painter on plates, as prop states | Rendering lead |
| Children's drawings | The Studio, with a child's hand preset | Art-tools engineer |
| Phones and CCTV | The glyph renderer and the era 5 phone fragment | Glyph lead, UI art lead |
| The record events and states | `@prop` and the record | Gameplay engineer |
| Words on every piece | | Story lead |

### The slice-first list (era 2, eighteen pieces)

1. The hoarding notice `cl.hesh_hoard` on the road post board, tearable and pasteable.
2. The same notice in the exchange.
3. The notice beside Anni (compare view).
4. Anni's tallies, in Ned's inside pocket.
5. "190" in chalk on the district office door.
6. The Commissioner's photograph over the returns desk.
7. The exchange founders' portrait with Pask painted over the Crown Council's man.
8. The Haldane five photograph (era 2 state: whole).
9. Ilo's carved spoons on the Haldane table, with Tomas's.
10. The blue thread on Tomas's and Anni's wrists.
11. The Furrowe hat photograph in the parlour.
12. The Brack wedding photograph, whole until the house night.
13. Davey's cart drawing on the Brack kitchen wall.
14. The capital's paper with the bumper-crop photograph, in the Crown.
15. The radio in the Crown reading the Directorate's figures.
16. The Furrow altarpiece, covered.
17. The street sign on Exchange Street, shot through.
18. ORME & SON on the mill gate.

## 4. The reusable schema

A piece of world media is a `@prop` with media fields, so other games can use the same system (the
author's reusable-tools rule). The fields:

| Field | Meaning |
|---|---|
| `id`, `name` | As for any prop |
| `kind` | portrait, photograph, icon, craft, mural, plaque, graffiti, notice, paper, broadcast, drawing, sign, screen |
| `maker` | Who made it: a character id, a firm, a press, or `unknown` |
| `made` | Era and technique (oil, woodcut, lithograph, halftone, phone, chalk, carving) |
| `render` | The tool: studio, painter, propaganda, hand, glyph |
| `place`, `mark`, `macro` | Where it hangs, its plate mark, and the close look |
| `state: <era> <id> [? condition] \| text` | Its state per era and per model condition, as props have now |
| `tells` | The person, household or era it tells about |
| `lore` | Fragments it gives or needs (`@lore` ids) |
| `act: <verb> -> <effects> {record: <event>}` | Take, sell, hide, burn, deface, turn round, tear, paste, with the record event each one enters |
| `decay` | Which model value moves it between states |

A sketch in LWD/1, for the gameplay engineer to adopt or change:

```
@prop q.haldane_five
name: The Haldane five
kind: photograph
maker: travelling photographer
made: 1 albumen
render: painter
place: q_haldane
mark: shelf
macro: shelf
tells: household q.haldane
state: 2 whole | Ilo, Bet and the three children, Tomas at the end with his hand on Anni's shoulder.
state: 3 cut ? has(lore.q.cell) | The end of the photograph is cut off with scissors. Anni's shoulder has no hand on it.
act: take -> give(i.haldane_five) {record: take.photo}
act: burn -> set(burnt.haldane_five) {record: burn.photo}
lore: gives q.five_cut
decay: breakup
```
