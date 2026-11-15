// The plate under the camera (world/camera.mjs): the area's painted plate at the area's scale,
// looking at Lamb, sliding so the speakers sit left of the talk panel while a conversation is
// open, pulling back to the whole plate on camera: wide. Eased each frame in whole plate pixels.
// Reads the art lead's v2 plates directly (content/<plate>/: place.json, the variant and its lens
// layers, dark.png, geo-pos.f32, geo-id.u8): the lens layers are mixed by the player's lens
// settings (as the prototype did), the dark plate shows while the plate's zone has no power, and
// the geo buffers give the walking ground (combat's plateArena grid, the one fights use), the
// depth of the painted room under a pixel, and the world point under a click.
//   const cam = plateCam(box, ctx); cam.focus(worldPoint or null); cam.talking(bool); cam.stop()
//   cam.macro(worldPoint, { zoom, secs }) | cam.macro(null); cam.macroSettled()   the close look at a prop (ui/examinecam.mjs)
//   cam.toScreen(p), cam.scaleAt(p), cam.toPlate(sx, sy), cam.pointAt(sx, sy), cam.depthAt(sx, sy),
//   cam.depthOf(p), cam.place(), cam.arena(), cam.geo(), cam.ready(), cam.onLoad(fn)
import { h } from "./dom.mjs";
import { cameraScale, frame, projectPlate, follower, smoothTime, framer, damp, FOLLOW } from "../world/camera.mjs";
import { camBasis, depthOf, geoAt, hardenGround, groundAt, GROUND_CELL } from "../world/plateworld.mjs";
import { occludeData, plateGround, mixInto } from "./platedata.mjs";
import { occludeDepth as occludeOf } from "./occlude.mjs";
import { inkBlots } from "../paint/inkblot.mjs";

// What a frame does with the area under the camera: "place" (another area: blot and load it), "plate" (the same area
// whose conditional plate changed, the Well House once the fire starts, 2026-10-24: load it whole, because swapVariant
// only swaps a painting within one plate and refused the new plate's variant, so the burning plate never showed in
// play), "variant" (swap the painting), or null. now: the world's area (the old one while an ink blot runs).
export function plateAction({ now, area, ready, loadedPlate, shownV }) {
  if (now !== area) return "place";
  if (ready && area && area.plate && area.plate !== loadedPlate) return "plate";
  if (ready && area && area.variant && area.variant !== shownV) return "variant";
  return null;
}
const places = new Map(); // plate name -> place.json (or null when missing)
async function placeJson(name) {
  if (places.has(name)) return places.get(name);
  let j = null;
  try { const r = await fetch(`/content/${name}/place.json`); if (r.ok) j = await r.json(); } catch (e) { console.warn(`platecam: no place.json for ${name}: ${e.message}`); }
  places.set(name, j); return j;
}
const OVERHEAD_M = 1.95;   // occData: a point this far over open floor never hides a figure
const geos = new Map(); // plate name -> Promise<{ pos, ids, arena, occ? }>
// The plate's heavy reads (the walking ground, the occlusion data, the colours) in a worker where there is one
// (ui/plateworker.mjs, the same functions: ui/platedata.mjs), so a move between places does not stall the
// frame; ?plateworker=0 (and no Worker) runs them here as before
let PW = null, pwId = 0; const pwWait = new Map();
function plateWorker() {
  if (PW !== null) return PW;
  try {
    if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined" || /[?&]plateworker=0(&|$)/.test(location.search)) return (PW = false);
    PW = new Worker(new URL("./plateworker.mjs", import.meta.url), { type: "module" });
    PW.onmessage = (e) => { const w = pwWait.get(e.data.id); if (!w) return; pwWait.delete(e.data.id); if (e.data.error) w.no(new Error(e.data.error)); else w.ok(e.data); };
    PW.onerror = (e) => { console.warn(`platecam: plate worker failed (${e.message}); reading plates here`); PW = false; for (const w of pwWait.values()) w.no(new Error("plate worker failed")); pwWait.clear(); };
  } catch (e) { console.warn(`platecam: no plate worker (${e.message})`); PW = false; }
  return PW;
}
const askPlate = (m) => { const W = plateWorker(); if (!W) return null; return new Promise((ok, no) => { const id = ++pwId; pwWait.set(id, { ok, no }); W.postMessage({ ...m, id }); }); };
function plateGeo(name, pj) {
  if (!geos.has(name) && plateWorker()) geos.set(name, askPlate({ type: "geo", name, pj, overhead: OVERHEAD_M }).then((g) => {
    if (g.warn) console.warn(`platecam: no walking ground on ${name}: ${g.warn}`);
    return { pos: g.pos, ids: g.ids, arena: g.arena, occ: g.occ };
  }).catch((e) => { console.warn(`platecam: plate worker: ${e.message}; reading ${name} here`); geos.delete(name); PW = false; return plateGeo(name, pj); }));
  if (!geos.has(name)) geos.set(name, (async () => {
    const [p, i] = await Promise.all([`/content/${name}/geo-pos.f32`, `/content/${name}/geo-id.u8`].map(async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.arrayBuffer(); }));
    const pos = new Float32Array(p), ids = new Uint8Array(i);
    let arena = null;
    // the ground at quarter-metre cells, props closed and a body's margin kept (world/plateworld.mjs hardenGround)
    try { arena = plateGround(pj, pos, ids); } catch (e) { console.warn(`platecam: no walking ground on ${name}: ${e.message}`); }
    return { pos, ids, arena };
  })().catch((e) => { console.warn(`platecam: no geo buffers for ${name}: ${e.message}`); return null; }));
  return geos.get(name);
}
// 4K: the colour plates baked at twice the size (render/bake2.mjs --hires into content4k/<plate>/), used when
// the screen has the pixels for them (?hires=1 forces, ?hires=0 never); the 1x place.json and geo serve both
const HIRES = (() => { try { const q = new URLSearchParams(location.search).get("hires"); return q === "1" ? true : q === "0" ? false : innerWidth * (devicePixelRatio || 1) > 2600; } catch { return false; } })();
const hiHas = new Map();
async function baseFor(plate, v) {
  if (!HIRES) return `/content/${plate}/`;
  const key = `${plate}/${v}`; if (!hiHas.has(key)) hiHas.set(key, fetch(`/content4k/${plate}/${v}.png`, { method: "HEAD" }).then((r) => r.ok).catch(() => false));
  return (await hiHas.get(key)) ? `/content4k/${plate}/` : `/content/${plate}/`;
}
async function image(url) { const im = new Image(); im.src = url; await im.decode(); return im; }

// The lens weights from the player's settings (prefs.lens, the shape raw-native's
// web/shaders/lens/settings.mjs resolves): the prototype's lensWeights.
// The plate's ground: the median of its four corner pixels (rooms are baked on a flat ground colour).
function groundOf(im) {
  try {
    const c = document.createElement("canvas"), w = im.naturalWidth || im.width, h = im.naturalHeight || im.height; c.width = 1; c.height = 1;
    const g = c.getContext("2d", { willReadFrequently: true });
    const px = [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]].map(([x, y]) => { g.drawImage(im, x, y, 1, 1, 0, 0, 1, 1); return g.getImageData(0, 0, 1, 1).data; }), mid = (k) => px.map((p) => p[k]).sort((a, b) => a - b)[1];
    return `rgb(${mid(0)}, ${mid(1)}, ${mid(2)})`;
  } catch (e) { console.warn(`platecam: no ground colour: ${e.message}`); return ""; }
}

export function lensWeights(lens = {}) {
  const safe = lens.flashSafe ? 0.4 : 1;
  return { flare: (lens.flare ?? 1) * safe, streak: (lens.streaks === false ? 0 : 1) * safe, halo: (lens.halation ?? 1) * safe, ca: lens.fringing === false ? 0 : 1 };
}
// mixInto: ui/platedata.mjs (shared with the plate worker)

export function plateCam(box, ctx) {
  const G = ctx.G, img = h("canvas.platecam-img"), dark = h("canvas.platecam-img"), wrap = h("div.platecam", img, dark), card = h("div.placecard.sheet");
  dark.style.opacity = "0";
  // the lens layers above the figures: a sibling the play screen stacks over the people (and a fight
  // over its fighters, lensOver), plus-lighter so black adds nothing
  const lensImg = h("canvas.platecam-img"), lensWrap = h("div.platecam.platecam-lens", lensImg);
  lensWrap.style.cssText = "pointer-events:none;mix-blend-mode:plus-lighter";
  let area = null, pj = null, geo = null, basis = null, cur = null, last = performance.now(), raf = 0, talking = false, focusAt = null, ready = false, stopped = false, boundsFn = null;
  let layers = null, lensKey = "", fade = 0, token = 0, manual = null, plateImg = null, rgbOf = null, rgbAsk = null, occ = null, planesKey = null, planesV = null, planesAsk = null; // manual: the camera eased by hand (frame-exact captures), else by real time
  const loaders = [];
  let blotting = false, blots = null;
  let motionFn = null, vel = [0, 0], offset = [0, 0]; const fol = follower(), fr = framer();
  // where there is no painted plate (a place still to be baked, design/PLACES-NEW.md), a card names the
  // place over a dimmed painting of where it is: the arrival's wide plate for the ferry, else the
  // district's own plate, so a new player never starts on black (UX walk, 2026-10-21)
  const PLATE_FOR_DISTRICT = { quay: "quay", brine: "brine", weigh: "weigh", gut: "gut", mole: "mole", floor: "floor" };
  const BACKDROP = { ferry: "wide_arrival", hall: "gut", smokehouse: "gut", loft: "gut", gutter: "gut", roof: "weigh", office: "weigh" };
  const back = h("div.placeback"); back.style.cssText = "position:absolute;inset:0;background-size:cover;background-position:center;filter:brightness(0.45) blur(1.5px);transform:scale(1.03)";
  let cardKey = "";
  box.replaceChildren(back, card, wrap); blots = inkBlots(box);   // the ink-blot canvas over the view (paint/inkblot.mjs)
  const showCard = () => {
    const p = G.book.places[G.state.place] || {}, d = G.world.district();
    const key = `${G.state.place}|${d ? d.id : ""}`; if (key === cardKey && !card.hidden) return; cardKey = key;
    card.replaceChildren(h("div.caps", d ? d.name : ""), h("div.pname", (area && area.name) || p.name || G.state.place || "Nowhere yet")); card.hidden = false;
    const plate = BACKDROP[G.state.place] || (d && PLATE_FOR_DISTRICT[d.id]) || null;
    back.style.backgroundImage = plate ? `url(/content/${plate}/night.png)` : ""; back.hidden = !plate;
  };
  const lens = () => (ctx.prefs && ctx.prefs.lens) || {};
  // An area whose variant follows the hour (@area variant: x ? cond) swaps its plate in place when the
  // hour turns it: the same ground, lights and camera, only the painting changes.
  let shownV = null;
  // the plate and its lens layers composed in the plate worker (the same mixInto, the same pixels: drawn here
  // whole), so the frame never waits on the fringe pass's readback; here when there is no worker. False when
  // a newer load has taken over.
  async function mixShow(my, base, v, names, w) {
    if (plateWorker()) {
      try {
        const r = await askPlate({ type: "mix", base, v, names, w, lens: true });
        if (my !== token) { r.img.close(); if (r.lens) r.lens.close(); return false; }
        img.width = r.img.width; img.height = r.img.height; img.getContext("2d", { willReadFrequently: false }).drawImage(r.img, 0, 0); r.img.close();
        if (r.lens) { lensImg.width = r.lens.width; lensImg.height = r.lens.height; lensImg.getContext("2d").drawImage(r.lens, 0, 0); r.lens.close(); }
        return true;
      } catch (e) { console.warn(`platecam: lens layers in the worker failed (${e.message}); mixing here`); }
    }
    if (my !== token) return false;
    mixInto(img, layers, w, lensImg); return true;
  }
  async function swapVariant(v) {
    const my = token, base = await baseFor(area.plate, v), names = (pj && pj.layers) || []; shownV = v;
    if (pj && pj.variants && !pj.variants.includes(v)) return; // not baked yet: the painting stays as it is
    try {
      const [plate, ...rest] = await Promise.all([image(`${base}${v}.png`), ...names.map((k) => image(`${base}${v}-${k}.png`).catch(() => null))]);
      if (my !== token) return;
      layers = { plate }; names.forEach((k, i) => { layers[k === "ca" ? "ca" : k] = rest[i]; });
      wrap.style.backgroundColor = groundOf(plate); rgbOf = null; occ = null; plateImg = plate; prefetchRgb();
      lensKey = JSON.stringify(lensWeights(lens())); if (!(await mixShow(my, base, v, names, lensWeights(lens())))) return;
    } catch (e) { console.warn(`platecam: no variant ${base}${v}.png: ${e.message}`); }
  }
  let loadedPlate = null;   // the plate load() showed: an area's conditional plate (@area plate: x ? cond) can change under it
  async function load(a) {
    const my = ++token;
    area = a; loadedPlate = a ? a.plate : null; ready = false; cur = null; pj = null; geo = null; layers = null; basis = null;
    wrap.hidden = true; showCard();
    if (!a || !a.plate) return;
    pj = await placeJson(a.plate); if (my !== token) return;
    // a variant the plate does not list yet (a rebake still to land) shows the plate's first; marks-check names it
    const want = a.variant || (pj && pj.variants && pj.variants[0]) || "night", v = pj && pj.variants && !pj.variants.includes(want) ? (console.warn(`platecam: plate ${a.plate} has no variant ${want}; showing ${pj.variants[0]}`), pj.variants[0]) : want, base = await baseFor(a.plate, v);
    if (my !== token) return;
    shownV = want;
    if (pj && pj.camera) plateGeo(a.plate, pj);   // started now: the plate worker reads the ground while the images load
    try {
      const names = (pj && pj.layers) || [];
      const [plate, ...rest] = await Promise.all([image(`${base}${v}.png`), ...names.map((k) => image(`${base}${v}-${k}.png`).catch(() => null))]);
      if (my !== token) return;
      layers = { plate }; names.forEach((k, i) => { layers[k === "ca" ? "ca" : k] = rest[i]; });
      wrap.style.backgroundColor = groundOf(plate); // an area pulled back past its plate shows the plate's own ground round it
      rgbOf = null; occ = null; plateImg = plate; prefetchRgb();
      lensKey = JSON.stringify(lensWeights(lens())); if (!(await mixShow(my, base, v, names, lensWeights(lens())))) return;
      if (pj && pj.dark) image(`${base}dark.png`).then((d) => { if (my !== token) return; dark.width = d.naturalWidth; dark.height = d.naturalHeight; dark.getContext("2d").drawImage(d, 0, 0); }).catch((e) => console.warn(`platecam: no dark plate for ${a.plate}: ${e.message}`));
      // the ground first (the plate worker may still be reading it): nothing walks or stands on the plate before it
      if (pj && pj.camera) { basis = camBasis(pj.camera); geo = await plateGeo(a.plate, pj); if (my !== token) return; }
      ready = true; wrap.hidden = false; card.hidden = true; back.hidden = true;
    } catch (e) { wrap.hidden = true; console.warn(`platecam: no plate ${base}${v}.png: ${e.message}`); return; }
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
  // the macro look: { at, zoom, t0, secs } while a prop is being looked at closely, eased (smoothstep) over its seconds
  let macro = null, framing = null;   // framing: the last fight bounds asked for (plate px, with close and free), for tools
  const macroK = () => { if (!macro) return 0; const k = Math.min(1, (performance.now() - macro.t0) / (macro.secs * 1000)); return k * k * (3 - 2 * k); };
  function target() {
    const W = wrap.clientWidth, H = wrap.clientHeight, pw = plateW(), ph = plateH();
    const lamb = G.state.pos || (area && area.spawn) || null;
    // walking: the reference's look-ahead and room below (world/camera.mjs follower); talking holds still
    const lamb2 = lamb && !talking ? [lamb[0] + offset[0], lamb[1], lamb[2] + offset[1]] : lamb;
    const world0 = talking && focusAt && lamb ? lamb.map((v, i) => (v + focusAt[i]) / 2) : lamb2;
    // the close look at a prop (ui/examinecam.mjs): ease the centre onto the prop and come closer over its seconds
    const mk = macroK(), world = macro && world0 ? world0.map((v, i) => v + (macro.at[i] - v) * mk) : macro ? macro.at : world0;
    const focus = world && pj && pj.camera ? projectPlate(pj.camera, pw, ph, world) : null;
    // a fight frames its fighters (world/stage.mjs fightBounds): the game's closeness, pulled back only as needed
    const bounds = boundsFn && pj && pj.camera ? boundsFn((p) => projectPlate(pj.camera, pw, ph, p)) : null; framing = bounds;
    // a fight's bounds carry { close, free } (ui/fightlayer.mjs): come in closer, centred in the view clear of the paper
    return frame({ plateW: pw, plateH: ph, viewW: W, viewH: H, scale: cameraScale(G, area) * (macro ? 1 + (macro.zoom - 1) * mk : 1), focus, talking: talking && !bounds, talkX: talking ? freeTalkX() : +G.rs.rules["camera-talk-x"], bounds, close: (bounds && bounds.close) || 1, free: (bounds && bounds.free) || null });
  }
  // The follow: position by a critically damped step whose smooth time grows with speed (tighter in a
  // fight), shown at whole plate pixels; zoom eased as before. The look-ahead offset is updated here too.
  function follow(c, t, dt) {
    vel = motionFn ? motionFn() || [0, 0] : [0, 0];
    const sp = Math.hypot(vel[0], vel[1]), fight = !!boundsFn;
    if (pj && pj.camera && !fight) {
      // screen-down on the ground: the world direction that moves a point down the screen
      const a = projectPlate(pj.camera, pj.width, pj.height, [0, 0, 0]), b = projectPlate(pj.camera, pj.width, pj.height, [1, 0, 0]), c2 = projectPlate(pj.camera, pj.width, pj.height, [0, 0, 1]);
      const ex = [b[0] - a[0], b[1] - a[1]], ez = [c2[0] - a[0], c2[1] - a[1]], det = ex[0] * ez[1] - ex[1] * ez[0];
      let down = det ? [(-ez[0]) / det, ex[0] / det] : [0, 0]; const dl = Math.hypot(...down) || 1; down = [down[0] / dl, down[1] / dl];
      offset = fol.offset(vel, dt, down);
      // never lead so far that Lamb leaves the middle of the view
      const ppm = Math.abs(projectPlate(pj.camera, pj.width, pj.height, [0, 1, 0])[1] - a[1]) * (c ? c.zoom : 1), lim = FOLLOW.viewShare * Math.min(wrap.clientWidth, wrap.clientHeight) / Math.max(1, ppm), ol = Math.hypot(...offset);
      if (ol > lim) offset = [offset[0] * lim / ol, offset[1] * lim / ol];
    } else offset = [0, 0];
    if (OLD_FOLLOW) return followOld(c, t, dt, sp, fight);
    // centre and zoom eased together, behind a dead band and a low-pass, shown at whole plate pixels with
    // hysteresis (world/camera.mjs framer; engine PROGRESS 37: no drift at rest, no jump on new bounds)
    return fr.step(t, dt, smoothTime(sp, fight), { plateW: plateW(), plateH: plateH(), viewW: wrap.clientWidth, viewH: wrap.clientHeight }, c);
  }
  // the follow before PROGRESS 37, kept as the control the camera probe must fail (?camfollow=old): left and top
  // damped toward the target zoom's corner while the zoom eased on its own, rounded every frame
  const OLD_FOLLOW = new URLSearchParams(location.search).get("camfollow") === "old", sm = { left: null, top: null };
  function followOld(c, t, dt, sp, fight) {
    if (!c) { sm.left = { x: t.left, v: 0 }; sm.top = { x: t.top, v: 0 }; return { ...t }; }
    const T = smoothTime(sp, fight), zk = 1 - Math.exp(-6 * dt);
    if (!sm.left || Math.abs(sm.left.x - c.left) > 2) sm.left = { x: c.left, v: 0 }; if (!sm.top || Math.abs(sm.top.x - c.top) > 2) sm.top = { x: c.top, v: 0 };
    const L = damp(sm.left, t.left, T, dt), Tp = damp(sm.top, t.top, T, dt);
    const zoom = Math.abs(t.zoom - c.zoom) < 1e-3 ? t.zoom : c.zoom + (t.zoom - c.zoom) * zk;
    return { ...t, zoom, left: Math.round(L), top: Math.round(Tp) };
  }
  function powerOff() { const p = G.book.places[(area && area.place) || G.state.place] || {}, zone = p.zone || (area && area.place); return zone && G.env && G.env.term(`power.${zone}`) === "off"; }
  function tick(now) {
    if (stopped) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    // a change of place: the ink spreads over the old view, the new plate loads under it, the ink draws back
    // (paint/inkblot.mjs); captures and ?blot=0 cut straight
    const act = plateAction({ now: blotting ? area : G.world.area(), area, ready, loadedPlate, shownV });
    if (act === "place") {
      const next = G.world.area(), q = new URLSearchParams(location.search), plain = q.get("blot") === "0" || (q.get("capture") === "1" && q.get("blot") !== "1");
      if (!area || plain || document.documentElement.classList.contains("calm")) load(next);
      else { blotting = true; blots.cover().then(() => load(next)).then(() => blots.reveal()).catch((e) => { console.warn(`platecam: ink blot: ${e.message}`); load(next); }).finally(() => { blotting = false; }); }
    } else if (act === "plate") load(area);
    else if (act === "variant") swapVariant(area.variant);
    if (!ready) showCard(); else back.hidden = true;   // no plate: keep the card's name and backdrop current as the scene moves
    if (ready && layers) { const k = JSON.stringify(lensWeights(lens())); if (k !== lensKey) { lensKey = k; mixInto(img, layers, lensWeights(lens()), lensImg); } }
    if (ready && wrap.clientWidth) {
      const t = target(), calm = document.documentElement.classList.contains("calm");
      if (manual == null) cur = calm ? t : follow(cur, t, dt); else if (manual > 0) { cur = calm ? t : follow(cur, t, manual); manual = 0; } // held: eased only by advance(dt), by the same follow
      lensWrap.hidden = wrap.hidden; lensImg.style.opacity = (1 - fade).toFixed(3);   // the dark plate has no lamps
      for (const el of [img, dark, lensImg]) { el.style.width = `${plateW() * cur.zoom}px`; el.style.transform = `translate(${-cur.left * cur.zoom}px, ${-cur.top * cur.zoom}px)`; }
      const want = pj && pj.dark && powerOff() ? 1 : 0; fade += Math.sign(want - fade) * Math.min(Math.abs(want - fade), calm ? 1 : dt / 1.4); dark.style.opacity = fade.toFixed(3);
      wrap.dataset.zoom = cur.zoom.toFixed(3); wrap.dataset.left = cur.left; wrap.dataset.top = cur.top;
    }
    raf = requestAnimationFrame(tick);
  }
  // The painted room's depth for hiding a figure, finer than the half-size geo buffer: where the four geo
  // samples round a pixel agree (within 0.12 m) their depths are blended; at an edge between near and far
  // the pixel takes the sample whose painted colour is nearest its own, so the cut follows the painted
  // edge at plate-pixel steps instead of the geo buffer's staircase (author 2026-10-17: clipping).
  // floorY (the figure's floor): a painted point more than OVERHEAD m above it and above open floor of
  // its own (a hanging lamp, a beam) never hides a figure; walls and counters still do.
  const OVERHEAD = OVERHEAD_M;
  function occData() {
    if (occ || !geo || !pj || !basis) return occ;
    occ = geo.occ || occludeData(pj, geo.pos, geo.arena, basis, OVERHEAD); return occ;   // the worker's (plateGeo), or made here
  }
  // the plate's colours read in the plate worker as soon as the plate shows (prefetchRgb); until they arrive
  // occlusion() answers null, so a figure job waits for them as it waits for the depths
  function prefetchRgb() {
    if (!plateWorker() || !plateImg || rgbOf) return;
    const my = token, im = plateImg, url = im.src, w = pj ? pj.width : im.naturalWidth, h = pj ? pj.height : im.naturalHeight;
    const ask = (rgbAsk = askPlate({ type: "rgb", url, w, h }));
    ask.then((c) => { if (my === token && plateImg === im && !rgbOf) rgbOf = { d: c.d, w: c.w, h: c.h }; })
      .catch((e) => console.warn(`platecam: plate colours in the worker failed (${e.message}); reading them here`))
      .finally(() => { if (rgbAsk === ask) rgbAsk = null; });
  }
  function loadRgb() {
    if (!rgbOf && plateImg) { try { const c = new OffscreenCanvas(pj ? pj.width : plateImg.naturalWidth, pj ? pj.height : plateImg.naturalHeight), x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(plateImg, 0, 0, c.width, c.height); /* at plate pixels, whatever the image's size (a 4K plate is twice them) */ rgbOf = { d: x.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }; } catch (e) { console.warn(`platecam: plate colours not read (${e.message}); occlusion edges stay at the geo buffer's steps`); rgbOf = { d: null }; } }
    return rgbOf;
  }
  // the pure test lives in ui/occlude.mjs, shared with the figure workers (characters/runtime/figworker.mjs)
  function occludeDepth(sx, sy, floorY) { const O = occData(); if (!O || !cur) return Infinity; return occludeOf(O, loadRgb(), cur, sx, sy, floorY, OVERHEAD); }
  const api = {
    focus(p) { focusAt = p ? [...p] : null; },
    // macro(at, { zoom, secs }): push in slowly on a world point; macro(null): let go (the follow eases back);
    // macroSettled(): the push-in has arrived (examinecam shows the prop's text then); skip: arrive at once
    macro(at, { zoom = 2.2, secs = 2.4, skip = false } = {}) { macro = at ? { at: [...at], zoom, secs: skip ? 0.001 : secs, t0: performance.now() } : null; },
    macroSettled: () => !macro || macroK() >= 1,
    // the player's velocity for the follow (m/s, world x and z): play.mjs hands it the people layer's
    motion(fn) { motionFn = fn; },
    talking(on) { talking = !!on; },
    frameNow: () => cur,
    framing: () => framing,
    // multiplane (ui/platedata.mjs depthPlanes): masks of the plate's occluders in depth bands, made in the plate
    // worker on first ask for this plate; null until they are (and where there is no worker)
    planes(step = 2) {
      if (!pj || !geo || !area) return null;
      const key = `${area.plate}|${step}`; if (planesKey === key) return planesV;
      if (planesAsk !== key && plateWorker()) { planesAsk = key; const t0 = performance.now(); askPlate({ type: "planes", name: area.plate, pj, overhead: OVERHEAD, step }).then((r) => { if (planesAsk !== key) return; planesKey = key; planesV = r.planes; (globalThis.__lwPlanes ||= {})[key] = { bands: r.planes.length, ms: Math.round(performance.now() - t0), px: r.planes.reduce((a, b) => a + b.tiles.reduce((q, t) => q + t.w * t.h, 0), 0), tiles: r.planes.reduce((a, b) => a + b.tiles.length, 0) }; }).catch((e) => console.warn(`platecam: no planes for ${area.plate} (${e.message})`)); }
      return null;
    },
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
    // (floorY given: for hiding a figure standing there, with hanging things above head height let through)
    depthAt(sx, sy, floorY) { if (occData()) return occludeDepth(sx, sy, floorY); const p = api.pointAt(sx, sy); return p && basis ? depthOf(pj.camera, p, basis) : Infinity; },
    // what depthAt reads, for a figure worker that answers it off this thread: the occlusion data, the
    // plate's colours and the view now (null until the plate's geo is in; depthAt then falls back)
    occlusion() { const O = occData(); if (O && !rgbOf && rgbAsk) return null; return O ? { O, rgb: loadRgb(), view: cur ? { left: cur.left, top: cur.top, zoom: cur.zoom } : null, overhead: OVERHEAD, plate: pj && pj.place } : null; },
    depthOf(p) { return basis ? depthOf(pj.camera, p, basis) : 0; },
    place: () => pj, arena: () => (geo && geo.arena) || null, geo: () => geo, area: () => area, darkness: () => fade,
    onLoad(fn) { loaders.push(fn); if (geo) fn(api); return () => { const i = loaders.indexOf(fn); if (i >= 0) loaders.splice(i, 1); }; },
    ready: () => ready && !!cur,
    // frame-exact tools: hold(true) stops real-time easing; advance(dt) eases by dt on the next frame
    hold(on) { manual = on ? 0 : null; },
    advance(dt) { if (manual != null) manual += dt; },
    element: wrap,
    // the lens layer's element; lensOver(parent, before) moves it (a fight puts it over its fighters,
    // under its paper); lensOver() with no parent puts it back as the last child of the plate box
    lens: lensWrap,
    lensOver(parent = box, before = null) { parent.insertBefore(lensWrap, before); },
    stop() { stopped = true; cancelAnimationFrame(raf); lensWrap.remove(); if (blots) blots.stop(); },
  };
  load(G.world.area());
  raf = requestAnimationFrame(tick);
  api.depthAt.occlusion = api.occlusion;   // the figure workers find the source on the function the layers hand the drawer
  return api;
}
