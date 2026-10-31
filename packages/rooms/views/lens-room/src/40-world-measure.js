function measureWorld() {
  const f = FIELDS[S.field];
  const rows = [["Field", f.name]];
  const flagged = fieldFlag();
  if (S.field == "fisheye") {
    const a = S.a2,
      p0 = [0.6 * a, 0, 0];
    const anti = [(-a * a) / p0[0], 0, 0];
    setWorld(32, 1, 1, 0, true, Math.PI * a, p0);
    sF("uHH", (Math.PI * a) / 700);
    sI("uSteps", 702);
    const px = drawProbe(32, 1);
    let mx = 0,
      sum = 0,
      n = 0;
    for (let i = 0; i < 32; i++) {
      const o = i * 4;
      const d = Math.hypot(px[o] - anti[0], px[o + 1], px[o + 2]);
      mx = Math.max(mx, d);
      sum += d * d;
      n++;
    }
    rows.push(
      ["Antipode expected", "x = " + fmt(anti[0], 3)],
      ["Rays traced", String(n)],
      ["RMS miss at antipode", Math.sqrt(sum / n).toExponential(2)],
      ["Worst miss", mx.toExponential(2)]
    );
    last.world = { antiRms: Math.sqrt(sum / n), antiMax: mx, anti };
  }
  rows.push(...gravityRows());
  if (flagged) rows.push(["Physical", `<span class=flag>${flagged}</span>`]);
  setRead(rows);
  $("wnote").textContent = f.note;
  $("model").textContent =
    S.field == "fisheye" || S.field == "gravity"
      ? "Objects are lit by a straight sun direction: shading does not bend, placement and appearance along the ray do."
      : "";
  if (S.view == "side") drawWorldSide();
}
