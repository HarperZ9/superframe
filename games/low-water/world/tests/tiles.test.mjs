// The binary tiles: what is packed comes back cell for cell, and the pack is far smaller than text.
//   node --test games/low-water/world/tests/tiles.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { packWorld, gunzip, decodeBlock, TILE, STEP, WIDE, BYTE } from "../tiles.mjs";

// a small made-up island: smooth heights, patches of cover, water where it is low; not a multiple of the tile
function madeUp(W, H) {
  const c = {}; for (const n of [...WIDE, ...BYTE]) c[n] = new Uint16Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x, m = 400 * Math.sin(x / 61) * Math.cos(y / 47) + 90 * Math.sin(x / 9 + y / 13);
    c.height[k] = Math.round((m + 512) * 16); c.water[k] = m < -150 ? 8192 : 0;
    c.biome[k] = (x >> 5) % 14; c.region[k] = 1 + ((x >> 7) + (y >> 7)) % 11; c.river[k] = (x * 7 + y * 3) % 251 === 0 ? 40 : 0; c.moist[k] = (x + y) & 255;
  }
  return c;
}

test("a packed world unpacks to the same cells, tile by tile", async () => {
  const W = 600, H = 300, codes = madeUp(W, H), files = await packWorld(codes, W, H), idx = JSON.parse(files["index.json"]);
  assert.equal(idx.cols, Math.ceil(W / TILE)); assert.equal(idx.rows, Math.ceil(H / TILE));
  const back = {}; for (const n of [...WIDE, ...BYTE]) back[n] = new Uint16Array(W * H).fill(65535);
  for (let r = 0; r < idx.rows; r++) for (let c = 0; c < idx.cols; c++) {
    const w = Math.min(TILE, W - c * TILE), h = Math.min(TILE, H - r * TILE);
    decodeBlock(await gunzip(files[`t_${c}_${r}.bin`]), w, h, (name, x, y, v) => { back[name][(r * TILE + y) * W + c * TILE + x] = v; });
  }
  for (const n of [...WIDE, ...BYTE]) assert.deepEqual(back[n], codes[n], `${n} differs after a round trip`);
});

test("the overview holds one cell in eight of every raster", async () => {
  const W = 600, H = 300, codes = madeUp(W, H), files = await packWorld(codes, W, H), ow = Math.floor(W / STEP), oh = Math.floor(H / STEP);
  let seen = 0;
  decodeBlock(await gunzip(files["overview.bin"]), ow, oh, (name, x, y, v) => { assert.equal(v, codes[name][(y * STEP + 4) * W + x * STEP + 4], `${name} at overview cell ${x}, ${y}`); seen++; });
  assert.equal(seen, ow * oh * 6);
});

test("a damaged tile is caught, not read as ground", async () => {
  // the control: flip the stream's own check and the unpack must fail
  const files = await packWorld(madeUp(300, 300), 300, 300), bad = files["t_0_0.bin"].slice(); bad[bad.length - 3] ^= 0x5a;
  await assert.rejects(() => gunzip(bad));
});

test("the pack is at least five times smaller than the same world as text", async () => {
  const W = 1024, H = 512, codes = madeUp(W, H), files = await packWorld(codes, W, H);
  let text = 0; for (const n of [...WIDE, ...BYTE]) for (let k = 0; k < W * H; k++) text += String(codes[n][k]).length + 1;
  const bytes = JSON.parse(files["index.json"]).bytes;
  console.log(`  ${(text / 1e6).toFixed(2)} MB as text, ${(bytes / 1e6).toFixed(2)} MB packed`);
  assert.ok(bytes * 5 < text, `${bytes} bytes packed against ${text} as text`);
});
