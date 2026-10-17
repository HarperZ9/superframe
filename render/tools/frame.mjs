// Where world points land on a place's plate (orthographic plate camera), and how fast its world is.
//   node render/tools/frame.mjs <place> [x,y,z ...]
import { rn } from "../rn.mjs";
const CAM = await import(rn("web/shaders/paintover/camera.mjs"));
const [name, ...pts] = process.argv.slice(2), t0 = Date.now(), P = (await import(`../places/${name}.mjs`)).default;
console.log("built in", Date.now() - t0, "ms;", P.world.props.length, "props");
const C = P.camera, cam = CAM.isoCamera({ ...C, ortho: true, scale: C.H / 2 / C.ppm, dist: C.dist || 60 });
for (const s of pts) { const p = s.split(",").map(Number), q = CAM.project(cam, C.W, C.H, p); console.log(s, "->", q[0].toFixed(0), q[1].toFixed(0), "depth", q[2].toFixed(1)); }
let n = 0, t1 = Date.now(); for (let i = 0; i < 200000; i++) { P.world.map(-30 + 60 * Math.random(), -3 + 15 * Math.random(), -20 + 35 * Math.random()); n++; }
console.log("map calls/s", Math.round(n / ((Date.now() - t1) / 1000)));
