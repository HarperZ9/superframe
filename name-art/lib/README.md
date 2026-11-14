# name-art/lib

Shared picture code for the name-art concepts.

`press.mjs` reached the repository on 2026-11-14 from the author's workspace, where it was written on 2026-11-09. It gives a float picture the press finish: emboss and deboss from a height map with bevelled edges, gold foil with a specular lobe, laid-paper fibre and a halftone dot rule. `concepts/16-intaglio-lines.mjs` calls it when `press` is set.

`img.mjs` now takes its grain, bloom and highlight shoulder from `superframe/lib/look`.

## BuildLang port candidates

`press.mjs` is JavaScript carried from the workspace, with no new feature code written here. It is array arithmetic over a float picture and can move to BuildLang. It has no test of its own yet; the `nameart.*` node goldens in `superframe/tests/golden/nodes.json` cover `img.mjs`.

| Module | Exports |
|---|---|
| `press.mjs` | `press`, `dotRule` |
