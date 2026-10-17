// LWD text to records and steps. Reads LWD/0 (slice/LWD-FORMAT.md) and LWD/1, its superset.
// Every record and step keeps its file and line, so the validator can point at the text.
import { compile, compileEffects } from "../core/expr.mjs";

// Lines to records: { kind, id, file, line, kv: [{ key, value, line }] }.
export function parseRecords(text, file = "") {
  const recs = [], errors = []; let cur = null;
  String(text).split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trimEnd(), n = i + 1;
    if (!line.trim() || line.trimStart().startsWith("#")) return;
    if (line.startsWith("@")) { const [kind, id = ""] = line.slice(1).trim().split(/\s+/, 2); cur = { kind, id, file, line: n, kv: [] }; recs.push(cur); return; }
    if (!cur) { errors.push({ file, line: n, msg: "content before any record" }); return; }
    const k = line.indexOf(":");
    if (k < 0) { errors.push({ file, line: n, msg: `expected "key: value", got "${line.trim().slice(0, 40)}"` }); return; }
    const value = line.slice(k + 1).replace(/^ /, "");
    cur.kv.push({ key: line.slice(0, k).trim(), value, line: n });
  });
  return { recs, errors };
}

// Trailing attribute block: `... {once, dc: 12, do: xp(5); rep(guild, 2)}`.
export function splitAttrs(v) {
  const m = v.match(/\s*\{([^{}]*)\}\s*$/);
  if (!m) return { body: v, attrs: {} };
  return { body: v.slice(0, m.index), attrs: parseAttrs(m[1]) };
}
export function parseAttrs(src) {
  const out = {}, parts = []; let depth = 0, q = null, cur = "";
  for (const ch of src) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") q = ch;
    if (ch === "(") depth++; else if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  for (const p of parts) {
    const k = p.indexOf(":");
    if (k < 0) out[p.trim()] = true;
    else { const v = p.slice(k + 1).trim(); out[p.slice(0, k).trim()] = /^-?\d+(\.\d+)?$/.test(v) ? +v : v; }
  }
  return out;
}

const TARGET = "[\\w.^]+";
const OPT_RE = new RegExp(`^"([^"]*)"\\s*->\\s*(${TARGET})(?:\\s*\\/\\s*(${TARGET}))?(?:\\s*\\?\\s*(.*?))?(?:\\s+\\+(\\d+))?\\s*$`);

// A choice line: opt, claim or check.  "label" -> target [/ fail] [? cond] [+n] [{attrs}]
export function parseChoice(kind, value, at) {
  const { body, attrs } = splitAttrs(value), m = body.trim().match(OPT_RE);
  if (!m) throw new SyntaxError(`${kind}: expected "label" -> target, got ${value}`);
  const s = { kind, label: m[1], target: m[2], fail: m[3] || null, cond: compile(m[4] && m[4].trim()), cost: m[5] ? +m[5] : 0, attrs, ...at };
  if (attrs.do) s.effects = compileEffects(attrs.do);
  // {show: cond} hides any choice until it holds. On a claim the condition picks the outcome,
  // so {when: cond} on a claim also only hides it (R13); on opt and check it joins the condition.
  const show = [attrs.show, kind === "claim" ? attrs.when : null].filter((x) => typeof x === "string" && x.trim());
  s.show = show.length ? compile(show.map((x) => `(${x})`).join(" & ")) : null;
  if (attrs.when && kind !== "claim") s.cond = s.cond ? compile(`(${s.cond.src}) & (${attrs.when})`) : compile(attrs.when);
  if (kind === "check") {
    if (!attrs.skill) throw new SyntaxError(`check: needs {skill: name, dc: n}: ${value}`);
    if (!s.fail) throw new SyntaxError(`check: needs "-> pass / fail": ${value}`);
  }
  if (kind === "claim" && !s.fail) throw new SyntaxError(`claim: needs "-> ok / fail": ${value}`);
  return s;
}

const speakerOf = (v) => { const k = v.indexOf(": "); return k < 0 ? { who: "", text: v } : { who: v.slice(0, k).trim(), text: v.slice(k + 2) }; };

// One node line to a step.
export function parseStep(key, value, at) {
  const v = value.trim();
  switch (key) {
    case "opt": case "claim": case "check": return parseChoice(key, value, at);
    case "alt": {
      const m = v.match(new RegExp(`^(${TARGET})\\s*\\?\\s*(.*)$`)); if (!m) throw new SyntaxError(`alt: expected "target ? cond", got ${v}`);
      return { kind: "alt", target: m[1], cond: compile(m[2]), ...at };
    }
    case "when": return { kind: "when", cond: compile(v), ...at };
    case "do": return { kind: "do", effects: compileEffects(v), ...at };
    case "if": { // if: cond => effects
      const k = v.indexOf("=>"); if (k < 0) throw new SyntaxError(`if: expected "cond => effects", got ${v}`);
      return { kind: "if", cond: compile(v.slice(0, k)), effects: compileEffects(v.slice(k + 2)), ...at };
    }
    // nar, line and inst take {when: cond} and {once} like voice lines (R15); the block never prints
    case "line": case "inst": { const { body, attrs } = splitAttrs(value); return { kind: key, ...speakerOf(body), attrs, cond: compile(attrs.when), once: !!attrs.once, ...at }; }
    case "nar": { const { body, attrs } = splitAttrs(value); return { kind: "nar", value: body.trim(), attrs, cond: compile(attrs.when), once: !!attrs.once, ...at }; }
    case "voice": { // voice: SKILL: text {dc: n, below: n, when: cond, once}
      const { body, attrs } = splitAttrs(value), sp = speakerOf(body);
      return { kind: "voice", skill: sp.who, text: sp.text, dc: attrs.dc ?? null, below: attrs.below ?? null, cond: compile(attrs.when), once: !!attrs.once, attrs, ...at };
    }
    case "passive": { // passive: SKILL -> node {dc: n, when: cond}
      const { body, attrs } = splitAttrs(value), m = body.trim().match(new RegExp(`^([\\w.]+)\\s*->\\s*(${TARGET})$`));
      if (!m) throw new SyntaxError(`passive: expected "skill -> node {dc: n}", got ${v}`);
      return { kind: "passive", skill: m[1], target: m[2], dc: attrs.dc ?? null, cond: compile(attrs.when), once: attrs.once !== false, attrs, ...at };
    }
    case "set": case "clear": return { kind: key, value: v, effects: compileEffects(`${key}(${v})`), ...at };
    case "xp": return { kind: "do", effects: compileEffects(`xp(${v})`), ...at };
    case "cost": return { kind: "cost", value: +v, ...at };
    case "cmd": return { kind: "cmd", args: v.split(/\s+/), ...at };
    case "return": return { kind: "return", ...at };
    case "go": case "call": case "end": case "exit": case "place": case "read": case "else":
    case "speaker": case "hub": case "title": case "note": case "camera":
      return { kind: key, value: v, ...at };
    default: return { kind: "unknown", key, value: v, ...at };
  }
}
