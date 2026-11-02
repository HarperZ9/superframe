function bootExtras() {
  // Scene list: forest, water, night, cell, cave, city, chart, grove.
  {
    const sel = $("scene");
    for (const k of Object.keys(SCENES)) {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = SCENES[k].name;
      sel.append(o);
    }
    sel.value = S.scene;
    sel.onchange = () => {
      S.scene = sel.value;
      reset();
    };
  }
  {
    const sel = $("matsel");
    for (const k in MAT) {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = MAT[k].name;
      sel.append(o);
    }
    sel.onchange = () => applyMat(sel.value);
  }
  {
    const sel = $("mirsel");
    for (const k in MIR) {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = MIR[k].name;
      sel.append(o);
    }
    sel.onchange = () => {
      const m = MIR[sel.value];
      S.mirT = m.t;
      S.mirR = m.r;
      S.mirL = m.l;
      reset();
    };
  }
  $("mirror").addEventListener("click", () => {
    $("mirsel").hidden = false;
    $("matD").open = true;
  });
  $("glass").addEventListener("click", () => {
    $("mirsel").hidden = true;
    S.mirT = S.mirR = S.mirL = 0;
    $("mirsel").value = "silver";
  });
  for (const [p, k, l, a, b, st, fm] of [
    ["matS", "absScale", "Depth tint", 0, 50, 0.1, (v) => v.toFixed(1) + "×"],
    ["liqS", "omega", "Spin", 0.5, 6, 0.01, (v) => v.toFixed(2) + " rad/s"],
    ["liqS", "volt", "Voltage", 0, 80, 0.5, (v) => v.toFixed(0) + " V"],
    ["liqS", "bond", "Sag, Bond", 0, 0.8, 0.01, (v) => v.toFixed(2)],
    ["polS", "polPa", "Before angle", 0, 180, 1, (v) => v + "°"],
    ["polS", "polAa", "After angle", 0, 180, 1, (v) => v + "°"],
    ["polS", "stress", "Stress", 0, 0.003, 0.00002, (v) => (v * 1e3).toFixed(2) + "e-3"],
    ["morS", "morph", "Blend", 0, 1, 0.002, (v) => v.toFixed(2)],
    ["cmpS", "split", "Divider", 0.05, 0.95, 0.005, (v) => v.toFixed(2)],
    ["waveS", "waveL", "Wavelength", 400, 700, 1, (v) => v + " nm"],
    ["waveS", "stopD", "Stop D", 0.2, 2.4, 0.01, (v) => v.toFixed(2)],
    ["waveS", "waveZ", "Distance z", 0.5, 60, 0.01, (v) => v.toFixed(2)],
    ["waveS", "waveU", "Unit", 2, 200, 1, (v) => v + " µm"],
    ["frameS", "nGain", "Gain", 0, 3, 0.01, (v) => v.toFixed(2)],
    ["frameS", "nRange", "Range", 1.5, 6, 0.01, (v) => v.toFixed(2)],
    ["frameS", "nAnis", "Stretch", 0, 1.5, 0.01, (v) => v.toFixed(2)],
    ["frameS", "nAxis", "Axis", 0, 180, 1, (v) => v + "°"],
    ["frameS", "nMix", "Mix", 0, 1, 0.01, (v) => v.toFixed(2)],
    ["frameS", "tofT", "Arrival", 0, 30, 0.02, (v) => v.toFixed(1)],
  ])
    addSlider(p, k, l, a, b, st, fm);
  $("s_absScale").addEventListener("input", () => {
    if (S.matAlpha) S.absA = S.matAlpha.map((a) => a * S.absScale);
    reset();
  });
  const eye = document.createElement("div");
  eye.id = "eyeS";
  $("cam").append(eye);
  S.pupil = 3;
  S.acc = 0.1;
  addSlider("eyeS", "pupil", "Eye pupil", 1, 8, 0.1, (v) => v.toFixed(1) + " mm");
  addSlider("eyeS", "acc", "Accommodate", 0.05, 3.3, 0.01, (v) => v.toFixed(2) + " D");
  $("s_pupil").addEventListener("input", () => setS("ap", S.pupil * 0.5 * 0.012));
  $("s_acc").addEventListener("input", () => setS("focus", Math.min(20, 1 / S.acc)));
  {
    const f = $("frame");
    for (const q of FRAMES) {
      const o = document.createElement("option");
      o.value = q.id;
      o.textContent = q.name;
      f.append(o);
    }
    const up = () => {
      S.frame = +f.value;
      const q = frameOf(S);
      $("framenote").textContent = q.note;
      for (const k of ["nGain", "nRange", "nAnis", "nAxis", "nMix"])
        $("r_" + k).hidden = S.frame != 20;
      $("r_tofT").hidden = S.frame != 15;
      const nr = $("nrmsWrap");
      if (nr) nr.hidden = S.frame != 20;
      reset();
    };
    f.onchange = up;
    const w = document.createElement("p");
    w.id = "nrmsWrap";
    w.className = "note";
    w.innerHTML = 'Sheet activity RMS: <span id="nrms">0</span>';
    $("frameS").append(w);
    up();
    $("s_tofT").addEventListener("input", () => {
      S.tofHold = true;
    });
  }
  {
    const f = $("morphB");
    fillShapes(f, [30, 31, 32, 33, "F", 50, 51, 52]);
    f.value = S.shapeM;
    f.onchange = () => {
      const v = f.value;
      S.shapeM = v == "none" ? v : +v;
      reset();
    };
  }
  $("morphOn").onclick = () => {
    S.morphOn = !S.morphOn;
    $("morphOn").setAttribute("aria-pressed", S.morphOn ? "true" : "false");
    reset();
  };
  // Breathing: requested only, off under reduced motion, pauses when hidden.
  let br = false,
    t0 = 0;
  $("breathe").onclick = () => {
    br = !br;
    $("breathe").setAttribute("aria-pressed", br ? "true" : "false");
    if (br && !S.morphOn) $("morphOn").click();
    if (br) {
      const tick = (now) => {
        if (!br) return;
        requestAnimationFrame(tick);
        if (document.hidden || rm.matches) return;
        setS("morph", 0.5 - 0.5 * Math.cos(now * 0.0007));
      };
      requestAnimationFrame(tick);
    }
  };
  if (rm.matches) $("breathe").title = "Reduced motion is on: use the Blend slider.";
  const pick1 = (b, on) => b.setAttribute("aria-pressed", on ? "true" : "false");
  $("polP").onclick = () => {
    S.polP = S.polP ? 0 : 1;
    pick1($("polP"), S.polP);
    reset();
  };
  $("polA").onclick = () => {
    S.polA = S.polA ? 0 : 1;
    pick1($("polA"), S.polA);
    reset();
  };
  $("polX").onclick = () => {
    S.polP = 1;
    S.polA = 1;
    pick1($("polP"), 1);
    pick1($("polA"), 1);
    setS("polPa", 0);
    setS("polAa", 90);
  };
  $("ptBtn").onclick = () => {
    S.pt = !S.pt;
    pick1($("ptBtn"), S.pt);
    reset();
  };
  $("imgbtn").onclick = () => $("file").click();
  $("file").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const bm = await createImageBitmap(f);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, imgT);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bm);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.activeTexture(gl.TEXTURE0);
      hasImg = 1;
      S.scene = "chart";
      $("scene").value = "chart";
      reset();
    } catch (err) {
      console.error("image load failed", err);
      fail("That image could not be read. Try a JPEG or PNG.");
    }
  };
  $("afBtn").onclick = () => autofocus();
  $("clickF").onclick = () => {
    S.clickF = !S.clickF;
    pick1($("clickF"), S.clickF);
  };
  cv.addEventListener("click", (e) => {
    if (!S.clickF) return;
    const r = cv.getBoundingClientRect();
    autofocus((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
  });
  document.querySelectorAll("[data-frm]").forEach(
    (b) =>
      (b.onclick = () => {
        const f = b.dataset.frm;
        const P = {
          front: [0, 0.06, 5, 1.3],
          close: [0, 0.02, 2.6, 1.6],
          three: [0.65, 0.25, 5.2, 1.3],
          top: [0, 1.05, 5.5, 1.2],
        }[f];
        S.yaw = P[0];
        S.pitch = P[1];
        setS("dist", P[2]);
        setS("zoom", P[3]);
      })
  );
  $("cmpBtn").onclick = () => {
    if (S.compare) {
      S.compare = null;
      pick1($("cmpBtn"), 0);
      $("cmpBtn").textContent = "Hold these settings on the left";
    } else {
      S.compare = JSON.parse(JSON.stringify(S));
      S.compare.compare = null;
      pick1($("cmpBtn"), 1);
      $("cmpBtn").textContent = "Release the held settings";
    }
    reset();
  };
  // Capture only where a download can work: a sandboxed frame blocks it, so the button goes away there.
  const framed = window.self !== window.top;
  $("saveBtn").hidden = framed;
  $("saveBtn").onclick = () =>
    cv.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = "lens-room.png";
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/png");
  $("qsel").onchange = () => {
    qMax = +$("qsel").value;
    if (Q > qMax) Q = qMax;
    reset();
  };
  // Immersion: full window with pointer look when the browser grants it; Escape returns.
  $("immerse").onclick = async () => {
    $("app").classList.add("full");
    try {
      await $("view").requestFullscreen();
    } catch (err) {
      console.warn("fullscreen refused", err);
    }
    try {
      await cv.requestPointerLock();
    } catch (err) {
      console.warn("pointer lock refused", err);
    }
    reset();
  };
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      $("app").classList.remove("full");
      reset();
    }
  });
  document.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement !== cv) return;
    S.yaw += e.movementX * 0.003;
    S.pitch = Math.max(-1.4, Math.min(1.4, S.pitch + e.movementY * 0.003));
    reset();
  });
  $("wIdeal").onclick = () => {
    S.waveIdeal = !S.waveIdeal;
    pick1($("wIdeal"), S.waveIdeal);
    reset();
  };
  $("wAiry").onclick = () => {
    setKind("lens");
    setShape("none");
    setTwo(0);
    setS("stopD", 2);
    setS("waveL", 550);
    setS("waveU", 20);
    setS("waveZ", 10);
    S.waveIdeal = true;
    pick1($("wIdeal"), 1);
    setView("wave");
  };
  $("wDonut").onclick = () => {
    setKind("lens");
    setShape(26);
    setTwo(0);
    setS("n", 1.5);
    setS("stopD", 2);
    setS("waveL", 550);
    setS("waveU", 20);
    setS("waveZ", 10);
    setS("curve", (4 * 0.55) / 20);
    S.waveIdeal = true;
    pick1($("wIdeal"), 1);
    setView("wave");
  };
  $("level").onchange = () => applyLevel();
  const eq = document.createElement("p");
  eq.id = "eqs";
  eq.className = "note";
  $("model").after(eq);
  // Hall of mirrors: two facing flats, with a marker where you stand.
  const hb = document.createElement("button");
  hb.textContent = "Hall of two mirrors";
  hb.onclick = () => {
    setTwo(1);
    setShape(66);
    setShape(66, 1);
    S.mat = 1;
    pick1($("mirror"), 1);
    pick1($("glass"), 0);
    setS("size", 1.8);
    setS("size2", 1.8);
    setS("sp", 4);
    S.oz = -2;
    setS("dist", 0.8);
    setS("zoom", 1.2);
    S.bounce = 40;
    S.selfMark = true;
    S.yaw = 0.04;
    S.pitch = 0.03;
    reset();
  };
  $("pAch").after(hb);
  const lb = document.createElement("button");
  lb.textContent = "Plain single lens";
  lb.onclick = () => {
    setTwo(0);
    S.bounce = 0;
    S.selfMark = false;
    S.oz = 0;
    setS("dist", 5);
  };
  $("pAch").after(lb);
  // Liquid and film defaults.
  $("shape").addEventListener("change", () => {
    if (S.shape === 52) {
      S.mat = 1;
      pick1($("mirror"), 1);
      pick1($("glass"), 0);
      setS("curve", 1);
      S.pitch = 0.06;
    }
    if (S.shape >= 60 && S.shape <= 66) {
      S.mat = 1;
      pick1($("mirror"), 1);
      pick1($("glass"), 0);
      $("mirsel").hidden = false;
    }
    liqVis();
  });
  const liqVis = () => {
    $("r_omega").hidden = S.shape !== 52;
    $("r_volt").hidden = S.shape !== 51;
    $("r_bond").hidden = S.shape !== 50;
    $("liqD").open = S.shape === 50 || S.shape === 51 || S.shape === 52;
  };
  liqVis();
  window.__liqVis = liqVis;
}
