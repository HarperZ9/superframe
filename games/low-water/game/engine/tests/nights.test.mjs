import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent } from "../game.mjs";
import { ROOT } from "./helpers.mjs";

// A keyframed term holds its first key's value before that key (world/night.mjs keyAt). Act 2's frost
// had its only early key at 01:00 (1), so the whole evening read hard frost: the frosted quay plate from
// 19:10 and the body's cold with it (2026-10-21 UX walk). Every term that changes must say what it is
// at the act's start, or start at the value it keeps until its first key.
test("each night's keyed terms are set at the start of the night, not carried back from a later key", async () => {
  for (const act of ["act1/act1.lwd", "act2/act2.lwd", "act3/act3.lwd"]) {
    const { sources } = await loadAct(join(ROOT, "..", "..", "content", act), (p) => readFile(p, "utf8"));
    const C = loadContent(sources), spec = Object.values(C.nights)[0]; if (!spec) continue;
    const terms = [...new Set(spec.keys.map((k) => k.term))];
    for (const term of terms) {
      const ks = spec.keys.filter((k) => k.term === term).sort((a, b) => a.at - b.at);
      const changes = ks.some((k) => k.v !== ks[0].v);
      if (!changes) continue;
      const night = ks[0].at <= (C.book.meta.clock ? Math.max(C.book.clock0, 19 * 60) : C.book.clock0) + 60;
      assert.ok(night, `${act}: ${term} first keyed at ${Math.floor(ks[0].at / 60) % 24}:${String(ks[0].at % 60).padStart(2, "0")} (${ks[0].v}), so it holds that value from the start of the night`);
    }
  }
});
