// The plate under the camera (world/camera.mjs): the area's painted plate at the area's scale,
// looking at Lamb, sliding so the speakers sit left of the talk panel while a conversation is
// open, pulling back to the whole plate on camera: wide. Eased each frame in whole plate pixels.
//   const cam = plateCam(box, ctx); cam.focus(worldPoint or null); cam.talking(bool); cam.stop()
import { h } from "./dom.mjs";
import { cameraScale, frame, ease, projectPlate } from "../world/camera.mjs";

const places = new Map(); // plate name -> place.json (or null when missing)
async function placeJson(name) {
  if (places.has(name)) return places.get(name);
  let j = null;
  try { const r = await fetch(`/content/${name}/place.json`); if (r.ok) j = await r.json(); } catch (e) { console.warn(`platecam: no place.json for ${name}: ${e.message}`); }
  places.set(name, j); return j;
}
const plateUrl = (a) => `/content/${a.plate}/${a.variant || "night"}.png`;

export function plateCam(box, ctx) {
  const G = ctx.G, img = h("img.platecam-img", { alt: "", draggable: "false" }), wrap = h("div.platecam", img), card = h("div.placecard.sheet");
  let area = null, pj = null, cur = null, last = performance.now(), raf = 0, talking = false, focusAt = null, ready = false, stopped = false, boundsFn = null;
  box.replaceChildren(card, wrap);
  // where there is no painted plate (hub districts), a card names the place
  const showCard = () => { const p = G.book.places[G.state.place] || {}, d = G.world.district(); card.replaceChildren(h("div.caps", d ? d.name : ""), h("div.pname", (area && area.name) || p.name || G.state.place || "Nowhere yet")); card.hidden = false; };
  async function load(a) {
    area = a; ready = false; cur = null; pj = null;
    wrap.hidden = true; showCard();
    if (!a || !a.plate) return;
    pj = await placeJson(a.plate);
    img.onload = () => { ready = true; wrap.hidden = false; card.hidden = true; };
    img.onerror = () => { wrap.hidden = true; console.warn(`platecam: no plate ${plateUrl(a)}`); };
    img.src = plateUrl(a);
  }
  function target() {
    const W = wrap.clientWidth, H = wrap.clientHeight, pw = pj ? pj.width : img.naturalWidth, ph = pj ? pj.height : img.naturalHeight;
    const lamb = G.state.pos || (area && area.spawn) || null;
    const world = talking && focusAt && lamb ? lamb.map((v, i) => (v + focusAt[i]) / 2) : lamb;
    const focus = world && pj && pj.camera ? projectPlate(pj.camera, pw, ph, world) : null;
    // a fight frames its fighters (world/stage.mjs fightBounds): the game's closeness, pulled back only as needed
    const bounds = boundsFn && pj && pj.camera ? boundsFn((p) => projectPlate(pj.camera, pw, ph, p)) : null;
    return frame({ plateW: pw, plateH: ph, viewW: W, viewH: H, scale: cameraScale(G, area), focus, talking: talking && !bounds, talkX: +G.rs.rules["camera-talk-x"], bounds });
  }
  function tick(now) {
    if (stopped) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (G.world.area() !== area) load(G.world.area());
    if (ready && wrap.clientWidth) {
      const t = target(), calm = document.documentElement.classList.contains("calm");
      cur = calm ? t : ease(cur, t, dt);
      img.style.width = `${(pj ? pj.width : img.naturalWidth) * cur.zoom}px`;
      img.style.transform = `translate(${-cur.left * cur.zoom}px, ${-cur.top * cur.zoom}px)`;
      wrap.dataset.zoom = cur.zoom.toFixed(3); wrap.dataset.left = cur.left; wrap.dataset.top = cur.top;
    }
    raf = requestAnimationFrame(tick);
  }
  load(G.world.area());
  raf = requestAnimationFrame(tick);
  return {
    focus(p) { focusAt = p ? [...p] : null; },
    talking(on) { talking = !!on; },
    frameNow: () => cur,
    // while a fight plays: fn(project) -> plate-pixel bounds to keep in view; null to stop
    frameOn(fn) { boundsFn = fn; },
    // a world point to screen pixels in the plate view (null before the plate is ready)
    toScreen(p) { if (!cur || !pj || !pj.camera) return null; const [px, py] = projectPlate(pj.camera, pj.width, pj.height, p); return [(px - cur.left) * cur.zoom, (py - cur.top) * cur.zoom]; },
    // metres to screen pixels at a world point (for drawing figures at the right size)
    scaleAt(p) { const a = this.toScreen(p), b = this.toScreen([p[0], p[1] + 1, p[2]]); return a && b ? Math.abs(a[1] - b[1]) : 0; },
    ready: () => ready && !!cur,
    element: wrap,
    stop() { stopped = true; cancelAnimationFrame(raf); },
  };
}
