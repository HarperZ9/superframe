// Expressions and effects for Low Water content. A superset of the LWD/0 condition grammar.
//
//   const c = compile("has(met.keel) & tide < -0.27 | hour >= 23:30");
//   evaluate(c, scope)          // scope: { get(name), call(name, args, scope) }
//   const e = compileEffects("xp(10); rep.guild += 5; set(seen.lamp)");
//   runEffects(e, scope)        // scope also needs assign(name, value)
//
// Grammar (lowest to highest): or (| || or), and (& && and), not (! not), comparison
// (< <= > >= == !=), sum (+ -), product (* / %), unary minus, primary. Primaries: numbers,
// times (hh:mm, read on the night's clock: before 12:00 counts as after midnight), strings in
// double or single quotes, true / false, dotted names, calls name(args), parentheses.
// A bare name that resolves to nothing compares as its own spelling, so LWD/0's
// `power.quay == off` keeps working. A bare name that a variable declares among its values
// (@var values:) means that word when compared with or assigned to that variable, even when the
// same name is also a skill or a term (fate_mother = dark, seenas_guild == nose); the scope's
// isWord(variable, word) says so. Call arguments are passed unevaluated; the callee reads
// a bare name as a name (has(met.keel)) and anything else as a value.

// Clock minutes. A night book (meta clock in the evening) reads 00:00 to 11:59 as after
// midnight, as LWD/0 says. A day book (meta clock from 04:00 to 16:59, the playable daylight
// interlude) reads times more than six hours before its start as the next day, so 13:00 comes
// after 07:00. loadBook sets the pivot from @meta clock before it parses.
let PIVOT = 12;
export const pivotFor = (startHour) => (startHour >= 17 || startHour < 4 ? 12 : (startHour + 18) % 24);
export const setClockPivot = (h) => { PIVOT = h; };
export const clockPivot = () => PIVOT;
export const toMin = (s) => { const [h, m] = s.split(":").map(Number); return (h < PIVOT ? h + 24 : h) * 60 + m; };

const TOKEN = /\s*(?:(\d+:\d{2})|(\d+(?:\.\d+)?)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|([A-Za-z_][\w.]*)|(\|\||&&|<=|>=|==|!=|\+=|-=|\*=|[-+*/%<>=!&|(),;]))/y;

export function tokenize(src) {
  const toks = []; TOKEN.lastIndex = 0; let i = 0;
  while (i < src.length) {
    if (/^\s*$/.test(src.slice(i))) break;
    TOKEN.lastIndex = i; const m = TOKEN.exec(src);
    if (!m) throw new SyntaxError(`unexpected "${src.slice(i).trim().slice(0, 12)}" in: ${src}`);
    i = TOKEN.lastIndex;
    if (m[1]) toks.push({ t: "time", v: toMin(m[1]) });
    else if (m[2]) toks.push({ t: "num", v: +m[2] });
    else if (m[3]) toks.push({ t: "str", v: m[3].slice(1, -1).replace(/\\(.)/g, "$1") });
    else if (m[4]) toks.push(WORD_OPS[m[4]] ? { t: "op", v: WORD_OPS[m[4]] } : { t: "id", v: m[4] });
    else toks.push({ t: "op", v: m[5] });
  }
  return toks;
}
const WORD_OPS = { and: "&", or: "|", not: "!" };
const NORM = { "||": "|", "&&": "&" };

function parser(toks, src) {
  let p = 0;
  const peek = () => toks[p], isOp = (v) => toks[p] && toks[p].t === "op" && (NORM[toks[p].v] || toks[p].v) === v;
  const fail = (msg) => { throw new SyntaxError(`${msg} in: ${src}`); };
  const expect = (v) => { if (!isOp(v)) fail(`expected "${v}"`); p++; };
  function or() { let a = and(); while (isOp("|")) { p++; a = { k: "or", a, b: and() }; } return a; }
  function and() { let a = not(); while (isOp("&")) { p++; a = { k: "and", a, b: not() }; } return a; }
  function not() { if (isOp("!")) { p++; return { k: "not", a: not() }; } return cmp(); }
  function cmp() {
    const a = sum();
    for (const op of ["<=", ">=", "==", "!=", "<", ">"]) if (isOp(op)) { p++; return { k: "cmp", op, a, b: sum() }; }
    if (isOp("=") && toks[p + 1] && toks[p + 1].t !== "op") { p++; return { k: "cmp", op: "==", a, b: sum() }; }
    return a;
  }
  function sum() { let a = prod(); while (isOp("+") || isOp("-")) { const op = toks[p++].v; a = { k: "bin", op, a, b: prod() }; } return a; }
  function prod() { let a = unary(); while (isOp("*") || isOp("/") || isOp("%")) { const op = toks[p++].v; a = { k: "bin", op, a, b: unary() }; } return a; }
  function unary() { if (isOp("-")) { p++; return { k: "neg", a: unary() }; } return primary(); }
  function primary() {
    const t = peek(); if (!t) fail("unexpected end");
    if (t.t === "num" || t.t === "time" || t.t === "str") { p++; return { k: "lit", v: t.v }; }
    if (isOp("(")) { p++; const e = or(); expect(")"); return e; }
    if (t.t === "id") {
      p++;
      if (t.v === "true" || t.v === "false") return { k: "lit", v: t.v === "true" };
      if (isOp("(")) {
        p++; const args = [];
        if (!isOp(")")) { do { args.push(or()); } while (isOp(",") && ++p); }
        expect(")"); return { k: "call", name: t.v, args };
      }
      return { k: "id", name: t.v };
    }
    fail(`unexpected "${t.v}"`);
  }
  return { or, sum, peek, isOp, get p() { return p; }, set p(v) { p = v; }, fail, expect };
}

export function compile(src) {
  if (src == null || String(src).trim() === "") return null;
  const toks = tokenize(String(src)), P = parser(toks, src), ast = P.or();
  if (P.p < toks.length) P.fail(`unexpected "${toks[P.p].v}"`);
  return { src: String(src), ast, ...names(ast) };
}

// Every name and call in an expression, for the validator.
export function names(ast, out = { ids: new Set(), calls: new Map(), words: new Set() }) {
  if (!ast) return out;
  if (ast.k === "id") out.ids.add(ast.name);
  if (ast.k === "cmp" && (ast.op === "==" || ast.op === "!=") && ast.b.k === "id") out.words.add(ast.b.name);
  if (ast.k === "call") { const l = out.calls.get(ast.name) || []; l.push(ast.args.map(argName)); out.calls.set(ast.name, l); ast.args.forEach((x) => { if (x.k !== "id") names(x, out); }); return out; }
  for (const k of ["a", "b"]) if (ast[k]) names(ast[k], out);
  if (ast.list) ast.list.forEach((s) => names(s, out));
  if (ast.value) { if (ast.k === "assign" && ast.value.k === "id") out.words.add(ast.value.name); names(ast.value, out); }
  return out;
}
export const argName = (a) => (a.k === "id" ? a.name : a.k === "lit" ? a.v : null);

export function evaluate(c, scope) {
  if (!c) return true;
  return ev(c.ast || c, scope);
}
function ev(n, S) {
  switch (n.k) {
    case "lit": return n.v;
    case "id": { const v = S.get(n.name); return v === undefined ? undefined : v; }
    case "not": return !truthy(ev(n.a, S));
    case "and": return truthy(ev(n.a, S)) && truthy(ev(n.b, S));
    case "or": return truthy(ev(n.a, S)) || truthy(ev(n.b, S));
    case "neg": return -num(ev(n.a, S));
    case "bin": { const a = num(ev(n.a, S)), b = num(ev(n.b, S)); return n.op === "+" ? a + b : n.op === "-" ? a - b : n.op === "*" ? a * b : n.op === "/" ? (b ? a / b : 0) : b ? a % b : 0; }
    case "cmp": return compare(n, S);
    case "call": return S.call(n.name, n.args, S);
    default: throw new Error(`expr: unknown node ${n.k}`);
  }
}
function compare(n, S) {
  const word = (x, y) => x.k === "id" && y.k === "id" && S.isWord && S.isWord(x.name, y.name);
  let a = word(n.b, n.a) ? n.a.name : ev(n.a, S), b = word(n.a, n.b) ? n.b.name : ev(n.b, S);
  if (a === undefined && n.a.k === "id") a = n.a.name;
  if (b === undefined && n.b.k === "id") b = n.b.name;
  if (typeof a === "boolean" && typeof b === "number") a = +a;
  if (typeof b === "boolean" && typeof a === "number") b = +b;
  switch (n.op) {
    case "==": return a == b; // eslint-disable-line eqeqeq
    case "!=": return a != b; // eslint-disable-line eqeqeq
    case "<": return num(a) < num(b);
    case "<=": return num(a) <= num(b);
    case ">": return num(a) > num(b);
    default: return num(a) >= num(b);
  }
}
export const truthy = (v) => !(v === undefined || v === null || v === false || v === 0 || v === "");
const num = (v) => (typeof v === "number" ? v : typeof v === "boolean" ? +v : v == null ? 0 : isNaN(+v) ? 0 : +v);

// Reads a call argument: a bare name is its name, anything else its value.
export const argOf = (a, S) => (a.k === "id" ? a.name : ev(a, S));
export const valueOf = (a, S) => { const v = ev(a, S); return v === undefined && a.k === "id" ? a.name : v; };

// ---------------------------------------------------------------- effects
// Statements separated by ";": name = expr, name += expr, name -= expr, name *= expr, or a call.
export function compileEffects(src) {
  if (src == null || String(src).trim() === "") return null;
  const toks = tokenize(String(src)), P = parser(toks, src), list = [];
  while (P.p < toks.length) {
    if (P.isOp(";")) { P.p++; continue; }
    const t = toks[P.p], nx = toks[P.p + 1];
    if (t.t === "id" && nx && nx.t === "op" && ["=", "+=", "-=", "*="].includes(nx.v)) {
      P.p += 2; list.push({ k: "assign", name: t.v, op: nx.v, value: P.or() });
    } else {
      const e = P.or(); if (e.k !== "call") P.fail("an effect is an assignment or a call");
      list.push(e);
    }
    if (P.p < toks.length && !P.isOp(";")) P.fail(`expected ";" before "${toks[P.p].v}"`);
  }
  const ast = { k: "effects", list };
  return { src: String(src), ast, ...names(ast), targets: list.filter((s) => s.k === "assign").map((s) => s.name) };
}
export function runEffects(c, scope) {
  if (!c) return;
  for (const s of c.ast.list) {
    if (s.k === "call") { scope.call(s.name, s.args, scope); continue; }
    if (s.op === "=" && s.value.k === "id" && scope.isWord && scope.isWord(s.name, s.value.name)) { scope.assign(s.name, s.value.name); continue; }
    const v = ev(s.value, scope), cur = num(scope.get(s.name));
    scope.assign(s.name, s.op === "=" ? (v === undefined && s.value.k === "id" ? s.value.name : v) : s.op === "+=" ? cur + num(v) : s.op === "-=" ? cur - num(v) : cur * num(v));
  }
}
