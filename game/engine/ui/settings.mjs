// Settings: text size, a high-contrast dialogue panel, reduced motion, Tide Runs on or off and
// their mode, and the lens settings. Left and right change the focused row; Enter steps it on.
// Run mode and runs on/off go to G.state.runMode and G.state.runsOff as well as the stored prefs.
import { h } from "./dom.mjs";
import { savePrefs, applyPrefs, TEXT_SIZES, RUN_MODES, LENS_SCHEMA, UI_SCALES, SHAKES } from "./prefs.mjs";
import { FIGHT_ACTIONS, loadBindings, saveBindings, resetBindings, keyName, padName, mouseName } from "./bindings.mjs";

const onoff = (v) => (v ? "on" : "off");
const cycle = (list, v, d) => list[(list.indexOf(v) + d + list.length) % list.length];

function rows(ctx) {
  const p = ctx.prefs;
  const lens = Object.entries(LENS_SCHEMA).map(([k, s]) => ({
    sect: "Lens", label: s.label, help: s.help,
    value: () => (s.type === "boolean" ? onoff(p.lens[k]) : `${Math.round(p.lens[k] * 100)} percent`),
    step: (d) => { p.lens[k] = s.type === "boolean" ? !p.lens[k] : Math.max(s.min, Math.min(s.max, +(p.lens[k] + d * s.step).toFixed(2))); },
  }));
  return [
    { sect: "Reading", label: "Text size", help: "Size of every word in the interface", value: () => p.textSize, step: (d) => { p.textSize = cycle(Object.keys(TEXT_SIZES), p.textSize, d); } },
    { sect: "Reading", label: "High-contrast dialogue", help: "Solid paper and darker ink behind conversations", value: () => onoff(p.contrast), step: () => { p.contrast = !p.contrast; } },
    { sect: "Reading", label: "Reduced motion", help: "No fades or slides", value: () => onoff(p.calm), step: () => { p.calm = !p.calm; } },
    // ux: interface scale, shake, rumble, pause on focus loss (UI-SYSTEM section 9)
    { sect: "Reading", label: "Interface scale", help: "Size of every panel, apart from the text size", value: () => `${Math.round((p.uiScale || 1) * 100)} percent`, step: (d) => { p.uiScale = cycle(UI_SCALES, p.uiScale || 1, d); } },
    { sect: "Reading", label: "Portraits in conversation", help: "The painted face of whoever is speaking, at the top of the talk panel", value: () => onoff(p.portraits !== false), step: () => { p.portraits = p.portraits === false; } },
    { sect: "Feel", label: "Camera shake", help: "How the camera answers a blow in a fight: full, reduced, or off. Exploring and talking always keep a calm camera", value: () => ({ on: "full", light: "reduced", off: "off" }[p.shake] || p.shake), step: (d) => { p.shake = cycle(SHAKES, p.shake, d); } },
    { sect: "Feel", label: "Controller rumble", help: "The pad answers blows, blocks and catches", value: () => onoff(p.rumble), step: () => { p.rumble = !p.rumble; } },
    { sect: "Feel", label: "Pause when the window loses focus", help: "Fights and runs stop while you are away", value: () => onoff(p.pauseOnBlur), step: () => { p.pauseOnBlur = !p.pauseOnBlur; } },
    { sect: "Tide Runs", label: "Tide Runs", help: "Off: the story takes another way round each run", value: () => onoff(!p.runsOff), step: () => { p.runsOff = !p.runsOff; } },
    { sect: "Accessibility", label: "Pace of scenes", help: "Full speed (the default), half speed, or stepped: one step per press, and the world waits between steps", value: () => p.runMode, step: (d) => { p.runMode = cycle(RUN_MODES, p.runMode, d); } },
    ...lens,
    ...controlRows(),
  ];
}

function commit(ctx) {
  const p = ctx.prefs;
  applyPrefs(p); savePrefs(p);
  if (ctx.G) { ctx.G.state.runMode = p.runMode; ctx.G.state.runsOff = !!p.runsOff; }
}

export function openSettings(ctx) {
  const R = rows(ctx), box = h("div.rows");
  let sect = "";
  const els = [];
  for (const r of R) {
    if (r.sect !== sect) { sect = r.sect; box.append(h("div.sect", sect)); }
    const val = h("span.val", r.value());
    const el = h("button.f.row", { type: "button" }, h("span.lab", r.label, h("span.help", r.help)), val);
    el.addEventListener("click", () => (r.capture ? capture(r, val) : change(r, val, 1)));
    el.addEventListener("wheel", (e) => { e.preventDefault(); change(r, val, e.deltaY > 0 ? -1 : 1); }, { passive: false });
    els.push([el, r, val]); box.append(el);
  }
  els[0][0].dataset.first = "";
  function change(r, val, d) { if (!r.step) return; r.step(d); commit(ctx); val.textContent = r.value(); if (!r.capture && r.sect === "Controls in a fight") for (const [, rr, vv] of els) vv.textContent = rr.value(); }
  function capture(r, val) { val.textContent = "press a key, a mouse button or a pad button (Esc cancels)"; captureBinding(r.capture, () => { val.textContent = r.value(); }); }
  const root = h("div.screen.dim", h("div.menu.sheet.wide.tall.fade-in", h("h2", "Settings"), box, h("div.mono.small.quiet.foot", "Left and right: change   Esc or B: back")));
  ctx.stage.append(root);
  const layer = ctx.F.push({
    name: "settings", root,
    onAction(a) {
      if (a !== "left" && a !== "right") return false;
      const hit = els.find(([el]) => el === document.activeElement);
      if (!hit) return false;
      change(hit[1], hit[2], a === "right" ? 1 : -1);
      return true;
    },
    onBack: () => { ctx.F.pop(layer); root.remove(); if (ctx.play) ctx.play.render(); },
  });
  return layer;
}

// ux: Controls. Enter on a row waits for the next key, mouse button or pad button and binds it as
// that action's first binding (keyboard and mouse share a column, the pad has its own). Esc cancels.
let B = loadBindings();
function bound(id) {
  const k = [...(B.key[id] || []).map(keyName), ...(B.mouse[id] || []).map(mouseName)].filter((v, i, a) => a.indexOf(v) === i).join(", ") || "unbound";
  const pd = (B.pad[id] || []).map(padName).join(", ") || "unbound";
  return `${k}   pad ${pd}`;
}
function controlRows() {
  B = loadBindings();
  const rows = FIGHT_ACTIONS.map(([id, label]) => ({ sect: "Controls in a fight", label, help: "", value: () => bound(id), step: null, capture: id }));
  rows.push({ sect: "Controls in a fight", label: "Put every control back", help: "The defaults: the keyboard as shown, the pad's shoulder layout", value: () => "", step: () => { B = resetBindings(); } });
  return rows;
}
export function captureBinding(id, done) {
  let raf = 0; const prev = [];
  const fin = (dev, code) => {
    removeEventListener("keydown", kd, true); removeEventListener("mousedown", md, true); cancelAnimationFrame(raf);
    if (dev && !(dev === "key" && code === "Escape")) {
      for (const d of ["key", "mouse", "pad"]) for (const a of Object.keys(B[d])) if (a !== id && d === dev) B[d][a] = (B[d][a] || []).filter((c) => c !== code); // one action per input
      if (dev !== "pad") { B.key[id] = dev === "key" ? [code] : (B.key[id] || []); B.mouse[id] = dev === "mouse" ? [code] : []; } else B.pad[id] = [code];
      saveBindings(B);
    }
    done();
  };
  const kd = (e) => { e.preventDefault(); e.stopPropagation(); fin("key", e.code); };
  const md = (e) => { if (e.button === 0 && e.target.closest(".f")) return; e.preventDefault(); e.stopPropagation(); fin("mouse", e.button); };
  const poll = () => { const p = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean)[0] : null; if (p) { const i = p.buttons.findIndex((b, k) => b.pressed && !prev[k]); p.buttons.forEach((b, k) => { prev[k] = b.pressed; }); if (i >= 0 && prev.length) return fin("pad", i); } raf = requestAnimationFrame(poll); };
  setTimeout(() => { addEventListener("keydown", kd, true); addEventListener("mousedown", md, true); const p = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean)[0] : null; if (p) p.buttons.forEach((b, k) => { prev[k] = b.pressed; }); raf = requestAnimationFrame(poll); }, 120);
}
