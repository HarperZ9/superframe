<!-- writing-profile: research -->
# Rating: how Low Water gets rated and what the player sees

The author, 2026-10-22, verbatim: "Also the explicit warnings and trauma disclaimers on the game are weak. The rating should be left up to the discretion of a rating board, and be done in the typical fashion. Perhaps in an introductory scene or intro video for the game. We need cinematics and such. But the big warning is too much. Let people come to their own conclusions."

So the game shows no list of topics before the title, and no game-authored warning of any kind except the photosensitivity notice in section 4. Rating boards and the platform's own process set the age rating, and the store page shows what they produce. The opening cinematic (design/CINEMATICS.md, to be written) tells the player what kind of game this is, through the work itself.

## 1. Steam, the launch platform

Source: Steamworks documentation, "Content Survey" (partner.steamgames.com/doc/gettingstarted/contentsurvey), read 2026-10-22.

- The survey must be completed before the store page and build go for review. It has three required sections: general content, mature content and generative AI.
- **General content.** Valve's page says completing it "will generate ratings for several regional rating boards that will be displayed on your storepage". The page doesn't name the boards.
- **Mature content.** "You must disclose all the adult content you've uploaded in your builds", including content the shipped game can't reach. The answers "will determine how your game appears relative to each customer's preferences", which drives the store's mature-content filters and notice.
- **Existing ratings.** A rating "issued for your game directly by official rating board authorities" can be entered in the store page's Ratings section.
- **Some answers can't be edited after approval** without contacting Steam Support, so the survey is filled in once, carefully, from the content list.

**Germany.** Source: Steamworks, "Age Ratings Mandatory in Germany", read 2026-10-22. Since 2024-11-15, Steam hides games without a valid rating from customers in Germany. The rating can come from the USK directly, or from Valve's own self-rating, which needs the content survey. Valve warns that some content is not allowed for sale in Germany at all. We have not checked Low Water's content against German law, so Germany's availability is UNKNOWN until we do.

**Do not** enter a USK rating that came from the IARC process on another store; Valve's Germany page forbids it.

## 2. Generative AI disclosure (Steam)

The same survey asks about AI. "Pre-generated" content made with AI tools during development and shipped in the game must be described in detail, and it is reviewed like any other content. "Live-generated" content made while the game runs must also state its guardrails.

Low Water ships content made with generative tools: the cast's voices are generated from design/voice/quota-cast.json (PROGRESS 171). The plates, portraits and any other generated asset each need an audit too. Before the survey, list every shipped asset made with a generative tool, the tool, and what a person authored or changed. The disclosure sits in the same survey as the rating questions, and it can block approval.

## 3. Other platforms, later

- **IARC** (globalratings.com) gives ratings through participating digital storefronts: Google Play, the Microsoft and Xbox stores, Nintendo eShop and the Oculus store (USK and GRAC pages, 2017 and later). The questionnaire is only reachable through a participating store. Whether Steam participates today is UNKNOWN: the only source we found is a 2015 report saying it had not joined. We don't need IARC for a Steam launch.
- **ESRB, PEGI and USK** by direct submission, for console or boxed release. Plan this when a console port is real, not before.

**Expected band** (our estimate, low confidence; the board decides): ESRB Mature 17+ and PEGI 18. The reasons are the depiction of genocide and persecution, abuse and torture shown on screen in play and cutscenes (author direction, 2026-10-22), violence against children and children dying, slurs spoken in full, drug use, and sexual violence shown without sexual content. The game has no sexual content or nudity. With abuse now shown on screen, the band leans to PEGI 18 with the violence and discrimination descriptors. An Adults Only rating, or a refusal in strict territories, becomes possible if a board reads interactive torture or violence against children as extreme. Australia's board has refused games for interactive violence before (from memory, moderate confidence), so check the territories before launch. With the author's 2026-10-23 calls (children can be harmed in combat; dismemberment in all fights), a refusal in some territories is likely rather than possible. The territory check before launch is required, with the store's age gate and regional availability set from its result.

## 4. The one notice the game shows itself: photosensitivity

Many games carry a short photosensitive-seizure notice at boot or in the manual, and console platforms have long shown one. We found no UK law that requires it for games (search of 2026-10-22). The Online Safety Act 2023 creates an offence of sending flashing images with intent to harm, which doesn't apply here (from a secondary source; the statute text is unchecked). We show it anyway: it costs one screen, and the game's surreal breaks and fight light earn it even under the flash rule in design/sensory/05-CARE.md section 2.

Text (two lines, house type, ink on the ground, holds for 3 seconds or until a key):

> A very small number of people may have seizures when exposed to certain lights or patterns. If you feel unwell while playing, stop and rest. Flash and motion options are in Settings.

## 5. What the player sees, in order

1. The studio card, then the engine card.
2. The photosensitivity notice (section 4).
3. The opening cinematic (design/CINEMATICS.md), skippable after a first viewing.
4. The title.

On the store page: Steam's own mature-content notice and age gate as the survey produces them, and the regional rating badges Valve generates. We write no extra content notice on the store page. The store description describes the game, in the game's own register.

## 6. What stays, and where

- **Accessibility settings** stay in the settings menu: reduced flashes, motion and shake, the haptics slider, text size and pace, the steady-world option, and scene notes (off by default). They serve players and are not warnings, and nothing at boot advertises them except the photosensitivity notice's pointer to Settings.
- **The internal content list** in design/quota/07-PRODUCTION.md stays complete and current. It feeds the survey answers (section 1) and the sensitivity read.

## 7. Owners and order

| Step | Owner | When |
|---|---|---|
| Audit generated assets for the AI disclosure | Production, with each asset owner | Before M6 |
| Draft the content survey answers from the content list, each answer traced to the scenes it covers | Game director | M6 |
| Check the content against German law, then decide on USK direct review or Valve's self-rating | Author, with advice | M6 |
| Build the boot sequence and the photosensitivity notice | UI lead | With the opening cinematic |
| The author completes the survey in Steamworks | Author (it's the author's account) | M6 |

## Does not prove

The expected band is our guess from published category descriptions, and only a board's decision is a rating. Valve's process and the boards may rate higher or lower, and some content may still need changes for some regions.
