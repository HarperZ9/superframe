// The UI art lead's pieces (2026-10-21): the lettering's skeleton and tools, the aged paper, the typed
// matter of glyph mode, and the painted portraits' moods and era ids.
import test from "node:test";
import assert from "node:assert/strict";
import { GLYPHS, glyphFor } from "../ui/lettering/skeleton.mjs";
import { rasterGlyph, TOOLS } from "../ui/lettering/brush.mjs";
import { paperPixels, STOCK } from "../ui/paper.mjs";
import { MATTER } from "../ui/typed.mjs";
import { moodOf, resolveWho } from "../ui/portrait.mjs";

test("every letter's strokes stay inside its advance and the em, and odd characters find a letter", () => {
  for (const [ch, g] of Object.entries(GLYPHS)) for (const st of g.s) for (const [x, y] of st) {
    assert.ok(x >= -2 && x <= g.w + 2, `${ch}: x ${x} outside 0..${g.w}`);
    assert.ok(y >= -26 && y <= 78, `${ch}: y ${y} outside the em`);
  }
  assert.equal(glyphFor("’"), GLYPHS["'"]); assert.equal(glyphFor("é"), GLYPHS.e); assert.equal(glyphFor("—"), GLYPHS["-"]);
});

test("a letter written twice never matches, and the same variant always does", () => {
  for (const tool of Object.keys(TOOLS)) {
    const a = rasterGlyph(GLYPHS.a, tool, { ch: "a", variant: 0, emPx: 48 }), a2 = rasterGlyph(GLYPHS.a, tool, { ch: "a", variant: 0, emPx: 48 }), b = rasterGlyph(GLYPHS.a, tool, { ch: "a", variant: 1, emPx: 48 });
    assert.deepEqual(a.data, a2.data, `${tool}: not deterministic`);
    let diff = 0; for (let i = 0; i < a.data.length; i++) diff += Math.abs(a.data[i] - b.data[i]);
    assert.ok(diff / a.data.length > 2, `${tool}: variants 0 and 1 nearly identical (${(diff / a.data.length).toFixed(2)})`);
    const ink = a.data.reduce((s, v) => s + v, 0) / 255 / a.data.length; assert.ok(ink > 0.03 && ink < 0.4, `${tool}: cover ${ink.toFixed(3)} out of range`);
  }
});

test("the brush dries toward a stroke's tail: the tail third carries less paint than the head third", () => {
  // a long horizontal stroke: the paint by thirds along it
  const g = { w: 200, s: [[[0, 30], [200, 30]]] }; let head = 0, tail = 0;
  for (let v = 0; v < 3; v++) { const r = rasterGlyph(g, "brush", { ch: "_", variant: v, emPx: 60 }), third = Math.floor(r.w / 3); for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const c = r.data[y * r.w + x]; if (x < third) head += c; else if (x >= 2 * third) tail += c; } }
  assert.ok(tail < head * 0.95, `tail ${tail} not drier than head ${head}`);
});

test("no two pages are the same, a page is the same from the same seed, and its middle is whole paper", () => {
  for (const era of Object.keys(STOCK).map(Number)) {
    const a = paperPixels({ w: 200, h: 260, era, seed: 1, burn: 1 }), a2 = paperPixels({ w: 200, h: 260, era, seed: 1, burn: 1 }), b = paperPixels({ w: 200, h: 260, era, seed: 2, burn: 1 });
    assert.deepEqual(a.data, a2.data, `era ${era}: not deterministic`);
    assert.notDeepEqual(a.data, b.data, `era ${era}: seeds 1 and 2 give one page`);
    for (let y = 40; y < 220; y += 7) for (let x = 40; x < 160; x += 7) assert.equal(a.data[(y * 200 + x) * 4 + 3], 255, `era ${era}: hole in the page at ${x},${y}`);
  }
});

test("burnt edges eat paper on a large page and spare a chip", () => {
  const holes = (P) => { let n = 0; for (let i = 3; i < P.data.length; i += 4) if (P.data[i] < 128) n++; return n / (P.w * P.h); };
  const page = paperPixels({ w: 400, h: 600, era: 2, seed: 9, burn: 1.2, kind: "talk" }), chip = paperPixels({ w: 120, h: 40, era: 2, seed: 9, burn: 1.2, kind: "chip" });
  assert.ok(holes(page) > 0.01, `page edge barely eaten (${holes(page)})`);
  assert.ok(holes(chip) < 0.2, `chip eaten through (${holes(chip)})`);
});

test("typed matter strikes every character within a printable range", () => {
  for (const [era, M] of Object.entries(MATTER)) for (let X = 0; X < 40; X++) for (let Y = 0; Y < 30; Y++) {
    const k = M.strike(X, Y, "e", { x0: 0, y0: 0, x1: 40, y1: 30 }); assert.ok(k > 0.4 && k <= 1.1, `era ${era}: strike ${k} at ${X},${Y}`);
  }
});

test("a painted face follows the line's direction and the story's era", () => {
  assert.equal(moodOf({ emo: "warm", lie: true }), "lying"); assert.equal(moodOf({ emo: "tender" }), "warm"); assert.equal(moodOf({ emo: "anxious" }), "afraid"); assert.equal(moodOf(null), null);
  const index = { ned: { neutral: {} }, "ned@e2": { neutral: {} }, mott: { neutral: {} } };
  assert.equal(resolveWho(index, "Ned", 2), "ned@e2"); assert.equal(resolveWho(index, "Ned", 1), "ned"); assert.equal(resolveWho(index, "Walter Mott", 2), "mott"); assert.equal(resolveWho(index, "Ned", 0), "ned");
});

// round two (2026-10-22): the historical display hands, the broad nib, and the writers' own hands
import { INSULAR } from "../ui/lettering/insular.mjs";
import { BLACKLETTER } from "../ui/lettering/blackletter.mjs";
import { CURSIVE } from "../ui/lettering/cursive.mjs";
import { HESH } from "../ui/lettering/hesh.mjs";
import { handWords, spell, tallyGlyph, toolFor } from "../ui/lettering/hands.mjs";
import { ASCENT, DESCENT } from "../ui/lettering/brush.mjs";
import { readFileSync } from "node:fs";

test("the insular, blackletter, joined and Hesh letters stay inside the em, with a full alphabet each", () => {
  for (const [name, set] of Object.entries({ INSULAR, BLACKLETTER, CURSIVE, HESH })) {
    for (const ch of "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") assert.ok(set[ch], `${name}: no ${ch}`);
    for (const [ch, g] of Object.entries(set)) for (const st of g.s) for (const [, y] of st) assert.ok(y < ASCENT - 2 && y > -DESCENT + 2, `${name} ${ch}: y ${y} outside the cell`);
  }
});

test("a broad nib draws thick across its angle and thin along it", () => {
  const cover = (g) => { const r = rasterGlyph(g, "textura", { ch: "|", emPx: 80 }); return r.data.reduce((a, v) => a + v, 0); };
  const down = cover({ w: 40, s: [[[20, 70], [20, 0]]] }), along = cover({ w: 80, s: [[[0, 30 + 33], [70 * Math.cos(0.7), 30 + 33 + 70 * Math.sin(0.7)]]] });
  assert.ok(down > along * 1.3, `a downstroke (${down}) not heavier than a stroke along the nib (${along})`);
});

test("each writer's hand writes the same words differently, Ned tighter when he lies, Bet as she spells", () => {
  const hands = JSON.parse(readFileSync(new URL("../ui/lettering/hands.json", import.meta.url), "utf8")).hands, sigs = new Set();
  for (const [id, hd] of Object.entries(hands)) { const w = handWords("Haldane barns", hd, { seed: 3 }); sigs.add(w.map((x) => x.glyph.w.toFixed(1) + ":" + x.glyph.s.length).join("|") + toolFor(hd).shear); assert.ok(w.length === 2, id); }
  assert.ok(sigs.size >= 8, `only ${sigs.size} distinct hands among ${Object.keys(hands).length}`);
  const plain = handWords("found correct", hands.ned)[0].glyph.w, lie = handWords("found correct", hands.ned, { mood: "lie" })[0].glyph.w;
  assert.ok(lie < plain * 0.9, `lying ${lie} not tighter than ${plain}`);
  assert.equal(spell("The quota was right, because they said so.", hands.bet), "Th kwota wos rite, becos they sed so.");
  const hesh = handWords("Haldane", hands.ilo)[0].glyph, tarn = handWords("Haldane", hands.ilo, { script: "tarn" })[0].glyph;
  { const h0 = hesh.s[0], a = h0[0], b = h0[h0.length - 1]; assert.ok(Math.abs(b[1] - a[1]) < 3 && b[0] - a[0] > 25 && a[1] > 40, "Ilo's Hesh hangs from its headline"); }
  assert.ok(tarn.s.some((st) => st.length === 2 && st[0][1] >= 54), "Ilo keeps the Hesh headline over his Tarnish words");
  assert.equal(tallyGlyph(5, "square").s.length, 5); assert.equal(tallyGlyph(7, "gate").s.length, 7);
});

test("the game's hands are in step with the voice cast (node game/engine/tools/handsync.mjs)", () => {
  const cast = JSON.parse(readFileSync(new URL("../../../design/voice/quota-cast.json", import.meta.url), "utf8")), hands = JSON.parse(readFileSync(new URL("../ui/lettering/hands.json", import.meta.url), "utf8")).hands;
  for (const [key, sp] of Object.entries(cast.speakers)) if (sp.hand) assert.deepEqual(hands[key.toLowerCase()], { name: sp.name || key, ...sp.hand }, `${key}: hands.json out of step`);
});

// the propaganda kit (2026-10-22): caricature only from invented dress and the myths, never from real-world caricature
import { checkCaricature } from "../ui/propaganda/guard.mjs";
import { woodcut, engraving, litho, halftone, meme } from "../ui/propaganda/print.mjs";

test("the propaganda guard passes the myths and refuses real-world caricature (with the controls that must fail)", () => {
  assert.deepEqual(checkCaricature({ people: "hesh", myth: "hoard", seed: 3, w: 200, h: 300 }), []);
  for (const bad of [{ skin: "darker" }, { nose: 2 }, { lips: 1 }, { eyes: "narrow" }, { animal: "rat" }, { props: ["rat"] }, { props: ["ape"] }, { props: ["pig"] }, { blood: true }, { disease: 1 }, { jaw: 2 }])
    assert.ok(checkCaricature({ people: "vell", ...bad }).length > 0, `the guard let through ${JSON.stringify(bad)}`);
});

test("each print process leaves ink in the dark of a drawing and none in its white", () => {
  const w = 64, h = 64, data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { const dark = (i % w) < 32; data.set(dark ? [20, 20, 20, 255] : [255, 255, 255, 255], i * 4); }
  for (const [name, f] of Object.entries({ woodcut, engraving, litho, halftone, meme })) {
    const o = f({ w, h, data }, { seed: 2 }); let left = 0, right = 0;
    for (let y = 0; y < h * 0.8; y++) for (let x = 0; x < w; x++) { const a = o.data[(y * w + x) * 4 + 3]; if (x < 24) left += a; else if (x > 44) right += a; }
    assert.ok(left > 0 && right < left * 0.05, `${name}: ink left ${left}, right ${right}`);
  }
});
