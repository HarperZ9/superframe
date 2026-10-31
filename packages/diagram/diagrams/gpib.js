// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* IEEE-488 / HP-IB three-wire handshake. Source: HP-GAPS.md section 7. */
(function (g) {
  "use strict";
  const D = g.Diagram;
  const BYTES = [0x48, 0x50, 0x49, 0x42], READY = [0.4, 1.1, 2.3], ACCEPT = [0.6, 1.8, 0.9], SETTLE = 0.3, EPS = 0.05;
  const LINES = ["DAV", "NRFD", "NDAC"];
  /* Event list: per device (0 talker, 1..3 listeners) and line, the times it starts and stops pulling the line low. */
  function handshake() {
    const hold = Array.from({ length: 4 }, () => LINES.map(() => [])), on = (d, l, t) => hold[d][l].push([t, Infinity]), off = (d, l, t) => { const h = hold[d][l]; h[h.length - 1][1] = t; };
    const bytes = [];
    for (let k = 1; k <= 3; k++) on(k, 2, 0);   /* listeners hold NDAC: nothing accepted yet */
    let t = 0, ready = READY.slice();
    for (const b of BYTES) {
      const t1 = Math.max(t + SETTLE, ...ready);   /* 1. data on the lines; wait until no one holds NRFD */
      on(0, 0, t1);                                 /* 2. DAV low */
      for (let k = 1; k <= 3; k++) { on(k, 1, t1 + EPS); off(k, 2, t1 + ACCEPT[k - 1]); }   /* 3. NRFD low; 4. each releases NDAC when it has the byte */
      const t2 = t1 + Math.max(...ACCEPT);          /* NDAC rises only when the last listener lets go */
      off(0, 0, t2 + 0.1);                          /* 5. DAV released */
      const t3 = t2 + 0.1 + EPS;
      for (let k = 1; k <= 3; k++) { on(k, 2, t3); off(k, 1, t3 + READY[k - 1]); }   /* 6. NDAC low again; NRFD released when ready */
      bytes.push({ b, t0: t, t1, t2, t3 });
      ready = READY.map((r) => t3 + r); t = t3;
    }
    const end = Math.max(...ready) + 0.5;
    return { hold, bytes, end };
  }
  const H = handshake();
  const held = (d, l, t) => H.hold[d][l].some(([a, b]) => t >= a && t < b);
  const bus = (l, t) => [0, 1, 2, 3].some((d) => held(d, l, t));   /* wired-OR on open collectors: low if anyone pulls */
  const byteAt = (t) => { let cur = null; for (const x of H.bytes) if (t >= x.t1 - SETTLE) cur = x; return cur; };
  const part = (o) => Object.assign({ material: "electronics" }, o);
  const rod = (z, y) => ({ t: "cyl", r: 0.07, h: 10, axis: "x", pos: [0, y, z], seg: 10 });
  const DEV = [["talker", "Talker (a voltmeter)", -4], ["l1", "Listener 1: printer", -1.3], ["l2", "Listener 2: plotter", 1.3], ["l3", "Listener 3: counter", 4]];
  const def = {
    id: "gpib", title: "HP-IB handshake", region: "brut", file: "gpib-handshake.html", super: "488",
    message: "A byte moves only when nobody holds the not-ready wire and moves on only when nobody holds the not-taken wire, so the bus always runs at the pace of its slowest listener.",
    lede: "One talker, three listeners and three shared wires that any of them can pull low. The 3D cable shows each wire's state on the wire itself; the world-line view lays the whole exchange out in time.",
    camera: { yaw: 0.45, pitch: 0.5, zoom: 2.3 }, cut: { axis: "x", d: 2.5 }, startU: 0.3, playSeconds: 30,
    parts: DEV.map(([id, label, x], i) => part({ id, label, short: label.split(":")[0].replace(" (a voltmeter)", ""), alt: `A box above the cable: ${label.toLowerCase()}.`, fn: i ? `Pulls NRFD low until it is ready (${READY[i - 1]} us) and NDAC low until it has taken the byte (${ACCEPT[i - 1]} us). Illustrative timings.` : "Puts a byte on the eight data lines and pulls DAV low when no one holds NRFD.", qty: i ? `ready ${READY[i - 1]} us, accept ${ACCEPT[i - 1]} us` : "4 bytes: H P I B", geom: { t: "box", size: [1.8, 1.0, 1.6] }, pos: [x, 0.5, 0], explode: { axis: [0, 1, 0], dist: 1.4 } })).concat([
      part({ id: "dav", label: "DAV wire (data valid)", short: "DAV", alt: "One rod of the cable: data valid, driven by the talker.", fn: "Low means: the byte on the data lines is valid.", qty: "active low", material: "copper", geom: rod(0.55, -1.2), pos: [0, 0, 0], explode: { axis: [0, -1, 0.4], dist: 1.0 } }),
      part({ id: "nrfd", label: "NRFD wire (not ready for data)", short: "NRFD", alt: "One rod of the cable: not ready for data, wired-OR of all listeners.", fn: "Any listener can hold it low; it reads high only when every listener is ready.", qty: "wired-OR, active low", material: "copper", geom: rod(0.3, -1.2), pos: [0, 0, 0], explode: { axis: [0, -1, 0.2], dist: 1.4 } }),
      part({ id: "ndac", label: "NDAC wire (not data accepted)", short: "NDAC", alt: "One rod of the cable: not data accepted, wired-OR of all listeners.", fn: "Rises only when the last listener has taken the byte.", qty: "wired-OR, active low", material: "copper", geom: rod(0.05, -1.2), pos: [0, 0, 0], explode: { axis: [0, -1, 0], dist: 1.8 } }),
      part({ id: "dio", label: "Data lines DIO1 to DIO8", short: "DIO1-8", alt: "A flat bundle of eight thin rods: the byte.", fn: "Eight data lines, one byte at a time, no parity.", qty: "8 bits", material: "copper", geom: { t: "group", items: Array.from({ length: 8 }, (_, i) => ({ t: "cyl", r: 0.04, h: 10, axis: "x", seg: 8, pos: [0, -1.2, -0.25 - i * 0.12] })) }, pos: [0, 0, 0], explode: { axis: [0, -1, -0.5], dist: 2.2 } }),
      part({ id: "mgmt", label: "Management lines", short: "ATN IFC SRQ REN EOI", alt: "Five thin rods at the back of the cable.", fn: "ATN, IFC, SRQ, REN and EOI: addressing, reset, service requests, remote and end of message. Not animated here.", material: "copper", geom: { t: "group", items: Array.from({ length: 5 }, (_, i) => ({ t: "cyl", r: 0.04, h: 10, axis: "x", seg: 8, pos: [0, -1.2, -1.4 - i * 0.12] })) }, pos: [0, 0, 0], explode: { axis: [0, -1, -1], dist: 2.6 }, noSchematic: true }),
    ]),
    links: [
      { from: "talker", to: "dio", label: "byte" }, { from: "talker", to: "dav", label: "DAV low" },
      { from: "dav", to: "l1" }, { from: "dav", to: "l2" }, { from: "dav", to: "l3" }, { from: "dio", to: "l2", hide3d: true },
      { from: "l1", to: "nrfd", hide3d: true }, { from: "l2", to: "nrfd", hide3d: true }, { from: "l3", to: "nrfd", label: "any one holds" },
      { from: "l1", to: "ndac", hide3d: true }, { from: "l2", to: "ndac", hide3d: true }, { from: "l3", to: "ndac", label: "last one frees" },
    ],
    variants: [{ title: "Who holds NRFD", path: ["l3", "nrfd"], kind: "fail", verdict: "The counter is slowest to get ready (2.3 us): while it holds NRFD low, no byte can start." },
      { title: "Who holds NDAC", path: ["l2", "ndac"], kind: "fail", verdict: "The plotter is slowest to accept (1.8 us): NDAC stays low until it lets go." }],
  };
  /* sch positions by hand: talker left, wires in the middle, listeners right */
  const S = { talker: [0, 1.5], dio: [1, 0], dav: [1, 1.5], nrfd: [3, 3], ndac: [3, 4], l1: [2, 0.5], l2: [2, 1.5], l3: [2, 2.5] };
  for (const p of def.parts) if (S[p.id]) p.sch = { x: S[p.id][0], y: S[p.id][1] };
  def.sim = (model) => {
    const lineIds = ["dav", "nrfd", "ndac"];
    return {
      duration: () => H.end * 1e-6,
      state: (u, view) => {
        const t = u * H.end, parts = {}, boxes = [], by = byteAt(t);
        lineIds.forEach((id, l) => { parts[id] = { tok: bus(l, t) ? "red" : "soft", current: bus(l, t) ? 0.016 : 0 }; });
        DEV.forEach(([id], d) => { if ([0, 1, 2].some((l) => held(d, l, t))) parts[id] = { emit: 0.18, glow: [0.9, 0.3, 0.2] }; });
        const dio = model.index.get("dio"), sh = D.partShift(dio, view);
        if (by) for (let i = 0; i < 8; i++) if ((by.b >> i) & 1) boxes.push({ pos: [-2.6 + sh[0], -1.2 + sh[1], -0.25 - i * 0.12 + sh[2]], size: [0.3, 0.1, 0.1], tok: "s5" });
        return { parts, boxes, flow: bus(0, t) ? 1 : 0, readout: { t } };
      },
      trace: (u) => {
        const t = u * H.end, n = 600, xs = Float32Array.from({ length: n }, (_, i) => (i / (n - 1)) * H.end), ser = [];
        LINES.forEach((L, l) => ser.push({ name: L + " bus", x: xs, y: Float32Array.from(xs, (x) => 3 * (2 - l) + (bus(l, x) ? 0 : 1.4)), tok: ["ink", "s1", "s2"][l], width: 2, step: true }));
        for (let k = 1; k <= 3; k++) ser.push({ x: xs, y: Float32Array.from(xs, (x) => 3 * (2 - 1) - 0.5 - 0.35 * k + (held(k, 1, x) ? 0 : 0.25)), tok: "soft", width: 1, step: true });
        return [{ title: "Timing: high = released, low = pulled; thin lines under NRFD are each listener's own hold", x: { min: 0, max: H.end, label: "us" }, y: { min: -0.6, max: 8.8, label: "lines" }, cursor: t, series: ser }];
      },
      spacetime: () => {
        const verts = [], edges = [], timelike = [], edgePart = [], ids = ["dav", "nrfd", "ndac"].map((i) => model.index.get(i).index);
        for (let d = -1; d < 4; d++) for (let l = 0; l < 3; l++) {
          const lv = (t) => (d < 0 ? (bus(l, t) ? 0 : 1) : held(d, l, t) ? 0 : 1);
          const cuts = new Set([0, H.end]);
          if (d < 0) for (let dd = 0; dd < 4; dd++) for (const [a, b] of H.hold[dd][l]) { cuts.add(a); if (isFinite(b)) cuts.add(b); }
          else for (const [a, b] of H.hold[d][l]) { cuts.add(a); if (isFinite(b)) cuts.add(b); }
          const ts = [...cuts].filter((x) => x <= H.end).sort((a, b) => a - b);
          let prev = -1;
          for (const t of ts) for (const tt of [t - 1e-6, t + 1e-6]) {
            if (tt < 0 || tt > H.end) continue;
            verts.push([l, lv(tt), d, tt]);
            if (prev >= 0) { edges.push([prev, verts.length - 1]); timelike.push(1); edgePart.push(ids[l]); }
            prev = verts.length - 1;
          }
        }
        return { verts, edges, timelike, edgePart, axes: ["line", "level", "device (bus at back)", "time"], angles: [0, 0, 1.15, 0, 0, 0.2] };
      },
    };
  };
  def.checks = () => [
    { name: "NDAC rises the slowest acceptance time after DAV falls", got: H.bytes[0].t2 - H.bytes[0].t1, want: Math.max(...ACCEPT), tol: 1e-12 },
    { name: "a new byte waits for the slowest listener to be ready", got: H.bytes[1].t1 - H.bytes[0].t3, want: Math.max(...READY), tol: 1e-12 },
  ];
  def.plain = `<p>One instrument talks; three listen. They share three wires, and any device can pull a wire low; a wire reads high only when nobody is pulling. The listeners pull "not ready" while they are busy, and "not taken" until they have read the byte.</p>
<p>So the talker waits until nobody is still busy, says "data valid", and waits again until the last listener has taken the byte. The quick printer always ends up waiting for the slow counter. No clock is needed, and a slow device can never miss a byte. Press play and watch each wire in the cable go red while someone holds it low. In the world-line view, turn time into view and each wire becomes a trace of its history.</p>`;
  def.working = `<p class="math">Lines: DIO1-8, DAV, NRFD, NDAC; management ATN, IFC, SRQ, REN, EOI; open-collector drivers, so NRFD and NDAC are wired-OR (low if any device pulls)
Sequence per byte: talker sees NRFD high, pulls DAV low; listeners pull NRFD low; each releases NDAC when it has the byte; NDAC rises with the last; talker releases DAV; listeners pull NDAC low, then release NRFD when ready
Byte period = settle + max(accept) + max(ready) + small overheads: the slowest listener paces the bus</p>
<p>Listener timings (ready 0.4, 1.1, 2.3 us; accept 0.6, 1.8, 0.9 us) are illustrative. The handshake confirms the byte was taken, not that it was read correctly: there is no parity. Wired-OR is a SNIPPET-grade source fact (Omega and Anritsu pages); the sequence and the slowest-listener pacing are from electronics-notes (fetched). The bus takes up to 15 devices.</p>`;
  def.sources = ["electronics-notes, GPIB protocol and operation", "HP-GAPS.md section 7"];
  (g.DiagramDefs = g.DiagramDefs || {}).gpib = def;
  if (typeof module !== "undefined" && module.exports) module.exports = def;
})(typeof globalThis !== "undefined" ? globalThis : this);
