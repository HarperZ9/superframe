<!-- writing-profile: research -->
# Character presentation across the three references (clean-room spec)

Version 2, 2026-10-17. Version 1 used public sources; section 7 adds values read from the installed builds (tags [D] data, [S] structure). Public sources say little about
camera distance, on-screen scale or frame counts, so most of this file is a measurement frame for the
observation session. Tags: **[R]** reported (cited), **[I]** inferred, **[M]** measured (none yet),
**[U]** unknown, **[P]** proposal for Low Water.

This matters most for Low Water's open edge from Phase 3: figures are small on the quay, two people
standing together merge into one shape, and baked crowds read as dark blocks (`PROGRESS.md`, Phase 3
handoff).

## 1. Disco Elysium

- **Camera:** isometric-style fixed view of a controllable figure [R: Wikipedia, citing USgamer 2019-10-16]. Fan reconstructions treat it as orthographic [R: hitmarker.net on a fan project; weak]. Whether it is a true orthographic projection or a narrow-field perspective camera is [U]; measure parallel-line convergence in a capture.
- **Characters and ground:** 3D-modelled, rigged and animated characters [R: MCV/Develop "The Art of Disco Elysium", 2021-03-31] over painted environments. The character pipeline was rebuilt three or four times; an early plan was to hand-paint every character's normal map [R: same]. The environment was painted over renders, with height, normal and shadow maps for each painted texture, so painted ground can take dynamic light and shadow [R: same, 193 painted 4K texture squares with about four times as many maps]. The art lead's brushwork is the unifying element [R: same]. Painter influences named by the studio: Rembrandt, Repin, Saville, Kanevsky, Kandinsky [R: Wikipedia citing ZA/UM Steam news, 2020-01-17].
- **Portraits:** conversations show a painted bust of the speaking character beside the text column [I, widely reported; confirm in session]. Portraits carry the faces; the 3D figure in the world is small, so faces are not readable at play distance [I].
- **Reconciliation, inferred:** world figures carry silhouette and costume colour; portraits carry identity and expression. The 3D figure is lit by the same baked-plus-dynamic light as the painted ground, which keeps it seated in the painting [I from the maps described above].
- **Measure:** protagonist height in pixels at 1080p in three locations (street, interior, large exterior); camera pitch from a floor grid or a known rectangle; whether zoom exists and its range; walk and run cycle frame counts (frames per full cycle at 60 fps) and stride length in body heights; idle loop length; turn behaviour (snap or blend, frames to turn 180 degrees); portrait size as a fraction of screen height, framing (head and shoulders?), whether portraits change with mood; how two figures standing close are kept apart (rim light, outline, value contrast).

## 2. ZERO PARADES: Director's Cut

- **Engine:** Unity 6 [install metadata].
- **Look:** colourful, "psychedelic" environments and characters [R: GamingTrend 2026-05-21]; the Director's Cut adds alternative portraits that separate flashbacks from present-day talk, new full-screen illustrations, and an art-director commentary mode [R: RPG Site, 2026-09-17].
- **Set-piece presentation:** the world turns grey, a spotlight isolates the two figures, and skills appear as vivid images [R: review cited in PRESSURE-SYSTEMS.md section 6]. This is a presentation mode change, not a camera move, as far as reports say [U].
- **Portraits:** a portrait system exists (the Director's Cut adds variants) [R]. Size, placement and animation are [U].
- **Measure:** the same list as section 1, plus: how the grey-and-spotlight mode transitions (frames, fade curve), whether the camera moves in for set pieces, how crowds are drawn at distance (full models, impostors, painted groups), and how the protagonist is kept readable inside a crowd she is hiding in.

## 3. No Rest for the Wicked

- **Engine:** Unity 6 (6000.1.15), IL2CPP; customised Unity per an 80.lv interview [install metadata; R: Wikipedia citing 80.lv].
- **Camera:** high three-quarter view, Diablo lineage [R: Edge, March 2024]. Players report the camera sits close in some areas with little space below the character [R: Steam discussion].
- **Look:** painterly, Caravaggio-inspired: strong light and shadow, saturated colour; the studio avoided both photorealism and cel shading [R: Wikipedia citing IGN First and the FullTime GameDev podcast]. The studio states no generative AI makes its art [R: same].
- **Animation:** the combat is designed around what the animators can produce, with Dark Souls and Monster Hunter as references for attack animation [R: search summary of Mahler statements; Private Division, 2023-12-07]. The reading of enemy animation is the core skill (see COMBAT-FEEL.md).
- **Portraits:** characters speak in conversation with portraits or close framing [U]; confirm.
- **Measure:** player height in pixels at 1080p; pitch and field of view; whether the camera tilts or zooms by area; walk, run and sprint cycle frame counts; attack anticipation poses (how many frames of held anticipation before a heavy swing); silhouette readability: is there an outline or rim light on the player and enemies against dark ground; how characters are separated from a busy painted background (value, saturation, edge light); dialogue framing.

## 4. Comparison grid for the session

Fill one row per game after capture.

| Measure | Disco Elysium | ZERO PARADES | No Rest for the Wicked |
|---|---|---|---|
| Player height, px at 1080p (street / interior) | measure | measure | measure |
| Camera pitch (degrees from horizontal) | measure | measure | measure |
| Projection (ortho or perspective, fov) | measure | measure | measure |
| Zoom range | measure | measure | measure |
| Walk cycle, frames at 60 fps | measure | measure | measure |
| Run cycle, frames | measure | measure | measure |
| Turn 180, frames | measure | measure | measure |
| Idle loop, seconds | measure | measure | measure |
| Figure separation device (rim, outline, value) | measure | measure | measure |
| Portrait size, % of screen height | measure | measure | measure |
| Portrait framing and animation | measure | measure | measure |

## 5. Proposals for Low Water [P]

1. **Two scales for one person.** Like the reference pattern (small figure in the world, painted face in
   conversation), Low Water could keep figures small on the quay and give identity to a talk-panel
   portrait. Low Water's own form: the portrait is a pencil-and-wash sketch in Lamb's Daybook, drawn
   under the light of that moment (sodium-orange, paraffin-true), so a portrait also tells the time.
2. **Separate figures by value and an edge of the other light.** Two people together merge today. Give
   each figure a thin rim from the nearest light source of a different temperature (sea-glow behind,
   sodium in front), so overlapping silhouettes split along a bright edge.
3. **Raise figure height.** Set a target from the measured references: if the references put the
   player at a given share of screen height, set Low Water's quay camera to match the largest of them
   and justify any smaller value.
4. **Crowds as painted groups with one live figure.** Baked crowds read as blocks. Paint the crowd with
   value breaks between heads and shoulders, and place one animated figure at its edge so the eye
   reads it as people.
5. **A set-piece light mode.** For Squalls, drop the sodium plate to near-black except a lantern
   circle, as the PRESSURE-SYSTEMS proposal describes. This also solves readability in the tensest scenes.

## 7. Data-derived presentation values (v2, 2026-10-17)

### 7.1 Disco Elysium [D][S]

- **Camera: orthographic, true isometric.** The gameplay camera in a sampled scene is orthographic with a
  half-height of 7.38 world units, pitched 35.26 degrees below horizontal (the classic isometric angle,
  arctan of 1 over root 2) [D]. The camera controller keeps separate zoom limits for exteriors and
  interiors, a zoom curve, a focus curve, pan speed and mouse-wheel smoothing [S]. A camera position
  quantizer component exists [S]: the camera snaps its position to a grid so the painted ground never
  shimmers under sub-pixel motion [I].
- **Character scale [I from D]:** at a 7.38 half-height, 1080 vertical pixels cover 14.76 m, about 73
  pixels per metre, so a 1.8 m figure stands about 130 pixels tall (12% of screen height) at the sampled
  zoom. Zooming in raises this.
- **Portraits:** 174 of 424 dialogue actors carry a portrait reference [D]; the rest are voices, objects
  and minor figures that speak without a face.
- **Painted ground:** 3D characters over painted plates with height, normal and shadow maps (version 1,
  MCV 2021) [R]; the orthographic, quantized camera is what lets a hand-painted plate act as the world [I].

### 7.2 No Rest for the Wicked [D]

- **Camera:** perspective, pitched 45 degrees down, vertical field of view 56.5 degrees, far plane 250 m;
  allowed pitch range 0 to 70 degrees; no field-of-view change when locked on [D]. Camera distance is set
  in presentation assets not decoded yet, so on-screen character height is still to measure [U].
- **Animation:** 1,260 clips in the gameplay asset bundle; 1,250 are sampled at 60 Hz, 10 at 30 Hz [D].
  Clip length median 100 frames, 10th percentile 44, 90th percentile 191 [D]. Actions retime their
  animations per segment (frames added or removed per segment) and with eased time-scale regions [D].
- **Locomotion feel [D]:** acceleration 80 m/s2, deceleration 40 m/s2, rotation 720 deg/s, gravity 34
  m/s2, max fall speed 25 m/s. A 180-degree turn while running is a 55-frame action, cancellable into a
  quick step for its first 15 frames and free from frame 15; while walking 78 frames, free from frame 23.
  Root motion carries the body through turns (0.2 to 0.3 m).
- **Readability devices:** telegraph retiming (COMBAT-FEEL section 6), Caravaggio-style light (version 1)
  [R].

### 7.3 ZERO PARADES [S][D]

- The build ships an orthographic camera utility module and a cinematic camera framework; per-scene
  camera behaviour is driven by camera actions placed in content [S]. A screen overscan setting allows up
  to 6.3% of screen size [S]. Gameplay camera angle and size are set at run time and still need a capture
  [U].
- Director's Cut adds alternative portraits for flashbacks [R]; the content model gives each dialogue card
  an optional alternate-portrait id [S], so portrait choice is per line, not per character.

### 7.4 What this means for Low Water [P]

- Low Water's painted plates match the Disco Elysium model: an orthographic camera at a fixed pitch with
  position quantized to the plate's pixel grid. Adopt the 35.26-degree pitch if the plates are rendered
  isometric, and snap the camera to whole plate pixels.
- Target figure height: 130 pixels at 1080p is the Disco Elysium baseline at default zoom; Low Water's quay
  figures read small today, so start at 130 to 160 pixels and give interiors a closer zoom limit than
  exteriors, as the reference does.
- Put portrait choice on the line (an optional portrait id per dialogue node), so a face can change with
  the light or the moment.
- Author animation at 60 Hz and retime per segment rather than re-animating, as No Rest for the Wicked
  does.

## 6. Sources

- MCV/Develop, "The Art of Disco Elysium", 2021-03-31: https://www.mcvuk.com/business-news/we-knew-immediately-that-we-needed-to-make-a-game-with-a-striking-and-unique-look-to-accompany-the-writing-a-look-that-would-balance-the-mundane-with-the-unfamiliar-and-strange-the-art
- Wikipedia, Disco Elysium and No Rest for the Wicked, read 2026-10-16: https://en.wikipedia.org/wiki/Disco_Elysium ; https://en.wikipedia.org/wiki/No_Rest_for_the_Wicked_(video_game)
- Edge, March 2024: https://www.pressreader.com/australia/edge/20240321/282106346617078
- Private Division announcement, 2023-12-07: https://www.businesswire.com/news/home/20231207867055/en/Private-Division-and-Moon-Studios-Announce-No-Rest-for-the-Wicked/
- RPG Site, Director's Cut, 2026-09-17: https://www.rpgsite.net/news/21425-zero-parades-directors-cut-ps5-release-date-pc-free-update-patch
- GamingTrend review, 2026-05-21: https://gamingtrend.com/reviews/zero-parades-for-dead-spies-review/
- hitmarker.net on a fan reconstruction (weak source): https://hitmarker.net/news/incredible-fan-made-vision-of-disco-elysium-brought-to-life-in-first-person-using-ue5-and-blender-2379272
