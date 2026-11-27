# Third-party manifest

This file lists every piece of third-party code or data in raw-native: what it is, where it comes from, its licence, the files of ours that use it, and the SHA-256 of every file. `scripts/check_third_party.py` runs in CI. It fails when a listed file changes or goes missing, when a file under `third_party/` is not listed, or when superstack's own `SUPERSTACK.sha256` disagrees with this list. To update a dependency, replace its files, run `python scripts/check_third_party.py --print`, and paste the new block below in the same commit.

The dependency policy is ADR 0005. In brief:

- No MPL, GPL or binary-only libraries.
- No code copied from GPL references.
- ffmpeg is never linked or shipped.

## Vendored, byte for byte

| Library | Upstream and version | SPDX licence | Files | Adapter files (ours) |
|---|---|---|---|---|
| superstack | github.com/HarperZ9/superstack (synced with `packages/superstack/`) | MIT | `third_party/superstack/` (see `NOTICE.md` there) | `raw/tools/receipt.hpp`, `app/main.cpp` (receipts); `web/sound/contract.mjs`, `fixtures.mjs`, `meter.mjs` (seed rule, BS.1770 weighting) |
| XeGTAO | github.com/GameTechDev/XeGTAO, commit `a5b1686c7ea37788eeb3576b5be47f7c03db532c` (2024-04-22), `Source/Rendering/Shaders/XeGTAO.h` and `XeGTAO.hlsli`, plus `LICENSE` | MIT (Copyright 2016-2021 Intel Corporation) | `third_party/xegtao/` (CRLF kept, `-text` in `.gitattributes`) | `bench/ao/shaders/xegtao_bench.hlsl`, `bench/ao/ao_gpu_xe.cpp` (the AO comparison's baseline; never linked into the library) |

superstack is by the same author as raw-native and ships under the same licence. It is listed here because it is versioned and released on its own.

## Ported, not vendored

| Source | Upstream and version | SPDX licence | Our port | Adapter files (ours) |
|---|---|---|---|---|
| OpenColorIO, the ACES 2.0 output transform | github.com/AcademySoftwareFoundation/OpenColorIO, `v2.6.0` (commit 10a43ec1df03d072ca9a9e2fb3f26e454b0900d8), `src/OpenColorIO/ops/fixedfunction/ACES2/` | BSD-3-Clause | `src/renderer/aces2.hpp`, `aces2_cam.cpp`, `aces2_gamut.cpp`, `aces2_tables.cpp`; `web/colour/colour.wgsl` (its ACES 2.0 part) | `raw/renderer/colour.hpp`, `web/colour/` |

No OpenColorIO code is linked. The notice is in `third_party/NOTICE-OpenColorIO.md`. OpenColorIO itself runs only offline, in `tools/colour/ocio_compare.py`, to measure the port.

## Data derived from a font

| Font | Upstream | SPDX licence | Our file | Made by |
|---|---|---|---|---|
| Hanken Grotesk, weight 500 | github.com/marcologous/hanken-grotesk | OFL-1.1 | `docs/motion/hanken-grotesk-500.atlas.json` (glyph outlines and kerning; the copyright line and licence URL are inside) | `scripts/glyph_atlas.py` |
| Hanken Grotesk Bold (700), version 3.013, font file SHA-256 `4ca80ac105e80a582f892b3bbdd67dba26905f8bdefc837cb8a8908ad7be7fc9` | github.com/marcologous/hanken-grotesk | OFL-1.1 (full text: `third_party/fonts/OFL-hanken-grotesk.txt`) | `web/explainer/fonts/hanken-grotesk-700.atlas.json` | `scripts/glyph_atlas.py` |
| Conso Regular (400), version 1.000, webfont SHA-256 `0e4a48ca69d9f6b6a1916eb1c6459fe6947bd4a9f999c684f1237beda1c24f78` (the file the author's site ships, `system/fonts/conso-regular.woff2`) | Pavel Larin | Unknown: the source archive has no licence file. The author's site records that the author holds the designer's licence privately; public use here follows the author's own site (author ruling, 2026-10-16) | `web/explainer/fonts/conso-400.atlas.json` | `scripts/glyph_atlas.py` |

## Open items

These were found while writing this manifest and are not resolved here:

- **The Hanken Grotesk font version is not recorded.** The atlas does not record which release of the font file it was cut from. The next atlas build should write the font's version string and the SHA-256 of its file into the atlas.
- **The full OFL-1.1 text is not in the repository.** (Resolved for Hanken Grotesk on 2026-10-16: `third_party/fonts/OFL-hanken-grotesk.txt`, copied from the site repository's vendored copy.) The atlas carries the copyright line and the licence URL. The OFL asks that the licence travel with the font software, and whether a derived glyph atlas needs the full text beside it is not settled here. Adding the text from the upstream repository needs a download, which waits for the author's approval.
- **The Threads shader names no source.** (Resolved on 2026-10-23.) The renderer it was ported from is first party: the offline thread renderer written for the author's One Step film on 2026-10-04 (a moderngl tool in the author's private work notes), so it needs no row here. Threads was then rebuilt from first principles on the engine's own primitives (position-based chains, a structure-tensor tangent field, the noise module, the rope ease and spring token, an asinh finish). The shader header names every published idea it uses. `web/threads.test.mjs` checks that the method is not the ported one renamed.

## Hashes

```sha256
1b9e0dfd2b54dfe3210cb2d985db85b559c3f91233ccdb4750369dbfca7eac0b  third_party/NOTICE-OpenColorIO.md
f6fe0cac4617d4f144c48a2d3f275f44b8bc43e3c3ba57072ff0ad37f5fe0926  third_party/superstack/LICENSE.txt
c24f022b64589fa662726ca536aba04bbcdf4bbcfc601db7f82ccb58eeb42645  third_party/superstack/NOTICE.md
b611de55d4c159674dc13b3c5542b27e7c58fab7cfd40c62e3b0d66864d64f0c  third_party/superstack/SUPERSTACK.sha256
ff9c7b11c0cc1e6a324fc58e0e91a0a627533538ccfa97e9341a439919261ec9  third_party/superstack/examples/sound/sound.json
6b71ead33641140a215e0885fcc4fd5443bdd4338dcd3484fbe857e3ed07ce32  third_party/superstack/examples/sound/sound_exact.mjs
8bf7374be4f18b4049ec0511a206de37fe7b958b4c0776d3e7cef00b7fff970f  third_party/superstack/superstack.hpp
5fb56c459bbcdd94fda7cedca23c3b20b6c5241e55d8b1df6b38cd352b40bd3b  third_party/superstack/superstack.mjs
0f5e2309cf09d9e176e2d5c0ec519a3132693e1f68a7fe87b5f420c2654e6cbe  third_party/superstack/tests/run_vectors.cpp
a4672aad9c14e0de9733bd6af8462504e91783acf1caaf43640e4fd3abaae4ed  third_party/superstack/vectors/MANIFEST.json
395112b48140f455f80793e289491dc76333607734099c3995f095312320a8f1  third_party/superstack/vectors/canonical.json
96fc2e066e9e32af4a76dbfa8c6af7d4fbd73e3378d7ca58433e78f9cc9e3bba  third_party/superstack/vectors/clock.json
5a956f0dda3cc21cce6e9d9308a6470f2a4a72ed7822d999f0dad10595db76da  third_party/superstack/vectors/colour.json
b3607b0a84dd91cffb870497d4199363991f4ed12e7257776ec9019b2ce3d003  third_party/superstack/vectors/export.json
7bc56833582b968ca826ee4c1e5cba4f9841c702f2441053679c2d45be777dcf  third_party/superstack/vectors/hash.json
bbdb40c25e46afad5e651278d6065d834fd4bad3e8a3d38bc7e7052e46687a95  third_party/superstack/vectors/receipt.json
883971c3f3533f578a99fbe883457b16293150262d1420fb4ab8673af689d71a  third_party/superstack/vectors/reconcile.json
d34238647d294c609b1b94eaed9e55f444801367681be825b533efd616c97ac7  third_party/superstack/vectors/scene.json
e87d3f28143d8d900de896318233a942fb356c9afe00946bda357d894a5cf7b4  third_party/superstack/vectors/seed.json
e59115d5ca45df9389ccdc03c9a5e65e33086da3f4e0814e0e20dde7a35d11fc  third_party/superstack/vectors/sound.json
b3afebfca166385ff54f518b382ffa9f53846e46c9b9716cbd9af5f8c83698e4  src/renderer/aces2.hpp
027256868ee97b90576bcca16418588ef9b3e09717d010ff6ff3ea83e28d1530  src/renderer/aces2_cam.cpp
7c61ba268d572154a59cd4fecddae9a059717eef8506b5fda6aba7e8cfbc6368  src/renderer/aces2_gamut.cpp
31fb6707dac9500057f6de5e72dfbbf994b27675ec18e2949b582a1207cf917f  src/renderer/aces2_tables.cpp
1a1ce3dbca16df2f1405c8578f6de6bf8de671d3bee393665ffdcc3549f7c711  web/colour/colour.wgsl
e319da67ce990a6d163411db1ef81641fbe76b9047f98575e9067280f69cb6bd  docs/motion/hanken-grotesk-500.atlas.json
e02ccb89a86839b22feff7872ff5cc355cc0f58318d29eee20e2cf83a612f16d  third_party/fonts/OFL-hanken-grotesk.txt
7b3d72d7a0221040e7ac0d4ab587fb126e95ed40287af14e17f52443e770aa2a  web/explainer/fonts/hanken-grotesk-700.atlas.json
1968931d0fcf5ae45dba14a9b688bf5f9fc739f6b935472914abc824d8144b93  web/explainer/fonts/conso-400.atlas.json
14aae285d633840f33a9b2b652091dcacafae603691a9a92d3fedc3fd1141c83  third_party/xegtao/LICENSE
12ef6102b7f022be43d894d21e8ecbde6c905f1d828ee4373a80e494dc4083e0  third_party/xegtao/XeGTAO.h
00257d691a460d227d4ca261f609711165b9d43a2333d63374930e2ba4144949  third_party/xegtao/XeGTAO.hlsli
```
