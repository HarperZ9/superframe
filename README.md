# Superframe

Describe a piece in plain words and get it back in every medium at once: a painting, a page of living type, a line drawing, a carved material, a sound and a touch pattern. All of them come from one seeded recipe. You can then read the piece back as a study of its own parts, in whichever sense works for you.

```
npm run make -- "heavy rust coral upper left, fine teal frost on the right, \"seeing sounds, hearing images\"" out/first --seed first
```

The same words and seed give the same files, byte for byte. Change one word and only that element changes, in every medium, in the same place.

## Hear an image, see a sound

Every element in a piece is a law acting on a field. Reaction-diffusion coral, marbling, frost, ink in water, a slime-mould network and Kepler orbits are among the 15 laws. Each medium reads the same field in its own way:

| Medium | How it reads the field |
|---|---|
| Paint | pigment on paper, mixed band by band over 16 wavelengths and lit by the material's relief |
| Type | the text set across the page; each letter gets heavier and darker where an element acts |
| Lines | contour lines at even levels, as a drawing and as SVG |
| Material | height, roughness and normals, shown as clay under a raking light |
| Sound | left to right is time, top to bottom is pitch: you hear the picture as a score |
| Touch | a vibration pattern that follows the loudness over time |

An element in the upper left of the frame plays early and high. A dense element plays loud. The mapping is fixed and stated, so a person can learn to hear where things are, the way one learns to read a spectrogram.

## For every kind of reader

Each render writes a study of its own parts:

- `study.md` for people and screen readers. It gives one plain sentence per element and alt text for each medium.
- `study.json` for software and language models. It lists each element's properties, the weights its law read and the ones it ignored, and whether the law had settled. It also holds a measured record of how much of each element survived into each medium.
- `tactile.json` is a vibration pattern for a phone.

The engine never asks you to use one sense. Pick the readout that works for you, or layer two. The `room` command opens a local, private space for this kind of work, with words, numbers, pictures and sound converting into one another. It is a creative tool, and it makes no claims about therapy or outcomes.

## Change it freely

A piece is a recipe you can edit by hand or recombine:

```
node superframe/cli/superframe.mjs artifact out/first/recipe.json out/b --isomer permute
node superframe/cli/superframe.mjs artifact out/first/recipe.json out/c --metamer coral
node superframe/cli/superframe.mjs artifact out/first/recipe.json out/d --route coral:sound:0
node superframe/cli/superframe.mjs artifact out/first/recipe.json out/e --edit elements.coral.weights.F=0.03
```

| Operation | What it does |
|---|---|
| `--isomer` | keeps every weight and moves the parts: the same ingredients in a new arrangement |
| `--metamer` | gives an ink a spectrum that matches in daylight and splits under tungsten light |
| `--route` | sets how much of an element passes into a medium; 0 silences it there |
| `--edit` | changes one weight |

## Beyond the artifact engine

The rest of the tree is the engine the recipes run on. It has 160 nodes behind one typed interface: lettering, Chladni plates, marbling, optics, instruments, retro display models and more. The graph inserts converters between media by itself.

```
node superframe/cli/superframe.mjs list
node superframe/cli/superframe.mjs try chladni.sand
node superframe/cli/superframe.mjs room
```

Every node and converter draws from its own substream of one seed rule, `xmur3-mulberry32/1`. That is the same rule the [site](https://harperz9.github.io/) uses, so a seed means the same thing everywhere.

## Run the tests

```
npm test
```

There are 271 tests, and they cover these properties:

- the same recipe gives the same bytes;
- an edit changes nothing outside its element's region or its time window, with a control that proves the check can fail;
- an unused word changes nothing;
- the metamer split;
- golden hashes for every node.

Node 22 or later. There are no dependencies.

## Limits

- The laws run on their own grids at half the output size. Fine texture at 4K comes from seeded grain, and the law itself runs coarser, so close up the paint is soft.
- Elements don't act on one another yet. Each law runs alone in its own region.
- Type is the weakest crossing. On the first full render, an element's ticks correlate with what the type shows at 0.06 to 0.34. Paint, material and sound reach up to 0.87 to 0.91.
- The intent reader knows a small English vocabulary. Words it doesn't know are listed, never guessed.
- The `explore` command needs a local reference corpus and is not part of this repository.

## Layout

The engine was built as one workspace, and its folders keep their working names:

| Folder | What it holds |
|---|---|
| `superframe/` | the node interface, graph, converters, CLI and the artifact engine (`lib/artifact/`) |
| `creation/` | the creation engine's laws |
| `typeengine/`, `typeface/` | living type and the Accession family |
| `substrate/` | the seed and receipt contracts |
| other folders | the techniques the nodes wrap, each imported unchanged |

`MANIFEST.json` lists every file with the SHA-256 of its source.

## Licence

The code is under FSL-1.1-MIT (`LICENSE`), which becomes MIT two years after each release. The Accession fonts are under the SIL Open Font License 1.1 (`OFL-Accession.txt`). Hanken Grotesk is under the same licence, from its authors (`OFL-Hanken-Grotesk.txt`). The creation engine's Zipf test reads one of the author's published essays as its corpus (CC BY 4.0, credited in the file).

By Zain Dana Harper.
