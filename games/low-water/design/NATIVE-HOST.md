<!-- writing-profile: research -->
# Native host: route decision (D2, spike W1-D)

Dated 2026-10-22. Author decision D2 (2026-10-23 entry in DECISIONS-2026-10-22.md): the Steam build is a raw-native port; the browser build stays as the development and web demo build. This note compares the three routes with a built spike and gives the package plan for W2-E.

Limits up front. One machine (Windows 11, other agents running builds at the same time, so timings carry noise: repeat runs of the same exe gave 22 to 47 s to the title). One title screen, not a game frame. The bounds below were drafted from the brief and fixed in this file after the first spike run, not committed before it. Nothing here was run on a Steam Deck.

## 1. Browser API surface (game/engine, 351 .mjs files, 29,630 lines, tests and tools excluded)

| Surface | Files | Uses | Note |
|---|---|---|---|
| DOM (document, createElement, querySelector, classList, style, addEventListener, innerHTML) | 77 | 609 | every screen is DOM plus 3 CSS files (daybook, era, panels) |
| Canvas 2D (getContext 2d, OffscreenCanvas, ImageData, drawImage) | 30 | 140 | painter, lettering, figures, plates |
| WebGL | 4 | 7 | |
| WebGPU | 0 | 0 | not used |
| Web Audio | 2 | 9 | film sound, mixer |
| localStorage / sessionStorage / IndexedDB | 11 | 25 | already behind save/filestore.mjs |
| fetch | 15 | 22 | content, wiring, plates |
| Worker / postMessage / SharedArrayBuffer | 9 | 21 | paper, plate and aged workers |
| requestAnimationFrame / performance.now | 47 | 147 | |
| Gamepad | 11 | 23 | ui/input.mjs polls navigator.getGamepads |
| dynamic import() | 7 | 10 | |
| Image, createImageBitmap, Blob, URL.createObjectURL | 7 | 10 | |
| timers | 16 | 40 | |

Counts are grep matches (rg -E), so they over-count in comments and under-count aliased calls. Confidence moderate.

## 2. Bounds

| Bound | Value | How measured |
|---|---|---|
| Frame time at 1080p | 16.7 ms (60 fps), 33 ms on Deck | 240 repaints of the title, p50 and p99 |
| Input to visible | 50 ms or less | key event to end of paint, excluding display scanout (add up to 16.7 ms at 60 Hz) |
| Cold start to title | 5 s or less, not counting the timed boot cards (11 s of fixed card time) | process creation time to first title paint |
| Memory | under 500 MB working set at the title | GetProcessMemoryInfo |
| Binary | under 10 MB host exe, QuickJS included | file size |
| Steam Deck under Proton | 30 fps or better at 1280x800, title reached, pad moves focus | plan below |

Deck plan. A Proton run is not possible on this machine. Copy shell/out to a Deck (desktop mode), add lwhost.exe as a non-Steam game with Proton Experimental and Proton-GE, run `lwhost.exe --game <dir> --smoke`, and keep the JSON line. Repeat with a native Linux build once raw-native's Vulkan present is wired. Known risk: this spike paints with GDI and decodes plates with WIC; both exist in Wine with gaps, so the Deck result for this spike says little about the final D3D12 or Vulkan path.

## 3. The spike

shell/ (Low Water) and raw::platform::FileBridge (raw-native PR 216). lwhost.exe (1.2 MB, QuickJS-ng 0.10.1 linked statically) opens a window, loads the shim (a DOM subset of about 200 lines), and runs the real boot: save/nativehook.mjs, ui/app.mjs, content load, createFullGame, the boot cards, titleScreen. The title's DOM tree is read through a snapshot function, and the host paints the plate (WIC decode, cover scale) and the menu with GDI. Keyboard and pad events go to the real ui/input.mjs and ui/focus.mjs. The file bridge is the raw-native one, set as globalThis.__lwFileBridge, so nativehook switches the saves, world record and settings to files.

Measured (smoke, 1920x1061 client, repeated runs; the range is noise from concurrent builds):

| Measure | Result | Bound |
|---|---|---|
| Modules loaded | 273 (compile 0.8 to 1.1 s total) | |
| Entry module evaluation (sync, before the first card) | 7.8 to 14.8 s | |
| Cold start to title, with boot cards | 22 to 47 s | |
| Cold start to title, boot=0 (no cards) | 11.9 s | 5 s: FAILS |
| Title paint p50 / p99 | 2.0 ms / 8.6 to 10.9 ms (GDI, CPU) | 16.7 ms: passes, title only |
| Key and pad to painted | 2.8 to 6.8 ms | 50 ms: passes |
| Working set at title | 92 to 110 MB | passes |
| Host exe | 1.2 MB | passes |
| Focus walk by key (Down, Down, Up) and by pad (d-pad down) | moved one entry each, through the game's own input module | passes |
| Settings on disk | files written under the save root | passes |

Cold start is the failing bound. About 1 s is compile; the rest is evaluation of module top levels and the boot's content load in an interpreter. It is not yet profiled and no browser or Node baseline was taken, so the cause is unknown. Candidates: heavy top-level table building, the act1 content parse, QuickJS speed (an interpreter, with no JIT, by design).

Not working in the spike, shown by its log: Worker (aged and paint fall back to the main thread), Web Audio, fetch.arrayBuffer (the opening film cannot load), absolute module imports from /characters/ (figures stay plain), woff2 fonts (Segoe UI and Consolas stand in), Canvas 2D, CSS layout.

Tests (shell/tests/host.test.mjs, 3 pass): the exe smoke (timed, clean exit, focus by key and pad, files on disk); the filestore round trip, replace, and kill-at-every-step sweep (14 steps, both outcomes seen) through the real bridge; and six real process kills during writes, each followed by a whole read. raw-native has test_file_bridge. The sweep injects the kill between bridge calls; the process kills test the OS side. Neither tests power loss.

## 4. Route decision

| Route | Evidence | Verdict |
|---|---|---|
| A. embed JS, keep the DOM | Boots and runs with a 200-line DOM subset, but the DOM has no layout and no CSS. 77 files and 609 uses build screens as DOM, so a real subset means writing a layout engine | Works as a bridge, not as the ship target |
| B. port to C++ | 29.6k lines of engine JS plus the dialogue and combat runtime and a content grammar. Highest control, no startup cost | Rejected for 1.0: months, and it forks the browser build |
| C. hybrid | JS logic proven on QuickJS (273 modules, real input and focus, files). Native rendering and UI for what the snapshot path already shows | Chosen |

Route C means: JS keeps game, story, rules, save and input logic. Screens stop being DOM at ship: each screen emits a retained scene (a typed tree of text, boxes, images, focus) that raw-native draws. The browser build keeps its DOM renderer over the same scene, so the two stay in step. Confidence: moderate on direction; low on the startup fix and on the Canvas 2D cost, the two open questions.

Risks, in order: (1) cold start 12 s against 5 s; if profiling finds it is the interpreter, V8 (or QuickJS bytecode precompile, qjsc) is the fallback and V8 adds tens of MB; (2) Canvas 2D in 30 files, the painter and lettering, needs either a Canvas 2D subset on raw-native or a port of those modules; (3) the dependency policy: QuickJS is MIT third-party code shipped inside the exe, against "ship none"; the author must decide, with a hand-written interpreter as the alternative; (4) Deck unknown; (5) woff2 fonts need conversion; (6) the sync bridge contract holds, but Steam Cloud and overlay are untested.

## 5. Work estimate and packages (agent runs of 30 turns; low confidence, about 50 in total)

| Package | Scope | Runs |
|---|---|---|
| W2-E1 | Profile cold start; lazy load, precompiled bytecode, content cache; target 5 s or less; Node and Chromium baselines; V8 go or no-go | 3 |
| W2-E2 | Host API: fetch arrayBuffer, module mounts (/characters), Worker on threads, TextEncoder, structuredClone, timers on a real loop | 4 |
| W2-E3 | Canvas 2D subset on raw-native (or painter port); plates, glyphs, lettering | 12 |
| W2-E4 | Scene tree replaces the DOM shim; native widgets, focus, text layout, woff2 to TTF; CSS replaced by scene styles | 15 |
| W2-E5 | Audio onto raw-native | 4 |
| W2-E6 | D3D12 present in place of GDI; window modes, frame cap, vsync, pad on hardware, build id (B7, B8) | 5 |
| W2-E7 | Depot builder (B2), optional Steamworks, Steam Input layout, Proton and Deck run | 6 |

Next action: W2-E1, since a failed start bound decides whether QuickJS stays.

## 6. Reproduce

`shell/build.bat [QuickJS-ng dir] [raw-native dir]`, then `node --test shell/tests/host.test.mjs`. QuickJS-ng v0.10.1 was cloned to a local cache and is not vendored.
