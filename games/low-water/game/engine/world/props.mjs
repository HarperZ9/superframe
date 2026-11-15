// Props that carry story (design/PITCHES.md 3c.1, design/quota/04-SYSTEMS.md section 8). The object rule:
// every interactable thing tells something about a person or an era. A @prop has a state per era, and a
// state may also depend on the world (the community model, flags, a fact carried from an earlier run).
//
//   @prop q.haldane_bowls
//   name: The bowls
//   place: q_haldane                  the place it stands in
//   mark: table                       the plate mark it stands on (the plate's marks.spots ids)
//   tells: household haldane          whose story it carries: person <@char id>, household <id>, or era
//   verb: Look at the bowls           the label offered (default "Look at <name>")
//   state: 1 five | Five bowls, matched ...                       era, state id, the text when examined
//   state: 2 four ? bowls(haldane) == 4 | Four bowls ... {gives: q.lore.bowls}
//   state: 2 five | ...                                           the era's last state is its fallback
//   from: 4                           the first era the prop exists in (era 4's props, 2026-10-22); earlier eras need no state
//   in: 5 q5_shop                     where it stands in that era, when not its place: (repeatable; era 5's table is in
//                                     the antique shop's window, 2026-10-23); its mark: is for place: only
//   carries: touch                    what the thing carries to the senses (sight touch weight sound smell heat; the
//                                     device rule, 2026-10-23: a prop is a thing in the world, never a document to read)
//   touch: hold "Hold the thread" [? cond] | The thread is soft as hair, and warm from her wrist. {sense: thread.hold, do: ..., gives: ...}
//                                     a hand on the thing (hold cut tie lift press wipe turn open smell listen; repeatable):
//                                     its own verb on the prop's object, its line, its cue and effects (tools/devicecheck.mjs)
//   macro: 2.4 2.2 [0.9]              optional: the close look (ui/examinecam.mjs): a slow push-in on the mark over
//                                     2.4 s to 2.2 times closer, a shallow-focus request, the text once it settles;
//                                     skippable by any input, off under reduced motion. Needs a mark.
//
// The first state of the current era whose condition holds is the prop's state. Attributes on a state:
// gives (lore fragments, world/lore.mjs), do (effects). Examining sets seen.<prop> and seen.<prop>.<state>,
// emits prop.examine { id, state, era, tells }, and adds the text to the scene as narration (a line with
// macro: { secs, zoom, place, mark } when the prop has one). Each prop is
// also an @object with one verb, examine, so the shell offers it where the other verbs are offered.
// The era is var.era, else @meta era, else 1; era() reads it in conditions.
//   G.props.state(id) -> { era, id, text, gives, effects } | null   G.props.examine(id) -> lines
//   G.props.here(place) -> props at a place                        tools/proplint.mjs checks the records
import { compile, compileEffects, evaluate, runEffects } from "../core/expr.mjs";
import { splitAttrs } from "../dialogue/parse.mjs";
import { registerCalls } from "../core/scope.mjs";

const TELLS = ["person", "household", "era"];
export const SENSES = ["sight", "touch", "weight", "sound", "smell", "heat"];
export const TOUCH = ["hold", "cut", "tie", "lift", "press", "wipe", "turn", "open", "smell", "listen"];
// one touch line: '<kind> "<label>" [? cond] | text {attrs}'
export function parseTouch(value, line) {
  const { body, attrs } = splitAttrs(value), bar = body.indexOf("|");
  if (bar < 0) throw new SyntaxError(`line ${line}: touch: expected <kind> "<label>" [? condition] | text`);
  const m = body.slice(0, bar).trim().match(/^(\w+)\s+"([^"]+)"(?:\s*\?\s*(.+))?$/);
  if (!m || !TOUCH.includes(m[1])) throw new SyntaxError(`line ${line}: touch: expected <kind> "<label>" [? condition] (kinds: ${TOUCH.join(", ")})`);
  return { kind: m[1], label: m[2], when: m[3] ? m[3].trim() : null, cond: compile(m[3] ? m[3].trim() : null), text: body.slice(bar + 1).trim(), cue: attrs.sense ? String(attrs.sense) : null, gives: list(attrs.gives), effects: compileEffects(attrs.do), line };
}
const list = (v) => (v ? String(v).split(",").map((s) => s.trim()).filter(Boolean) : []);

// one state line: "<era> <id> [? cond] | text {attrs}"
export function parseState(value, line) {
  const { body, attrs } = splitAttrs(value);
  const bar = body.indexOf("|"); if (bar < 0) throw new SyntaxError(`line ${line}: state: expected "<era> <id> [? condition] | text"`);
  const head = body.slice(0, bar).trim(), text = body.slice(bar + 1).trim();
  const m = head.match(/^(\d+)\s+([\w.-]+)(?:\s*\?\s*(.+))?$/); if (!m) throw new SyntaxError(`line ${line}: state: expected "<era> <id> [? condition]" before the bar`);
  return { era: +m[1], id: m[2], when: m[3] ? m[3].trim() : null, cond: compile(m[3] ? m[3].trim() : null), text, gives: list(attrs.gives), effects: compileEffects(attrs.do), line };
}

export function loadProps(book) {
  const props = {}, objects = {}, errors = [];
  for (const r of Object.values((book.records || {}).prop || {})) {
    try {
      const one = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
      for (const e of r.kv) if (!["name", "place", "mark", "tells", "verb", "state", "about", "macro", "from", "in", "carries", "touch"].includes(e.key)) throw new SyntaxError(`line ${e.line}: unknown key "${e.key}"`);
      const tells = (one("tells") || "").split(/\s+/).filter(Boolean);
      if (!TELLS.includes(tells[0])) throw new SyntaxError(`tells: expected person <id>, household <id> or era (the object rule: every prop tells about a person or an era)`);
      if (tells[0] !== "era" && !tells[1]) throw new SyntaxError(`tells: ${tells[0]} needs an id`);
      const states = r.kv.filter((e) => e.key === "state").map((e) => parseState(e.value, e.line));
      if (!states.length) throw new SyntaxError("needs at least one state:");
      const name = one("name") || r.id, mc = one("macro") != null ? one("macro").split(/\s+/).filter(Boolean).map(Number) : null;
      if (mc && (mc.some((x) => !Number.isFinite(x)) || !one("mark"))) throw new SyntaxError("macro: expected [seconds] [zoom], on a prop with a mark: to push in on");
      const macro = mc ? { secs: mc[0] || 2.4, zoom: mc[1] || 2.2, ...(mc[2] != null && { height: mc[2] }) } : null;
      const from = one("from") != null ? +one("from") : null; if (from != null && !(from >= 1)) throw new SyntaxError("from: expected the first era the prop exists in");
      const places = {};
      for (const e of r.kv.filter((x) => x.key === "in")) { const m = e.value.trim().match(/^(\d+)\s+([\w.-]+)$/); if (!m) throw new SyntaxError(`line ${e.line}: in: expected "<era> <place>"`); places[+m[1]] = m[2]; }
      const sense = one("carries") || null; if (sense && !SENSES.includes(sense)) throw new SyntaxError(`carries: ${sense} (one of ${SENSES.join(", ")})`);
      const touches = r.kv.filter((e) => e.key === "touch").map((e) => parseTouch(e.value, e.line));
      props[r.id] = { id: r.id, name, place: one("place") || null, places, mark: one("mark") || null, macro, from, sense, touches, tells: { kind: tells[0], id: tells[1] || null }, label: one("verb") || `Look at ${name.replace(/^The /, "the ")}`, states, file: r.file, line: r.line };
      const bare = { attrs: {}, effects: null, gone: null, needs: [], uses: [], give: [], once: false, noise: 0, until: null };
      objects[r.id] = { id: r.id, name, place: one("place") || null, places, area: null, at: null, about: "", prop: true, file: r.file, line: r.line,
        verbs: [{ kind: "examine", label: props[r.id].label, cond: null, ...bare, line: r.line },
          ...touches.map((t, i) => ({ kind: "touch", label: t.label, cond: t.cond, ...bare, attrs: { touch: i }, noise: t.kind === "cut" || t.kind === "lift" ? 0.2 : 0, line: t.line }))] };
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `prop ${r.id}: ${e.message}` }); }
  }
  return { props, objects, errors };
}

export const eraOf = (G) => +G.state.vars.era || +(G.book.meta || {}).era || 1;
// where a prop (or its examine object) stands in an era: its in: place for that era, else its place:
export const placeIn = (p, era) => (p.places && p.places[era]) || p.place;
registerCalls({ era: (G) => eraOf(G) });

export function installProps(G, props) {
  if (G.props) return G.props;
  const api = {
    all: props,
    here: (place = G.state.place) => { const era = eraOf(G); return Object.values(props).filter((p) => placeIn(p, era) === place); },
    state(id) {
      const p = props[id]; if (!p) throw new Error(`no prop ${id}`);
      const era = eraOf(G);
      return p.states.find((s) => s.era === era && (!s.cond || evaluate(s.cond, G.scope))) || null;
    },
    // examine: the lines it shows, and what it gives; a prop with no state in this era shows nothing
    examine(id) {
      const p = props[id], s = api.state(id); if (!s) return [];
      G.setFlag(`seen.${id}`, true); G.setFlag(`seen.${id}.${s.id}`, true);
      if (s.effects) runEffects(s.effects, G.scope);
      const at = placeIn(p, s.era), mark = at === p.place ? p.mark : null; // a mark belongs to place:'s plate
      G.emit("prop.examine", { id, state: s.id, era: s.era, tells: p.tells, place: at });
      for (const f of s.gives) if (G.lore) G.lore.find(f, { via: `prop:${id}` });
      return [{ kind: "nar", who: "", text: G.fill(s.text), prop: id, ...(p.macro && mark && { macro: { ...p.macro, place: at, mark } }) }];
    },
    // a hand on the thing: its line, its cue, its effects and lore; sets touched.<prop>.<kind>
    touch(id, i = 0) {
      const p = props[id], t = p && p.touches[i]; if (!t) throw new Error(`no touch ${i} on prop ${id}`);
      G.setFlag(`touched.${id}`, true); G.setFlag(`touched.${id}.${t.kind}`, true);
      if (t.effects) runEffects(t.effects, G.scope);
      G.emit("prop.touch", { id, kind: t.kind, label: t.label, place: placeIn(p, eraOf(G)) });
      if (t.cue && G.senses) G.senses.fire(t.cue, { via: `touch:${id}` });
      for (const f of t.gives) if (G.lore) G.lore.find(f, { via: `touch:${id}` });
      return t.text ? [{ kind: "nar", who: "", text: G.fill(t.text), prop: id, touch: t.kind }] : [];
    },
    // every prop at a place, looked at once each (the harness's attentive player, tools/quota/story.mjs)
    examineAll(place = G.state.place) { return api.here(place).flatMap((p) => api.examine(p.id)); },
  };
  G.props = api;
  return api;
}
