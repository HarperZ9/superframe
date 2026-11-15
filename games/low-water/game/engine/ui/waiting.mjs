// Waiting for the tide (UX-AUDIT T6: "wait until low water"). Owned by the UI and UX lead. The
// "what is here" list gains a row that waits for the tide to turn: falling water waits for low
// water, rising water for high water. The night moves in ten-minute steps; anything the night has
// to say (a scene from G.nextScene) stops the wait at once, so waiting never skips the story. A
// cap (three hours) keeps a still tide from eating the night. The row shows the step and the cap.
//   waitRow(ctx, api, { busy }) -> button        api: the play screen's (worldStep, startTalk, render)
import { h, btn } from "./dom.mjs";
import { tideTrend, tideWords, tideRange, hudConfig } from "./hudtab.mjs";

const STEP = 10, CAP = 180;
const tideNow = (G) => { try { return +G.env.term("tide", G.state.place) || 0; } catch (e) { console.warn(`waiting: no tide: ${e.message}`); return 0; } };

// What the row offers, from the tide clock (2026-10-21: at the surge it offered "Wait for high water"
// while the HUD already read high water). The next turn names the wait; when the tide already stands
// at the water it is going to (the HUD's own words), the wait is for the turn itself. Pure, so
// tools/tidelint.mjs sweeps it over every night: it never offers the state the tide is already in.
//   waitLabel({ tide, dir, next, at, clock, range }) -> { text, minutes }
export function waitLabel({ tide, dir, next, at, clock, range }) {
  const minutes = Math.max(0, Math.min(CAP, Math.round((at ?? clock + CAP) - clock)));
  if (!next) return { text: "Wait for the tide to turn", minutes };
  const already = tideWords(tide, dir === "rising" ? 1 : dir === "falling" ? -1 : 0, range) === `${next} water`;
  return { text: already ? `Wait for the turn at ${next} water` : `Wait for ${next} water`, minutes };
}

const term = (G, k) => { try { return G.env.term(k, G.state.place); } catch (e) { console.warn(`waiting: no ${k}: ${e.message}`); return undefined; } };
export function labelFor(G) {
  return waitLabel({ tide: tideNow(G), dir: term(G, "tide.dir"), next: term(G, "tide.next"), at: term(G, "tide.next.at"), clock: G.clock(), range: tideRange(G) });
}

// Wait to the next turn by the tide clock (or, with no clock, until the water changes direction),
// in steps, stopping for any scene the night has to tell.
export function waitForTurn(G) {
  const at = term(G, "tide.next.at"), kind = term(G, "tide.next");
  let last = tideNow(G), dir = tideTrend(G), waited = 0;
  while (waited < CAP) {
    const step = at != null ? Math.min(STEP, Math.max(1, at - G.clock())) : STEP;
    G.advance(step); waited += step;
    if (at != null && G.clock() >= at) return { waited, turned: kind, scene: null };
    const t = tideNow(G), d = Math.sign(t - last);
    if (at == null) { if (!dir && d) dir = d; else if (dir && d && d !== dir) return { waited, turned: dir < 0 ? "low" : "high", scene: null }; }
    last = t;
    const s = G.nextScene && G.nextScene();
    if (s) return { waited, turned: null, scene: s };
  }
  return { waited, turned: null, scene: null };
}

export function waitRow(ctx, api, { busy = false } = {}) {
  if (ctx.G.env && ctx.G.env.spec && ctx.G.env.spec.tide === false) return null; // no sea (tide: none, world/night.mjs): nothing to wait for
  if (!hudConfig(ctx.G).fields.includes("tide")) return null; // a story with no tide (the Quota's plain) has no turn to wait for
  const G = ctx.G, L = labelFor(G), cost = L.minutes >= 60 ? `${Math.floor(L.minutes / 60)} h ${String(L.minutes % 60).padStart(2, "0")}` : `${L.minutes} min`;
  return btn([h("span.caps.kind", "Wait"), L.text, h("span.cost", L.minutes >= CAP ? `up to ${CAP / 60} h` : cost)], () => {
    const r = waitForTurn(G);
    if (r.scene) return api.startTalk(r.scene.node);
    api.worldStep();
  }, { cls: "act", disabled: busy });
}
