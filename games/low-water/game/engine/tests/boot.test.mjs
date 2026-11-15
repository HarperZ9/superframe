// The boot sequence (design/CINEMATICS.md section 2; design/RATING.md section 5): its order, the skip rules on a
// first and a later boot and under reduced motion, what the browser remembers, and the pages that skip it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./helpers.mjs";
import { STEPS, NOTICE, bootPlan, skipsBoot, canSkip, readSeen, markSeen, BOOT_KEY, COLORS } from "../cine/boot.mjs";

const Q = (s) => new URLSearchParams(s);
const store = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

test("the boot runs studio card, engine card, notice, the opening film, then the title", () => {
  assert.deepEqual(bootPlan(Q("")).map((s) => s.id), ["studio", "engine", "notice", "opening", "title"]);
  assert.deepEqual(STEPS.map((s) => s.kind), ["card", "card", "notice", "film", "title"]);
  assert.equal(STEPS.find((s) => s.id === "notice").secs, 3, "the notice holds 3 seconds (RATING.md section 4)");
});

test("the notice is RATING.md section 4 word for word, and nothing else at boot names a topic", () => {
  const rating = readFileSync(join(ROOT, "..", "..", "design", "RATING.md"), "utf8");
  const quoted = rating.split("\n").find((l) => l.startsWith("> A very small number"));
  assert.ok(quoted, "RATING.md lost its notice");
  assert.equal(NOTICE, quoted.slice(2).trim());
  for (const s of STEPS.filter((x) => x.text && x.id !== "notice")) assert.ok(!/violence|abuse|theme|warning|content/i.test(s.text), `${s.id} names a topic: ${s.text}`);
  const title = readFileSync(join(ROOT, "ui", "title.mjs"), "utf8");
  assert.ok(!/Mature themes|warn-mature/.test(title), "the title screen still carries the mature-themes line");
});

test("a first boot: the cards and the film play through; the notice always moves on", () => {
  const seen = { booted: false, opening: false };
  assert.equal(canSkip("studio", { seen }), false);
  assert.equal(canSkip("engine", { seen }), false);
  assert.equal(canSkip("notice", { seen }), true);
  assert.equal(canSkip("opening", { seen }), false);
  assert.equal(canSkip("title", { seen }), false);
});

test("a later boot: the cards skip; the film skips only once it was seen to the end", () => {
  assert.equal(canSkip("studio", { seen: { booted: true } }), true);
  assert.equal(canSkip("engine", { seen: { booted: true } }), true);
  assert.equal(canSkip("opening", { seen: { booted: true, opening: false } }), false, "a player who skipped nothing yet, or skipped under reduced motion, has not seen it");
  assert.equal(canSkip("opening", { seen: { booted: true, opening: true } }), true);
});

test("under reduced motion the film is always skippable, and the first boot's cards still play", () => {
  const seen = { booted: false, opening: false };
  assert.equal(canSkip("opening", { seen, calm: true }), true);
  assert.equal(canSkip("studio", { seen, calm: true }), false);
});

test("the browser remembers the boot and the film separately, and a damaged record reads as a first boot", () => {
  const S = store();
  assert.deepEqual(readSeen(S), { booted: false, opening: false });
  markSeen(S, "booted");
  assert.deepEqual(readSeen(S), { booted: true, opening: false });
  markSeen(S, "opening");
  assert.deepEqual(readSeen(S), { booted: true, opening: true });
  assert.deepEqual(readSeen(store({ [BOOT_KEY]: "{not json" })), { booted: false, opening: false });
  assert.deepEqual(readSeen(null), { booted: false, opening: false });
});

test("screenshot, carry and harness pages skip the boot; boot=1 forces it and boot=0 refuses it", () => {
  for (const s of ["shot=title", "carry=1&content=act2", "capture=1", "capture=1&content=quota", "boot=0"]) assert.equal(skipsBoot(Q(s)), true, s);
  for (const s of ["", "content=quota", "capture=1&boot=1", "shot=x&boot=1"]) assert.equal(skipsBoot(Q(s)), false, s);
  assert.equal(bootPlan(Q("capture=1")), null);
});

test("the shell runs the boot before the title, and not on shot or carry pages", () => {
  const app = readFileSync(join(ROOT, "ui", "app.mjs"), "utf8");
  const i = app.indexOf("await runBoot(ctx)"), j = app.indexOf("ctx.title();", i), shot = app.indexOf('if (q.get("shot")) await runShot'), carry = app.indexOf('q.has("carry") && ctx.carryIn()');
  assert.ok(i > 0 && j > i, "runBoot is not awaited before the title");
  assert.ok(shot > 0 && shot < i && carry > 0 && carry < i, "the boot must come after the shot and carry branches");
});

// WCAG 2.x contrast (relative luminance from sRGB)
const rel = (hex) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const ratio = (a, b) => { const [x, y] = [rel(a), rel(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
test("the cards' and the notice's ink and the film's skip hint pass AA (4.5:1) on the ground; a planted grey fails", () => {
  assert.ok(ratio(COLORS.ink, COLORS.ground) >= 7, `ink ${ratio(COLORS.ink, COLORS.ground).toFixed(2)}`);
  const g = parseInt(COLORS.ground.slice(1), 16), mix = (c, s) => Math.round(((c >> s) & 255) * COLORS.hintAlpha + ((g >> s) & 255) * (1 - COLORS.hintAlpha));
  const hint = "#" + [mix(0xc4d8ee, 16), mix(0xc4d8ee, 8), mix(0xc4d8ee, 0)].map((v) => v.toString(16).padStart(2, "0")).join("");
  assert.ok(ratio(hint, COLORS.ground) >= 4.5, `hint ${ratio(hint, COLORS.ground).toFixed(2)}`);
  assert.ok(ratio("#3a3d44", COLORS.ground) < 4.5, "the contrast measure passes anything");
  const player = readFileSync(join(ROOT, "cine", "player.mjs"), "utf8");
  assert.ok(player.includes(`rgba(196,216,238,${COLORS.hintAlpha})`), "the film's hint is not the colour this test measured");
});
