// ======================================================================= Interaction
function bindInput() {
  const G = $("gl");
  let pts = new Map(),
    moved = 0,
    pd0 = 0;
  G.addEventListener("pointerdown", (e) => {
    G.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    moved = 0;
    pd0 = 0;
  });
  G.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    const o = pts.get(e.pointerId),
      dx = e.clientX - o[0],
      dy = e.clientY - o[1];
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    moved += Math.abs(dx) + Math.abs(dy);
    const c = S.cam;
    if (pts.size >= 2) {
      const a = [...pts.values()],
        q = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]);
      if (pd0) c.dist = clamp((c.dist * pd0) / q, 1, 800);
      pd0 = q;
    } else if (e.shiftKey || e.buttons === 2 || e.buttons === 4) {
      const k = (c.dist / G.clientHeight) * 0.55,
        sa = Math.sin(c.az),
        ca = Math.cos(c.az);
      c.tx -= (dx * ca + dy * sa * Math.sin(c.el)) * k;
      c.ty -= (dx * sa - dy * ca * Math.sin(c.el)) * k;
    } else {
      c.az -= dx * 0.006;
      c.el = clamp(c.el + dy * 0.006, -1.5, 1.5);
    }
    S.focus = S.focusSet ? S.focus : c.dist;
    resetAcc();
    placeLabelsSoon();
  });
  G.addEventListener("pointerup", (e) => {
    pts.delete(e.pointerId);
    if (moved < 4 && S.VP) pickFocus(e);
  });
  G.addEventListener("pointercancel", (e) => pts.delete(e.pointerId));
  G.addEventListener("contextmenu", (e) => e.preventDefault());
  G.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      S.cam.dist = clamp(S.cam.dist * Math.exp(e.deltaY * 0.001), 1, 800);
      if (!S.focusSet) S.focus = S.cam.dist;
      resetAcc();
      placeLabelsSoon();
    },
    { passive: false }
  );
  G.addEventListener("keydown", (e) => {
    const c = S.cam,
      m = {
        ArrowLeft: [0.08, 0],
        ArrowRight: [-0.08, 0],
        ArrowUp: [0, 0.06],
        ArrowDown: [0, -0.06],
      }[e.key];
    if (!m) return;
    e.preventDefault();
    c.az += m[0];
    c.el = clamp(c.el + m[1], -1.5, 1.5);
    resetAcc();
    placeLabelsSoon();
  });
  const O = $("over");
  let op = null,
    ppts = new Map(),
    opd = 0;
  O.addEventListener("pointerdown", (e) => {
    O.setPointerCapture(e.pointerId);
    ppts.set(e.pointerId, [e.clientX, e.clientY]);
    op = [e.clientX, e.clientY];
    opd = 0;
  });
  O.addEventListener("pointermove", (e) => {
    if (!ppts.has(e.pointerId)) return;
    const dpr = Math.min(devicePixelRatio || 1, 2),
      v = S.view2;
    ppts.set(e.pointerId, [e.clientX, e.clientY]);
    if (ppts.size >= 2) {
      const a = [...ppts.values()],
        q = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]);
      if (opd) {
        const k = q / opd,
          mx = ((a[0][0] + a[1][0]) / 2) * dpr,
          my = ((a[0][1] + a[1][1]) / 2) * dpr;
        v.x = mx - (mx - v.x) * k;
        v.y = my - (my - v.y) * k;
        v.s *= k;
      }
      opd = q;
    } else {
      v.x += (e.clientX - op[0]) * dpr;
      v.y += (e.clientY - op[1]) * dpr;
      op = [e.clientX, e.clientY];
    }
    draw2D();
  });
  O.addEventListener("pointerup", (e) => ppts.delete(e.pointerId));
  O.addEventListener("pointercancel", (e) => ppts.delete(e.pointerId));
  O.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const r = O.getBoundingClientRect(),
        dpr = Math.min(devicePixelRatio || 1, 2),
        mx = (e.clientX - r.left) * dpr,
        my = (e.clientY - r.top) * dpr,
        v = S.view2,
        k = Math.exp(-e.deltaY * 0.0015);
      v.x = mx - (mx - v.x) * k;
      v.y = my - (my - v.y) * k;
      v.s *= k;
      draw2D();
    },
    { passive: false }
  );
  addEventListener("resize", () => {
    if (setupTargets()) resetAcc();
    if (!$("over").hidden) {
      fit2D();
      draw2D();
    }
    placeLabelsSoon();
  });
  $("hide").onclick = () => {
    const f = $("app").classList.toggle("full");
    $("hide").setAttribute("aria-pressed", f);
    setTimeout(() => dispatchEvent(new Event("resize")), 30);
  };
  const T = $("tabs");
  for (const [k, n] of VIEWS) {
    const b = document.createElement("button");
    b.textContent = n;
    b.dataset.v = k;
    b.onclick = () => setView(k);
    T.appendChild(b);
  }
  const Mo = $("modes");
  for (const [k, n] of MODES) {
    const b = document.createElement("button");
    b.textContent = n;
    b.dataset.m = k || "";
    b.onclick = () => {
      S.over = k;
      if (S.view !== "board" && k) setView("board");
      markModes();
      if (S.d) fillNets();
      updateOverlay();
    };
    Mo.appendChild(b);
  }
  $("ex").onchange = () => {
    S.ex = $("ex").value;
    $("net").value = EXAMPLES[S.ex];
    S.force = 0;
    generate();
  };
  $("go").onclick = generate;
  $("l2").onclick = () => {
    S.force = 2;
    generate();
  };
  $("l4").onclick = () => {
    S.force = 4;
    generate();
  };
  $("maskc").onchange = () => {
    S.mask = $("maskc").value;
    resetAcc();
  };
  $("nsel").onchange = () => {
    S.net = +$("nsel").value;
    S.Iset = 0;
    if (S.view === "field") draw2D();
    updateOverlay();
  };
  $("fsel").onchange = () => {
    $("ftext").value = S.files[$("fsel").value];
  };
  $("copy").onclick = async () => {
    const t = $("ftext");
    t.focus();
    t.select();
    let ok = false;
    try {
      await navigator.clipboard.writeText(t.value);
      ok = true;
    } catch (err) {
      try {
        ok = document.execCommand("copy");
      } catch (e2) {
        console.warn("copy failed", e2);
      }
    }
    $("copy").textContent = ok ? "Copied" : "Copy blocked, select the text by hand";
    setTimeout(() => ($("copy").textContent = "Copy this file"), 1800);
  };
  $("plant").onclick = () => {
    const d = S.d,
      P = plantViolations(d),
      p = P[S.plantI++ % P.length],
      v = drc(p.d);
    v.head =
      "Planted on a copy: " +
      p.name +
      ". Expected rule: " +
      p.rule +
      ". " +
      (v.some((q) => q.rule === p.rule) ? "Caught." : "MISSED.");
    renderDRC(v);
  };
  $("runchk").onclick = runChecksUI;
  const ss = $("secS");
  slider(
    ss,
    "cut",
    "Cut at y",
    0,
    100,
    0.2,
    50,
    (x) => {
      S.cutY = (x / 100) * S.d.H;
      S.fs = null;
      if (S.view === "section") {
        rebuild();
        S.cam.ty = S.cutY - S.d.H / 2;
      }
      if (S.view === "field") draw2D();
    },
    (x) => (S.d ? ((x / 100) * S.d.H).toFixed(1) + " mm" : "")
  );
  slider(
    ss,
    "zs",
    "Thickness x",
    1,
    12,
    1,
    S.zs,
    (x) => {
      S.zs = x;
      if (S.view === "section") rebuild();
    },
    (x) => x + " times"
  );
  slider(
    ss,
    "gap",
    "Exploded gap",
    0.8,
    8,
    0.2,
    S.gap,
    (x) => {
      S.gap = x;
      if (S.view === "exploded") rebuild();
    },
    (x) => x.toFixed(1) + " mm"
  );
  const lb = document.createElement("div");
  lb.className = "btns";
  lb.setAttribute("aria-label", "Blueprint layers");
  [0, 1, 2, 3].forEach((i) => {
    const b = document.createElement("button");
    b.textContent = "L" + (i + 1);
    b.setAttribute("aria-pressed", "true");
    b.onclick = () => {
      S.blueL = S.blueL || [true, true, true, true];
      S.blueL[i] = !S.blueL[i];
      b.setAttribute("aria-pressed", S.blueL[i]);
      if (S.view === "blue") draw2D();
    };
    lb.appendChild(b);
  });
  ss.appendChild(lb);
  const cs = $("camS");
  slider(
    cs,
    "ap",
    "Aperture",
    0,
    1.2,
    0.02,
    S.aper,
    (x) => {
      S.aper = x;
      resetAcc();
    },
    (x) => (x ? x.toFixed(2) + " mm" : "pinhole")
  );
}