# Performance: painted mode to 60 fps

Performance engineer, from 2026-10-21. Author, verbatim, 2026-10-21: "Yes keep improving the engine,
the rendering, the performance, and the game." On the painter, verbatim: "Keep full quality". Worktree
the perf worktree, branch feat/perf. Target: 16.7 ms a frame (60 fps) in every scene at full quality, 33 ms
as the interim floor. Owned here: the figure rasteriser and the character pipeline (characters/), the
frame scheduler. The rendering lead owns render/, game/engine/paint/ and the glyph pipeline.

Tools:
- `node tools/bench.mjs --port <p> [--gpu 1|0|both] [--views ...] [--out f.json]`: per scene, the frame
  (mean, p95), the figure drawer's section timers (characters/runtime/perf.mjs, off unless the bench
  sets `globalThis.__lwPerf`), and a V8 sampling profile grouped by stage. GPU runs take the workstation GPU lock.
- `node characters/proto/perf_diff.mjs --root <checkout> --out f.bin`, then `--compare a.bin b.bin`: the
  image diff test. Draws 42 figure and ground-shadow images (quay walking and talking, three large Brine
  figures, two fighters with a swing's smear) through one checkout's drawer with the painter, on the real
  plates' geo buffers and painted luminance, with a synthetic occluder; the comparison counts differing
  bytes. A change meant to be exact must give 0.

## Steps

1. DONE Profile (GPU on, ANGLE D3D11, RTX 4090, 1920 x 1080; tools/bench.mjs). Milliseconds a frame,
   summed over the figures in the frame. The machine was shared during this run (other headless
   browsers held about three cores), so totals run 1.5 to 2 times the rendering lead's step 39 numbers;
   the shares are what matter.

   | Scene | Frame | Figures | Raster | Self-shadow | Shading | Painter | Drawer post | Ground shadow | Pose, skin | Upload, blit | Plate | GC | Browser |
   |---|---|---|---|---|---|---|---|---|---|---|---|---|---|
   | quay-walk | 157 | 3.1 | 26.6 | 19.2 | 29.2 | 32.4 | 31.6 | 13.0 | 6.7 | 0.6 | 3.1 | 1.8 | 12.8 |
   | quay-talk | 144 | 3.1 | 20.1 | 17.4 | 23.4 | 28.7 | 34.5 | 12.8 | 10.5 | 0.7 | 1.6 | 1.0 | 15.6 |
   | quay-fight | 127 | 3.1 | 16.6 | 14.8 | 21.9 | 29.1 | 20.7 | 9.9 | 12.4 | 0.6 | 3.1 | 0.5 | 12.9 |
   | quay-rain | 133 | 4.1 | 15.1 | 13.0 | 22.4 | 24.1 | 25.4 | 8.6 | 5.4 | 0.8 | 2.2 | 0.8 | 7.5 |
   | floor-dark | 71 | 1.0 | 8.1 | 8.7 | 12.0 | 13.1 | 15.3 | 6.5 | 4.8 | 0.3 | 1.3 | 0.3 | 3.7 |
   | brine-bar | 1094 | 4.0 | 121 | 34.6 | 289 | 273 | 515 | 86.9 | 6.2 | 3.3 | 7.5 | 25.4 | 68.9 |

   Shading: albedo, light, ink, compose, tone and the 2x downsample. Drawer post: exposure, the
   occlusion test, the Oil and Ink shade, the brightness cap and the ink outline. Lighting (the
   rendering lead's light layer) and weather are under 1 ms in every scene; UI and the engine loop
   under 0.3 ms. Readbacks: none per frame in painted mode outside fights (getImageData runs once per
   plate in platectx.mjs and once per lens change in platecam.mjs); the upload of each figure
   (putImageData into a scratch canvas) and its blit cost 0.3 to 3 ms a frame.
   So the figure pipeline is 90 to 97% of every painted frame. All of it is JavaScript on the main
   thread; the painter's share is 20 to 25%.

2. DONE Exact speedups in the figure pipeline (same bytes out: the image diff test gives 0 differing bytes
   over 130 images, 16.45 Mpx, against the dev drawer). G-buffer, shading arrays, exposure arrays and the
   image kept per actor and cleared, not allocated each frame (about 35 MB a Brine figure a frame before);
   the rasteriser keeps each pixel's winning triangle and barycentrics and interpolates once a pixel; the
   ink pass marks a drawn pixel's empty neighbours instead of searching every empty pixel; the outline
   search skips pixels with no opaque pixel in reach (a summed-area table); the self-shadow vote is
   skipped where a texel's 3 x 3 nearest and farthest depths decide it; exposure and the brightness cap
   take medians with typed-array sorts and reuse linear values; the smear blends only the tool's vertices;
   the sampled base pose is kept per clip state (the tool-clearance search asked for it dozens of times a
   frame); the ground shadow reads geo cells by column and row, shades each cell once, skips empty column
   runs and uploads only the rectangle it covers. Main-thread frame, figures drawn on it (GPU on):
   quay 144 to 78 ms, Brine 1094 to 321 ms (same session, shared machine).
3. DONE The Brine's GPU-on slowdown, explained. There are no per-frame readbacks in painted mode outside
   fights: getImageData runs once per plate (platectx.mjs) and once per lens change (platecam.mjs mixInto);
   the upload and blit of every figure cost 0.3 to 3.3 ms a frame. The extra time was inside plain
   JavaScript: with equal figure sizes (1.27 Mpx a frame), the outline pass took 218 ms GPU-on against
   165 GPU-off and the raster 95 against 61, with GC 25 against 5 ms. Each figure allocated about 35 MB of
   fresh typed arrays a frame; page-faulting and zeroing that memory competes with the GPU process for
   memory bandwidth and is sensitive to load. With the buffers reused, the gap closed (step 8 has the A/B).
   Does not prove: which of zeroing, page faults or GC dominates; that would need an ETW trace.
4. DONE Figures off the main thread. runtime/figpool.mjs assigns each figure to one of up to four module
   workers for good (its painter history lives there); runtime/figworker.mjs runs runtime/figjob.mjs
   (raster to composed image, split out of actor.render as prepare and renderJob) and
   runtime/figure-core.mjs (exposure, occlusion, shade, the painter, cap, outline, ghost: the drawer's
   post-pass as one pure function), with the painter installed in the worker from paint/install.mjs. The
   occlusion test moved to a pure ui/occlude.mjs shared by platecam and the workers. A figure has one
   frame in flight; the drawer shows its newest finished image at the feet as they are now, with the
   ground shadow and tells drawn on the main thread as before. A figure waits for the plate's occlusion
   data, so it is never drawn unoccluded. `?figs=sync` keeps the old path; solo draws (the visual check's
   depth reads), debug flags and the painter's trace and screen controls always draw on the main thread.
5. DONE Worker against main thread, byte for byte (`?figs=verify`: every job also drawn on the main
   thread, images compared). Without the painter: 248 fight frames, 0 differing bytes. With it: differences
   up to 60 of 255, traced to the painter keeping a reference to a shared array (design/STATE.md, note for
   the rendering lead). With the one-line fix applied locally (not committed: painter.mjs is the rendering
   lead's): 296 fight frames and 148 Brine frames, 0 differing bytes. Found on the way: my summed-area
   table could go stale when a figure's box changed shape at equal area; fixed before any merge.
6. DONE GPU port of the rasteriser: not done, and why. The painter runs on the CPU and reads the
   G-buffer (material, normal, bind point) for every pixel, so a GPU raster needs a readback of about
   24 to 64 bytes a pixel each frame (1 to 3 MB a quay figure, 7 to 18 MB a Brine figure), the stall the
   brief asked to remove. The raster and self-shadow are 25 to 30% of a figure's worker time; the painter
   30 to 50%. A GPU raster pays only once the painter moves to the GPU with it; until then the workers
   give more. The two belong together and need the rendering lead.
7. DONE Measured again (tools/bench.mjs, GPU on, RTX 4090, 1920 x 1080; the machine was shared all day:
   in the same window, painted mode with no figures at all ran 19 to 21 ms and glyph mode 25 ms, against
   16.7 for both earlier in the day). Frame ms, mean of the four-second window:

   | Scene | Before (step 1) | Figures on the main thread, exact speedups | Figure workers, three runs |
   |---|---|---|---|
   | quay-walk | 157 | 75 | 16.8, 16.7, 23.5 |
   | quay-talk | 144 | 78 | 20.8, 24.7, 21.7 |
   | quay-fight | 127 | 74 | 20.2, 23.5, 23.5 |
   | quay-rain | 133 | 109 | 20.7, 38.5, 32.3 |
   | floor-dark | 71 | 29 | 17.9, 22.5, 23.2 |
   | brine-bar | 1094 | 321 | 41.2, 30.3, 16.7 |

   Main-thread work with workers: 7 to 23 ms a frame on the quay, 20 to 47 in the Brine, most of it the
   ground shadow, the pose solve and skinning. Every scene is under the 33 ms floor in at least two of
   three runs; quay-walk and the Brine reached 16.7 in one. What still blocks a steady 60:
   - a figure's new image rate: one job in flight a figure, about 35 to 55 ms a quay figure and about
     125 ms a Brine figure in a worker on the shared machine, so figures update about 20 to 28 times a
     second on the quay and about 8 in the Brine while the frame runs faster (pose latency one to two
     frames). The painter is the largest stage; a second worker stage per figure would double the rate.
   - the frame floor without figures (19 to 21 ms in the loaded window): the plate, lens, light and weather
     layers' compositing, the rendering lead's, unmeasured on a quiet machine.
   - main thread: pose solving for the tool clearance in fights (up to 6 ms) and the Brine's ground shadow.
   The GPU lock: a bench run of mine was cut off and left the workstation GPU lock (owner "low-water perf bench ...
   pid 255260"); the session's safety rules would not let me delete it. It needs removing by hand.
9. DONE The shared GPU lock (coordinator, 2026-10-21, after my cut-off bench left the workstation GPU lock behind):
   tools/gpu-lock.mjs and a CLI (`node tools/gpu-lock.mjs status`, `run <job> -- <cmd>`). <lock root>/lock.d,
   made by mkdir; owner.json holds pid, job, host, start and a heartbeat every 30 s. Stale when the owner
   pid is gone, the heartbeat is over 2 minutes old, or there has been no owner file for over 2 minutes;
   taken over by renaming to <lock root>/stale-<time>-<pid>.d, never deleted. Released on exit, SIGINT,
   SIGTERM, SIGBREAK and uncaught errors, and only while the lock is still its own. tools/bench.mjs and
   paint/tools/gpu-timing.mjs use it. Tests: node --test tools/tests/gpu-lock.test.mjs (9 pass: taking,
   waiting, dead pid, old heartbeat, no owner file fresh and old, not releasing a lock taken over, release
   on exit, on an uncaught error and rejection, on SIGINT, and a hard kill found stale by the next job).
   The old the workstation GPU lock was left alone: created 09:55:07 (my cut-off run), last written 10:08:01 (the
   owner file removed).
10. DONE The frame floor without figures, profiled (tools/trace.mjs: a Chrome trace by thread and event,
   GPU on, under the GPU lock). With figures off, a painted frame on the quay and in the Brine: main
   thread 6 to 8 ms, GPU process 1.6 to 2.9 ms, compositor and viz under 1.1 ms a frame, every thread
   mostly idle. On a quiet machine painted mode with no figures holds 16.67 ms in 5 of 6 runs (the first
   ran 19 to 20 ms); with the light layer off, 6 of 6. The 19 to 21 ms "floor" of step 7 was machine load.
   One standing hitch: quay-rain runs 19.2 to 19.9 ms on average with p95 16.8, from a single frame of
   about 550 ms in each four-second window, and it does the same with figures off (`figures=plain`), so it
   sits in the plate, light or weather layers (the rendering lead's), not the figure pipeline.
11. DONE The painter's refresh cost, within this side's files.
    - Repaint only figures whose inputs changed: measured first. A hash of each frame's job (skinned
      positions, placement, light, view, exposure stats, hour) never repeated: 0 of 601 frames over three
      scenes (idle and talk clips move every frame, and the clock runs). No saving there, and none
      without the painter's own stroke cache keyed by pose (the rendering lead's file).
    - Exact speedups inside painter.mjs and strokes.mjs (a 256-entry ring cache, births deduplicated) were
      tested on a scratch copy outside the repo: 0 differing bytes, about 8% off the painter. Not committed:
      the session refused edits to the rendering lead's files; offered to them in design/STATE.md.
    - Two-stage workers (the part this side owns): a figure's render and shade run on two workers taken in
      turn, its painting on a third, in order, over a direct worker-to-worker channel (the main thread only
      orders frames). The painter's per-figure history stays on one worker. Worker against main thread with
      the painter's one-line fix (verify mode, through a scratch overlay server): 0 differing bytes in the
      fight and the Brine. A figure splits only while frames come faster than its whole job; on slow frames
      it runs whole on its painting worker (the split would add latency, not images).
    - Each job carries the crop of the plate's occlusion data its box reads (ui/occlude.mjs cropOcclusion)
      instead of every worker holding the whole plate (49 MB of colours each on the quay).
    - Under heavy CPU load the browser starves worker threads before the main thread (jobs of 650 ms
      measured with another agent's checks running). A figure with no image half a second after its first
      ask, or none newer than a second while one is under way, is drawn on the main thread for that frame
      and its job still goes out, so the worker catches up.
    - Ground shadow: cells shaded once, then only the screen box of cells that shade at all is scanned;
      uploads from a list of written pixels into a kept image and canvas (Brine 20.6 to 9.5 ms a frame on
      the main thread, exact).
12. DONE Measured on a quiet machine (load under 15% at the start, 27% at the end), GPU on, three runs. Frame
    mean / p95 ms; figure images a second, each; send-to-image latency ms:

    | Scene | Frame | Images a second | Latency | One stage (step 7 build) |
    |---|---|---|---|---|
    | quay-walk | 16.67, 16.67, 16.67 / 16.8 | 42, 56, 39 | 42, 26, 42 | 16.67, 30 a second |
    | quay-talk | 16.67, 16.67, 16.67 / 16.8 | 52, 54, 42 | 28, 27, 36 | 16.67, 25 |
    | quay-fight | 16.67, 16.67, 17.32 / 16.8 | 26, 28, 22 | 68, 60, 83 | 16.74, 13 |
    | quay-rain | 19.34, 19.24, 19.43 / 16.8 | 34, 36, 26 | 44, 42, 63 | 19.34, 20 |
    | floor-dark | 16.67, 16.67, 16.67 / 16.8 | 55, 52, 53 | 30, 31, 31 | 16.67, 28 |
    | brine-bar | 17.62, 17.02, 16.95 / 16.8 | 11, 7, 6 | 177, 294, 328 | 17.02, 9 |

    Every scene meets the 33 ms floor and five of six hold 16.7 ms frames; quay-rain's 19.3 is the one
    hitch of step 10. Figures on the quay and the floor now get 40 to 56 new images a second (from 25 to 30);
    fighters 22 to 28; the Brine's large figures 6 to 11, with latency up to a third of a second. What
    blocks 60 images a second: the painter (largest stage of a figure's job) and, in the Brine, figures 2.5
    times larger, so a job of 100 to 200 ms; fights, the main thread's pose solve for tool clearance.
13. DONE Visual gate. HEAD 7c31ab2: 8 of 8 with both controls failing (vc-16c). Two other full runs on the
    same build each failed one view, crowd-of-four (shadow off the floor) and fight-against-a-wall (a dark
    fighter). Both flake on dev too, before any of this branch: dev a3a61a7 failed crowd-of-four 1 of 4 and
    fight-against-a-wall 2 of 4 in the same hour, with the same signatures (Lamb's walk ends at -0.96 or
    -0.88 instead of -0.86 under load); this build in figs=sync failed crowd 3 of 4 and fight 1 of 4; with
    workers, fight passed 4 of 4. Stills before (dev a571338) and after look alike in paint and detail; the
    framing differs with dev's own camera change (pairs in the session's final-pair-*.png).
14. DONE Latency, the player's lane, bands, and a heavier scene (coordinator, 2026-10-21).
    - Measured: per figure, the time from a frame's pose sent to its image first drawn (bench `shownMs`,
      globalThis.__lwFigShown). Input to visible is that, plus the wait for the next game step (half a frame
      on average) and one frame to present.
    - The player's lane: Lamb's figure gets workers no other figure uses, and its frames are always cut in
      three bands over three render workers. The bands' exposure samples go to the painting worker, which
      answers each with the median, then puts the rows together and paints the frame as one. Figures of
      120 kpx or more (the Brine's) are cut in two. Exact: characters/proto/band_test.mjs, 12 of 12 (three
      figures, 1 to 4 bands, the image, mask and G-buffer the same as a whole render); verify mode with
      bands, 0 differing bytes (with the painter's one-line fix through the overlay).
    - Not done: a lower resolution while moving (the author's ruling, "Keep full quality"); one figure's
      painting across workers (the painter's strokes take their colour from all their pixels, and the painter
      is the rendering lead's).
    - Heavier scene: tools/bench-views.mjs quay-brawl, a night fight on the quay, Lamb and six wardens, two
      people looking on (nine figures).
    - Lost frames (a worker that fails mid-band) free their figure after 4 s.
    Quiet machine (load 7% at the start), GPU on, three runs each, lane on / lane off:

    | Scene | Frame ms | Lamb shown ms | Lamb images a second | Others shown ms | Others images a second |
    |---|---|---|---|---|---|
    | quay-fight | 16.7 to 16.8 | 67, 72, 78 / 71, 75, 76 | 22 to 27 / 22 to 24 | 72 to 83 | 20 to 22 |
    | quay-brawl | 26.2 to 27.2 / 27.3 to 28.7 | 80, 82, 83 / 113, 120, 139 | 19 / 8 to 10 | 95 to 99 | 11 to 12 |
    | brine-bar | 16.7 to 16.7 / 16.7 to 16.8 | 38, 39, 44 / 40, 45, 48 | 31 to 32 / 40 to 45 | 31 to 32 | 58 to 59 |

    Input to visible for Lamb: about 97 ms in the two-pole fight, 65 ms in the Brine, 122 ms in the brawl
    (shown, plus half a frame, plus a frame). The lane cut the brawl's from about 150 ms and doubled Lamb's
    images there. The Brine's figures, cut in two, now get 58 to 59 images a second each.
    What blocks: in the brawl the main thread (26 to 28 ms frames: the ground shadow for ten footprints
    about 8 ms, pose solve and skinning about 5, plate light reads about 2); in the fight, a frame's job
    of 60 to 70 ms (render about 30, painting about 30) that bands only partly shorten, since each band
    still rasterises every triangle and the whole shadow map.
15. DONE (code), NOT MET (brawl at 16.7 ms, measured) The brawl's main thread, band costs, heads, the painter interface.
    - Ground shadows: worked out in the figure's worker from a crop of the plate's cells
      (groundshadow.mjs footprintMask, gridCrop); the main thread only max-combines the masks over their own
      rectangles. Exact: the image diff test 0 bytes; ?figs=verify compares each worker mask with the main
      thread's, 0 differ.
    - Pose: the solved skeleton is kept per pose state (the tool-clearance search asked for it twice for each
      wrist it tried); the plate's light read without arrays. Skinning stays on the main thread: the smear
      needs last frame's skinned points and a figure's renders alternate workers. Exact.
    - Bands: vertices placed without arrays (the same arithmetic), the self-shadow map drawn only over the
      texels the band's pixels read. Per band of three, a Lamb 300 px tall: 7.2 ms against 17.8 whole
      (node, before: 7.7 against 14.5 on a quieter run), so a band is now 0.41 of the whole job, not 0.53.
      band_test 12 of 12.
    - The fallback for starved figures fed itself under load (drawing on the main thread made frames slow,
      which aged every image past the limit): now one figure each 50 ms at most, none while frames run over
      40 ms.
    - Heads (head sculptor, now in dev): far meshes 11,264 to 14,788 triangles (Fewell, head 5,068 to
      8,592) and 12,264 to 14,752 (Lamb, head 5,060 to 7,160). The render did not get slower within the
      noise; building a mesh takes 124 to 127 ms against 73 to 77, once per figure, LOD and tool, in each
      worker that draws it.
    - Interface for the painter and the head channels (curvature, cavity: two bytes a pixel): design/STATE.md.
    Not measured cleanly: other agents' work held the machine at 24 to 99% load through this round (a
    Playwright Chromium and compiles), and worker jobs ran 3 to 10 times their quiet cost (quay-fight 166 to
    531 ms against 60 to 80 before). In those runs the brawl ran 30 to 57 ms frames and Lamb's frames reached
    the screen in 567 to 650 ms; quay-walk and the Brine held 16.7 ms in most runs. These numbers say the
    figure pipeline degrades badly when the CPU is shared, not what it does on a quiet machine. The brawl
    needs a quiet window to measure; at the last quiet measure (step 14) it ran 26 to 27 ms with Lamb at 80
    to 83 ms.
16. DONE The quiet-bench lock, the loaded-machine benchmark, and the brawl at 16.7 ms (coordinator, 2026-10-21).
    - Locks (tools/gpu-lock.mjs): `bench` (<lock root>/bench.d, exclusive) and `heavy-cpu` (shared entries in
      <lock root>/heavy, each waiting while `bench` is held), with the GPU lock's heartbeat and stale takeover by
      rename. The bench takes the GPU lock first, then `bench`, waits up to 10 minutes for running heavy
      jobs, and samples machine load for 3 s before and after; it calls a run quiet only at 15% or under
      with no heavy job left. `--repeat N` prints min, median and max; `--hog [N]` runs tools/cpuhog.mjs on
      N threads (default 22 of 24) at the game's own priority (below normal) for the loaded benchmark.
      15 lock tests. No run this round was quiet: the background load stayed at 12 to 53% (unwrapped bakes
      and captures early on, long wrapped jobs later). Every number below carries that label.
    - Skinning and the ground contact moved to the figure's worker (actor.prepare skinAt "worker",
      figjob.resolveSkin): the drawer sends the solved skeleton; the smear's last frame goes as its
      skeleton, skinned for the tool's vertices and whole only when a smear is drawn. skin_test 4 of 4 with
      a failing control; ?figs=verify 0 differing bytes.
    - Main-thread cuts, all exact: the ground shadows go up per cluster of overlapping masks into pooled
      images written a pixel at a time in 32 bits (shadow_test: 5 scenes 0 bytes, stats equal, control
      fails); the light read runs only for a frame that is drawn; clip sampling keeps each clip's prepared
      keys per layout (sample_test: 101,320 samples 0 differ, control fails). Image diff test 0 bytes
      (perf_diff now merges a frame's shadow rectangles); ?figs=verify in the fight and the brawl: 2,033
      frames, 0 differing bytes, 1,815 shadow masks equal. Visual gate 8 of 8 with the four controls failing
      (vc-18, vc-19, vc-20); stills inspected.
    - Measured, 1920 x 1080, GPU on, game at below-normal priority, background load 17 to 53%:

      | Brawl (9 figures) | Frame ms | p95 | Lamb shown ms | Drawer ms a frame | Ground shadow |
      |---|---|---|---|---|---|
      | before this round (868f988) | 18.4 to 25.5 | 33 to 67 | 73 to 120 | 11.5 to 13.5 | 2.9 to 4.4 |
      | skinning in the worker (9fc4250 adds the light and sampling cuts) | 16.67 to 17.86 | 16.7 to 16.8 | 65 to 81 | 7.1 to 7.9 | 2.8 to 3.6 |
      | now (1f6810e), 4 runs | 16.67 in all 4 | 16.7 to 16.8 | 66 to 70 | 7.3 to 7.8 | 1.7 to 2.0 |
      | now, hog on 22 of 24 threads | 16.67 | 16.8 | 100 to 121 | 5.3 to 5.4 | 1.8 |

      Input to visible for Lamb in the brawl: about 66 to 70 ms shown, plus half a frame, plus a frame:
      about 92 to 95 ms (target 100). Loaded: about 125 to 146 ms (target 150). Frames at 16.7 ms loaded
      (target 33). The other five scenes: 16.67 to 16.88 ms; the Brine 17.2 to 19.8 ms with some 33 ms
      frames (p95 33.4 in one of two runs), not looked into this round.
    - Tried and turned off: the other figures' share fed back on Lamb's latency (?figadapt=1). Under the hog
      it cut the share to one frame in flight, the other figures got 1 to 3 images in 4 s, the drawer's
      starved fallback drew them on the main thread, and frames went to 43 to 72 ms with no gain for Lamb.
      A fixed share (?figbudget) now serves the figure whose newest image is oldest first; without that
      the figures drawn first took every slot. Lamb's lane on its own workers already holds the loaded
      target, so the pool stays at its quiet size.
    - The skinning move alone, paired runs at 34 to 52% load: frames 17.2 to 18.8 against 18.9 to 21.2 ms
      with skinning on the main thread (?figskin=main), the drawer 10.5 to 11.6 against 12.0 to 14.4 ms.
    - Left on the main thread in the brawl, ms a frame: the pose (drive, tool clearance) 4.4 to 5.0, the ground
      shadow 1.7 to 2.0, the rest of the drawer about 1.3.
17. DONE The tool clearance search off the main thread, and a crowd tier for the wide lens (coordinator, 2026-10-21, The Quota).
    - The pose cost in the brawl was mostly the tool clearance search (3.9 of 5.0 ms a frame: about 13
      skeleton solves per figure per frame while poles crowd each other). It now runs in two tool workers
      (runtime/toolclear.mjs, the limits and the search, pure; runtime/toolworker.mjs). The drawer sends
      each figure's pose without the tool layer, its foot locks, place, limits and neighbours. Prop cells
      travel as a crop of the walk grid. The answer is the target the wrist eases toward. tool_test: 96 of
      96 answers equal to the search on the actor itself, and the control changes 92. Node (the search on
      the main thread): image diff 0 bytes. Brawl, paired runs at 40 to 72% background load: pose and tool
      4.6 to 5.4 ms a frame on the main thread before, 1.4 to 1.5 after; the drawer 7.3 to 7.9 before, 3.8
      to 4.3 after. Answers come back 6 to 8 ms after the question, about one per figure per frame. Visual
      gate 8 of 8, controls failing (vc-21).
    - Crowd tier: tools/crowd-cards.mjs and runtime/crowd.mjs (design/STATE.md has the interface and the
      open questions on the look). Bench views crowd-0, crowd-300 and crowd-1000 show the whole quay with ten
      full figures. Background load 28 to 33%, so not quiet: frames 16.67 ms in all six runs. Main thread
      busy 10.0, 11.5 and 14.8 ms a frame; the cards' own cost 0.75 and 2.2 ms. Under the CPU hog: 300
      cards 16.7 to 16.8 ms (target 33), 1000 cards 16.7 to 18.3 ms with one 133 ms hitch. Proposed budget:
      12 full figures and 500 cards. crowd_test 6 checks, the control fails; visual gate 8 of 8 (vc-22).
    - Not yet measured: the Exchange Square and the granary-door fight (no plates yet), the lens transition
      (no prototype yet), the head channels G.curv and G.cav (queued), portraits in the talk panel (not yet
      landed).
18. DONE The head channels in the G-buffer: G.curv and G.cav (design/STATE.md layout, from the character lead).
    - render/raster.mjs: `G.curv` (cleared to 128) and `G.cav` (cleared to 0), one byte each a pixel at the
      supersampled size. Where a pixel wins the depth test, each is the barycentric blend of the triangle's
      per-vertex bytes, rounded, with the bind point's own weights. The bytes are `vertexBytes(M)`, the same
      arrays and cache as forge/heads.mjs `vertexMaps`. The worker sends both channels to the painting worker,
      for the whole figure and per band.
    - curv_test: per-vertex bytes set to a linear function of bind height come back as that function of
      G.loc's height within 0.97 (vertex rounding allows 1) over 19,414 pixels; the control (the wrong axis) is
      off by 209; with sculpted heads on, the head's maps reach 242 face pixels and no uncovered pixel; 2 and 3
      bands equal the whole render. Image diff 0 bytes: the painter does not read the channels yet.
      ?figs=verify 303 frames, 0 differing bytes. Visual gate 8 of 8, controls failing (vc-23).
    - Cost: not separable from noise. makeG plus rasterize at 285 x 300 took 4.1 to 5.9 ms against 4.6 to 5.5
      before, in paired runs on a machine loaded by other work. The brawl comparison ran at 71 to 100% load
      against 39 to 57%, which says nothing. By count it is two byte fills and two three-term blends per
      covered pixel (about 20,000 a figure), plus 2 bytes a pixel more in each render's message. To be
      measured again on a quiet machine, and once the painter reads them.
19. DONE (my part), NOT MET (no hitch over 50 ms) The move between places. The lens transition's stand-in is the
    ink-blot move between two existing plates, because the Quota's wide and narrow plates do not exist yet.
    - Tools: a bench or trace view can carry a during(), an action started 0.5 s into the measured window.
      The bench reports the frame gaps after it (`transition`) and profiles the same window. tools/trace.mjs
      lists the longest main-thread spans. The view is move-quay-brine (?blot=1 keeps the blot in a capture).
    - What held the frame (V8 samples in each stretch over 40 ms):
      - plate arena and ground mask (combat/sim/plate.mjs, world/plateworld.mjs);
      - lens-layer mixing, a GPU readback (ui/platecam.mjs mixInto);
      - the light field's ground normals and pools (paint/lightfield.mjs);
      - the weather's static field and smoke (ui/weatherlayer.mjs);
      - the ink blot's own field (paint/inkblot.mjs);
      - and two that were mine: the far mesh of each new figure, built here only for the pose solve (sdfmesh,
        50 to 160 ms a figure), and the plate's luminance read back here (100 to 160 ms a plate image).
    - Mine, fixed, exact:
      - the pose solve reads a build summary that a figure worker sends (actor.mjs metaOfBuilt; meta_test:
        400 solves over 50 members equal, hidden parts equal, control changes 64). A new figure stays undrawn
        for the few frames until the summary arrives.
      - the luminance is read in runtime/lumaworker.mjs: 0 of 7.5 M values differ from the main thread's.
    - Smoke (ui/weatherlayer.mjs): each puff adds into only the cells its circle covers, in the puffs' order,
      so every cell's sum is the same additions (a check over 4.7 M cells: 0 differ). In the Brine, smoke went
      from 9.6 to 1.8 to 2.4 ms a frame.
    - Measured, quay to the Brine, 3 paired runs, background load 22 to 58% (not quiet):

      | Quay to the Brine | Before | After |
      |---|---|---|
      | Frames over 50 ms | 7, 7, 7 | 2 to 4 |
      | Worst gap | 267 to 283 ms | 200 to 233 ms |
      | Frames in the 6 s window | 226 to 249 | 301 to 305 |

    - What remains is in other owners' code: the plate arena and ground mask, lens mixing, the light field and
      the weather statics. Each of these needs moving off the frame (a worker, or precomputed per plate) to
      reach the 50 ms budget. Gates: tool_test, meta_test, the image diff 0 bytes; ?figs=verify 1,134 frames 0
      differ; visual gate 8 of 8 with controls failing (vc-24).
20. DONE The portraits in the talk panel (ui/portrait.mjs, the UI and UX lead's slot; the character lead's 512 x 640
    paintings). Views talk-portrait and talk-noportrait: the quay's conversation open, then 0.5 s into the window
    the real slot shows Fewell's face, and a second later another expression (the 120 ms cross-fade); the same
    conversation with no face. 3 paired runs, background load 40 to 62% (not quiet): frames 16.67 to 16.88 ms
    with a face, 16.67 ms without. No frame over 50 ms with a face, and one frame at 50 ms in one run. The face
    costs nothing measurable in the frame. Seen on the way, for the UI and UX lead: in the game itself this
    conversation shows no face, because the slot reads `P.talk.speaker` and it is empty here, though the
    lines name Fewell. The slot was driven directly to measure it.
21. DONE (MET: no frame over 50 ms on a place move) The move's remaining stalls, taken from the other owners' files
    at the coordinator's request, byte-identical (notes in design/state/perf.md).
    - ui/plateworker.mjs, through the pure pieces in ui/platedata.mjs (plateGround, occludeData, mixInto, moved
      out of ui/platecam.mjs): the walking ground, the occlusion data, the plate's colours, and the plate and its
      lens layers. Checked against the main thread for quay, the Brine and the weigh-house: arena JSON equal,
      depths, heights and colours 0 differ, plate and lens canvases 0 of 25.5 M pixels differ. In the game, with
      ?plateworker=0 against the default, the plate canvases, arena, occlusion and 400 occlusion answers hash
      equal. A plate is ready only once its ground is.
    - paint/lightworker.mjs: the ground normals, wet mask, lamp glints and the lantern's first pool, made by the
      same lightfield functions, with 0 differ for quay, quay in rain and the Brine. The layer draws nothing for
      the new plate until they arrive, which is under the ink blot. Lighting quay in rain took 650 ms on the main
      thread. The light lead's new model in game/engine/light/ is untouched.
    - paint/inkblot.mjs: the blot's field is made ahead of time in slices of rows, each pixel's octaves added in
      the same order (845,413 values, 0 differ), and the arrivals are kept.
    - Small changes: platectx reads the geo buffer and its validity in the luminance worker (0 differ). Smoke keeps
      its ImageData between frames. A figure's first image waits 1.5 s before the main thread draws it, because
      the new place's meshes are being built in the workers.
    - The workers draw on software canvases, so they put no GPU work beside the page's while a place loads. The
      pixels were checked equal. GPU canvases in the workers had made the page wait on commits for 160 to 780 ms.
    - Measured, quay to the Brine, 3 paired runs, background load 24 to 73% (not quiet):

      | Quay to the Brine | Before (6d34de8) | After |
      |---|---|---|
      | Frames over 50 ms | 3, 3, 3 | 0, 0, 0 |
      | Worst gap | 200 to 233 ms | 33 ms |
      | Frames in 6 s | 296 to 304 | 325 to 329 |

    - Gates: the eight figure tests 0 failures; ?figs=verify 756 frames, 0 differ; visual gate 8 of 8 with
      controls failing (vc-26, vc-27, vc-28). One run before the ready-after-ground change failed harbour-office
      (Lamb drawn on the desk at 23:55: the scene stepped late), and that change is the fix.
    - Seen on the way, not changed: in the Brine the lantern's pool covers 845,000 samples, and it is remade
      whenever Lamb moves 2 cm. Walking in the Brine therefore costs a large pool every frame. Indoors the pool
      is drawn at a quarter strength. Worth a look by the light lead.
22. DONE Multiplane for the crowd tier: cards cut by the plate's occluders in depth bands (coordinator, after the
    author's new references). Design and the proposed bake format: design/state/perf.md.
    - Runtime: masks of the plate's pixels above the walking grid, in 2 m depth bands, made in the plate worker in
      128 px tiles (q_square_wide: built in 3.7 s on the worker thread). The cards are drawn into their own
      canvas and each band erases itself where a deeper card lies (64 px occupancy grid). The plate, its light
      and weather show through. The full figures, the near tier, stay on top. `?planes=0` restores the old cull.
      An earlier attempt drew the bands in the plate's colours. That covered the weather's water and light in
      rectangles, so the bands are now masks. A second attempt clipped each band to hundreds of card rectangles,
      which made frames 34 to 49 ms on the quay; now each band erases its tiles without a clip.
    - Measured, paired, 2 runs each, background load 26 to 46% (not quiet):

      | View (10 to 12 full figures) | Frame ms, planes / without | Cards' own cost a frame, planes / without |
      |---|---|---|
      | quota-square (queue of about 40) | 16.67 / 16.67 to 17.39 | 0.56 to 0.63 / 0.08 to 0.11 |
      | crowd-300 (quay) | 16.67 / 16.67 | 3.08 to 3.32 / 0.71 to 0.80 |
      | crowd-1000 (quay) | 16.81 to 16.95 (p95 16.7 to 16.8) / 16.67 | 5.64 to 6.05 / 2.06 to 2.24 |
      | Hog on 22 of 24 threads: crowd-300, quota-square | 16.67, 17.24 | 3.63, 0.58 |

      The budget holds: 12 full figures and 500 cards with planes stay at 16.7 ms here. Planes cost about 2.5 ms
      of script per 300 cards, against about 0.75 ms for the cards alone.
    - Gates: crowd_test 6 checks with a failing control; visual gate 8 of 8 with controls failing (vc-29). Stills
      inspected: on the square the queue's last cards are cut by the row houses' roof edge (without planes they
      are drawn over it), and the quay shows no rectangles.
    - Also this round: quota-square and quota-granary bench views for the light lead (the Quota plates are now
      baked), and the crowd views wait for the planes before measuring.
