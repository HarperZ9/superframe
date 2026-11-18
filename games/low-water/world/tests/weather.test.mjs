// Weather and time: the day's weighting, each region keeping its signature, the sky events.
//   node --test games/low-water/world/tests/weather.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { PARTS, sunElevation, sunDir, dayPart, moon, REGION_WEATHER, regionState, weatherAt, skyEvents, sky, makeRegionField } from "../weather.mjs";

const SEED = 20261118;

test("the day is weighted toward dusk, night and dawn", () => {
  const share = {};
  for (const p of PARTS) share[p.name] = (share[p.name] || 0) + (p.to - p.from) / 24;
  assert.ok(share.day <= 0.26, `day takes ${share.day}`);
  assert.ok(share.dusk > share.dawn && share.night > share.day);
  // measured from the sun itself, in steps of a minute: high sun (over 20 degrees) is rare
  let high = 0, low = 0, dark = 0;
  for (let m = 0; m < 1440; m++) { const e = sunElevation(m / 60); if (e > 20) high++; else if (e > -6) low++; else dark++; }
  console.log(`  sun over 20 degrees ${(high / 14.4).toFixed(1)} % of the day, low sun and twilight ${(low / 14.4).toFixed(1)} %, dark ${(dark / 14.4).toFixed(1)} %`);
  assert.ok(high / 1440 < 0.12, "noon lasts too long");
  assert.ok(low / 1440 > 0.38, "the low sun does not last");
  assert.equal(dayPart(17), "dusk"); assert.equal(dayPart(2), "night"); assert.equal(dayPart(6), "dawn");
});

test("the sun rises in the east, stands in the south and sets in the west", () => {
  const dawn = sunDir(6.5), noon = sunDir(11), dusk = sunDir(17);
  assert.ok(dawn[0] > 0.5, "the morning sun is not in the east");
  assert.ok(noon[2] > 0.7 && Math.abs(noon[0]) < 0.05 && noon[1] > 0.5, "the noon sun is not high in the south");
  assert.ok(dusk[0] < -0.5, "the evening sun is not in the west");
  for (let h = 0; h < 24; h += 0.25) { const d = sunDir(h); assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-9); }
  assert.ok(Math.abs(moon(14.75, 0).lit - 1) < 0.01 && moon(0, 0).lit < 0.01, "the moon's phase is wrong");
});

test("each region keeps its signature weather through thirty days", () => {
  const mean = {};
  for (let id = 1; id <= 11; id++) {
    const sum = { fog: 0, cover: 0, snow: 0, rain: 0, wind: 0 }; let n = 0;
    for (let day = 0; day < 30; day++) for (let h = 0; h < 24; h += 2) {
      const s = regionState(SEED, id, day, h); n++;
      for (const k in sum) { sum[k] += s[k]; assert.ok(s[k] >= 0 && s[k] <= (k === "fog" ? 3 : 1.5), `${k} of region ${id} is ${s[k]}`); }   // fog is per km, the rest are shares
      assert.ok(s.fog <= REGION_WEATHER[id].fog * 1.3 && s.cover <= 1);
    }
    mean[id] = Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, v / n]));
  }
  const m = mean;
  assert.ok(m[1].snow > 0.3 && m[11].snow > 0.3, "the north does not snow");
  assert.ok(m[3].fog > m[5].fog * 10, "the fog forest is not foggier than the canyon");
  assert.ok(m[5].cover < 0.2 && m[9].cover < 0.25, "the dry regions are not clear");
  assert.ok(m[4].wind > m[9].wind * 4 && m[4].rain > 0.2, "the storm coast is calm");
  assert.equal(REGION_WEATHER[2].cloudSea > 0, true);
  for (const id of [3, 5, 6, 9]) assert.equal(m[id].snow, 0);
  console.log("  " + Object.entries(m).map(([id, v]) => `${id}: fog ${v.fog.toFixed(2)} cover ${v.cover.toFixed(2)} snow ${v.snow.toFixed(2)} rain ${v.rain.toFixed(2)}`).join("\n  "));
});

test("a border between regions is a gradient, not a step", () => {
  const shares = makeRegionField((x) => (x < 50000 ? 3 : 5), 100000, 20000);   // fog forest to the west, canyon to the east
  let last = null, worst = 0;
  for (let x = 44000; x <= 56000; x += 250) {
    const w = weatherAt(SEED, shares, x, 5000, 3, 12);
    if (last !== null) worst = Math.max(worst, Math.abs(w.fog - last));
    last = w.fog;
  }
  const a = weatherAt(SEED, shares, 40000, 5000, 3, 12).fog, b = weatherAt(SEED, shares, 60000, 5000, 3, 12).fog;
  assert.ok(a > b * 5, "the two sides do not differ");
  assert.ok(worst < (a - b) * 0.08, `fog steps by ${worst} of a ${a - b} change`);
  console.log(`  fog ${a.toFixed(3)} in the forest, ${b.toFixed(3)} in the canyon; the largest change over 250 m is ${worst.toFixed(4)}`);
});

test("sky events happen, and only when they can", () => {
  let aurora = 0, halo = 0, comet = 0, cells = 0, auroraByDay = 0, nights = 0;
  const clearNorth = { ...regionState(SEED, 11, 0, 0), cover: 0.1, storm: 0 }, coast = { ...regionState(SEED, 4, 0, 0), storm: 1, cover: 0.8 };
  for (let day = 0; day < 120; day++) {
    const night = skyEvents(SEED, clearNorth, 0.05, day, 23.5), noon = skyEvents(SEED, clearNorth, 0.05, day, 11);
    nights++;
    if (night.aurora > 0.15) aurora++;
    if (night.halo > 0.1) halo++;
    if (night.comet > 0.1) comet++;
    if (noon.aurora > 0) auroraByDay++;
    if (skyEvents(SEED, coast, 0.5, day, 17).cells.length) cells++;
    assert.equal(skyEvents(SEED, clearNorth, 0.05, day, 23.5).cells.length, 0, "a storm cell where storms do not form");
  }
  console.log(`  of ${nights} clear northern nights: aurora on ${aurora}, a halo on ${halo}, the comet on ${comet}; storm cells on ${cells} coast evenings`);
  assert.ok(aurora > 20 && aurora < 100); assert.ok(halo > 5); assert.ok(comet >= 10 && comet <= 20); assert.ok(cells > 30);
  assert.equal(auroraByDay, 0, "aurora at noon");
  // the aurora belongs to the north: the same night in the far south shows none
  assert.equal(skyEvents(SEED, clearNorth, 0.95, 11, 23.5).aurora, 0);
});

test("the same seed, place and time give the same sky", () => {
  const shares = makeRegionField(() => 4, 20000, 20000), a = sky(SEED, shares, 1000, 2000, 98304, 12, 17.25), b = sky(SEED, shares, 1000, 2000, 98304, 12, 17.25), c = sky(SEED + 1, shares, 1000, 2000, 98304, 12, 17.25);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.weather, c.weather);
});
