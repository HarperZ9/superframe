// ======================================================================= App state
const S = {
  view: "board",
  over: null,
  overA: 0.95,
  zs: 4,
  gap: 4,
  cutY: 0,
  aper: 0.0,
  focus: 60,
  mask: "purple",
  samples: 0,
  maxS: 96,
  cam: { az: 0.35, el: 0.72, dist: 60, tx: 0, ty: 0, tz: 0 },
  d: null,
  vao: null,
  tab: null,
  rib: null,
  texW: 2048,
  texH: 2048,
  net: 0,
  I: 0.1,
  Rs: 50,
  RL: 50,
  tr: 100,
  plantI: 0,
  cache: new Map(),
  hist: [],
  playing: false,
  tl: null,
  ex: "tia",
  view2: { s: 1, x: 0, y: 0 },
};
const VIEWS = [
  ["schem", "Schematic"],
  ["blue", "Blueprint"],
  ["board", "Board"],
  ["section", "Section"],
  ["exploded", "Exploded"],
  ["field", "Field cut"],
];
const MODES = [
  [null, "Physical"],
  ["J", "Current"],
  ["V", "Voltage drop"],
  ["signal", "Signal step"],
  ["E", "Field"],
  ["T", "Heat"],
];
const PLAIN = {
  schem:
    "Generated from the netlist text. Every signal net is wired by a maze router; power nets end in rail and ground symbols.",
  blue: "The board as a fabrication drawing: copper by layer, drills, dimensions, drill table and stackup.",
  board:
    "The same geometry the Gerber files carry, lit as an object. It sharpens as samples add up. Click to focus.",
  section:
    "A real cut through the board. Thickness is magnified so the copper can be seen; the plan dimensions are true.",
  exploded: "Every layer of the stack lifted apart, with barrels joining the copper.",
  field:
    "The electric field across a cut, solved from the copper at that cut with the chosen net at 1 V and all other copper at 0 V.",
};
function setStatus(t) {
  $("status").textContent = t || "";
}
function resetAcc() {
  S.samples = 0;
}
function fmt(v, u) {
  const a = Math.abs(v);
  if (!isFinite(v)) return "n/a";
  if (a === 0) return "0 " + u;
  const pre = [
    [1e9, "G"],
    [1e6, "M"],
    [1e3, "k"],
    [1, ""],
    [1e-3, "m"],
    [1e-6, "u"],
    [1e-9, "n"],
    [1e-12, "p"],
  ];
  for (const [k, s] of pre) if (a >= k) return (v / k).toPrecision(3) + " " + s + u;
  return v.toExponential(2) + " " + u;
}
function slider(host, id, label, min, max, step, val, fn, show) {
  const r = document.createElement("div");
  r.className = "row";
  r.innerHTML =
    '<label for="' +
    id +
    '">' +
    label +
    '</label><input id="' +
    id +
    '" type="range" min="' +
    min +
    '" max="' +
    max +
    '" step="' +
    step +
    '" value="' +
    val +
    '"><output></output>';
  host.appendChild(r);
  const inp = r.children[1],
    o = r.children[2],
    up = () => {
      o.textContent = show ? show(+inp.value) : inp.value;
    };
  inp.addEventListener("input", () => {
    up();
    fn(+inp.value);
  });
  up();
  return inp;
}
