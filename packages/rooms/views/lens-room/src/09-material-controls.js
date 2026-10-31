function applyMat(k) {
  const m = MAT[k];
  S.matK = k;
  $("matnote").textContent = m.src ? "Values: " + m.src + "." : "";
  $("mirsel").hidden = true;
  if (m.film) {
    S.mat = 2;
    $("glass").setAttribute("aria-pressed", "false");
    S.bire = false;
    reset();
    return;
  }
  if (S.mat == 2) S.mat = 0;
  $("glass").setAttribute("aria-pressed", S.mat == 0 ? "true" : "false");
  S.bire = !!m.bire;
  S.dne = m.dne || 0;
  if (m.nd) {
    setS("n", m.nd);
    setS("disp", dispOf(m.nd, m.V));
    S.matAlpha = m.alpha || [0, 0, 0];
    S.absA = S.matAlpha.map((a) => a * S.absScale);
  } else {
    S.matAlpha = [0, 0, 0];
    S.absA = [0, 0, 0];
  }
  reset();
}
