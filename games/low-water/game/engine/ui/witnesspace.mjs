// The witness scene in the talk panel (design/spine-plan/02-WITNESS.md section 4; world/witness.mjs is the
// mechanic). While a witness is open the panel does not take a beat's lines all at once: it holds them and lets
// them in a line at a time, each after the last has had its reading time (0.6 s plus 0.25 s a word, the gate's
// own rule), and the first line of every witness beat only when G.witness.gate.next() says so. The options, the "Go on"
// and the end of the story wait until every held line is in and gate.close() agrees, so the scene cannot be
// skipped or closed early, and walking off cannot end it. Under "Pace of scenes: stepped" each node waits for a
// press of "Go on", which itself waits out the reading time. Pausing is always allowed (Esc is not taken).
//   const W = witnessPace(ctx, P, api)
//   W.take(lines) -> the lines to show now (the rest are held)   W.held() -> true while anything waits
//   W.engaged() -> true from witness.open until the last line is in   W.foot() -> the footer while held
import { h, btn } from "./dom.mjs";

const words = (ls) => ls.reduce((n, l) => n + String(l.text || "").split(/\s+/).filter(Boolean).length, 0);
export const readMs = (ls) => 600 + 250 * words(ls);

// lines into runs of the same node, in order (a line carries the node that said it, dialogue/runner.mjs)
export function groupByNode(lines) {
  const out = [];
  for (const l of lines) { const g = out[out.length - 1]; if (g && g.node === (l.node || null)) g.lines.push(l); else out.push({ node: l.node || null, lines: [l] }); }
  return out;
}

export function witnessPace(ctx, P, api, { now = () => Date.now(), every = 200 } = {}) {
  const G = ctx.G, S = () => G.state.witness;
  let queue = [], nextAt = 0, engaged = false, timer = null;
  const stepped = () => (G.state.runMode || "full") === "stepped";
  // the witness's own lines (said in its place) are paced; anything said elsewhere in the same beat (the scene
  // that led to it) shows at once
  const W0 = () => { const X = S(); return X && G.witness && G.witness.records ? G.witness.records[X.id] : null; };
  const paced = (node) => { const w = W0(), n = node && G.book && G.book.nodes ? G.book.nodes[node] : null; return !!(w && n && (n.place || null) === w.place); };
  // let in the next line: the first line of a witness beat goes through the gate (a beat with no line on screen
  // is passed as read); each line waits out the last one's reading time
  function admit(t) {
    const g = queue[0], X = S(); if (!g) return false;
    if (!g.started && X && G.witness && X.beats.includes(g.node)) {
      const k = X.beats.indexOf(g.node, X.ui.shown);
      if (k >= 0) {
        while (X.ui.shown < k) X.ui.shown++;   // a beat whose lines were all conditioned off: nothing to read
        if (!G.witness.gate.next(t)) return false;
      }
    }
    g.started = true;
    const l = g.lines.shift(); if (!g.lines.length) queue.shift();
    P.log.push(l); nextAt = t + readMs([l]); freed = false;
    return true;
  }
  let freed = false;   // the panel was drawn once after the last held line's reading time
  // closed by the script: beats still unshown had no line on screen (every line conditioned off), so nothing waits
  // to be read for them; the gate then checks the last beat's reading time
  const closedOk = () => { const X = S(); if (!(X && X.closed)) return false; if (!queue.length) while (X.ui.shown < X.beats.length) X.ui.shown++; return !G.witness || G.witness.gate.close(now()); };
  function tick() {
    if (api.root && !api.root.isConnected) return stop();
    const t = now();
    if (queue.length) { if (!stepped() && t >= nextAt && admit(t)) api.render(); else if (stepped() && t >= nextAt && !freed) { freed = true; api.render(); } return; }
    if (t < nextAt) return;
    // the end comes back once the last line has been read and the gate lets the scene close
    if (closedOk()) { engaged = false; stop(); api.render(); return; }
    // the options (the old man's choices) once the lines before them are read
    if (!freed) { freed = true; api.render(); }
  }
  function start() { if (!timer) timer = setInterval(tick, every); }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  const off = [G.on("witness.open", () => { engaged = true; start(); })];
  const api2 = {
    engaged: () => engaged,
    held: () => engaged && (queue.length > 0 || now() < nextAt || (!!(S() && S().closed) && !closedOk())),
    take(lines) {
      if (!engaged) return lines;
      const now0 = [];
      for (const g of groupByNode(lines)) { if (!queue.length && !paced(g.node)) now0.push(...g.lines); else queue.push(g); }
      freed = false; P.log.push(...now0);
      const t = now(); if (!stepped() && t >= nextAt) admit(t);
      start();
      return [];
    },
    // stepped: one node a press, the press itself held to the reading time
    foot() {
      if (!stepped() || !queue.length) return h("p.small.quiet.waitnote", "…");
      return btn(["Go on", h("span.k", "Enter")], () => { const t = now(); if (t >= nextAt && admit(t)) api.render(); }, { cls: "btn go" });
    },
    stop() { stop(); off.forEach((f) => f()); },
  };
  return api2;
}
