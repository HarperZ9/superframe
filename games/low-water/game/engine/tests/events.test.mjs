import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAct } from "../dialogue/book.mjs";
import { createGame, loadContent } from "../game.mjs";
import { ROOT } from "./helpers.mjs";

// ev3.dawn is a guard: the script reaches dawn3.start by itself in every run so far, and this event
// takes Lamb there at 06:20 if anything ever holds the night past it (runsummary GUARDS).
test("the dawn guard takes a night that has not reached dawn there at 06:20, and not before", async () => {
  const { sources } = await loadAct(join(ROOT, "..", "..", "content", "act3", "act3.lwd"), (p) => readFile(p, "utf8"));
  const G = createGame({ content: loadContent(sources), seed: 1 });
  const at = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return (h < 12 ? h + 24 : h) * 60 + m; };
  G.env.advance(at("06:19") - G.clock());
  assert.notEqual((G.dueEvent() || {}).id, "ev3.dawn", "not before 06:20");
  G.env.advance(1);
  const due = () => { let e; while ((e = G.dueEvent()) && e.id !== "ev3.dawn") G.state.fired.push(e.id); return e; };
  const e = due();
  assert.ok(e && e.id === "ev3.dawn", "due at 06:20 when dawn has not been seen");
  assert.ok(e.steps.some((st) => st.kind === "go" && (st.value || st.target) === "dawn3.start"), "it goes to dawn3.start");
});

// The live world asks for an interrupt on every tick of the clock (ui/playlive.mjs). A wait that loops
// on its own cost must not let that re-enter the play in progress (2026-10-21: the gallery's watch ran a
// day). With the live hook on, the watch from 21:30 ends when Fisk comes, the clock moved by its costs.
test("a looping wait under the live world's interrupts ends on time and never re-enters itself", async () => {
  const { sources } = await loadAct(join(ROOT, "..", "..", "content", "act2", "act2.lwd"), (p) => readFile(p, "utf8"));
  const G = createGame({ content: loadContent(sources), seed: 1 });
  G.env.advance(21 * 60 + 30 - G.clock());
  let t = G.talk("mole2.gallery"), nested = 0, depth = 0; const adv = G.advance;
  G.advance = (m) => { if (depth) nested++; depth++; try { return adv(m); } finally { depth--; } };
  G.on("time", () => { if (t && t.beat && t.beat.options) t.interrupt(); });
  const i = t.beat.options.findIndex((o) => /Stay out here/.test(o.label));
  t.choose(t.beat.options[i].index);
  assert.equal(nested, 0, "no advance inside another");
  assert.ok(G.clock() >= 22 * 60 + 30 && G.clock() < 23 * 60 + 30, `the watch ends after half past ten, not a day later (clock ${G.clock()})`);
});
