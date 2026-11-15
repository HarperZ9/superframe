// The inner arena on the arena page (?mode=inner): one flaw's fight, its offer after force, then the morning.
//   ?mode=inner&flaw=prudence|friday|withme|nearest|only|forty|check|host  [&movement=0..2] [&kept=prudence,friday]
//   [&bot=force|refuse|endure|yield|lose|name] (a scripted player, for captures) [&seed=n] [&capture=1]
//   ?flaw=descent&resolved=prudence:force,forty:yield&heard=q.sl.check (the Descent, combat/arena/descent.mjs)
//   ?flaw=gate&gate=coat|nose|pen|hat [&levels=grip:8] (one Descent gate alone: the great trait fighting as the trait fed most)
//   &story=1: opened by the game over a scene (ui/inneroverlay.mjs, the story's hinge, combat/innerhook.mjs): at the
//   morning the page posts { type: "lw.inner.done", id, records } to the game and shows nothing of its own
// Keys (beside the arena's): hold I and F together to lay the tool down; N to face it and stand; at the offer,
// 1 takes it and 2 leaves it; R dreams again.
// The page is a test bench, not the game's surface: the morning line in the corner names the scene whose beat
// is recorded, for the developer; the game itself shows nothing and plays the next scene (08-ARENA rule 7).
import { createInnerRun } from "./inner.mjs";
import { createDescent, ringsOf, gateFlaw } from "./descent.mjs";
import { FLAWS, HOST } from "../data/flaws.mjs";
import { CONTROL_WIDE } from "../data/arenas-inner.mjs";
import { parseContent } from "./innercontent.mjs";
import { createView } from "./draw.mjs";
import { forceBot, resolveBot } from "../tools/innerbots.mjs";

const SOURCES = ["q_readback.lwd", "q_ned.lwd", "q_office.lwd", "q_will.lwd", "q_dinner.lwd", "q_cells.lwd"];
const LEVELS = { grip: 5, ballast: 5, coat: 5, knees: 5, pen: 4, nose: 4 };
// the story's sheet, when the shell opens the page over a scene (ui/inneroverlay.mjs: &levels=sum:8,pen:4): the trait
// is as strong in the dream as it is in him (design/TRAITS.md section 2); the page alone keeps the fixed build
const levelsOf = (Q) => { const q = Q.get("levels"); if (!q) return LEVELS; const L = { ...LEVELS }; for (const kv of q.split(",")) { const [k, v] = kv.split(":"); if (k && Number.isFinite(+v)) L[k] = +v; } return L; };

export async function createInnerPage({ canvas, lwd, Q, createGame, setClock, seed }) {
  const files = {};
  await Promise.all(SOURCES.map(async (f) => { try { const r = await fetch(`/content/quota/${f}`); if (r.ok) files[f] = await r.text(); else console.warn(`inner page: ${f} ${r.status}`); } catch (e) { console.warn(`inner page: could not read ${f}: ${e.message}`); } }));
  const ctx = parseContent(files), flawId = Q.get("flaw") || "prudence", kept = (Q.get("kept") || "prudence,friday").split(",").filter(Boolean);
  const records = [];
  const onRecord = (ev) => { records.push(ev); console.info(`inner record: ${JSON.stringify(ev)}`); }, heard = (Q.get("heard") || "").split(",").filter(Boolean);
  const run = flawId === "descent" ? descentRun(Q, heard, seed, onRecord) : flawId === "gate" ? gateRun(Q, heard, seed, onRecord)
    : createInnerRun({ flaw: flawId, kept, seed, heard: Q.get("story") ? heard : null, arena: Q.get("arena") === "control-wide" ? CONTROL_WIDE : null, levels: levelsOf(Q), onRecord });
  if (flawId === "host" && Q.get("movement")) run.state.movement = Math.max(0, Math.min(HOST.movements.length - 1, +Q.get("movement")));
  const card = document.createElement("div"); card.className = "innercard"; card.hidden = true;
  Object.assign(card.style, { position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", background: "#efe4d2", color: "#1d1418", padding: "16px 20px", font: "14px/1.5 ui-monospace,Consolas,monospace", maxWidth: "560px" });
  document.body.append(card);
  // the developer's line is off in stills (?capture=1) unless asked for (&dev=1): it is not the game's surface
  const dev = document.createElement("div"); dev.hidden = (Q.get("capture") === "1" && Q.get("dev") !== "1") || !!Q.get("story"); Object.assign(dev.style, { position: "fixed", left: "8px", bottom: "64px", opacity: 0.6, font: "12px ui-monospace,Consolas,monospace", color: "#e8dccb", whiteSpace: "pre" }); document.body.append(dev);
  const P = { run, W: null, view: null, bot: null, endAt: 0, records, ctx };
  P.next = () => {
    const st = run.stage(); card.hidden = true;
    if (st.kind === "fight") {
      const G = createGame({ sources: [{ file: "arena.lwd", text: lwd }], seed }); setClock(G, "23:30");
      P.W = run.world(G);
      P.view = createView(canvas, P.W); P.endAt = 0;
      // a snow ring is walked; "auto" (the shell's unattended runs) plays as the harness does: the Adversary endured then
      // named, a Descent ring fought, a flaw ended without force where it can be (tools/innerplay.mjs)
      const b0 = Q.get("bot"), b = b0 === "auto" ? (flawId === "host" ? (st.movement === 0 ? "endure" : "name") : flawId === "descent" || flawId === "gate" ? "force" : ["endure", "yield", "refuse", "name"].find((v) => FLAWS[flawId].verbs[v]) || "lose") : b0;
      P.bot = !b ? null : st.empty ? toStove : b === "force" ? forceBot() : resolveBot(P.W, b);
      dev.textContent = `${flawId === "host" ? `the Adversary, ${st.name}` : flawId === "descent" ? `the Descent, ring ${st.ring + 1}` : run.flaw ? run.flaw.town : flawId}  (test bench)`;
      return;
    }
    if (st.kind === "offer") { card.hidden = false; card.innerHTML = `<b>${st.boon.name}</b><br>${st.boon.what}.<br><br>1  Take it<br>2  Leave it`; return; }
    if (st.kind === "morning") { const b = st.beat || {}; dev.textContent = `the morning: ${b.scene || "?"} plays the recorded beat (story lead's)\nR dreams again`; run.wake(); done(); return; }
    dev.textContent = "over. R dreams again"; done();
  };
  // opened by the game over a scene: hand the records back once, at the morning
  let posted = false;
  const done = () => { if (posted || !Q.get("story") || window.parent === window) return; posted = true; window.parent.postMessage({ type: "lw.inner.done", id: flawId, records }, "*"); };
  P.choose = (i) => { if (run.stage().kind === "offer") { run.choose(i); P.next(); } };
  // one fixed step; the fight's end holds two seconds of picture and sound before the run moves on
  P.step = (input) => {
    if (!P.W || run.stage().kind !== "fight") return [];
    const ev = P.W.step({ lamb: P.bot ? P.bot(P.W) : input });
    P.view.events(ev);
    if (P.W.result && ++P.endAt > 120) { run.finish(P.W); P.next(); } // the world stops ticking at its end: count frames here
    return ev;
  };
  P.next();
  return P;
}

const toStove = (W) => { const [x, z] = W.field.arena.anchors.stove[0], L = W.lamb(), d = Math.hypot(x - L.x, z - L.z) || 1; return { mx: (x - L.x) / d, mz: (z - L.z) / d }; };

// the Descent as a run the page can step: each ring a fight, then the ice (the Adversary is its own hinge after it)
// one gate of the Descent on its own, for stills and tuning (?flaw=gate&gate=coat, or &movement=coat as the capture tool
// names it): the great trait's body fighting as the trait the build fed most under it (combat/arena/descent.mjs)
function gateRun(Q, heard, seed, onRecord) {
  const g = Q.get("gate") || Q.get("movement") || "coat", levels = levelsOf(Q), ring = ringsOf({}, heard, levels).find((r) => r.gate === g);
  if (!ring) throw new Error(`inner page: no gate ${g}`);
  return createInnerRun({ flaw: ring.flaw, flawRec: gateFlaw({ ...ring, empty: false }), seed, levels, onRecord });
}

function descentRun(Q, heard, seed, onRecord) {
  const resolved = Object.fromEntries((Q.get("resolved") || "").split(",").filter(Boolean).map((p) => p.split(":")));
  const D = createDescent({ resolved, heard, levels: levelsOf(Q), seed, onRecord }); let woke = false;
  return {
    state: {},
    stage: () => { const st = D.stage(); return st.kind === "ring" ? { kind: "fight", ring: st.ring, flaw: st.flaw, empty: st.empty } : woke ? { kind: "over" } : { kind: "morning", beat: { scene: "e5_day" } }; },
    world: (G) => D.world(G), finish: (W) => D.finish(W), choose: () => {}, wake: () => { woke = true; },
  };
}
