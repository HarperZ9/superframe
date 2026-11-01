// Registry by status. Each row: name, domains, the point where it breaks, and nine marks that are never added up.
const SC = { homology: "#7fd6a0", broken: "#ffc978", analogy: "#ff8f7a" };
const LABEL = { homology: "Homology: passed held out", broken: "Broken, with the point", analogy: "Analogy: failed or untested" };
function wrap(s, maxw, px) {
  g.font = `${px}px Hanken Grotesk, system-ui, sans-serif`;
  const lines = []; let line = "";
  for (const w of String(s).split(/\s+/)) { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxw && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}
function drawRegistry(w, h) {
  g.fillStyle = "#0a0c10"; g.fillRect(0, 0, w, h);
  const m = w * 0.02, gap = w * 0.012, px = h * 0.0165;
  const shows = REG.maps.filter((x) => x.family !== "planted_false");
  const cols = [["homology", 0.3], ["broken", 0.42], ["analogy", 0.28]];
  let x = m;
  for (const [s, fr] of cols) {
    const cw = (w - 2 * m - 2 * gap) * fr, rows = shows.filter((q) => q.status === s);
    g.fillStyle = SC[s]; g.fillRect(x, h * 0.04, cw, h * 0.005);
    txt(`${LABEL[s]}: ${rows.length}`, x, h * 0.035, px * 1.35, SC[s]);
    let y = h * 0.075;
    const dot = px * 0.38;
    for (const r of rows) {
      txt(r.title, x, y, px * 1.1, "#e8e6df");
      for (let i = 0; i < WORDS.length; i++) {
        const v = r.words[WORDS[i]], X = x + cw - (WORDS.length - i) * dot * 3 + dot, Y = y - px * 0.36;
        g.beginPath();
        if (v === false) { g.strokeStyle = "#ff8f7a"; g.lineWidth = dot * 0.5; g.moveTo(X - dot, Y - dot); g.lineTo(X + dot, Y + dot); g.moveTo(X + dot, Y - dot); g.lineTo(X - dot, Y + dot); g.stroke(); continue; }
        g.arc(X, Y, dot, 0, 7);
        if (v === true) { g.fillStyle = "#c6c8cf"; g.fill(); } else { g.strokeStyle = "#555b66"; g.lineWidth = dot * 0.3; g.stroke(); }
      }
      y += px * 1.25;
      const note = wrap(r.note, cw, px * 0.82);
      for (const l of note) { txt(l, x, y, px * 0.82, "#a3a5ac"); y += px * 1.03; }
      y += px * 0.9;
    }
    x += cw + gap;
  }
  txt("Dots, left to right: " + WORDS.map((q) => q.replace("_", " ")).join(", ") + ". Filled passed, crossed failed, ring not run. Never added up. Planted false maps not shown: both failed.", m, h * 0.98, px * 0.82, "#a3a5ac");
}
