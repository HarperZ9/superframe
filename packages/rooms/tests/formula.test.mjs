import test from "node:test";
import { assert, near } from "./h.mjs";
import { fParse, fGLSL, fEval, fCompile, FormulaError, FX } from "../core/formula.js";
import { typed } from "../core/scatter.js";

const bad = [
  ["void main(){discard;}", ["x"]],
  ["1;discard", ["x"]],
  ["x.y", ["x"]],
  ["#define a", ["x"]],
  ["x@2", ["x"]],
  ["texture(uImg,x)", ["x"]],
  ["unknownfn(x)", ["x"]],
  ["uFrame", ["x"]],
  ["sin(x", ["x"]],
  ["sin(x,y)", ["x", "y"]],
  ["pow(x)", ["x"]],
  ["(", ["x"]],
  ["", ["x"]],
  ["1e999", ["x"]],
  ["x".repeat(241), ["x"]],
  [Array(130).fill("x").join("+"), ["x"]],
  ["(".repeat(30) + "x" + ")".repeat(30), ["x"]],
  ["z", ["x", "y", "r"]],
];
for (const [src, vars] of bad)
  test(`refuses ${JSON.stringify(src.slice(0, 26))}`, () => {
    assert.throws(() => fParse(src, vars), FormulaError);
  });

test("output is rebuilt from the tree, with guards on every partial function", () => {
  const g = (s) => fGLSL(fParse(s, ["x", "y", "z", "r"]));
  assert.equal(g("x+1"), "(v_x+1.00000000)");
  assert.equal(g("log(x)"), "log(max(v_x,1e-6))");
  assert.equal(g("sqrt(x)"), "sqrt(max(v_x,0.))");
  assert.equal(g("asin(x)"), "asin(clamp(v_x,-1.,1.))");
  assert.equal(g("x/y"), "(v_x/sdiv(v_y))");
  assert.equal(g("x^2"), "spow(v_x,2.00000000)");
  assert.equal(g("atan2(x,y)"), "atan(v_x,v_y)");
  assert.equal(g("-1"), "(-1.00000000)");
  assert.equal(g("pi"), Math.PI.toFixed(8));
  assert.doesNotMatch(g("sin(x)*max(y,z)-r"), /[;{}#]/);
});

test("precedence and evaluation match the written maths", () => {
  const e = (s, env) => fEval(fParse(s, Object.keys(env)), env);
  near(e("1+2*3", { x: 0 }), 7, 0, "mul binds tighter");
  near(e("2^3^2", { x: 0 }), 512, 0, "power is right associative");
  near(e("-2^2", { x: 0 }), -4, 0, "unary minus below power");
  near(e("mod(7,3)", { x: 0 }), 1, 0, "mod");
  near(e("fract(1.25)", { x: 0 }), 0.25, 0, "fract");
  near(e("step(1,0.5)", { x: 0 }), 0, 0, "step");
  near(e("atan2(1,1)", { x: 0 }), Math.PI / 4, 1e-15, "atan2");
  near(e("exp(-2*r^2)", { r: 1 }), Math.exp(-2), 1e-15, "apodiser");
  assert.equal(Object.keys(FX).length, 22);
});

test("the three kinds of formula classify", () => {
  assert.equal(fCompile("z = 0.2*sin(5*x)").kind, "surface");
  assert.equal(fCompile("n^2 = 2 - r^2").kind, "index");
  assert.ok(fCompile("n^2 = 2 - r^2").grin.includes("return"));
  assert.equal(fCompile("x^2+y^2-1").kind, "level");
  assert.equal(fCompile("x^2+y^2-1 = 0").kind, "level");
  assert.throws(() => fCompile("y = x"), FormulaError);
  assert.throws(() => fCompile("a=b=c"), FormulaError);
  assert.throws(() => fCompile("  "), FormulaError);
  assert.throws(() => fCompile("z = z"), FormulaError);
  assert.match(typed("1", "rho"), /^float rho\(vec3 p\)/);
  assert.throws(() => typed("uFrame*2", "rho"), FormulaError);
});
