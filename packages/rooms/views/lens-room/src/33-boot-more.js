function bootMore() {
  const sn = $("scene");
  for (const k of ["patterns", "meta"])
    if (![...sn.options].some((o) => o.value == k)) {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = SCENES[k].name;
      sn.append(o);
    }
  sn.addEventListener("change", () => {
    S.meta = S.scene == "meta";
    S.frame = S.meta
      ? S.metaObs == "bee" || S.metaObs == "bird"
        ? 31
        : 30
      : S.frame >= 30
        ? 0
        : S.frame;
    if (S.scene == "patterns") turing();
    $("metaC").hidden = !S.meta;
    $("patC").hidden = S.scene != "patterns" && !S.lensTex;
    reset();
  });
  for (const [p, k, l, a, b, st, fm] of [
    ["scatS", "sig", "Density", 0, 40, 0.1, (v) => v.toFixed(1) + "/unit"],
    ["scatS", "hg", "Forward g", -0.9, 0.95, 0.01, (v) => v.toFixed(2)],
    ["scatS", "alb", "Albedo", 0, 1, 0.005, (v) => v.toFixed(2)],
    ["patS", "moA", "Grid angle", 0, 20, 0.05, (v) => v.toFixed(2) + "°"],
    ["patS", "moP", "Grid pitch", 0.03, 0.5, 0.005, (v) => v.toFixed(3)],
  ])
    addSlider(p, k, l, a, b, st, fm);
  const tf = (id, key, kind) => {
    $(id).addEventListener("change", () => {
      try {
        fParse($(id).value, ["x", "y", "z", "r"]);
        S[key] = $(id).value;
        $("scaterr").className = "note";
        $("scaterr").textContent = "";
        reset();
      } catch (e) {
        if (!(e instanceof FormulaError)) throw e;
        $("scaterr").className = "bad";
        $("scaterr").textContent = `Position ${e.at + 1}: ${e.message}`;
      }
    });
  };
  tf("fRho", "fRho");
  tf("fAbs", "fAbs");
  tf("fTr", "fTr");
  $("scatBtn").onclick = () => {
    S.scatOn = !S.scatOn;
    $("scatBtn").setAttribute("aria-pressed", S.scatOn ? "true" : "false");
    reset();
  };
  $("trBtn").onclick = () => {
    S.trOn = !S.trOn;
    $("trBtn").setAttribute("aria-pressed", S.trOn ? "true" : "false");
    reset();
  };
  for (const [id, key] of [
    ["metaIll", "illum"],
    ["metaOb", "metaObs"],
  ])
    $(id).onchange = () => {
      const v = $(id).value;
      if (key == "metaObs") {
        S.metaObs = v;
        S.metaD = ["protan", "deutan", "tritan"].indexOf(v) + 1;
        S.frame = v == "bee" || v == "bird" ? 31 : 30;
      } else S.illum = v;
      reset();
    };
  $("patK").onchange = () => {
    S.patK = +$("patK").value;
    if (S.patK == 3) turing();
    reset();
  };
  $("texBtn").onclick = () => {
    S.lensTex = !S.lensTex;
    $("texBtn").setAttribute("aria-pressed", S.lensTex ? "true" : "false");
    $("patC").hidden = false;
    turing();
    reset();
  };
}
