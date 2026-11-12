<!-- writing-profile: procedure -->
# Examples: one scene, three engines, one check

These scripts rebuild the 3 October 2026 proof from the contract files in this repository. Every receipt they write is a `superstack.receipt/1` that passes `verify_receipt`.

## Run

```
pip install numpy                       # the pixel port needs it; the contract does not
python examples/run_all.py --ci         # numpy port, both exact sound paths, check, controls
```

On a machine with more tools:

```
pip install playwright && python -m playwright install chromium
RAW_NATIVE_CLI=/path/to/raw_native_cli SUPERSTACK_GPU=1 python examples/run_all.py
```

- `RAW_NATIVE_CLI` renders a fresh reference with raw-native 0.4.0. Without it, the recorded 0.4.0 outputs in `reference/raw-native-0.4.0/` serve as the reference (hashes in its `SHA256SUMS`).
- With Playwright installed, the WebGL2 backend and both browser sound paths run in headless Chromium on SwiftShader. `SUPERSTACK_GPU=1` adds a run on the hardware GPU.

`run_all.py` exits 1 when an expectation fails: the numpy port must be verified against the reference, the two exact sound paths must MATCH, and each control must fail as stated. Pixel byte identity is reported and not required, because numpy's float32 cos and sin differ between platforms.

## What runs

| Script | Role |
|---|---|
| `pixels/py_backend.py` | A float32 numpy port of raw-native 0.4.0's CPU path: rasterizer, ray-traced AO, shading, u8 encode |
| `pixels/raw-scene-gl2.mjs` | A WebGL2 backend with a different method on purpose: an analytic ray cast per pixel centre, the same AO hash |
| `pixels/gl2.mjs` | Minimal WebGL2 helpers for it |
| `sound/sound_ir.py` | The sound reference: six seeded voices in float64, quantized once |
| `sound/sound_exact.mjs` | The same score in JavaScript, for Node and the browser |
| `browser.html`, `run_browser.py` | The WebGL2 and browser sound paths, including WebAudio |
| `check.py` | Reconciles every output against its reference and writes `out/reconcile.json` |
| `controls.py` | Three false-success controls: the check must fail on a wrong scene, a flipped byte and a late voice |

## Results on the author's workstation

Windows 11, RTX 4090, Chromium 145.0.7632.6, Python 3.12.10 with numpy 2.4.5, Node 25.2.1.

| Candidate | Identity | Tolerance | Content SHA-256 |
|---|---|---|---|
| raw-native 0.4.0 CPU (reference) | | | `frame.ppm` file `e276f24f...` |
| numpy port | MATCH | verified | `0282ef9c...` |
| WebGL2 on the RTX 4090 | MATCH | verified | `0282ef9c...` |
| WebGL2 on SwiftShader | DRIFT | verified | 9 pixels differ, at most 3 levels, AO RMSE 0.00024 |
| Sound reference (Python) | | | `692ead20...`, -20.7 LUFS, notes 550, 275, 275, 550, 440 and 330 Hz |
| Sound, JavaScript in Node and in Chromium | MATCH | verified | `692ead20...` |
| Sound, WebAudio | DRIFT | verified | at most 1 LSB, 94.39 % of samples exact, 82.39 dB SNR |

In CI on GitHub's Ubuntu 24.04 and Windows runners, the numpy port and both exact sound paths gave the same content hashes as above. That is two more machines, both CPU paths; no GPU ran there.

The sound is classed `interactive` and its loudness check is verified: -20.7 LUFS is under the -18 LUFS ceiling, and its peak of -10.89 dBFS is under -1 dBFS.

## Does not prove

- Anything beyond one built-in scene, one sound, one machine and one GPU vendor. SwiftShader already differs.
- That the numpy port is independent evidence: it shares raw-native's algorithm. The WebGL2 ray cast is the more independent path, and it still shares the AO estimator.
- That raw-native's AO is correct. Its own `certificate.json` refutes its screen-space AO against its ray-traced AO on this view (RMSE 0.1294 against a tolerance of 0.12).
- Anything about live playback, device output, resampling or latency. The browser sound paths render offline.
- Timings. None are claimed here.
