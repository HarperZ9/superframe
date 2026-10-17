<!-- writing-profile: research -->
# Low Water: systems design

Draft 2, 2026-10-16. Private. Companion to `bible/WORLD-BIBLE.md` (the story) and
`design/LOOK-BIBLE.md` (the look). The game is judged by how it plays and how it looks. Section 12
says which parts of the engine exist today and which do not; the playable prototype in `game/`
uses the ones that do.

## 1. Design rules

1. No dice. What happens depends on what Lamb has noticed and on the weather, tide, wind and light
   at that minute.
2. When a claim lands or fails, the person tells you why, in their own voice: a look at a dry coat,
   a laugh at a flatfish. The game never shows a tally of what you hold.
3. The night moves only when Lamb does something. Walking, talking and reading all take minutes.
   There are no timed choices.
4. The instruments are how the player feels the world: everything that matters to a rule can be
   read through the Kit, in the instruments' own voices.
5. Thresholds have a little slack (hysteresis), so a rule does not flicker on a boundary.
6. Colour in the interface never carries meaning alone. Colour inside the fiction (the green
   prism) is always backed by something an instrument can say in words.

## 2. The environment state, as Low Water uses it

Low Water is a consumer of ADR 0017's environment state. It uses these terms, and adds four zone
terms and two derived terms of its own.

| Term | Unit and range | Source | Used by |
|---|---|---|---|
| hour | 0 to 24 | ADR 0017 time group | Schedules, look keys, every window in the clue table |
| rain rate | mm/h, 0 to 20 | ADR 0017 moisture | Print erosion, scale wash-off, noise for hearing, the Damp saturating |
| surface wetness per zone | 0 to 1 | ADR 0017 moisture (accumulates and dries by rule) | The Damp's readings, wet reflections, spray on coats |
| fog density and height | 1/m, 0 to 0.2; m | ADR 0017 atmosphere | Being seen, overhearing, the dither look's fog to paper white |
| wind direction and speed | degrees, m/s 0 to 25 | ADR 0017 wind | Hearing downwind, spray, smoke and soot, rain under eaves |
| temperature | °C | ADR 0017 temperature | Frost holding prints, people going indoors |
| light per point: key level, direct-to-ambient balance | 0 to 1 | ADR 0017 light group and `lightAt` | Being seen, noticing, which characters will speak |
| **tide height** (Low Water zone term) | m above chart datum, -0.6 to 5.4 | Harmonic tide (section 4) | Access, prints flooding, the Almanac |
| **power per zone** (Low Water zone term) | on, off, restarting | Command log (switches) | Blackout look, sodium restart, Mother |
| **sodium fraction per point** (derived) | 0 to 1 | Lights in range by type | Colour legibility (section 6) |
| **spray per zone** (derived) | 0 to 1 | wind speed x exposure x (1 - tide cover) | Wetting coats on the mole; evidence C6 |
| **Mother state** (Low Water zone term) | burning, dark, hot-locked | Power and restrike | The beam in fog, the Flats look, the ferry's peril |
| **rumour pressure per district** (game state, read through the Glass) | 0 to 1 per fact | Section 8 | Who already knows what |

Commands Low Water issues, all logged with source and reason as ADR 0017 requires:
`setWeatherTarget`, `wet(zone, amount)`, `setPower(zone, state)`, `restrike(lamp)`,
`addRumour(fact, district, weight)`.

## 3. The Kit: instruments as the read interface

The five instruments are how the player reads state. Each instrument is a pure function from a
snapshot and a target to a **reading**: a value with a unit, a confidence word and a sentence in
the instrument's voice. A reading can put a **note** in the Daybook when it matters (a dry coat, a
wet trouser leg).

```
read(instrument, target, snapshot) -> { value, unit, words, facts[] }
```

| Instrument | Query on the snapshot | Fact examples |
|---|---|---|
| Candlemas | `lightAt(p)`: key level, balance, light kinds present with fractions; hue of target if legible | `lens.green_rings`, `prism.true_numbered`, `sodium.restart_physics` |
| The Glass | pressure and trend from the weather target; rumour pressure of each fact in this district | `forecast.rain_2335`, `rumour.keel_knew.spread` |
| The Almanac | tide height now and its schedule; gates opening and closing | `floor.open_2150`, `gully.depth_at(t)` |
| The Damp | humidity; wetness of target and its drying age | `coat.wenna_dry`, `trousers.merrow_wet_thigh`, `ink.log_same_age` |
| The Vane | wind at the player; where sound, spray and smoke from a source travel | `spray.mole_since_2100`, `soot.east_before_veer` |

Instrument limits are mechanics, not flavour. Candlemas refuses hue when the sodium fraction at
the target is above the legibility threshold (section 6). The Damp reads "saturated" for twenty
minutes after the player stands in rain and must be dried at a stove (costs 10 minutes). The Vane
reads only where the player stands. The Glass forecasts one hour.

## 4. The tide clock

The tide is the master schedule. It is a sum of two harmonic constituents, set for the spring low
of the night:

```
h(t) = h0 + A_M2 cos(2 pi (t - t0) / 12.42 h) + A_S2 cos(2 pi (t - t0) / 12.00 h + phi)
```

with h0 = 2.4 m, A_M2 = 2.2 m, A_S2 = 0.75 m and phase chosen so that low water is -0.55 m at
22:58 and high water is 5.3 m at 05:10. The numbers are authored; the shape is a real tide's.

Gates use hysteresis bands so a gate does not open and close on a ripple. Heights are metres
above chart datum; low water on the night is -0.55 m, so every gate on the floor sits just above it.

| Gate | Opens when h falls below | Closes when h rises above | On the night |
|---|---|---|---|
| The gully, floor to the drowned lamp | -0.37 m | -0.35 m | Open 22:17 to 23:42 |
| Lowest three quay steps | -0.31 m | -0.27 m | Open 22:08 to 23:48 |
| Drowned lamp base (the hole) | -0.27 m | -0.23 m | Open 22:05 to 23:52 |
| Gully depth (wading) | reported continuously | | Ankle at 22:20, knee by 23:30 |

Near low water a harmonic tide rises slowly, then faster: the floor gives the player a little over
an hour after low water, and takes it back in the last fifteen minutes. That shape is the hour of
the vertical slice.

The Almanac shows the curve and every gate. Planning against it is the game's main tension: the
floor closes whether or not the player has read it.

## 5. Environment-check grammar

Every check in the game is one of six kinds of moment. Each reads the world as it is now and what
Lamb has noticed.

```
NOTICE   target                         if  light(target) >= L_n  and  in_view(target)  and  dist <= D_n
READ     instrument target              ->  reading (section 3)
REACH    place                          if  gate(place) open (tide, power, lock)
OVERHEAR speaker at place               if  hearing(speaker -> player) >= 1
CLAIM    statement TO person            if  Lamb has the right notes  and  stance(person, place) allows
ERODE    evidence                       legibility(evidence, t) falls by rule; below 0.3 it is gone
```

### 5.1 Noticing and being seen

```
light(p)       = key level at p from lightAt, in 0..1
fogT(a, b)     = exp(-density x distance(a, b))         (transmittance)
seen(p by o)   = light(p) x fogT(o, p) >= 0.22  (hysteresis 0.18 / 0.26)  and  line of sight
```

Under a sodium lamp light(p) is about 0.6, so the Lamplighters see the player at thirty metres in
clear air. In fog at 0.08 per metre the same player at thirty metres has a transmittance of 0.09
and is not seen. In a blackout light(p) is near 0.02 unless the player carries a lantern, which
adds 0.35 within its radius: carrying light makes you seen.

### 5.2 Overhearing

```
hearing(s -> l) = loudness(s) / distance(s, l) x (1 + 0.08 x wind_speed x max(0, cos(theta)))
                  x (1 - 0.6 x rain_noise) x cover
theta  = angle between the wind vector and the direction from speaker to listener
cover  = 1 if the listener is unseen by the speaker (fog, dark, a wall with a louvre), else 0.3
```

A conversation is overheard when hearing is at least 1 for its whole length. People speak freely
only when they believe they are unheard, so cover matters more than distance. Downwind of the
Brine's back yard in a westerly with fog, the player hears Sabine and Wenna at twelve metres. Upwind,
in clear air, the player must stand at the door and is seen.

### 5.3 Claims and stance

A claim is a statement the player puts to a person in dialogue. It needs facts. It also needs the
person's **stance** at that place and light to allow it.

| Stance rule | Who | Effect |
|---|---|---|
| Speaks true only in the dark | Fennick | Below light 0.1 he answers the reliquary questions; under any lamp he recites |
| Lies best under the lamp | Keel | Under sodium his wreckers story is fluent; in the dark he loses his place and contradicts himself |
| Watched | Anyone within sight of a Lamplighter | Refuses claims that touch the Trust; says "Not here." |
| Wet | Merrow | Will not talk on the floor while the tide rises; talks at the stove |
| Closing time | Sabine | After the bar is quiet (fewer than three drinkers) she trades truths for silence |

When a claim lands, the scene shows it the way people show things:

> LAMB: "Your coat is dry, Mrs Tallow."
> She looks at the coat for a long time. She smooths it over her knee as if it were a cat.
> "It's a good coat," she says. Then: "All right."

When it fails, the person enjoys it, and the player learns what was missing from what they say
("It's an oilskin. It's what they're for. Water runs off.").

### 5.4 Erosion

Evidence in the world decays by rules the player can read.

| Evidence | Legibility rule | Reading it |
|---|---|---|
| Prints in mud | L(t) = exp(-integral of rain rate dt / 1.5 mm); 0 when tide covers | The Almanac for the flood; the Glass for the rain |
| Scales on the switch handle | L(t) = exp(-integral of (rain rate x eave exposure(wind)) dt / 0.8 mm); exposure is 0 in a westerly, 0.9 in a south-westerly | The Vane |
| A wet coat drying | wetness(t) = w0 exp(-(t - t0) / tau), tau = 50 min at the stove, 140 min indoors | The Damp dates it |
| Soot on a wall | constant until rain over 4 mm/h | The Vane for when the wind put it there |
| Frost prints (dawn) | appear below 1 °C on wet ground; gone at sunrise plus 20 minutes | Eyes |

## 6. Sodium colour loss as a mechanic

Low-pressure sodium light is nearly a single spectral line at 589 nm. Under it every surface
reflects the same hue, so colour vanishes, and only there. The engine models this spectrally
(`web/shaders/sodium`): its measured palette spread is 0.0001 under pure sodium against 0.64 under
a warm window, and its design rule, found in the study, is to keep the sky fill low where sodium
should erase colour (SODIUM-LIGHT-RESULTS.md).

The game rule:

```
sodium_fraction(p) = E_sodium(p) / E_total(p)            (from the lights in range, by type)
hue_legible(p)     = sodium_fraction(p) <= 0.55   (hysteresis: becomes legible below 0.5,
                                                    illegible above 0.6)
```

Colour evidence is authored as spectral materials, so what the player sees and what the rule
says agree:

| Evidence | Under sodium | In paraffin or the lantern | Where to carry it |
|---|---|---|---|
| A green bottle-glass prism | olive-grey | green | The Brine's doorway, or by lantern |
| A red Guild armband on the switch hook | dark brown | red | Away from the quay posts |
| A blue Municipal cap left at the steps | grey | blue | The lantern |
| Mother's lens rings | all dark | a third green, once relit | The lamp room |

Candlemas states the rule in its voice and the interface states it in words:

> CANDLEMAS: "Sodium, eighty-one parts in a hundred. I see one colour and it is not yours. Take
> it to a fire."

Test from the look work (`frames/kf2-colour-comes-back.png`): the same three objects on two crates,
one under the quay lamp, one in the Brine's doorway, through the engine's sodium shading. The prism,
rag and cap read olive, brown and grey on the left and green, red and blue on the right.

## 7. Blackout and the dither-lit districts

**Power zones.** Lamp Quay, the Gut, Chancel Hill and Mother are zones with a power state: on, off,
or restarting. The quay board (the weigh-house switch) controls Lamp Quay and, since the rewiring,
Mother. The player can pull it too. A blackout is not a cut scene; it is a state of the town.

**What a blackout changes.**

| In a blackout | Rule |
|---|---|
| The look | The zone switches from the painted, graded look to dither-quantised lighting: two tones in an interior, four outdoors, fog to paper white. Lanterns and beams are the only light masks |
| Seeing and being seen | light(p) falls to the dark level; the Lamplighters cannot see the player outside lantern radius |
| Stance | Characters whose stance depends on light switch (section 5.3). The town is more honest in the dark and more frightened |
| Colour | Nothing is legible without a carried light: sodium is off and the dark has no colour |
| Danger | Steps and the quay edge are not visible; moving without a lantern costs double time, and walking a marked edge in the dark is a fall into the harbour every time, never by chance (soaked, the Damp saturated, 20 minutes lost) |
| Restart | Sodium lamps restart through a red phase for about ten minutes (the "pink" testimony). Mother's arc, once hot, will not restrike without a hand at the panel |

**The Flats** are always dark. They use the four-tone dither look at all hours of the night, with
Mother's beam, when she burns, as a shaped beam mask that sweeps the fog.

## 8. Rumour pressure

What the player says travels. Each claim made in someone's hearing adds rumour pressure for that
fact in that district. Pressure spreads to neighbouring districts each half hour, faster downwind,
and decays slowly.

```
p(fact, district, t + 30 min) = 0.85 p(...) + 0.25 x sum over neighbours of p(neighbour) x wind_factor
```

Effects: when pressure on a fact passes 0.5 in a district, the people there already know it.
Characters with something to lose act on it (Keel moves papers, Sabine hides the tab). Characters
with something to gain come to the player. The Glass reads pressure as weather:

> THE GLASS: "It's blowing up in the Gut, darling. They're saying the Board knew."

## 9. Economy

Four currencies and one condition, all in the Daybook.

| Resource | Gained | Spent | Why it matters |
|---|---|---|---|
| **Minutes** | Never; the night is fixed, sunset to dawn | Every action: a conversation 5 to 20, a read 2, a walk between places 3 to 8, drying the Damp 10 | Windows close; the tide and weather do not wait for a player who spends time |
| **Paraffin** (lantern fills) | Bought at the Brine, given by the Congregation, found on the floor | Lantern time, 30 minutes a fill | Carried broadband light: reads colour, lights the dark, and makes the carrier visible |
| **Chits** (Shelf vouchers) | Issued by the Shelf at the start and by tube | Paying for drinks, information, a boat | Their acceptance falls as rumour that the Shelf has failed rises, so money weakens through the night |
| **Favour** (per faction) | Claims that protect a faction's private want; help given | Asking for access, documents, silence | Favour opens doors and closes others |
| **Dryness** (a condition) | Stoves and indoors | Rain, spray, wading, falling in | When the assessor is soaked, the Damp saturates and people treat the assessor as one of the town (some speak more, the Board speaks less) |

There is no inventory weight and no crafting. A clue is not an item; it is a note in the Daybook,
in Lamb's hand.

## 10. The Daybook, the verdict and saving

**The Daybook** is Lamb's notebook: what Lamb has noticed, who said what, a sketch of the quay with
the tide line pencilled in, and at the end the verdict. A verdict names a cause. In the full game
Lamb can split the blame between parties, but only blame someone Lamb has a case against; the
Daybook makes that plain by what is written in it. The slice asks for a provisional cause at
midnight; the full game takes the verdict at dawn.

**Saving.**
1. Save anywhere, any time. Real life comes first.
2. Saves keep working across updates: a save carries a version number, and the game upgrades old
   saves when it loads them.
3. Reloading does not change luck, because there is none. To change how a scene goes, notice more
   or go at a different hour.
4. **Ink mode** (optional, chosen at the start): one save slot, written on every action, and the
   Daybook cannot be torn out. For players who want the night to be final.
5. Past verdicts are kept on a shelf in the title screen, so a player can see what different
   verdicts did to the town.

## 11. Settings that touch the look

The engine already has a player-facing lens settings layer (`web/shaders/lens/settings.mjs`,
merged): flare 0 to 1.5, anamorphic streaks on or off, halation 0 to 1.5, colour fringing on or
off, and a flash-safe switch, with presets `default`, `reduced-flash` and `off`. Defaults are the
identity. Low Water adds, as design only: dither strength (blend toward a smooth tone), a
photosensitivity switch that also stops lamp flicker and Mother's beam strobing in fog, text size,
and a high-contrast dialogue panel. No game UI exists to show any of them yet.

## 12. Engine map

Every system against the engine features it needs, and their state on `origin/main` (92934a8).

| System | Engine feature | State on origin/main | Notes |
|---|---|---|---|
| Painted places | Paint-over projection: painter, projector with keyframe blend, WGSL pass | Exists (`web/shaders/paintover`) | Lamp Quay needs three keyframes per place: two leave gaps behind the posts and Mother when the camera swings |
| Time-of-day look | Look keys, 8 slots, monotone cubic | Exists (`web/look/keys.mjs`) | Low Water's grade terms are authored on it (`render/grade.mjs`, `render/dawn.mjs`) |
| Hour grade of a painting | Paint-over grade (`grade.mjs` gradeFrame, glowOf) | Exists | Used for the dawn frame and the eight-slot strip with Low Water terms |
| Sodium colour loss | Spectral sodium shading, response table, WGSL | Exists (`web/shaders/sodium`) | Used here on our own scenes through its G-buffer layout; materials appended to its table |
| Lamps, the beam, glare | Lens suite: ghosts, starburst, anamorphic streak, halation, dispersion, slot-keyed | Exists (`web/shaders/lens`) | |
| Lens player settings | `settings.mjs` | Exists | No UI |
| Blackouts, the Flats | Dither-quantised lighting: N tones, radial and beam masks, fog to paper white, haze | Exists (`web/shaders/ditherlight`) | Second look (haze, PR #146) is on main through `haze` input |
| The Gut | Palette-locked lighting with palette cycling | Exists (`web/shaders/palettelight`) | Its classes (ground, stone, wood, foliage, void, window, lamp) are fixed; the Gut is authored onto them |
| Isometric camera | `paintover/camera.mjs` iso and perspective cameras | Exists | |
| Game loop, input actions, rebinding, picking | G1 web runtime (`web/game/loop.mjs`, `input.mjs`, `pick.mjs`, `cameras.mjs`) | Exists (web, JavaScript) | Per D2 the shipped runtime is the one C++ core; these are reference implementations until then |
| Environment state hub (E0: time, weather, wind, wetness) | ADR 0017 | Design (Proposed) | Not built beyond the slot curves |
| Tide, power zones, spray, Mother state | Low Water zone terms on ADR 0017 | None | Design in this document |
| Tide-memory wetness (drying bands) | EFFECTS-PROGRAM candidate | None | Candidate; the Damp's drying ages are its gameplay face |
| Cross-fade painted to dither (blackout) | A mode switch between two passes | None | Both passes exist separately |
| Instruments, checks, erosion, stance, rumour | BuildLang gameplay modules, engine queries `lightAt`, `isWet`, `windAt` | None | Queries are named in ADR 0017; no code |
| Dialogue | BuildLang dialogue modules and a dialogue UI | None | Data format drafted in `slice/LWD-FORMAT.md` |
| Daybook and verdict | Data model and UI | Prototype in `game/` | |
| Save and load | G3 | None | |
| Audio: zone ambience, cues on environment events | G2 game playback; the web mixer exists | Partial: film mixer only | |
| Navigation on the quay | Grid or mesh navigation, G1 picking | Picking built; navigation none | |
| Wet reflections on painted places (traced layer) | EFFECTS-PROGRAM candidate | None | Candidate |
| Native presentation, Vulkan raster | N2, N3 | N2 merged recently (PR #160); N3 none | Renderer milestones lead |

## 13. What this document does not settle

- Numbers in sections 4 to 9 are first values, to be tuned in the vertical slice against play
  sessions. None has been tested on players.
- Whether rumour pressure is shown to the player beyond the Glass's sentences.
- Whether Ink mode ships.
- The author's approval of the stance rules, which carry much of the characters' design.
