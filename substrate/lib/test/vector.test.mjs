import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fmt, pathD, simplify, smoothD, pathLength, hatch, halftone, dotsSvg, describeSeries, svgDoc,
  seriesPoints, sparkline, escapeXml,
} from "../vector.mjs";

test("fmt trims zeros, drops -0 and refuses non-finite numbers", () => {
  assert.equal(fmt(1.5), "1.5");
  assert.equal(fmt(2), "2");
  assert.equal(fmt(-0.001), "0");
  assert.equal(fmt(3.14159, 3), "3.142");
  assert.throws(() => fmt(NaN), /finite/);
});

test("pathD writes one or many polylines and closes on request", () => {
  assert.equal(pathD([[0, 0], [10, 5.5]]), "M0 0L10 5.5");
  const sq = Object.assign([[0, 0], [1, 0], [1, 1]], { closed: true });
  assert.equal(pathD([sq, [[5, 5], [6, 6]]]), "M0 0L1 0L1 1ZM5 5L6 6");
});

test("simplify keeps corners and drops collinear points", () => {
  const line = [[0, 0], [1, 0.01], [2, 0], [3, 0], [3, 3]];
  assert.deepEqual(simplify(line, 0.1), [[0, 0], [3, 0], [3, 3]]);
  assert.deepEqual(simplify([[0, 0], [1, 1]]), [[0, 0], [1, 1]]);
});

test("smoothD passes through every point with one cubic per segment", () => {
  const pts = [[0, 0], [10, 10], [20, 0], [30, 10]];
  const d = smoothD(pts);
  assert.equal((d.match(/C/g) || []).length, 3);
  assert.ok(d.startsWith("M0 0"));
  for (const p of pts.slice(1)) assert.ok(d.includes(` ${p[0]} ${p[1]}`), `missing end point ${p}`);
  assert.equal(smoothD(pts, { tension: 0 }), "M0 0C0 0 10 10 10 10C10 10 20 0 20 0C20 0 30 10 30 10");
});

test("pathLength measures open and closed polylines", () => {
  assert.equal(pathLength([[0, 0], [3, 4]]), 5);
  const sq = Object.assign([[0, 0], [2, 0], [2, 2], [0, 2]], { closed: true });
  assert.equal(pathLength(sq), 8);
});

test("hatch fills a square with lines of the right count and length", () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const segs = hatch(sq, { angle: 0, spacing: 2 });
  assert.equal(segs.length, 5);
  for (const [a, b] of segs) {
    assert.ok(Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1]) - 10) < 1e-9);
  }
  assert.ok(segs[1][0][0] > segs[1][1][0], "odd rows run backwards");
});

test("hatch at 45 degrees stays inside the polygon", () => {
  const tri = [[0, 0], [20, 0], [0, 20]];
  for (const seg of hatch(tri, { angle: 45, spacing: 1.5 })) for (const [x, y] of seg) {
    assert.ok(x >= -1e-9 && y >= -1e-9 && x + y <= 20 + 1e-9, `point ${x},${y} outside`);
  }
  assert.throws(() => hatch(tri, { spacing: 0 }), /spacing/);
});

test("halftone dot area tracks darkness", () => {
  const w = 16, h = 8, g = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = x < 8 ? 0 : 191;
  const dots = halftone(g, w, h, { cell: 8 });
  assert.equal(dots.length, 2);
  const [black, light] = dots;
  const ratio = (light.r * light.r) / (black.r * black.r);
  assert.ok(Math.abs(ratio - (1 - 191 / 255)) < 1e-9, `area ratio ${ratio}`);
  assert.equal(halftone(new Uint8Array(64).fill(255), 8, 8).length, 0);
  assert.throws(() => halftone(new Uint8Array(3), 2, 2), /smaller/);
});

test("dotsSvg writes circles", () => {
  assert.equal(dotsSvg([{ x: 1, y: 2, r: 0.5 }]), '<g fill="currentColor"><circle cx="1" cy="2" r="0.5"/></g>');
});

test("describeSeries names direction, extremes and the largest step", () => {
  const s = describeSeries([3, 5, 4, 12, 11], { label: "Pass rate", unit: "%", labels: ["Mon", "Tue", "Wed", "Thu", "Fri"] });
  assert.equal(s, "Pass rate, 5 points, rises from 3 % to 11 %. Lowest 3 % at Mon; highest 12 % at Thu. Largest step: up 8 % into Thu.");
  assert.equal(describeSeries([]), "Series: no data.");
  assert.match(describeSeries([2, 2]), /ends level/);
});

test("svgDoc is labelled for screen readers and escapes text", () => {
  const svg = svgDoc({ width: 10, height: 10, body: "", title: "A & B", desc: "<x>" });
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-labelledby="fig-title fig-desc"/);
  assert.match(svg, /<title id="fig-title">A &amp; B<\/title>/);
  assert.match(svg, /<desc id="fig-desc">&lt;x&gt;<\/desc>/);
  assert.equal(escapeXml('"'), "&quot;");
});

test("seriesPoints fits the box and centres a flat series", () => {
  const p = seriesPoints([0, 10], { width: 100, height: 50, pad: 5 });
  assert.deepEqual(p, [[5, 45], [95, 5]]);
  assert.deepEqual(seriesPoints([7, 7], { width: 100, height: 50, pad: 5 }).map((q) => q[1]), [25, 25]);
});

test("sparkline is deterministic, draw-on ready and carries its description", () => {
  const a = sparkline([1, 3, 2, 5], { title: "Load" });
  assert.equal(a, sparkline([1, 3, 2, 5], { title: "Load" }));
  assert.match(a, /pathLength="1"/);
  assert.match(a, /<desc id="spark-desc">Load, 4 points, rises from 1 to 5\./);
  assert.throws(() => sparkline([]), /at least one/);
});
