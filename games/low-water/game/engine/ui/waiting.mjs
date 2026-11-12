// Waiting for the tide (UX-AUDIT T6: "wait until low water"). Owned by the UI and UX lead. The
// "what is here" list gains a row that waits for the tide to turn: falling water waits for low
// water, rising water for high water. The night moves in ten-minute steps; anything the night has
// to say (a scene from G.nextScene) stops the wait at once, so waiting never skips the story. A
// cap (three hours) keeps a still tide from eating the night. The row shows the step and the cap.
//   waitRow(ctx, api, { busy }) -> button        api: the play screen's (worldStep, startTalk, render)
import { h, btn } from "./dom.mjs";
import { tideTrend } from "./hudtab.mjs";

const STEP = 10, CAP = 180;
const tideNow = (G) => { try { return +G.env.term("tide", G.state.place) || 0; } catch (e) { console.warn(`waiting: no tide: ${e.message}`); return 0; } };

export function waitForTurn(G) {
  let last = tideNow(G), dir = tideTrend(G), waited = 0;
  while (waited < CAP) {
    G.advance(STEP); waited += STEP;
    const t = tideNow(G), d = Math.sign(t - last);
    if (!dir && d) dir = d;                      // the first step tells the direction when it was unknown
    else if (dir && d && d !== dir) return { waited, turned: dir < 0 ? "low" : "high", scene: null };
    last = t;
    const s = G.nextScene && G.nextScene();
    if (s) return { waited, turned: null, scene: s };
  }
  return { waited, turned: null, scene: null };
}

export function waitRow(ctx, api, { busy = false } = {}) {
  const G = ctx.G, dir = tideTrend(G);
  const what = dir < 0 ? "Wait for low water" : dir > 0 ? "Wait for high water" : "Wait for the tide to turn";
  return btn([h("span.caps.kind", "Wait"), what, h("span.cost", `up to ${CAP / 60} h`)], () => {
    const r = waitForTurn(G);
    if (r.scene) return api.startTalk(r.scene.node);
    api.worldStep();
  }, { cls: "act", disabled: busy });
}
