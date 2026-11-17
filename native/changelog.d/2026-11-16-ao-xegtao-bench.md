- **AO against XeGTAO, scored against ray-cast AO** (`bench/ao`). A bench that runs our GTAO and Intel's
  XeGTAO (MIT, vendored in `third_party/xegtao`) on D3D12 over the five GTAO scenes at 2560 x 1440 and scores
  each against 1,024-ray AO, with GPU timestamps, an AO-off control and a radius-doubled plant. In the run of
  2026-11-16 on an RTX 4090 our new fast chain was 16% to 44% more accurate than XeGTAO high on four scenes
  and 39% less accurate on raw-hero, at 1.5 to 2.7 times its GPU time, so the first slice's rule (20% lower
  error at no more time, on 4 of 5 scenes) failed on all five. Needs Windows, MSVC and `dxc`
  (`-DRAW_NATIVE_AO_BENCH=ON`); `tests/test_ao_score.cpp` checks the scoring and controls in every build.
