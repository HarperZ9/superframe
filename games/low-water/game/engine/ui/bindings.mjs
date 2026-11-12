// Remappable controls and device-aware prompts (design/UI-SYSTEM.md section 8). Owned by the UI
// and UX lead. The fight reads its keys, mouse buttons and pad buttons from here
// (ui/fightkeys.mjs); Settings, Controls rebinds them; prompts show only the device last used.
//   const B = loadBindings();  B.key.light -> ["KeyJ"]  B.pad.light -> [5]  B.mouse.light -> [0]
//   saveBindings(B); resetBindings();  device() -> "key" | "pad" | "mouse";  glyph("light") -> element
// Pad indices are the standard mapping: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 View,
// 9 Start, 10 left stick click, 11 right stick click, 12 to 15 the d-pad up, down, left, right.
import { h, store } from "./dom.mjs";

const KEY = "lowwater.bindings";

// What each fight action is, in the order Settings lists them. hold: read as held, not pressed.
export const FIGHT_ACTIONS = [
  ["light", "Light strike"], ["heavy", "Heavy strike (hold to charge)", "hold"], ["block", "Block (hold)", "hold"], ["catch", "Catch"],
  ["roll", "Roll"], ["step", "Sidestep"], ["lock", "Lock on"], ["next", "Next target"], ["prev", "Previous target"],
  ["use", "Use the thing in hand"], ["interact", "Work a prop"], ["lantern", "Lantern"], ["talk", "Take a way out"],
  ["shove", "Shove"], ["grapple", "Grapple"], ["art", "Tool art (costs Composure)"], ["pause", "Pause"],
];

export const DEFAULTS = {
  key: { light: ["KeyJ"], heavy: ["KeyK"], block: ["KeyI"], catch: ["KeyL"], roll: ["Space"], step: ["ShiftLeft", "ShiftRight"], lock: ["Tab"], next: ["BracketRight"], prev: ["BracketLeft"],
    use: ["KeyQ"], interact: ["KeyF"], lantern: ["KeyH"], talk: ["KeyT"], shove: ["KeyE"], grapple: ["KeyG"], art: ["KeyR"], pause: ["Escape"] },
  // the shoulder-button layout action-RPG players already have in their hands
  pad: { light: [5], heavy: [7], block: [4], catch: [6], roll: [1], step: [10], lock: [11], next: [], prev: [],
    use: [2], interact: [0], lantern: [12], talk: [13], shove: [3], grapple: [14], art: [15], pause: [9] },
  mouse: { light: [0], heavy: [2] },
  hold: { block: "hold", run: "hold", crouch: "hold" },
};

const clone = (o) => JSON.parse(JSON.stringify(o));
export function loadBindings() {
  const saved = store.get(KEY, null), B = clone(DEFAULTS);
  if (saved && typeof saved === "object") for (const dev of ["key", "pad", "mouse", "hold"]) Object.assign(B[dev], saved[dev] || {});
  return B;
}
export const saveBindings = (B) => store.set(KEY, B);
export const resetBindings = () => { store.set(KEY, null); return clone(DEFAULTS); };

// Reverse maps for the fight's listeners.
export function byCode(B, dev) {
  const out = {};
  for (const [act, list] of Object.entries(B[dev] || {})) for (const c of list || []) (out[c] ||= []).push(act);
  return out;
}

// ---- names for prompts ----
const PAD_NAMES = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "View", "Start", "L3", "R3", "Up", "Down", "Left", "Right"];
const KEY_NAMES = { Space: "Space", Escape: "Esc", Enter: "Enter", Tab: "Tab", ShiftLeft: "Shift", ShiftRight: "Shift", ControlLeft: "Ctrl", BracketLeft: "[", BracketRight: "]", ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right", Backspace: "Backspace" };
const MOUSE_NAMES = ["Left click", "Middle click", "Right click"];
export const keyName = (code) => KEY_NAMES[code] || String(code).replace(/^Key|^Digit/, "");
export const padName = (i) => PAD_NAMES[i] || `Button ${i}`;
export const mouseName = (i) => MOUSE_NAMES[i] || `Mouse ${i}`;

// ---- the device last used ----
let dev = "key";
const subs = new Set();
function setDevice(d) { if (d === dev) return; dev = d; document.documentElement.dataset.device = d; for (const f of subs) f(d); }
export const device = () => dev;
export const onDevice = (fn) => { subs.add(fn); return () => subs.delete(fn); };
let watching = false;
export function watchDevice() {
  if (watching || typeof window === "undefined") return; watching = true;
  document.documentElement.dataset.device = dev;
  addEventListener("keydown", () => setDevice("key"), true);
  let lx = -1, ly = -1;
  addEventListener("mousemove", (e) => { if (Math.abs(e.screenX - lx) + Math.abs(e.screenY - ly) > 3 && lx >= 0) setDevice("mouse"); lx = e.screenX; ly = e.screenY; }, true);
  addEventListener("mousedown", () => setDevice("mouse"), true);
  const poll = () => {
    const p = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean)[0] : null;
    if (p && (p.buttons.some((b) => b.pressed) || p.axes.some((a) => Math.abs(a) > 0.5))) setDevice("pad");
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}

// The glyph for a fight action (or a shell action given as { key, pad }) on the device in use.
const SHELL = { confirm: { key: "Enter", pad: 0 }, back: { key: "Escape", pad: 1 }, daybook: { key: "Tab", pad: 8 }, pause: { key: "Escape", pad: 9 }, tabs: { key: "Q E", pad: "LB RB" }, sums: { key: "Shift", pad: 2 }, density: { key: "KeyN", pad: 3 }, speak: { key: "KeyF", pad: 0 }, lie: { key: "KeyN", pad: 3 }, plan: { key: "Left Right", pad: "Left Right" } };
export function glyph(action, B = loadBindings(), d = dev) {
  const s = SHELL[action];
  if (d === "pad") {
    const i = s ? s.pad : (B.pad[action] || [])[0];
    if (i == null) return null;
    return h("span.key.pad", typeof i === "number" ? padName(i) : i);
  }
  if (!s && d === "mouse" && (B.mouse[action] || []).length) return h("span.key", mouseName(B.mouse[action][0]));
  const c = s ? s.key : (B.key[action] || [])[0];
  if (c == null) return null;
  return h("span.key", c.includes(" ") ? c : keyName(c));
}
