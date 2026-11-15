// The sensory cue system: what a moment does to the screen, the ears, the hands and the bodies on the plate, as
// data. Game-agnostic: a story names its cues (@cue) and fires them; the shell plays them (ui/senseplayer.mjs) and
// the harness keeps them in the run (G.state.cues), so a checker can prove a moment was felt and not only read.
// The author's direction, 2026-10-23: story reaches the player through weight, sound, touch, bodies and changed
// places, never through a document (design/DEVICE-AUDIT.md).
//
//   @sense thread.cut
//   screen: shake 0.25 0.3        shake <amp 0..1> <secs> | tint <#rgb> <alpha> <secs> | vignette <amp> <secs>
//                                 | dim <amp> <secs> | blur <px> <secs> | flash <alpha> <secs>      (repeatable)
//   sound: snap 0.6 near          <sfx id> [volume 0..1] [near | far | wall | under] [seconds]   (repeatable)
//   caption: a thread snapping    what the sound is, in words, for captions (required with sound:)
//   rumble: 0.1 0.7 120           <low 0..1> <high 0..1> <ms> [delay ms]            (repeatable: a pattern)
//   anim: player tremble 1.5      <who | player> <posture> [secs]: tremble stoop slump flinch still reach turn
//   camera: push 1.6 1.4          push <zoom> <secs> | dip <amp> <secs> | hold <secs>
//   hold: 1.2                     seconds the beat waits before the next line (the moment lands)
//   about: what it is for (designers only)
//
// Fire a cue: sense(id) as an effect, {sense: id} on a line, nar, voice or option or a prop's touch:, sense: on an
// @echo, a @load or a @scale. (The record is @sense: @cue is the stealth layer's inner-voice cue, world/stealth.mjs.)
// The burden and echo systems fire their own (world/burden.mjs, world/echo.mjs). A cue that is not defined fails
// loudly in the validator (tools/devicecheck.mjs) and at runtime.
//   G.senses.fire(id, { via }) -> the cue's channels   G.senses.cues   G.senses.log()
//   G.senses.posture(who) -> { name, until } | null    (a held posture: the people layer bends the figure)
//   G.senses.hold(who, name, secs)                     (set a posture by hand: the echo and burden systems use it)
import { registerCalls } from "../core/scope.mjs";

export const SCREEN = ["shake", "tint", "vignette", "dim", "blur", "flash"];
export const PLACES = ["near", "far", "wall", "under"];
export const POSTURES = ["tremble", "stoop", "slump", "flinch", "still", "reach", "turn", "upright", "bent", "stagger"];
export const CAMERA = ["push", "dip", "hold"];
const KEYS = ["screen", "sound", "caption", "rumble", "anim", "camera", "hold", "about"];
const num = (s, d) => (s == null || s === "" ? d : +s);
const fin = (x) => Number.isFinite(x);

function parseScreen(v, line) {
  const w = v.trim().split(/\s+/), kind = w[0];
  if (!SCREEN.includes(kind)) throw new SyntaxError(`line ${line}: screen: ${kind} (one of ${SCREEN.join(", ")})`);
  if (kind === "tint") { if (!/^#[0-9a-f]{3,6}$/i.test(w[1] || "")) throw new SyntaxError(`line ${line}: screen: tint <#rgb> <alpha> <secs>`); return { kind, color: w[1], amp: num(w[2], 0.3), secs: num(w[3], 1) }; }
  const s = { kind, amp: num(w[1], 0.3), secs: num(w[2], 0.5) };
  if (!fin(s.amp) || !fin(s.secs)) throw new SyntaxError(`line ${line}: screen: ${kind} <amp> <secs>`);
  return s;
}
function parseSound(v, line) {
  const w = v.trim().split(/\s+/), s = { sfx: w[0], vol: num(w[1], 0.6), at: w[2] || "near", secs: num(w[3], null) };
  if (!s.sfx || !fin(s.vol) || !PLACES.includes(s.at)) throw new SyntaxError(`line ${line}: sound: <sfx> [volume] [${PLACES.join(" | ")}] [seconds]`);
  return s;
}
function parseRumble(v, line) {
  const w = v.trim().split(/\s+/).map(Number), r = { low: w[0], high: w[1], ms: w[2], delay: w[3] || 0 };
  if (![r.low, r.high, r.ms].every(fin) || r.low < 0 || r.low > 1 || r.high < 0 || r.high > 1) throw new SyntaxError(`line ${line}: rumble: <low 0..1> <high 0..1> <ms> [delay]`);
  return r;
}
function parseAnim(v, line) {
  const w = v.trim().split(/\s+/), a = { who: w[0], posture: w[1], secs: num(w[2], 1.5) };
  if (!a.who || !POSTURES.includes(a.posture)) throw new SyntaxError(`line ${line}: anim: <who | player> <posture> [secs] (postures: ${POSTURES.join(", ")})`);
  return a;
}
function parseCamera(v, line) {
  const w = v.trim().split(/\s+/), c = { kind: w[0], a: num(w[1], 1.4), secs: num(w[2], 1.2) };
  if (!CAMERA.includes(c.kind) || !fin(c.a) || !fin(c.secs)) throw new SyntaxError(`line ${line}: camera: push <zoom> <secs> | dip <amp> <secs> | hold <secs>`);
  return c;
}

export function parseCue(r) {
  const one = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
  const all = (k) => r.kv.filter((e) => e.key === k);
  for (const e of r.kv) if (!KEYS.includes(e.key)) throw new SyntaxError(`line ${e.line}: unknown key "${e.key}" (one of ${KEYS.join(", ")})`);
  const c = {
    id: r.id, screen: all("screen").map((e) => parseScreen(e.value, e.line)), sound: all("sound").map((e) => parseSound(e.value, e.line)),
    caption: one("caption") || "", rumble: all("rumble").map((e) => parseRumble(e.value, e.line)), anim: all("anim").map((e) => parseAnim(e.value, e.line)),
    camera: all("camera").map((e) => parseCamera(e.value, e.line)), hold: num(one("hold"), 0), about: one("about") || "", file: r.file, line: r.line,
  };
  if (c.sound.length && !c.caption) throw new SyntaxError("a cue with sound: needs caption: (what the sound is, for captions)");
  if (!c.screen.length && !c.sound.length && !c.rumble.length && !c.anim.length && !c.camera.length) throw new SyntaxError("a cue needs at least one of screen, sound, rumble, anim, camera");
  return c;
}

export function loadCues(book) {
  const cues = {}, errors = [];
  for (const r of Object.values((book.records || {}).sense || {})) {
    try { cues[r.id] = parseCue(r); } catch (e) { errors.push({ file: r.file, line: r.line, msg: `sense ${r.id}: ${e.message}` }); }
  }
  return { cues, errors };
}

registerCalls({ sense: (G, [id]) => { if (G.senses) G.senses.fire(id, { via: "effect" }); return true; } }, { sense: "sense" });

export function installSenses(G, cues = {}) {
  if (G.senses) return G.senses;
  const log = () => (G.state.cues ||= []), held = () => (G.state.postures ||= {});
  const api = {
    cues,
    has: (id) => !!cues[id],
    // fire a cue: records it on the run and hands it to whoever plays it (the shell's sense player)
    fire(id, { via = "", who = null } = {}) {
      const c = cues[id]; if (!c) throw new Error(`senses: no @sense ${id}${via ? ` (fired by ${via})` : ""}`);
      const at = Math.round(G.clock()), entry = { id, at, via, node: G.state.node || null };
      const L = log(); L.push(entry); if (L.length > 4000) L.splice(0, L.length - 4000);
      for (const a of c.anim) api.hold(a.who === "player" && who ? who : a.who, a.posture, a.secs);
      G.emit("sense.cue", { ...c, via, at });
      return c;
    },
    log: () => log().map((x) => ({ ...x })),
    fired: (id) => log().some((x) => x.id === id),
    // a posture held on a figure (game minutes are not real seconds: the shell eases it out by its own clock)
    hold(who, name, secs = 1.5) { held()[who] = { name, secs, at: G.clock() }; G.emit("sense.posture", { who, name, secs }); },
    posture: (who) => held()[who] || null,
    release(who) { delete held()[who]; G.emit("sense.posture", { who, name: null, secs: 0 }); },
  };
  G.senses = api;
  return api;
}
