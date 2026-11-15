// The sense player: plays the story's cues (world/senses.mjs) in the browser shell. A cue's screen part moves or
// tints the scene, its sound is synthesised from the sound library (audio/sfx) and placed near, far, through a wall
// or underfoot, its rumble goes to the pad, its camera part pushes the plate camera in or dips it, and its
// postures bend the figures (the people layer reads G.senses.posture). Captions name every sound while the
// captions setting is on (the sound's caption: line).
// The player's settings rule it: Camera shake off or reduced scales the shake, reduced motion drops shakes, pushes
// and dips, Controller rumble off silences the pad. Nothing here decides anything: a cue is fired by the story and
// recorded on the run; this only makes it felt.
//   const off = sensePlayer(ctx, { scene, cam })   scene: the element that shakes; cam: the plate camera (optional)
import { h } from "./dom.mjs";
import { notify } from "./notify.mjs";
import { SFX } from "../audio/sfx/index.mjs";
import { SR } from "../audio/lib/dsp.mjs";

let AC = null, OUT = null;
function audio() {
  if (AC) return AC;
  try { const C = globalThis.AudioContext || globalThis.webkitAudioContext; AC = new C(); OUT = AC.createGain(); OUT.gain.value = 0.8; OUT.connect(AC.destination); }
  catch (e) { console.warn(`senses: no audio (${e.message})`); AC = null; }
  if (AC) { const resume = () => { if (AC.state === "suspended") AC.resume().catch((err) => console.warn(`senses: audio resume failed: ${err.message}`)); }; addEventListener("keydown", resume, true); addEventListener("pointerdown", resume, true); }
  return AC;
}
const cache = new Map();
function samples(sfx, secs, vol) {
  const key = `${sfx}|${secs}|${vol}`; if (cache.has(key)) return cache.get(key);
  const fn = SFX[sfx]; if (!fn) throw new Error(`senses: no sound ${sfx} in audio/sfx`);
  const out = fn(secs || 1.2, vol, 7); cache.set(key, out); return out;
}
// near: dry; far: quieter and duller; wall: through plaster, the highs gone; under: through the floor, a thud
const PLACE = { near: { lp: 16000, g: 1 }, far: { lp: 2600, g: 0.45 }, wall: { lp: 700, g: 0.6 }, under: { lp: 260, g: 0.9 } };
export function playSound(s) {
  const ac = audio(); if (!ac) return false;
  const data = samples(s.sfx, s.secs, Math.min(1, s.vol)), sr = SR, buf = ac.createBuffer(1, data.length, sr);
  buf.copyToChannel(data, 0);
  const src = ac.createBufferSource(), lp = ac.createBiquadFilter(), g = ac.createGain(), p = PLACE[s.at] || PLACE.near;
  src.buffer = buf; lp.type = "lowpass"; lp.frequency.value = p.lp; g.gain.value = p.g;
  src.connect(lp); lp.connect(g); g.connect(OUT); src.start();
  return true;
}

export function rumble(r, prefs = {}) {
  if (prefs.rumble === false) return false;
  const pad = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean)[0] : null, act = pad && pad.vibrationActuator;
  if (!act || !act.playEffect) return false;
  act.playEffect("dual-rumble", { startDelay: r.delay || 0, duration: r.ms, strongMagnitude: r.low, weakMagnitude: r.high }).catch((e) => console.warn(`senses: rumble failed: ${e && e.message}`));
  return true;
}

export function sensePlayer(ctx, { scene, cam = null } = {}) {
  const G = ctx.G, veil = h("div.sense-veil"), cap = h("div.sense-cap.small");
  Object.assign(veil.style, { position: "absolute", inset: "0", pointerEvents: "none", opacity: "0", zIndex: "40", transition: "none" });
  Object.assign(cap.style, { position: "absolute", left: "50%", bottom: "12%", transform: "translateX(-50%)", pointerEvents: "none", zIndex: "41", fontStyle: "italic", opacity: "0",
    color: "#f2e4c4", background: "rgba(20, 14, 10, 0.78)", padding: "0.25rem 0.8rem", borderRadius: "0.3rem", whiteSpace: "nowrap" }); // a caption reads on any ground (ink on a dark pill)
  scene.append(veil, cap);
  const prefs = () => ctx.prefs || {}, calm = () => !!prefs().calm, shakeK = () => ({ on: 1, light: 0.5, off: 0 }[prefs().shake] ?? 1);
  const last = { at: 0 };
  function screen(s) {
    if (s.kind === "shake") {
      const k = calm() ? 0 : shakeK() * s.amp; if (!k) return;
      const px = 14 * k, steps = Math.max(4, Math.round(s.secs * 30)), frames = [];
      for (let i = 0; i <= steps; i++) { const f = 1 - i / steps, x = (Math.random() * 2 - 1) * px * f, y = (Math.random() * 2 - 1) * px * f * 0.7; frames.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` }); }
      frames.push({ transform: "translate(0, 0)" });
      scene.animate(frames, { duration: s.secs * 1000, easing: "linear" });
      return;
    }
    const grad = { tint: s.color, vignette: "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.95) 100%)", dim: "rgba(0,0,0,1)", flash: "rgba(255,250,240,1)" }[s.kind];
    if (s.kind === "blur") { if (calm()) return; scene.animate([{ filter: `blur(${s.amp}px)` }, { filter: "blur(0px)" }], { duration: s.secs * 1000, easing: "ease-out" }); return; }
    veil.style.background = grad;
    const amp = s.kind === "flash" ? Math.min(0.5, s.amp) : s.amp; // never a hard white: the photosensitivity rule
    veil.animate([{ opacity: amp }, { opacity: 0 }], { duration: s.secs * 1000, easing: "ease-in" });
  }
  function camera(c) {
    if (!cam || calm()) return;
    if (c.kind === "push" && cam.macro && G.state.pos) { const p = G.state.pos, at = [p[0], (p[1] || 0) + 1.2, p[2]]; cam.macro(at, { zoom: c.a, secs: c.secs }); setTimeout(() => cam.macro(null), (c.secs + 1.2) * 1000); }
    if (c.kind === "dip") scene.animate([{ transform: "translateY(0)" }, { transform: `translateY(${Math.round(20 * c.a)}px)` }, { transform: "translateY(0)" }], { duration: c.secs * 1000, easing: "ease-in-out" });
  }
  function caption(text) {
    if (!text || prefs().captions === false) return;
    cap.textContent = text; cap.animate([{ opacity: 0.9 }, { opacity: 0.9, offset: 0.7 }, { opacity: 0 }], { duration: 2600 });
  }
  const off = G.on("sense.cue", (c) => {
    try {
      last.at = performance.now();
      for (const s of c.screen || []) screen(s);
      for (const s of c.sound || []) playSound(s);
      if ((c.sound || []).length) caption(c.caption);
      for (const r of c.rumble || []) rumble(r, prefs());
      for (const k of c.camera || []) camera(k);
      globalThis.__lwLastCue = { id: c.id, t: performance.now() }; // for captures and the shell's checks
    } catch (e) { console.error(`senses: cue ${c.id}: ${e.message}`); }
  });
  // a cue's posture lasts its seconds of real time; the burden's (seconds 0) lasts until the load changes
  const offP = G.on("sense.posture", ({ who, name, secs }) => { if (name && secs > 0) setTimeout(() => { const p = G.senses.posture(who); if (p && p.name === name) G.senses.release(who); }, secs * 1000); });
  return () => { if (typeof off === "function") off(); if (typeof offP === "function") offP(); veil.remove(); cap.remove(); };
}

// How a held posture bends a figure as it is drawn: a canvas transform about the feet (x, y), and a tremble.
//   const t = postureTransform(name, nowMs); g.save(); g.translate(x, y); g.transform(...t.m); g.translate(-x, -y)
export function postureTransform(name, ms = 0) {
  const j = (a) => Math.sin(ms / 23) * a + Math.sin(ms / 37) * a * 0.6;
  switch (name) {
    case "tremble": return { m: [1, 0, 0, 1, j(0.9), 0] };
    case "stoop": case "bent": return { m: [1, 0, -0.12, 0.93, 0, 0] };
    case "stagger": return { m: [1, 0, -0.2 + Math.sin(ms / 400) * 0.06, 0.88, 0, 0] };
    case "slump": return { m: [1, 0, 0.06, 0.9, 0, 0] };
    case "flinch": return { m: [0.97, 0, 0.1, 0.96, -2, 0] };
    case "reach": return { m: [1, 0, -0.08, 1, 0, 0] };
    default: return null;
  }
}

// an echo met on foot: its line as a quiet card in the margin, for its reading time (no title: it is the place)
export function echoNote(ctx, lines) {
  for (const l of lines.filter((x) => x.echo)) {
    const words = String(l.text).split(/\s+/).length;
    notify({ kind: "look", text: l.text, node: h("div.look.sheet.fade-in", h("p", l.text)), ms: 4000 + 300 * words, fold: false });
  }
}
