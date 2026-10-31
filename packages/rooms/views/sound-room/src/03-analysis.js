function spectrum() {
  const n = 4096;
  if (hist.length < n) return null;
  const s = hist.slice(-n);
  const fq = [];
  let best = [0, 0];
  for (let f = 100; f <= 8000; f += 25) {
    let a = 0,
      b = 0;
    const w = 2 * Math.PI * f * DT;
    for (let i = 0; i < n; i++) {
      const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
      a += s[i] * h * Math.cos(w * i);
      b += s[i] * h * Math.sin(w * i);
    }
    const m = Math.hypot(a, b);
    fq.push(m);
    if (m > best[1]) best = [f, m];
  }
  return { fq, peak: best[0] };
}
function scopes(sp) {
  const w = $("wave").getContext("2d"),
    W = 560,
    Hh = 140;
  w.fillStyle = "#000";
  w.fillRect(0, 0, W, Hh);
  w.strokeStyle = "#7fe8b0";
  w.beginPath();
  const n = Math.min(hist.length, 1400);
  let mx = 1e-6;
  for (let i = hist.length - n; i < hist.length; i++) mx = Math.max(mx, Math.abs(hist[i]));
  for (let i = 0; i < n; i++) {
    const v = hist[hist.length - n + i] / mx;
    const x = (i / 1400) * W,
      y = 70 - v * 62;
    i ? w.lineTo(x, y) : w.moveTo(x, y);
  }
  w.stroke();
  const q = $("spec").getContext("2d");
  q.fillStyle = "#000";
  q.fillRect(0, 0, W, Hh);
  if (sp) {
    const m = Math.max(...sp.fq, 1e-9);
    q.fillStyle = "#ffc978";
    sp.fq.forEach((v, i) => {
      const h = (v / m) * 130;
      q.fillRect((i / sp.fq.length) * W, Hh - h, Math.max(1, W / sp.fq.length), h);
    });
  }
}
function read(sp) {
  let r = 0;
  const n = Math.min(hist.length, 2048);
  for (let i = hist.length - n; i < hist.length; i++) r += hist[i] ** 2;
  r = Math.sqrt(r / Math.max(n, 1));
  const l = (C0 * S.speed) / S.f;
  const rows = [
    ["Wavelength", (l * 100).toFixed(1) + " cm"],
    ["Cells per wave", (l / DX).toFixed(1)],
    ["Mic level", r.toExponential(2)],
    ["Mic peak", sp ? sp.peak + " Hz" : "listening"],
    ["Sim time", (step * DT * 1000).toFixed(1) + " ms"],
    ["Space", `${(N * DX).toFixed(2)} m square`],
  ];
  const br = rooms[S.room].bragg;
  if (br) rows.push(["Gap centre", ((C0 * S.speed) / (2 * br * DX)).toFixed(0) + " Hz"]);
  if (l / DX < 8) rows.push(["Grid error", "waves run slow, under 8 cells"]);
  $("read").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
}
function audio() {
  if (!listening || !ac) return;
  const fs = Math.max(3000, stepsFrame * 60);
  audioQ = audioQ.concat(hist.slice(-stepsFrame));
  if (audioQ.length < 1024) return;
  const b = ac.createBuffer(1, audioQ.length, fs),
    d = b.getChannelData(0);
  let mx = 1e-6;
  for (const v of audioQ) mx = Math.max(mx, Math.abs(v));
  for (let i = 0; i < audioQ.length; i++) d[i] = (audioQ[i] / mx) * 0.5;
  const s = ac.createBufferSource();
  s.buffer = b;
  s.connect(ac.destination);
  const t = Math.max(ac.currentTime + 0.02, nextT);
  s.start(t);
  nextT = t + b.duration;
  audioQ = [];
}
