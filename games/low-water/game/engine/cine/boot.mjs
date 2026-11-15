// The boot sequence (design/CINEMATICS.md section 2; design/RATING.md section 5): the studio card, the engine
// card, the photosensitivity notice, the opening film, then the title. Pure rules here, no DOM, so the order and
// the skip rules are tested in node (tests/boot.test.mjs); ui/boot.mjs shows them.
//   bootPlan(q)                          -> the steps, or null when this page skips the boot
//   canSkip(step, { seen, calm })        -> whether a key or click may end this step now
//   readSeen(storage) / markSeen(storage, what)   what this browser remembers (lowwater.boot.v1)
export const BOOT_KEY = "lowwater.boot.v1";

// design/RATING.md section 4, word for word (tests/boot.test.mjs holds the two together)
export const NOTICE = "A very small number of people may have seizures when exposed to certain lights or patterns. If you feel unwell while playing, stop and rest. Flash and motion options are in Settings.";

// The studio card's words: the author confirms them before release (CINEMATICS.md section 2).
export const STEPS = [
  { id: "studio", kind: "card", secs: 2.5, text: "Zain Dana Harper", face: "grotesk" },
  { id: "engine", kind: "card", secs: 2.5, text: "raw-native", face: "mono" },
  { id: "notice", kind: "notice", secs: 3, text: NOTICE },
  { id: "opening", kind: "film" },
  { id: "title", kind: "title" },
];
export const FADE_S = 0.5;
// era 2's ground and ink (design/sensory/01-LOOKS.md, L2), and the skip hint's ink at its opacity on that ground
export const COLORS = { ground: "#070a11", ink: "#c4d8ee", hint: "rgba(196, 216, 238, 0.72)", hintAlpha: 0.72 };

// Pages that skip the boot: screenshots (?shot=), the next act carried in (?carry=), the harness (?capture, unless
// ?boot=1 asks for it), and ?boot=0. ?boot=1 forces it on any page.
export function skipsBoot(q) {
  const get = (k) => (q && q.get ? q.get(k) : null), has = (k) => !!(q && q.has && q.has(k));
  if (get("boot") === "1") return false;
  if (get("boot") === "0") return true;
  return has("shot") || has("carry") || has("capture");
}
export function bootPlan(q) { return skipsBoot(q) ? null : STEPS.map((s) => ({ ...s })); }

// seen: { booted, opening } from readSeen. A card skips only after the first boot; the notice always moves on; the
// film skips once it has been seen to the end, or at once under reduced motion; the title is not a timed step.
export function canSkip(step, { seen = {}, calm = false } = {}) {
  const id = typeof step === "string" ? step : step.id;
  if (id === "notice") return true;
  if (id === "studio" || id === "engine") return !!seen.booted;
  if (id === "opening") return !!seen.opening || !!calm;
  return false;
}

export function readSeen(storage) {
  try { const v = JSON.parse((storage && storage.getItem(BOOT_KEY)) || "{}"); return { booted: !!v.booted, opening: !!v.opening }; }
  catch (e) { console.warn(`boot: unreadable ${BOOT_KEY} (${e.message}); treated as a first boot`); return { booted: false, opening: false }; }
}
// what: "booted" (the cards ran once) or "opening" (the film was watched to its end, never on a skip)
export function markSeen(storage, what) {
  const v = readSeen(storage); v[what] = true;
  try { storage.setItem(BOOT_KEY, JSON.stringify(v)); }
  catch (e) { console.warn(`boot: could not remember ${what} (${e.message})`); }
  return v;
}
