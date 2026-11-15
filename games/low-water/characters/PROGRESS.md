<!-- writing-profile: research -->
# Characters: progress

Character art and animation lead for Low Water. Brief: 2026-10-16, from the coordinating session,
after the author's verdict (paraphrase of a spoken message): the characters lack detail, their
animation is inconsistent, the game must step up to a serious production, and combat in the style of
No Rest for the Wicked (dodges, attacks) is wanted.

Rules: CPU only and Idle priority (the GPU is held by MMBU FT8 until about 03:00 to 05:00Z on
17 October), at most two heavy jobs at once, no visible windows. Nothing leaves the machine except
engine PRs to HarperZ9/raw-native. Clean room: the reference games are never opened; behaviour
reaches me only through cleanroom/spec/. I own characters/ and the character art and rig assets.

## Steps
1. DONE Read PROGRESS.md (with the Phase 3 handoff), design/LOOK-BIBLE.md, design/PRODUCTION.md,
   design/STATE.md, design/NOTES-FOR-ENGINEER.md, bible/WORLD-BIBLE.md sections 6 and 7; looked at
   playthrough stills q02, q05, q10, q16. cleanroom/spec/ is empty as of this step.
2. DONE Audit (AUDIT.md): the current figures are Canvas 2D cutouts in game/figures.mjs, one side
   view, two animation states; raw-native has no skinning, no clip sampler and no glTF skins, and
   every style pass it has (painter, dither, palette lighting) takes a G-buffer.
3. DONE Rig: rig/skeleton.mjs (20 joints plus two hanging joints that keep a lantern vertical,
   semantic pose channels, FK, mirror), rig/body.mjs (ring tubes with per-ring skin weights,
   linear-blend skinning), rig/sdfmesh.mjs (signed-distance features smooth-unioned and polygonised
   by marching tetrahedra, for heads), rig/materials.mjs (ids, true colour, sodium value, brushwork).
4. DONE Clip library: anim/pose.mjs (phase layout, monotone cubic sampling, events),
   anim/stances.mjs, anim/locomotion.mjs, anim/combat.mjs, anim/library.mjs; 21 clips: idle, walk,
   run, turn, stop, talk_a/b/c, examine, dodge_f/b/l/r, light_1/2/3, heavy, hit, stagger, fall,
   getup. All lengths come from anim/timing.json (startup, active, recovery, iframes, cancel, move,
   hit), per character overrides allowed.
5. DONE Cast: cast/lamb.mjs (hero), cast/fennick.mjs, cast/marrow.mjs (Guild), shared parts in
   cast/parts.mjs. Each has a style layer over the shared clips (Fennick's jar arm, Marrow's stance).
6. DONE Prototypes of the top two pipelines on the baked plates (proto/compare.mjs, outputs
   out/cmp-*): A real-time skinned mesh with object-anchored brushwork, banded light and ink;
   C the engine's painter over the same G-buffer, relit. Measured: proto/bench.mjs (A about 5 ms a
   figure at 110 px, 10 ms at 180 px, Node, Idle priority), proto/boil.mjs (frame-to-frame change on
   neighbouring idle frames: A 0.0018, C 0.0131 mean; one pair, one pose).
7. DONE Runtime: runtime/actor.mjs (play with cancel windows, update with root motion, iframes, hit
   flags, weapon segment and hurt capsule from the skeleton, render). proto/actor_test.mjs drives it
   as the combat engine would: all expectations pass.
8. DONE Look pass: sculpted heads (signed-distance features smooth-unioned, three levels of detail by
   scale), self-shadow from the dominant lamp (render/raster.mjs castShadow), light quantised by
   brightness only, violet shadow step, a fresnel rim from the lamps, ground contact for lying
   poses, shoulders rebuilt, Fennick's surplice and stole, Marrow's apron.
9. DONE Read cleanroom/spec/CHARACTER-PRESENTATION.md and COMBAT-FEEL.md (landed during the work),
   the combat engineer's interface in design/NOTES-FOR-ENGINEER.md, game/engine/combat/TUNING.md and
   anim/drive.mjs (read only). Combat is the clock; its out/timing.combat.json is authoritative.
10. DONE Fray clips under combat's names (anim/fray.mjs): strikes per tool class (one-handed,
    two-handed with IK, the claims case as a shield), step, roll_dash, roll, roll_hop, lurch with
    f/b/l/r, riposte, shove, grapple, use_lantern, use_bottle, parried, ducked, knockdown, fall,
    getup, yield, guard per class, wade; opponent specials aliased. 100 clips in all.
11. DONE Tools as props (cast/tools.mjs) on the shared grip axis, Lamb's loadouts (the Vane's
    folding stick with the tin cockerel, the claims case, boathook, pole, knife, hammer, crowbar,
    hands); the lantern moves to the belt when the left hand is busy; parts can be hidden (a thrown
    lantern, a set-down jar, a dropped tool). Two-bone IK puts the left hand on two-handed shafts
    (rig/ik.mjs, rig/solvefig.mjs).
12. DONE Runtime rewritten for both clocks: actor.drive() takes combat's poseOf() each frame;
    cast.clips() gives drive.mjs its clip table; runtime/draw2d.mjs draws an actor into the Canvas 2D
    prototype with the drawPerson contract. proto/actor_test.mjs: all expectations pass, including
    "every clip combat lists for Lamb has art" and "a startup change in combat's numbers changes the
    clip with no re-keying".
13. DONE Reply in design/NOTES-FOR-ENGINEER.md (interface, asks A1 and A2, camera recommendation,
    prototype hook through draw2d.mjs needing a /characters/ mount). design/CHARACTERS-ART.md
    written (rules, the three, what the rest of the cast needs).
14. DONE Engine PR HarperZ9/raw-native#171 (branch feat/web-anim-skinning, worktree
    a raw-native worktree off origin/main e46ff48): web/anim skeleton, skinning,
    phase-timed clips, warp, two-bone IK, 11 node tests, changelog.d entry. Nothing under
    src/renderer/gpu/shaders. All CI checks green; merged 2026-10-17 01:25Z with --match-head-commit
    4ed7058 as aeb1538. The Low Water worktree (feat/low-water-host) does not carry it yet.
15. NOTE Rule slip, reported: once, four short pose-sheet renders ran together while the two reel
    lanes were running (six node jobs for a few seconds, over the limit of two heavy jobs). After
    that, extra renders waited for the lanes.
16. DONE Stills (characters/stills/): 01-quay-distance (current against new at today's camera, at
    1.35x, and at a 2.5x camera, with details), 02-rooms (the Brine, the weigh-house), 03-closeups
    (current enlarged, new real-time, new painted), 04-cast-turnaround (three characters, four
    angles), 05-pipeline-a-vs-c. Reel: characters/reel/low-water-characters-reel.mp4 (87 s, 30 fps,
    H.264): old against new on the quay, turntable, Lamb's calm and first combat set, Fennick and
    Marrow, the Fray set under combat's names with each tool, and a scripted exchange on the quay at
    a 2.5x camera driven through the actor runtime. Frames rendered offscreen on the CPU at Idle
    priority in two lanes (proto/reel.sh, proto/reel.mjs), joined by proto/reel_build.py.
17. DONE Browser check of the runtime (proto/draw2d_check.py: headless Chromium, GPU disabled): two
    actors drawn through runtime/draw2d.mjs at today's quay scale, median 8.9 ms a frame. Found and
    fixed: render/rigs.mjs pulled a Node-only module into the browser.

## My verdict, looking at the stills and the reel
- At play distance the new figures only pay off with a closer camera. At today's quay camera, true
  scale, they read worse than the old cutouts, which are drawn 1.2x as flat graphic shapes. At 1.35x
  they read as people; at a 2.5x camera they read as these people, with costume, tool and pose.
- Two people together no longer merge at the closer camera: value design and the lamp rim split them.
- Up close the faces and clothes carry far more than the cutouts, but they read as stylised CG with
  brushwork, not as paintings like the plates. The painter path softens that for portraits only.
- Animation is consistent across the cast (one skeleton, one library); the combat set reads, and
  combat's own numbers drive it. Coats do not swing, feet slide a little, hands are fists.

## How to run (from characters/)
- Tests of the runtime against combat's data: `node proto/actor_test.mjs`
- Pose sheets: `node proto/sheet.mjs <lamb|fennick|marrow> <clip> 8`, review with `python proto/montage.py`
- Plate composites: `node proto/compare.mjs <quay|brine|weigh> <A|C> <zoom> [clip] [frame]` (FIG_SCALE=1.35 for the scale variant)
- Close-ups: `node proto/closeup.mjs`, `node proto/closeup_c.mjs`; turnaround: `node proto/turnaround.mjs`
- Stills: `python proto/stills.py`; reel: `bash proto/reel.sh <frames dir>` then `python proto/reel_build.py <frames dir> reel/low-water-characters-reel.mp4`
- Cost and steadiness: `node proto/bench.mjs`, `node proto/boil.mjs`; browser: `python proto/draw2d_check.py`
18. DONE Coordinator, mid-work (2026-10-17): CHARACTER-PRESENTATION.md v2 section 7. Applied: the
    camera recommendation restated against its 130 to 160 px at 1080p target (2 to 2.5x on the quay,
    orthographic, pixel-snapped; PIPELINE.md section 6, NOTES); calm turns retimed from its numbers
    (turn 39 frames free from 12; new turn_run 28 frames free from 8, 0.25 m root; timing.json
    `_spec`); `free` added to clip events. Clips stay driven by combat's export, so COMBAT-FEEL v2
    retuning reaches them with no art change. Flag for the coordinator: v2 tags values "read from the
    installed builds" ([D]); cleanroom/PROGRESS.md step rules said no reading of game files. That is
    the study role's boundary to answer; I opened no game file and used only the spec.
19. DONE Coordinator ruling (2026-10-17): the study role is the dirty team, authorized by the author
    to take the games apart; I am the clean team and build from specs only. Spec v2 is a valid source.
20. DONE Look pass 2 (toward the plates): the light bands' edges follow object-anchored brush noise
    (painted planes, not gradients), brushwork 1.6 times stronger so it reads at play size, the
    sodium ramp pushes value designs apart (pale to cream, dark to ink), close-ups banded, and the
    painter fed the banded light with bigger strokes so its brushwork shows (stills/03).
21. DONE Cloth and secondary motion: two coat-skirt spring joints per figure (4 skin weights a
    vertex now); springs driven by thigh swing, acceleration, speed and turning, underdamped
    (a stop throws the hem forward and it settles); the lantern swings on its own spring.
22. DONE Foot sliding: a loop's ground speed is measured from the planted foot over the cycle
    (walk 1.57, run 4.15 m/s for Lamb); when something else moves the figure (the shell, combat) the
    loop plays by the ground covered, so the feet hold at any speed.
23. DONE Hands: an open and a fist shape a hand, as parts; a hand holding something stays a fist;
    clips choose (shrug, shove, yield, the lantern throw, grapple, the mud throw).
24. DONE Enemy bodies: cast/warden.mjs (holder) and cast/salvor.mjs (skirmisher), and their six
    clips (anim/specials.mjs: holder.drag, holder.chain, holder.braced, skirmisher.mud,
    skirmisher.rope, skirmisher.scuttle) replacing the aliases.
25. DONE Prototype wiring (coordinator gave me game/main.mjs; /characters/ mount by the systems
    engineer): figures through runtime/prototype.mjs and draw2d.mjs at CAMERA.md's scale (2.25 quay,
    1.75 rooms), eased, pixel-snapped, talk framing of Lamb and the speaker; ?wide and ?cutouts
    fall back. Captured headless at Idle (proto/proto_capture.json): stills/06 to 08,
    reel/low-water-prototype-capture.mp4. Looked at: playable, figures read at the new scale; the
    upscaled plates go soft until the re-bake; Keel, Sabine, Wenna, Merrow are still cutouts.
    The game stays playable at every step (`node game/serve.mjs`).
26. DONE Notes: replies to the systems engineer, the combat engineer and the environment art lead
    (re-bake sizes) in design/NOTES-FOR-ENGINEER.md.
27. NOTE Correction: the first reel's Fray part was labelled "combat's timing" but the reel script
    built its cast without combat's export, so those clips ran on the art's numbers. Fixed in
    proto/reel.mjs; the re-rendered reel uses combat's export.
28. DONE Reel re-rendered with the new look, cloth, enemies and combat's timing:
    reel/low-water-characters-reel.mp4 (114 s): old against new, turntable of five bodies, secondary
    motion (walk, stop, running turn), Lamb's set, Fennick and Marrow, the Fray set with each tool,
    the holder and skirmisher against Lamb on the quay, the scripted exchange. Found and fixed while
    looking: the outline outside a hidden body was not depth-tested (a ghost outline behind
    buildings); fixed in render/plate.mjs and runtime/draw2d.mjs, plate parts re-rendered.
29. IN PROGRESS The environment art lead's v2 plates (quay, weigh-house) replaced v1 in content/ and
    the prototype stopped loading. Stopgap as shell owner: v1 quay and weigh re-baked into
    content-v1/ (one Idle job), game/places.mjs falls back to it for v2 places, game/serve.mjs mounts
    it, render/plate.mjs does the same for stills. Asked the environment lead (NOTES, A3) for a
    signal to build the shell's v2 path.
30. DONE Author direction (2026-10-17, relayed): one style in exploring, talking and fighting; builds
    and gear toward the action references. Built: weapon-first clip lookup (a weapon's own clip,
    then its class's, then generic), coat weight and stiffness driving the coat springs
    (`coatSpring`, `info.coat` per character). Planned in characters/GEAR.md: slots, grips per
    class, swappable coats and armour with weight bands, a load-band style layer, charge holds,
    running attacks and weapon specials as combat names them. design/LOOK-UNIFIED.md did not exist
    when checked; the shading fits it when it lands.
31. DONE In-world fights (systems engineer's setFigureDrawer): runtime/fightdrawer.mjs, one actor per
    fighter driven by combat's poseOf; harness characters/proto/fight_shot.html (no edit to
    game/engine); stills/09-fight-inworld.png and -1080.png with Lamb and a salvor on the re-baked
    quay. Unknown combat clips fall back to the guard with a console warning. Asked the systems
    engineer (A4) for each fighter's world point, the plate camera and depth, and an explore and talk
    hook so the play page draws everyone through the same figures.
32. DONE Animation quality pass (author: fluid animation paramount): proto/popcheck.mjs measures pops
    and planted-foot slides at 60 Hz over a walk-run-roll-combo-hit-turn-talk sequence. Built: walk,
    run and wade solved from the foot path (anim/gait.mjs: stance foot moves back at exactly body
    speed, so it cannot slide); runtime foot locking with leg IK for every other clip; loops start
    at the phase nearest the pose they leave; whole-body angles blend the short way; strikes shaped
    with launch and follow-through keys. Measured on Lamb's sequence: slides 205 -> 33 to 68
    (moves with the threshold), pops 95 -> about 120 (the lock's own corrections add some). Honest
    state: the slide count fell; the pop count did not, and the biggest pops are the hand in fast
    strikes, where a 2-frame active window covers a long arc at combat's numbers. Next: motion blur
    or smear frames for those swings, and an IK settle instead of hard lock release.
33. DONE Attribute range: reel/low-water-attribute-range-60fps.mp4, every defensive and combo move
    at a fast build (startup x0.7, recovery x0.6) beside a heavy one (startup x1.45, recovery x1.5),
    phase-warped, never sped as a whole. Looked at: the heavy build holds anticipation longer and
    settles longer; the fast one reads sharp. Combat now reports a playback rate and times clips from
    its frames; drive() plays combat's t (already phase-warped) and keeps the rate.
34. DONE Combat's new moves: tool specials (14 arts, art and art2 per class) and the running strike
    per class (anim/arts.mjs), 290 clips in all; the ten new tools as props (cast/tools.mjs).
35. NOTE content-v1/ holds v1 bakes of all four places so game/main.mjs runs while the environment
    lead's v2 plates replace content/ (NOTES A3). The shell's v2 path is the next shell step.
36. DONE Coordinator (2026-10-17): target the engine's one shell (play.html); game/main.mjs and
    content-v1/ retire when it matches. The drawer gets world position, camera and depth through A4.
37. DONE Walk: walk and run are now one locomotion blended by speed (anim/gait.mjs blendGait,
    library.loco): walk below 1.9 m/s, run above 3.0, the gait parameters and upper bodies blended
    between, the cycle phase advanced by distance so feet stay planted at every speed (a steady walk's
    stance foot moves under 1 cm now; it moved 11 cm sideways before the pelvis was squared).
    At 2.6 m/s the body is about 70 % run: 2.6 m/s is a jog. A shell walk speed near 1.5 m/s gives a
    true walk (NOTES). proto/gait_sheet.mjs, out/gait-lamb.png.
38. DONE Pops: smear frames for fast swings (the tool drawn again at points between the last frame
    and this one, an inkless half-seen material filling only empty pixels, so the real tool and body
    stay on top); eased foot-lock release. proto/smear_sheet.mjs, out/smear.png. Measured skeleton
    pops are unchanged (the smear is visual); slides about 49 on the sequence.
39. DONE Cast in story order: cast/keel.mjs (drip from cuffs and brim, drawn each frame),
    cast/sabine.mjs, cast/wenna.mjs, cast/merrow.mjs (Tub Merrow), cast/lamplighter.mjs (Gorm, Hobb,
    Fewell, Strand, Bright, Coe on one costume), from design/CAST-SHEETS.md. stills/10-cast.png.
    Added to the prototype and the fight drawer (Keel and the Lamplighters as fighters).
40. DONE Faces toward paint: skin in fewer, broader planes with wandering edges and a warm
    terminator; broader skin brushwork (out/closeups.png). Still reads part CG up close.
41. DONE Coordinator's notes on stills/10-cast.png: the named Lamplighters now read apart at quay
    distance (Gorm: short and square, a braided cape, a pale cap band, the open book up, the pole as a
    staff, head tilted; Hobb: tall, bare-headed, coat too big, two lanterns out, pole on his back;
    Fewell: broad, pole on the shoulder, a pale bandaged hand; Strand: a long pale scarf, a slouch;
    Bright: tall cap, spectacles, a pale slate under the arm; Coe the unnamed variant). In a fight
    each takes the pole in hand. Sabine slimmed: narrower hips and apron, a straight skirt.
42. DONE Pip, Crake and the Act 2 cast from one data-driven costume script (cast/folk.mjs): Pip,
    Crake (single mid grey, amber spectacles, hands folded), Fisk (bowler, mud to the knee, satchel
    to the chest), Pellow (black dress, white apron and cap, basket), Rook (sleeve protectors, the
    neck bent, pencil in the hair), Ash (cassock, collar, ledger), Sallis (warden, Board armband),
    Pardew (pea jacket, spectacles), Dace and Orme (reefers; Dace's pale muffler). All in the
    prototype and the fight drawer. stills/10-cast.png has the whole cast (25 people).
43. DONE The rest of the cast (cast/folk.mjs): Lugg, Nan Cockle, Penhallow, Teague, Mab and Noll
    Whelk (one costume, apron values 0.75 and 0.4), Spratt, Shadwell (soot face, pale eye-rings),
    Sister Gauze (the bell jar open at its near face so her face shows), Tobit, Dilly Rudd, Gill,
    Captain Dunlin. Dace and Orme apart (Dace tall, peaked cap, broad pale muffler; Orme short and
    stooped, knitted cap, worn tweed reefer, a pipe). Gorm's pole stands upright. 38 people in
    stills/10-cast.png. Gauze's jar reads as a hood more than glass (glass is only half-seen over the
    background, not over her).
44. DONE Real joint jumps (proto/popcheck.mjs now also reports severity). Same check on the last
    round's commit 87abab2 and now: worst 106 -> 62 cm/frame^2, frames over 20 cm 36 -> 32, summed
    excess 1981 -> 1478 cm (-25 %), count over 3.5 cm 148 -> 139. Fixes: strike and body-move curves
    carry momentum through keys (Catmull-Rom tangents, guarded); the swing ramps over the last third
    of the windup; the roll's turn eases in and out; a walk cycle wrap bug (sampled at the clip's 32
    frames against timing's 24) fixed; speed eases at about 7 m/s per second and walk and run share
    one phase; locks hand over across a gait's blend; blends leave the pose that was on screen (the
    speed-blended locomotion, not the raw run clip); whole-body angles blend without wrapping
    mid-roll. Tried and reverted: a longer follow-through (worse: the return made new jumps).
    Remaining worst: the heavy and the third light strike, whose 2- to 3-frame active windows at
    combat's numbers cover very long arcs; smears carry those visually. Walk entry now slides a little
    during its blend (38 frames flagged) instead of popping.
45. DONE Faces: painter's colour zones (warm cheeks, nose and ears; cooler jaw and chin), no ink
    line between them, following each character's own skin. Visible up close in out/closeups.png;
    still partly CG.
46. DONE Strikes with combat's `sweep` (combat commit 35f91b5, no frame counts changed): every shaped
    strike has a sweep phase (startup to the held top, sweep carries 20/52/82 % of the arc, active is
    contact); layout splits combat's startup at `sweep[0]`, or at 62 % without one; drive.mjs plays it.
    Found while measuring: blending out of a roll cut short could jump a whole turn (a foot 134 cm);
    blends now finish a cut turn forward in the direction it was going. No new foot locks in or out of
    a dodge, and locks fade when root motion carries the body away.
    popcheck, Lamb's sequence (two rounds ago -> last round -> now): worst 106 -> 62 -> 29 cm/frame^2;
    frames over 20 cm 36 -> 32 -> 11; summed excess 1981 -> 1478 -> 918 cm (-54 % overall). Frames
    over the 3.5 cm threshold 148 -> 139 -> 158: the sweep packs the arc into fewer frames, so more
    small jumps, far fewer large ones.
47. DONE Combat's five new moves keyed: flinch, snared, takedown, use_rope, use_salt.
48. IN PROGRESS Painted portraits for the talk panel and close-ups (coordinator: faces close up go
    through the painter, play stays real-time): expression controls on the head (brows up, down and
    pinched; lids; mouth open or pressed): neutral, wary, startled, set; proto/portraits.mjs bakes
    every speaking part in paraffin and sodium light, 512 x 640, framed on the head. Slot posted to
    the UI lead in NOTES (path, size, crop, index.json).
49. DONE Coordinator, 2026-10-17: the author's verdict (more detail, more distinct, the style lacking);
    an art director is setting three directions. New bodies and costume variants paused. Portrait
    bake of the current cast finishing in the background (a reference for the director; will be
    re-baked in the chosen style).
50. DONE The character forge (author: our own assets and tooling, no Blender): character sheets
    (sheets/<who>.json), compiler (forge/compile.mjs, forge/sdf.mjs: SDF regions, folds, wrinkles,
    noise, pocks, paint layers, automatic skinning, three levels of detail), mesh files
    (forge/meshio.mjs, forge/bake.mjs: .lwmesh), review (forge/review.mjs), per-vertex paint through
    the rasteriser and shading. Test sheet: Keel's head and greatcoat skirt (out/forge-keel.png).
    Spec in design/CHARACTERS-ART.md section 6; rig, drawer and forge notes for the art director in
    NOTES.
51. DONE The one shell (ui/figures.mjs) now hands the drawer the world point, plate camera, figure
    depth, the room's depth per pixel, the plate's lights and its darkness. runtime/fightdrawer.mjs
    lights each figure from the nearest plate lights with the plate's own falloff I (1 - d/reach)^2,
    takes the sodium ramp only where sodium wins, dims toward a cool ambient with the blackout, adds a
    rim in the ruling light's colour (a cool sky rim in the dark), hides figure pixels behind the
    painted room by their own depth, and highlights roll off softly (a surplice by a lamp keeps its
    folds). stills/11-oneshell-fight.png and -1080.png (engine play.html?shot=fight, my harness only
    changes the URL). Honest note: figures standing in the hull's shadow stay dark, as the plate is
    there; they read by the rim and the contact shadow.
52. DONE Portraits: all 36 speaking parts (the two generic opponents have none) x 4 expressions x 2 lights baked; portraits/index.json written
    atomically from what is on disk (proto/portraits_index.mjs, temp file then rename), rebuilt after
    each person in future bakes. Current style; to be re-baked in the chosen direction.
53. DONE The art director's head parameters adopted (forge/anatomy.mjs): a port of
    design/art/tools/anatomy.py HEAD_DEFAULT and head() with the same names (cran, cran_c, face, jaw_w,
    jaw_len, chin_z, cheek, brow, eye_x, eye_r, iris, lid_up, lid_lo, lid_tilt, nose_bridge, nose_tip,
    hook, mouth_y, mouth_w, smile, lip_full, ear, jowl, neck_len, neck_r, gaze), plus `s` scaling to the
    game's grotesque heads. New shape types for it (eyelid shells cut by a tilted lid line, spherical
    caps for irises and pupils, the mouth slit bent by smile). A sheet region with `anatomy: {...}` uses
    it; Keel's sheet takes the director's keel_head numbers unchanged except a larger eye and iris.
54. DONE Head, neck and collar join (coordinator's note on out/forge-keel.png): the anatomy neck runs
    from under the skull to the rig's neck joint and 8 cm on into a forged, turned-up greatcoat collar,
    so the head no longer stands on a stalk; the cap is re-forged to the new cranium (the costume
    script's cap dropped); eye sockets painted darker around the eyes so they read at a distance.
    out/forge-keel.png. Per-person proportions still come from the costume scripts' P records; a sheet
    cannot yet override the rig's proportions (the next forge step, with the bodies, after the art
    direction).
55. DONE Silhouette test at 1080p gameplay zoom (coordinator: only the white surplice read; pick by
    testing). Four treatments in the drawer, switchable for tests (globalThis.__lwFigureLook): lift
    (faces and hands 1.75x brighter), outline (a thin line in the ruling light's colour just outside
    the silhouette), shadow (a larger, darker contact shadow), pool (a faint lamp pool under the feet);
    shot through the engine's play.html?shot=fight and compared at native 1080p pixels
    (stills/12-silhouette-test-1080.png). Result, by eye: on the dark quay the shadow and the pool
    vanish (dark on dark); lift alone shows faces and hands but not the body; the outline makes every
    figure read as a shape against dark ground; lift with outline reads best (shape and face).
    Chosen: lift + outline (drawer default). Cost: the outline reads a little like a cut-out against
    bright ground; keep an eye on it in the lit pools. stills/11-oneshell-fight-1080.png retaken.
56. DONE Clip fades 5 to 9 frames at 30 fps (0.17 to 0.3 s), counted the same in drive and update
    (a8727af). The long pole's held top: the two-handed rise hung the boathook down the back, tip at
    0.39 m at the top of the windup; a long pole now stays raised behind the head (tip 1.94 m), a maul
    still drops down the back (ca40a48). proto/actor_test.mjs passes 15 of 15. Pop severity unchanged
    (worst 29 cm, 11 frames over 20 cm, summed excess 929 cm).
57. DONE Figures on the plates: exposure, contact shadows, occlusion (author, 2026-10-17: "Overblown
    exposure on character lighting", clipping, shadows overlapping). Proof: proto/plate_proof.py on the
    real v2 plates through the shell, 1920x1080, before and after side by side in
    stills/proof/*-before-after-1080.png (Brine bar, Brine by a wall and tables, Lamp Quay by the stairs
    and bench, Lamp Quay among the lamplighters, the lamplighters' fight, four extra people packed round
    Lamb on the Brine floor and on the quay).
    - Exposure (runtime/expose.mjs, runtime/platectx.mjs). Cause: rigAt mapped chest light through
      1.1 (1 - exp(-E/8)), so every figure ended near full light whatever the painting did; the
      Brine's close lanterns (I 12 to 26) then saturated the renderer, and the sodium ramp turned the
      saturated figure into one flat cream or yellow shape. Now the lamps only share out a moderate
      0.7 at the chest, and the drawer reads the painting's own linear luminance on the ground round
      the figure's feet (the plate's variant png, blended toward dark.png with the blackout), reads the
      figure's own light apart from its clothes (rendered over albedo, from the renderer's albedo), and
      sets one gain so a 0.18-albedo surface lands on the plate's local median (READ_FLOOR 0.03 on the
      darkest quay stretches). Highlights roll off toward 1.45x the plate's local 90th percentile; the
      face lift is 1.6x in linear light under that ceiling; the outline is capped there too (floor 0.22
      so it still separates on dark ground). Tested on the ground ring against a body-plus-ground box
      (the wall behind a figure is not its light) and plate albedo 0.3 against 0.18 (0.3 left quay
      figures as black cut-outs).
    - Contact shadows (runtime/groundshadow.mjs). Every figure queues its footprint; once a frame the
      canvas's shared mask is built (overlaps by max, so a crowd's shadows never stack darker) and laid
      under all figures (destination-over). A mask pixel counts only where the plate's geo buffer says
      the painted point is ground at the feet' height (a wall, a bar front, a table top or a step
      rejects it). Footprint 0.5 m with a soft edge from 0.15 m, plus a soft tongue 1.2 m long away from
      the lamp that rules the spot. Checked with a debug colour (globalThis.__lwShadowDebug).
    - Occlusion. The 0.35 m bias is now 0.14 m, tested as a hard mask with a one-pixel feather. A soft
      band in depth (first try, 0.14 m wide) ghosted whole bodies that stood against a wall or a stove
      at a shallow angle, so the softening moved to screen space. Props in the hands take the same test.
    Remaining, seen in the stills: figures stand inside the bar, a bench and the stove (collision:
    the walking grid lets Lamb and the people stand there; the systems engineer's, see NOTES); on the
    darkest quay stretches figures still read mostly by outline and faces; the plate's lens layers (a
    lamp's bokeh disc) show where a figure is cut by the lamp in front, a hole a little larger than the
    lamp; Merrow's head is hidden by the stove pipe in front in both before and after (correct depth,
    poor staging); the plate's buffers load a few seconds after the plate, and until then a figure is
    drawn with gain 1 and a small ellipse shadow.
58. DONE Exposure retuned, the cast mapping, reach, seated, against the systems engineer's visual check
    (game/engine/tools/visual-check.mjs; coordinator: the quay had swung to black cut-outs; Merrow at
    2.3 to 2.5x his surroundings).
    - Exposure: the target is now the brighter of the lit third of the painted ground within 1.5 m
      (ground only, read through the plate's geo) and a floor that rises inside a lamp's reach
      (0.03 + 0.1 f^2, f = 1 - d / reach); the lit third counts up to 3x the ground's median and 2.5x
      the painting all round the figure. Tested by stills: "lit" alone left the quay dark (its ground
      is dark even near lamps), "floor" alone pushed the Brine up, the uncapped mix put Merrow at 2.2x;
      a cap on the lamp floor by the surround dragged the quay back down. Half the ambient now takes the
      ruling lamp's colour (a figure lifted in shadow read flat blue-grey).
    - Bug found and fixed: bodyOf sent every cast id outside combat's archetype table (Sabine, Wenna, the
      folk) to the warden body. Cast ids now draw their own bodies; an id with no cast data draws a
      neutral placeholder and is logged once (proto/drawer_test.mjs, 9 checks). CAST_IDS exported for
      the validator. The shade.mjs:64 crash the coordinator saw was mine, mid-test: a comment swallowed
      the rig's fields; fixed before commit 7f5538c.
    - Shadows: a flat core (to 0.7 r) with a soft rim, so one figure's shadow is one tone.
    - Held tools: keepToolClear turns the wrist by the smallest 10-degree step (to 80) that brings a
      tool longer than 0.8 m inside args.reach without the tip going under the floor, eased at 0.25 a
      frame (drawer_test: Gorm's pole 0.52 m free, 0.23 m inside a 0.3 m reach, back to the clip with room).
    - Seated: a sit loop (anim/locomotion.mjs, timing 120 frames): thighs level, shins down, hands at the
      knees, the coat skirts eased forward 38 degrees (72 opened Keel's coat tube into a disc); the body's
      ground shift sets the feet. out/seated.png (proto/seated_sheet.mjs). The drawer sits a person when
      args.pose is "seated"; the people layer does not pass it yet (asked in NOTES). Keel's coat still
      flares like a bell round the knees; a split coat would drape better.
    - Visual check, final run at 20a9c70: exposure passes in every view (Merrow 1.99, Keel 0.6);
      three views still fail on two measures I checked against marked frames
      (stills/proof/check-marks/, proto/markup.mjs): Sabine's occlusion compares each body pixel to her
      feet's depth, but under the 34-degree camera her chest is 0.5 to 0.7 m nearer than her feet; by
      each pixel's own depth 0 of 4092 drawn pixels are behind the painting by more than 0.5 m (worst
      0.14 m, the drawer's slack). The crowd's 89 "stacked" pixels sit on figure edges (the one-pixel
      feather on dark coats and a staff), not where two shadows overlap.
59. DONE Visual check passes 6 of 6 on the current build (rerun here after the systems engineer's
    8dbfcb1): Merrow 1.98 (limit 2.0), Keel 0.54, crowd stacked 16 (limit 40), occlusion 0.
    Correction to step 58: my occlusion claim held (the check now uses each pixel's own depth), but my
    stacked-shadow claim was only partly right. After edges were excluded, 184 to 201 flagged pixels
    remained as blobs at the feet, and they were single shadow cores: my flat 0.55 core sat above the
    old threshold, 1.3 x the view's median (0.33) + 0.05. I had marked edges only and read the crowd
    from that. The check now measures one shadow's own alpha. Keel sits in his chair through the shell
    (harbour-office still); he reads as sitting, but Lamb's walk-up spot (0.4, -0.6) stands inside his
    knees, since a seated body reaches about 0.6 m further forward than a standing one.
60. DONE For the systems engineer's 74d9cdf: args.solo returns the drawn figure's per-pixel depth
    ({ depth, w, h, ox, oy }, NaN where nothing is drawn or the painting hides it; drawer_test 11 of 11).
    Seated convention checked: hips over args.at in x and z (Keel at (0.24, -0.53), facing -z from face
    -pi/2). The seat height follows each body's legs (the root drops 0.46 m, the ground shift sets
    the feet): Keel's hip lands near 0.55 m, Merrow's lower (short shins), so Merrow sits lower than a
    0.45 m bench; a seat height in the args would fix that. Visual check at this state: 4 of 6 pass.
    harbour-office's 52 "stacked" pixels are inside Lamb's lantern glass (a translucent pane, under
    one ellipse or none: underTwo 0), not a shadow; brine-stove-chair fails on Lamb's footprint in
    3 prop cells (collision, varies by run).
61. DONE For the systems engineer's 195c099: seat height, side room, tells.
    - Seats: hips fitted to args.seatY. The root moves so the pelvis sits 0.09 m above the seat, and
      the thighs tilt, with the shins kept upright, until the ankles stand at their standing height.
      Foot locks are released while seated. drawer_test: Keel on 0.487 m, pelvis 0.577, ankles 0.029
      against 0.028 standing; Merrow on 0.458 m, pelvis 0.548, ankles at standing height, thighs
      tilted 29 degrees (his short legs perch). out/seated.png.
    - Held tools: both shaft ends are kept inside args.room (ahead, left, right) and above the floor,
      and the shaft, both hands and both forearms keep 0.36 m off every other body drawn in the last
      frames. The wrist turns bend and side together (10-degree steps to 60 each, the smallest total
      first; when nothing fits, the pose that breaks the limits least), eased at 0.25 a frame.
      drawer_test 15 of 15, which includes Fewell's pole across the body kept inside 0.45 m a side and
      Strand's idle pole tip lifted out of the floor (it was 0.72 m under it).
    - Tells (args.tell from combat's fxOf): one pale ink, a shape per kind. Swing is a ring that
      tightens, grab adds four chevrons closing in, throw is an arc ahead plus an aim line, the
      lunge answer is a wedge running out along the facing, the throw answer is a dashed aim line
      ending in a cross, and unstoppable is a doubled ring with outward teeth. out/tells.png
      (proto/tell_sheet.html).
    - Visual check: 5 of 6 pass. crowd-of-four fails on Lamb and Fewell (79 px). Marked with the
      drawer's solo depths, the pixels run along Fewell's left side against Lamb's coat front: two
      flared coats about 0.12 m apart at 0.82 m spacing, inside the 0.15 m threshold. That is near
      contact from spacing, not the pole (Fewell's pole is clear of Lamb by the capsule test).
62. PARTIAL The crowd's crossing (systems engineer's 8ed8c08: surfaces that meet within 4 cm or cross).
    - Marked with the solo depths (proto/markup_solo.mjs; stills/proof/check-marks/crowd-lamb-fewell-
      crossing.png): the pixels run along the edge of Fewell's raised arm and the vertical pole, where
      it meets Lamb's hat and coat.
    - Changes: body clearance 0.5 m (it was 0.36), up to 2.1 m (hat brims), with each forearm sampled
      from elbow to hand. When the wrist alone cannot clear a body, both arms draw in by 15 or 30
      degrees. The search runs 64 poses a frame, so a limit tripping never stalls a frame.
    - Result: Fewell's hands now sit 0.51 m and more from Lamb's axis, and the pole has moved off him.
      The check still counts 69 px. Why is unknown: my 3D estimate puts the raised arm 0.2 to 0.25 m
      clear of a 0.3 m hat brim, and the edge pixels say the two surfaces come within a few cm along
      the view ray. Untested causes: the brim is wider than I assume, or the depth at a silhouette edge
      is a grazing sample.
    - Strand's pole in the crowd still dips 0.23 m under the floor. The least-breaking pose there
      trades the floor against the room ahead (0.59 m).
    - The crowd's 24 off-floor shadow pixels sit at the bench's legs and underside
      (crowd-off-floor.png). My contact shadow rejects anything more than 0.12 m above the feet, so I
      think they are feathered figure pixels seen under the bench seat. Not confirmed.
63. DONE Visual check passes 6 of 6, and its control (two bodies in one spot) fails as it must. Off-floor
    shadow pixels are 0 in every view.
    - Silhouettes: the systems engineer confirmed the 69 px crowd crossing was grazing depth at
      silhouette edges (0 interior crossings once a 2 px edge band is excluded, 45bcd58). It is still
      unknown how much of the original count came from the arm before 35775c0.
    - The off-floor pixels at the bench legs were my contact shadow, not feather. They sat on floor
      pixels one pixel from a leg, and the check's own geo mapping lands that pixel on the leg. The
      mask is now eroded by 2 px: a pixel keeps shadow only if the floor test also holds 2 px to each side.
    - Still open: Strand's idle pole dips under the floor in the crowd (0.59 m of room ahead).
64. DONE Weight in the fight (combat engineer's feel capture, coordinator 2026-10-17; author: the moves "will
    need to feel incredible, and have weight to them"). Commit 8ae7507. Strips: out/feel-sheet.png
    (proto/feel_sheet.mjs, driven through combat's own warp).
    - Knockdown: a fall over combat's 48 frames (60 fps). It was a 5-frame snap, because the old clip
      keyed the fall into startup and active phases that combat gives 0 frames. The new fall: struck at
      0.1, the knees going at 0.28, falling at 0.45, ground impact at 0.55 (frame 26), a bounce at 0.64,
      settled by 0.74. getup is re-keyed over its 50 frames. Both carry `grounded`, so the lowest point
      stays on the floor throughout (no float as the body pitches).
    - world.lunge and world.throw: keyed clips, where before the lunge played the walk and the throw
      had no wind-up. Key times sit under combat's tell warp ((f / startup)^1.8). The lunge coils from
      frame 4, drives from frame 12 (when combat's travel starts), loads at 28, strikes on the active
      frames and stumbles in recovery. The throw dips for the stone as the tell starts (frame 6), is at
      full draw by 17, holds, releases, then follows through. Combat frame counts are unchanged; the art
      timing.json halves them.
    - Hit reactions (runtime/feel.mjs): additive, from combat's fxOf contacts once a tick. The struck
      body snaps away from the blow within 0.035 s and springs back over about 0.36 s with one
      overshoot, scaled by power. A blow from the front throws the chest and head back, from a side
      bends and turns the body away, from behind pitches it forward. The striker recoils on a heavy
      blow (power 0.6 and up), a block or a catch. Limit: contacts on ticks the render skips are missed.
    - Sidestep: lean 26 degrees, pelvis shift 20, root roll 20, a 0.26 m drop, and the weight carried
      onto a deep landing knee with the trailing leg extended.
    - Lamb's outline: when other figures are drawn over Lamb, Lamb's silhouette edge (2 px) is inked
      over them in pale ink. It is found by reading the canvas over Lamb's box after the frame's figures.
    - Visual check 6 of 6, with its control failing as it must.
    - Follow-up (combat engineer, fxOf(W, since)): reactions now read every contact since the last drawn
      tick, so skipped ticks still land. They age by combat's ticks and hold at the full snap while
      the body is in hit-stop (fxOf's frozen). drawer_test 18 of 18.
    - Before and after strips: stills/feel-compare/{lunge,throw,knockdown,hit-reaction}.png
      (proto/feel_compare.py; before = combat's feel4, after = stills/feel-after, both seed 12 with
      --stage). The fight diverges between builds, so the strips pair the same kind of moment, not the
      same tick. Seen: the lunge drives low with the coil before it, where it used to walk; Lamb's fall
      runs about 30 frames to the ground; Lamb's outline shows through the wardens. The throw strip is
      small at this crop and reads poorly. The after capture predates the since and frozen change.

RESUME (2026-10-17, usage nearly out). State: everything committed on dev through 5342098. Visual check
passes 6 of 6 (run `node game/engine/tools/visual-check.mjs --port <p>` from the repo root with
`node game/serve.mjs --port <p>` running). Tests: `node characters/proto/drawer_test.mjs` (18 of 18) and
`node characters/proto/actor_test.mjs` (pass).
Next, in order:
1. Recapture feel at full speed with the since/frozen reactions and the systems engineer's impact
   camera (b314c79): `python game/engine/combat/tools/feel_capture.py --out characters/stills/feel-after2
   --seeds 12 --stage`, then `python characters/proto/feel_compare.py game/engine/combat/capture/feel4
   characters/stills/feel-after2 characters/stills/feel-compare`. Make a larger crop for the throw strip.
2. Strand's idle pole dips under the floor in the crowd (0.59 m of room ahead): give the lamplighters'
   carry an upright idle, or widen the tool search with forearm bend.
3. Merrow sits at 1.98 against the 2.0 brightness band at the stove; find the term that drives him
   there (not the lamp floor).
4. Keel's coat flares like a bell when seated: split the coat skirt at the back.
5. Held for the art director's direction: new bodies, Keel's eyes and skin.
Never edit a runtime file while a capture runs (the server reads the working tree). Beware `//` comments
inside one-line edits: twice they swallowed the rest of a line.

## Head sculptor and distinct heads (2026-10-21)

Brief: every face came from one parametric head with a narrow range, so the cast read as one
person (Penhallow rebuilt with a pipe and grey hair still had the men's face; Wenna the same head).
Build ART-DIRECTION 7.1 and give the principals and the named cast their own heads.

**Built** (design/CHARACTERS-ART.md section 7 has the rules):
- `forge/headkeys.mjs`: every heads.json key and the sculptor's own, each with a natural range and
  a slider range at least twice as wide; `validateHead` (a sheet without neck, collar or idea fails).
- `forge/headshapes.mjs`, `forge/hair.mjs`, `forge/headpaint.mjs`, `forge/detail.mjs`: the head,
  sculpted hair and beards, paint zones, displacement layers per LOD with the alias limit (mesh: four
  cells a period; screen: three pixels at the LOD's top scale; layers above it are dropped and
  reported). Head cells: near 3 mm, mid 7 mm, far 16 mm.
- `forge/ellipsoid.mjs`: exact ellipsoid distance (Eberly), used inside a band round the surface;
  `forge/mesher.mjs`: a narrow-band polygoniser with per-shape bounding spheres.
- `forge/heads.mjs`: builds a sheet into a cast member (crown at the body's head length, neck run
  into the collar, the sculptor's collars: standing, wing, muffler, band), leaves face anchors
  (`M.headAnchors`) so `cast/face.mjs` puts pipes in mouths and spectacles on eyes.
- `forge/heads.cast.mjs`: 36 sheets, one idea each ("a brick", "a long thin candle", "a horse").
  Keel, Lamb and Sabine start from the director's records, copied unchanged (`heads.director.mjs`,
  tested against heads.json; `forge/director_sync.mjs` recopies).
- `forge/maps.mjs`, `forge/bakeheads.mjs`: .lwmesh at three LODs with curvature, thickness (capped
  at 5 cm) and cavity per vertex in the same file (`meshio.mjs` reads files without maps as
  before), read off the exact distance to the baked mesh; `forged/heads/report.json` has counts,
  timings and map quantiles. `proto/heads_maps.mjs <who> <lod> <out>` draws the maps.
- Expression sliders (`forge/headshapes.mjs` EXPR_SLIDERS: brow, browInner, lids, corners, jaw) on
  top of the four presets; `setExpression` takes a preset name or an object.
- A pose library with ground contact (`proto/poses.mjs`, `proto/pose_sheet.mjs`): stand, talk,
  examine, seated on a bollard (0.45 m), a chair, a bench, through the game's own seat fit.
- Portrait light (`proto/portrait_light.mjs`): warm key on cool grey, after the author's reference.

**Blind test** (`heads-test/PROTOCOL.md`, committed at f8afe21 before any head existed; amendment 1
at 4abfd2d after the control and before any new-head result; R2 frozen at 96f12d7 with file hashes
in `heads-test/results/R2-freeze.json`). Viewers: fresh agents given only the images and the
descriptions, three per round and task set, never reused. Results in `heads-test/results/`.

| Round | Heads | A same/different (head only) | B face to description | C portrait to description | A2 face core | D people in six |
|---|---|---|---|---|---|---|
| R0 / R0b control | old (63a61b5) | 67/72, 0.93 (0.85 to 0.97) | 25/36, 0.69 | 22/24, 0.92 | 60/72, 0.83 (0.73 to 0.90) | 0.78 of 6 (0.73 to 0.83) |
| R1 development | new | 69/72, 0.96 | 30/36, 0.83 | 24/24 | 70/72, 0.97 | 0.99 of 6 |
| R2 confirmation | frozen | 69/72, 0.96 (0.89 to 0.99) | 27/36, 0.75 (0.59 to 0.86) | 20/24, 0.83 (0.64 to 0.93) | 72/72, 1.00 (0.95 to 1.00) | 0.97 of 6 (0.93 to 1.00) |

Intervals are Wilson 95 percent, except D (a t interval over twelve grids). Chance in B and C is
0.2. R2 passes every pass line, and D's interval sits clear of the control's.

What it shows and what it does not: the control passed the brief's own tasks A to C, so those tasks
do not measure the face (viewers used neck, hair, beards, skin colour and costume); the claim rests
on A2 and D, where the old heads were told apart 83 percent of the time and counted as 4.7 people in
six, against 100 percent and 5.8 for the new ones. The viewers are models of the builder's family,
three a round; one camera angle; the R2 face crops hold the long necks (the head-part box) so the new
faces sit smaller in them than the old, and the face cores are sized to eye spacing, which gave the
old heads a wider crop. Both differences work against the new heads. Per-item misses in R2: Pellow
and Pip across expressions, Spratt taken for Teague; in B, the children (Tobit, Gill, Dilly) and
Cockle were the usual misses. Two D grids scored 5, both with Penhallow and a thin beard edge that
viewers read as a strap across the face.

**Sizes** (stills: `game/capture/heads-2026-10-21/`, honest crops, nothing sharpened):
before-after-512.png (baked size), before-after-panel720.png (the talk panel at 720p, 161 x 201),
before/after-panel1080.png, before-after-play70.png and play105.png (play size, 70 and 105 px a
metre, the plate camera), before/after-portraits.png, expression-sliders.png, wenna-poses.png. The
play-size figures are rendered through the portrait path at the game's measured scale, not captured
in the running game.

**Costs.** Far builds for all 36 people: 1.9 s in Node against 1.0 s for the old heads; mean far head
1.7 times the triangles (8.3k against 4.8k). Mid heads take 0.1 to 0.3 s each to sculpt. The near map
bake is slow (several minutes a head; it runs in six lanes at Idle priority).

**Mistakes, mine.** A stray `git stash` and `git stash pop` on the shared tree (about a second;
restored cleanly, the stash list is empty, nothing lost as far as `git status` shows). A `//`
comment in a one-line edit swallowed Tobit's export in cast/folk.mjs; the head tests caught it
before any commit. The first face-crop rule left the old heads wider crops than the new; recorded
above, not changed.

**Open.**
1. The runtime sculpts far heads at load; loading `forged/heads/*.lwmesh` instead needs an async
   load in the cast path (characters runtime) and was not done.
2. Hats are placed from the old head radius; none pokes through in the stills, but they are not
   fitted to the sculpted crania.
3. Thin beards draw an ink edge across the cheek (Merrow, Pardew) that reads as a strap; Penhallow
   reads as a woman mainly by her grey hair; long necks show in several panel crops; Wenna's white
   brows vanish at mid and far LOD (below the cell size, as the alias rule intends).
4. For the gameplay lead: Wenna seated on a bollard works through the existing `pose: seated` with a
   seat height (0.45 m in proto/poses.mjs); the mole wiring decides whether she sits.
5. For the rendering lead: the painter and the wear layer can read the baked maps
   (curvature, thickness, cavity) from the .lwmesh; nothing reads them yet. For the performance
   engineer: the far head triangle count above.
6. No in-game capture of the new heads was taken.

### Review and rework after R2, and R3 (2026-10-21, later)

The coordinator looked at the 512 px sheet: distinct, but several heads read worse than the old ones
(eyes lost in black sockets, stalk necks, Wenna skull-like, Marrow lumpy, Keel grey, mouths as blobs).
R2 measured telling people apart, not appeal.

**Done.** Amendment 2 (dff6949, before any rework): an old-against-new appeal task E at panel size
plus A2 and D again, in R3. Then:
- `forge/headrules.mjs`: human proportion rules (neck against jaw, eye line, eye size, lid opening,
  mouth width, lumps, visible neck); a sheet outside them fails unless `exaggerate` names the rule and
  its reason (Lamb's neck, Fennick's neck, Bright's dome, Lugg's long face, Keel's tiny mouth).
- `proto/heads_check.mjs`: the render gate, eye white and iris pixels per eye and brow pixels at
  portrait size (thresholds committed at cff8c84 before the check ran): 36 of 36 pass.
- Eyes forward with whites, mid irises, catch-lights from the key light; shallow shaded sockets with
  the opening cleared; flat lips; wider blends; thicker necks; collars for Hobb and Lugg; Wenna,
  Hobb, Marrow, Keel, Lamb and Gorm reworked; a brighter paraffin key.
- For the painter: per-vertex curvature and cavity bytes (`vertexMaps(M)`), layout in design/STATE.md.
- For the performance engineer: built heads cached per person, LOD, expression and proportions and
  replayed exactly (a second build of the same head, 191 ms to 14 ms for Penhallow's far figure).

**R3 (frozen at 2c84801, seeds 401 to 403 and 421 to 423): appeal FAILS, distinctness holds.**

| Task | R3 | Pass line |
|---|---|---|
| E1 real person, new chosen | 8/36, 0.22 (0.12 to 0.38) | lower bound above 0.5 |
| E2 rather talk to | 8/36, 0.22 (0.12 to 0.38) | lower bound above 0.5 |
| E3 emotion clearer | 10/36, 0.28 (0.16 to 0.44) | lower bound above 0.5 |
| A2 face core | 69/72, 0.96 (0.89 to 0.99) | lower bound 0.70: pass |
| D people in six | 0.97 (0.93 to 1.00) against control 0.73 to 0.83 | pass |

Per person, new chosen: Penhallow 9/9, Marrow 3/3, Orme 3/3; Lugg, Noll, Spratt 0/9; Keel 0/6.
The viewers named stretched or mushroom-shaped heads, bulging or glowing eyes, long necks, faces hard
to read at that size; the old heads' bold dark brow bars, big noses and wide warm faces read. My own
reading of the panel-size sheets agrees: the old heads were about 0.24 m wide against a natural 0.15
to 0.17 for the new ones, and their few large features survive 161 px while the new heads' finer
modelling turns to dark smudges. Amendment 3 (abbce23) records R3 as a failure and defines R4.

**Not done: R4.** An exploration toward wider, bolder heads with less relief and a frontal fill
(`heads-test/explore/after-R3-wider-bolder.patch`) did not beat the old heads by my own eye at panel
size (faces bigger and brighter, but necks merged into faces and Lugg's face still pinched under his
cap), so it was not frozen or tested and the working heads are back at the R3 state.
`forge/heads.mjs` `SCULPTED_HEADS = false` returns every person to the old head in one line; which
ships is the author's call. Sheets: `game/capture/heads-2026-10-21/before-R2-R3-512.png` and
`before-R2-R3-panel720.png`, `after-R3-*`.

## The Quota: the slice cast on the old heads (2026-10-21)

Brief (coordinator, relaying the author's "yes" to The Quota; design 5c412bb, design/quota/02-HOUSEHOLDS.md
and 07-PRODUCTION.md): faces on the old heads for the slice's cast, each with its exaggerated feature;
a child variant and an old-age variant; era 2 dress, dark wool for the Tarn, felt and the blue wrist
thread for the Hesh. The game is on the old heads (97da457, `SCULPTED_HEADS = false`); both head
paths stay working (the sculptor's tests still run against `forge/` directly).

**Built.** `cast/quota.mjs`, twelve members on the old parametric head, each with its idea in
`info.quota.idea`:
- Ned Furrowe: the good hat's line, a band of untanned skin across a weathered forehead, the hat in
  his left hand. Mary: high tight cheekbones over a mouth kept straight, scarf and apron. Abel (era 1,
  `abel_era1`): the good hat worn proud over a big hooked nose; `abel` is the same record aged to 75
  (stoop, jowls, white moustache and brows, a stick). Pell: the grandfather's hooked nose arriving
  early, as a boy of ten (`pell`) and the era 3 surveyor (`pell_adult`).
- Will Brack: a flushed broken nose over a jaw like a step, stubble, the militia armband.
- Tomas, Aaron and Anni Haldane, half-Hesh, in felt with the blue thread at the left wrist: Tomas
  hollow-cheeked with the long braid; Aaron a town crop with the ears standing out of it; Anni at
  fourteen with wide eyes, the braid and the tally (`anni_adult` is era 3, the same face).
- The Requisition Captain: a long clean chin and a thin moustache under a grey peaked cap, the cross
  strap and the requisition order.
- `ageVariant(spec, age)` with `AGES` (10, 14, 40, 75): one face record at any age.
- Materials (`rig/materials.mjs`): `wool` 57, `felt` 58, `thread` 59, `hatline` 60. The painter's
  tables take them as detail by default; the rendering lead may want wool and felt in its cloth flow.
- `PORTRAIT_CAST=quota` makes `proto/portraits.mjs`, `heads_play.mjs`, `heads_preview.mjs` and the
  portrait index work on this cast into `characters/portraits-quota/` (Low Water's portraits untouched).
- Tests: `node proto/quota_test.mjs` 5 of 5 (cast present, builds, dress materials, ages, unique ids).

**Stills:** `game/capture/quota-heads-2026-10-21/`: quota-portraits.png (512 x 640), quota-panel720.png
and panel1080.png, quota-play.png (70 and 105 px a metre), quota-ages.png (child and old beside the
adult, baked size and 720p panel).

**Limits, seen in the stills.** The old head gives every woman and child the same heavy brow bar
(lighter in colour here, still a bar); Tomas and Anni read close at panel size, both braided in felt;
the hat line reads at portrait size and is gone at play size; the cast is not in the fight drawer's
`CAST` (the gameplay engineer wires bodies into scenes). No blind test was run on this cast.

**Second pass, after the coordinator's notes (same day).** The shared face, the ages, the necks and the
women's brows, inside the old head: `head()` takes shape options whose defaults reproduce the old head
exactly (a hash of all 36 Low Water meshes at near detail is identical before and after): `skull`,
`faceLen`, `eyes`, `eyeX`, `cheekR`, `browShape` ("bar", "arch", "none"), `browT`, `lines`, `lips`,
`bulb`. The ages now carry them: a child gets a rounder skull, a shorter face, eyes 1.3 times, fuller
cheeks, a short soft nose and a thin light arched brow in place of the bar; forty a longer face, a
heavier jaw, folds and creases; seventy-five as before. Women have an arched brow instead of the bar.
Each person has their own face shape (Will broad and small-eyed, Tomas long and hollow, Aaron a bulb
nose and a wide mouth, the Captain the longest face and thinnest lips). Bodies: a yoke rounds the
shoulder blocks and the collar comes up over the neck at portrait size. Stills rebaked in
`game/capture/quota-heads-2026-10-21/`. Stopped there, as asked, until the author decides where the
dialogue portraits come from.


### The Quota, third pass: the rest of the speakers, cloth, eyes (2026-10-21)

The author chose our own pipeline with a painting Studio (tools/studio/): these figures are the
reference and the in-world figures, not the final portraits. Asked for clear form and readable planes.
- **The rest of the slice's speakers** (`cast/quota2.mjs`, from design/voice/quota-cast.json): Edie Brack
  (a face held still, the sleeve pulled down), Davey (nine; his father's broken nose already, the
  shoulders up), Rose (four; her mother's face, small and round), Bet Haldane (a broad face gone thin,
  scarf), Ilo (Tomas's cheekbones grown broad, grey in the braid), Old Tesk (65, the old-age record on a
  Hesh face), Lil (her sister Mary's cheekbones, widow's black), Gedge (a bull's neck and an easy grin),
  Pask (the one soft fed face, spectacles), Walter Mott (a narrow head bent to the ledger). New ages 4
  and 65. Family likeness is built in: Davey from Edie's record, Ilo from Tomas's face, Lil from Mary's.
  `ERA_IDS` maps the Studio's `<who>@e<era>` ids to these.
- **Cloth.** Coats and skirts carry folds that grow toward the hem (`skirt({ folds })` in cast/parts.mjs,
  off by default), sleeves break at the elbow in two soft rolls, aprons hang flat from the waist with
  their own folds and strings, belts pinch the waist; the yoke and collar scale down for children.
- **Eyes.** Adults (16 and over) get an upper-lid plane and a socket recess under the brow (`lidPlane`,
  `socket` on the old head). Seen at 2.4 times zoom: the lid's shelf and the shadow under the brow read.
- **Expression sliders on the old head** (brow, browInner, lids, jaw, corners), so moods move the
  shipped faces; the hair now follows the skull option (children's rounder heads had lost theirs).
- Every new option defaults to the old head: the 36 Low Water meshes still hash identical
  (417ac6f6...) after each change.
- STATE: answered the Studio's note (sitters, ids, the reference camera and light, channels,
  expressions).
- Tests: quota 6 of 6, heads 13 of 13, drawer 18 of 18. Stills: `game/capture/quota-heads-2026-10-21/`
  (quota-portraits, quota-panel720 and 1080, quota-play, quota-ages with the family pairs,
  quota-cloth-250 at 250 px a metre).

Seen in the stills and not fixed: the cloth is still tubes with folds rather than cloth; women's faces
share the old head's eyes; the hat line, the thread and the lid plane are gone at play size.

## The Quota: open eyes and the eight moods (2026-10-21 to 22)

The Studio's first portrait showed Ned's lids closing his eyes and the moods barely moving. On the old
head, opt-in for The Quota's cast only (Low Water's 36 heads hash-identical after every change):

- **Open eyes.** `lidRange`: neutral is open with the iris showing; `face.lids` is the character's
  heaviness and stops short of closing. Expressions can still close the eye.
- **Moods that read at portrait size.** `exprGain 1.8` multiplies the expression; brows follow the
  forehead back as they rise, the inner ends pinch twice as far and the outer ends drop for anger, a smile
  lifts cheeks and lower lids, a grieving mouth pushes the lower lip up, `corners` move the mouth line.
- **Eyes that were skin.** A material census found most Quota heads (children, Will, Gedge, Pask, Mary)
  had no iris or white surface: a wider or deeper skull put its front over the iris, and the cheek's
  colour claim reached the eyes. lidRange heads now build the eye last, the skull grows backward and
  yields its claim, the cheek's claim stays near the cheek and the white claims its carve.
- **Ned**: longer, less round cranium and a firm mouth line. **Will**: lighter lids, no stubble over
  the mouth, a cranium tall enough that the cap clears the brows.
- Sheet: `game/capture/quota-heads-2026-10-21/quota-moods-ned-will.png`, made by
  `proto/mood_sheet.mjs` with the portrait painter's mood mapping. Notes: design/state/sculptor.md.

Seen on the sheet: Ned's eyes are open with whites and irises at neutral and the eight moods differ
(warm squints, angry pinches, afraid opens eyes and mouth, grieving drops the mouth). Will's eyes now
show; his brows and mouth move less than Ned's, because the cap's brim sits on his brows. Not fixed: a
small dark spot beside the nose under the near eye on both (the iris's colour claim leaking onto the
socket wall), and "lying" reads close to "warm".

Second pass (2026-10-22, the coordinator's notes on the sheet). Will rebuilt: a believable broken nose
(bent tip, low wide bridge: `noseBend`, `noseFlat`), jaw corners and cheekbones (`jawCorners`,
`cheekbones`) so the face is not a ball, and the flat cap set back on the crown (`hatLift`) so the brows
move. A lie is now told by the eyes: `X.held` keeps the smile but drops the cheek and lower-lid lift and
narrows the lids, so warm crinkles and lying stays flat and open. The dark spot under the near eye was the
iris's colour claim leaking onto the socket wall; the claim is cut (iris surface below the eye: Ned 51
triangles to 3 at neutral). On the sheet: Will's moods now differ (brows pinch and lift under the cap,
the mouth drops and opens), the lie reads apart from warm in the eyes. Ned keeps a speck at the inner
corner in the lying cell, a few pixels. The held smile itself is slight.


### The Quota: Tomas at eleven, Aaron at nine (story lead, 2026-10-22)

Author decision (2026-10-22): Tomas about 11 and Aaron about 9 in era 2. `cast/quota.mjs`: a new age
record, AGES[11], mixed a quarter of the way from the ten record to the fourteen (mixAge); TOMAS built
with `at(..., 11)` (1.31 m), braid 0.28, the Orme lad's wool coat over his felt (wear handdown, hem
0.16, wool legs); AARON with `at(..., 10)` and age 9 (1.24 m), as Davey is, felt coat to the knee.
Both fall under the maker's child rule (no lid plane or socket under 16). quota_test 6 of 6.
**Follow-up for the character lead:** portraits-quota/tomas and aaron and glyph-portraits-quota are
still the old ages. `PORTRAIT_CAST=quota node proto/portraits.mjs 0 1 tomas,aaron` fails in
render/shade.mjs light() (`.emit` of undefined: a material id with no entry, the same failure design/state/studio.md notes).


## Bodies and animation: foot lock, layering, fades, the Quota portraits (2026-10-22)

Author direction (2026-10-22): "The character bodies and animations should be done very well. The mechanics
must be fluid. Let's push for a completion." Bounds, controls and the results table: notes/ANIM-BOUNDS.md.

- **Foot lock** (runtime/actor.mjs): contact phases from the clip, world-pinned feet with two-bone IK,
  catch-up steps, clearance for a dragged foot, the standing sole as a floor, slope fitting (`opts.ground`).
  Worst slide 0.77 cm per planted step over 600 steps for Lamb, Tomas and Aaron (baseline 25.8 cm).
- **Gait** (anim/gait.mjs): world-at-rest lift-off and landing, inside the leg's reach, walk reach 0.95,
  drop, lift and bob scaled to the leg (the children walked crouched). Soft reach in rig/ik.mjs.
- **Fades and layering**: smootherstep weights, the whole-turn choice made once per fade, `playUpper` and
  combat's `pose.upper` with a spine mask, an additive lean. Fade edges 1.84 deg/frame^2 over 3,432 pairs
  (baseline 30.4).
- **Portraits**: render/shade.mjs light() covered ids 1 to 63 only; the people's marks are 64 to 67. All 22
  Quota portraits and glyph portraits rebaked, Anni last, after bdb4a67 set her inherit.
- Captures: game/capture/anim-2026-10-22/ (proto/anim_strips.mjs, proto/body_sheet.mjs).
- Tests: every proto/*_test.mjs passes (14, the new anim_bounds_test among them).

Seen and not fixed: popcheck's pop count rose (162 to 213 frames: faster fade middles and quick catch-up
steps); a walk stopped dead steps the front foot back to the stand rather than bringing the back foot up
(the actor stops with no deceleration); Lamb's stick tip passes through the floor in the turn and late in
the walk; the hit reaction at power 0.8 from a heavy tool throws the head back about 45 degrees; aprons'
ties read as a rigid bar in side view; Rose's legs are short for four. Combat does not send `pose.upper`.


## Bodies: the fidelity pass (2026-10-22)

The coordinator's review under the author's approval ("All actions and blockers approved"). Results, what is
still not good enough and a resume list: notes/FIDELITY.md. Aprons draped and tied, coats and dresses fitted to
the thighs with weighted hems, a waist and chest, hands sized from the body with fingers, Quota noses 55 %
shorter, Rose's legs, children upright, the smear an arc without gaps, the stick kept out of the floor (114 to 7
frames of 400), the strike's arm back to the walk sooner, the hit reaction toned down. Every proto/*_test.mjs
passes. Not good enough yet: the faces (a sculpt pass), cloth without collision, the smear's look, the portraits
not rebaked after the nose change.


## The Quota's heads sculpted, and cloth kept off the legs (2026-10-22)

Author direction (2026-10-22): "The character bodies and animations should be done very well." The
coordinator's verdict on the old head: balls with features painted on, goggle eyes, pink cheek discs, smeared
lips, large ears, a flat cap of hair, faces that fall apart in three-quarter and profile.

- Bounds first (notes/HEAD-BOUNDS.md, committed before the code), controls on the old head.
- **The head** (cast/sculpt.mjs, sculpt_face.mjs, sculpt_hair.mjs): Loomis's ball with side and temple planes,
  brow ridge, carved orbits with an outer rim, cheekbones and arches, muzzle, ramus, jaw angle, masseter,
  chin, the nose's planes and wings, philtrum, lips and corners, ears on the side plane, the neck into the
  skull. Eyes meshed exactly about the gaze inside lids with thickness; a wet highlight (material iris).
  One skin with the painter's three zones as a vertex tint; the hat line and Will's scar painted in. Hair and
  headscarves grown off the skin above a hairline. People, age and sex vary it; a push from the cast's centre.
- **Cloth** (rig/body.mjs): coats and dresses pushed outside the legs after skinning; 0.0 to 3.2 vertices a
  frame for every cast member (the Captain was 26).
- Results: 5 of 22 heads pass every head bound (old head: none); goggles and the missing highlight gone for
  all 22; distinctness fails (median 0.021 H, bound 0.03). Low Water's 36 meshes hash unchanged.
- Rebaked: the Quota portraits (characters/portraits-quota/) and glyph portraits (glyph-portraits-quota/).
- Captures: game/capture/sculpt-2026-10-22/before and after. Tests: every proto/*_test.mjs passes.

Seen and not fixed: sockets and under-cheek planes fall to the darkest band (bruised faces at play size),
children's lower faces in shadow with pale nubs at the mouth corners, hair a helmet, the cast too alike.
Resume list: notes/FIDELITY.md.
