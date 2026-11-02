function bootWalk() {
  $("inner").onchange = () => {
    S.inner = $("inner").value || null;
    VOX = null;
    reset();
  };
  $("iLamp").onclick = () => {
    S.iLamp = !S.iLamp;
    $("iLamp").setAttribute("aria-pressed", S.iLamp ? "true" : "false");
    reset();
  };
  $("walkBtn").onclick = () => setView("walk");
  S.wscale = 0.1;
  const r = addSlider("inS", "wlog", "Scale", -3, 1, 0.01, (v) => UNITS(Math.pow(10, v)));
  S.wlog = -1;
  $("s_wlog").value = -1;
  r._up();
  $("s_wlog").addEventListener("input", () => {
    S.wscale = Math.pow(10, S.wlog);
    reset();
  });
  $("chkBtn").onclick = () => {
    const c = insideChecks();
    $("read").innerHTML = c.rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    $("model").hidden = false;
    $("model").textContent = "Known answers, from the same trace as the picture.";
  };
  const map = {
    KeyW: "f",
    ArrowUp: "f",
    KeyS: "b",
    ArrowDown: "b",
    KeyA: "l",
    ArrowLeft: "l",
    KeyD: "r",
    ArrowRight: "r",
    KeyQ: "dn",
    KeyE: "up",
  };
  document.addEventListener("keydown", (e) => {
    if (S.view != "walk" || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = map[e.code];
    if (k) {
      held[k] = 1;
      e.preventDefault();
    }
  });
  document.addEventListener("keyup", (e) => {
    const k = map[e.code];
    if (k) delete held[k];
  });
  window.addEventListener("blur", () => {
    for (const k in held) delete held[k];
  });
  document.querySelectorAll("#pad button").forEach((b) => {
    const k = b.dataset.k;
    b.addEventListener("pointerdown", (e) => {
      held[k] = 1;
      b.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    for (const ev of ["pointerup", "pointercancel"]) b.addEventListener(ev, () => delete held[k]);
  });
  let t0 = performance.now();
  const tick = (now) => {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    if (S.view != "walk" || !S.wk || document.hidden) return;
    const R = mul(ry(S.yaw), rx(S.pitch)),
      fw = [R[6], R[7], R[8]],
      rt = [R[0], R[1], R[2]];
    let m = [0, 0, 0];
    const add = (v, s) => {
      m = m.map((a, i) => a + v[i] * s);
    };
    if (held.f) add(fw, 1);
    if (held.b) add(fw, -1);
    if (held.r) add(rt, 1);
    if (held.l) add(rt, -1);
    if (held.up) m[1] += 1;
    if (held.dn) m[1] -= 1;
    const L = Math.hypot(...m);
    if (!L) return;
    const sp = (0.45 * dt) / L;
    walkStep(m[0] * sp, m[1] * sp, m[2] * sp);
  };
  requestAnimationFrame(tick);
}
