// ======================================================================= Design rules, files, array
function renderDRC(extra) {
  const d = S.d,
    R = d.rules;
  $("rtab").innerHTML =
    "<tr><th>Rule</th><th>Class</th><th>This board</th></tr>" +
    [
      ["Trace", R.trace, DES.w],
      ["Space", R.space, DES.clr],
      ["Drill", R.drill, DES.via],
      ["Ring", R.ring, (DES.viaPad - DES.via) / 2],
      ["Edge", R.edge, R.edge + 0.05],
      ["Mask web", R.web, "checked"],
    ]
      .map(
        (r) =>
          "<tr><td>" +
          r[0] +
          "</td><td>" +
          (+r[1]).toFixed(3) +
          "</td><td>" +
          (typeof r[2] === "number" ? r[2].toFixed(3) : r[2]) +
          "</td></tr>"
      )
      .join("");
  $("rsrc").textContent =
    "Rules in mm from " +
    R.name +
    ", " +
    R.source +
    ", read 2026-10-31. Mask web on the 4 layer class uses the 2 layer figure. A fabricator can reject a board that passes here.";
  const v = extra || d.drc;
  const o = $("drcOut");
  o.textContent = "";
  if (extra && extra.head) {
    const p = document.createElement("p");
    p.className = "note";
    p.textContent = extra.head;
    o.appendChild(p);
  }
  const n = document.createElement("p");
  n.className = "note";
  n.style.color = v.length ? "var(--warn)" : "var(--good)";
  n.textContent = v.length ? v.length + " violations" : "Clean: no violations on this board.";
  o.appendChild(n);
  for (const q of v.slice(0, 20)) {
    const e = document.createElement("div");
    e.className = "chk";
    e.innerHTML = '<b class="no">flag</b><span></span>';
    e.lastChild.textContent = q.rule + ": " + q.msg;
    o.appendChild(e);
  }
}
function renderManufacture() {
  const d = S.d;
  S.files = exportAll(d);
  const s = $("fsel"),
    cur = s.value;
  s.textContent = "";
  for (const k in S.files) {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = k;
    s.appendChild(o);
  }
  if (S.files[cur]) s.value = cur;
  $("ftext").value = S.files[s.value];
  const names = d.layers === 2 ? ["F_Cu", "B_Cu"] : ["F_Cu", "In1_Cu", "In2_Cu", "B_Cu"];
  let rows = "<tr><th>Layer</th><th>Tracks</th><th>Pads</th><th>Clears</th><th>Max err</th></tr>";
  names.forEach((n, l) => {
    const c = compareGerber(d, l, S.files[n + ".gbr"]),
      w = d.tracks.filter((t) => t.l === l && !(d.layers === 4 && (l === 1 || l === 2))).length;
    rows +=
      "<tr><td>" +
      n +
      "</td><td>" +
      (c.missT + c.extraT ? "bad" : w) +
      "</td><td>" +
      (c.missF + c.extraF ? "bad" : "ok") +
      "</td><td>" +
      c.clears +
      "/" +
      c.wantClears +
      "</td><td>" +
      (c.maxe * 1e3).toFixed(2) +
      " um</td></tr>";
  });
  $("rt").innerHTML =
    '<p class="note">Read back by a parser that shares no code with the writer, then matched against the design:</p><table>' +
    rows +
    "</table>";
}
function buildTwin(k) {
  const key = "0|" + EXAMPLES[k];
  if (S.cache.has(key) || S.twinBusy) return;
  S.twinBusy = true;
  const g = buildGen(EXAMPLES[k]);
  const tick = () => {
    const t = performance.now();
    let r;
    for (;;) {
      r = g.next();
      if (r.done || performance.now() - t > 12) break;
    }
    if (r.done) {
      S.twinBusy = false;
      S.cache.set(key, r.value);
      if (S.d && S.d.arrayInfo) renderArray();
      return;
    }
    setTimeout(tick, 4);
  };
  setTimeout(tick, 200);
}
function renderArray() {
  const d = S.d,
    D = $("arrD");
  if (!d.arrayInfo) {
    D.hidden = true;
    return;
  }
  D.hidden = false;
  buildTwin(d.arrayInfo.shape === "honeycomb" ? "sunflower" : "honeycomb");
  const row = (k, t) => {
    const b = S.cache.get("0|" + EXAMPLES[k]);
    if (!b) return "<tr><td>" + k + '</td><td colspan="5">not built yet</td></tr>';
    const q = designStats(b);
    return (
      "<tr><td>" +
      k +
      "</td><td>" +
      b.arrayInfo.pitch.toFixed(2) +
      "</td><td>" +
      q.length.toFixed(0) +
      "</td><td>" +
      (q.longest - q.shortest).toFixed(1) +
      "</td><td>" +
      q.vias +
      "</td><td>" +
      b.routePasses +
      "</td></tr>"
    );
  };
  $("arr").innerHTML =
    "<table><tr><th>Layout</th><th>Pitch</th><th>Length</th><th>Skew</th><th>Vias</th><th>Passes</th></tr>" +
    row("honeycomb") +
    row("sunflower") +
    '</table><p class="note">37 chip sensors, same board, pitch floor and connector. Lengths in mm. Pitch is the smallest centre spacing. Earlier sampling toy, same pixel count, no lock: moire peak 0.255 for hexagon and 0.052 for sunflower; reconstruction error 0.0026 for hexagon and 0.0037 for sunflower.</p>';
}
