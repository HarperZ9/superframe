import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const rn = (p) => pathToFileURL("C:/dev/worktrees/raw-native-lowwater/" + p).href;
const { isoCamera, project } = await import(rn("web/shaders/paintover/camera.mjs"));
const { makeWorld, findPath, GRID } = await import("../world.mjs");
const dir = "../../content/quay", info = JSON.parse(readFileSync(new URL(`${dir}/place.json`, import.meta.url)));
const w = makeWorld({ W: info.width, H: info.height, pos: new Float32Array(readFileSync(new URL(`${dir}/geo-pos.f32`, import.meta.url)).buffer.slice(0)), ids: new Uint8Array(readFileSync(new URL(`${dir}/geo-id.u8`, import.meta.url))), camera: isoCamera(info.camera), project });
const rules = { waterY: -3.36, floorClosed: false, gullyDeep: false };
for (let x = -14; x <= -10; x += 0.5) { const row = []; for (let z = -4; z <= 0; z += 0.5) row.push(findPath(w, [-1.2, 0, -2.6], [x, 0, z], rules) ? "#" : "."); console.log(x.toFixed(1), row.join("")); }
