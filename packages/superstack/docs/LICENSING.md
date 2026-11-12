<!-- writing-profile: research -->
# Licensing and provenance

Checked 3 October 2026; licence change recorded 4 October 2026. Text: CC BY 4.0. Code: FSL-1.1-MIT from v0.2.0. Releases up to and including v0.1.0 remain under MIT.

Every claim below carries a label. **Verified** means the source was read on that date and the quote or record is cited. **Inferred** means a conclusion drawn from verified facts, on a point the licence texts leave implicit. This record is provenance research; for legal advice, ask a lawyer.

## Result

1. **The two seed algorithms have clear provenance and may ship inside an FSL-1.1-MIT file.** mulberry32 carries a CC0 1.0 public domain dedication from its first revision in 2017 (verified). xmur3's author releases his code to the public domain, with MIT as the stated fallback (verified). Both grants leave a file that contains the algorithm free to carry its own licence, so the change to FSL-1.1-MIT in v0.2.0 leaves them as they were (inferred from the grants quoted below). The seed functions stay, and the site's seeded plates keep their streams.
2. **Every current consumer has the same licensor as this repository**, so a v0.2.0 file can be vendored into each of them (section 3). The licensor can use their own FSL code in their own reserved site and in their own FSL projects. A third party who vendors a v0.2.0 file takes it under FSL-1.1-MIT, which allows any purpose except a Competing Use and turns into MIT two years after each release. v0.1.0 stays MIT for anyone who took it.
3. **One formula has an unknown first author.** `raw-pixel-hash/1` is raw-native's code, but the same four operations appear in many public snippets, and nobody has been traced as their origin (unverified). Section 2.4 explains why this is low risk.

## 1. This repository

| Part | Licence | Basis |
|---|---|---|
| `superstack.py`, `superstack.mjs`, `superstack.hpp` | FSL-1.1-MIT from v0.2.0; MIT up to v0.1.0. Each file carries the full notice | The author's grant, `LICENSE` |
| `vectors/`, `tests/`, `tools/`, code and data under `examples/` | FSL-1.1-MIT from v0.2.0; MIT up to v0.1.0 | Same |
| Prose: `SPEC.md`, `README.md`, `VENDORING.md`, `CHANGELOG.md`, `docs/`, `examples/README.md` | CC BY 4.0 | `LICENSE-TEXT` |
| mulberry32, xmur3 and OKLab as carried in the implementations | Their own terms (sections 2.1 to 2.3) | The authors' grants |

Each implementation carries its FSL-1.1-MIT notice, the MIT text it turns into, and a list of the algorithms by others that it contains, with their notices kept word for word from v0.1.0. A vendored copy is self-contained.

### 1.1 The change in v0.2.0

- On 4 October 2026 the author moved the reusable engines to FSL-1.1-MIT, the Functional Source License 1.1 with MIT as the future licence. `LICENSE` holds the text from fsl.software with licensor Zain Dana Harper and copyright 2026. `FSL-1.1-MIT` is an SPDX licence identifier (verified against spdx.org/licenses/FSL-1.1-MIT.json on 4 October 2026).
- The change applies from v0.2.0 on. v0.1.0 was released under MIT, and that grant stands for good: anyone holding a v0.1.0 file keeps MIT terms for it.
- Every commit in this repository is by the author (verified with `git log` and the GitHub contributors API on 4 October 2026). Some commits carry a `Co-Authored-By` trailer naming an AI model; that trailer records tool assistance and names no other copyright holder.
- The release carries one code change besides the licence: `superstack.hpp` builds under Emscripten (CHANGELOG.md).

## 2. Provenance of what the contract carries

### 2.1 mulberry32 (verified)

- Author: Tommy Ettinger. Source: the gist "Mulberry32 PRNG", https://gist.github.com/tommyettinger/46a874533244883189143505d203312c, created 2017-11-04 (GitHub API, `created_at`).
- The file header reads: "Written in 2017 by Tommy Ettinger ... To the extent possible under law, the author has dedicated all copyright and related and neighboring rights to this software to the public domain worldwide," with a link to CC0 1.0. The same header is present in the first of the gist's two revisions (2017-11-04 and 2017-11-06, read through the GitHub API).
- The 32-bit JavaScript form the site and this contract use follows bryc's port in the same `PRNGs.md` file as xmur3 (section 2.2), which is also public domain.
- A note on quality, separate from licence: in a comment of 2022-11-10 on the gist, the author writes that mulberry32 reaches about two thirds of all 32-bit outputs and recommends a SplitMix-style generator. v0 keeps mulberry32 because the site's seeded plates depend on its exact stream; a later rule id can change the generator while old artefacts keep their old rule (SPEC.md section 4.4).

### 2.2 xmur3 (verified)

- Author: bryc. Source: `jshash/PRNGs.md` in https://github.com/bryc/code.
- xmur3 first appears in that file at commit `89aaa1d448` (2020-02-08). The file has opened with "License: Public domain" since commit `c67b4736d7` (2019-12-05), so xmur3 entered under that statement.
- The repository's `LICENSE.md` (created 2024-04-12, last changed 2024-04-13 at `1c370c1240`) reads: "Public domain." It continues: "If for whatever reason you cannot use works in the public domain, as a fallback license, I approve the use of MIT", followed by the MIT text under "Copyright (c) 2024 bryc".
- xmur3 is built on MurmurHash3's mixing constants. MurmurHash3's source states: "MurmurHash3 was written by Austin Appleby, and is placed in the public domain. The author hereby disclaims copyright to this source code." (`src/MurmurHash3.cpp` in aappleby/smhasher, verified).
- The same function was also posted on Stack Overflow, where posts carry CC BY-SA (inferred; the post itself is still unread). This contract relies on the repository's grant, which allows MIT use; the Stack Overflow copy plays no part.
- Use in this contract: the first output of xmur3's return function, computed over UTF-16 code units exactly as bryc's JavaScript does. Each implementation file credits bryc and repeats his fallback copyright line, which covers jurisdictions without a public domain.

### 2.3 OKLab (verified)

- Author: Bjorn Ottosson, "A perceptual color space for image processing", https://bottosson.github.io/posts/oklab/ (2020).
- The post states: "The code is available in public domain, feel free to use it any way you please. It is also available under an MIT licensee if you for some reason can't or don't want to use public domain software." The contract uses the post's matrix constants, which are the same numbers the site's `sense-core` module carries.

### 2.4 raw-pixel-hash/1 (provenance partly unknown)

- The formula is raw-native's CPU AO hash, written by this repository's author. raw-native is FSL-1.1-MIT from 0.3.0, read from its `LICENSE` on GitHub and in the 0.4.0 tree (verified). v0.1.0 offered it here under MIT, and v0.2.0 offers it under FSL-1.1-MIT, raw-native's own terms (inferred: a sole copyright holder may license the same work on several terms).
- Three of its four constants are xxHash32 primes: 374761393 is `XXH_PRIME32_5`, 668265263 is `XXH_PRIME32_4` and 2246822519 is `XXH_PRIME32_2` (verified against `xxhash.h` in Cyan4973/xxHash). The fourth, 1274126177, has a separate origin, still untraced.
- The same expression appears in many public snippets for seeding from coordinates, and the search for its first author is still open (unverified).
- Risk (inferred, low): the formula is four arithmetic operations on published constants, the kind of short functional expression that copyright generally does not protect, and it already ships in raw-native and on the site. If a first author turns up with terms that conflict with this repository's licence, a new rule id (`raw-pixel-hash/2`) can replace it without breaking old artefacts.

### 2.5 BS.1770 K-weighting (verified)

- The 48 kHz coefficients are the table in ITU-R BS.1770-4, used as printed.
- For other rates the filters are derived with the constants in libebur128 (https://github.com/jiixyj/libebur128, MIT): f0 1681.974450955533, G 3.999843853973347, Q 0.7071752369554196, Vb exponent 0.4996667741545416, and f0 38.13547087602444, Q 0.5003270373238773. Each was read in `ebur128/ebur128.c`. At 48 kHz the derivation reproduces the standard's table to within 1e-15, which the contract checks.
- These are numeric constants of a published standard and a published derivation (inferred: these are facts, and copyright covers expression). The implementation files credit libebur128.

### 2.6 Risk tokens, WCAG contrast, sRGB transfer

- The token values, grounds and verdict words come from the site's `system/media-engine/colour.mjs` at `origin/main` 13618f0 (verified read). The site's code is all rights reserved and its author is this repository's author, who asked for the tokens to be part of the contract (inferred authority to publish them here, under MIT in v0.1.0 and FSL-1.1-MIT from v0.2.0).
- The WCAG 2.x contrast formula and the IEC 61966-2-1 sRGB transfer function are published standards; the files implement them from their published formulas.

### 2.7 Examples and recorded reference data

- `examples/` is ported from the author's private proof of 3 October 2026. The proof also ran the site's own media engine; that code is reserved and stays out of this repository. `examples/pixels/gl2.mjs` was written new for this repository and stands in for it.
- `examples/reference/raw-native-0.4.0/` holds four files written by raw-native 0.4.0 (FSL-1.1-MIT) on the author's workstation: `frame.ppm`, `mask.pgm`, `ao_rt.pfm` and `certificate.json`. They are program output; raw-native's source stays in raw-native. The author publishes them here under the repository's code licence (inferred authority, as in 2.4). `certificate.json` was checked for local paths, and the check came back clean.

## 3. Vendoring into each consumer

The question: may a project copy one v0.2.0 file into its tree and ship it with the project? Every consumer below has the same licensor as this repository, Zain Dana Harper. A licensor needs no licence to use their own code, so the FSL terms bind only third parties who take the file (inferred: FSL's grant runs from the licensor to others).

| Consumer | Its licence (verified from the file named) | Vendoring a v0.2.0 file | Obligation |
|---|---|---|---|
| Site (`HarperZ9.github.io`) | Code all rights reserved; written works CC BY 4.0 (`LICENSE` at `origin/main` 8b65c94) | Allowed: same owner. The vendored file keeps its FSL-1.1-MIT header, so a visitor who copies that file gets FSL terms for it and no rights in the reserved site code around it | Keep the header |
| raw-native | FSL-1.1-MIT (`LICENSE` on GitHub and in the 0.4.0 tree) | Allowed: same owner and same licence. Its `third_party/superstack/` copy moves to FSL-1.1-MIT with the re-pin | Keep the header; update the copy's notice and pin |
| Flywheel | FSL-1.1-MIT (`LICENSE`) | Allowed: same owner and same licence. No vendored copy was on Flywheel's `main` on 4 October 2026 (searched) | Keep the header |
| telos | FSL-1.1-ALv2 (`LICENSE`) | Allowed: same owner. The file keeps FSL-1.1-MIT inside a repository whose own code is FSL-1.1-ALv2; FSL places no limit on included files under other terms (inferred) | Keep the header |
| studio-engine, studio-libs, brender-archival, reconcile | FSL-1.1-MIT from their next release (the same change of 4 October 2026); AGPL-3.0 before | Allowed: same owner and, after the change, the same licence | Keep the header |
| BuildLang | BuildLang Fair-Source 1.0 (`LICENSE`) | Allowed: same owner. Its grant covers "the BuildLang compiler and toolchain"; section 5 requires keeping notices and nothing restricts included files under other terms (inferred) | Keep the header |

A consumer that pinned v0.1.0 keeps MIT terms for that copy until it re-pins.

## 4. Before the repository goes public

| Check | State |
|---|---|
| mulberry32 provenance | Verified, CC0 |
| xmur3 provenance | Verified, public domain with MIT fallback |
| Vendoring into each consumer | v0.1.0 (MIT): verified for AGPL (FSF list), inferred for the rest. v0.2.0 (FSL-1.1-MIT): every consumer has the same licensor (section 3) |
| Reserved site code excluded | Verified: no site snapshot is in the tree; `gl2.mjs` is new |
| `raw-pixel-hash/1` first author | Unknown; inferred low risk (2.4) |
| Secrets, keys, local paths in the tree | Searched before each release: no keys, tokens or credential files, and no absolute local paths |
