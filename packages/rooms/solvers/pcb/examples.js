// SPDX-License-Identifier: FSL-1.1-MIT
import { arrayPositions, parseNetlist } from "./netlist.js";
import { place } from "./placement.js";
import { routeGen } from "./router.js";
import { drc } from "./drc.js";
// ======================================================================= Example designs
export const EXAMPLES = {
  tia: `# Transimpedance amplifier for a photodiode. Op-amp pinout is generic SOIC-8.
board 34 26 layers=4 title=TIA-PHOTODIODE
part J1 HDR4 value=power-and-output
part D1 PD value=photodiode
part U1 SOIC8 value=op-amp P=0.05
part R1 R0603 value=1M
part C1 C0603 value=1p
part R2 R0603 value=50
part C2 C0805 value=100n
part C3 C0805 value=100n
fix J1 30 13
fix D1 7.5 13
net IN D1.1 U1.2 R1.1 C1.1
net OUT U1.6 R1.2 C1.2 R2.1
net SIG R2.2 J1.3
power GND width=0.4 D1.2 U1.3 C2.2 C3.2 J1.2
power VCC width=0.4 U1.7 C2.1 J1.1
power VEE width=0.4 U1.4 C3.1 J1.4
dc VEE 0.02 J1.4 U1.4
dc SIG 0.01 R2.2 J1.3`,
  piezo: `# Charge preamp for a piezo. Rf and Cf set the corner; guard ground around the input is not generated.
board 38 26 layers=2 title=PIEZO-PREAMP
part J1 HDR2 value=piezo-in
part R1 R0603 value=1k
part R2 R0603 value=100M
part C1 C0603 value=1n
part U1 SOIC8 value=op-amp P=0.03
part R3 R0603 value=100
part C2 C0805 value=100n
part C3 C0805 value=100n
part J2 HDR4 value=out-and-power
fix J1 4.5 13
fix J2 33.5 13
net IN J1.1 R1.1
net SUM R1.2 U1.2 R2.1 C1.1
net OUT U1.6 R2.2 C1.2 R3.1
net SIG R3.2 J2.1
power GND width=0.4 J1.2 U1.3 C2.2 C3.2 J2.2
power VCC width=0.4 U1.7 C2.1 J2.3
power VEE width=0.4 U1.4 C3.1 J2.4
dc VCC 0.03 J2.3 U1.7`,
};
export function arrayExample(shape, pitch, rotDeg, cnt) {
  pitch = pitch || 5.5;
  rotDeg = rotDeg || 0;
  const n = cnt || 37,
    hd = [
      "# Sensor array in a " +
        shape +
        " layout. Same sensors, pitch, board and connector as its twin.",
      "board 62 62 layers=4 title=ARRAY-" + shape.toUpperCase(),
      "array S " +
        n +
        " " +
        shape +
        " pitch=" +
        pitch +
        " rot=" +
        rotDeg +
        " part=PD0805 value=sensor cx=31 cy=35",
      "part J1 HDS38 value=array-out",
      "fix J1 31 4 90",
    ];
  const P = arrayPositions(n, shape, pitch).map((q) => {
      const r = (rotDeg * Math.PI) / 180;
      return [q[0] * Math.cos(r) - q[1] * Math.sin(r), q[0] * Math.sin(r) + q[1] * Math.cos(r)];
    }),
    ord = P.map((q, i) => [Math.atan2(q[1] + 31, q[0]), i]).sort((u, v) => v[0] - u[0]),
    nets = [];
  ord.forEach((o, k) => {
    const i = o[1] + 1;
    nets.push("net S" + i + "_OUT S" + i + ".1 J1." + (k + 1));
  });
  const g =
    "power GND width=0.3 J1.38 " +
    Array.from({ length: n }, (_, i) => "S" + (i + 1) + ".2").join(" ");
  return hd.concat(nets, g).join("\n");
}
EXAMPLES.honeycomb = arrayExample("honeycomb");
EXAMPLES.sunflower = arrayExample("sunflower");
export function* buildGen(text, force, seed, lim) {
  const d = parseNetlist(text, force);
  if (d.errors.length) return d;
  d.passLimit = lim;
  place(d, seed);
  yield { pass: 0, net: "placed" };
  yield* routeGen(d);
  d.drc = drc(d);
  return d;
}
export function buildDesign(text, force, seed, lim) {
  const g = buildGen(text, force, seed, lim);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}
export function designStats(d) {
  let len = 0;
  const per = {};
  for (const t of d.tracks) {
    const L = Math.hypot(t.x2 - t.x1, t.y2 - t.y1);
    len += L;
    per[t.net] = (per[t.net] || 0) + L;
  }
  const sig = d.nets.filter((n) => n.kind === "signal").map((n) => per[n.id] || 0);
  return {
    tracks: d.tracks.length,
    vias: d.vias.length,
    length: len,
    longest: sig.length ? Math.max(...sig) : 0,
    shortest: sig.length ? Math.min(...sig) : 0,
    mean: sig.length ? sig.reduce((a, b) => a + b, 0) / sig.length : 0,
    bottom: d.tracks
      .filter((t) => t.l === d.layers - 1)
      .reduce((a, t) => a + Math.hypot(t.x2 - t.x1, t.y2 - t.y1), 0),
  };
}
