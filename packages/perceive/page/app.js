// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* perceive page core: the view registry, the canvas, the sound engine, touch, and the loss panel.
   Each view supplies draw(), describe(), loss(), sound() and haptic(); this file wires them to the controls.
   Sound starts only from the Play button; vibration only when its box is ticked. */
(function () {
  "use strict";
  const P = window.Perceive, N = window.NDim, $ = (s) => document.querySelector(s);
  const PV = (window.PV = { P, N, views: {}, order: [], cur: null, $ });

  /* Colours from the kit's tokens, read again when the theme changes. */
  const hex = (s) => { s = s.trim().replace("#", ""); if (s.length === 3) s = s.split("").map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) || 0); };
  PV.tok = {};
  PV.readTokens = () => {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ["ink", "soft", "wall", "mat", "line", "red", "tide", "tide-2", "ember-1", "ember-2", "verified"]) PV.tok[k] = cs.getPropertyValue("--" + k).trim() || "#888";
    PV.tok.dark = PV.lum(hex(PV.tok.wall)) < 0.3;
  };
  PV.hex = hex;
  PV.lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  PV.rgb = (c) => "rgb(" + c.join(",") + ")";
  /* Diverging ramp for signed values in [-1, 1]: cool through the frame's ground to warm. */
  PV.diverge = (t) => {
    const cool = PV.tok.dark ? [120, 150, 240] : [40, 70, 150], warm = PV.tok.dark ? [240, 120, 100] : [170, 40, 30], mid = hex(PV.tok.mat);
    t = Math.max(-1, Math.min(1, t));
    return t < 0 ? mix(mid, cool, -t) : mix(mid, warm, t);
  };
  /* Sequential perceptual ramp (dark blue to yellow, lightness rising evenly, after cividis). A choice of
     ramp, not the colour hot things glow. */
  const SEQ = [[0, 34, 78], [52, 69, 108], [102, 105, 112], [149, 143, 120], [200, 184, 103], [253, 231, 55]];
  PV.seq = (t) => { t = Math.max(0, Math.min(1, t)) * (SEQ.length - 1); const i = Math.min(SEQ.length - 2, Math.floor(t)); return mix(SEQ[i], SEQ[i + 1], t - i); };

  /* Canvas sized to its box at device resolution; views draw in CSS pixels. */
  PV.canvas = (el, aspect) => {
    const w = el.clientWidth || 600, h = Math.round(w * aspect), d = Math.min(2, window.devicePixelRatio || 1);
    if (el.width !== Math.round(w * d) || el.height !== Math.round(h * d)) { el.width = Math.round(w * d); el.height = Math.round(h * d); el.style.height = h + "px"; }
    const ctx = el.getContext("2d");
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  };
  PV.text = (ctx, s, x, y, o = {}) => {
    ctx.font = (o.weight || 500) + " " + (o.size || 12) + "px " + (getComputedStyle(document.body).fontFamily || "sans-serif");
    ctx.fillStyle = o.color || PV.tok.ink; ctx.textAlign = o.align || "left"; ctx.textBaseline = o.base || "alphabetic";
    ctx.fillText(s, x, y);
  };
  PV.si = (x, unit) => {
    const pre = [[1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"], [1e-6, "µ"], [1e-9, "n"], [1e-12, "p"], [1e-15, "f"]];
    const a = Math.abs(x), p = pre.find(([v]) => a >= v * 0.9995) || pre[pre.length - 1];
    const v = x / p[0];
    return (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)) + " " + p[1] + unit;
  };

  /* Sound: additive partials or a looping buffer, through one quiet master gain. */
  const A = { ctx: null, on: false, master: null, osc: [], src: null };
  function stopNodes() {
    for (const o of A.osc) { try { o.osc.stop(); } catch (e) { /* already stopped */ } o.osc.disconnect(); o.g.disconnect(); o.p.disconnect(); }
    A.osc = [];
    if (A.src) { try { A.src.stop(); } catch (e) { /* already stopped */ } A.src.disconnect(); A.src = null; }
  }
  function applySound() {
    if (!A.on || !PV.cur) return;
    const spec = PV.cur.sound(), t = A.ctx.currentTime;
    if (spec.buffer) {
      stopNodes();
      const b = A.ctx.createBuffer(spec.buffer.length, spec.buffer[0].length, spec.rate);
      spec.buffer.forEach((ch, i) => b.copyToChannel(Float32Array.from(ch), i));
      A.src = A.ctx.createBufferSource(); A.src.buffer = b; A.src.loop = spec.loop !== false;
      A.src.connect(A.master); A.src.start();
      return;
    }
    if (A.src) stopNodes();
    const parts = (spec.partials || []).slice(0, 32);
    while (A.osc.length > parts.length) { const o = A.osc.pop(); o.osc.stop(); o.osc.disconnect(); o.g.disconnect(); o.p.disconnect(); }
    while (A.osc.length < parts.length) {
      const osc = A.ctx.createOscillator(), g = A.ctx.createGain(), p = A.ctx.createStereoPanner();
      g.gain.value = 0; osc.connect(g).connect(p).connect(A.master); osc.start();
      A.osc.push({ osc, g, p });
    }
    const total = parts.reduce((s, q) => s + q.g, 0) || 1;
    parts.forEach((q, i) => {
      const o = A.osc[i];
      o.osc.frequency.setTargetAtTime(Math.max(20, Math.min(20000, q.f)), t, 0.03);
      o.g.gain.setTargetAtTime((q.g / Math.max(1, total)) * 0.9, t, 0.05);
      o.p.pan.setTargetAtTime(Math.max(-1, Math.min(1, q.pan || 0)), t, 0.05);
    });
  }
  PV.play = (on) => {
    if (on && !A.ctx) { A.ctx = new (window.AudioContext || window.webkitAudioContext)(); A.master = A.ctx.createGain(); A.master.gain.value = 0.14; A.master.connect(A.ctx.destination); }
    A.on = on;
    if (on) { A.ctx.resume(); applySound(); } else stopNodes();
    const b = $("#play");
    b.setAttribute("aria-pressed", String(on));
    b.textContent = on ? "Stop sound" : "Play sound";
    soundText();
  };
  function soundText() { $("#sound-text").textContent = (A.on ? "Playing: " : "Sound is off. Press Play sound to hear: ") + PV.cur.sound(true).text; }

  /* Touch: one pattern per change, at most every 400 ms, only when asked for. */
  let lastBuzz = 0;
  function buzz() {
    if (!$("#buzz").checked || !navigator.vibrate) return;
    const now = performance.now();
    if (now - lastBuzz < 400) return;
    lastBuzz = now;
    navigator.vibrate(P.haptic(PV.cur.haptic()));
  }

  function lossPanel() {
    const v = PV.cur, b = P.BRIDGES.find((x) => x.id === v.bridge), l = v.loss();
    $("#lp-q").textContent = l.quantity || b.quantity + " (" + b.units + "); geometry: " + b.geometry + ".";
    $("#lp-map").textContent = l.map;
    $("#lp-keeps").textContent = l.keeps || b.keeps;
    $("#lp-loses").textContent = l.loses || b.loses;
    $("#lp-bits").textContent = l.bits;
    $("#lp-inv").textContent = l.inverse;
  }
  /* Redraw everything a view shows. Views call PV.update() after any change of their own controls. */
  PV.update = () => {
    if (!PV.cur) return;
    PV.cur.draw($("#cv"));
    $("#desc").textContent = PV.cur.describe();
    lossPanel();
    soundText();
    applySound();
    buzz();
  };
  PV.def = (v) => { PV.views[v.id] = v; PV.order.push(v.id); };

  function show(id) {
    PV.cur = PV.views[id];
    document.querySelectorAll("[data-view]").forEach((f) => { f.hidden = !f.dataset.view.split(" ").includes(id); });
    if (!PV.cur.ready) { PV.cur.init && PV.cur.init(); PV.cur.ready = true; }
    $("#cv").setAttribute("aria-label", PV.cur.label);
    PV.update();
    loop();
  }
  let raf = 0, last = 0;
  function loop() {
    cancelAnimationFrame(raf);
    const still = window.Kit && Kit.still();
    if (still || !PV.cur.tick) return;
    const step = (t) => {
      const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
      if (PV.cur.tick(dt)) { PV.cur.draw($("#cv")); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  PV.loop = loop;
  PV.still = () => !!(window.Kit && Kit.still());

  function pointer(e, kind) {
    if (!PV.cur.pointer) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (PV.cur.pointer(kind, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)) PV.update();
  }
  PV.init = () => {
    PV.readTokens();
    const cv = $("#cv");
    let down = false;
    cv.addEventListener("pointerdown", (e) => { down = true; cv.setPointerCapture(e.pointerId); pointer(e, "down"); });
    cv.addEventListener("pointermove", (e) => { if (down) pointer(e, "move"); });
    cv.addEventListener("pointerup", (e) => { down = false; pointer(e, "up"); });
    $("#pick").addEventListener("change", (e) => show(e.target.value));
    $("#play").addEventListener("click", () => PV.play(!A.on));
    $("#buzz").addEventListener("change", buzz);
    $("#buzz").disabled = !navigator.vibrate;
    if (!navigator.vibrate) $("#buzz-note").textContent = "This device has no vibration motor the page can reach.";
    if (window.Kit) Kit.on(() => { PV.readTokens(); PV.update(); loop(); });
    addEventListener("resize", () => PV.update());
    show($("#pick").value);
  };
})();
