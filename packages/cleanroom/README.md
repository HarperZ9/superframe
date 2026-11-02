# cleanroom

## Mission

Save any artifact we study as an internal copy, take it apart entirely, and build from it in two
recorded ways. Copy-derived work transforms and recombines the copies themselves and stays internal
by default. Spec-derived work builds new pieces from written measurements and goes public by default.
Every output carries its lineage, and nothing reaches the public until a measured difference report
has run and, for copy-derived work, a person has recorded the decision to release it.

The author's decision, 2026-10-29: "a copy should always be downloaded. And it does keep the risk on
my side, and it does stay out of store builds. But for our work and our media materials and our
recreation and deconstruction and reconstruction, and synthesis, internally for our proprietary work,
this is one of our key tools. So we need to be able to take any artifact and save it internally and
deconstruct it entirely in a clean room." The same day the author opened the build side to the full
copies ("a build side can read the whole entire artifact and manipulate it and transform it and
recreate from it, whatever") and asked for blends of any number of sources at any ratio.

## This is not a clean room in the legal sense

The name stayed, but the wall did not. The build side may read vault copies directly, so a
copy-derived output may be a derivative work of what it read. The risk sits at publication. What
this tool provides is a **lineage and release gate**: a record of what every output read and did, a
measured difference report, and a refusal to publish copy-derived work without a recorded human
decision. That is a process control. It is not a legal shield and it is not a clearance.

**No metric here decides infringement.** Substantial similarity is a legal judgement about protected
expression. Every difference report carries that line.

## Limits that stay in force

- Copies stay local in the vault. No command uploads, shares, publishes or redistributes one, and the
  vault stays out of store builds.
- No DRM decryption and no circumvention of access controls. The vault takes only what a save already
  holds.
- Inputs are untrusted data. They are read in binary, hashed and copied, never executed or imported.
  Run everything with `python -I`. Files named like credentials or recovery phrases are skipped
  without being opened. Media types come from magic bytes.

## Layout

| Path | Holds |
|---|---|
| `$CLEANROOM_VAULT/copies/ab/cd/<sha256>.<ext>` | read-only copies, content-addressed |
| `$CLEANROOM_VAULT/records/ab/<sha256>.json` | vault record: sha256, original URL, post, save date, media type, licence tag, tier `copy`, sources, embed probes |
| `$CLEANROOM_VAULT/specs/spec-<sha16>-v1.json` | SPEC record: measurements, parts, rules, prose; cites the vault sha256; no media |
| `$CLEANROOM_VAULT/reports/<report sha256>.json` | difference reports, stored by hash |
| `$CLEANROOM_VAULT/releases/<output sha256>.json` | human release notes |
| `<output>.lineage.json`, `<output>.recipe.json` | lineage beside every output; recipe beside every blend |

Licence tags: `cc-by`, `cc-by-sa`, `cc0`, `public-domain`, `own`, `permitted`, `reference-only`,
`unknown`. Every copy starts as `unknown` unless its sidecar names an open licence; `cleanroom tag`
changes it and records the basis.

## Commands

```
cleanroom ingest --daylight [DIR] [--newest N] [--gather CORPUS ...]
cleanroom decompose [SHA ...] [--shas-file F] [--force]
cleanroom spec <spec id or sha prefix>
cleanroom lineage <output>
cleanroom report <file>
cleanroom blend <recipe.json>
cleanroom release <file> --by NAME --why TEXT
cleanroom gate <file> [--route public|internal] [--strict]
cleanroom tag <sha> <licence> --basis TEXT
cleanroom stats [--shas-file F]
```

`cleanroom.cmd` runs `python -I -B cleanroom_cli.py`. The vault root is required: pass `--vault DIR`
or set `CLEANROOM_VAULT`. `ingest --daylight` with no folder reads `CLEANROOM_DAYLIGHT`. Exit code 2 from `gate` means refused.

## Study side: decomposition

`decompose` reuses the existing libraries in place:

- images: `packages/decompose/design_parts` `measure_all` (palette, shape, geometry, negative space, motif,
  wallpaper group, perspective; 74 features), `packages/lattice` axis alignment, a radial power
  spectrum and a 64-bit perceptual hash;
- video and GIF: the same on five sampled frames (mean and spread), plus audio features;
- audio: `audiofeat` (spectral centroid, bandwidth, rolloff, flatness, onsets, tempo, RMS loudness,
  pitch-class profile);
- text: `packages/decompose/textphase` entropy rates, and the phase profile when the text has 3000 characters
  or more. A text spec stores no words from the original.

## Build side: two modes

`lineage.Workspace` is the build-side handle. `open_copy(sha)` returns a vault path and marks the
output copy-derived. `open_spec(id)` returns a spec. `transform(...)` and `note_generated(...)`
record what happened. `write(output)` writes the lineage record with the output's sha256, every
vault sha256 and spec id read, the transforms, the label and the default route.

### Blend

`cleanroom blend recipe.json` combines any number of sources at any ratio. A source is
`vault:<sha>`, `spec:<id>`, `gen:` with design-parts parameters, or `own:<path>`. Each source has a
weight, a gain, per-channel weights, detune, opacity, layer order, attack and release. Weights are
normalised per channel, so one source can give form while another gives colour.

| Channel | What it moves |
|---|---|
| form | the structure field composited from the sources (weighted mean, or layered over by order and opacity with `layer_mix`) |
| function | mirror symmetry pulled toward the weighted symmetry of the sources |
| colour | a palette pooled from the measured source palettes, gradient-mapped onto the form |
| texture | 1/f noise at the weighted spectral slope; a material tint from `packages/materials` |
| value | lightness key and range |
| motion | a periodic modulation at the weighted rhythm period |
| sound | weighted log-spectral envelopes, detuned in cents, resynthesised with random phase at the weighted tempo |
| text | measured targets only; no text is generated |

Knobs: `detune`, `reverb` with `reverb_passes` and `reverb_decay`, `gain`, `attack`, `release`,
`temperature`, `layer_mix`, `marble` with `marble_tines` and `swirl` (a tine-line falloff and a ring
swirl), `lattice` (`hex`, `square` from `packages/lattice`, `vogel` from
`packages/lattice/packing`) with `lattice_cell`, `texture_mix`, `material` with `material_mix`, `rhythm_gain`,
`palette_k`, and the `seed`. The resolved recipe records every source hash, so the output
regenerates bit for bit, and a changed source stops the rerun.

`desk.html` is the internal blend desk: add sources, per-channel sliders, knobs, a live preview (an
approximation in the browser; the Python engine is the reference) and a report panel. It exports a
recipe. It is internal and unpublished.

## The difference report

The report compares an output with every vault item in its lineage (copies read directly, and the
copies behind any spec read) and with its nearest vault neighbours (by perceptual hash for pictures,
by n-gram overlap for text). Each number sits beside its threshold from `thresholds.json`, which was
written before the first run and whose hash goes into every report.

| Check | Fails when |
|---|---|
| copied region (ORB + RANSAC, phase correlation and identity alignment; contrast-stretched, high-passed windows: 8 px with NCC above 0.9, or 24 px with NCC above 0.6 under a homography with 15 or more inliers; largest connected region over the output's area) | above 3% of the area |
| perceptual hash distance (63 bits) | below 0.15 |
| design-parts feature distance (mean Canberra) | below 0.02 |
| audio fingerprint match (33-band Haitsma-Kalker style) | any matching segment over 3 s |
| text longest common run | 8 words or more |
| text 5-gram containment | above 10% |
| measured attribution (largest share of the output explained by one source) | above 0.5 |

Measured attribution can differ from the slider weight; blend lineage and reports show both.

## The gate

`gate.check(path, route="public")` is the function other tools call. It refuses:

1. a file whose sha256 equals a vault copy;
2. a file that embeds a vault copy's bytes (five 64-byte probes per copy; zip members are scanned);
3. a file whose lineage record no longer matches it;
4. a copy-derived file unless every check passes, the report is stored by hash, and a release note
   names this output and a passing stored report.

Spec-derived files still get the report as a sanity check, and only steps 1 and 2 can refuse them.
A file with no lineage passes steps 1 and 2 with a note unless `strict=True`. The internal route
never refuses; it records what the public route would decide.

## Tests

From the superframe root: `python -m pytest -q -p no:cacheprovider packages/cleanroom/tests` (about
55 s, 22 tests). The tests set `CLEANROOM_VAULT` to a temp dir themselves. Every input is
synthetic with its answer set by construction. Known answers include: a credential-named file is
never ingested; specs hold no media and no words of the source; exact, appended and zipped copies
are refused; a lightly edited copy reads a copied region over 50% and is refused even with a
release note; a heavily marbled and lattice-resampled blend passes every check, is refused without
a note and passes with one; a spec-derived generated piece passes; a planted 13-word verbatim run
fails; a three-source blend where one source keeps an intact strip (over 30% of the area) fails; a 99 to 1 blend fails
both the copied-region and the dominance checks; a ten-source blend reruns bit for bit from its
recipe; an audio splice of 6 s reads between 5 and 7 s; unrelated pictures share no region; a copy
superposed on its own mirror, cropped and washed out, is still found.

## Limits

- The copied-region search finds regions that survive translation, scale, rotation, perspective,
  recolour and tone curves. It misses regions that were locally warped, mirrored, heavily blurred
  or resampled below 8 px detail. A pass means the measurement found no large region, not that none
  exists.
- Measured on the private demonstration vault (2026-10-30; its run records stay with the vault and are
  not in this repo): across all 210 pairs of 21 unrelated saved
  pictures, 3 pairs read a copied region above 3% (0.38, 0.21 and 0.037). All three are text-heavy
  paper figures set in the same typeface, where glyphs genuinely match. Expect false alarms on
  document imagery; the gate errs toward refusal there.
- The first real-data run found a miss: a 99 to 1 blend (a recoloured, mirror-ghosted copy of a
  paper figure) read 0.5% and passed. The 24 px tier and contrast stretch were added for it; it now
  reads 5.4%, only modestly above the 3% line. Overlays heavier than that can still pass.
- The embedded check finds raw byte copies. It misses a copy re-encoded, cropped or compressed inside
  another container (other than plain zip members).
- Feature and hash distances measure global look. Style can sit close to a source and still pass,
  and a release note is the place to say why that is acceptable.
- Text checks are word-level and English-centred; paraphrase passes them.
- Audio matching uses one fingerprint family; pitch-shifted or time-stretched copies can slip past.
- A release note records a claim of approval. Anyone with write access to the vault can write one;
  setting `CLEANROOM_RELEASE_KEY` adds an HMAC that shows only that the key holder signed it.
- Lineage depends on builds going through the Workspace or `blend`. A tool that reads the vault
  without it produces an output with no lineage, which `strict` mode refuses.
- Video spec frames are sampled (five), so a short copied scene between samples can be missed by the
  report on video outputs.

Dependencies: numpy, scipy, Pillow, opencv-python, soundfile, imageio-ffmpeg (for its ffmpeg
binary), and the sibling packages design_parts, textphase, lattice, packing and materials, found
by path from this folder. The vault and its copies never ship; only this code is published.

Licence: FSL-1.1-MIT (see the repository LICENSE). What was checked before publication, and what
was removed, is in `LEGAL-CHECK.md`.
