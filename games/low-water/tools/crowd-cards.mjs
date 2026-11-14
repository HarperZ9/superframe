// Crowd cards (the wide lens's distant people, characters/runtime/crowd.mjs draws them): each body walking
// and standing, at eight facings and a few phases of its cycle, drawn ONCE through the full figure
// pipeline (the same drawer, the brush painter, the plate's light and the contact shadow) at a fixed
// screen scale under one plate's camera, and packed into one atlas. No cost in the frame but a drawImage
// each; the look is the pipeline's own, painted under the light where the crowd stands.
//   node tools/crowd-cards.mjs --plate quay [--variant v] [--at x,z] [--ppm 36] [--bodies a,b,...]
//        [--facings 8] [--phases 8] [--hour 23] [--root .] [--out characters/crowd/out]
// Writes <out>/<plate>-<variant>.png (RGBA atlas) and .json (each card's rectangle and its feet).
import { writeFile, mkdir } from "node:fs/promises";
import { deflateSync } from "node:zlib";
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
opt.root ||= new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
if (opt.hour != null) opt.hour = +opt.hour;
const { nodeHost } = await import("../characters/proto/nodehost.mjs");
const H = await nodeHost(opt), { readAny, shots, makeFightDrawer } = H;

const plate = opt.plate || "quay", pj = JSON.parse((await readAny(`content/${plate}/place.json`)).toString()), cam = pj.camera;
const variant = opt.variant || pj.variants[0], lights = (pj.lights && pj.lights[variant]) || [];
const ppm = +(opt.ppm || 36), FAC = +(opt.facings || 8), PH = +(opt.phases || 8), IDLE = 4;
const bodies = (opt.bodies || "hobb,fewell,strand,coe,ash,cockle,dace,gill,mab,noll,pip,rook").split(",");
const at0 = opt.at ? (([x, z]) => [x, 0, z])(opt.at.split(",").map(Number)) : [cam.target[0], 0, cam.target[2]];
const draw = await makeFightDrawer({ poseOf: (W, F) => F.pose, actorOf: (W, F) => F.who, camera: { yawDeg: cam.yawDeg, elevDeg: cam.elevDeg }, hourOf: () => opt.hour ?? 23 });
const W = { defs: {}, moves: {} }, SX = 960, SY = 700, dt = 1 / 60;
const screen = new OffscreenCanvas(1920, 1080); screen.label = "screen"; const g = screen.getContext("2d");

// one call of the drawer, and what it put on the screen: the figure and its contact shadow, composed
async function frame(F, args) {
  shots.length = 0; shots.tag = F.id;
  draw(g, F, args);
  await new Promise((r) => setTimeout(r, 0));   // the ground-shadow flush (a microtask)
  const fig = shots.filter((s) => s.label.endsWith(":over")).pop(), sh = shots.filter((s) => s.label.endsWith(":destination-over"));
  if (!fig) return null;
  const parts = [...sh, fig], x0 = Math.min(...parts.map((p) => p.x)), y0 = Math.min(...parts.map((p) => p.y)), x1 = Math.max(...parts.map((p) => p.x + p.w)), y1 = Math.max(...parts.map((p) => p.y + p.h));
  const w = x1 - x0, h = y1 - y0, d = new Uint8ClampedArray(w * h * 4);
  for (const p of parts) for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {   // source-over, the figure last
    const s = (y * p.w + x) * 4, o = ((p.y - y0 + y) * w + p.x - x0 + x) * 4, a = p.d[s + 3] / 255; if (!a) continue;
    const b = d[o + 3] / 255, out = a + b * (1 - a);
    for (let c = 0; c < 3; c++) d[o + c] = Math.round((p.d[s + c] * a + d[o + c] * b * (1 - a)) / out);
    d[o + 3] = Math.round(out * 255);
  }
  // trimmed to the pixels with alpha
  let tx0 = w, ty0 = h, tx1 = -1, ty1 = -1; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) { if (x < tx0) tx0 = x; if (x > tx1) tx1 = x; if (y < ty0) ty0 = y; if (y > ty1) ty1 = y; }
  if (tx1 < 0) return null;
  const cw = tx1 - tx0 + 1, ch = ty1 - ty0 + 1, cd = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) cd.set(d.subarray(((ty0 + y) * w + tx0) * 4, ((ty0 + y) * w + tx1 + 1) * 4), y * cw * 4);
  return { w: cw, h: ch, d: cd, ax: SX - (x0 + tx0), ay: SY - (y0 + ty0) };
}

const args = (F) => ({ x: SX, y: SY, ppm, at: at0, face: F.face, cam, plate, depth: 30, depthAt: null, lights, darkness: 0, W, down: false, room: null });
const cards = [], index = {}, t0 = Date.now();
for (const who of bodies) {
  index[who] = { walk: [], idle: [] };
  for (let k = 0; k < FAC; k++) {
    const face = (k / FAC) * Math.PI * 2, fx = Math.cos(face), fz = Math.sin(face);
    // walking: the body moves along its facing at a walk (the cycle's phase follows the distance); a card
    // each time the phase passes k / PH, after half a second to settle the coat
    const F = { id: `card:${who}:${k}:walk`, who, person: true, team: "town", x: at0[0], z: at0[2], face, pose: { anim: "walk", loop: true } };
    const got = new Array(PH).fill(null);
    for (let n = 0; n < 240 && got.some((g) => g == null); n++) {
      F.x += 1.4 * dt * fx; F.z += 1.4 * dt * fz;
      const A = draw.actorOf(F.id), u = A ? A.state.u ?? 0 : 0, q = Math.floor(((u % 1) + 1) % 1 * PH);
      if (n < 30 || got[q] != null) { draw.actorOf(F.id) ? draw.actorOf(F.id).drive({ x: F.x, z: F.z, face, pose: F.pose, dt }) : await frame(F, args(F)); continue; }
      const c = await frame(F, args(F)); if (c) { got[q] = cards.length; cards.push(c); }
    }
    index[who].walk.push(got);
    const I = { id: `card:${who}:${k}:idle`, who, person: true, team: "town", x: at0[0], z: at0[2], face, pose: { anim: "idle", loop: true } }, idle = [];
    for (let n = 0; n < 30 + IDLE * 30; n++) { const keep = n >= 30 && (n - 30) % 30 === 0; if (!keep && draw.actorOf(I.id)) { draw.actorOf(I.id).drive({ x: I.x, z: I.z, face, pose: I.pose, dt }); continue; } const c = await frame(I, args(I)); if (keep && c) { idle.push(cards.length); cards.push(c); } }
    index[who].idle.push(idle);
  }
  console.log(`crowd-cards: ${who} done (${cards.length} cards, ${Math.round((Date.now() - t0) / 1000)} s)`);
}

// packed in rows into one atlas
const AW = 2048; let x = 0, y = 0, rowH = 0; const rects = [];
for (const c of cards) { if (x + c.w > AW) { x = 0; y += rowH + 1; rowH = 0; } rects.push([x, y, c.w, c.h, c.ax, c.ay]); x += c.w + 1; rowH = Math.max(rowH, c.h); }
const AH = y + rowH, atlas = new Uint8Array(AW * AH * 4);
cards.forEach((c, i) => { const [cx, cy] = rects[i]; for (let r = 0; r < c.h; r++) atlas.set(c.d.subarray(r * c.w * 4, (r + 1) * c.w * 4), ((cy + r) * AW + cx) * 4); });

// PNG, RGBA, no filter
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const t = Buffer.from(type, "ascii"), len = Buffer.alloc(4), cr = Buffer.alloc(4); len.writeUInt32BE(data.length); cr.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, cr]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(AW, 0); ihdr.writeUInt32BE(AH, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc((AW * 4 + 1) * AH); for (let r = 0; r < AH; r++) Buffer.from(atlas.buffer, r * AW * 4, AW * 4).copy(raw, r * (AW * 4 + 1) + 1);
const pngOut = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
const out = opt.out || "characters/crowd/out", name = `${plate}-${variant}`;
await mkdir(out, { recursive: true });
await writeFile(`${out}/${name}.png`, pngOut);
await writeFile(`${out}/${name}.json`, JSON.stringify({ plate, variant, camera: { yawDeg: cam.yawDeg, elevDeg: cam.elevDeg }, ppm, hour: opt.hour ?? 23, at: at0, facings: FAC, phases: PH, idlePhases: IDLE, atlas: { w: AW, h: AH, src: `${name}.png` }, rects, bodies: index }));
console.log(`crowd-cards: ${cards.length} cards, atlas ${AW} x ${AH}, ${Math.round(pngOut.length / 1024)} KB, ${Math.round((Date.now() - t0) / 1000)} s -> ${out}/${name}.png`);
