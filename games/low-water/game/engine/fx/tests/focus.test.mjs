// The tilt-shift lens and focus director (fx/focus.mjs), checked as raw-native checks its C++ twin
// (evidence/tiltshift-bounds.json d1 to d5 in raw-native PR #211): no pumping, the observer's drift and world
// events never take focus from a speaker or a fight, drift happens in an idle walk and never under reduced
// motion, events are answered, and the child's jitter stays capped.
// node --test game/engine/fx/tests/
import test from "node:test";
import assert from "node:assert/strict";
import { Director, LOOKS, lensOf, lensGeom, cocAt } from "../focus.mjs";

// A three-quarter perspective camera like the town plates', 1920 x 1080 plate pixels.
const CAM = { yawDeg: 45, elevDeg: 35, target: [0, 0.8, 0], dist: 46, fovY: 0.45, ortho: false }, W = 1920, H = 1080, DT = 1 / 60, C0 = 1;
const at = (x, z, y) => [x, y, z];
const PLAYER = at(0, 0, 0.9), SPEAKER = at(-7, -0.2, 1.61), SPEAKER_BODY = at(-7, -0.2, 0.9);
const FIGHTERS = [at(-7, -0.2, 0.9), at(-7, -0.2, 1.61), at(0, 0, 0.9), at(0, 0, 1.61), at(6, 0.2, 0.9), at(6, 0.2, 1.61)];
const LIVING = [{ p: at(-5.7, 1.4, 0.3), id: "dog", salience: 0.6 }, { p: at(6.6, -5, 2.9), id: "lit window", salience: 0.5 }, { p: at(1, 7.45, 2.7), id: "washing", salience: 0.4 }];
const DOOR = at(-7.5, -5, 1.5);
const make = (character = "naturalist") => new Director(character, lensOf(LOOKS.town_map, PLAYER), CAM);
const lensD = (d, p) => LOOKS.town_map.K / d.axialOf(p);

// The scripted timeline: walk, talk with events and idle inside, walk, a fight with events, examine, dream.
const SPANS = [[0, 20, "walk", false], [20, 40, "talk", false], [40, 45, "walk", true], [45, 50, "walk", false], [50, 70, "fight", false], [70, 78, "examine", false], [78, 90, "dream", false]];
const EVENTS = [[12, DOOR, "door"], [25, DOOR, "door"], [30, at(6, 0.6, 0.9), "runner"], [35, at(12, 2, 0.8), "cart"], [55, DOOR, "door"], [62, at(12, 2, 0.8), "cart"]];
function timeline(d, calm = false) {
  const r = { overshoot: 0, fails: 0, checked: 0, eventsInLocks: 0 };
  let prevE = 0, prevT = -1;
  for (let i = 0; i < 90 / DT; i++) {
    const t = i * DT, sp = SPANS.find((s) => t >= s[0] && t < s[1]), intent = sp[2];
    const events = EVENTS.filter((e) => Math.abs(t - e[0]) < DT / 2).map((e) => ({ p: e[1], kind: e[2], salience: 0.9 }));
    const lock = intent === "talk" || intent === "fight";
    if (lock) r.eventsInLocks += events.length;
    const s = d.step({ intent, player: PLAYER, speaker: SPEAKER, prop: at(6.6, -4.98, 2.9), fighters: FIGHTERS, living: LIVING, events, playerMoving: sp[3], reducedMotion: calm }, DT);
    const T = lensD(d, s.targetPoint), e = (LOOKS.town_map.K) * s.rack - T;
    if (prevT >= 0 && Math.abs(T - prevT) < 1e-12 && Math.abs(prevE) > 0) {
      if (e * prevE < 0) r.overshoot = Math.max(r.overshoot, Math.abs(e));
      else if (Math.abs(e) > Math.abs(prevE) + 1e-12) r.overshoot = Math.max(r.overshoot, Math.abs(e) - Math.abs(prevE));
    }
    prevE = e; prevT = T;
    if (lock && t >= sp[0] + 1) {
      r.checked++;
      const g = d.geom(W, H);
      const ok = intent === "talk" ? s.target === "speaker" && cocAt(g, SPEAKER) <= C0 && cocAt(g, SPEAKER_BODY) <= C0 : s.target === "fight" && FIGHTERS.every((p) => cocAt(g, p) <= C0);
      if (!ok) r.fails++;
    }
  }
  return r;
}

test("the lens: the plane of focus is sharp, distance from it blurs, the street axis stays in the plane", () => {
  const g = lensGeom(lensOf(LOOKS.town_map, PLAYER), CAM, W, H);
  assert.ok(cocAt(g, PLAYER) < 1e-9);
  assert.ok(cocAt(g, at(5, 0, 0.9)) < 1e-6);
  const a = cocAt(g, at(0, -1, 0.9)), b = cocAt(g, at(0, -2, 0.9));
  assert.ok(a > 1 && b > a, `${a} ${b}`);
});

test("d1: racks are monotone (no pumping); the underdamped control overshoots", () => {
  assert.ok(timeline(make()).overshoot <= 1e-9);
  const u = make(); u.damping = 0.5;
  assert.ok(timeline(u).overshoot > 1e-3);
});

test("d2: drift and world events never take focus from a speaker or a fight; the lock-off control does", () => {
  const r = timeline(make());
  assert.ok(r.checked > 2000 && r.eventsInLocks >= 3);
  assert.equal(r.fails, 0);
  const c = make(); c.lockOff = true;
  assert.ok(timeline(c).fails >= 1);
});

test("d3: an idle walk drifts to living things and comes back; reduced motion never drifts or racks", () => {
  for (const calm of [false, true]) {
    const d = make();
    let prev = "player", drifts = 0, since = 0, animated = 0;
    const dwells = [];
    for (let i = 0; i < 60 / DT; i++) {
      const s = d.step({ intent: "walk", player: PLAYER, living: LIVING, reducedMotion: calm }, DT);
      if (i > 0 && calm && s.racking) animated++;
      if (s.target !== prev) { if (s.target !== "player") { drifts++; since = 0; } else dwells.push(since); prev = s.target; }
      since += DT;
    }
    if (calm) { assert.equal(drifts, 0); assert.equal(animated, 0); }
    else { assert.ok(drifts >= 2); for (const w of dwells) assert.ok(w >= 2 && w <= 6, `dwell ${w}`); }
  }
});

test("d4: a door slam in a walk is answered at once and sharp within a second", () => {
  const d = make();
  let latency = -1, settle = -1;
  for (let i = 0; i < 8 / DT; i++) {
    const t = i * DT, events = Math.abs(t - 3) < DT / 2 ? [{ p: DOOR, kind: "door", salience: 0.9 }] : [];
    const s = d.step({ intent: "walk", player: PLAYER, playerMoving: true, events }, DT);
    if (latency < 0 && t >= 3 - 1e-9 && s.target === "event:door") latency = t - 3;
    if (latency >= 0 && settle < 0 && cocAt(d.geom(W, H), DOOR) <= C0) settle = t - 3;
  }
  assert.ok(latency >= 0 && latency <= 0.25, `latency ${latency}`);
  assert.ok(settle >= 0 && settle <= 1, `settle ${settle}`);
});

test("d5: the child's jitter is capped and slow; none under reduced motion", () => {
  for (const calm of [false, true]) {
    const d = make("child");
    let prev = 0, worst = 0, most = 0;
    for (let i = 0; i < 30 / DT; i++) {
      d.step({ intent: "walk", player: PLAYER, playerMoving: true, reducedMotion: calm }, DT);
      const j = LOOKS.town_map.K * d.jitterNow;
      if (i > 0) worst = Math.max(worst, Math.abs(j - prev));
      most = Math.max(most, Math.abs(j)); prev = j;
    }
    if (calm) assert.equal(most, 0); else assert.ok(worst <= 0.02 && worst > 0, `${worst}`);
  }
});

test("tension narrows the wedge, and the speaker stays sharp at full tension", () => {
  const widths = [0, 1].map((tension) => {
    const d = make();
    for (let i = 0; i < 120; i++) d.step({ intent: "talk", player: PLAYER, speaker: SPEAKER, tension }, DT);
    const g = d.geom(W, H);
    assert.ok(cocAt(g, SPEAKER) <= C0);
    return cocAt(g, at(-7, -1.2, 1.61));
  });
  assert.ok(widths[1] > widths[0], `${widths}`);
});
