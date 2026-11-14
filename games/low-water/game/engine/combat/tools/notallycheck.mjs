// No tally, and turning points only (design/spine-plan/08-ARENA.md rule 8; inferno/06-SYSTEMS.md section 6,
// `notallycheck`; bounds R1 and R2 in combat/PROGRESS.md 29).
//   R1  an inner fight is armed only by a hinge whose self-lie was heard; the external ladder and every venue
//       never hold an inner boss
//   R2  the inner run has no record(), writes no storage, and its summary holds no count; drawn over a played
//       fight, the arena page's HUD shows no figure and no word of a tally, from any voice
//   R3  no sin on the player's surface (inferno/02-BESTIARY-A.md rule 2): no drawn text names a sin, neither a
//       flaw's own label nor a classical sin's name; a skill voice that shares a sin's name (PRIDE) is captioned
//       with the boss's shown name (arena/hud.mjs captionOf). Checked on the HUD's drawn text and on the caption
//       every flaw line would get
// Controls that must fail: a hinge armed without its self-lie; a ladder holding an inner boss; a run that writes
// storage; a HUD that draws "flaws beaten: 3"; a caption "PRIDE" (R3); a caption rule that passes voices through.
//   node combat/tools/notallycheck.mjs
import { FLAWS, HOST } from "../data/flaws.mjs";
import { LADDER } from "../arena/run.mjs";
import { SKINS } from "../data/skins-quota.mjs";
import { createInnerRun } from "../arena/inner.mjs";
import { forceBot } from "./innerbots.mjs";
import { SIN_WORDS, captionOf } from "../arena/hud.mjs";

const INNER_IDS = [...Object.keys(FLAWS), "host"];
const TALLY = /\b(beaten|round|wave|score|tally|best|record|kills?)\b/i;

export function checkLadders({ ladders = { ladder: LADDER.bosses, ...Object.fromEntries(Object.entries(SKINS).map(([k, s]) => [k, s.bosses])) } } = {}) {
  const errs = [];
  for (const [k, bs] of Object.entries(ladders)) for (const b of bs) if (INNER_IDS.includes(b)) errs.push(`R1: the ${k} ladder holds the inner boss ${b}`);
  return errs;
}

export function checkArming({ makeRun = createInnerRun } = {}) {
  const errs = [];
  for (const f of Object.values(FLAWS)) {
    if (makeRun({ flaw: f.id, heard: [] }).stage().kind !== "over") errs.push(`R1: ${f.id} is armed with no self-lie heard`);
    if (!f.lesser && makeRun({ flaw: f.id, heard: [{ id: f.selflie }] }).stage().kind !== "fight") errs.push(`R1: ${f.id} is not armed when ${f.selflie} was heard`);
    if (f.lesser && makeRun({ flaw: f.id, heard: [{ id: f.selflie }] }).stage().kind !== "over") errs.push(`R1: the lesser ${f.id} is armed at a hinge (the Descent only)`);
  }
  return errs;
}

// a run played start to morning with storage watched
export function checkRun({ makeG, makeRun = createInnerRun, flaw = "check" }) {
  const errs = [], calls = [], spy = (name) => ({ getItem: (k) => (calls.push(`${name}.getItem(${k})`), null), setItem: (k) => calls.push(`${name}.setItem(${k})`), removeItem: (k) => calls.push(`${name}.removeItem(${k})`), clear: () => calls.push(`${name}.clear`) });
  const keep = { ls: globalThis.localStorage, ss: globalThis.sessionStorage };
  Object.defineProperty(globalThis, "localStorage", { value: spy("localStorage"), configurable: true, writable: true });
  Object.defineProperty(globalThis, "sessionStorage", { value: spy("sessionStorage"), configurable: true, writable: true });
  try {
    const R = makeRun({ flaw, onRecord: () => {} });
    if (typeof R.record === "function") errs.push("R2: the inner run has a record()");
    const W = R.world(makeG()), bot = forceBot();
    for (let i = 0; i < 60 * 120 && !W.result; i++) W.step({ lamb: bot(W) });
    R.finish(W); if (R.stage().kind === "offer") R.choose(0);
    for (const [k, v] of Object.entries(R.summary())) if (typeof v === "number") errs.push(`R2: the summary holds a count (${k}: ${v})`);
  } finally {
    Object.defineProperty(globalThis, "localStorage", { value: keep.ls, configurable: true, writable: true });
    Object.defineProperty(globalThis, "sessionStorage", { value: keep.ss, configurable: true, writable: true });
  }
  if (calls.length) errs.push(`R2: the inner run touched storage: ${calls.slice(0, 3).join(", ")}`);
  return errs;
}

// A 2D context that draws nothing and remembers every text drawn (node has no canvas)
function fakeContext(texts, w = 640, h = 360) {
  const img = (W2 = w, H2 = h) => ({ width: W2, height: H2, data: new Uint8ClampedArray(W2 * H2 * 4) });
  const target = { fillText: (t) => texts.push(String(t)), measureText: (t) => ({ width: String(t).length * 7 }), getImageData: (x, y, W2, H2) => img(W2, H2), createImageData: (W2, H2) => img(W2, H2), createRadialGradient: () => ({ addColorStop() {} }), setLineDash() {} };
  const VALUES = new Set(["fillStyle", "strokeStyle", "lineWidth", "lineCap", "lineJoin", "font", "textAlign", "textBaseline", "globalAlpha", "globalCompositeOperation", "imageSmoothingEnabled", "canvas"]);
  return new Proxy(target, { get: (o, k) => (k in o || VALUES.has(k) || typeof k !== "string" ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
}
const fakeCanvas = (texts, w, h) => ({ width: w, height: h, getContext: () => fakeContext(texts, w, h) });

// the HUD's drawn text over a played fight (the arena page's own drawing code, on a context that records text)
export async function hudTexts({ makeG, flaw = "prudence", frames = 60 * 40, plant = null }) {
  const texts = [];
  if (typeof globalThis.OffscreenCanvas === "undefined") globalThis.OffscreenCanvas = class { constructor(w, h) { this.width = w; this.height = h; this.ctx = fakeContext([], w, h); } getContext() { return this.ctx; } };
  const { createView } = await import("../arena/draw.mjs");
  const R = createInnerRun({ flaw, kept: ["prudence", "friday"] }), W = R.world(makeG()), V = createView(fakeCanvas(texts, 1280, 720), W), bot = forceBot();
  for (let i = 0; i < frames && !W.result; i++) { const ev = W.step({ lamb: bot(W) }); V.events(ev); if (i % 6 === 0) { V.draw(); if (plant) plant(V, texts); } }
  V.draw();
  return texts;
}

// each flaw's own sin label, as a phrase, besides the classical names
const SIN_LABELS = [...Object.values(FLAWS), HOST].map((f) => f.sin).filter(Boolean).map((s) => s.toLowerCase());
const namesSin = (t) => SIN_WORDS.test(t) || SIN_LABELS.some((s) => t.toLowerCase().includes(s));

// R3 over the data: the caption every line of every flaw (and the Host's movements) would be drawn with
export function checkCaptions({ caption = captionOf } = {}) {
  const errs = [];
  const sources = [...Object.values(FLAWS).map((f) => ({ name: f.town, lines: [...(f.lines || []), ...(f.phases || []).map((p) => p.voice).filter(Boolean)] })),
    ...HOST.movements.map((m) => ({ name: m.shown || m.name, lines: m.lines || [] }))];
  for (const S of sources) {
    const W = { inner: {}, fighters: [{ id: "boss" }], defs: { boss: { boss: true, name: S.name } } };
    for (const l of S.lines) { const c = caption(W, l); if (namesSin(c)) errs.push(`R3: a line of ${S.name} is captioned "${c}"`); }
    if (namesSin(S.name)) errs.push(`R3: the shown name "${S.name}" names a sin`);
  }
  return errs;
}

export function judgeTexts(texts) {
  const errs = [];
  for (const t of new Set(texts)) {
    if (namesSin(t)) errs.push(`R3: the HUD drew a sin: "${t.slice(0, 60)}"`);
    const body = t.replace(/^[12] {2}/, ""); // the naming's and the offer's key hints
    if (/\d/.test(body)) errs.push(`R2: the HUD drew a figure: "${t.slice(0, 60)}"`);
    if (TALLY.test(body)) errs.push(`R2: the HUD drew a tally's word: "${t.slice(0, 60)}"`);
  }
  return errs;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("combat/tools/notallycheck.mjs")) {
  const { makeG } = await import("../tests/helpers.mjs");
  const errs = [...checkLadders(), ...checkArming(), ...checkRun({ makeG }), ...checkCaptions()];
  for (const f of ["prudence", "friday", "only", "check"]) errs.push(...judgeTexts(await hudTexts({ makeG, flaw: f })));
  console.log(`notallycheck: ${INNER_IDS.length} inner ids against ${1 + Object.keys(SKINS).length} ladders; arming; a played run with storage watched; the HUD over four fights; every caption: ${errs.length} errors`);
  for (const e of errs) console.log(`  ERROR ${e}`);
  const controls = [
    ["a hinge armed without its self-lie", checkArming({ makeRun: (o) => createInnerRun({ ...o, heard: null }) })],
    ["a ladder holding an inner boss", checkLadders({ ladders: { planted: ["foreman", "prudence"] } })],
    ["a run that writes storage", checkRun({ makeG, makeRun: (o) => { const R = createInnerRun(o); const f = R.finish; R.finish = (W) => { globalThis.localStorage.setItem("lw.inner", "1"); f(W); }; return R; } })],
    ["a HUD that draws \"flaws beaten: 3\"", judgeTexts(await hudTexts({ makeG, flaw: "check", frames: 120, plant: (V, texts) => texts.push("flaws beaten: 3") }))],
    ["a caption \"PRIDE\"", judgeTexts(["PRIDE  I never once did it for nothing."])],
    ["a caption rule that passes voices through", checkCaptions({ caption: (W, l) => String(l.voice || "").toUpperCase() })],
  ];
  for (const [name, e] of controls) console.log(`  control ${e.length ? "fails, as it must" : "PASSES: the check is broken"}: ${name}`);
  if (errs.length || controls.some(([, e]) => !e.length)) process.exit(1);
  void HOST;
}
