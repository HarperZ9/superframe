// SPDX-License-Identifier: FSL-1.1-MIT
// ======================================================================= Formula grammar
// Strict expression grammar, so typed text can never become arbitrary GLSL:
//   expr = term {(+|-) term}; term = unary {(*|/) unary}; unary = [+|-] pow; pow = atom [^ unary];
//   atom = number | name | func "(" args ")" | "(" expr ")".
// Output is rebuilt from the parse tree, so nothing the viewer typed is copied except validated numbers and names.
export const FX = {
  sin: 1,
  cos: 1,
  tan: 1,
  asin: 1,
  acos: 1,
  atan: 1,
  exp: 1,
  log: 1,
  sqrt: 1,
  abs: 1,
  floor: 1,
  fract: 1,
  sign: 1,
  sinh: 1,
  cosh: 1,
  tanh: 1,
  pow: 2,
  min: 2,
  max: 2,
  mod: 2,
  step: 2,
  atan2: 2,
};
export class FormulaError extends Error {
  constructor(m, at) {
    super(m);
    this.at = at;
  }
}
export function fParse(src, vars) {
  if (src.length > 240) throw new FormulaError("Too long: keep it under 240 characters.", 240);
  const toks = [];
  const re =
    /\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z_0-9]*)|(.))/gy;
  let m;
  while (re.lastIndex < src.length && (m = re.exec(src))) {
    if (m[1] === undefined && m[2] === undefined && m[3] === undefined) break;
    const at = m.index + m[0].length - (m[1] || m[2] || m[3]).length;
    if (m[1]) toks.push({ t: "n", v: m[1], at });
    else if (m[2]) toks.push({ t: "id", v: m[2], at });
    else {
      if (!"+-*/^(),".includes(m[3]))
        throw new FormulaError(
          `"${m[3]}" is not allowed. Use numbers, x y z r, + - * / ^, parentheses and the listed functions.`,
          at
        );
      toks.push({ t: m[3], at });
    }
  }
  let i = 0,
    nodes = 0;
  const peek = () => toks[i] || { t: "end", at: src.length };
  const take = (t) => {
    if (peek().t !== t)
      throw new FormulaError(
        t == ")" ? "Missing a closing parenthesis." : `Expected ${t} here.`,
        peek().at
      );
    return toks[i++];
  };
  const count = () => {
    if (++nodes > 120)
      throw new FormulaError(
        "Too many terms: the limit is 120, to keep compile time short.",
        peek().at
      );
  };
  function expr(d) {
    if (d > 24) throw new FormulaError("Nested too deeply.", peek().at);
    let a = term(d + 1);
    while (peek().t == "+" || peek().t == "-") {
      const op = toks[i++].t;
      count();
      a = { op, a, b: term(d + 1) };
    }
    return a;
  }
  function term(d) {
    let a = unary(d);
    while (peek().t == "*" || peek().t == "/") {
      const op = toks[i++].t;
      count();
      a = { op, a, b: unary(d) };
    }
    return a;
  }
  function unary(d) {
    if (peek().t == "-") {
      i++;
      count();
      return { op: "neg", a: unary(d + 1) };
    }
    if (peek().t == "+") {
      i++;
      return unary(d + 1);
    }
    return pw(d);
  }
  function pw(d) {
    const a = atom(d);
    if (peek().t == "^") {
      i++;
      count();
      return { op: "^", a, b: unary(d + 1) };
    }
    return a;
  }
  function atom(d) {
    const k = peek();
    count();
    if (k.t == "n") {
      i++;
      const v = parseFloat(k.v);
      if (!isFinite(v)) throw new FormulaError("That number is out of range.", k.at);
      return { num: v };
    }
    if (k.t == "(") {
      i++;
      const a = expr(d + 1);
      take(")");
      return a;
    }
    if (k.t == "id") {
      i++;
      const lc = k.v;
      if (peek().t == "(") {
        if (!(lc in FX))
          throw new FormulaError(
            `Unknown function "${lc}". Allowed: ${Object.keys(FX).join(", ")}.`,
            k.at
          );
        i++;
        const args = [expr(d + 1)];
        while (peek().t == ",") {
          i++;
          args.push(expr(d + 1));
        }
        take(")");
        if (args.length != FX[lc])
          throw new FormulaError(`${lc} takes ${FX[lc]} argument${FX[lc] > 1 ? "s" : ""}.`, k.at);
        return { fn: lc, args };
      }
      if (lc == "pi") return { num: Math.PI };
      if (lc == "e") return { num: Math.E };
      if (!vars.includes(lc))
        throw new FormulaError(
          `Unknown name "${lc}". Allowed here: ${vars.join(", ")}, pi, e.`,
          k.at
        );
      return { v: lc };
    }
    if (k.t == "end") throw new FormulaError("The formula ends too early.", k.at);
    throw new FormulaError(`Unexpected "${k.t}".`, k.at);
  }
  const a = expr(0);
  if (peek().t != "end")
    throw new FormulaError(`Unexpected text at position ${peek().at + 1}.`, peek().at);
  return a;
}
export const fNum = (v) => {
  let s = Math.abs(v).toFixed(8);
  return v < 0 ? `(-${s})` : s;
};
export function fGLSL(n) {
  if (n.num !== undefined) return fNum(n.num);
  if (n.v) return "v_" + n.v;
  if (n.fn) {
    const a = n.args.map(fGLSL);
    if (n.fn == "sign") return `(${a[0]}<0.?-1.:1.)`;
    if (n.fn == "atan2") return `atan(${a[0]},${a[1]})`;
    if (n.fn == "log") return `log(max(${a[0]},1e-6))`;
    if (n.fn == "sqrt") return `sqrt(max(${a[0]},0.))`;
    if (n.fn == "pow") return `spow(${a[0]},${a[1]})`;
    if (n.fn == "asin" || n.fn == "acos") return `${n.fn}(clamp(${a[0]},-1.,1.))`;
    return `${n.fn}(${a.join(",")})`;
  }
  if (n.op == "neg") return `(-${fGLSL(n.a)})`;
  if (n.op == "^") return `spow(${fGLSL(n.a)},${fGLSL(n.b)})`;
  if (n.op == "/") return `(${fGLSL(n.a)}/sdiv(${fGLSL(n.b)}))`;
  return `(${fGLSL(n.a)}${n.op}${fGLSL(n.b)})`;
}
export function fEval(n, e) {
  if (n.num !== undefined) return n.num;
  if (n.v) return e[n.v];
  if (n.fn) {
    const a = n.args.map((x) => fEval(x, e));
    const M = Math;
    switch (n.fn) {
      case "fract":
        return a[0] - M.floor(a[0]);
      case "mod":
        return a[0] - a[1] * M.floor(a[0] / a[1]);
      case "step":
        return a[1] < a[0] ? 0 : 1;
      case "atan2":
        return M.atan2(a[0], a[1]);
      default:
        return M[n.fn](...a);
    }
  }
  const a = fEval(n.a, e);
  if (n.op == "neg") return -a;
  const b = fEval(n.b, e);
  return n.op == "+"
    ? a + b
    : n.op == "-"
      ? a - b
      : n.op == "*"
        ? a * b
        : n.op == "/"
          ? a / b
          : Math.pow(a, b);
}
export const F_HELP = `float spow(float a,float b){return pow(max(abs(a),1e-6),b)*((a<0.&&mod(b,2.)==1.)?-1.:1.);}float sdiv(float a){return abs(a)<1e-6?1e-6:a;}`;
// Classifies the typed text: "z = h(x,y)", "n^2 = g(r,x,y,z)", or a level set "g(x,y,z)" or "g = 0" with inside negative.
export function fCompile(text) {
  const s = text.trim();
  if (!s) throw new FormulaError("Type a formula first.", 0);
  const parts = s.split("=");
  if (parts.length > 2)
    throw new FormulaError("Use at most one equals sign.", s.indexOf("=", s.indexOf("=") + 1));
  let kind, rhs;
  if (parts.length == 2) {
    const l = parts[0].replace(/\s/g, "").toLowerCase(),
      r = parts[1].trim();
    if (l == "z") {
      kind = "surface";
      rhs = r;
    } else if (l == "n^2" || l == "n2") {
      kind = "index";
      rhs = r;
    } else if (r == "0") {
      kind = "level";
      rhs = parts[0].trim();
    } else if (l == "0") {
      kind = "level";
      rhs = r;
    } else
      throw new FormulaError(`The left side must be z, n^2, or 0. Got "${parts[0].trim()}".`, 0);
  } else {
    kind = "level";
    rhs = s;
  }
  const vars = kind == "surface" ? ["x", "y", "r"] : ["x", "y", "z", "r"];
  const ast = fParse(rhs, vars);
  const g = fGLSL(ast);
  const dec = "float v_x=p.x,v_y=p.y,v_z=p.z,v_r=length(p);";
  let body,
    grin = null;
  if (kind == "surface")
    body = `${dec}v_r=length(p.xy);float h=${g};return max(length(p.xy)-1.2,abs(p.z-h)-.12);`;
  else if (kind == "level") body = `${dec}return max(${g},length(p)-1.4);`;
  else {
    body = "return length(p)-1.;";
    grin = `${dec}return ${g};`;
  }
  return { kind, body, grin, glsl: g, ast, text: s, dec };
}
// Formula box
export const FEX = [
  ["Wavy plate", "z = 0.2*sin(5*x)*cos(5*y)"],
  ["Saddle", "z = 0.3*(x^2-y^2)"],
  ["Sombrero", "z = 0.4*sin(6*r)/(r+0.3)"],
  ["Level set: blob", "x^2+y^2+z^2-0.8+0.2*sin(6*x)*sin(6*y)*sin(6*z)"],
  ["Level set: cube ball", "x^4+y^4+z^4-0.6"],
  ["Index: Luneburg", "n^2 = 2 - r^2"],
  ["Index: oscillating", "n^2 = 1.8 + 0.5*cos(9*r)"],
  ["Index: negative core", "n^2 = 2.2 - 3*exp(-4*r^2)"],
];
