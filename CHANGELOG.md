# Changelog

## render-sound 0.3.0 (unreleased)

- New `render-sound/instruments/`: a zero-dependency instrument library. Piano (modal, with inharmonicity by register, double decay, hammer noise, soundboard and sympathetic strings), electric piano (FM), plucked strings and an upright bass (extended Karplus-Strong with a wood body, finger slip and fingerboard rattle), flute and reed waveguides, drawbar organ, drums and a ride, pads, a string section, a wordless choir, generated rooms, tape and stereo effects. Measurement helpers: pitch, BS.1770 loudness, true peak, loop seams.
- Tests for tuning, headroom, determinism and measured targets, each with a control that must fail (`render-sound/test/instruments-*.test.mjs`).
- A CI workflow runs `node --test` in `render-sound/` on Ubuntu and Windows.

## 0.2.0 (unreleased)

- From v0.2.0, code is licensed FSL-1.1-MIT. Earlier releases remain under AGPL-3.0-or-later.
- `LICENSE` is the FSL-1.1-MIT text from fsl.software, with licensor Zain Dana Harper and copyright 2026.
- All five packages move to version 0.2.0 and declare `"license": "FSL-1.1-MIT"`. Each package directory has a copy of `LICENSE`.
- The root `LICENSE` held a licence-boundary note and no grant. It now holds the FSL-1.1-MIT text for the whole repository.
- None of these packages was published to npm (the five names are unclaimed on the npm registry, checked 4 October 2026). AGPL-3.0-or-later covers every commit before this change and any copy taken from one.
- No code changed.
