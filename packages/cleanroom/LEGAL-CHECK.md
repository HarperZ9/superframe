# Redistribution check for cleanroom

Date: 2026-10-31. The question: does this folder hold third-party code or data that may not be redistributed? This is an engineering check of the files. It is not legal advice, and it was not reviewed by a lawyer.

## What was checked, and how

| Check | Method | Result |
|---|---|---|
| Vendored or ported code | Read every import in `cleanroom/`, `cleanroom_cli.py` and `tests/`; searched for "adapted", "ported", "derived from", "copied from", "based on", copyright lines and repository links | No third-party code in the folder. Third-party libraries (numpy, scipy, Pillow, soundfile, OpenCV, imageio-ffmpeg) are imported and not bundled |
| Vault contents and evidence | Listed every file; looked for media, archives, fonts and base64 blobs | None. Evidence and outputs were left out of the copy. The folder holds 28 text files, and the largest is `desk.html` at 74 KB |
| Test media | Read `tests/fixtures.py` and `tests/conftest.py` | Every test image and sound is generated from a seed. Sidecars use example.org |
| Sample content from real works | Searched for URLs and media names in `desk.html`, `README.md` and `thresholds.json` | One link, to harperz9.github.io. No third-party names or works |
| `desk.html` | Read its provenance comment | Hand-built page that inlines the author's site kit. Its font URLs name the OFL Accession files and carry no font bytes |
| Vault path | Searched for local paths | The vault comes from `CLEANROOM_VAULT`; tests use a temp directory |

## What was removed

Nothing in the folder failed the check. `out/`, `__pycache__` and the committed evidence were never copied from `workstation-tools@d82f57f:cleanroom`.

## What the tool may lawfully do, and where the risk sits

The code hashes, measures and blends files that a person supplies. It holds none of them. It has no DRM decryption and no way around access controls, and it never uploads a copy. Its README says it is a lineage and release gate, and that no metric in it decides infringement. Those statements stay, since the risk sits with a person who publishes a copy-derived output.

## Licence

The folder is FSL-1.1-MIT. At run time `cleanroom` imports `lattice` and `packing` (FSL-1.1-MIT), `design_parts` and `textphase` (AGPL-3.0-only) and `materials` (AGPL-3.0-only). All of them are the same author's work, so the author may ship them together. A third party who distributes a modified combined work takes on the AGPL terms for those parts. Decision for the author, if that matters: relicense the imported parts, or make those imports optional.

## Open

A lawyer has not read this. The author's condition was "as long as it passes legal laws", and this file can only show that the folder holds no third-party material. Whether publishing the tool itself is wise in a given jurisdiction is unknown to this check.
