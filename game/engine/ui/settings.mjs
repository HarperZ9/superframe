// Settings: text size, a high-contrast dialogue panel, reduced motion, Tide Runs on or off and
// their mode, and the lens settings. Left and right change the focused row; Enter steps it on.
// Run mode and runs on/off go to G.state.runMode and G.state.runsOff as well as the stored prefs.
import { h } from "./dom.mjs";
import { savePrefs, applyPrefs, TEXT_SIZES, RUN_MODES, LENS_SCHEMA } from "./prefs.mjs";

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
    { sect: "Tide Runs", label: "Tide Runs", help: "Off: the story takes another way round each run", value: () => onoff(!p.runsOff), step: () => { p.runsOff = !p.runsOff; } },
    { sect: "Tide Runs", label: "Run mode", help: "Full speed, half speed, or one step per press", value: () => p.runMode, step: (d) => { p.runMode = cycle(RUN_MODES, p.runMode, d); } },
    ...lens,
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
    el.addEventListener("click", () => change(r, val, 1));
    el.addEventListener("wheel", (e) => { e.preventDefault(); change(r, val, e.deltaY > 0 ? -1 : 1); }, { passive: false });
    els.push([el, r, val]); box.append(el);
  }
  els[0][0].dataset.first = "";
  function change(r, val, d) { r.step(d); commit(ctx); val.textContent = r.value(); }
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
