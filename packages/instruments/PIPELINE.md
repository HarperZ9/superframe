# The instrument pipeline: from a law to a reading with a receipt

Written 2026-10-30. Scaffolding only: nothing was bought, ordered, priced or fabricated.

The author, verbatim, 2026-10-30: "there's the hardware pipeline for building these instruments. Essentially, we want to be able to make manufacturing them streamlined as well. That way a physical real-world testing needs to be done in non-digital environments, that the digital to analog pipeline works. And that, so the information and the measurements can actually, and the values can be given back. Not that we're going to be building anything yet. We don't have the infrastructure for hardware manufacturing right now, but building the pipeline and the framework and the infrastructure and scaffolding for it would be a good idea, especially if we're going to be building new scientific measurement instruments and different forms of instrumentation."

## What is here

| Path | What it is |
|---|---|
| `PIPELINE.md` | this file: the stages, their gates, the worked examples, what is missing |
| `schemas/stage-01-principle.schema.json` to `stage-10-manufacturing.schema.json` | one JSON Schema (draft 2020-12) per stage template |
| `schemas/instrument.schema.json` | an instrument carried through all ten stages |
| `schemas/receipt.schema.json` | the reading receipt, which extends the measurement bus and adds no new format |
| `make_schemas.py` | writes the schemas |
| `examples/jnt.json`, `.md` | worked example 1: the Johnson-noise thermometer, every stage on paper |
| `examples/room-weyl.json`, `.md` | worked example 2: the room-shape meter; stages 2, 5, 7 and 9 built and run |
| `examples/polariscope.json`, `.md` | worked example 3: a photoelastic polariscope, on paper (added at the coordinator's request) |
| `examples/room-receipt.sim.json` | a receipt from the room meter's twin, flagged UNCAL and sim |
| `examples/build_examples.py` | builds the three examples, validates them against the schemas, renders the `.md` |
| `room/` | the room meter: twin (`modes.py`, `chain.py`), estimator (`meter.py`, `pencil.py`), trial, round trip, receipt, studyrun units, the WAV known-answer test |
| `studies/room/` | the preregistered study: spec, PREREG, lock, deviations, two runs, the WAV test result |
| `page/` and `index.html` | the site-kit page: walk one instrument through the stages, then plain words, then the working |

Run order: `python -I -B make_schemas.py`; the study through studyrun; `python -B room/receipt.py`; `python -B examples/build_examples.py`; `python -I -B page/build_page.py`.

## The ten stages

Every stage has the same envelope (`schemas/stage-NN-*.schema.json`): inputs, outputs, a gate with a metric, an operator, a threshold and a verdict, the tools with their licence and whether they are ours, a stage-specific `spec` block, and a does-not-prove line. Each gate below names a number that a run can miss.

| # | Stage | In | Out | Gate (measurable) | Tools, ours first | Checks it uses |
|---|---|---|---|---|---|---|
| 1 | Principle | a law from the catalogue; the wall audit | the law, the inversion, every assumption with how it is checked | assumptions without a check = 0 | law catalogue, ATLAS.json, CHECKS.json | assumptionaudit |
| 2 | Simulation and digital twin | stage 1; part figures | a seeded twin of the instrument and its whole chain; noise sources and bounds (kTB, shot, quantisation) | the twin recovers planted truths within its own interval; a preregistered kill condition | Python and NumPy, studyrun, ngspice | knowninject, plantedfault, shuffledtruth, operatortruth |
| 3 | Analog front end | stage 2 budget | sensor, amplifier, filter, ADC, with a noise budget against the bound | the physical signal is at least 80 percent of each chain's input noise power (or the stated margin to the bound) | ngspice, the twin | bound, jointnoise |
| 4 | Schematic and PCB | stage 3 | KiCad project; BOM with lifecycle and alternates; nothing ordered | ERC and DRC clean; BOM lines without alternate or lifecycle source = 0 | KiCad, InteractiveHtmlBom | docsuspect |
| 5 | Firmware | stage 4 | firmware or host code with self-test designed in | two builds from locked inputs give one image hash; every self-test has a planted failure it catches | Nix-pinned toolchains, pico-sdk, sigrok | autozero, loopback, knowninject, pilotpath, uncal, zeronull, bitident |
| 6 | Calibration | stage 5; references | a calibration record with honest traceability | the reference read back within combined uncertainty (two sigma) | the instrument, CHECKS.json | substitution, fixedpointratio, checkedref, traceability, calprotect |
| 7 | Hardware in the loop | stage 6; a DAC rig | the digital to analog to digital round trip, scored | planted signals read back within the instrument's uncertainty; error against truth and bits lost reported per path | the twin, studyrun | operatortruth, knowninject, loopback, inverseroundtrip |
| 8 | Field testing | stage 7 pass | readings in non-digital places under a locked protocol | the preregistered kill condition; known answers in the field | studyrun | surround, secondprobe, artifactcontrol, shuffledtruth |
| 9 | Data return | every reading | a receipt on the measurement bus, with an UNCAL flag | every receipt validates; a planted UNCAL condition shows in the receipt | every-dimension bus.py, tools/perceive | hash, uncal, buildcapsule |
| 10 | Manufacturing readiness | a design through 1 to 9 | design for test, fixture, yield tracking, a capsule per build | the production test catches every planted fault in a fault suite | KiCad, studyrun | simvectors, plantedfault, buildcapsule, regen |

### Rules that run through every stage

- **Spending is gated.** BOMs record parts, lifecycle sources and alternates. No order, quote request or fabrication happens inside this pipeline. Stage 4 carries the constant `"gated: nothing ordered, priced or fabricated"` in its schema.
- **The reading never ships without its state.** A value with no calibration record, an expired record or a failed self-test still ships, flagged UNCAL, with the bus status `estimated`. This is HP's UNCAL annunciator (CHECKS.json `uncal`) made into a field.
- **The self-test is the production test.** Stage 5's loopback, auto-zero and known-signal injection are the same tests the stage-10 fixture runs, after the HP-35 practice of the design's own simulation producing the acceptance tests (CHECKS.json `simvectors`, `modelasoracle`).
- **Dependencies:** research tools are installed freely; shipped code carries our own implementations wherever practical (the room meter's estimator is NumPy only; OpenCV appears only as R&D in the polariscope). Each stage lists every tool's licence and lineage.
- **Lineage is recorded where it is used:** every law, method and tool names its source inside the stage that uses it.

### Data return, without a new format

`schemas/receipt.schema.json` is the Telos measurement bus (`project-telos.measurement-bus/v1`, seventeen fields from `event_id` to `event_hash`) with the every-dimension `state` block (`every-dimension.state/0.1`: dimension, range, information, homeostasis), plus one added key, `instrument`:

```
instrument: { id, kind,
  build:       { design_sha256, firmware_sha256, code_sha256 },
  calibration: { state: PRIMARY | CALIBRATED | UNCAL, uncal, record_sha256, reference, traceability, valid_until, why },
  conditions:  { the protocol and environment the value holds under },
  self_test:   { loopback, known_inject, auto_zero, ... each { ran, pass, value } },
  sim:         true when the value came from the twin }
```

`room/receipt.py` builds each event with `every-dimension/slice/bus.py` itself, then adds the key and rehashes, so a bus reader that ignores unknown keys reads every receipt. Value, unit, range and uncertainty live where the bus already keeps them. Each receipt feeds three places: the measurement bus (`bus.model_view()` gives a model the text view), the perceptual bridge in `tools/perceive` that renders its quantity (sound for the room, heat for the thermometer, polarisation for the polariscope), and a FINDINGS entry when a preregistered run produces it.

## Worked example 1: the Johnson-noise thermometer (hardware, on paper)

Full spec: `examples/jnt.md`. The headlines:

- **Law and walls.** `<V^2> = 4 kB T Re Z B`. kB is exact in the SI since 2019, so absolute temperature needs no reference temperature. Six assumptions are each paired with a check, among them a new one, `zeronull`: independent noise into the two chains must cross-correlate to zero, or correlated contamination is reading as heat.
- **Front end.** R = 10 kOhm. The atlas spec named 100 kOhm, but at 100 kOhm and 100 pF of input capacitance, Re Z falls 28 percent by 10 kHz; at 10 kOhm and 20 pF the fall is 1.6e-4. The resistor's 12.9 nV per root hertz against a 5.1 nV per root hertz JFET amplifier puts 86 percent of each chain's power in the signal, so cross-correlation sits at 1.16 times the statistical bound: 0.16 percent in 60 s, 0.1 percent in about 150 s over a 9 kHz band.
- **Calibration.** A fixed-point ratio (new check `fixedpointratio`): the same resistor and chains read at a hand-made ice point and at the unknown, so gain and band cancel and only a resistance ratio enters. A 12 kHz pilot tone outside the band shows the gain held between the two reads.
- **Where it fits as a primary standard.** Once stage 7 passes, it is the reference that the GPU timing thermometer and every field thermistor are calibrated against by substitution. In this build it is primary only in principle: the ice point is our own realisation, the DMM's ratio linearity is unchecked, and receipts say so.
- **Round trip.** A DAC synthesises resistor noise for planted 250, 300 and 350 K through a divider into the injection port, and the instrument must read each back within two sigma.

## Worked example 2: the room-shape meter (existing device; stages 2, 5, 7 and 9 built)

Full spec: `examples/room-weyl.md`. Code: `room/`. Study: `studies/room/`.

**The law.** Weyl's law with the rigid-wall surface and edge terms, `N(f) = 4 pi V f^3 / (3 c^3) + pi S f^2 / (4 c^2) + L f / (8 c)`, read from the count of acoustic modes heard corner to corner. Sabine's T60 gives the absorption as a cross-check.

**The twin, run.** 240 simulated shoeboxes (3 speakers by 2 noise levels by 40 rooms), each heard through the full chain: a 10 s exponential sweep, 16-bit DAC, a speaker modelled as a 2nd-order roll-off with harmonic distortion, the room's modal response, red room noise and mic self-noise, a 16-bit ADC, and regularised Farina deconvolution. Four estimators, all fitting V and kappa = S / V^(2/3) to the counted modes:

| Laptop speaker, median volume error | Run 1 (preregistered) | Run 2 (post hoc, T60 fix) |
|---|---|---|
| S1 naive Fourier peak count | 0.74 | 0.81 |
| S2 Fourier peaks, Poisson-corrected | 0.44 | 0.43 |
| S3 matrix-pencil modes, Poisson-corrected | **0.14** | **0.16** |
| S4 shoebox search on pencil modes | 0.24 | 0.23 |
| prior guess (median room, no measurement) | 0.32 | 0.31 |

Verdicts of record (run 1, `studies/room/out/20261031T003606Z`): V1 PASS (beats its shuffled-truth copy, -0.144 against q95 -0.373). **V2 FAIL**: the mean paired gap to the prior guess was -0.026 (CI -0.60 to 0.30), because one 28 m^3 room read as 565 m^3; the median wins on 71 percent of rooms, but the registered test is the mean. **V3, the kill condition, PASS**: median laptop error 0.144 against 0.25. **V4 FAIL by 0.002**: the pencil beat Fourier peak picking by a mean 0.25, interval -0.002 to 0.41. **V5 FAIL**: the shoebox prior did not beat the shape-free count. V6 PASS (round trip). V7 PASS (T60 error 2.9 percent).

**The bug, and the second run.** After the run, a known-answer test of the real-recording path (`room/test_wav_path.py`: six planted modes in 48 kHz WAV files, no twin) read T60 as 54 s. The band filter in the T60 step was circular, so its ringing wrapped into the decay tail; the twin's room noise had hidden it. The fix zero-pads the filter (`studies/room/PREREG-DEVIATIONS.txt`, D1). A second run with the same spec and seeds then passed V2 (gap 0.23, CI 0.14 to 0.32) and V4 (gap 0.27, CI 0.20 to 0.33), with no catastrophic room (worst laptop error 1.86). Run 2 came after run 1 was seen, so it counts as a lead for the field study.

**The door through the resolution wall.** Fourier peak picking cannot split modes closer than about a modal bandwidth, so it counts a third to a half of them. A room's impulse response is exactly a sum of damped exponentials, so a parametric estimator with that model (the matrix pencil, Hua and Sarkar 1990, after Prony 1795) resolves closer modes and pays in signal-to-noise. In the study's known-answer injection it split two modes 1 Hz apart, each with a 3.1 Hz modal bandwidth, and placed every planted mode within 0.075 Hz.

**Round trip (stage 7), digital to analog to digital.** Bits kept per frequency bin in 40 to 150 Hz, linear-Gaussian, truth passed through the same measurement operator (new check `operatortruth`): ideal digital 18.3; electrical loopback 15.6 (2.7 bits lost, error -91 dB); laptop speaker, air and mic 8.5 on average (9.7 bits lost, worst transfer error -54 dB). The six planted modes came back within 0.075 Hz, with 4 spurious poles.

**Receipt (stage 9).** `examples/room-receipt.sim.json` validates against `schemas/receipt.schema.json`. It read a simulated 52.6 m^3 room as 51.3 m^3, flagged UNCAL (no calibration record) and `sim: true`.

**For a real room.** `python -B room/receipt.py sweep sweep.wav` writes the test signal; play it from the laptop in one corner, record in the opposite corner with effects off in any recorder, then `python -B room/receipt.py wav sweep.wav recording.wav`. No capture code is included, so nothing records without the author starting it.

## Worked example 3: the photoelastic polariscope (on paper)

Full spec: `examples/polariscope.md`. A laptop or phone screen is already a linearly polarised source; one polariser sheet in front of the phone camera completes a plane polariscope, and two pairs of cinema 3D glasses make a circular one. The stress-optic law (Brewster 1816, Maxwell 1853) gives fringe order `N = t (sigma1 - sigma2) / f_sigma`. Calibration uses an analytic specimen (new check `analyticspecimen`): a disc in diametral compression has `N = 8 P / (pi D f_sigma)` at its centre (Frocht 1941), and a beam in four-point bending gives a linear fringe gradient; the two must agree. The stage-2 twin is Jones calculus over the screen's own spectrum, because a screen's three narrow primaries make colours that differ from the Michel-Levy chart; the page's toy shows the difference live. It is the cheapest first real-world build: one sheet, a plastic offcut, water bottles as weights.

## What is missing before real builds

Infrastructure we do not have, in the order it blocks:

1. **Bench instruments to check the instruments.** A scope or a sound-card analyser with a known reference, a DMM with a ratio mode, and one traceable reference of any kind. Today every reference in the three examples is "working" or "none".
2. **A reference environment.** A shielded box and quiet supplies for the thermometer; one tape-measured, empty reference room for the room meter; a stable load frame for the polariscope.
3. **The HIL rig as hardware.** A second audio interface as the DAC, a precision divider and a switch matrix. The room meter's round trip exists only as software.
4. **Assembly.** Soldering and rework tools, ESD handling, and a way to make or order boards, all under the spending gate.
5. **Toolchain pins in practice.** KiCad, ngspice and a Nix-locked firmware toolchain installed and hashed; none is installed or checked here.
6. **Lifecycle data.** Part lifecycle and alternates come from distributor data at order time; every lifecycle in the thermometer BOM is "unknown: check at order time", and part numbers are from memory.
7. **A calibration store.** Records signed and kept by hash, with expiry, so receipts can cite them; today `record_sha256` is null everywhere.
8. **The field protocols.** Studyrun specs for each stage 8, locked before the first field run. None is written.
9. **A production fixture.** Pogo-pin plates and a planted-fault suite. None exists.

## Lineage

Methods: Weyl (1911); Morse and Bolt (1944); Kac (1966); Sabine (1900); Schroeder (1965) for backward integration; Lundeby et al. (1995) for truncation; Farina (2000) for the exponential sweep; Kirkeby and Nelson (1998) for regularised inversion; Prony (1795), Hua and Sarkar (1990) and Roy and Kailath (1989, ESPRIT) for parametric modes; Berry and Tabor (1977) for Poisson level spacing in integrable systems; Johnson (1928) and Nyquist (1928); Callen and Welton (1951); Brewster (1816); Maxwell (1853); Coker and Filon (1931); Frocht (1941); Michel-Levy (1888); Wyman, Sloan and Shirley (2013) for the analytic colour-matching fit used in the toy; the HP calibration tricks as catalogued in `2026-10-30-checks/CHECKS.json` from Becattini's *The Great Hewlett-Packard*. Dates and attributions are from memory with moderate to high confidence unless the stage marks them lower.

Tools: KiCad (Jean-Pierre Charras, 1992; GPL-3.0), ngspice (from Berkeley SPICE), NumPy, studyrun (ours), the every-dimension bus (ours), the Telos measurement bus (ours), tools/perceive (ours), the site kit (ours).

## Does not prove

The room numbers come from a rigid-shoebox simulation with an ideal corner protocol and a chosen noise model. They say the method can work on laptop hardware; they say nothing yet about a furnished room, an open door, an L-shaped plan or a laptop whose DSP stays on. The band top, the two resolving widths and the shoebox weight were picked on 36 pilot rooms from 30 settings, which flatters the fresh run less than it would flatter the pilot but still favours it. The thermometer and polariscope specs are designs on paper with figures from memory; no part was measured.
