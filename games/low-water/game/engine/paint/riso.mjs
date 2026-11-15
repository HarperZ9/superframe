// The Daybook's map as a printed thing (the author's reference: a risograph pixel map, flat inks, halftone
// fills, a little misregistration, paper fibre and fold light). The chart Lamb draws (ui/map.mjs) is printed
// in two inks on the Daybook's paper: the town's lines in the ink Lamb writes with, and a second drum in the
// harbour's oxblood for the ways walked and where Lamb stands, laid a pixel or two off register as a cheap
// press lays it; the sea and the districts Lamb knows are halftone screens (dots that grow with the tone);
// the sheet carries a faint fibre and the light of two folds. Pure SVG: it scales with the page and prints.
// Original code.
//   risoize(svgChart, { seed })   (ui/map.mjs calls it on the chart it built)
const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); for (const k of kids) e.append(k); return e; };
export const INKS = { line: "#2a1d22", red: "#9a3324", sea: "#3d6f78" };

export function risoize(chart, { seed = 7 } = {}) {
  const vb = (chart.getAttribute("viewBox") || "0 0 1000 640").split(/\s+/).map(Number), W = vb[2], H = vb[3];
  let s = seed >>> 0; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const off = [Math.round((rnd() - 0.5) * 6) / 2 || 1, Math.round((rnd() - 0.5) * 6) / 2 || -1];   // the second drum's misregistration, 0.5 to 1.5 px
  // halftone screens: dots on a 45-degree grid, their size by the tone
  const defs = el("defs");
  const screen = (id, ink, r, pitch = 7) => defs.append(el("pattern", { id, width: pitch, height: pitch, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, el("circle", { cx: pitch / 2, cy: pitch / 2, r, fill: ink })));
  screen("riso-sea", INKS.sea, 1.2); screen("riso-known", INKS.red, 1.7, 6); screen("riso-here", INKS.red, 2.6, 6);
  // paper: a fibre of fine turbulence, multiplied in; folds: a lighter and a darker band either side of each crease
  defs.append(el("filter", { id: "riso-fibre", x: 0, y: 0, width: "100%", height: "100%" },
    el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.9 0.05", numOctaves: 2, seed: seed % 97, result: "n" }),
    el("feColorMatrix", { in: "n", type: "matrix", values: "0 0 0 0 0.36  0 0 0 0 0.30  0 0 0 0 0.26  0 0 0 0.10 0" })));
  for (const [id, a, b] of [["riso-foldv", "x1", "x2"], ["riso-foldh", "y1", "y2"]]) defs.append(el("linearGradient", { id, [a]: 0, [b]: 1 }, el("stop", { offset: 0, "stop-color": "#fff", "stop-opacity": 0 }), el("stop", { offset: 0.48, "stop-color": "#fff", "stop-opacity": 0.16 }), el("stop", { offset: 0.5, "stop-color": "#000", "stop-opacity": 0.06 }), el("stop", { offset: 1, "stop-color": "#000", "stop-opacity": 0 })));
  chart.prepend(defs);
  // the sea under everything, screened
  const sea = chart.querySelector(".mapsea"); if (sea) { sea.style.fill = "url(#riso-sea)"; sea.style.fillOpacity = "0.5"; }   // style, not attribute: the page's CSS sets the sea unfilled
  // the second drum: walked ways and the known districts in oxblood, off register; the town's lines stay in line ink
  const red = el("g", { class: "riso-red", transform: `translate(${off[0]} ${off[1]})`, style: "mix-blend-mode:multiply" });
  for (const w of chart.querySelectorAll("line.way.ink")) red.append(el("line", { x1: w.getAttribute("x1"), y1: w.getAttribute("y1"), x2: w.getAttribute("x2"), y2: w.getAttribute("y2"), stroke: INKS.red, "stroke-width": 5, "stroke-opacity": 0.55, "stroke-linecap": "round" }));
  for (const c of chart.querySelectorAll("circle.spot")) {
    const here = c.classList.contains("here"), known = here || c.classList.contains("ink"), r = +c.getAttribute("r");
    if (known) red.append(el("circle", { cx: c.getAttribute("cx"), cy: c.getAttribute("cy"), r: r * (here ? 3.2 : 2.6), fill: `url(#riso-${here ? "here" : "known"})`, "fill-opacity": 0.9 }));
  }
  const firstMark = chart.querySelector("line, circle:not(defs circle)"); chart.insertBefore(red, firstMark);
  for (const e of chart.querySelectorAll("line.way, circle.spot")) e.style.stroke = e.classList.contains("pencil") ? "" : INKS.line;
  // paper over all of it: fibre, and the folds' light (the sheet folded in four)
  chart.append(el("rect", { x: 0, y: 0, width: W, height: H, filter: "url(#riso-fibre)", style: "mix-blend-mode:multiply", "pointer-events": "none" }));
  chart.append(el("rect", { x: W / 2 - 40, y: 0, width: 80, height: H, fill: "url(#riso-foldv)", "pointer-events": "none" }));
  chart.append(el("rect", { x: 0, y: H / 2 - 30, width: W, height: 60, fill: "url(#riso-foldh)", "pointer-events": "none" }));
  chart.dataset.riso = `${off[0]},${off[1]}`;
  return chart;
}
