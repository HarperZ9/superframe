// The Quota's slice, as the harness reads it (tools/use-story.mjs, LW_STORY=quota): the act it plays,
// how a run counts as finished (it reached the read-back and the coda's table was laid), the reckoning
// ledger's patterns, and the fight bench's default fight (the granary door).
import { evaluate } from "../../core/expr.mjs";
const ROOT = new URL("../../../../content/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
export const LEDGER = { professed: /^(conviction|said|promise)\./, acted: /^(lied|broke)\./, moves: /^lean_/, totals: ["gap", "owned", "denied"] };
export const GUARDS = [];
export const BENCH = { fight: "e.q_granary", act: 1, plate: "granary", area: "granary", hot: "8,0,8", door: "8,0,9.5" };
export const STORY = {
  name: "quota", // the world record's key (save/worldrecord.mjs)
  wiring: new URL("../../wiring/quota-areas.lwd", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"), // the story's areas (tools that need plates and marks)
  // every era's areas, for tools that check marks on plates across the eras (tools/proplint.mjs; world-layers pass, 2026-10-23)
  wirings: ["quota-areas", "era1-areas", "era3-areas", "era4-areas", "era5-areas"].map((w) => new URL(`../../wiring/${w}.lwd`, import.meta.url).pathname.replace(/^\/(\w:)/, "$1")),
  acts: [`${ROOT}quota/slice.lwd`], // the story lead's slice (q_*.lwd) with the model in q_community.lwd
  nonFighters: ["inspector"],
  end(G, act) {
    const C = G.community, table = C ? C.bowls("haldane") : null;
    return { finished: !!act.end && G.memory.visits("q.readback") > 0 && table != null, endings: { end: act.end, report: G.scope.get("var.q_figure"), door: G.scope.get("var.q_door"), class: G.scope.get("var.q_class") }, table: { haldane: table, furrowe: C && C.bowls("furrowe"), brack: C && C.bowls("brack") }, record: G.reckoning ? G.reckoning.events().map((e) => `${e.type}@${e.victim}/${e.street}`) : [], facts: G.lore ? G.lore.facts() : [], dreams: G.dreams ? G.dreams.list() : [], pressure: C ? { ...(C.state.pressure || {}) } : {}, fates: C ? { ...(C.state.fates || {}) } : {}, fateLog: C ? C.state.log.filter((l) => ["bowls", "taken", "members", "end"].includes(l.name)).map((l) => ({ at: l.at, name: l.name, from: l.from, to: l.to, path: l.path })) : [], visited: Object.keys(G.book.nodes).filter((id) => G.memory.visits(id) > 0), cues: G.senses ? G.senses.log().map((c) => c.id) : [], echoes: (G.state.echoes || []).map((e) => e.id), touched: [...(G.state.touchLog || [])], burdenPeak: G.state.burdenPeak || 0 };
  },
  // the attentive player: whenever a line is shown, every prop at the place is looked at once in each of its
  // states (world/props.mjs), so a prop is read in the world the scene shows (after its cuts); the run keeps
  // prop:state pairs, which tools/propcheck.mjs reads
  watch(G, R) {
    if (G.lore) G.on("lore.found", (e) => (R.lore ||= []).push(e.id)); // the lore graph (tools/lorecheck.mjs)
    // perspective chapters (tools/perspectivecheck.mjs): the run's own person before, who played the chapter, and
    // whether the same person came back after, while the world kept what the chapter did
    if (G.perspective) {
      const PERSON = ["sheet", "inv", "cabinet", "checks", "ink"], parts = (o) => PERSON.map((k) => JSON.stringify(o[k] ?? null));
      let cur = null;
      G.on("perspective.start", (e) => {
        const P = G.state.perspective; delete G.state.perspective; const figureBefore = G.playerFigure(); G.state.perspective = P; // whose figure it was before
        cur = { id: e.id, parts: parts(P.stash), figureBefore, during: { archetype: G.state.sheet.archetype, figure: G.playerFigure() }, world0: JSON.stringify([G.state.vars, G.state.flags]), ended: false };
        (R.perspectives ||= []).push(cur);
      });
      G.on("perspective.end", () => {
        if (!cur) return; const after = parts(G.state);
        cur.changed = PERSON.filter((k, i) => after[i] !== cur.parts[i]); cur.figureAfter = G.playerFigure();
        cur.worldKept = JSON.stringify([G.state.vars, G.state.flags]) !== cur.world0; // the chapter's choices stayed in the world
        cur.ended = true; delete cur.parts; delete cur.world0; cur = null;
      });
    }
    // the read-back (tools/readbackcheck.mjs): the document as opened, and whether it can be skipped (it must not)
    if (G.readback) G.on("readback.open", () => {
      const doc = G.readback.build(G.state.readback.id), rb = G.readback, voices = G.memory.history().filter((l) => l.kind === "voice").length;
      const first = rb.next(0), second = rb.next(1), early = rb.close(2);
      let t = 2; for (let i = 0; i < 200 && rb.next(t += 60000); i++);
      R.readback = { doc, selfLies: (G.state.selfLies || []).map((x) => x.id), said: (G.state.saidWords || []).map((x) => ({ flag: x.flag, words: x.words })), voices,
        skip: { first: !!first, secondRefused: doc.rows.length < 2 || !second, earlyRefused: doc.rows.length === 0 || !early, closed: rb.close(t + 60000) } };
    });
    // the witness scene (tools/witnesscheck.mjs): the beats chosen when it opened, the beats played, the self-lies
    // heard, the gate (unskippable, closed only when read), and the ledger's rows as the oracle, at the run's end
    if (G.witness) {
      G.on("witness.open", (e) => {
        const X = G.state.witness, g = G.witness.gate, first = g.next(0), second = g.next(1), early = g.close(2);
        let t = 2; for (let i = 0; i < 200 && g.next(t += 60000); i++);
        // a run can open more than one witness (era 1's, then era 2's): keep the earlier ones, and give each the
        // self-lies heard since the one before, so each witness answers for its own era's self-lies
        if (R.witness) (R.witnesses ||= []).push(R.witness);
        const owned = new Set((R.witnesses || []).flatMap((w) => w.selfLies));
        R.witness = { id: e.id, beats: [...X.beats], played: [], closed: false, selfLies: [...new Set((G.state.selfLies || []).map((x) => x.id))].filter((id) => !owned.has(id)), oracle: [],
          gate: { first: !!first, secondRefused: X.beats.length < 2 || !second, earlyRefused: X.beats.length === 0 || !early, closed: g.close(t + 60000) } };
        X.ui = { shown: 0, lastAt: null };
        const W = G.witness.records[e.id], D = W && W.oracle && G.readback ? G.readback.records.docs[W.oracle] : null;
        if (D) for (const r of D.rows) {
          let holds = true; try { holds = !r.cond || !!evaluate(r.cond, G.scope); } catch { holds = false; }
          if (holds) R.witness.oracle.push({ when: r.when, text: r.text, ids: [...new Set([...(r.cond ? r.cond.ids : []), ...[...(r.cond ? r.cond.calls : new Map()).values()].flat(2).map(String)])] });
        }
      });
      G.on("witness.beat", (e) => { if (R.witness) R.witness.played.push(e.node); });
      G.on("witness.close", () => { if (R.witness) R.witness.closed = true; });
    }
    // the ending (tools/endingcheck.mjs): each era 5 ending node as it is entered, with the state that holds then
    // (era 4 and 5 marks, the said.e5 words, the class, the fates fallen), and every line shown in those nodes
    if (G.memory && G.memory.visit) {
      const ENDING = /^e5\.(ends?$|end\.|shop$|w\.)/, visit = G.memory.visit.bind(G.memory), log0 = G.memory.log.bind(G.memory);
      G.memory.visit = (id) => {
        if (ENDING.test(id)) (R.e5end ||= []).push({ node: id, cls: G.scope.get("var.q_class"), flags: G.state.flags.filter((f) => /^(e[45]\.|said\.e5_)/.test(f)), fates: Object.keys((G.state.community && G.state.community.fates) || {}).filter((f) => /^f\.e5_/.test(f)) });
        return visit(id);
      };
      G.memory.log = (entry) => { if (entry && entry.node && ENDING.test(entry.node) && !entry.hidden) (R.e5lines ||= []).push({ node: entry.node, kind: entry.kind, who: entry.who || "", text: entry.text }); return log0(entry); };
    }
    if (!G.props) return;
    const seen = (R.props ||= []), log = G.memory.log.bind(G.memory);
    // the attentive player also puts a hand on what it can: every touch with no effects (a touch that changes the
    // story, a cut or a tie, is a choice the routes make, not the attentive player)
    const felt = (R.touches ||= []);
    if (G.burden) G.on("burden", (e) => { G.state.burdenPeak = Math.max(G.state.burdenPeak || 0, e.total); });
    G.on("prop.touch", (e) => (G.state.touchLog ||= []).push(`${e.id}:${e.kind}`));
    G.memory.log = (entry) => {
      const r = log(entry);
      for (const p of G.props.here()) {
        const s = G.props.state(p.id); if (s && !seen.includes(`${p.id}:${s.id}`)) { seen.push(`${p.id}:${s.id}`); G.props.examine(p.id); }
        (p.touches || []).forEach((t, i) => { const k = `${p.id}:${t.kind}`; if (!t.effects && !felt.includes(k) && (!t.cond || evaluate(t.cond, G.scope))) { felt.push(k); G.props.touch(p.id, i); } });
      }
      return r;
    };
  },
  report(r) {
    const out = [];
    if (r.endings) out.push(`class ${r.endings.class}; reported ${r.endings.report}; the door ${r.endings.door}; the Haldane table: ${r.table ? r.table.haldane : "?"} bowls`);
    if (r.record) out.push(`record: ${r.record.join(", ") || "none"}`);
    return out;
  },
};
