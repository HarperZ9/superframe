# AO comparison: our GTAO against XeGTAO, scored against ray-cast AO

This bench measures how far a screen-space ambient occlusion pass lands from the true answer, and
what it costs on the GPU. The true answer is ray-cast AO: cosine-weighted visibility within the AO
radius, 1,024 stratified rays a pixel, traced against the scene's triangles (`post::rayAo`). XeGTAO
tuned its shipped heuristics against the same quantity (its `vaGTAO_RT.hlsl` reference: rays of the
effect radius's length, albedo 0, one bounce).

## Run it

Windows with MSVC and the Windows SDK's `dxc.exe`:

```bat
cmake -S native -B build-ao -G Ninja -DCMAKE_BUILD_TYPE=Release -DRAW_NATIVE_AO_BENCH=ON
cmake --build build-ao --target ao_export ao_bench
build-ao\ao_export --out frames --size 2560 1440
build-ao\ao_bench --data frames --shaders build-ao\ao_cso --adapter 4090 --out ao-results.json
```

`ao_export` writes each scene's view-space G-buffer and its reference. `ao_bench` runs every method
on the D3D12 adapter whose name contains `--adapter`, reads the result back and scores it.

## Scenes

The five scenes `tests/test_post.cpp` checks GTAO on, at the frame's aspect: the built-in test scene,
the same from a near camera, raw-hero in the test scene, and raw-hall from its nave and its gallery.

## Metric

Mean and 95th percentile of `|ao - reference|` over pixels with geometry, a 32-pixel border left out.
The scored pixel count is the denominator and is reported beside every number. GPU time is the
median of 300 repeats of the method's whole chain (20 warm-up repeats dropped), from D3D12 timestamps
around each repeat, with the 10th and 90th percentiles.

## Methods

- **Ours, engine pass**: the engine's GTAO (`src/renderer/gpu/shaders/hlsl/post_gtao.hlsl`, compiled
  with the engine's dxc flags) at several slice and step counts. It reads a view-space G-buffer.
- **Ours, fast chain** (`shaders/ours_gtao_fast.hlsl`): the same GTAO integral with a hard radius,
  reading what XeGTAO reads (NDC depth and a view-normal texture). Three passes: depth to view depth
  with decimated levels for far steps, a main pass whose slice turn and step offset follow a 4 x 4
  interleaved pattern with steps snapped to pixel centres, and a 4 x 4 plane-aware blur.
- **XeGTAO** (`third_party/xegtao`, MIT, Intel): prefilter, main pass and one denoise pass, run
  unchanged through `shaders/xegtao_bench.hlsl`, at its four quality levels with its shipped
  heuristics, and once at high with the heuristics set to match the reference.
- **Controls**: AO off (visibility 1) must lose; GTAO with its radius doubled, a planted wrong AO,
  must score worse than GTAO. `tests/test_ao_score.cpp` checks both on the CPU in CI.

## Rule

Ours wins a scene when its mean error is at least 20% below the rival's at equal or lower GPU time.
The slice passes when ours wins 4 of the 5 scenes.

## Result, 2026-11-16 (RTX 4090, 2560 x 1440)

Evidence: `evidence/ao-slice-xegtao-rtx4090-2026-11-16.json` (300 timed repeats a method, 20 warm-up
repeats dropped; 1.65 M to 3.43 M scored pixels a scene). Rival: XeGTAO high with its shipped
defaults, its default quality.

**The slice fails: ours wins 0 of 5 scenes.** Every one of our configurations at or under XeGTAO
high's time (0.171 to 0.181 ms) is missing: the cheapest fast chain (1 slice, 4 steps) takes 0.19 to
0.33 ms. The controls behave: AO off wins no scene, and each radius-doubled AO scores worse than the
same method with the right radius on all five.

| Scene | Scored px | XeGTAO high: mean, ms | Fast 2x4: mean, ms | Fast 2x6: mean, ms | Engine 16x16: mean, ms | AO off: mean |
|---|---|---|---|---|---|---|
| test scene | 1,693,665 | 0.0051, 0.171 | 0.0043, 0.266 | 0.0041, 0.323 | 0.0007, 41.1 | 0.0112 |
| test scene, near | 3,434,496 | 0.0104, 0.181 | 0.0058, 0.487 | 0.0043, 0.615 | 0.0018, 89.4 | 0.0217 |
| raw-hero | 1,651,342 | 0.0046, 0.174 | 0.0064, 0.263 | 0.0068, 0.317 | 0.0038, 40.0 | 0.0075 |
| raw-hall nave | 3,220,604 | 0.0381, 0.177 | 0.0243, 0.407 | 0.0223, 0.509 | 0.0091, 82.7 | 0.0435 |
| raw-hall gallery | 3,387,422 | 0.0630, 0.181 | 0.0515, 0.463 | 0.0480, 0.585 | 0.0380, 86.2 | 0.1075 |

What it shows: on accuracy alone our fast chain is 36% (nave), 44% (near), 18% (gallery) and 16% (test scene) below
XeGTAO high, and loses on raw-hero (39% above). It costs 1.5 to 2.7 times as much GPU time. The
engine pass at 16 x 16 is the most accurate method here on every scene and is 230 to 490 times
slower than XeGTAO high. The next step is speed: XeGTAO's half-precision math, texture gathers and
cheaper inner loop, before any further accuracy work.

## Limits

- The engine pass reads a view-space position and normal buffer whose construction is not timed.
  The fast chain and XeGTAO read the same inputs, and each builds its own depth levels in the timed chain.
- The reference is itself a Monte Carlo estimate with 1,024 rays a pixel.
- Single frames, no temporal accumulation: XeGTAO's noise index is 0, as its sample uses without TAA.
