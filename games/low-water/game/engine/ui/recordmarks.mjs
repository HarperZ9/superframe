// The record's marks on the page (the UI art lead's, 2026-10-21), for a story that opts in (@meta ui-era):
//   - a stamp lands on the talk page when the record takes an event (community.record): the era's word,
//     in the stamp lettering, at a slant, pressed once; the page keeps it until the conversation ends;
//   - the read-back (@meta ui-readback: the node, else a node whose id ends .readback) sets the talk page as the official record (era.css
//     .talk.record): typed, flat, the times in a column.
// No count and no tally: a stamp says only that something went on the record.
//   installRecordMarks(ctx) -> { bind(G), stop() }
import { hudConfig } from "./hudtab.mjs";
const WORD = { 1: "Entered", 2: "Received", 3: "Listed", 4: "Filed", 5: "Logged" };

// the record's lines by what they are: a time in its own column, what you told yourself in pencil, what happened typed
function markLines(t) {
  for (const p of t.querySelectorAll(".log > .ln.nar:not([data-rec])")) {
    const s = p.textContent; p.dataset.rec = "1";
    if (/^What you told yourself/.test(s)) p.classList.add("told");
    else if (/^What happened/.test(s)) p.classList.add("happened");
    const m = /^((?:Day \d+\.\s)?\d\d\.\d\d\.|Day \d+\.)\s+(.*)$/.exec(s);
    if (m) { const tm = document.createElement("span"); tm.className = "rt"; tm.textContent = m[1]; p.replaceChildren(tm, " ", m[2]); p.classList.add("timed"); }
  }
}

export function installRecordMarks(ctx) {
  let G = null, offs = [], n = 0;
  const era = () => +document.body.dataset.uiEra || 0, talk = () => document.querySelector(".screen.play > .talk");
  function stamp() {
    // the device rule (@meta journal: off, 2026-10-23, design/DEVICE-AUDIT.md): no rubber stamp on the page; what the
    // town keeps is felt (the story's @sense record.felt: a weight set down somewhere, low in the pad), never filed
    if (G && String((G.book.meta || {}).journal || "on") === "off") { if (G.senses && G.senses.has("record.felt")) G.senses.fire("record.felt", { via: "record" }); return; }
    const t = talk(); if (!t || !era()) return;
    const old = t.querySelectorAll(".record-stamp"); if (old.length >= 3) old[0].remove();
    const s = document.createElement("div"), k = n++;
    s.className = "record-stamp"; s.setAttribute("role", "status");
    s.style.setProperty("--rot", `${(((k * 37) % 11) - 5) * 1.6 - 4}deg`); s.style.setProperty("--dx", `${(k * 53) % 5}rem`); s.style.setProperty("--dy", `${(k * 29) % 4}rem`);
    s.textContent = WORD[era()] || "Entered";
    t.append(s);
  }
  // the read-back: the talk page reads as the record while the read-back node is open
  function reading() {
    const t = talk(); if (!t || !G || !era()) return;
    const id = (ctx.content && ctx.content.book.meta["ui-readback"]) || null, isRB = (n) => !!n && (id ? n === id : /(^|\.)readback$/.test(n));   // @meta ui-readback, else a node named *.readback
    const P = ctx.play && ctx.play.P, on = isRB(G.activeTalk && G.activeTalk.node) || isRB(P && P.talk && P.talk.node);
    if (t.classList.contains("record") !== on) { t.classList.toggle("record", on); if (ctx.letterer) ctx.letterer.rescan(); titleBlock(t, on); }
    if (on) markLines(t);
  }
  // the drawing's title block under the record (the specimen-sheet idiom, author reference 2026-10-22): the place,
  // the day and the record's number, a scale bar, the pen weights of a drawing office; era 4 sets it as a cyanotype
  function titleBlock(t, on) {
    const old = t.querySelector(":scope > .title-block"); if (old) old.remove(); if (!on || !G) return;
    const a = G.world && G.world.area && G.world.area(), day = G.community ? G.community.day() : 0, no = `${String(day).padStart(3, "0")}/${String((G.state.record || []).length).padStart(2, "0")}`;
    const cell = (k, v) => { const d = document.createElement("div"); d.className = "tb-cell"; const kk = document.createElement("span"); kk.className = "tb-k"; kk.textContent = k; const vv = document.createElement("span"); vv.className = "tb-v"; vv.textContent = v; d.append(kk, vv); return d; };
    const tb = document.createElement("div"); tb.className = "title-block";
    const bar = document.createElement("div"); bar.className = "tb-scale"; bar.setAttribute("aria-hidden", "true");
    // the day and the record's number only when the story's HUD shows the day (@meta hud): the Quota's does not
    // (2026-10-22, the author's "less emphasis on counting"), so its record is headed by the place alone
    const showDay = hudConfig(G).fields.includes("day");
    tb.append(cell("Place", (a && a.name) || "Edrin"), ...(showDay ? [cell("Day", String(day || "")), cell("Record no.", no)] : []), bar);
    t.querySelector(".tfoot") ? t.insertBefore(tb, t.querySelector(".tfoot")) : t.append(tb);
  }
  const mo = new MutationObserver(() => reading());
  const bind = (g) => {
    offs.forEach((f) => f()); G = g; offs = [];
    if (!g || !g.on) return;
    offs.push(g.on("community.record", () => setTimeout(stamp, 60)), g.on("talk.end", () => { const t = talk(); if (t) for (const s of t.querySelectorAll(".record-stamp")) s.remove(); }));
    mo.disconnect(); mo.observe(ctx.stage, { childList: true, subtree: true });
  };
  return { bind, stamp, stop() { offs.forEach((f) => f()); mo.disconnect(); } };
}
