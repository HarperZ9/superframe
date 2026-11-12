# AGENTS.md: The Playground

## Read first: where this repository sits

These points apply to every session and every model working here.

- **This repository is The Playground, and The Playground is the engine.** The renderer, type,
  sound, materials, study tools and games are one project. The repository is still named
  `superframe` on GitHub; the name follows later.
- **Everything is BuildLang.** New code is written in BuildLang (`HarperZ9/buildlang`). New
  Rust, Python and JavaScript are not added. C++, HLSL and GLSL stay in use where the renderer
  and GPUs need them, and they are reached through BuildLang.
- **A missing BuildLang feature is the task.** File it against the compiler and build it there.
  It is never a reason to fall back to another language.
- **Ports are proven.** Existing Python, JavaScript and C++ keeps working until its BuildLang
  port matches it bit for bit under a parity check. Then the old code is removed.
- **Small repositories fold in here.** Do not start a new repository for a tool. A repository
  that moves in comes with its history (`git subtree`), gets its tests wired into CI, and the
  old repository is archived with a pointer.
- **Look for what exists before building.** Search `packages/`, `native/` and the sibling
  projects first.

## Layout

| Where | What | Was |
|---|---|---|
| `superframe/`, `creation/`, `typeengine/` and the folders beside them | the core: laws, media, measures | superframe |
| `packages/` | instruments and study tools, each with known-answer tests | includes superstack, reconcile, studio-libs |
| `native/` | the C++23 renderer on Direct3D 12, Vulkan and WebGPU | raw-native |
| `games/low-water/` | Low Water, the narrative action game and full demonstration of the engine | low-water |

Duplicates still to merge: `substrate/lib/vendor/superstack.mjs` against `packages/superstack`;
`packages/ndim` and `packages/perceive` against `packages/studio-libs/render-nd` and `sense-core`.

## Checks

```
npm test                 # the core
npm run test:packages    # packages, and the superstack vectors
npm run test:py          # Python package tests
npm run test:games       # Low Water engine and combat
python packages/build_manifest.py --check
```

- The renderer builds and tests from inside `native/` (`native/README.md`). Its workflows are
  `.github/workflows/native-*.yml` and start only when `native/` changes.
- Plate bakes and media for Low Water are reproducible and untracked. A test that reads a bake
  reports as skipped where the bake is absent. A skip is never counted as a pass.
- The publish gate must pass before anything from a private source lands here: no workstation
  paths, no secrets, and author emails in imported history set to the GitHub noreply address.

## Sibling projects

BuildLang at `HarperZ9/buildlang`; The Flywheel (accountability and checking) at
`HarperZ9/flywheel`; The Commons at `HarperZ9/cmmns`; the site at `HarperZ9/HarperZ9.github.io`,
where The Playground's front page is `/playground/`.
