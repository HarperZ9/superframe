- **Motion transitions and scroll drivers** (`web/motion/transitions.mjs`, `web/motion/scroll.mjs`).
  Ten named entrances for one piece of media (aperture, letterSet, tiles, inkBleed, waveform, strata,
  filmGate, curtain, rake, press), each a pure function of progress with a fixed point count, and
  `walk()` for an arrival, a hold and a leaving on one progress. `bind()` drives a transition from a
  view timeline, from scroll by script where view timelines are missing, or from a clock; reduced
  motion shows the settled piece and binds nothing. 26 tests. The script fallback runs one loop per
  bound element and was tested on a stub only.
