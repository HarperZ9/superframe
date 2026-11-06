// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
//
// impacts.mjs: an engine scene that makes its own sound. Balls fall through the rooms' impact geometry
// (rooms/core/data/impact-scene.js) onto bars of measured materials, bounce and settle; every impact is sent,
// when its sound reaches the listener, to the BuildLang host as one line on standard output:
//   engine time (s), kind (1 + 0.999 x, x the landing point along the bar), the bar's fundamental (Hz), its loss
//   factor, amplitude (with 1/r spreading), and the moment the engine made the event on the shared clock (s).
// The bar's fundamental comes from the same physics as the workstation's modal core (a free Euler-Bernoulli
// bar, beta_1 L = 4.730), with Young's modulus and density from packages/measured/data/mechanical.json and the
// loss factor from data/decay_iowa.json; gravity is the CODATA standard value. Restitution is from memory
// (low confidence). The engine steps at 60 frames a second on its own clock.
//   node packages/daw/engine/impacts.mjs [seconds] | buildc run packages/daw/bld/main.bld -- live
//   node packages/daw/engine/impacts.mjs --dry [seconds]      the events as JSON, without waiting
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { IMPACT_SCENE } from '../../rooms/core/data/impact-scene.js';

const here = p => fileURLToPath(new URL(p, import.meta.url));
const rows = name => JSON.parse(readFileSync(here(`../../measured/data/${name}.json`), 'utf8')).rows;
const MECH = Object.fromEntries(rows('mechanical').map(r => [r.id, r.value]));
const DECAY = Object.fromEntries(rows('decay_iowa').map(r => [r.id, r.value]));
const G = rows('codata2022').find(r => r.quantity === 'standard acceleration of gravity').value;
const BETA1 = 4.730040744862704;
const RESTITUTION = 0.6;
const FPS = 60;

export function barFundamental(material, length, thickness) {
  const E = MECH[`${material}.E`], rho = MECH[`${material}.rho`];
  return (BETA1 ** 2 / (2 * Math.PI * length ** 2)) * Math.sqrt((E * thickness ** 2) / (12 * rho));
}

export { IMPACT_SCENE as SCENE };

const speedOfSound = (celsius) => MECH['air.c0'] * Math.sqrt((celsius + 273.15) / 273.15);

// The bar under a ball, if any: the one whose top it meets first on the way down, with the landing position
// as a fraction of the bar's length.
function barUnder(ball, scene) {
  let best = null;
  scene.bars.forEach((bar, i) => {
    const x = (ball.x - bar.x0) / bar.length;
    const top = bar.y + bar.thickness / 2 + ball.radius;
    if (x > 0 && x < 1 && Math.abs(ball.z - bar.z) < 0.03 && top < ball.y && (!best || top > best.top)) best = { i, x, top };
  });
  return best;
}

// Every impact of every ball until it settles (bounce height under 2 mm), in engine time, as heard at the
// listener: emitted after the sound's flight time, with 1/r spreading (re 1 m).
export function impacts(scene = IMPACT_SCENE) {
  const out = [], c = speedOfSound(scene.temperatureC);
  scene.balls.forEach((ball, j) => {
    const hit = barUnder(ball, scene);
    if (!hit) return;
    const bar = scene.bars[hit.i];
    const f1 = barFundamental(bar.material, bar.length, bar.thickness), eta = DECAY[`${bar.material}.eta_measured`];
    const point = [ball.x, bar.y + bar.thickness / 2, bar.z];
    const r = Math.hypot(...point.map((p, k) => p - scene.listener[k]));
    const drop = ball.y - hit.top;
    let t = Math.sqrt((2 * drop) / G) + 0.15 * j, v = Math.sqrt(2 * G * drop);
    const v0 = v;
    while ((v * v) / (2 * G) > 0.002) {
      out.push({ t, heard: t + r / c, kind: 1 + 0.999 * hit.x, f1, eta, amp: (0.5 * (v / v0)) / r, bar: hit.i, ball: j, x: hit.x, r });
      v *= RESTITUTION;
      t += (2 * v) / G;
    }
  });
  return out.sort((a, b) => a.heard - b.heard);
}

const nowS = () => Number(process.hrtime.bigint()) / 1e9;   // QueryPerformanceCounter on Windows, as the host

async function stream(seconds) {
  const events = impacts();
  const start = nowS();
  let frame = 0, k = 0;
  while (frame / FPS < seconds) {
    const tFrame = frame / FPS;
    while (k < events.length && events[k].heard <= tFrame) {
      const e = events[k++];
      process.stdout.write(`${e.t.toFixed(6)} ${e.kind} ${e.f1.toFixed(4)} ${e.eta} ${e.amp.toFixed(5)} ${nowS().toFixed(7)}\n`);
    }
    frame += 1;
    const wait = start + frame / FPS - nowS();
    if (wait > 0) await new Promise(r => setTimeout(r, wait * 1000));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dry = process.argv.includes('--dry');
  const seconds = Number(process.argv.find(a => /^\d+(\.\d+)?$/.test(a)) ?? 6);
  if (dry) console.log(JSON.stringify(impacts()));
  else stream(seconds);
}
