// The strip and the voice line (design/UI-SYSTEM.md sections 6, 7, 7.2b). Owned by the UI and UX
// lead. One place, bottom left, for whatever is live; above it, a voice speaking outside a
// conversation. The fight strip is built once and updated in place each frame (no DOM rebuilds),
// and answers hit, block, catch and the rest with a short response in the strip, never over the
// fight.
//   const dock = createDock(host)                 the column that holds the voice line and a strip
//   dock.say(who, text, { weak, ms })             a voice line; two at most, each fades after ms
//   const S = fightStrip(dock, { G, W, title })   S.update() each frame; S.event(type, e); S.leave()
import { h } from "./dom.mjs";

export function createDock(host) {
  const voice = h("div.voiceline"), slot = h("div.slot"), el = h("div.dock", voice, slot);
  host.append(el);
  function say(who, text, { weak = false, ms = 4000 } = {}) {
    const line = h(`div.vl${weak ? ".weak" : ""}`, who ? h("span.who", who) : null, h("span.vtext", text));
    voice.append(line);
    while (voice.children.length > 2) voice.firstChild.remove();
    setTimeout(() => { line.classList.add("going"); setTimeout(() => line.remove(), 200); }, ms);
    return line;
  }
  return { el, voice, slot, say, remove: () => el.remove() };
}

// Notches that keep their elements: set(value, max) updates fill per notch; crack(from, to) marks
// the notches just lost.
function notchRow(cls = "") {
  const el = h(`span.tick${cls}`);
  let n = -1, last = null;
  return {
    el,
    set(v, max) {
      const count = Math.max(1, Math.ceil(max - 1e-6));
      if (count !== n) { el.replaceChildren(...Array.from({ length: count }, () => h("i"))); n = count; }
      const r = Math.round(v * 20) / 20; if (r === last) return; // a twentieth of a notch is the finest change shown
      const kids = el.children;
      for (let k = 0; k < count; k++) {
        const f = Math.max(0, Math.min(1, v - k));
        if (last != null && f < Math.max(0, Math.min(1, last - k)) - 0.2) { kids[k].classList.remove("crack"); void kids[k].offsetWidth; kids[k].classList.add("crack"); }
        kids[k].style.setProperty("--f", f.toFixed(2));
      }
      last = r;
    },
  };
}

const fmt = (v) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));
const minus = (v) => `−${fmt(v)}`;

export function fightStrip(dock, { G, W, title = "" }) {
  const L0 = W.lamb(), lambId = L0 ? L0.id : "lamb";
  const stand = notchRow(), breath = notchRow(), comp = notchRow(".comp.small");
  const vStand = h("span.v"), vBreath = h("span.v"), vComp = h("span.v");
  const xline = h("div.xline"), foesBox = h("div.foes"), lockHint = h("span.caps.quiet");
  const el = h("div.strip",
    h("div.shead", h("span.caps.quiet", title), lockHint),
    h("div.srow", h("span.lab", "Standing"), stand.el, vStand),
    h("div.srow", h("span.lab", "Breath"), breath.el, vBreath),
    h("div.srow", h("span.lab", "Composure"), comp.el, vComp),
    foesBox, xline);
  dock.slot.replaceChildren(el);
  const foeRows = new Map();
  const nameOf = (F) => (W.defs[F.id] && W.defs[F.id].name) || F.id;
  function foeRow(F) {
    let r = foeRows.get(F.id); if (r) return r;
    const ticks = notchRow(".small"), state = h("span.state"), row = h("div.srow.foe", h("span.lab", nameOf(F)), ticks.el, state);
    r = { row, ticks, state }; foeRows.set(F.id, r); foesBox.append(row); return r;
  }
  let winded = false, xTimer = 0;
  function update() {
    const L = W.lamb();
    if (L) {
      stand.set(L.hp, L.hpMax); breath.set(L.st, L.stMax); comp.set(L.composure || 0, Math.max(1, L.composureMax || 0));
      vStand.textContent = fmt(Math.max(0, L.hp)); vBreath.textContent = fmt(Math.max(0, L.st)); vComp.textContent = fmt(L.composure || 0);
      if (winded && L.st >= 1) { winded = false; breath.el.classList.remove("wind"); }
    }
    for (const F of W.fighters) {
      if (F.team === "lamb" || F.id === lambId) continue;
      const r = foeRow(F);
      r.ticks.set(Math.max(0, F.hp), F.hpMax);
      const word = F.yielded ? "gave in" : F.out ? "out" : F.fallen ? "down" : "";
      if (r.state.textContent !== word) r.state.textContent = word;
      r.row.classList.toggle("down", !!(F.fallen || F.out));
      r.row.classList.toggle("locked", !!(L && L.lock === F.id));
    }
  }
  function x(text) {
    xline.textContent = text; xline.classList.remove("fresh"); void xline.offsetWidth; xline.classList.add("fresh");
    clearTimeout(xTimer); xTimer = setTimeout(() => { xline.textContent = ""; }, 2200);
  }
  function bump(cls) { el.classList.remove("jolt", "lift"); void el.offsetWidth; el.classList.add(cls); }
  const isLamb = (id) => id === lambId;
  const foeName = (id) => { const F = W.byId ? W.byId(id) : W.fighters.find((f) => f.id === id); return F ? nameOf(F) : "They"; };
  function event(type, e = {}) {
    switch (type) {
      case "hit":
        if (isLamb(e.id)) { x(`Struck  ${minus(e.dmg || 0)}`); bump("jolt"); }
        else if (isLamb(e.by)) x(`${e.move && /riposte/.test(e.move) ? "Riposte" : e.armor ? "Through their guard" : "Landed"}  ${minus(e.dmg || 0)}`);
        break;
      case "block": if (isLamb(e.id)) { x(`Blocked  ${minus(e.cost || 0)} Breath`); bump("jolt"); } else if (isLamb(e.by)) x(`${foeName(e.id)} blocked`); break;
      case "guardbreak": if (isLamb(e.id)) { x("Guard broken"); bump("jolt"); } else if (isLamb(e.by)) x("Their guard broke"); break;
      case "parry": if (isLamb(e.id)) { x("Caught: strike now"); bump("lift"); } else if (isLamb(e.by)) x(`${foeName(e.id)} caught it`); break;
      case "evade": if (isLamb(e.id)) x("Slipped it"); break;
      case "breathless": if (isLamb(e.id)) { x("Winded"); winded = true; breath.el.classList.add("wind"); } break;
      case "nocomposure": if (isLamb(e.id)) x("Not enough Composure"); break;
      case "knockdown": x(isLamb(e.id) ? "Knocked down" : `${foeName(e.id)} is down`); if (isLamb(e.id)) bump("jolt"); break;
      case "yield": x(`${foeName(e.id)} gives in`); break;
      case "lock": if (isLamb(e.id)) lockHint.textContent = e.target ? "locked" : ""; break;
      default: break;
    }
  }
  function leave() { el.classList.add("leaving"); return new Promise((r) => setTimeout(() => { el.remove(); r(); }, 160)); }
  update();
  return { el, update, event, leave };
}
