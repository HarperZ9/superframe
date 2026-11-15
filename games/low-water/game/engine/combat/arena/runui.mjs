// The arena mode's page between fights: the offers after a round (keys 1 to 3, or a click), and the run's
// end with the personal record for this seed and these modifiers. Plain DOM over the canvas.
//   const ui = createRunUI(host, run, { onNext })   ui.show(stage)   ui.hide()   ui.choose(i)   ui.open
const CSS = `.runui{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,6,8,.6)}
.runui .card{background:#efe4d2;color:#1d1418;padding:18px 22px;min-width:420px;max-width:640px;font:14px/1.5 ui-monospace,Consolas,monospace}
.runui h2{margin:0 0 10px;font-size:15px;letter-spacing:.08em}.runui button{display:block;width:100%;text-align:left;margin:6px 0;padding:8px 10px;
background:#fff8ec;border:1px solid #1d1418;font:inherit;cursor:pointer}.runui button:focus,.runui button:hover{outline:2px solid #9a3b1f}`;
import { VENUE_CSS, dressPick, venueIdOf } from "../../ui/venuepick.mjs"; // the venue's material (the UI art lead's)
import { SKINS } from "../data/skins-quota.mjs";
const BOON_NAMES = { edge: "Edge: blows land harder", frame: "Frame: more standing", wind: "Wind: more Breath", footwork: "Footwork: a longer dodge" };
const NAMES = { coat: "Standing", knees: "Breath", ballast: "Poise", grip: "Strike", pen: "Read", nose: "Wind" };
export function createRunUI(host, run, { onNext }) {
  const style = document.createElement("style"); style.textContent = CSS + VENUE_CSS; host.append(style);
  const el = document.createElement("div"); el.className = "runui"; el.hidden = true; host.append(el);
  let cur = null;
  const label = (o) => (o.kind === "level" ? `${NAMES[o.lv] || o.lv} +1 (${o.lv})` : o.kind === "temper" ? `Temper the ${run.state.tool.slice(2)}` : o.kind === "tool" ? `Take the ${o.tool.slice(2)}` : o.kind === "boon" ? (o.name ? `${o.name}: ${o.from}` : BOON_NAMES[o.boon] || o.boon) : "Mend fully");
  const ui = {
    get open() { return !el.hidden; },
    show(st) {
      cur = st; el.hidden = false; el.innerHTML = "";
      const card = document.createElement("div"); card.className = "card"; el.append(card);
      if (st.kind === "offer") {
        card.innerHTML = `<h2>ROUND ${run.state.round - 1} CLEARED</h2><p>Take one.</p>`;
        st.choices.forEach((o, i) => { const b = document.createElement("button"); b.textContent = `${i + 1}  ${label(o)}`; b.onclick = () => ui.choose(i); card.append(b); });
        dressPick(card, venueIdOf(run, SKINS), { round: run.state.round - 1 }); card.querySelector("button")?.focus();
      } else {
        const rec = run.record(), s = run.summary();
        card.innerHTML = `<h2>THE RUN ENDS</h2><p>Rounds cleared: ${s.cleared}. Seed ${s.seed}${s.mods.length ? `, ${s.mods.join(", ")}` : ""}.</p>` +
          (rec ? `<p>Best on this seed: ${rec.best} rounds.${Object.entries(rec.bosses).map(([b, t]) => ` ${b}: ${t} s.`).join("")}</p>` : "<p>Records are off (no storage).</p>") +
          (s.records && s.records.length ? `<p>In the record: ${s.records.map((r) => `${r.name.toLowerCase()} after round ${r.round}`).join("; ")}.</p>` : "") +
          `<p>Kept on this machine only.</p>`;
        const b = document.createElement("button"); b.textContent = "Again (R)"; b.onclick = () => location.reload(); card.append(b); b.focus();
      }
    },
    hide() { el.hidden = true; cur = null; },
    choose(i) { if (!cur || cur.kind !== "offer") return; run.choose(i); ui.hide(); onNext(); },
  };
  addEventListener("keydown", (e) => { if (!ui.open || !cur) return; if (/^Digit[1-3]$/.test(e.code)) ui.choose(+e.code.slice(5) - 1); });
  return ui;
}
