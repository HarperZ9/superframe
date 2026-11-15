// The light model in the game: one service both styles ask, globalThis.__lwLightModel. It builds a place's
// light (steps.mjs, in bands inside idle callbacks) when the plate changes, from the community model's street
// state (G.community.stock) and the game clock, and rebuilds when a street's stock moves. Nothing is drawn
// here: the painter, the glyph renderer and the figure drawer read it (design/state/light.md has the interface).
// Per frame it does nothing unless asked. Built for the Quota's plates; ?lightmodel=all for every plate, ?lightmodel=0 leaves it out.
//   const L = installLightModel(ctx, cam); L.stop()
//   __lwLightModel.ready()              is the current place's light built
//   __lwLightModel.scene                { M, F, owners, entry } (scene.mjs)
//   __lwLightModel.gains(t)             per light gains at t seconds (flicker, decay, the crowd, windows by the hour)
//   __lwLightModel.compose(t)           the field's E for the clock now (full plate: a style that needs it per frame
//                                       asks for the lights that changed instead; see design/art/LIGHT.md section 7)
//   __lwLightModel.rig(at, t, cam)      a figure's rig (figure.mjs), for the drawer and the portrait painter
//   __lwLightModel.stats                build and call timings
import { buildSteps, runSteps } from "./steps.mjs";
import { figureRig } from "./figure.mjs";
import { lightIndex } from "./decay.mjs";
import { LIGHT_PLACES, lightPlace } from "./places.mjs";

export function installLightModel(ctx, cam) {
  const G = () => ctx.G, S = { key: "", scene: null, pending: false, stopped: false, timer: 0, stats: { builds: 0, buildMs: 0, rigCalls: 0, rigMs: 0 } };
  const read = () => { const c = G() && G().community; return c && c.stock ? (n, s) => c.stock(n, s) : null; };
  const hour = () => { try { return (G().clock() / 60) % 24; } catch { return null; } };
  // the street state the light was built from: rebuilt when any street's light index moves by a twentieth
  const stateKey = (entry) => { const r = read(); if (!r || !entry) return ""; const st = new Set([entry.street, ...["square", "mill", "haldane_yard"]]); return [...st].filter(Boolean).map((s) => Math.round(lightIndex(r, s) * 20)).join(","); };
  // built in bands inside idle callbacks (steps.mjs), each slice held to the idle deadline, so no frame waits on it
  function build(pj, geo, variant, key) {
    S.pending = true; const job = buildSteps({ pj, geo, variant, read: read(), hour: hour() }); let spent = 0, slices = 0, longest = 0;
    const slice = (dl) => {
      if (S.stopped) return; const t0 = performance.now(), budget = dl && dl.timeRemaining && !dl.didTimeout ? Math.max(2, Math.min(8, dl.timeRemaining() - 1)) : 5;   // a busy page never idles: then 5 ms a turn
      let done = null; try { done = runSteps(job, budget); } catch (e) { console.warn(`light model: ${pj.place}: ${e.message}`); S.scene = null; S.key = key; S.pending = false; return; }
      const dt = performance.now() - t0; spent += dt; slices++; longest = Math.max(longest, dt);
      if (!done) { next(slice); return; }
      S.scene = done; S.key = key; S.pending = false; S.stats.builds++; Object.assign(S.stats, { buildMs: +spent.toFixed(1), slices, longestSliceMs: +longest.toFixed(1) });
    };
    const next = (f) => (globalThis.requestIdleCallback ? requestIdleCallback(f, { timeout: 40 }) : setTimeout(f, 0));
    next(slice);
  }
  function check() {
    if (S.stopped) return; S.timer = setTimeout(check, 500);
    const pj = cam.place && cam.place(), geo = cam.geo && cam.geo(); if (!pj || !geo || S.pending) return;
    // the Quota's plates (places.mjs); other plates only with ?lightmodel=all (a large plate's bake is seconds on the main thread)
    if (!LIGHT_PLACES[pj.place] && !(ctx.q && ctx.q.get("lightmodel") === "all")) { S.scene = null; S.key = ""; return; }
    const variant = (cam.area && cam.area() && cam.area().variant) || (pj.variants && pj.variants[0]);
    const key = `${pj.place}|${variant}|${stateKey(lightPlace(pj))}`;
    if (key !== S.key) build(pj, geo, variant, key);
    else if (S.scene) { const h = hour(); if (h != null && Math.abs(h - S.scene.M.hour) > 1 / 60) S.scene.M.setHour(h); }
  }
  const api = {
    ready: () => !!S.scene && !S.pending, get scene() { return S.scene; }, stats: S.stats, get pending() { return S.pending; }, get key() { return S.key; },
    gains: (t = performance.now() / 1000) => (S.scene ? S.scene.M.gains(t) : null),
    compose: (t = performance.now() / 1000) => (S.scene ? S.scene.compose({ t }) : null),
    rig(at, t = performance.now() / 1000, c = null) {
      if (!S.scene) return null; const t0 = performance.now();
      const r = figureRig({ M: S.scene.M, at, t, F: S.scene.F, cam: c || S.scene.M.place.camera });
      S.stats.rigCalls++; S.stats.rigMs += performance.now() - t0; return r;
    },
  };
  globalThis.__lwLightModel = api; check();
  return { api, stop() { S.stopped = true; clearTimeout(S.timer); if (globalThis.__lwLightModel === api) globalThis.__lwLightModel = null; } };
}
