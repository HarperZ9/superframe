<!-- writing-profile: research -->
# Sensory 6: inspirations, and the method taken from each

Part of [SENSORY.md](../SENSORY.md). Clean room: methods only. No asset, frame, texture, melody, chord
sequence, sample, line, character, name or layout is taken from any work below, and none is named in the
game. Facts were checked on 2026-10-22 against public pages (Wikipedia, Steam, reviews); anything not
confirmed is marked UNVERIFIED. What each game "does" is my reading of public descriptions, not a study
of its files; I played none of them for this page.

## 1. The author's list (2026-10-22, relayed by the coordinator)

The author, verbatim: "Disco Elysium, Zero Parades: For Dead Spies, No Rest For the Wicked, No, I'm Not a
Human, Eclipsium, Labyrinth of the Demon King, Hail to the Rainbow, Rue Valley, Mouthwashing, Threshold,
Carimara: Beneath the Forlorn Limbs, Shadowgate, Elden Ring, Neva, Gris, Omori, Fear and Hunger, FEar and
Hunger 2: Termina, SKALD: Against the Black Priory, Kenshi, Felvidek, Banquet for Fools, Judero, Planescape:
Torment, Blasphemous 1 & 2, etc."

| Work (developer, year) | Method taken | Maps to | How raw-native makes it | Gap |
|---|---|---|---|---|
| Disco Elysium (ZA/UM, 2019) | Painted portraits as the second scale of a person; skills as inner voices that argue; the UI as a voice on paper | L0; the talk panel; inner voices (design/VOICE-BIBLE.md:59-74) | Paint pass on portraits (P16); the shell's portrait painter exists | P16 |
| Zero Parades: For Dead Spies (ZA/UM, PC May 2026) | Pressure states (fatigue, anxiety, delirium) shown as changes in the voices and the world, not as bars; painterly paint-spatter environments with more realistic portraits (reviewers' description) | L10 states of mind | Style-state weights from stocks (02-MORPHS.md) | The field |
| No Rest for the Wicked (Moon Studios, early access 2024, full release slated 2027) | Chiaroscuro and saturated colour as the base of a painterly look without cel shading; figures with their own key and rim, no outline | L0 figure light; readability already adopted (PROGRESS.md steps 106 to 108) | Light buffer into P16 stroke light | None new |
| No, I'm Not a Human (Trioskaz, 2025) | The door as the whole decision: who to let in, judged from a face and a broadcast; a TV bulletin that changes what the player looks for | The granary door; the era 2 radio and era 5 phone as carriers (L12) | Glyph or halftone screens in a region (P18, P19) | P18, P19 |
| Eclipsium (Housefire Games, 2025) | Low-resolution first-person scenery whose pixels pulse so the place seems to breathe (reviewers' description) | Surreal break "time held" inverted: the room breathing under dread | A low-amplitude world-anchored displacement on P5's chart, gated by dread | A displacement term in the field; must pass s2 |
| Labyrinth of the Demon King (J.R. Hudepohl, 2025) | Low-poly, dithered, 4:3 framed retro horror; drones and metal thuds | The cells; the dither-lit look | rn `ink` and `tones4` dither-light presets (rn:src/renderer/style_ditherlight.cpp:24-25) | None |
| Hail to the Rainbow (Sergey Noskov, 2025) | Brutalist architecture and green terminal screens as the voice of a state (reviewers' description); engine UNVERIFIED | Era 3 allocation office; era 5 council screens | P18 glyph on screens; P17 ruled line on concrete | P17, P18 |
| Rue Valley (Emotion Spark Studio, 2025) | Hand-drawn illustration layered onto 3D geometry with shaders that bring out the brushstroke (80.lv breakdown); inner voices; a time loop | Plates as paintings over geometry (already our method); the dream's repetition | P16 on baked plates | None new |
| Mouthwashing (Wrong Organ, 2024; sound by Martin Halldin) | Glitch-cut transitions between times; a perspective split between two men; low-poly faces made expressive by simple means | Perspective chapters (L9); cuts between eras | Hard cuts with a sound cue in the field's time morph (reduced-motion form) | None |
| Threshold (Julien Eveillé, 2024; the train game at a mountain border post, identified as the most plausible match; the title is shared by other games) | One machine that never stops as the whole soundtrack's spine; the screen darkening as the body's resource drains | The export train as instrument; cold in era 2 | Audio exists; darkening by a state-of-mind weight on exposure | None |
| Carimara: Beneath the Forlorn Limbs (Bastinus Rex, 2025) | Near-monochrome greys with red as the only accent; speech as gibberish so meaning sits in cards and tone (reviewers' description) | L12 mezzotint rhetoric; one hot mark | rn palette dither (rn:raw/renderer/style_dither.hpp:18) with a reserved hot entry | None |
| Shadowgate (ICOM, 1987; remake Zojoi, 2014) | First-person room views where every object is examinable and the room is a still picture | The close look on props (game/engine/ui/examinecam.mjs) | Shallow focus at the close look | Painterly depth of field (no `fx/post.mjs` exists yet) |
| Elden Ring (FromSoftware, 2022) | Scale and harsh light: a structure seen from far away first, then reached; the colossal against the small | The wide lens from the bell tower; the export train against the queue | Aerial perspective in the field (scumbled far planes, design/art/PAINT-LANGUAGE.md:88-89) | None |
| Neva (Nomada Studio, 2024; music by Berlinist) | Near-wordless storytelling: a single called name carries the bond | The coda at the Haldane table | Score's solo piano coda exists | None |
| Gris (Nomada Studio, 2018; art Conrad Roset; music Berlinist) | Colour as emotional state, returning in stages; watercolour-like washes (the watercolour label is inferred from Roset's practice) | Era palettes returning colour only where the story earns it; the Well House | rn `watercolour` preset with granulation and edge | None |
| Omori (OMOCAT, 2020; music Pedro Silva, Jami Lynne, Calum Bowen) | A bright, childlike world interrupted by monochrome, glitched horror; the switch tells the player which reality they are in | Davey's drawing as a look (the child's hand, design/quota/08-WORLD-MEDIA.md:106); surreal breaks | A child's-drawing style state | A child-hand painter preset (the Studio has one planned, design/quota/08-WORLD-MEDIA.md:134) |
| Fear and Hunger (Miro Haverinen, 2018) | Art between painting and pixels; dread from scarcity and dripping, chanting ambience | Era 2 hunger as the look's driver | Dry broken stroke share from `hunger` (L10) | None |
| Fear and Hunger 2: Termina (Miro Haverinen, 2022) | A fixed number of days and a moon that counts them down; stress in the music | The quota's deadline; the dream a week ahead | The clock and the dream exist; sound rule in SCORE.md | None |
| SKALD: Against the Black Priory (High North Studios, 2024) | A deliberately small palette in the 1980s home-computer vein carrying a grim setting | The cells; propaganda prints with few inks | rn palette dither with a fixed palette (rn:src/renderer/style_oklab.cpp:37-60) | None |
| Kenshi (Lo-Fi Games, 2018; music Kole Hicks) | Ambient music that recombines at random and ignores the player, so the world feels indifferent | The wide lens in eras 3 and 5 | A district bed that never answers play | None |
| Felvidek (Jozef Pavelka, Vlado Ganaj, 2024) | Heavy dither and low resolution in near-monotone, after fifth-generation consoles | Brownouts in era 3 | rn dither light `tones4` | None |
| Banquet for Fools (Hannah and Joseph Games, early access 2024, 1.0 2026) | Music as a resource the player buys and sets before a fight; no quest log or compass | The arena's band; sound as a choice | Audio side only | None |
| Judero (Talha & Jack Co, 2024) | Handmade sculpted figures in stop motion: the hand of the maker visible | Children's drawings, crafts, the carved spoons as made things | Stroke timing on held frames (motion on twos) for crafts | A stepped-time term per object |
| Planescape: Torment (Black Isle, 1999; music Mark Morgan) | A painted, pre-rendered world; dense text treated as the main sensory channel; sounds fading with distance | Text pacing; the wide lens's distance roll-off (game/engine/audio/place.mjs:9-12) | Baked plates (already our method) | None |
| Blasphemous and Blasphemous 2 (The Game Kitchen, 2019, 2023; music Carlos Viola) | Sacred grotesque from Holy Week and Spanish painting (Goya, Zurbarán named as sources), frame-by-frame pixel animation | The Furrow altarpiece and the Well's cups; the guard keeps the grotesque in the institutions, never in a people | P16 glazes toward the altarpiece | None |

## 2. Painting and print

| Work | Method taken | Maps to |
|---|---|---|
| Käthe Kollwitz, woodcuts and lithographs of hunger | Figures reduced to the gesture of need on a black ground | Era 2 notices; the queue in mezzotint |
| Francisco Goya, The Disasters of War | Each plate a flat statement with a short caption under it | The read-back's rows: a fact and a place, no adjective |
| John Martin's mezzotints | Light scraped out of black; vast crowds cheap | Mezzotint mode (design/art/PAINT-LANGUAGE.md:77-84) |
| Vilhelm Hammershoi | Empty grey interiors, a figure with its back turned | The narrow lens after a loss |
| Rembrandt's late interiors | One source, everything else given up to dark | "Light costs something" (design/art/LIGHT.md:15-17) |
| Giorgio de Chirico | Long shadows in empty squares that disagree with the sun | One surreal break in era 5's square, the only light-rule exception (03-SURREAL.md rule 5) |
| Rene Magritte | An ordinary object at the wrong scale, painted plainly | "Scale out of true" (03-SURREAL.md) |

## 3. Film, theatre, music and sound

| Work | Method taken | Maps to |
|---|---|---|
| Andrei Tarkovsky, Mirror (1975) | Memory and present in different colour regimes, changing without explanation | L8 memory; the era window |
| Chris Marker, La Jetee (1962) | Memory as held stills, one moving moment | L8 held frame |
| Terence Davies, Distant Voices, Still Lives (1988) | Family memory as tableaux, songs carrying the years | Dinners; a sung moment when a singer exists (design/audio/SCORE.md:31) |
| Powell and Pressburger, A Matter of Life and Death (1946) | Two worlds in two colour regimes, crossed on screen | Region blends |
| Bertolt Brecht's estrangement | Placards and documents that stop the scene to state the fact | The compare view; the read-back |
| Tadeusz Kantor, The Dead Class (1975) | Old people carrying mannequins of their child selves | Era 5's elders with era 2's children in a memory break |
| Akira Yamaoka | Sound design and score as one material (the score's primary model, design/audio/SCORE.md:10-33) | All |
| Walter Murch | Worldizing (playing sound into a real room) and the two-and-a-half rule | Room acoustics; the attention rule (04-SENSES.md) |
| Hildur Gudnadottir, Chernobyl (2019) | A score made from the recorded machinery of a place | Machinery as instrument |
| William Basinski, The Disintegration Loops | A loop that decays as it plays | The decay loop motif |
| Ryuichi Sakamoto, late work | A few notes and their decay; silence as a part | The coda; the silence budget |
