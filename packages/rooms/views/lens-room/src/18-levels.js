// ======================================================================= Levels
const LV = { 0: ["#read", "#model"], 1: ["#read"], 2: [], 3: [] };
function plainWords() {
  if (S.kind == "train") {
    const t = last.train;
    if (!t) return "";
    return (
      TR.p.name +
      (t.efl
        ? ": gathers light and brings it to focus " +
          t.efl.toFixed(2) +
          " units behind its principal plane."
        : ": forms a magnified image of a nearby specimen.")
    );
  }
  if (S.kind == "world")
    return FIELDS[S.field].name + ": the room itself bends light, with no glass surface to cross.";
  const rs = last.rows || [];
  const a = (rs[0] || [])[1] || "";
  const nm = SH[S.shape] ? SH[S.shape][0] : "Formula";
  return nm + " (" + a + ").";
}
function applyLevel() {
  const L = +$("level").value;
  S.level = L;
  $("plain").textContent = L >= 1 ? plainWords() : "";
  $("read").parentElement.parentElement.hidden = L < 2;
  $("model").hidden = L < 3;
  if (L < 3 && last.rows && L == 2 && S.view != "walk") {
    const keep = last.rows.slice(0, 6);
    $("read").innerHTML = keep.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  }
  const eq = $("eqs");
  if (eq) {
    eq.hidden = L < 3;
    eq.textContent = equationText();
  }
}
function equationText() {
  if (S.kind == "train")
    return "Conic sag: z = c r²/(1+√(1-(1+k)c²r²)) + a4 r⁴ + a6 r⁶. Vector Snell at each surface. EFL = h / sin u′ from a near-axis ray.";
  if (S.kind == "world")
    return "Hamilton's ray equations: dp/dτ = v, dv/dτ = ½∇n², stepped in equal optical path.";
  return "Vector Snell at each surface, Fresnel by Schlick for sampling, Beer-Lambert in the medium. Two-lens formula: 1/f = 1/f₁ + 1/f₂ − d/(f₁f₂).";
}
