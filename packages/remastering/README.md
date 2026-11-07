<!-- writing-profile: readme -->
# remastering

Give it an audio file in any format, damaged or not, and it decodes what survives, reports the file's condition,
splits the mix into stems and each stem into layers, restores, resynthesizes or remixes them, and masters the
result. Every stage writes a receipt with input and output hashes, and every rebuilt track carries a time by
frequency map that marks each region as original, restored, inferred or resynthesized. An inferred or
resynthesized region was made by the tool from evidence elsewhere in the file, and the map says so.

## Run it now

```
python -m pip install -r packages/requirements.txt
python -m pip install torch demucs==4.0.1          # only for the stem split
cd packages/remastering
python -m remastering condition song.mp3           # codec, bitrate, cutoff, clipping, decode errors, truncation
python -m remastering loudness song.flac           # integrated, short-term and momentary loudness, true peak, LRA
python -m remastering run song.mp3 --slug my-title --preset streaming
python -m pytest -q -p no:cacheprovider --import-mode=importlib tests
```

`run` needs the two settings below. Without them it stops with a message naming the missing setting.

## Settings

| Variable | What it holds | Default |
|---|---|---|
| `REMASTER_MODELS` | directory, or directories joined by the OS path separator, holding the pinned Demucs weight files | none, required for the split |
| `REMASTER_LIBRARY` | root of the edition library, one folder per title and one `gen-NNN` folder per rebuild | none, required to write a rebuild |
| `REMASTER_STRICT` | `1` restricts cuDNN to its guaranteed-deterministic algorithms (about 7x slower) | `0` |
| `REMASTER_GPU` | `0` keeps the DSP kernels on the scipy CPU path | `1` |

The weights are MIT-licensed Demucs checkpoints from the Demucs release files (`htdemucs_ft.yaml` and
`htdemucs_6s.yaml` list them). They never ship in this repository. Fetch them once, check them against the sha256
values pinned in `remastering/split.py`, and point `REMASTER_MODELS` at the folder. A file whose hash differs is
refused at load.

The library is private. It holds rebuilds of the owner's own copies for study and is never redistributed.

## Stem split

| Request | Model | Stems |
|---|---|---|
| `--stems 4` (default) | htdemucs_ft: four fine-tuned Hybrid Transformer Demucs models, each used for its own source | drums, bass, other, vocals |
| `--stems 6` | htdemucs_6s | drums, bass, other, vocals, guitar, piano |

Measured on the 50 MUSDB18-HQ test tracks with museval BSS Eval v4 (1 s windows, median over frames per track,
median over tracks, the SiSEC18 aggregate). SDR in dB:

| Path | Drums | Bass | Other | Vocals | Average |
|---|---|---|---|---|---|
| `--stems 4`, htdemucs_ft, batched product path | 10.24 | 10.38 | 6.30 | 9.21 | **9.03** |
| `--stems 6`, htdemucs_6s, guitar and piano folded into other | 9.55 | 9.28 | 5.74 | 9.02 | 8.40 |

Per track, the batched four-stem path and Demucs' own `apply_model` with the same weights differ by a median of
0.00 dB on every stem. The 0.04 dB above the reference average (8.99) comes from which track sits at the median,
mostly on drums, and is not a quality gain.

The six-stem row folds guitar and piano back into other to score it against the four MUSDB stems. The harness
reproduces the published Demucs figures within 0.02 dB (htdemucs 8.79 against 8.80 in the paper, htdemucs_ft through
Demucs' own `apply_model` 8.99 against 9.00). Published leaders on the same aggregate: BS-RoFormer L=6 without extra
data 9.80, BS-RoFormer L=12 with extra data 11.99 (arXiv 2309.02612, Table 2). Both Demucs checkpoints here were
trained with extra data. Splitting a finished mix is ill-posed, so every stem is an estimate and carries some of the
others; the chain adds the residual (mix minus the sum of the stems) back so nothing is lost.

## Determinism

Same input bytes, same device and same software give the same output bytes. The split pins its weights by
sha256, turns Demucs' random shifts off, disables cuDNN benchmarking and TF32, and seeds torch. The batched GPU
path and the CPU path are each bit-repeatable and differ from each other in the last bits, so the receipt records
the device, the model, the stem count and the path. The tests run the split twice and compare hashes.

## Modules

| Module | Job |
|---|---|
| `audio` | decode any format through the pinned ffmpeg, counting decoder errors and truncation |
| `condition` | the source report: codec, bitrate, band-limit cutoff, clipping, holes and dropouts |
| `restore` | declip, declick, gap fill (autoregressive and by matched context), dehum, dewow, band extension, codec-hole fill, each marked on the map |
| `split` | the stem split above |
| `layers` | transient, sustained and moving layers inside each stem by soft masks that sum to the stem |
| `transcribe`, `resynth` | notes from a layer and a physical-model or spectral resynthesis of it |
| `refine` | debleed between stems, denoise |
| `master`, `eq`, `dynamics`, `stereo`, `loudness`, `dither` | the mastering chain and its BS.1770 loudness check |
| `provenance` | the original, restored, inferred and resynthesized map and its plate |
| `edition`, `receipts` | generations in the library, diffs between them, hashed receipts |
| `chain` | the one-command run that ties the stages together |

Licence: FSL-1.1-MIT. The Demucs weights are MIT and stay outside the repository.
