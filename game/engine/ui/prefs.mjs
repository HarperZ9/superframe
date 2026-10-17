// Player settings kept in this browser. Interface settings live under "lowwater.prefs"; the lens
// settings live under "lowwater.lens" in the same shape the prototype and raw-native's
// web/shaders/lens/settings.mjs read (flare, streaks, halation, fringing, flashSafe), so the
// renderer picks them up unchanged. Run mode and runs on/off are also written to G.state
// (state.runMode, state.runsOff) by the settings panel, since the rules read them there.
import { store } from "./dom.mjs";

const PREFS_KEY = "lowwater.prefs", LENS_KEY = "lowwater.lens";
export const PREF_DEFAULT = { textSize: "medium", contrast: false, calm: false, runMode: "full", runsOff: false };
export const TEXT_SIZES = { small: 0.88, medium: 1, large: 1.15, larger: 1.3 };
export const RUN_MODES = ["full", "half", "stepped"];

// Same ranges as LENS_SETTINGS_SCHEMA in raw-native (kept here so the shell loads without it).
export const LENS_SCHEMA = {
  flare: { type: "number", min: 0, max: 1.5, step: 0.25, default: 1, label: "Lens flare", help: "Ghosts and starburst around bright lights" },
  streaks: { type: "boolean", default: true, label: "Anamorphic streaks", help: "Horizontal light streaks" },
  halation: { type: "number", min: 0, max: 1.5, step: 0.25, default: 1, label: "Halation", help: "Red glow around bright lights" },
  fringing: { type: "boolean", default: true, label: "Colour fringing", help: "Chromatic dispersion toward the frame edges" },
  flashSafe: { type: "boolean", default: false, label: "Reduce bright flashes", help: "Only the brightest lights flare, and fewer of them" },
};
const LENS_DEFAULT = Object.fromEntries(Object.entries(LENS_SCHEMA).map(([k, s]) => [k, s.default]));

export function loadPrefs() {
  const p = { ...PREF_DEFAULT, ...(store.get(PREFS_KEY, {}) || {}) };
  if (!(p.textSize in TEXT_SIZES)) p.textSize = "medium";
  if (!RUN_MODES.includes(p.runMode)) p.runMode = "full";
  p.lens = cleanLens(store.get(LENS_KEY, {}) || {});
  return p;
}

// A stored lens value that is out of range or the wrong type falls back to its default, with a
// warning, so a hand-edited file does not stop the game.
function cleanLens(raw) {
  const out = { ...LENS_DEFAULT };
  for (const [k, v] of Object.entries(raw)) {
    const s = LENS_SCHEMA[k];
    const ok = s && (s.type === "boolean" ? typeof v === "boolean" : typeof v === "number" && v >= s.min && v <= s.max);
    if (ok) out[k] = v; else console.warn(`lens settings: ignoring ${k}=${JSON.stringify(v)}`);
  }
  return out;
}

export function savePrefs(p) {
  const { lens, ...rest } = p;
  store.set(PREFS_KEY, rest);
  store.set(LENS_KEY, lens);
}

export function applyPrefs(p) {
  const root = document.documentElement;
  root.style.setProperty("--ts", String(TEXT_SIZES[p.textSize] || 1));
  root.classList.toggle("contrast", !!p.contrast);
  root.classList.toggle("calm", !!p.calm);
}
