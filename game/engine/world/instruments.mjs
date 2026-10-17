// Instruments as data: the Kit's voices, read with a key in the world or a read: line in
// dialogue. The first say line whose condition holds is spoken. Text may hold {{expression}}
// parts, filled in from the scope (numbers to two places).
//   @instrument id   name, key (KeyT), about
//                    say: text {when: cond, set: fact}      (repeatable, first match wins)
import { splitAttrs } from "../dialogue/parse.mjs";
import { compile, compileEffects, evaluate, runEffects } from "../core/expr.mjs";

export function loadInstruments(book) {
  const out = {}, errors = [];
  for (const r of Object.values((book.records || {}).instrument || {})) {
    const g = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
    try {
      out[r.id] = { id: r.id, name: g("name") || r.id.toUpperCase(), key: g("key") || null, about: g("about") || "",
        says: r.kv.filter((e) => e.key === "say").map((e) => { const { body, attrs } = splitAttrs(e.value); return { text: body.trim(), cond: compile(attrs.when), effects: attrs.set ? compileEffects(`set(${attrs.set})`) : null, line: e.line }; }) };
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `instrument ${r.id}: ${e.message}` }); }
  }
  return { instruments: out, errors };
}

export function fill(text, scope) {
  return String(text).replace(/\{\{(.+?)\}\}/g, (_, src) => {
    try {
      const v = evaluate(compile(src), scope);
      if (/^\s*(clock|hour|time)\s*$/.test(src)) { const c = Math.floor(+v || 0); return `${String(Math.floor(c / 60) % 24).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`; }
      return typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(v ?? ""); }
    catch (e) { console.warn(`text: could not fill {{${src}}}: ${e.message}`); return `{{${src}}}`; }
  });
}

export function createInstruments(G, instruments) {
  return {
    list: () => Object.values(instruments),
    read(id) {
      const ins = instruments[id]; if (!ins) return null;
      const say = ins.says.find((s) => !s.cond || evaluate(s.cond, G.scope)); if (!say) return null;
      if (say.effects) runEffects(say.effects, G.scope);
      const out = { who: ins.name, text: fill(say.text, G.scope), id };
      G.emit("instrument", out);
      return out;
    },
  };
}
