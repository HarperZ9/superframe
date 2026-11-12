// The sneak view: a beat.sneak played as a paper chart (ui/sneakchart.mjs) beside a card with the
// watchers' states in words, the cover Lamb has, the keys and, at the end, the outcome.
// Real-time modes step inside G.loop (order 15, as Tide Runs); stepped mode moves on each press.
// Keys: arrows or WASD move, C (or Ctrl) held crouches, Shift held hurries, T throws a pebble or
// the scene's throwable, F strikes from behind (a sneak attack). Gamepad: stick, B held crouch,
// X held hurry, Y throw, RB strike.
import { h, btn } from "./dom.mjs";
import { drawSneak } from "./sneakchart.mjs";

const OUT = { win: "Across, unseen.", seen: "Seen.", ambush: "You strike first.", time: "Out of time." };
const STEP = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const CROUCH = new Set(["KeyC", "ControlLeft", "ControlRight"]);

export function openSneak(ctx, id, onDone, { frozen = false } = {}) {
  const G = ctx.G, mode = G.state.runMode || "full", sn = G.sneaks.start(id, { mode });
  const canvas = h("canvas.chart"), info = h("div.runinfo"), result = h("div.runresult.inside"); result.hidden = true;
  const root = h("div.screen.runview", canvas, h("div.runside.sheet", h("div.caps.quiet", "Sneak"), h("div.rname", sn.state.def.name), info, keysHint(mode), result));
  ctx.stage.append(root);
  let raf = 0, closed = false, telegraph = "", crouch = false, padPrev = [];
  const offSay = G.on("stealth.state", (e) => { if (e.say) telegraph = `${e.name.toUpperCase()}: ${e.say}`; });
  const offVoice = G.on("stealth.voice", (e) => { telegraph = `${String(e.name).toUpperCase()}  ${e.text}`; }); // an inner voice (S6)
  const down = (e) => { if (CROUCH.has(e.code)) crouch = true; if (e.code === "KeyT") G.input.press("throw"); if (e.code === "KeyF") G.input.press("ambush"); };
  const up = (e) => { if (CROUCH.has(e.code)) crouch = false; };
  addEventListener("keydown", down, true); addEventListener("keyup", up, true);
  const unloop = G.loop.add("sneak", (dt) => {
    if (frozen || mode === "stepped" || sn.state.done) return;
    const v = G.input.get("move") || { x: 0, z: 0 };
    sn.step(dt, { x: v.x, z: v.z, run: !!G.input.get("run"), crouch: crouch || !!G.input.get("crouch"), throw: G.input.pressed("throw"), ambush: G.input.pressed("ambush") });
  }, { order: 15 });
  function pad() {
    const p = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean)[0] : null; if (!p) return;
    G.input.set("crouch", !!(p.buttons[1] && p.buttons[1].pressed));
    [[3, "throw"], [5, "ambush"]].forEach(([i, n]) => { const d = p.buttons[i] && p.buttons[i].pressed; if (d && !padPrev[i]) G.input.press(n); padPrev[i] = d; });
  }
  function frame() { if (closed) return; pad(); draw(); raf = requestAnimationFrame(frame); }
  function draw() {
    const v = sn.view();
    drawSneak(canvas, v, telegraph);
    info.replaceChildren(...rows(v, crouch));
    if (v.done && result.hidden) showResult(v);
  }
  function showResult(v) {
    result.hidden = false;
    result.replaceChildren(h("div.caps", "Sneak over"), h("p", OUT[v.outcome] || v.outcome), btn(["Go on", h("span.k", "Enter")], finish, { cls: "btn go" }));
    ctx.F.focus(result.querySelector(".f"), { scroll: false });
  }
  function finish() {
    if (closed) return; closed = true; cancelAnimationFrame(raf); unloop(); offSay(); offVoice();
    removeEventListener("keydown", down, true); removeEventListener("keyup", up, true);
    ctx.F.pop(layer); root.remove(); onDone();
  }
  const layer = ctx.F.push({ name: "sneak", root, onAction: (a) => {
    if (STEP[a] && !sn.state.done) { if (mode === "stepped" && !frozen) sn.stepMove(...STEP[a], { crouch }); return true; }
    if (a === "confirm" && sn.state.done) { finish(); return true; }
    return a === "daybook" || a.startsWith("opt:") || a.startsWith("terms");
  }, onBack: () => {} });
  raf = requestAnimationFrame(frame);
  return { sneak: sn, draw, finish, setTelegraph: (t) => { telegraph = t; } };
}

function rows(v, crouch) {
  const left = Number.isFinite(v.limit) ? `${Math.max(0, v.limit - v.minutes)} min` : "no limit";
  const out = [["Pace", v.crouch || crouch ? "crouched" : "upright"], ["Cover", v.cover > 0 ? `${Math.round(v.cover * 100)} percent` : "none"], ["Time left", left]];
  for (const w of v.watchers) out.push([w.name, w.state]);
  return out.map(([k, a]) => h("div.irow", h("span.caps", k), h("span", a)));
}
function keysHint(mode) {
  const lines = mode === "stepped" ? ["Arrows or WASD: one step", "C held: crouch"] : ["Arrows, WASD or stick: walk", "C held: crouch, Shift: hurry"];
  return h("div.keys.small.quiet", [...lines, "T: throw a pebble", "F: strike from behind"].map((t) => h("div", t)));
}
