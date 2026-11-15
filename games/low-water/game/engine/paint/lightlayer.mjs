// Light that moves with the night, over the painted plate (design/RENDER-TARGET.md T7, T9):
//   - Lamb's storm lantern carries its own pool: (1 - d/r)^2 within a 4.5 m reach, the last quarter
//     faded out (the reference fades its light planes the same way), turned by the surface's own
//     normal, laid in three painted bands whose edges wander with a world-anchored noise, so the
//     pool's edge belongs to the stones and never crawls;
//   - wet ground mirrors every light: a glossy lobe about the camera's reflected ray on the ground's
//     plane, which draws the long upright streak of a wet street from geometry alone, broken by
//     ripples anchored to the world (the lamps' streaks are baked once per plate and variant; the
//     lantern's each frame);
//   - figures stand in the wet ground too: each is mirrored at its feet, faint and rippled, only
//     where the ground is wet.
// The pool is light added to the painting (screen: it brightens the darks most and never clips); figures' reflections lie over the ground as reflections do (normal blend, faint); glints add
// (plus-lighter). Three canvases between the plate and the weather.
// Original code.
//   const L = lightLayer(ctx, host, cam, { people, before }); L.stop()
import { INDOOR } from "./palette.mjs";
import { wetMask, glossLobe, groundNormals, poolField } from "./lightfield.mjs";

export const LANTERN = { I: 1.6, reach: 4.5, height: 0.75, side: 0.3, colour: [1.0, 0.58, 0.22] };

export function lightLayer(ctx, host, cam, { people = null, before = null } = {}) {
  const G = ctx.G, mk = (blend) => { const c = document.createElement("canvas"); c.className = "paintlight"; c.style.cssText = `position:absolute;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:${blend}`; if (before && before.parentNode === host) host.insertBefore(c, before); else host.append(c); return c; };
  const pool = mk("screen"), mirror = mk("normal"), glint = mk("plus-lighter");
  const S = { drawn: "", mirrorBox: null, plate: null, normals: null, wet: null, glints: null, key: "", raf: 0, stopped: false, poolImg: null, poolKey: "", t: 0 };
  const term = (k) => { try { return G.env.term(k, G.state.place); } catch (e) { return 0; } };
  const variantOf = (pj) => (cam.area() && cam.area().variant) || (pj.variants && pj.variants[0]);
  const lanternAt = () => {
    const p = G.state.pos; if (!p) return null;
    const f = people && people.facing ? people.facing() : 0, rx = -Math.sin(f), rz = Math.cos(f);   // to Lamb's right of the facing
    return [p[0] + rx * LANTERN.side, p[1] + LANTERN.height, p[2] + rz * LANTERN.side];
  };
  // per plate: normals, the wet mask (by footing and weather), the lamps' reflections
  // In the light worker where there is one (paint/lightworker.mjs, the same functions): the fields arrive a
  // few frames after a move, under the ink blot, and until then the layer draws nothing for the new plate.
  // prepare() says whether this plate's fields are ready. ?lightworker=0 (and no Worker) makes them here.
  let LW = null, lwId = 0;
  const lightWorker = () => {
    if (LW !== null) return LW;
    try {
      if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined" || /[?&]lightworker=0(&|$)/.test(location.search)) return (LW = false);
      LW = new Worker(new URL("./lightworker.mjs", import.meta.url), { type: "module" });
      LW.onerror = (e) => { console.warn(`light: worker failed (${e.message}); making the fields here`); LW = false; S.asking = null; };
    } catch (e) { console.warn(`light: no worker (${e.message})`); LW = false; }
    return LW;
  };
  function prepare(pj, geo) {
    const v = variantOf(pj), rain = /rain|wet/.test(v) || (+term("rain") || 0) > 0.1, key = `${pj.place}|${v}|${rain}`;
    if (key === S.key) return true;
    const W = lightWorker(), plate = cam.area() && cam.area().plate;
    if (W && plate) {
      if (S.asking !== key) {
        S.asking = key; const id = ++lwId;
        const on = (e) => {
          if (e.data.id !== id) return; W.removeEventListener("message", on);
          if (S.asking !== key) return; S.asking = null;
          if (e.data.error) { console.warn(`light: fields in the worker failed (${e.data.error}); making them here`); LW = false; return; }
          S.key = key; S.plate = pj; S.normals = Object.assign(e.data.normals, { place: pj.place }); S.wet = e.data.wet; S.glints = e.data.glints;
          let nw = 0, nu = 0; for (let i = 0; i < S.wet.k.length; i++) { if (S.wet.k[i] > 0) nw++; if (S.normals[i * 3 + 1] > 0.85) nu++; }
          Object.assign((globalThis.__lwLightStats ||= {}), { wet: nw, up: nu, samples: S.wet.k.length, glints: !!S.glints });
          S.drawn = ""; S.poolKey = ""; S.prePool = e.data.pool && S.preKey ? { key: S.preKey, img: e.data.pool } : null;
        };
        W.addEventListener("message", on);
        const L0 = lanternAt();   // the lantern where Lamb stands now: its pool made in the worker too, used if Lamb is still there
        W.postMessage({ id, place: plate, pj, rain, lights: (pj.lights && pj.lights[v]) || [], lantern: L0 ? { at: L0, opts: LANTERN } : null });
        S.preKey = L0 ? `${pj.place}|${L0.map((x) => Math.round(x * 50)).join(",")}` : null;
      }
      return false;
    }
    S.key = key; S.plate = pj;
    S.normals = S.normals && S.normals.place === pj.place ? S.normals : Object.assign(groundNormals(pj, geo.pos), { place: pj.place });
    S.wet = wetMask(pj, geo.pos, geo.ids, S.normals, { rain });
    const lights = (pj.lights && pj.lights[v]) || [];
    S.glints = glossLobe(pj, geo.pos, S.normals, S.wet, lights);
    let nw = 0, nu = 0; for (let i = 0; i < S.wet.k.length; i++) { if (S.wet.k[i] > 0) nw++; if (S.normals[i * 3 + 1] > 0.85) nu++; }
    Object.assign((globalThis.__lwLightStats ||= {}), { wet: nw, up: nu, samples: S.wet.k.length, glints: !!S.glints });
    return true;
  }
  function frame(now) {
    if (S.stopped) return;
    S.raf = requestAnimationFrame(frame);
    const r = host.getBoundingClientRect(); let resized = false;
    for (const c of [pool, mirror, glint]) if (c.width !== Math.round(r.width) || c.height !== Math.round(r.height)) { c.width = Math.round(r.width); c.height = Math.round(r.height); resized = true; }
    const gp = pool.getContext("2d"), gg = glint.getContext("2d"), gm = mirror.getContext("2d");
    const pj = cam.place(), geo = cam.geo(), view = cam.frameNow && cam.frameNow();
    if (!cam.ready() || !pj || !geo || !view || globalThis.__lwLightOff) { if (S.drawn) { for (const g of [gp, gg, gm]) g.clearRect(0, 0, pool.width, pool.height); S.drawn = ""; } return; }
    const t0 = performance.now();
    if (!prepare(pj, geo)) { if (S.drawn) { for (const g of [gp, gg, gm]) g.clearRect(0, 0, pool.width, pool.height); S.drawn = ""; } return; }
    const s = 1 / (pj.geoScale || 1), dark = cam.darkness ? cam.darkness() : 0, toView = (g) => g.setTransform(view.zoom * s, 0, 0, view.zoom * s, -view.left * view.zoom, -view.top * view.zoom);
    const L = lanternAt();
    // the lantern lights the ground, not the people, as the reference keeps its player light off its
    // figures: lit by it, a black hat and coat went to grey in the Brine (stills 2026-10-21).
    // globalThis.__lwLanternOnFigures = true lights them too.
    globalThis.__lwCarriedLights = L && globalThis.__lwLanternOnFigures === true ? [{ at: L, kind: "paraffin", I: LANTERN.I, reach: LANTERN.reach, group: "carried" }] : [];
    if (L) { const k = `${pj.place}|${L.map((x) => Math.round(x * 50)).join(",")}`; if (k !== S.poolKey) { S.poolKey = k; S.poolImg = S.prePool && S.prePool.key === k ? S.prePool.img : poolField(pj, geo.pos, S.normals, S.wet, L, LANTERN); S.prePool = null; } }
    else S.poolImg = null;
    // the pool and the glints change only when the view, the lantern or the blackout does: redrawn then only
    const key = `${S.key}|${view.left.toFixed(1)},${view.top.toFixed(1)},${view.zoom.toFixed(3)}|${S.poolKey}|${dark.toFixed(2)}|${resized}`;
    if (key !== S.drawn) {
      S.drawn = key; gp.clearRect(0, 0, pool.width, pool.height); gg.clearRect(0, 0, glint.width, glint.height);
      // the lamps in the wet ground (baked per plate), dimmed as the plate goes to its blackout
      if (S.glints && S.glints.canvas && dark < 1) { gg.save(); gg.globalAlpha = 1 - dark; toView(gg); gg.imageSmoothingEnabled = true; gg.globalCompositeOperation = "lighter"; gg.drawImage(S.glints.canvas, S.glints.x0, S.glints.y0); gg.restore(); }
      if (S.poolImg) {
        // indoors the room's own lamps rule: the lantern adds a little (a full pool washed the Brine's warm wood pale)
        gp.save(); toView(gp); gp.globalAlpha = INDOOR.has(String(pj.place).replace(/_day$/, "")) ? 0.25 : 1; gp.drawImage(S.poolImg.pool, S.poolImg.x0, S.poolImg.y0); gp.restore();
        if (S.poolImg.glint) { gg.save(); toView(gg); gg.globalCompositeOperation = "lighter"; gg.drawImage(S.poolImg.glint, S.poolImg.x0, S.poolImg.y0); gg.restore(); }
      }
    }
    // figures in the wet ground: each mirrored at its feet, through the wet mask, in a box round them
    if (people && people.canvas && S.wet && S.wet.canvas) mirrorFigures(gm, view, s);
    (globalThis.__lwLightStats ||= {}).ms = +(performance.now() - t0).toFixed(2);
  }
  const scratch = document.createElement("canvas");
  function mirrorFigures(gm, view, s) {
    const src = people.canvas; if (!src.width) return;
    if (S.mirrorBox) { const [x, y, w, h] = S.mirrorBox; gm.clearRect(x - 2, y - 2, w + 4, h + 4); S.mirrorBox = null; }
    const boxes = [];
    for (const f of people.figures()) {
      const sc = cam.toScreen(f.at); if (!sc) continue;
      const ppm = cam.scaleAt(f.at), w = 1.6 * ppm, hgt = 2.4 * ppm; boxes.push([sc[0] - w / 2, sc[1] - hgt, w, hgt, sc[1]]);
    }
    if (!boxes.length) return;
    // one box round every mirror image (below each figure's feet)
    const bx0 = Math.max(0, Math.floor(Math.min(...boxes.map((b) => b[0])))), bx1 = Math.min(gm.canvas.width, Math.ceil(Math.max(...boxes.map((b) => b[0] + b[2]))));
    const by0 = Math.max(0, Math.floor(Math.min(...boxes.map((b) => b[4])))), by1 = Math.min(gm.canvas.height, Math.ceil(Math.max(...boxes.map((b) => b[4] + b[3]))));
    const bw = bx1 - bx0, bh = by1 - by0; if (bw <= 0 || bh <= 0) return;
    if (scratch.width !== bw || scratch.height !== bh) { scratch.width = bw; scratch.height = bh; }
    const g = scratch.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, bw, bh);
    // the figure's own pixels above its feet, flipped below them, a little squashed as the plane foreshortens
    for (const [x0, y0, w, hgt, feet] of boxes) { g.save(); g.globalAlpha = 0.34; g.translate(-bx0, feet * 2 - by0); g.scale(1, -1); g.drawImage(src, x0, y0, w, hgt, x0, y0 + hgt * 0.06, w, hgt * 0.94); g.restore(); }
    // kept only on wet ground
    g.save(); g.globalCompositeOperation = "destination-in"; g.setTransform(view.zoom * s, 0, 0, view.zoom * s, -view.left * view.zoom - bx0, -view.top * view.zoom - by0); g.drawImage(S.wet.canvas, 0, 0); g.restore();
    gm.drawImage(scratch, bx0, by0); S.mirrorBox = [bx0, by0, bw, bh];
  }
  S.raf = requestAnimationFrame(frame);
  return { pool, mirror, glint, state: S, stop() { S.stopped = true; globalThis.__lwCarriedLights = []; cancelAnimationFrame(S.raf); pool.remove(); mirror.remove(); glint.remove(); } };
}
