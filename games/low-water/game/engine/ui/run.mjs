// The Tide Run view: a top-down chart of run.view() drawn on a canvas. Ground is paper, off the
// ground is night, water is hatching (closer lines for deeper water, with the depth in words),
// frost is a dotted ring, lights are warm discs with a ring, the pursuer's cone is an outlined
// wedge, the goal is a double ring, and the time left is a mark along the top edge.
// Full and half modes step with requestAnimationFrame from keys or the stick (Shift or X to
// hurry); stepped mode moves one step per press and the world waits in between.
import { h, btn } from "./dom.mjs";
import { drawChart } from "./chart.mjs";

const REASONS = { goal: "You made it.", swept: "The water took your feet.", fell: "You went off the edge in the dark.", seen: "You were seen.", time: "The water came before you did." };

export function openRun(ctx, id, onDone, { frozen = false } = {}) {
  const G = ctx.G, mode = G.state.runMode || "full";
  const run = G.runs.start(id, { mode });
  const canvas = h("canvas.chart"), info = h("div.runinfo"), result = h("div.runresult.sheet");
  result.hidden = true;
  const root = h("div.screen.runview", canvas, h("div.runside.sheet", h("div.caps.quiet", "Tide Run"), h("div.rname", run.state.def.name), info, keysHint(mode)), result);
  ctx.stage.append(root);
  let raf = 0, closed = false;
  // Full and half modes step inside the engine's fixed-step loop (G.loop), reading G.input.
  const unloop = G.loop.add("tide-run", (dt) => {
    if (frozen || mode === "stepped" || run.state.done) return;
    const v = G.input.get("move") || { x: 0, z: 0 };
    run.step(dt, { x: v.x, z: v.z, run: !!G.input.get("run") });
  }, { order: 15 });

  function frame() {
    if (closed) return;
    draw();
    raf = requestAnimationFrame(frame);
  }
  function draw() {
    const v = run.view();
    drawChart(canvas, v);
    info.replaceChildren(...infoRows(v, mode));
    if (v.done && result.hidden) showResult(v);
  }
  function showResult(v) {
    result.hidden = false;
    result.replaceChildren(h("div.caps", v.outcome === "win" ? "Run won" : "Run lost"), h("p", REASONS[v.reason] || v.reason), btn(["Go on", h("span.k", "Enter")], finish, { cls: "btn go" }));
    ctx.F.focus(result.querySelector(".f"), { scroll: false });
  }
  function finish() {
    if (closed) return;
    closed = true; cancelAnimationFrame(raf); unloop();
    ctx.F.pop(layer); root.remove();
    onDone();
  }
  const layer = ctx.F.push({ name: "run", root, onAction: (a) => runAction(run, mode, frozen, a), onBack: () => {} });
  raf = requestAnimationFrame(frame);
  return { run, draw, finish };
}

// Directions move one step in stepped mode and are held for walking otherwise; the Daybook and
// options wait until the run is over.
const STEP = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
function runAction(run, mode, frozen, a) {
  if (STEP[a] && !run.state.done) { if (mode === "stepped" && !frozen) run.stepMove(...STEP[a]); return true; }
  return a === "daybook" || a.startsWith("opt:") || a.startsWith("terms");
}

function infoRows(v, mode) {
  const depthWord = v.depth <= 0.02 ? "dry" : v.depth < v.knee ? "below the knee" : v.depth < v.waist ? "above the knee" : "at the waist";
  const left = Number.isFinite(v.limit) ? Math.max(0, v.limit - v.minutes) : null;
  const rows = [
    ["Water", depthWord, `${v.depth.toFixed(2)} m`],
    ["Time left", left == null ? "no limit" : `${left} min`, ""],
    ["Mode", mode, ""],
  ];
  if (v.pursuer) rows.push(["Seen", v.seen >= 0.01 ? `${Math.round(Math.min(1, v.seen) * 100)} percent` : "not seen", ""]);
  return rows.map(([k, a, b]) => h("div.irow", h("span.caps", k), h("span", a), b ? h("span.mono.small.quiet", b) : null));
}

function keysHint(mode) {
  const lines = mode === "stepped"
    ? ["Arrows, WASD or d-pad: one step", "The water waits for you"]
    : ["Arrows, WASD or stick: walk", "Hold Shift or X: hurry (costs)"];
  return h("div.keys.small.quiet", lines.map((t) => h("div", t)));
}
