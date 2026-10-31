// ======================================================================= Main loop
function loop() {
  requestAnimationFrame(loop);
  if (!S.d || $("gl").hidden) return;
  if (S.playing && S.tl && S.view === "board") {
    S.playf = S.playf || 0;
    const f = clamp(S.tl.t / S.tTot + 1 / (60 * 6), 0, 1);
    stepSignal(f);
    colorSignal();
    drawScope();
    const i = $("tsc");
    if (i) {
      i.value = f;
      i.nextElementSibling.textContent = fmt(S.tl.t, "s");
    }
    if (f >= 1) S.playing = false;
  }
  if (S.samples < S.maxS && S.vao) {
    const t = performance.now();
    drawSample(S);
    S.ft = performance.now() - t;
    if (S.samples === 1) placeLabelsSoon();
    if (S.samples % 12 === 1 || S.samples === S.maxS)
      $("sps").textContent = S.samples + " of " + S.maxS + " samples";
  }
}
function start() {
  try {
    initGL();
  } catch (e) {
    const b = $("err");
    b.hidden = false;
    b.textContent = e.message;
    console.error(e);
    return;
  }
  setupTargets();
  bindInput();
  $("net").value = EXAMPLES.tia;
  markModes();
  $("plain").textContent = PLAIN.board;
  requestAnimationFrame(loop);
  window.__S = S;
  generate().then(() => setTimeout(runChecksUI, 800));
}
start();
