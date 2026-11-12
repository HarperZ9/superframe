// Loading the baked places and mixing their lens layers with the player's lens settings. The
// settings are the engine's own player-facing layer (web/shaders/lens/settings.mjs): its schema,
// presets and validation; the mix weights follow what applyLensSettings does to the gains.
import { makeWorld, ROOMS, GRID } from "./world.mjs";

async function loadImage(url) { const im = new Image(); im.src = url; await im.decode(); const c = new OffscreenCanvas(im.width, im.height), x = c.getContext("2d"); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height); }

export async function loadPlace(name, { isoCamera, project }) {
  // The v2 plates (environment art, CAMERA.md: one-world coordinates, orthographic, plate pixels at
  // 1080p density, world buffers at geoScale) need a shell path this prototype does not have yet.
  // Until it does, a place whose content/ plate is v2 loads its v1 bake from /content-v1/.
  let base = `/content/${name}`, info = await (await fetch(`${base}/place.json`)).json();
  if ((info.version || 1) >= 2) { console.warn(`places: ${name} is a v${info.version} plate; the prototype loads its v1 bake from /content-v1/`); base = `/content-v1/${name}`; info = await (await fetch(`${base}/place.json`)).json(); }
  const W = info.width, H = info.height;
  const [pos, ids] = await Promise.all([fetch(`${base}/geo-pos.f32`).then((r) => r.arrayBuffer()), fetch(`${base}/geo-id.u8`).then((r) => r.arrayBuffer())]);
  const camera = isoCamera(info.camera);
  const world = makeWorld({ W, H, pos: new Float32Array(pos), ids: new Uint8Array(ids), camera, project, grid: name === "quay" ? GRID : ROOMS[name].grid, walk: info.walk, gully: name === "quay" });
  const variants = {};
  for (const v of info.variants) {
    const [plate, flare, streak, halo, ca] = await Promise.all(["", "-flare", "-streak", "-halo", "-ca"].map((s) => loadImage(`${base}/${v}${s}.png`)));
    variants[v] = { plate, flare, streak, halo, ca };
  }
  const dark = info.dark ? await loadImage(`${base}/dark.png`) : null;
  return { name, info, W, H, world, variants, dark, mixed: {} };
}

// The lens weights from the player's settings, through the engine's settings layer.
export function lensWeights(settingsMod, settings) {
  const s = settingsMod.resolveLensSettings(settings), safe = s.flashSafe ? 0.4 : 1;
  return { flare: s.flare * safe, streak: (s.streaks ? 1 : 0) * safe, halo: s.halation * safe, ca: s.fringing ? 1 : 0 };
}
// plate + w * layers, as ImageData
export function mixPlate(v, w) {
  const P = v.plate.data, F = v.flare.data, S = v.streak.data, Hh = v.halo.data, C = v.ca.data, out = new ImageData(v.plate.width, v.plate.height), o = out.data;
  for (let i = 0; i < P.length; i += 4) {
    for (let c = 0; c < 3; c++) o[i + c] = P[i + c] + w.flare * F[i + c] + w.streak * S[i + c] + w.halo * Hh[i + c] + w.ca * (C[i + c] - 128);
    o[i + 3] = 255;
  }
  return out;
}
