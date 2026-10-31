let ovT = 0;
function updateOverlayDebounced() {
  clearTimeout(ovT);
  ovT = setTimeout(() => {
    const a = document.activeElement && document.activeElement.id;
    updateOverlay();
    if (a && $(a)) $(a).focus();
  }, 120);
}
function renderRead() {
  const d = S.d;
  if (!d) return;
  const st = designStats(d),
    rows = [
      ["Board", d.W + " x " + d.H + " mm, " + d.layers + " layers"],
      ["Parts", String(d.parts.length)],
      ["Nets", String(d.nets.length)],
      ["Tracks", st.tracks + ", " + st.length.toFixed(0) + " mm"],
      ["Vias", String(st.vias)],
      ["Router", d.routePasses + " passes, " + d.routeMs + " ms"],
      ["Open nets", String(d.routeFail.length)],
      ["Rule violations", String(d.drc.length)],
      ["Shader compile", GLS.compileMs.toFixed(0) + " ms"],
    ].concat(S.mread || []);
  $("read").innerHTML = rows.map((r) => "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>").join("");
}
