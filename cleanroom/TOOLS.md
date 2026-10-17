# Clean-room tools

Every tool used, its version, where it came from, and its sha256. Installed under `E:/cleanroom-tools/`.
Analysis runs at Idle priority with hidden windows and no GPU. Tools read the installs in place; nothing is
written into an install folder. Outputs go only to the quarantine folders
`H:/cleanroom-dirty/low-water/nrftw/` and `E:/cleanroom-dirty/low-water/{disco,zeroparades}/`.

## Downloaded (2026-10-16, author approval relayed the same day)

| Tool | Version | Source | sha256 of the downloaded file | Used for |
|---|---|---|---|---|
| Cpp2IL | 2022.1.0-pre-release.21 (Windows exe) | https://github.com/SamboyCoding/Cpp2IL/releases/tag/2022.1.0-pre-release.21 | 663fb432433b4371fd1ee0ebc321a8fff2a9aac5ac4230c843f9e03ddee4e04c | IL2CPP metadata to class structure (diffable C# and dummy DLL output) |
| AssetRipper | 2.0.0 (win_x64 zip) | https://github.com/AssetRipper/AssetRipper/releases/tag/2.0.0 | 9a7ef0e7c5c3ea5b90b4e6d855e2d98d5f7ec8c3f9e26fccbc194c6a7b01baf7 | Unity asset inspection, headless on a local port (installed, not yet needed) |
| Il2CppDumper | v6.7.46 (net6 win zip) | https://github.com/Perfare/Il2CppDumper/releases/tag/v6.7.46 | d1117d66b9f8a130fd4933ae99f8eb9a0ecbbdb79d1fc494eb738ad910ff765a | Fallback for metadata v27 |
| ilspycmd | 11.1.0.9782 | `dotnet tool install ilspycmd` (nuget.org) | exe f22d6a0fd921e24a8307e35fc461c71ce4c73975752a3ef5299f7e9b56d679f1 | Decompiling dummy DLLs where needed |
| UnityPy | 1.25.4 | PyPI, in venv E:/cleanroom-tools/py | (pip) | Reading Unity bundles for asset names |
| TypeTreeGeneratorAPI | 0.0.10 | PyPI | (pip) | Type trees for IL2CPP MonoBehaviours (installed) |
| msgpack | latest on 2026-10-16 | PyPI | (pip) | MessagePack decoding (superseded by an own tolerant decoder) |
| lz4 | latest on 2026-10-16 | PyPI | (pip) | LZ4 block decompression of the NRFTW database |

Not installed: ffmpeg (Gyan.FFmpeg 9.0.2 is available on winget). It is only needed for capture analysis,
which waits for play sessions.

## Own scripts (quarantine side, E:/cleanroom-tools/scripts/)

`qdb.py` (database block reader), `mp.py` (tolerant MessagePack decoder that handles the reference's custom
extension payloads), `extract_all.py`, `gidx.py` (id index), `names.py` (id to asset name from the bundle),
`classmap.py`, `curves.py` (fixed-point curve keys), `framedata.py`, `report_weapons.py`,
`report_enemies.py`. These stay with the tools and never enter a repo.

## Install facts (read-only)

| Game | Unity | Backend | Metadata version | Encrypted? |
|---|---|---|---|---|
| Disco Elysium (E:) | 2020.3.12 | IL2CPP | 27 | No, standard header |
| ZERO PARADES (E:) | 6000.3.15f1 | IL2CPP | 39 | No, standard header |
| No Rest for the Wicked (H:) | 6000.1.15f1 | IL2CPP | 31 | No, standard header |

The H: Disco Elysium folder holds only ReShade files, not a game build.
