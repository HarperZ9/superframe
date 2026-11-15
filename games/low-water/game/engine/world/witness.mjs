// The witness scene (design/spine-plan/02-WITNESS.md): the read-back played as a scene. A person who saw part of
// the day tells it to someone years later, in her own words, at her own table, with the player's character
// sitting there old. The ledger the read-back used to show (world/readback.mjs) stays underneath as the oracle:
// the checker proves every row it would print is answered by a beat she speaks, or is declared unwitnessed.
//
//   @witness q.w.anni
//   who: ANNI                                   the witness (a speaker)
//   listener: DAUGHTER                          who she tells it to
//   guest: q_class inspector=NED militia=WILL   the player's character, old, at the table
//   place: q_anni_room                          where she lives then
//   opens: q.w.anni.open                        the first node (the object that starts it)
//   dispatch: q.w.anni.next                     the node that plays the beats in order: do: wnext(), then an
//                                               alt per beat, "alt: <beat> ? wat(<beat>)", then go: <last>
//   reach: q_post, q_haldane                    places she saw with her own eyes
//   sources: BET, ILO                           people she heard things from
//   never: q_returns, q_cells                   places she never was: a beat seen there is a lie the game tells
//   beat: <node> | <answers> | seen <place> ? <condition>      or  | heard <SOURCE> ?
//                                               answers: the flags and variables the beat speaks for (the oracle)
//   last: q.w.anni.tin                          the last beat: the effect that keeps moving
//   unwitnessed: <ids> | <why>                  state the ledger reads that no beat answers, and why
//   oracle: q.record                            the @readback whose rows the beats must answer
//
// A beat node may echo a self-lie: a voice step tagged {echo: <selflie id>, when: toldself(<id>)} replays the line
// the character heard, word for word, quiet, and she talks on over it. No caption says whether it was true.
// Calls: witness(<id>) opens it with the beats whose conditions hold now; wnext() moves to the next beat; wat(<node>)
// is true while that beat is the current one; wend() closes it from the script. Events: witness.open { id, beats },
// witness.beat { i, node }, witness.close { id }; self.restored { id } when a beat echoes a self-lie.
// Unskippable (for the talk panel): gate.next(now) shows the next beat only after the last one has held for its
// reading time (0.6 s plus 0.25 s a word); gate.close(now) refuses until every beat has been shown and read.
// State: G.state.witness = { id, beats, i, shown, closed, ui }.
import { compile, evaluate } from "../core/expr.mjs";
import { registerCalls } from "../core/scope.mjs";

const kvOf = (r, k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
const list = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);
const KEYS = ["who", "listener", "guest", "place", "opens", "dispatch", "reach", "sources", "never", "beat", "last", "unwitnessed", "oracle"];

export function loadWitness(book) {
  const witnesses = {}, errors = [];
  for (const r of Object.values((book.records || {}).witness || {})) {
    try {
      for (const e of r.kv) if (!KEYS.includes(e.key)) throw new SyntaxError(`line ${e.line}: unknown key "${e.key}"`);
      const beats = r.kv.filter((e) => e.key === "beat").map((e) => {
        const q = e.value.lastIndexOf(" ? "), body = q >= 0 ? e.value.slice(0, q) : e.value, src = q >= 0 ? e.value.slice(q + 3).trim() : null;
        const parts = body.split("|").map((s) => s.trim());
        if (parts.length !== 3) throw new SyntaxError(`line ${e.line}: beat: expected "<node> | <answers> | seen <place> or heard <SOURCE> [? condition]"`);
        const how = parts[2].match(/^(seen|heard)\s+(\S+)$/);
        if (!how) throw new SyntaxError(`line ${e.line}: beat ${parts[0]}: how she knows it is "seen <place>" or "heard <SOURCE>", got "${parts[2]}"`);
        return { node: parts[0], answers: list(parts[1]), how: how[1], at: how[2], src, cond: compile(src), line: e.line };
      });
      const unw = r.kv.filter((e) => e.key === "unwitnessed").map((e) => { const [ids, why] = e.value.split("|"); return { ids: list(ids), why: (why || "").trim(), line: e.line }; });
      const W = { id: r.id, who: kvOf(r, "who"), listener: kvOf(r, "listener"), guest: kvOf(r, "guest") || "", place: kvOf(r, "place"), opens: kvOf(r, "opens"), dispatch: kvOf(r, "dispatch"),
        reach: list(kvOf(r, "reach")), sources: list(kvOf(r, "sources")), never: list(kvOf(r, "never")), beats, last: kvOf(r, "last"), unwitnessed: unw, oracle: kvOf(r, "oracle") || "", file: r.file, line: r.line };
      for (const k of ["who", "listener", "opens", "dispatch"]) if (!W[k]) throw new SyntaxError(`needs ${k}:`);
      if (!W.last) throw new SyntaxError("needs last: (the beat that ends it, the effect that keeps moving)");
      if (!beats.length) throw new SyntaxError("needs beat:");
      witnesses[r.id] = W;
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `witness ${r.id}: ${e.message}` }); }
  }
  return { witnesses, errors };
}

// the words a beat node shows (every nar, line and voice step whose condition holds), for its reading time
export const beatWords = (node, holds = () => true) => (node ? (node.steps || []).filter((s) => ["nar", "line", "voice"].includes(s.kind) && (!s.cond || holds(s.cond))).map((s) => s.value || s.text || "").join(" ").split(/\s+/).filter(Boolean).length : 0);
export const beatMs = (node, holds) => 600 + 250 * beatWords(node, holds);

registerCalls({
  witness: (G, [id]) => { if (G.witness) G.witness.open(id); },
  wnext: (G) => { if (G.witness) G.witness.advance(); },
  wat: (G, [node]) => !!(G.witness && G.witness.current() === node),
  wend: (G) => { if (G.witness) G.witness.end(); },
}, { witness: "witness", wat: "node" });

export function installWitness(G, W) {
  if (G.witness) return G.witness;
  const S = G.state, holds = (b) => !b.cond || !!evaluate(b.cond, G.scope);
  const shows = (c) => { try { return !!evaluate(c, G.scope); } catch { return false; } };
  const echoes = {}; // beat node -> self-lie ids it echoes
  for (const w of Object.values(W)) for (const b of w.beats) { const n = G.book.nodes[b.node]; if (n) echoes[b.node] = (n.steps || []).filter((s) => s.kind === "voice" && s.attrs && s.attrs.echo).map((s) => String(s.attrs.echo)); }
  const api = {
    records: W,
    open(id) {
      const w = W[id]; if (!w) throw new Error(`no @witness ${id}`);
      const beats = w.beats.filter(holds).map((b) => b.node);
      S.witness = { id, beats, i: -1, shown: [], closed: false, ui: { shown: 0, lastAt: null } };
      G.emit("witness.open", { id, beats: beats.length });
      return beats;
    },
    isOpen: () => !!(S.witness && !S.witness.closed),
    current: () => (S.witness && S.witness.i >= 0 ? S.witness.beats[S.witness.i] || null : null),
    // the script moves on to the next beat (the dispatch node's do:)
    advance() {
      const X = S.witness; if (!X || X.closed) return null;
      X.i++; const node = X.beats[X.i]; if (!node) return null;
      X.shown.push(node); G.emit("witness.beat", { i: X.i, node });
      for (const sl of echoes[node] || []) if ((S.selfLies || []).some((x) => x.id === sl)) G.emit("self.restored", { id: sl });
      return node;
    },
    end() { const X = S.witness; if (!X || X.closed) return; X.closed = true; G.emit("witness.close", { id: X.id }); },
    done: () => !!(S.witness && S.witness.i >= S.witness.beats.length - 1),
    // the talk panel's gate: unskippable and closed only when read (no verdict, no skip; pausing is allowed)
    gate: {
      next(now = Date.now()) {
        const X = S.witness; if (!X || X.closed) return null; const U = X.ui;
        if (U.shown >= X.beats.length) return null;
        if (U.shown > 0 && U.lastAt != null && now - U.lastAt < beatMs(G.book.nodes[X.beats[U.shown - 1]], shows)) return null;
        const node = X.beats[U.shown++]; U.lastAt = now; return node;
      },
      close(now = Date.now()) {
        const X = S.witness; if (!X) return true; const U = X.ui;
        if (U.shown < X.beats.length) return false;
        if (U.shown > 0 && now - U.lastAt < beatMs(G.book.nodes[X.beats[U.shown - 1]], shows)) return false;
        return true;
      },
    },
  };
  G.witness = api;
  return api;
}
