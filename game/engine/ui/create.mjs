// Character creation: an archetype card or a custom spread of attribute points (checked by
// G.create, whose errors are shown as written), a trusted instrument, and ink mode.
import { h, btn } from "./dom.mjs";

function archetypeCard(ctx, a, on, pick) {
  const rs = ctx.G.rs;
  const attrs = Object.entries(a.attrs).map(([k, v]) => `${(rs.attrs[k] || {}).short || k} ${v}`).join("  ");
  const skills = Object.entries(a.skills).map(([k, v]) => `${(rs.skills[k] || {}).name || k} +${v}`).join(", ");
  const items = a.items.map((i) => (rs.items[i.id] || {}).name || i.id).join(", ");
  const traits = a.traits.map((t) => (rs.traits[t] || {}).name || t).join(", ");
  const b = btn([h("div.cname", a.name, on ? h("span.caps", "  chosen") : null), h("div.mono.small", attrs),
    skills ? h("div.small", `Trained: ${skills}`) : null, items ? h("div.small", `Carries: ${items}`) : null, traits ? h("div.small", `Knows: ${traits}`) : null,
    a.about ? h("div.small.quiet", a.about) : null], pick, { cls: `card${on ? " on" : ""}` });
  b.setAttribute("aria-pressed", String(on));
  return b;
}

// A row the player changes with left and right (or a click to step on).
function stepRow(label, value, step, help = "") {
  const val = h("span.val", value());
  const el = h("button.f.row", { type: "button" }, h("span.lab", label, help ? h("span.help", help) : null), val);
  el.addEventListener("click", () => { step(1); val.textContent = value(); });
  el._step = (d) => { step(d); val.textContent = value(); };
  return el;
}

export function createScreen(ctx) {
  const G = ctx.G, rs = G.rs, R = rs.rules, arch = Object.values(rs.archetypes);
  const C = { archetype: arch[0] ? arch[0].id : null, custom: false, kit: arch[0] ? arch[0].id : null, attrs: Object.fromEntries(Object.keys(rs.attrs).map((k) => [k, R["attr-min"]])), trusted: null, ink: false };
  const cards = h("div.cards"), detail = h("div.detail"), errs = h("div.errs");
  const root = h("div.screen.create", h("div.createbox.sheet.fade-in",
    h("h2", "New character"),
    h("div.ccols", h("div", h("div.caps.quiet", "Start from"), cards), h("div", detail, errs)),
    h("div.mono.small.quiet.foot", "Arrows: move   Left and right: change a value   Enter: choose   Esc: back")));
  ctx.stage.append(root);

  const spent = () => Object.values(C.attrs).reduce((a, v) => a + v, 0);
  function drawCards() {
    cards.replaceChildren(...arch.map((a) => archetypeCard(ctx, a, !C.custom && C.archetype === a.id, () => { C.custom = false; C.archetype = a.id; C.kit = a.id; redraw(); })),
      btn([h("div.cname", "Custom spread", C.custom ? h("span.caps", "  chosen") : null), h("div.small", `Spend ${R["creation-points"]} points, each attribute ${R["attr-min"]} to ${R["attr-max"]}.`)], () => { C.custom = true; redraw(); }, { cls: `card${C.custom ? " on" : ""}` }));
  }
  function drawDetail() {
    const rows = [];
    if (C.custom) {
      rows.push(h("div.caps.quiet", `Points left ${R["creation-points"] - spent()} of ${R["creation-points"]}`));
      for (const [k, a] of Object.entries(rs.attrs)) rows.push(stepRow(a.name, () => `${C.attrs[k]}`, (d) => { C.attrs[k] = Math.max(R["attr-min"], Math.min(R["attr-max"], C.attrs[k] + d)); drawDetailKeep(); }, a.about));
      const kits = [null, ...arch.map((a) => a.id)];
      rows.push(stepRow("Starting kit", () => (C.kit ? rs.archetypes[C.kit].name : "nothing"), (d) => { C.kit = kits[(kits.indexOf(C.kit) + d + kits.length) % kits.length]; }, "Items and thoughts from an archetype; its numbers are not used"));
    }
    const skills = [null, ...Object.keys(rs.skills)];
    rows.push(stepRow("Trusted instrument", () => (C.trusted ? rs.skills[C.trusted].name : "none"), (d) => { C.trusted = skills[(skills.indexOf(C.trusted) + d + skills.length) % skills.length]; }, "Starts one higher"));
    rows.push(stepRow("Ink mode", () => (C.ink ? "on" : "off"), () => { C.ink = !C.ink; }, "One save, written as you go; no loading back"));
    const begin = btn(["Begin", h("span.k", "Enter")], start, { cls: "btn go" });
    detail.replaceChildren(h("div.rows", rows), begin);
  }
  function drawDetailKeep() { const i = [...detail.querySelectorAll(".f")].indexOf(document.activeElement); drawDetail(); const f = detail.querySelectorAll(".f")[i]; if (f) f.focus({ preventScroll: true }); }
  function redraw() { const i = [...cards.querySelectorAll(".f")].indexOf(document.activeElement); drawCards(); drawDetail(); errs.replaceChildren(); const f = cards.querySelectorAll(".f")[i]; if (f) f.focus({ preventScroll: true }); }

  function start() {
    const choice = C.custom ? { attrs: { ...C.attrs }, archetype: C.kit, trusted: C.trusted, ink: C.ink } : { archetype: C.archetype, trusted: C.trusted, ink: C.ink };
    const problems = G.create(choice);
    if (problems.length) { errs.replaceChildren(h("div.caps", "Not yet"), ...problems.map((p) => h("p.small", p))); return; }
    ctx.play(rs.rules["start-node"] || G.book.meta.start || null);
  }
  drawCards(); drawDetail();
  if (cards.firstChild) cards.firstChild.dataset.first = "";
  return ctx.F.push({
    name: "create", root, onBack: () => ctx.title(),
    onAction(a) {
      if ((a === "left" || a === "right") && document.activeElement && document.activeElement._step) { document.activeElement._step(a === "right" ? 1 : -1); return true; }
      return false;
    },
  });
}
