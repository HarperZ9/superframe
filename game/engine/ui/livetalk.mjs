// Talking in a live world (design/UI-SYSTEM.md 7.6). Owned by the UI and UX lead. The clock runs
// while Lamb talks, people move, threats arrive and suspects bolt, so the talk panel must not hide
// what matters. Four aids, one frame loop:
//   1. The talk framing follows the panel: the subject sits in the middle of the plate the panel
//      leaves free (camera-talk-x from the panel's live width), so the free side is all lookahead.
//   2. Edge marks: anyone on the plate who is behind the panel or off the screen gets a paper tab at
//      that edge, level with them, with their name and "moving" while they walk, so an approach or a
//      bolt is seen before it arrives or after it leaves the view.
//   3. The lie window: when a lie is open in an interrogation, a tab at the panel's edge drains its
//      seconds, with the keys that call it (the option's number, N or pad Y); the option itself
//      carries the same drain.
//   4. A "Talk" chip in the prompts tab, with its key, whenever someone is in reach and faced.
// Walking also gives the focus back to the world (P.listFocus = false), so pad A talks again.
//   const L = liveTalkAids(ctx, api, root, P)   L.stop()
import { h, btn } from "./dom.mjs";
import { glyph, onDevice } from "./bindings.mjs";

const LIE_OPEN = 4; // seconds (world/interrogation.mjs LIE_OPEN)
const nameOf = (G, who) => { const c = (G.book.chars || {})[who] || (G.rs.chars || {})[who]; return (c && c.name) || String(who).replace(/^\w/, (x) => x.toUpperCase()); };

export function liveTalkAids(ctx, api, root, P) {
  const G = ctx.G, scene = root.querySelector(".scene");
  const marks = h("div.edgemarks"), lieTab = h("div.lietab.sheet"); lieTab.hidden = true;
  scene.append(marks, lieTab);
  const talkChip = btn(["Talk", glyph("speak")], () => api.interact(), { cls: "chip talkchip" });
  talkChip.hidden = true;
  const offDev = onDevice(() => { talkChip.replaceChildren("Talk", glyph("speak")); });
  let raf = 0, stopped = false, lastX = {}, lieShown = null;
  function frame() {
    if (stopped) return;
    const talking = root.classList.contains("talking") && !root.classList.contains("fighting");
    const panel = root.querySelector("aside.talk"), view = scene.getBoundingClientRect();
    const panelLeft = talking && panel ? panel.getBoundingClientRect().left - view.left : view.width;
    // 1. framing: the subject in the middle-left of the free plate
    if (talking && view.width) G.rs.rules["camera-talk-x"] = Math.max(0.2, Math.min(0.5, (panelLeft / view.width) * 0.45));
    // walking gives the focus back to the world
    const v = (G.input && G.input.get("move")) || { x: 0, z: 0 };
    if (Math.hypot(v.x || 0, v.z || 0) > 0.2) P.listFocus = false;
    // 4. the Talk chip
    const bar = root.querySelector(".topbar");
    if (bar && !bar.contains(talkChip)) bar.prepend(talkChip);
    const target = !talking && api.facing ? api.facing() : null;
    talkChip.hidden = !target;
    if (target) talkChip.title = String(target.label || "").replace(/^"|"$/g, "");
    // 2. edge marks for people behind the panel or off the screen
    const out = [];
    if (api.people && api.cam && api.cam.ready()) {
      for (const f of api.people.figures()) {
        if (f.who === "lamb") continue;
        const s = api.cam.toScreen(f.at); if (!s) continue;
        const x = s[0], y = s[1], was = lastX[f.who]; lastX[f.who] = x;
        const moving = f.walking || (was != null && Math.abs(x - was) > 0.6);
        let side = null;
        if (x > panelLeft - 4) side = "right"; else if (x < 0) side = "left";
        if (!side) continue;
        out.push({ who: f.who, side, y: Math.max(view.height * 0.12, Math.min(view.height * 0.86, y - (s[2] || 0))), moving, toward: was != null && (side === "right" ? x < was : x > was) });
      }
    }
    drawMarks(out, panelLeft, view);
    // 3. the lie window
    const I = G.interrog, lie = I && I.current && I.openLie ? I.openLie() : null;
    if (lie && talking) {
      const left = Math.max(0, LIE_OPEN - (I.current.t - lie.saidAt)), frac = left / LIE_OPEN;
      if (lieShown !== lie.id) { lieShown = lie.id; drawLieTab(); }
      lieTab.hidden = false; lieTab.style.right = `${view.width - panelLeft + 8}px`;
      lieTab.style.setProperty("--left", frac.toFixed(3)); lieTab.querySelector(".secs").textContent = `${left.toFixed(1)} s`;
      for (const el of root.querySelectorAll(".opt.lie")) el.style.setProperty("--left", frac.toFixed(3));
      root.classList.add("lie-open");
    } else { lieTab.hidden = true; lieShown = null; root.classList.remove("lie-open"); }
    raf = requestAnimationFrame(frame);
  }
  function drawLieTab() {
    const opts = (P.beat && P.beat.options) || [], i = opts.findIndex((o) => o.lie);
    lieTab.replaceChildren(h("div.caps.quiet", "That was a lie"), h("div.drain"), h("div.lrow", h("span.secs", ""), h("span.lkeys", i >= 0 ? h("span.key", String(i + 1)) : null, glyph("lie"))));
  }
  const pool = new Map();
  function drawMarks(list, panelLeft, view) {
    const seen = new Set();
    for (const m of list) {
      let el = pool.get(m.who);
      if (!el) { el = h("div.edgemark", h("span.arrow"), h("span.ename", nameOf(G, m.who)), h("span.emove")); pool.set(m.who, el); marks.append(el); }
      seen.add(m.who);
      el.hidden = false; el.dataset.side = m.side;
      el.style.top = `${m.y}px`;
      if (m.side === "right") { el.style.left = ""; el.style.right = `${view.width - panelLeft + 6}px`; } else { el.style.right = ""; el.style.left = "6px"; }
      el.querySelector(".arrow").textContent = m.side === "right" ? "▸" : "◂";
      el.querySelector(".emove").textContent = m.moving ? (m.toward ? "coming" : "moving") : "";
      el.classList.toggle("moving", !!m.moving);
    }
    for (const [who, el] of pool) if (!seen.has(who)) el.hidden = true;
  }
  raf = requestAnimationFrame(frame);
  return { stop() { stopped = true; cancelAnimationFrame(raf); offDev(); marks.remove(); lieTab.remove(); talkChip.remove(); } };
}
