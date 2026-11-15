// Bakes the lettering atlases (the UI art lead's, 2026-10-21): every letter of lettering/skeleton.mjs
// written three times by each tool of lettering/brush.mjs, packed in rows into one grey PNG per tool
// (the value is the paint's cover), with a JSON of where each variant sits and how far it advances.
//   node game/engine/tools/letterbake.mjs [--tools brush,flat,pen,stamp] [--variants 3] [--em 96] [--out game/engine/ui/lettering/atlas]
// Heavy: run it under the lock, node tools/gpu-lock.mjs run --lock heavy-cpu "letterbake" -- node ...
import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { GLYPHS } from "../ui/lettering/skeleton.mjs";
import { INSULAR, INSULAR_ROUND, INSULAR_KERN } from "../ui/lettering/insular.mjs";
import { BLACKLETTER, BLACK_KERN } from "../ui/lettering/blackletter.mjs";
import { rasterGlyph, ASCENT, DESCENT, PAD } from "../ui/lettering/brush.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
// each atlas: a letter set written with a tool (round two adds the historical hands, four variants a letter)
const SETS = { brush: [GLYPHS, "brush", 3, {}], flat: [GLYPHS, "flat", 3, {}], pen: [GLYPHS, "pen", 3, {}], stamp: [GLYPHS, "stamp", 3, {}],
  insular: [INSULAR, "insular", 4, INSULAR_KERN], insularround: [INSULAR_ROUND, "insular", 4, INSULAR_KERN], textura: [BLACKLETTER, "textura", 4, BLACK_KERN], bastarda: [BLACKLETTER, "bastarda", 4, BLACK_KERN] };
const tools = String(opt.tools || Object.keys(SETS).join(",")).split(","), EM = +(opt.em || 96);
const out = opt.out || "game/engine/ui/lettering/atlas", AW = 2048;

// a grey PNG (colour type 0), each row filtered Sub or Up, whichever sums smaller
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const t = Buffer.from(type, "ascii"), len = Buffer.alloc(4), cr = Buffer.alloc(4); len.writeUInt32BE(data.length); cr.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, cr]); };
export function greyPng(px, W, H) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 0;
  const raw = Buffer.alloc((W + 1) * H);
  for (let y = 0; y < H; y++) {
    const o = y * (W + 1), row = px.subarray(y * W, (y + 1) * W), up = y ? px.subarray((y - 1) * W, y * W) : null;
    let sSub = 0, sUp = 0; for (let x = 0; x < W; x++) { sSub += Math.abs(((row[x] - (x ? row[x - 1] : 0)) << 24) >> 24); sUp += Math.abs(((row[x] - (up ? up[x] : 0)) << 24) >> 24); }
    const f = sUp < sSub ? 2 : 1; raw[o] = f;
    for (let x = 0; x < W; x++) raw[o + 1 + x] = (row[x] - (f === 1 ? (x ? row[x - 1] : 0) : up ? up[x] : 0)) & 255;
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

async function bake(name) {
  const [SET, tool, NV0, kern] = SETS[name] || (() => { throw new Error(`letterbake: no hand ${name}`); })(), NV = +(opt.variants || NV0), t0 = Date.now(), cells = [];
  for (const [ch, g] of Object.entries(SET)) for (let v = 0; v < (g.s.length ? NV : 1); v++) cells.push({ ch, v, ...rasterGlyph(g, tool, { ch, variant: v, emPx: EM }) });
  let x = 0, y = 0, rowH = 0; const glyphs = {};
  for (const c of cells) { if (x + c.w > AW) { x = 0; y += rowH + 1; rowH = 0; } c.x = x; c.y = y; x += c.w + 1; rowH = Math.max(rowH, c.h); (glyphs[c.ch] ||= []).push([c.x, c.y, c.w, c.h]); }
  const AH = y + rowH, px = new Uint8Array(AW * AH);
  for (const c of cells) for (let r = 0; r < c.h; r++) px.set(c.data.subarray(r * c.w, (r + 1) * c.w), (c.y + r) * AW + c.x);
  const png = greyPng(px, AW, AH), adv = Object.fromEntries(Object.entries(SET).map(([ch, g]) => [ch, g.w])), tool_ = name;
  await writeFile(`${out}/${name}.png`, png);
  await writeFile(`${out}/${name}.json`, JSON.stringify({ tool: tool_, em: EM, kern, unitsPerEm: 100, ascent: ASCENT, descent: DESCENT, pad: PAD, atlas: { w: AW, h: AH, src: `${name}.png` }, adv, glyphs }));
  console.log(`letterbake: ${name}: ${cells.length} glyphs, ${AW} x ${AH}, ${Math.round(png.length / 1024)} KB, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

await mkdir(out, { recursive: true });
for (const t of tools) await bake(t);
