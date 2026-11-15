<!-- writing-profile: research -->
# Decisions taken under the author's blanket approval, 22 October 2026

The author, verbatim, 2026-10-22: "All actions and blockers approved". The coordinator took the options below and records why each was chosen. Any of them can be reversed by the author.

## Anni and Ned (09-ANNI.md)

- **Pell is Anni's only half-brother.** The coordinator's first canon note also named Davey. That was a mistake: Davey is Will and Edie Brack's son.
- **Abel's age in era 1 becomes 63, not 50.** He is 75 in era 2, twelve years later. The cast record ABEL_ERA1 is corrected in the build.
- **Bet gets no arena boss.** 08-ARENA.md rule 6 stands, and "Never Asked" is cut. Why: the critic and the arena plan both reject making Bet's lie a monster to beat. Her account stays contested in the world, not fought in the arena.

## Camera and map (author, 2026-10-22)

The author, verbatim: "I like the proposal". The proposal is from design/art/references/2026-10-22/REFERENCES.md, "Camera and map":
- one fixed three-quarter angle for every exterior plate, so neighbouring plates join and the town can be learned;
- a whole-town map plate in the Oil and Ink look;
- the closer camera kept for people and fights.

The angle is chosen by the Lamp Quay test bake (people at 130 to 160 px at 1080 lines, Tide Run readability, brushwork) and recorded in design/CAMERA.md.

## Tilt-shift camera (author, 2026-10-22)

The author, verbatim: "I like the idea of a dynamic custom novel tilt shift styled implementation, with camera shaders and effects".

Direction given to the engine lead:
- a Scheimpflug focal plane in world space, not a screen band;
- focus driven by story intent: walk, talk, examine, fight, dream;
- defocus rendered as coarser painting (Kuwahara radius from circle of confusion), not optical blur;
- the miniature strength as a per-look parameter, strongest on the town map and in the record and Accuser looks;
- an optional lens effect stack under the care limits.

The work lands as a raw-native PR first, then in the game.

The author added, verbatim: "Like a living world being observed". This is the governing idea: the camera is an observer of a living miniature world.
- The world keeps moving out of focus.
- Attention drifts, slow and subtle, to something alive when nothing happens. It is off under reduced motion, and never pulls focus from a speaker or a fight.
- Focus answers events in the world, not only the player.
- The observer has a character per look: a naturalist by day, the Accuser's inventory in the record, a child's jittery focus in a dream.

## Inferno (10-INFERNO.md, decisions 1 to 7)

1. **The Adversary is B, the Host, in three movements.**
   - **Phase 1 is A, the Accuser:** the clerk reads the player's own record, and he is true on every fact.
   - **Phase 2 is the Host proper:** the combined monstrosity made from the player's own line. Every blow freezes the ice, and a limb falls only when its lie is named.
   - **Phase 3 is C:** the yard empties, a whisper stops when recognised, and it "will be back".

   Why: the author asked for "a combined monstrosity" and "a battle with ... the devil/shaytan himself". B is the variant built for that request. A and C supply what B alone lacks: the record turned against the player, and an ending with no victory.
2. **Keep all twelve bosses**, built in the order the self-critique ranks them, with the six it names first. Why: the author asked for "an arena of intense battle" with "many more other mythical creatures and entities". The cut list orders the work; it does not narrow the vision.
3. **Invented names in the world, real names only on the sources and history page.** Why: real names map the invented faiths onto Christianity, Islam and Judaism, and turn persecution inside the game into a statement about living faiths. The critic and the designer agree. The sensitivity reads still apply.
4. **Endings without force change only the scene that follows, never a number.** Why: the author's direction is that story lives in the writing, not in numbers. It also keeps the rule that no inner fight changes a fate.
5. **The Doom repaint scene stays** only if it passes the sensitivity readers. It is built behind a flag until then.
6. **The five new self-lie lines and three tags** go into the build phase, under the dialogue gate and with the author approving the sample lines.
7. **The Wendigo stays declined.** Why: it belongs to living Algonquian peoples. Its role, hunger becoming the eating of people in a famine, is already carried by Erysichthon in The Long Barn.

## The open questions of 06-BUILD.md and 09-ANNI.md (game director, under the blanket approval)

The author, verbatim, 2026-10-22: "All actions and blockers approved" and "Let's push for a completion." The rule used: the plan's recommended option each time; where the plan names none, the option the critic and the standing directions favour (gripping and uncomfortable over soft defaults; persecution and genocide central; story in the writing, not numbers; fates decided by named people).

**The spine and the witness (06-BUILD.md section 2)**

1. **Anni at forty stays out of era time,** an interlude at year 38 with a cold open. Why: the plan recommends it, and a twenty-two-year-old inside era 3 has not yet lived with it long enough to tell it.
2. Answered by the author ("Out of wedlock."); Ned is the father (09-ANNI.md).
3. **Yes, the player's own character sits at her table, old, and he may tell her where Tomas lies if he knows.** Why: revision 1 of 07-GRIP.md; he tells it badly, and the corner is under wire by then.
4. **The author's line never appears on screen.** Why: a stated theme is the aphorism the writing rules ban; the line stays in the structure.
5. **Working title: The Prayer for the Water.** Why: the only option that puts the persecuted people's own faith in the title, and the plague's poisoned-well accusation now runs through water. Reversible.
6. **H1: Bet decides.** Anni offers herself; Bet lets her go or keeps her. Why: the plan recommends it, and it keeps the failing parent as the moral engine.
7. **H2: yes, a nine-year-old may be taken.** Gedge takes Aaron from Haldane Yard, and Ilo goes in for the coat. Why: revision 4 of 07-GRIP.md; the soft options (Gedge takes Ilo, or H2 goes) spare the parent his failure.
8. **The militia line walks to the wicket.** Keep it, with the guard: no contact on screen, the cut on Will's hand at the bar. Why: recommended by revision 10; the player's hands are on it either way.
9. **The peak is option A:** era 2, and a death in era 5 denied while it is still warm. Why: recommended; it keeps era 5 from being history.
10. **Danil Saro dies in era 5, and the clip shows him dead.** Why: "hurt" is the soft default; a denial needs a death to deny.
11. **Yes, Anni names a goat-Hesh family in era 3.** Why: the grey zone is the victims' own complicity, and the critic asks for the victim who is no saint.
12. **Yes, the margin note pays off as Mott logging the boy's visit for the office.** Why: critic P1 builds on it; the bureaucracy noticed a Hesh child calling on an official.
13. **A second route to the corner is added, through Edie's boots,** and the corner stays a burden. Why: 04-PERSECUTION.md section 6 forbids exclusive story for complicity; no Haldane ever learns where Tomas lies.
14. **Scene notes may let a player step past the H2 scene and the granary custody beat, noted neutrally; the witness scene has no step-past.** Why: the care plan's recommendation (04-PERSECUTION.md section 8); the table carries what was stepped past.
15. **The author arranges the widened sensitivity read and the historian; the coordinator drafts the brief.** Why: only the author can engage readers. It stays a gate before M2.
16. **Keep the doubled quota and the passes,** varied in names and numbers only. Why: the method is documented famine mechanics, and the persecution must not read as invented cruelty.
17. **The inner arena is adopted** (already adopted by the author, CRITIC.md). Arena code waits for the mechanics lead.
18. **Yes, a hardened flaw may fight on the player's side in a story fight.** Why: 08-ARENA.md rule 1 calls it the horror.
19. **Yes, "Somebody had to keep order" is tagged as a self-lie** (Will, the Crown's steps).
20. **Every era's protagonist gets an inner arena; era 2's is built first.** Why: the lineage of flaws is the point of the arena plan.
21. **Frank Mott tears out his grandfather's page.** Why: the father's page made him over a hundred.
22. **The Orme lad is Kit Orme, George Orme's grandson, dead of the fever in November.** Mrs Orme gave his coat to the Furrow Church's poor box and Bet got it for Tomas. Why: Bet's "it was the Orme lad, by the coat" becomes a lie she knows is impossible, and the coat carries the fever's lice into the Haldane house.

**09-ANNI.md section 12**

1. Davey: answered (a coordinator error; Pell is the only half-brother).
2. **Bet does not live to year 38.** She dies in the era 3 fever, after the "Was it him?" scene. Why: the fever era 3 already names, and the witness says "your gran said" of a dead woman.
3. **Yes, the H1 claim option shows on a first run,** worded "Put your own name to her", which a first-time player reads as a surety.
4. **Anni marries Oren Tesk, Dorrah's nephew, town Hesh;** the line stays Hesh on paper until Aaron's branch calls itself Tarn. Why: she marries into the family her father's mark sent away (critic P4), and the Tesks always knew whose she was.
5. Abel: answered (63 in era 1).

## Plague and illness (author direction, relayed by the coordinator, 2026-10-22)

The author, verbatim, 2026-10-22: "Introducing plague, and illness elements to the worldbuilding would be good as well. Make it a truly hellish environment. Dial the trauma and pain up to 11"

- **Disease follows the famine,** as it has in history: typhus in the cells and the relief queue, carried by lice; dysentery, so the certificate's "intestinal illness" is literally true (critic P3); hunger oedema; the fever era 3 already names.
- **The plague is a persecution engine.** The Hesh keep the Well, so the sickness brings the poisoned-well accusation, the oldest pattern of plague-time massacre. It bridges era 2's hoarding blame to era 3's killing. Planted in era 2 as a rumour at the pump, a line from the Furrow Church's pulpit and a chalked notice; planned in 04-PERSECUTION.md.
- **The sickness lives in the body and the senses:** the smell, the cough through a wall, lice in a seam, the colour of skin, the cart that collects, quarantine chalk on doors. Sound and smell carry it; the camera does not linger.
- **Up to eleven, with craft.** The contrast beats stay (the Sheaf before the post, ordinary pleasure), because relentless horror numbs; the hell is in the rhythm, as in Come and See. Nothing else is softened.
- **The content warning names disease and the death of children from disease.**

## Inner arena staging calls (coordinator, under the blanket approval, 2026-10-22)

The staging pass (combat PROGRESS 30) asked the coordinator four questions. Taken under "All actions and blockers approved", with the reasons recorded:

1. **Flash rule wording: adopt WCAG's.** A general flash is a pair of opposing changes of 10% or more of the maximum relative luminance (1.0), counted only where the darker frame is below 0.80, at no more than three a second and no saturated red flash. That is WCAG 2.x's published definition (high confidence). 05-CARE's "10% of the brighter value" was stricter than the standard and took nearly all light out of blows on a dark ground. The three-a-second limit and the red rule stay, and so does the reduced-flash option. Re-enable the heavy-blow glow and size the contact star by the new rule, and re-run F5.
2. **Boss height: lift the kitchen-ceiling rule for the amalgamations.** The Host and every morph phase may exceed the room; the room gives way around them (ceiling splits, walls lean out). The single-sin bosses stay under the ceiling, because their horror is that they are the size of a man at your table. Why: the author asked for "terrible amalgamations" and "up to 11", and the scale jump at a morph is the moment the lie stops fitting in the house.
3. **Virtue names on screen.** Each boss's shown name is the virtue it wears, from 03-BESTIARY (Friday shows FATHERHOOD; the title stays in its dialogue). The sin stays hidden in the data, as built. The `town` field moves to the bestiary's names, and the R3 caption check keeps covering it.
4. **The "80" on Nobody Checks' sacks becomes a picture.** The false count shows as a stack that looks full from the front and is hollow from the player's side, with no numeral. Why: [story is in the writing, not numbers]; the lie reads better as a shape you walk around.

Visual check by the coordinator on two before/after pairs (host-m1-force-p0-tell, check-endure-p0-form): the light, the room and the silhouettes read far better than the greybox. It is still not shipped-game art: flat 2D forms with almost no animation, which waits on production bodies from the character lead.

## The rating replaces the warning screen (author, 2026-10-22)

The author, verbatim: "Also the explicit warnings and trauma disclaimers on the game are weak. The rating should be left up to the discretion of a rating board, and be done in the typical fashion. Perhaps in an introductory scene or intro video for the game. We need cinematics and such. But the big warning is too much. Let people come to their own conclusions."

- The topic list shown before the title is cut. The list stays as an internal document (design/quota/07-PRODUCTION.md) that feeds Steam's content survey and the sensitivity read.
- The rating comes from Steam's content survey, which generates regional ratings and Germany's required one, and from direct board submission later for console or retail. design/RATING.md has the route, with sources read on 2026-10-22.
- The only notice the game shows itself is a two-line photosensitivity notice at boot, which is industry practice. Accessibility options, including the opt-in scene notes, live in the settings menu and nothing announces them.
- The opening cinematic tells players what kind of game this is (design/CINEMATICS.md, to be written).
- Two items found on the way: Steam's survey also requires a generative-AI disclosure (the generated voices at least), and German availability needs a check against German law. Both are in RATING.md section 7.
- Earlier lines in this file and in spine-plan/04-PERSECUTION.md, inferno/07-SENSES.md and 06-BUILD.md that say "the content warning names X" now mean the internal content list.

## Abuse shown on screen (author, 2026-10-22)

The author, verbatim: "Abuse may also be shown explicitly in the game through actions and cutscenes. There is no reason to obscure the seriousness of what occurs in this world."

- This supersedes "violence against civilians shown through aftermath", "harm to children only through consequence" and "the death of a child in custody (not shown)". Beatings, torture, domestic and institutional abuse, removal and massacre, and harm to children are shown in play and cutscenes, without cutting away.
- **Two lines hold.** Nothing sexual involving a minor, ever, in any form. Sexual violence between adults is shown as coercion, threat, the act's violence and its aftermath, never as sexual content or nudity. Why: the first is a legal and moral absolute. The second keeps the horror on the violence rather than turning it into sexual material, and keeps the game sellable in most territories.
- **Craft.** Every act belongs to a named person with a history, seen from a position the scene chose. The camera stays when staying costs the player something, and the act carries consequences in the world record. Nothing is shown for spectacle.
- **Rating.** The band moves toward PEGI 18 and Mature 17+ at the strict end, with territory risk (design/RATING.md section 3).
- Cell death in custody: proposed to become a cutscene seen through the door's hatch, from Ned's position. For the story lead and the cinematics agent.

## Completion ledger, wave 0 calls taken under the blanket approval (coordinator, 2026-10-23)

Taken under "All actions and blockers approved"; each is reversible. The other wave 0 decisions are put to the author.

- **D3, the Deck target:** "Verified" at launch. Why: Verified needs the same controls, text size and launch work the ledger already calls for (pad-only play, readable text at 1280 x 800), and Playable would only defer it.
- **D7, archive the Gullet acts out of the build:** yes. Archived on a branch and tag, not deleted. Why: the spine is the Quota; Gullet scenes in the build inflate checks (visual-check's eight views were all Gullet) and confuse the playthrough.
- **D8, the title:** keep the working title "The Prayer for the Water" until the author names another. Why: R5 and U1 need a string, and changing it later is one meta line.
- **D6, the sensitivity read and historian:** put to the author, because it means hiring people. It gates M2, not wave 1.

## Completion ledger, wave 0 decided by the author (2026-10-23)

Asked and answered in chat:
- **D1, the art pipeline: all hand-built.** Every character and boss is sculpted and painted as an authored asset (Blender sculpts and retopology, baked maps, painted textures and portraits), replacing the code-generated heads and forms. Consequence: a new asset pipeline (Blender to raw-native and to the browser build), an art bible per character, and review renders before anything ships. Assets made with generative tools would need Steam's AI disclosure, so the authored pipeline avoids them for art.
- **D2, the native build: a raw-native port.** The Steam build runs on our own engine, not a browser shell. Consequence: the game's runtime (today JavaScript in a browser) needs a host in raw-native, either an embedded script engine running the existing game logic with raw-native rendering, or a port of the logic. A spike decides which, with bounds. The browser build stays as the development and web demo build.
- **D4, voices: generated, disclosed.** Keep the generated cast voices and disclose them in Steam's content survey (design/RATING.md section 2).
- **D5, era 2's classes: all six.** Era 2 ships with all six classes before 1.0.
- D6 (sensitivity read and historian) is still open.

## D1 refined: our own asset tools, no Blender (author, 2026-10-23)

The author, verbatim: "Ideally we should not need blender, and will build our own assets."

"All hand-built" stands, and it is carried out with first-party authoring tools on raw-native and the studio stack: sculpting, retopology, map baking, texture and portrait painting. The tools are built to be reused across games, not as game code. The D1 entry above that names Blender is superseded on that point. The pilot is the same: Ned's head authored in our tool, with review renders compared against the code-generated head.

## Eras 1, 3, 4 and 5: the five open questions (coordinator, under the blanket approval, 2026-10-23)

From design/eras/INDEX.md (commit 0008ccc). Each call is reversible, and the reason is given.

1. **Era 1 comes first, and the opening film is a prologue.** The film is a cold open on the boy who did not come home: the era 2 table with one bowl turned over, before the player knows whose it is. Then era 1 begins with Ilo. Why: the spine is the boy, and the film poses the question the five eras answer. Chronological play then lets every hinge land on what came before.
2. **The six named dead in the era 3 fire stand, with Ilo among them on one outcome.** Why: the Well House burning is the turn from hoarding blame to killing (04-PERSECUTION). A fire that spares every named person would be the soft default the author asked us to attack.
3. **Anzo Velek dies in the era 4 Row fire on the outcome where Dale Gedge sets it.** On the other outcome the fire is stopped and nobody dies. Why: the fate needs a decider and a real cost, and Dale is the decider.
4. **Danil's death has one outcome, exempt from the two-outcome fate rule.** The reason is written in the record: it is the canon hinge of era 5, and the player's agency is in what follows (the certificate, the page, the door), not in the death. The fate checker gets an explicit exemption list, with this as its only entry.
5. **The shared story is already on the player's phone when era 5 starts.** Sharing it further is a choice. Why: the world forwards it without asking you, which is what the era is about. The player's choice is whether to pass it on.

The age and canon conflicts listed in INDEX.md section 3 go to the story lead's next package, to fix against the lore spine.

## D2 refined: the game runtime moves to C++ on raw-native (author, 2026-10-23)

The author, verbatim, answering whether to ship an embedded JS engine: "What would an independent developer, publisher, and engine builder do? If writing it in C++ or BuildLang, we should. Why should it delay the build by months, and why has JS been a primary pillar when most games don't ship as JS?"

**Why JS was the pillar.** Low Water began as a browser prototype served by game/serve.mjs, because a page reloads in a second and needs no build. That suited fast story and systems iteration. It was never chosen as the shipping runtime. Some commercial games do ship on JS (RPG Maker MV and MZ titles and CrossCode run on NW.js), but an engine builder with a C++ engine of their own would not.

**The decision.** The runtime is ported to C++ on raw-native: the story VM that runs .lwd, the rules and community model, saves, input, UI and audio. raw-native already builds to WebAssembly (its wasm CI job), so one C++ codebase serves both the Steam build and the web build, and there is no second runtime to keep in step. The content (.lwd, cast records, plates, voices) is data and carries over unchanged. BuildLang is the author's own language; it is a candidate for tools and scripting once it is ready for production, and is not on the critical path for 1.0.

**Why it need not take months.** The engine-side JS is about 29,600 lines in 351 files (NATIVE-HOST.md inventory). The UI is DOM-based (609 uses), so it needs a native UI layer under any route; the hybrid saved less than it seemed. The port is checked by traces: the existing JS harness records each run's sequence of story nodes, choices, state and record events, and the C++ runtime must reproduce those traces exactly on the same seeds. That makes parallel porting safe, with agents working on disjoint modules. Estimate: 60 to 90 agent runs, low confidence. At 5 to 7 in parallel that is weeks of agent time, not months. The QuickJS spike (shell/, raw-native PR 216's file bridge) stays as a reference; the file bridge carries over.

**Order.**
1. Trace recorder in the JS harness.
2. The .lwd story VM in C++ reproducing era 2's traces.
3. Rules, community and world record.
4. Saves through the file bridge.
5. Input and focus.
6. A native UI on raw-native's retained scene.
7. Audio.
8. The wasm web build replaces the browser JS build.

The browser JS build stays playable for content work until step 8 passes.

## Retire the tide and the Daybook; intensity and combat at the top of the market (author, 2026-10-23)

The author, verbatim: "the whole 'A night on the tide, kept in a Daybook.' gimmick and aspect can be minimized or eliminated. Let's make things really intense and graphic. Lots of deep painful story content, and great combat." And: "We want to rival, and beat AAAA titles with an indie game and engine."

- **The tide goes.** "A night on the tide" was the Gullet story's frame. The default title subtitle is removed (the Quota's own line stays), and no tide term appears in the Quota's UI.
- **The Daybook goes as a concept.** The nine-tab diary (Notes, Claims, Margin, Build, Pack, Map, Lamps, Town, History) becomes a plain pause menu with only what serves play: Character, Inventory, Map and Journal, plus the Record where a story needs it. No diary conceit, no lamps, no tide. Built in the native UI as part of the C++ port (D2 refined); until then the browser build hides the tabs the Quota doesn't use.
- **Intense and graphic.** Violence and its consequences are shown in full, in play and in cutscenes: wounds, blood, the body after. This follows "Abuse shown on screen", with its two hard lines unchanged. The story leans further into deep, painful material: loss, complicity, the failing parent, persecution. Every scene still turns on a named person's choice, so the pain carries meaning rather than being spectacle.
- **Combat at the top of the market.** Combat gets a full spec against the strongest current action games: feel, readability, weight, animation, hit reaction, gore and enemy design. Each target is measurable (input to response, hitstop, cancel windows, telegraph timing) and is benchmarked against named titles. It is built natively in C++ on raw-native, not in the JS runtime that is being retired.
- **The bar.** "Rival and beat AAAA" is met by focus: an indie team wins on writing, art direction, combat feel and engine craft, not on breadth. The completion ledger gains a "competitive bar" column per area, naming the title we must beat and how we measure it.

## Combat content calls (author, 2026-10-23)

Asked and answered in chat, against the proposals in design/COMBAT-SPEC.md (fd0f437):
- **Children can be harmed in combat.** The author chose this over "never targets". The two hard lines from "Abuse shown on screen" are unchanged: nothing sexual involving a minor, ever, and sexual violence without sexual content or nudity. As with every act in the game, harm to a child belongs to a named person's choice, carries consequences in the world record, and is never a reward. No score, loot or progression comes from hurting a child.
- **Dismemberment everywhere,** town fights included, not only the inner arena. Wounds follow the weapon: what a hook, a cleaver or a scythe can sever, it severs. The body stays a person: named dead keep their names, and bodies stay where they fell.
- **Rating consequence, stated plainly.** Interactive violence against children is the content most likely to draw a refusal of classification (Australia, Germany and others) and closer platform review. design/RATING.md section 3 is updated, and the territory check before launch is now required, not optional.

## Build now in C++, ready to be rebuilt in BuildLang (author, 2026-10-23)

The author, verbatim: "move forward and build it so that it can be rebuilt in BuildLang later. BuildLang can be a direct competitor to Bend as a next generation AI and agent first creative language - it is built for AI in the loop programming". Then: "Lets work on the game and engine first, and BuildLang perhaps in parallel".

- **Priority:** the game and engine come first. BuildLang runs in parallel and is never on the game's critical path.
- **Rebuild-ready rules for the C++ port** (each package follows them):
  1. **The spec is language-neutral and executable.** Behaviour is fixed by the trace corpus (design/TRACE-FORMAT.md), the deterministic math spec (design/DETMATH.md) and the data files (moves.json, the .lwd content). Any future implementation, BuildLang included, passes by reproducing the same traces.
  2. **Game logic lives behind a plain C ABI.** No C++-only metaprogramming in the game layer: plain structs, explicit state and pure step functions, so each module can be swapped module by module. BuildLang links through C FFI today.
  3. **Data over code.** Tunables, moves, story and cast stay in data files, not code.
  4. **Shaders stay in WGSL as the source of truth** (raw-native's generator emits HLSL). BuildLang already emits HLSL and GLSL, so a later shader rebuild is checked against the same goldens.
- **Why:** the game ships on the proven path, and every module carries the evidence (traces, goldens, bounds) a BuildLang rebuild would need to prove equivalence.

## The traits pass (author direction, 2026-10-23)

The author, verbatim, 2026-10-23: "shift the low water plot, and internal combat narrative and names; this is each
trait embodied, and fought. make it intense and immersive." Taken under the blanket approval ("All actions and
blockers approved; take recommended options and record each", 2026-10-22). Design: design/TRAITS.md. Checklist:
design/TRAITS-RENAME.md. Each call below was settled by a test, and the reason is the test's result.

1. **Every compartment and every voice is a trait, and every trait has a being.** Twenty traits: four great traits
   (the compartments) and sixteen under them. Why: the direction is "each trait embodied", and a voice without a body
   would be a trait the player can raise but never meet.
2. **Names chosen by reading every existing voice line under each candidate.** 292 voice lines in content/quota. The
   name kept was the one most of the voice's lines read as, said aloud. APPETITE beat WRATH and HUNGER for grip ("Your
   hand's on the bread again" and "Under your knee. The give." are both the hands wanting); PRUDENCE beat GREED for sum
   ("You only watch the arm" is the careful man); COWARDICE for smallprint ("You didn't say anything. You stood
   still."); LOYALTY beat FAITH for precedent ("A Brack said it first... It's theirs before it's yours"); TENDERNESS
   beat PITY for condolence, because a tender trait that holds too hard is the less comfortable fight; DISGUST for
   smell, DREAD for the dark, SHAME for undertow, SPITE for hearsay, OBEDIENCE for ballast, WEARINESS for knees.
3. **No trait's name is a sin's.** Tested against the sin words the HUD already refuses (notallycheck R3). PRIDE, ENVY
   and GREED failed, so the hat compartment is AUTHORITY, the chit is JEALOUSY and the pride voice is VANITY. The sin a
   trait feeds is kept in the data and never drawn. A test now asserts it for all twenty.
4. **The build sheet must read as a person.** Read aloud: Ned is SUSPICION 4 with PRUDENCE, LOYALTY, COWARDICE and
   GUILT trained; Will is HARDNESS 4 and FEAR 3 with WEARINESS, OBEDIENCE, VANITY and APPETITE. Both read as men with
   histories; the office names did not.
5. **Each existing boss becomes the trait whose voice speaks its lie;** where a scene's self-lie was voiced by another
   trait, the line is re-voiced to the trait it becomes, keeping its level check passable by the same class (eight
   lines and their echoes; TRAITS-RENAME.md section 4). Why: the player must hear, in the scene, the voice of the
   thing he will fight that night. Checked by the harness, witnesscheck and fatecheck (COMPLETION section 5).
6. **Three new lesser beings (JEALOUSY, DREAD, SHAME), met only in the Descent.** Why: the three voices had no boss,
   and inventing three new story hinges would outrun the author's line approvals. Each is a real fight, tuned until
   tools/innerduel.mjs met the targets over twelve seeds. DREAD first measured unskilled deaths 0 and then 0.33: a
   masher won by hitting into its long waits. The fix kept its truth (the big waits carry no armour) and gave it two
   armoured answers to a man who stands in its face. It now measures 0.75.
7. **Raising a trait makes its being bigger,** by the sheet's own level (6 % standing and 4 % harm a point from 5,
   bounded 0.82 to 1.5). Why: "points you put into a trait make it stronger in you ... and make its embodiment harder";
   bounded so a maxed trait stays a fight a skilled player can win.
8. **Every ending changes the trait: force -1, terms +1, lost to +2,** as a sheet modifier named for the night. This
   supersedes inferno decision 4 ("Endings without force change only the scene that follows, never a number") for the
   trait itself and nothing else: no fate, no witness beat and no count on screen is touched, and the outcome record
   stays a turning point (the change is its own record, `trait.change`). Why: the direction asks that each outcome
   change the build. Winning is not healing: the cut trait comes back at its gate.
9. **The Descent is four gates, one per great trait, weakest first,** each fighting as its most-fed trait with the next
   one's plain blows. Why: "each sin forms from traits the player fed". Kept-by-force traits still arm their gate, so
   force is never a cure. A gate is half again the size of the trait it fights as (staging call 2 allows the
   amalgamations to exceed the room).
10. **The Accuser reads nothing.** He speaks the run's fed traits back in their own voices; his form loses its desk pen
    and its filing cabinet (a coat stand hung with the limbs instead). Why: "Bookkeeping should not be a part of the
    plot", and the clerk reading a record was the last paperwork device in combat.
11. **Steady Hand's id moves from `received` to `prudence`,** with a migration for saves, old hinges and `innerend()`.
    The other ids stay. Why: the brief names the `received` hinge for removal; every other id is read by saves and
    traces, and renaming them buys nothing a player sees.
12. **The Host's limbs are the traits he cut back and the traits that took him.** Why: the combined monstrosity should
    be made of what he fed, and a trait that won is fed more than one that was beaten.
