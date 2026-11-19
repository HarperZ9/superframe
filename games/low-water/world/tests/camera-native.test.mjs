// The camera rig in BuildLang (play/native/) against the JS rig (play/camera.mjs): one scripted walk
// over made-up hills through every camera, compared bit for bit, frame by frame.
//   BUILDC=/path/to/buildc node --test games/low-water/world/tests/camera-native.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeCamera } from "../play/camera.mjs";
import { makeSolids } from "../play/solids.mjs";
import { dsin, dcos, smooth } from "../play/math.mjs";

const dir = fileURLToPath(new URL("../play/native/", import.meta.url)), BUILDC = process.env.BUILDC;
const bits = (x) => { const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0, x); return b.getBigUint64(0).toString(); };

// the same walk as play/native/main.bld, step for step
function jsRun(frames = 900) {
  const ground = (x, z) => 2 * dsin(x * 0.11) * dcos(z * 0.07) + 0.04 * x + 1.5 * dsin(z * 0.031 + 0.4);
  const cam = makeCamera({ solids: makeSolids({ ground }), ground, mode: "follow", yaw: 0, pitch: -0.1 }), dt = 1 / 60, lines = [];
  const speedAt = (f) => (f < 40 ? 1.45 * f / 40 : f < 300 ? 1.45 : f < 420 ? 4.6 : f < 760 ? 1.45 : 0);
  let x = 0, z = 0, phase = 0;
  for (let f = 0; f < frames; f++) {
    if (f === 450) cam.setMode("first"); if (f === 560) cam.setMode("iso"); if (f === 700) cam.setMode("follow"); if (f === 820) cam.setMode("nav");
    const s = speedAt(f), h = 0.6 * dsin(f * dt * 0.4), vx = dsin(h) * s, vz = -dcos(h) * s;
    x = x + vx * dt; z = z + vz * dt;
    const y = ground(x, z);
    phase = phase + s * dt / 1.6; phase = phase - Math.floor(phase);
    const body = { x, y, z, vx, vz, speed: s }, anim = { phase, moving: smooth(s / 0.55), neck: [x, y + 1.6, z] };
    const lx = f >= 100 && f < 160 ? 0.012 : 0, ly = f >= 200 && f < 230 ? -0.008 : f >= 600 && f < 640 ? 0.01 : 0;
    const v = cam.update(dt, { look: [lx, ly], move: [0, 0], zoom: 0, turnIso: 0 }, body, anim);
    // the BuildLang rig gives the eye at the framing distance; an orthographic JS pose says the same
    const e = cam.eyeOf(cam.state.pose);
    lines.push([f, bits(e[0]), bits(e[1]), bits(e[2]), bits(v.yaw), bits(v.pitch), bits(v.fov)].join(" "));
  }
  return lines;
}

test("the BuildLang camera rig gives the JS rig's bits on every frame of a walk through all four cameras", () => {
  if (!BUILDC) throw new Error("set BUILDC to a BuildLang compiler, 1.15.0 or later");
  execFileSync(BUILDC, ["build", "--release", "."], { cwd: dir, stdio: "pipe" });
  const bl = execFileSync(`${dir}target/release/main${process.platform === "win32" ? ".exe" : ""}`, { encoding: "utf8" }).trim().split(/\r?\n/), js = jsRun();
  assert.equal(bl.length, js.length);
  const first = js.findIndex((l, i) => l !== bl[i]);
  assert.equal(first, -1, first < 0 ? "" : `frame ${first} differs\n  js ${js[first]}\n  bl ${bl[first]}`);
  console.log(`  ${js.length} frames equal to the bit: follow, first person, iso, follow, nav, with the blends between`);
});

test("the comparison can fail: the BuildLang rig with its lead changed from 0.35 s to 0.36 s differs", () => {
  if (!BUILDC) throw new Error("set BUILDC to a BuildLang compiler, 1.15.0 or later");
  const tmp = mkdtempSync(join(tmpdir(), "lw-cam-control-"));
  for (const f of ["main.bld", "detmath.bld", "camera.bld"]) writeFileSync(join(tmp, f), readFileSync(join(dir, f), "utf8"));
  const cam = readFileSync(join(tmp, "camera.bld"), "utf8"), mutated = cam.replace("b.vx * 0.35", "b.vx * 0.36");
  assert.notEqual(mutated, cam, "the control's mutation did not apply");
  writeFileSync(join(tmp, "camera.bld"), mutated);
  execFileSync(BUILDC, ["build", "--release", "."], { cwd: tmp, stdio: "pipe" });
  const bl = execFileSync(join(tmp, "target", "release", `main${process.platform === "win32" ? ".exe" : ""}`), { encoding: "utf8" }).trim().split(String.fromCharCode(10)).map((l) => l.trim()), js = jsRun();
  const differ = js.filter((l, i) => l !== bl[i]).length;
  assert.ok(differ > 100, `only ${differ} frames differ`);
  console.log(`  control: ${differ} of ${js.length} frames differ`);
  rmSync(tmp, { recursive: true, force: true });
});
