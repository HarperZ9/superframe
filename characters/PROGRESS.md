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
    C:/dev/worktrees/raw-native-anim off origin/main e46ff48): web/anim skeleton, skinning,
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
