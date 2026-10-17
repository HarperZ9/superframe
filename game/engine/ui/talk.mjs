// The dialogue panel: the lines of the conversation so far and the options on offer.
// Voices show their name in small capitals, then the line; no colour per voice. A visible check
// shows [VOICE target, pencil|ink] and Lamb's level; its sum shows on focus, on hover, or while
// Shift (pad: X) is held; a strain control (+1 to +3) sits beside it with its cost, and refuses
// when option.strain(n).ok is false. A locked pencil check is greyed with its lock text.
import { h, btn, signed, pct } from "./dom.mjs";

const stripTag = (label) => String(label).replace(/^\[[^\]]*\]\s*/, "");

export function lineEl(l) {
  const who = (t) => h("span.who.caps", t);
  switch (l.kind) {
    case "nar": return h("p.ln.nar", l.text);
    case "voice": return h(`p.ln.voice${l.below != null ? ".weak" : ""}`, who(`${l.glyph ? `${l.glyph} ` : ""}${l.who}`), " ", h("span.vtext", l.text)); // ux: indented, italic; a voice speaking from weakness gets a dash
    case "inst": return h("p.ln.inst", who(l.who), " ", h("span.mono", l.text));
    case "check": return h("p.ln.check.caps", `${l.who}  ${l.text}`);
    case "you": return h("p.ln.you", who("You"), " ", stripTag(l.text));
    default: return h("p.ln.line", l.who ? who(l.who) : null, l.who ? " " : null, l.text);
  }
}

// The history log's quieter style for checks the player never saw a tally for.
export function hiddenEl(l) { return h("p.ln.hidden.caps", `hidden check: ${l.text}`); }


// The tag a visible check carries. ux (UI-SYSTEM 7.1): a ruled box, dashed for pencil and solid
// for ink, with the voice and its target; under it Lamb's level, what the kind means, and the gap
// in words. Odds only when the content runs dice checks (the engine's test content); Low Water's
// own checks have none.
function checkTag(c) {
  return h(`span.tag.chk${c.red ? ".ink" : ""}`, h("span.vn", c.skillName), h("span.dc", String(c.dc)));
}
function gapText(c) {
  const d = c.total - c.dc;
  return d < 0 ? `short by ${-d}` : d === 0 ? "just enough" : `clear by ${d}`;
}
function checkLine(c) {
  return h("div.chkline", h("span", `you ${c.total}`), h("span", c.red ? "ink: once, and failing opens its own scene" : "pencil: try again when the sum changes"),
    c.mode === "dice" ? h("span", `${pct(c.odds)} odds`) : null, h("span.gap", gapText(c)));
}

// The terms of the sum, with any strain chosen.
export function termsText(c, strain = 0) {
  const parts = c.parts.filter((p) => p.amount !== 0 || p.why !== "training").map((p) => `${p.why} ${signed(p.amount)}`);
  if (strain) parts.push(`strain ${signed(strain)}`);
  return `${c.total + strain} = ${parts.join(", ")}  against ${c.dc}${c.label ? ` (${c.label})` : ""}`;
}

function strainCost(G, st) {
  if (!st || !st.n) return "No strain";
  if (!st.ok) return st.why;
  const what = st.kind === "meter" ? (G.content.meters[st.id] || {}).name || st.id : `favour with ${(G.rs.factions[st.id] || {}).name || st.id}`;
  return `+${st.n} costs ${st.cost} ${what}`;
}

// The +1 to +3 control. sel: the chosen strain per option key (kept by the caller).
function strainRow(G, o, sel, rerender) {
  const cur = sel[o.key] || 0, note = h("span.cost.small", strainCost(G, cur ? o.strain(cur) : null));
  const row = h("div.strain", h("span.caps", "Strain"));
  for (let n = 1; n <= 3; n++) {
    const st = o.strain(n);
    const b = btn(cur === n ? `[+${n}]` : `+${n}`, () => { sel[o.key] = cur === n ? 0 : n; rerender(); }, { cls: "sbtn", disabled: !st.ok, title: st.ok ? `Costs ${st.cost}` : st.why });
    b.setAttribute("aria-pressed", String(cur === n));
    b.addEventListener("focus", () => { note.textContent = strainCost(G, st); });
    b.addEventListener("blur", () => { note.textContent = strainCost(G, cur ? o.strain(cur) : null); });
    row.append(b);
  }
  row.append(note);
  return row;
}

function optionEl(G, o, i, { sel, termsAll, onChoose, rerender }) {
  const c = o.check, strain = (c && sel[o.key]) || 0;
  const label = h("span.lab", c ? stripTag(o.label) : o.label);
  const head = h("span.num.mono", `${i + 1}.`);
  const tags = [o.kind === "claim" ? h("span.tag.caps", "Claim") : null, c ? checkTag({ ...c, total: c.total + strain }) : null];
  const b = btn([head, h("span.body", tags.filter(Boolean).length ? h("span.tags", tags) : null, label, o.said ? h("span.said.caps", " said") : null)], () => onChoose(i, strain), { cls: `opt k-${o.kind}`, disabled: !!o.locked });
  if (c) b.setAttribute("aria-description", `${c.skillName} ${c.dc}, ${c.red ? "ink, once" : "pencil"}; you ${c.total + strain}, ${gapText({ ...c, total: c.total + strain })}`);
  b.dataset.opt = String(i);
  if (o.lie) { b.classList.add("lie"); b.append(h("span.liedrain", { "aria-hidden": "true" })); } // ux: the lie window drains here (ui/livetalk.mjs)
  if (i === 0) b.dataset.first = "";
  const wrap = h("div.optwrap", b);
  if (c) wrap.append(checkLine({ ...c, total: c.total + strain }));
  if (o.locked) wrap.append(h("div.lock.small", o.locked));
  if (c) {
    const terms = h("div.terms.mono.small", termsText(c, strain));
    if (!termsAll) terms.classList.add("on-focus");
    wrap.append(terms);
    if (o.canStrain && !o.locked) wrap.append(strainRow(G, o, sel, rerender));
  }
  return wrap;
}

// Draw the options of a beat into box. Returns nothing; clicks call onChoose(index, strain).
export function renderOptions(box, G, beat, opts) {
  box.replaceChildren();
  (beat.options || []).forEach((o, i) => box.append(optionEl(G, o, i, opts)));
}
