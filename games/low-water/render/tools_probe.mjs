import S from "./scenes/brine_room.mjs";
import { makeTracer } from "./sdf.mjs";
import { rn } from "./rn.mjs";
const { isoCamera, ray } = await import(rn("web/shaders/paintover/camera.mjs"));
const cam = isoCamera({ yawDeg: 34, elevDeg: 30, target: [0, 1.3, -0.4], dist: 44, ortho: false, fovY: 0.29 }), tr = makeTracer(S.map, S.idOf);
for (const [x, y] of [[240, 40], [240, 70], [120, 100], [380, 90], [300, 50]]) { const r = ray(cam, 480, 270, x, y), h = tr.march(r.o, r.d, 220); console.log(x, y, h.hit, h.id, h.P && h.P.map((v) => v.toFixed(2)).join(","), h.hit && tr.normal(h.P).map((v) => v.toFixed(2)).join(",")); }
