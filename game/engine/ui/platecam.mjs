// The plate under the camera (world/camera.mjs): the area's painted plate at the area's scale,
// looking at Lamb, sliding so the speakers sit left of the talk panel while a conversation is
// open, pulling back to the whole plate on camera: wide. Eased each frame in whole plate pixels.
// Reads the art lead's v2 plates directly (content/<plate>/: place.json, the variant and its lens
// layers, dark.png, geo-pos.f32, geo-id.u8): the lens layers are mixed by the player's lens
// settings (as the prototype did), the dark plate shows while the plate's zone has no power, and
// the geo buffers give the walking ground (combat's plateArena grid, the one fights use), the
// depth of the painted room under a pixel, and the world point under a click.
//   const cam = plateCam(box, ctx); cam.focus(worldPoint or null); cam.talking(bool); cam.stop()
//   cam.toScreen(p), cam.scaleAt(p), cam.toPlate(sx, sy), cam.pointAt(sx, sy), cam.depthAt(sx, sy),
//   cam.depthOf(p), cam.place(), cam.arena(), cam.geo(), cam.ready(), cam.onLoad(fn)
import { h } from "./dom.mjs";
import { cameraScale, frame, ease, projectPlate } from "../world/camera.mjs";
import { camBasis, depthOf, geoAt, hardenGround, GROUND_CELL } from "../world/plateworld.mjs";
import { plateArena } from "../combat/sim/plate.mjs";

const places = new Map(); // plate name -> place.json (or null when missing)
async function placeJson(name) {
  if (places.has(name)) return places.get(name);
  let j = null;
  try { const r = await fetch(`/content/${name}/place.json`); if (r.ok) j = await r.json(); } catch (e) { console.warn(`platecam: no place.json for ${name}: ${e.message}`); }
  places.set(name, j); return j;
}
const geos = new Map(); // plate name -> Promise<{ pos, ids, arena }>
function plateGeo(name, pj) {
  if (!geos.has(name)) geos.set(name, (async () => {
    const [p, i] = await Promise.all([`/content/${name}/geo-pos.f32`, `/content/${name}/geo-id.u8`].map(async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.arrayBuffer(); }));
    const pos = new Float32Array(p), ids = new Uint8Array(i);
    let arena = null;
    // the ground at quarter-metre cells, props closed and a body's margin kept (world/plateworld.mjs hardenGround)
    try { arena = plateArena(pj, pos, ids, { datum: pj.datum || null, cell: GROUND_CELL }); arena.collision = hardenGround(arena, pj, pos, ids, { margin: "soft" }); } catch (e) { console.warn(`platecam: no walking ground on ${name}: ${e.message}`); }
    return { pos, ids, arena };
  })().catch((e) => { console.warn(`platecam: no geo buffers for ${name}: ${e.message}`); return null; }));
  return geos.get(name);
}
async function image(url) { const im = new Image(); im.src = url; await im.decode(); return im; }

// The lens weights from the player's settings (prefs.lens, the shape raw-native's
// web/shaders/lens/settings.mjs resolves): the prototype's lensWeights.
export function lensWeights(lens = {}) {
  const safe = lens.flashSafe ? 0.4 : 1;
  return { flare: (lens.flare ?? 1) * safe, streak: (lens.streaks === false ? 0 : 1) * safe, halo: (lens.halation ?? 1) * safe, ca: lens.fringing === false ? 0 : 1 };
}
// plate + w * layers into a canvas: the additive layers by compositing, the signed fringe layer
// (centred on 128) by a pixel pass.
function mixInto(cv, L, w) {
  cv.width = L.plate.naturalWidth; cv.height = L.plate.naturalHeight;
  const g = cv.getContext("2d", { willReadFrequently: false });
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.drawImage(L.plate, 0, 0);
  g.globalCompositeOperation = "lighter";
  for (const [k, wt] of [["flare", w.flare], ["streak", w.streak], ["halo", w.halo]]) {
    if (!L[k]) continue;
    for (let left = wt; left > 0.001; left -= 1) { g.globalAlpha = Math.min(1, left); g.drawImage(L[k], 0, 0); }
  }
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  if (L.ca && w.ca > 0) {
    const c2 = new OffscreenCanvas(cv.width, cv.height), x2 = c2.getContext("2d"); x2.drawImage(L.ca, 0, 0);
    const C = x2.getImageData(0, 0, cv.width, cv.height).data, out = g.getImageData(0, 0, cv.width, cv.height), o = out.data;
    for (let i = 0; i < o.length; i += 4) { o[i] += w.ca * (C[i] - 128); o[i + 1] += w.ca * (C[i + 1] - 128); o[i + 2] += w.ca * (C[i + 2] - 128); }
    g.putImageData(out, 0, 0);
  }
}

export function plateCam(box, ctx) {
  const G = ctx.G, img = h("canvas.platecam-img"), dark = h("canvas.platecam-img"), wrap = h("div.platecam", img, dark), card = h("div.placecard.sheet");
  dark.style.opacity = "0";
  let area = null, pj = null, geo = null, basis = null, cur = null, last = performance.now(), raf = 0, talking = false, focusAt = null, ready = false, stopped = false, boundsFn = null;
  let layers = null, lensKey = "", fade = 0, token = 0, manual = null; // manual: the camera eased by hand (frame-exact captures), else by real time
  const loaders = [];
  box.replaceChildren(card, wrap);
  // where there is no painted plate (hub districts), a card names the place
  const showCard = () => { const p = G.book.places[G.state.place] || {}, d = G.world.district(); card.replaceChildren(h("div.caps", d ? d.name : ""), h("div.pname", (area && area.name) || p.name || G.state.place || "Nowhere yet")); card.hidden = false; };
  const lens = () => (ctx.prefs && ctx.prefs.lens) || {};
  async function load(a) {
    const my = ++token;
    area = a; ready = false; cur = null; pj = null; geo = null; layers = null; basis = null;
    wrap.hidden = true; showCard();
    if (!a || !a.plate) return;
    pj = await placeJson(a.plate); if (my !== token) return;
    const v = a.variant || (pj && pj.variants && pj.variants[0]) || "night", base = `/content/${a.plate}/`;
    try {
      const names = (pj && pj.layers) || [];
      const [plate, ...rest] = await Promise.all([image(`${base}${v}.png`), ...names.map((k) => image(`${base}${v}-${k}.png`).catch(() => null))]);
      if (my !== token) return;
      layers = { plate }; names.forEach((k, i) => { layers[k === "ca" ? "ca" : k] = rest[i]; });
      lensKey = JSON.stringify(lensWeights(lens())); mixInto(img, layers, lensWeights(lens()));
      if (pj && pj.dark) image(`${base}dark.png`).then((d) => { if (my !== token) return; dark.width = d.naturalWidth; dark.height = d.naturalHeight; dark.getContext("2d").drawImage(d, 0, 0); }).catch((e) => console.warn(`platecam: no dark plate for ${a.plate}: ${e.message}`));
      ready = true; wrap.hidden = false; card.hidden = true;
    } catch (e) { wrap.hidden = true; console.warn(`platecam: no plate ${base}${v}.png: ${e.message}`); return; }
    if (pj && pj.camera) { basis = camBasis(pj.camera); geo = await plateGeo(a.plate, pj); if (my !== token) return; }
    for (const fn of loaders) fn(api);
  }
  const plateW = () => (pj ? pj.width : img.width), plateH = () => (pj ? pj.height : img.height);
  // While a conversation is open the subject sits in the middle-left of the plate the talk panel
  // leaves free, read from the panel's live width (the UI lead's rule: 0.45 of the free width, between
  // 0.2 and 0.5 of the view); with no panel on screen, @rules camera-talk-x.
  function freeTalkX() {
    const root = box.closest(".screen") || document, panel = root.querySelector("aside.talk"), view = wrap.getBoundingClientRect();
    if (!panel || !view.width) return +G.rs.rules["camera-talk-x"];
    const left = panel.getBoundingClientRect().left - view.left;
    return left > 0 && left < view.width ? Math.max(0.2, Math.min(0.5, (left / view.width) * 0.45)) : +G.rs.rules["camera-talk-x"];
  }
  function target() {
    const W = wrap.clientWidth, H = wrap.clientHeight, pw = plateW(), ph = plateH();
    const lamb = G.state.pos || (area && area.spawn) || null;
    const world = talking && focusAt && lamb ? lamb.map((v, i) => (v + focusAt[i]) / 2) : lamb;
    const focus = world && pj && pj.camera ? projectPlate(pj.camera, pw, ph, world) : null;
    // a fight frames its fighters (world/stage.mjs fightBounds): the game's closeness, pulled back only as needed
    const bounds = boundsFn && pj && pj.camera ? boundsFn((p) => projectPlate(pj.camera, pw, ph, p)) : null;
    return frame({ plateW: pw, plateH: ph, viewW: W, viewH: H, scale: cameraScale(G, area), focus, talking: talking && !bounds, talkX: talking ? freeTalkX() : +G.rs.rules["camera-talk-x"], bounds });
  }
  function powerOff() { const p = G.book.places[(area && area.place) || G.state.place] || {}, zone = p.zone || (area && area.place); return zone && G.env && G.env.term(`power.${zone}`) === "off"; }
  function tick(now) {
    if (stopped) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (G.world.area() !== area) load(G.world.area());
    if (ready && layers) { const k = JSON.stringify(lensWeights(lens())); if (k !== lensKey) { lensKey = k; mixInto(img, layers, lensWeights(lens())); } }
    if (ready && wrap.clientWidth) {
      const t = target(), calm = document.documentElement.classList.contains("calm");
      if (manual == null) cur = calm ? t : ease(cur, t, dt); else if (manual > 0) { cur = calm ? t : ease(cur, t, manual); manual = 0; } // held: eased only by advance(dt)
      for (const el of [img, dark]) { el.style.width = `${plateW() * cur.zoom}px`; el.style.transform = `translate(${-cur.left * cur.zoom}px, ${-cur.top * cur.zoom}px)`; }
      const want = pj && pj.dark && powerOff() ? 1 : 0; fade += Math.sign(want - fade) * Math.min(Math.abs(want - fade), calm ? 1 : dt / 1.4); dark.style.opacity = fade.toFixed(3);
      wrap.dataset.zoom = cur.zoom.toFixed(3); wrap.dataset.left = cur.left; wrap.dataset.top = cur.top;
    }
    raf = requestAnimationFrame(tick);
  }
  const api = {
    focus(p) { focusAt = p ? [...p] : null; },
    talking(on) { talking = !!on; },
    frameNow: () => cur,
    // while a fight plays: fn(project) -> plate-pixel bounds to keep in view; null to stop
    frameOn(fn) { boundsFn = fn; },
    // a world point to screen pixels in the plate view (null before the plate is ready)
    toScreen(p) { if (!cur || !pj || !pj.camera) return null; const [px, py] = projectPlate(pj.camera, pj.width, pj.height, p); return [(px - cur.left) * cur.zoom, (py - cur.top) * cur.zoom]; },
    // metres to screen pixels at a world point (for drawing figures at the right size)
    scaleAt(p) { const a = api.toScreen(p), b = api.toScreen([p[0], p[1] + 1, p[2]]); return a && b ? Math.abs(a[1] - b[1]) : 0; },
    // screen pixels in the plate view to plate pixels
    toPlate(sx, sy) { return cur ? [cur.left + sx / cur.zoom, cur.top + sy / cur.zoom] : null; },
    // the world point painted under a screen pixel, or null
    pointAt(sx, sy) { const p = api.toPlate(sx, sy); return p && geo ? geoAt(pj, geo.pos, p[0], p[1]) : null; },
    // the painted room's depth under a screen pixel (metres along the camera's forward axis)
    depthAt(sx, sy) { const p = api.pointAt(sx, sy); return p && basis ? depthOf(pj.camera, p, basis) : Infinity; },
    depthOf(p) { return basis ? depthOf(pj.camera, p, basis) : 0; },
    place: () => pj, arena: () => (geo && geo.arena) || null, geo: () => geo, area: () => area, darkness: () => fade,
    onLoad(fn) { loaders.push(fn); if (geo) fn(api); return () => { const i = loaders.indexOf(fn); if (i >= 0) loaders.splice(i, 1); }; },
    ready: () => ready && !!cur,
    // frame-exact tools: hold(true) stops real-time easing; advance(dt) eases by dt on the next frame
    hold(on) { manual = on ? 0 : null; },
    advance(dt) { if (manual != null) manual += dt; },
    element: wrap,
    stop() { stopped = true; cancelAnimationFrame(raf); },
  };
  load(G.world.area());
  raf = requestAnimationFrame(tick);
  return api;
}
