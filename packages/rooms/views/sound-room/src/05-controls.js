function pick(id, v) {
  [...$(id).children].forEach((b) =>
    b.setAttribute("aria-pressed", +b.dataset.v == v ? "true" : "false")
  );
  if (id == "vw") S.view = v;
  else S.srcType = v;
}
[...$("vw").children].forEach((b) => (b.onclick = () => pick("vw", +b.dataset.v)));
[...$("src").children].forEach(
  (b) =>
    (b.onclick = () => {
      pick("src", +b.dataset.v);
      if (+b.dataset.v == 1) clicks = step;
    })
);
sel.onchange = () => setRoom(sel.value);
$("moveMic").onclick = () => {
  moveMic = !moveMic;
  $("moveMic").setAttribute("aria-pressed", moveMic);
};
$("listen").onclick = () => {
  listening = !listening;
  $("listen").setAttribute("aria-pressed", listening);
  if (listening && !ac) {
    try {
      ac = new AudioContext();
    } catch (e) {
      console.error("audio unavailable", e);
      listening = false;
    }
  }
  if (ac) ac.resume().catch((e) => console.error("audio resume failed", e));
  nextT = 0;
};
cv.addEventListener("pointerdown", (e) => {
  const r = cv.getBoundingClientRect(),
    x = ((e.clientX - r.left) / r.width) * N,
    y = (1 - (e.clientY - r.top) / r.height) * N;
  if (e.shiftKey || moveMic) S.mic = [x, y];
  else {
    S.src = [x, y];
    if (S.srcType == 1) clicks = step;
  }
});
if (gl) {
  build();
  frame();
}
// Checks run from the console; each returns measured against expected.
window.__check = {
  async speed() {
    const o = [S.room, S.srcType, S.src, S.mic];
    setRoom("Open air");
    S.srcType = 1;
    clicks = 0;
    S.src = [150, 256];
    S.mic = [350, 256];
    clearF();
    advance(900);
    const a = hist.findIndex((v) => Math.abs(v) > 1e-4);
    const pk = hist.reduce((m, v, i) => (Math.abs(v) > Math.abs(hist[m]) ? i : m), 0);
    return { arrival_step: pk - 20, expected: 200 / CFL };
  },
  room() {
    setRoom("Rectangular room");
    S.srcType = 1;
    S.src = [60, 120];
    S.mic = [420, 360];
    clicks = 0;
    clearF();
    const out = [];
    advance(16384);
    const s = hist.slice(-16384),
      n = s.length;
    const fs = [];
    for (let f = 20; f < 1500; f += 2) {
      let a = 0,
        b = 0;
      const w = 2 * Math.PI * f * DT;
      for (let i = 0; i < n; i++) {
        const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
        a += s[i] * h * Math.cos(w * i);
        b += s[i] * h * Math.sin(w * i);
      }
      fs.push([f, Math.hypot(a, b)]);
    }
    const pk = [];
    for (let i = 1; i < fs.length - 1; i++)
      if (fs[i][1] > fs[i - 1][1] && fs[i][1] > fs[i + 1][1]) pk.push(fs[i]);
    pk.sort((a, b) => b[1] - a[1]);
    const Lx = 4.32,
      Ly = 3.0;
    const ex = [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 0],
      [2, 1],
      [0, 2],
    ].map(([m, q]) => [m, q, +((C0 / 2) * Math.hypot(m / Lx, q / Ly)).toFixed(1)]);
    return { peaks: pk.slice(0, 8).map((p) => p[0]), modes: ex };
  },
  set(o) {
    Object.assign(S, o);
    if (o.f != null) {
      const i = $("s_f");
      i.value = o.f;
      i.oninput();
    }
  },
  setRoom,
  pick,
  modes() {
    setRoom("Rectangular room");
    S.srcType = 1;
    S.src = [60, 120];
    S.mic = [420, 360];
    clicks = 0;
    clearF();
    advance(32768);
    const s = hist.slice(-32768),
      n = s.length,
      amp = (f) => {
        let a = 0,
          b = 0;
        const w = 2 * Math.PI * f * DT;
        for (let i = 0; i < n; i++) {
          const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
          a += s[i] * h * Math.cos(w * i);
          b += s[i] * h * Math.sin(w * i);
        }
        return Math.hypot(a, b);
      };
    const out = [];
    for (const [m, q] of [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 0],
      [2, 1],
      [0, 2],
    ]) {
      const e = (C0 / 2) * Math.hypot(m / 4.32, q / 3.0);
      let best = [0, 0];
      for (let f = e * 0.85; f <= e * 1.15; f += 0.5) {
        const v = amp(f);
        if (v > best[1]) best = [f, v];
      }
      out.push({ m, q, expected: +e.toFixed(1), measured: +best[0].toFixed(1) });
    }
    return { res_hz: +(1 / (n * DT)).toFixed(1), out };
  },
};
