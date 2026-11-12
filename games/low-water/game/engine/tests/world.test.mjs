import { test } from "node:test";
import assert from "node:assert/strict";
import { game } from "./helpers.mjs";
import { NIGHT_ONE, tideAt, keyAt, scheduleEnv } from "../world/night.mjs";
import { toMin } from "../core/expr.mjs";

test("R11 night one: the tide from low and high water opens the gully 22:14 to 23:42", () => {
  assert.ok(Math.abs(tideAt(NIGHT_ONE, toMin("22:58")) + 0.55) < 1e-9);
  assert.ok(Math.abs(tideAt(NIGHT_ONE, toMin("05:10")) - 5.3) < 1e-9);
  const open = [];
  for (let m = toMin("21:30"); m <= toMin("01:00"); m++) if (tideAt(NIGHT_ONE, m) < -0.35) open.push(m);
  assert.equal(open[0], toMin("22:14"));
  assert.equal(open[open.length - 1], toMin("23:42"));
});

test("R11 keyframes: numbers ease, words and frost switch", () => {
  assert.equal(keyAt(NIGHT_ONE, "rain", toMin("02:00")), 6, "heavy rain 01:30 to 02:40");
  assert.ok(Math.abs(keyAt(NIGHT_ONE, "temp", toMin("03:25")) - 2.5) < 1e-9, "4 at 02:40 to 1 at 04:10, halfway");
  assert.equal(keyAt(NIGHT_ONE, "frost", toMin("04:09")), 0);
  assert.equal(keyAt(NIGHT_ONE, "frost", toMin("05:00")), 1);
  assert.equal(keyAt(NIGHT_ONE, "wind.dir", toMin("23:40")), 225);
});

test("R8 environment commands: setLight, setTerm, setPower, gust", () => {
  const env = scheduleEnv({ places: { q: { light: 0.6, sodium: 0.9, dark: 0.03, zone: "quay" } }, clock: toMin("23:00") });
  env.command(["setLight", "q", "0.4", "0"]);
  assert.deepEqual([env.term("light", "q"), env.term("sodium", "q")], [0.4, 0]);
  env.command(["setPower", "quay", "off"]);
  assert.equal(env.term("light", "q"), 0.03, "power off: the dark light");
  env.command(["gust", "10", "15"]);
  assert.equal(env.term("wind.speed"), 16);
  env.advance(20);
  assert.equal(env.term("wind.speed"), 6, "the gust is over");
  env.command(["setTerm", "tide", "1.5"]);
  assert.equal(env.term("tide"), 1.5);
});

test("R7 wetness: rain wets Lamb by the clothes' shed; shelter and stoves dry", () => {
  const G = game(); G.setPlace("t.yard");
  G.inv.give("t.oilskin"); G.inv.equip("t.oilskin");
  G.env.command(["setTerm", "rain", "2"]);
  G.advance(60);
  assert.ok(Math.abs(G.body.wet() - 2 * 0.004 * 60 * 0.2) < 1e-9, "exposure 1 - 0.8");
  G.inv.unequip("coat"); G.advance(60);
  const w = G.body.wet(); assert.ok(w > 0.5);
  G.setPlace("t.room"); G.advance(50);
  assert.ok(Math.abs(G.body.wet() - w * Math.exp(-1)) < 0.01, "at a stove the time constant is 50 minutes");
});

test("R7 guise and warmth from the worn coat and hat", () => {
  const G = game();
  assert.equal(G.scope.get("guise"), "shelf");
  G.inv.give("t.bowler"); G.inv.equip("t.bowler");
  assert.equal(G.scope.get("guise"), "clerk");
  G.inv.give("t.oilskin"); G.inv.equip("t.oilskin");
  assert.equal(G.scope.get("guise"), "floor", "the coat speaks first");
  assert.equal(G.scope.get("warm"), 1);
  G.body.addWet(0.5);
  assert.equal(G.scope.get("warm"), 0, "a wet coat keeps no warmth");
});

test("R4 meters rise per game hour on conditions and fall at a stove", () => {
  const G = game(); G.setPlace("t.yard");
  G.env.command(["setTerm", "wind.speed", "5"]); G.env.command(["setTerm", "rain", "0"]);
  G.body.addWet(0.5); G.advance(60);
  assert.ok(Math.abs(G.pressure.meter("chill") - 3) < 1e-9);
  assert.ok(Math.abs(G.pressure.meter("tired") - 1) < 1e-9);
  assert.ok(Math.abs(G.pressure.meter("tension") - 2) < 1e-9, "light 0.02 in the yard");
  G.setPlace("t.room"); G.advance(15);
  assert.ok(G.pressure.meter("chill") < 0.5, "-12 an hour by the stove");
});

test("R4 a full meter plays its scene with $district; outside a talk through nextScene", () => {
  const G = game(); G.setPlace("t.yard"); // district d.gut, which has no chilled scene of its own
  G.pressure.addMeter("chill", 10);
  assert.deepEqual(G.nextScene(), { kind: "meter", id: "chill", node: "t.chilled" });
  const H = game(); H.world.enter("t.quay");
  H.pressure.addMeter("chill", 10);
  const t = H.talk("t.r.hub");
  assert.equal(t.beat.lines[0].text, "Test: chilled on the quay.", "inside a talk, at the node boundary");
  assert.ok(t.beat.lines.some((l) => l.text === "Test hub for the requests."), "and the scene returns");
});

test("R5 nodding: the latest trait's page, then the meter falls to 4 and 30 minutes pass", () => {
  const G = game(); G.create({ archetype: "a.clerk", enter: false });
  const c0 = G.clock();
  G.pressure.addMeter("tired", 10);
  const s = G.nextScene();
  assert.equal(s.node, "t.nod.t.night_eyes");
  assert.equal(G.pressure.meter("tired"), 4);
  assert.equal(G.clock() - c0, 30);
  const H = game(); H.pressure.addMeter("tired", 10);
  assert.equal(H.nextScene().node, "t.nod.default", "no completed trait with a page");
});

test("@char: schedules, here(), and the faction a speaker owes", () => {
  const G = game(); G.setPlace("t.quay");
  assert.equal(G.scope.call("here", [{ k: "id", name: "t.speaker" }], G.scope), true);
  G.advance(45);
  assert.equal(G.people.where("t.speaker"), "t.bar");
  G.people.move("t.speaker", "t.room");
  assert.equal(G.people.where("t.speaker"), "t.room", "move() overrides the schedule");
  assert.equal(G.people.factionOf("SPEAKER"), "guild");
  assert.equal(G.people.factionOf("NOBODY"), null);
});

test("R10 a Tide Run is won by walking to the goal; frost slides when ballast is low", () => {
  const G = game(), slips = []; G.on("run.slip", (e) => slips.push(e));
  const r = G.runs.start("t.dash", { mode: "full" });
  for (let i = 0; i < 400 && !r.state.done; i++) r.step(0.05, { x: 1, z: 0 });
  assert.equal(r.state.outcome, "win");
  assert.equal(slips.length, 1, "ballast 3 is below the patch's 6");
  assert.equal(G.runs.finish(), "t.run.win");
  assert.equal(G.scope.get("run.t.dash"), "win");
});

test("R10 the tide sweeps a Lamb who waits; the clock runs at the run's rate", () => {
  const G = game(); G.env.command(["setTerm", "tide", "1.6"]); // water at a + b * tide = 1.0: above the waist
  const r = G.runs.start("t.dash");
  r.step(0.1, {});
  assert.deepEqual([r.state.outcome, r.state.reason], ["lose", "swept"]);
  const H = game(), c0 = H.clock(), q = H.runs.start("t.dash");
  for (let i = 0; i < 80; i++) q.step(0.1, {}); // 8 real seconds standing still
  assert.equal(H.clock() - c0, 2, "4 real seconds per game minute");
  assert.ok(H.body.wet() > 0, "the run's hazard (spray) is live during the run");
});

test("R10 stepped and half modes give the same outcome as full speed", () => {
  const outcome = (mode) => { const G = game(), r = G.runs.start("t.dash", { mode }); for (let i = 0; i < 2000 && !r.state.done; i++) mode === "stepped" ? r.stepMove(1, 0) : r.step(0.05, { x: 1 }); return r.state.outcome; };
  assert.deepEqual(["full", "half", "stepped"].map(outcome), ["win", "win", "win"]);
});

test("rumour spreads to the next district each half hour and decays", () => {
  const G = game(); G.world.enter("t.quay");
  G.pressure.addRumour("t.switch", "d.quay", 0.8);
  G.advance(30);
  assert.ok(G.pressure.rumour("t.switch", "d.gut") > 0);
  assert.ok(G.pressure.rumour("t.switch", "d.quay") < 0.8);
  assert.equal(G.pressure.knows("t.switch", "d.quay"), true);
});

test("hazards in the open world: enter, hit, leave", () => {
  const G = game(), seen = []; G.on("*", (d, ev) => { if (ev.startsWith("hazard.")) seen.push(ev); });
  G.world.enter("t.quay"); G.env.command(["setTerm", "tide", "0.5"]);
  G.hazards.step(2.1);
  assert.deepEqual(seen, ["hazard.enter", "hazard.hit"]);
  G.env.command(["setTerm", "tide", "-1"]); G.hazards.step(0.1);
  assert.equal(seen.at(-1), "hazard.leave");
  assert.ok(!G.hazards.active().length);
});

test("R16: cutting the quay power puts Mother out; power back does not relight her", () => {
  const G = game();
  G.command(["restrike", "mother"]); assert.equal(G.env.term("mother"), "burning");
  G.command(["setPower", "gut", "off"]); assert.equal(G.env.term("mother"), "burning", "another zone");
  G.command(["setPower", "quay", "off"]); assert.equal(G.env.term("mother"), "dark");
  G.command(["setPower", "quay", "on"]); assert.equal(G.env.term("mother"), "dark", "the hot-arc lockout");
  G.command(["restrike", "mother"]); assert.equal(G.env.term("mother"), "burning");
});
