// Fight contact sounds (ui/fightsound.mjs, audio/sfx/strike.mjs): every contact the sim emits has a sound, the
// sound's attack is at its first samples (so it lands on the contact frame), heavier blows are louder, and the
// fight layer plays them. Before 2026-11-16 a fight in the shell was silent at contact.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SFX } from "../audio/sfx/index.mjs";
import { SR, rms } from "../audio/lib/dsp.mjs";
import { soundFor, fightSound, weightOf, FIGHT_SOUND_EVENTS } from "../ui/fightsound.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const peakAt = (b) => { let p = 0, at = 0; for (let i = 0; i < b.length; i++) if (Math.abs(b[i]) > p) { p = Math.abs(b[i]); at = i; } return { p, at }; };

for (const name of ["blow", "guard", "ring", "breakguard", "whoosh", "fall"]) {
  test(`strike sound ${name}: same seed same samples, bounded, audible`, () => {
    const a = SFX[name](0.5, 0.8, 3, {}), b = SFX[name](0.5, 0.8, 3, {});
    assert.equal(a.length, Math.round(0.5 * SR));
    assert.deepEqual(a, b);
    for (const x of a) assert.ok(Number.isFinite(x));
    const { p } = peakAt(a);
    assert.ok(p > 0.05 && p <= 1.0, `${name} peak ${p}`);
  });
}

for (const name of ["blow", "guard", "ring", "breakguard", "fall"]) {
  test(`strike sound ${name}: the attack is the contact (loudest part within 8 ms)`, () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = SFX[name](0.6, 0.8, seed, { weight: 0.8 }), { at } = peakAt(s);
      assert.ok(at < 0.008 * SR, `${name} seed ${seed}: peak at ${(at / SR * 1000).toFixed(1)} ms`);
    }
  });
}

test("a heavier blow is louder and longer in the body", () => {
  const light = SFX.blow(0.5, 0.8, 1, { weight: 0.1 }), heavy = SFX.blow(0.5, 0.8, 1, { weight: 0.9 });
  const n = Math.round(0.12 * SR);
  assert.ok(rms(heavy, 0, n) > rms(light, 0, n) * 1.3, `${rms(heavy, 0, n)} vs ${rms(light, 0, n)}`);
  assert.ok(weightOf({ dmg: 2.4, poise: 6 }) > weightOf({ dmg: 0.4, poise: 0 }));
});

test("every contact event maps to a sound that exists", () => {
  for (const t of FIGHT_SOUND_EVENTS) {
    const s = soundFor(t, { dmg: 1, poise: 2, move: "knife.light", cost: 1 });
    assert.ok(s, t);
    assert.equal(typeof SFX[s.sfx], "function", `${t} -> ${s.sfx}`);
    assert.ok(s.vol > 0 && s.vol <= 1 && s.secs > 0, t);
  }
  assert.equal(soundFor("hit", { move: "knife.light", dmg: 1 }).opt.edge, true);
  assert.equal(soundFor("hit", { move: "fist.jab", dmg: 1 }).opt.edge, false);
  assert.equal(soundFor("bark", {}), null);
});

test("fightSound plays on the event, once per fall, and stops when switched off", () => {
  const subs = {}, played = [];
  const G = { on: (k, f) => { (subs[k] ||= []).push(f); return () => { subs[k] = subs[k].filter((x) => x !== f); }; } };
  const emit = (k, e) => (subs[k] || []).forEach((f) => f(e));
  let t = 1000;
  const off = fightSound(G, (s) => played.push(s), () => t);
  emit("fight.hit", { id: "foe0", by: "lamb", dmg: 1.5, poise: 3, move: "stick.heavy" });
  assert.equal(played.length, 1); assert.equal(played[0].sfx, "blow");
  emit("fight.knockdown", { id: "foe0" }); emit("fight.down", { id: "foe0" });
  assert.equal(played.filter((s) => s.sfx === "fall").length, 1, "knockdown and down together: one fall");
  t += 2000; emit("fight.knockdown", { id: "foe0" });
  assert.equal(played.filter((s) => s.sfx === "fall").length, 2, "a later fall is heard");
  off(); emit("fight.hit", { id: "foe0", dmg: 1 });
  assert.equal(played.length, 3);
});

test("the fight layer plays the contact sounds", () => {
  const src = readFileSync(join(HERE, "..", "ui", "fightlayer.mjs"), "utf8");
  assert.match(src, /fightSound\(G, playSound\)/);
});
