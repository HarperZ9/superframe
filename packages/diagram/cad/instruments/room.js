// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Room-shape meter: the parametric model of the measurement set-up and its loopback pad. Sources: packages/instruments
   records/room.json, examples/room-weyl.json and PIPELINE.md worked example 2 (the study's numbers are simulation, not
   measurement). The laptop and the phone are existing devices; the pad is the stage-7 round-trip rig. */
(function (g) {
  "use strict";
  const D = g.Diagram, C = D.CAD;
  const REC = C.record("room");
  const c0 = REC.fixed.c0;
  /* label, unit and default come from the record; the range and step are this view's controls */
  const P = (id, min, max, step, x) => Object.assign({ id, min, max, step }, x);

  const W_ = {
    weyl: (f, L, Wd, H) => { const V = L * Wd * H, S = 2 * (L * Wd + L * H + Wd * H), E = 4 * (L + Wd + H); return (4 * Math.PI * V * f ** 3) / (3 * c0 ** 3) + (Math.PI * S * f * f) / (4 * c0 * c0) + (E * f) / (8 * c0); },
    density: (f, L, Wd, H) => { const V = L * Wd * H, S = 2 * (L * Wd + L * H + Wd * H), E = 4 * (L + Wd + H); return (4 * Math.PI * V * f * f) / c0 ** 3 + (Math.PI * S * f) / (2 * c0 * c0) + E / (8 * c0); },
    modes: (fmax, L, Wd, H) => {   /* every rigid-wall mode below fmax, the zero mode left out */
      const out = [], nx = Math.ceil((2 * fmax * L) / c0), ny = Math.ceil((2 * fmax * Wd) / c0), nz = Math.ceil((2 * fmax * H) / c0);
      for (let a = 0; a <= nx; a++) for (let b = 0; b <= ny; b++) for (let k = 0; k <= nz; k++) {
        if (!a && !b && !k) continue;
        const f = (c0 / 2) * Math.hypot(a / L, b / Wd, k / H);
        if (f <= fmax) out.push(f);
      }
      return out.sort((x, y) => x - y);
    },
    schroeder: (T60, V) => 2000 * Math.sqrt(T60 / V),
    pad: (R1, R2) => 20 * Math.log10(R2 / (R1 + R2)),
  };

  const inst = {
    id: "room", file: "cad-room.html", region: "print", super: "Weyl",
    message: "The room meter's set-up drawing, its loopback pad and its mode count all come from the room's three lengths, so stretching the room moves the corners, the dimensions and the count of modes below the band top together.",
    lede: "A laptop in one corner, a phone in the opposite one, and a resistive pad for the round trip. Stretch the room and watch the count of modes against Weyl's law.",
    scale3d: 0.0016, camera: { yaw: 0.65, pitch: 0.55, zoom: 2.3 }, W: W_,
    params: [
      P("L", 2, 10, 0.05), P("Wd", 2, 8, 0.05), P("H", 2, 4, 0.05),
      P("T60", 0.2, 2, 0.05), P("fTop", 80, 300, 5), P("pad", 6, 40, 1),
    ],
    cut3d: (p, k) => ({ axis: "y", d: (p.H * 1000 - 300) * k }),
  };

  inst.build = (p) => {
    const L = p.L * 1000, Wd = p.Wd * 1000, H = p.H * 1000, t = 100, parts = [], part = (o) => parts.push(Object.assign({ material: "gypsum" }, o));
    const wall = (id, label, size, pos, axis) => part({ id, label, alt: "A " + label.toLowerCase() + " of the room.", fn: "A rigid boundary: the modes are set by where it stands.", geom: { t: "box", size }, pos, explode: { axis, dist: 600 } });
    wall("floor", "Floor", [L + 2 * t, t, Wd + 2 * t], [0, -t / 2, 0], [0, -1, 0]);
    wall("ceil", "Ceiling", [L + 2 * t, t, Wd + 2 * t], [0, H + t / 2, 0], [0, 1, 0]);
    wall("wallL", "Left wall", [t, H, Wd], [-L / 2 - t / 2, H / 2, 0], [-1, 0, 0]);
    wall("wallR", "Right wall", [t, H, Wd], [L / 2 + t / 2, H / 2, 0], [1, 0, 0]);
    wall("wallB", "Back wall", [L + 2 * t, H, t], [0, H / 2, -Wd / 2 - t / 2], [0, 0, -1]);
    wall("wallF", "Front wall", [L + 2 * t, H, t], [0, H / 2, Wd / 2 + t / 2], [0, 0, 1]);
    const lx = -L / 2 + 50 + 160, lz = -Wd / 2 + 50 + 110;
    part({ id: "laptop", label: "Laptop (source)", alt: "A laptop on the floor in the back left corner.", fn: "Plays the exponential sweep from its speaker; the corner is an antinode of every mode.", material: "electronics", geom: { t: "group", items: [{ t: "box", size: [320, 18, 220] }, { t: "box", size: [320, 210, 6], pos: [0, 112, -108], rot: [-12, 0, 0] }] }, pos: [lx, 9, lz], explode: { axis: [0, 1, 0], dist: 300 } });
    const mx = L / 2 - 100 - 36, mz = Wd / 2 - 100 - 75;
    part({ id: "phone", label: "Phone (microphone)", alt: "A phone lying in the opposite front right corner.", fn: "Records the room's answer with effects off.", material: "electronics", geom: { t: "box", size: [72, 8, 150] }, pos: [mx, 4, mz], explode: { axis: [0, 1, 0], dist: 300 } });
    const bx = lx + 260, bz = lz;
    part({ id: "padbox", label: "Loopback pad box", alt: "A small box beside the laptop with two sockets.", fn: "Holds the stereo resistive pad for the electrical round trip.", material: "plastic", geom: { t: "tray", size: [60, 25, 40], wall: 2 }, pos: [bx, 12.5, bz], explode: { axis: [0, 1, 0], dist: 200 } });
    const R2v = Math.round(10000 * 10 ** (-p.pad / 20) / (1 - 10 ** (-p.pad / 20)));
    ["R1", "R2", "R3", "R4"].forEach((id, i) => part({ id, label: id + " pad resistor", alt: "A small resistor inside the pad box.", fn: i % 2 ? "Shunt leg of the pad." : "Series leg of the pad.", material: "ceramic", geom: { t: "cyl", r: 1.2, h: 6, axis: "x", seg: 12 }, pos: [bx - 15 + i * 10, 6, bz], explode: { axis: [0, 1, 0], dist: 240 } }));
    for (const [id, s] of [["J1", -1], ["J2", 1]]) part({ id, label: id + (s < 0 ? " from the laptop" : " to the line input"), alt: "A round socket on the pad box.", fn: s < 0 ? "Takes the laptop's line out." : "Feeds the recorder's line input.", material: "steel", geom: { t: "cyl", r: 3, h: 10, axis: "x", seg: 16 }, pos: [bx + s * 33, 12.5, bz], explode: { axis: [s, 0, 0], dist: 120 } });
    const items = [
      { item: 1, desc: "Floor (existing)", material: "-", parts: ["floor"] }, { item: 2, desc: "Ceiling (existing)", material: "-", parts: ["ceil"] },
      { item: 3, desc: "Wall (existing)", material: "-", parts: ["wallL", "wallR", "wallB", "wallF"] },
      { item: 4, desc: "Laptop, effects off", material: "-", pn: "existing", pnStatus: "existing device", parts: ["laptop"] },
      { item: 5, desc: "Phone as the microphone", material: "-", pn: "existing", pnStatus: "existing device", parts: ["phone"] },
      { item: 6, desc: "Pad box with resistors, sockets", material: "ABS", parts: ["padbox", "R1", "R2", "R3", "R4", "J1", "J2"] },
    ];
    const assembly = { id: "room", label: "Room-shape meter set-up", children: [
      { id: "shell", label: "The room", children: ["floor", "ceil", "wallL", "wallR", "wallB", "wallF"] },
      { id: "dev", label: "Existing devices", children: ["laptop", "phone"] },
      { id: "pad", label: "Loopback pad", children: ["padbox", "R1", "R2", "R3", "R4", "J1", "J2"] }] };
    const R0805 = "Resistor_SMD:R_0805_2012Metric", JK = "TRS 3.5 mm";
    const components = [
      { ref: "J1", sym: "JACK3R", value: "FROM LAPTOP", part: "J1", desc: "3.5 mm stereo socket", pn: JK, pnStatus: "commodity", pins: { T: "OUT_L", R: "OUT_R", S: "GND" } },
      { ref: "R1", sym: "R", value: "10k", part: "R1", fp: R0805, desc: "Pad series, left", pins: { 1: "OUT_L", 2: "PAD_L" } },
      { ref: "R2", sym: "R", value: C.eng(R2v), part: "R2", fp: R0805, desc: "Pad shunt, left", pins: { 1: "PAD_L", 2: "GND" } },
      { ref: "R3", sym: "R", value: "10k", part: "R3", fp: R0805, desc: "Pad series, right", pins: { 1: "OUT_R", 2: "PAD_R" } },
      { ref: "R4", sym: "R", value: C.eng(R2v), part: "R4", fp: R0805, desc: "Pad shunt, right", pins: { 1: "PAD_R", 2: "GND" } },
      { ref: "J2", sym: "JACK3", value: "TO LINE IN", part: "J2", desc: "3.5 mm stereo socket", pn: JK, pnStatus: "commodity", pins: { T: "PAD_L", R: "PAD_R", S: "GND" } },
    ];
    const G = 2.54, at = (x, y, r = 0) => [x * G, y * G, r];
    const dims = [
      { id: "L", view: "front", kind: "gap", axis: "u", a: { part: "wallL", side: "hi" }, b: { part: "wallR", side: "lo" }, tol: { pm: 10 }, expect: L, param: "L", tier: 1 },
      { id: "H", view: "front", kind: "gap", axis: "v", a: { part: "floor", side: "hi" }, b: { part: "ceil", side: "lo" }, tol: { pm: 10 }, expect: H, param: "H" },
      { id: "W", view: "top", kind: "gap", axis: "v", a: { part: "wallF", side: "hi" }, b: { part: "wallB", side: "lo" }, tol: { pm: 10 }, expect: Wd, param: "Wd" },
      { id: "lap", view: "top", kind: "gap", axis: "u", a: { part: "wallL", side: "hi" }, b: { part: "laptop", side: "lo" }, tol: { pm: 20 }, expect: 50, at: "hi" },
    ];
    return {
      parts, fits: [{ what: "laptop and phone inside the room", ok: L >= 1500 && Wd >= 1000, need: "1.5 m by 1 m", have: p.L + " m by " + p.Wd + " m" }], items, assembly,
      netlist: { components, nets: ["OUT_L", "OUT_R", "PAD_L", "PAD_R"].map((name) => ({ name })).concat([{ name: "GND", power: true }]) },
      sch: { title: "ROOM METER, LOOPBACK PAD", number: "ROOM-SCH-001", place: { J1: at(40, 50), R1: at(56, 49, 90), R2: at(66, 53), R3: at(56, 60, 90), R4: at(66, 64), J2: at(84, 52) } },
      drawing: {
        number: "ROOM-SET-001", title: "ROOM-SHAPE METER, SET-UP", rev: "A",
        views: { front: { skip: ["wallF"] }, top: { skip: ["ceil"] }, right: { skip: ["wallR"] }, iso: { skip: ["wallF", "ceil", "wallR"] }, section: { cut: { n: [0, 0, 1], d: lz }, label: "A", from: "top", skip: ["wallF"] } },
        dims, datums: [{ letter: "A", view: "front", part: "floor", side: "bottom" }],
        notes: ["Dimensions in millimetres; tape-measure tolerances.", "Front view with the front wall removed; top view without the ceiling.", "Laptop and phone sit in opposite corners, effects off.", "The pad box is not to scale at this sheet scale.", "Nothing is ordered, priced or fabricated from this sheet."],
      },
    };
  };

  inst.physics = (p) => {
    const V = p.L * p.Wd * p.H, ms = W_.modes(p.fTop, p.L, p.Wd, p.H), n = ms.length, nw = W_.weyl(p.fTop, p.L, p.Wd, p.H), bw = 2.2 / p.T60;
    const sp = 1 / W_.density(p.fTop, p.L, p.Wd, p.H), fS = W_.schroeder(p.T60, V), R2v = 10000 * 10 ** (-p.pad / 20) / (1 - 10 ** (-p.pad / 20));
    let resolved = 0;
    for (let i = 0; i < n; i++) { const gap = Math.min(i ? ms[i] - ms[i - 1] : Infinity, i + 1 < n ? ms[i + 1] - ms[i] : Infinity); if (gap > bw) resolved++; }
    const fs = Float32Array.from({ length: 160 }, (_, i) => 20 + (i / 159) * (p.fTop * 1.3 - 20));
    return {
      v: { V, n, nw, bw, sp, fS, resolved, R2v },
      readouts: [
        ["Volume", V.toPrecision(3) + " m^3"], ["Modes below the band top, counted", String(n)], ["Weyl's law at the band top", nw.toPrecision(3)],
        ["Modal bandwidth 2.2 / T60", bw.toPrecision(3) + " Hz"], ["Mean spacing at the band top", sp.toPrecision(3) + " Hz"], ["Modes with a neighbour farther than a bandwidth", resolved + " of " + n],
        ["Schroeder frequency", fS.toPrecision(3) + " Hz"], ["Pad attenuation", W_.pad(10000, R2v).toFixed(1) + " dB (R2 = " + C.eng(R2v, " Ohm") + ")"], ["Capture length, sweep plus two T60", (10 + 2 * p.T60).toFixed(1) + " s"],
      ],
      panels: [
        { title: "Mode count N(f): every rigid-wall mode against Weyl's law", x: { min: 20, max: p.fTop * 1.3, label: "Hz" }, y: { min: 0, max: Math.max(5, W_.weyl(p.fTop * 1.3, p.L, p.Wd, p.H) * 1.05), label: "N" }, cursor: p.fTop,
          series: [{ name: "counted", x: fs, y: Float32Array.from(fs, (f) => ms.filter((m) => m <= f).length + W_.modes(p.fTop * 1.3, p.L, p.Wd, p.H).filter((m) => m <= f && m > p.fTop).length), tok: "s1", step: true, width: 1.5 }, { name: "Weyl", x: fs, y: Float32Array.from(fs, (f) => W_.weyl(f, p.L, p.Wd, p.H)), tok: "s2", width: 2 }] },
        { title: "Mean mode spacing against modal bandwidth", x: { min: 20, max: p.fTop * 1.3, label: "Hz" }, y: { min: 0.05, max: 50, label: "Hz", log: true }, cursor: p.fTop,
          series: [{ name: "spacing", x: fs, y: Float32Array.from(fs, (f) => 1 / W_.density(f, p.L, p.Wd, p.H)), tok: "s2", width: 2 }, { name: "bandwidth", x: fs, y: Float32Array.from(fs, () => bw), tok: "s1", dash: true }] },
      ],
    };
  };

  inst.spec = (p, ph) => ({
    budgetUnit: "fraction of V",
    ranges: [
      { quantity: "Room volume", min: 8, max: 320, unit: "m^3", limit: "the parameter box; a large room puts the band top above the Schroeder frequency" },
      { quantity: "Counting band", min: 40, max: p.fTop, unit: "Hz", limit: "speaker roll-off below; Schroeder frequency " + ph.v.fS.toPrecision(3) + " Hz above" },
      { quantity: "Reverberation time", min: 0.3, max: 2, unit: "s", limit: "rigid-wall check needs T60 above 0.3 s" },
    ],
    budget: [
      { term: "Laptop speaker, median volume error (run 1, preregistered)", value: 0.144, basis: "simulated, not measured", note: "studies/room run 20261031T003606Z" },
      { term: "Tape-measured reference room", value: 3 * 0.01 / Math.min(p.L, p.Wd, p.H), basis: "computed, 10 mm per length", note: "for checking the meter, not part of a reading" , combine: false },
      { term: "Furnished room, open door, irregular plan", value: null, basis: "unknown", note: "the twin is a rigid empty shoebox" },
      { term: "Laptop DSP left on", value: null, basis: "unknown", note: "flagged UNCAL by the loopback check" },
    ],
  });

  inst.checks = () => {
    const ms = W_.modes(150, 5, 4, 2.5), w = W_.weyl(150, 5, 4, 2.5);
    return [
      { name: "Weyl's law with surface and edge terms is within 15 percent of the exact count, 5 x 4 x 2.5 m at 150 Hz (" + ms.length + " modes)", got: Math.abs(ms.length - w) / ms.length < 0.15 ? 1 : 0, want: 1, tol: 0 },
      { name: "first axial mode of a 5 m room is c / 2L = 34.3 Hz", got: ms[0], want: 34.3, tol: 1e-9 },
      { name: "Schroeder frequency at T60 0.5 s, 50 m^3 is 200 Hz", got: W_.schroeder(0.5, 50), want: 200, tol: 1e-12 },
      { name: "a 10 k and 1 k pad attenuates 20.8 dB", got: W_.pad(10000, 1000), want: -20.83, tol: 1e-3 },
    ];
  };

  C.register(C.fromRecord(inst, REC));
  if (typeof module !== "undefined" && module.exports) module.exports = inst;
})(typeof globalThis !== "undefined" ? globalThis : this);
