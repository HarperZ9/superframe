// Low Water: mood film. A Motion scene (raw-native web/motion) over the key frames rendered for the
// look bible, with captions in the house voice. 78 seconds at 30 fps. Private draft, 2026-10-16.
// Rendered with scripts/motion_render.py on the SwiftShader adapter (CPU), raw transport.
import { rect } from "../web/motion/path.mjs";
import { text as textRun } from "../web/motion/text.mjs";
const text = (s, o) => textRun(s, o).shape;
import { span, window as win, ease } from "../web/motion/timeline.mjs";

const SHOTS = [
  // [image, start, end, zoom from, zoom to, pan x, pan y, caption]
  ["kf1-lamp-quay-2307", 5, 14.5, 1.0, 1.1, -40, 10, "The claim arrived three hours before the dark did."],
  ["kf3-weigh-house-vote", 13.5, 21.5, 1.12, 1.0, 0, -20, "Twenty-two minutes to ten. The Guild votes blindfold, by smell, in the dark."],
  ["kf2-colour-comes-back", 20.5, 29, 1.0, 1.08, 30, 0, "Under the sodium nothing has a colour. Carry it to a fire."],
  ["kf6-the-gut", 28, 36, 1.06, 1.0, 0, 30, "The Gut. Eels, smoke, and a gutter the colour fish should not be."],
  ["kf7-chancel-hill", 35, 44, 1.0, 1.1, 0, -30, "The Congregation does not say the Old Bulb broke. It says it was opened."],
  ["kf5-mothers-lamp-room", 43, 53, 1.1, 1.0, 20, 0, "A third of Mother's eye is bottle glass."],
  ["kf4-flats-low-water", 52, 63, 1.0, 1.12, -30, 20, "Nobody fired a gun. The witnesses are the tide, the fog and the light."],
  ["kf8-dawn-daybook", 62, 71.5, 1.08, 1.0, 0, 0, "By dawn, somebody's share of the dark goes in the Ledger."],
];
const W = 1920, H = 1080, INK = "#ece5d6";

async function loadPng(ctx, name) {
  const blob = await (await fetch(ctx.url(`img/${name}.png`))).blob(), bmp = await createImageBitmap(blob);
  // the renderer's image atlas is 2048 square: eight stills fit at 896 x 504 (two to a shelf, four shelves)
  const w = 896, h = 504, c = new OffscreenCanvas(w, h), g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(bmp, 0, 0, w, h);
  return { width: w, height: h, data: new Uint8Array(g.getImageData(0, 0, w, h).data.buffer) };
}

export default {
  title: "Low Water: mood film",
  duration: 78,
  fps: 30,
  burnsCaptions: true,
  chapters: [],
  async load(ctx) {
    const atlas = await ctx.json("hanken.atlas.json");
    if (ctx.motion && ctx.motion.image) for (const [name] of SHOTS) ctx.motion.image(name, await loadPng(ctx, name));
    return { atlas, full: rect(0, 0, W, H) };
  },
  frame(t, ctx) {
    const { atlas, full } = ctx.assets, items = [];
    for (const [name, a, b, z0, z1, px, py, cap] of SHOTS) {
      if (t < a - 0.01 || t > b + 0.01) continue;
      const fade = win(t, a, b, 1.0, 1.0), u = span(t, a, b, ease.inOut), z = z0 + (z1 - z0) * u;
      const w = W * z, h = H * z, x = (W - w) / 2 + px * u, y = (H - h) / 2 + py * u;
      items.push({ shape: full, fill: { image: name, rect: [x, y, w, h] }, opacity: fade, screen: true });
      const c = win(t, a + 1.2, b - 1.4, 0.6, 0.6);
      if (c > 0) {
        items.push({ shape: rect(0, H - 150, W, 150), fill: [0, 0, 0, 0.45 * c], screen: true });
        items.push({ shape: text(cap, { atlas, size: 40, x: W / 2, y: H - 62, anchor: "center" }), fill: INK, opacity: c, screen: true });
      }
    }
    const title = win(t, 0.6, 5.2, 1.2, 1.0), end = win(t, 71.2, 78, 1.2, 0.8);
    if (title > 0) {
      items.push({ shape: text("LOW WATER", { atlas, size: 150, x: W / 2, y: H / 2 + 20, anchor: "center", tracking: 0.18 }), fill: INK, opacity: title, screen: true });
      items.push({ shape: text("a night-shift thriller in a tidal town", { atlas, size: 38, x: W / 2, y: H / 2 + 110, anchor: "center" }), fill: "#b8b0a0", opacity: title, screen: true });
    }
    if (end > 0) {
      items.push({ shape: text("LOW WATER", { atlas, size: 120, x: W / 2, y: H / 2 - 10, anchor: "center", tracking: 0.18 }), fill: INK, opacity: end, screen: true });
      items.push({ shape: text("working title. a showcase for the raw-native engine. private draft.", { atlas, size: 32, x: W / 2, y: H / 2 + 70, anchor: "center" }), fill: "#958e80", opacity: end, screen: true });
    }
    return { background: [0.0015, 0.0012, 0.0021], items };
  },
};
