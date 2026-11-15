// A figure worker (module worker): draws figures off the main thread with the same code the drawer
// runs on it (runtime/figjob.mjs renderJob, runtime/figure-core.mjs finishFigure) and the same brush
// painter (game/engine/paint/install.mjs), answering the occlusion test from the plate's own data
// (ui/occlude.mjs). Each figure always goes to the same worker, so the painter's per-figure stroke
// history stays in one place. Messages (runtime/figpool.mjs sends them):
//   { type: "job", id, fid, job, post }               one figure, one frame -> { type: "done", id, fid, d, ... }
//   { type: "render", id, fid, job, post }            the first half (raster to shaded image) -> { type: "rendered", ... }
//   { type: "expect", id, fid, post }                 (painting worker) a frame to paint when its render arrives, in this order
//   { type: "port-out", to, port } / { type: "port-in", port }   the channel from a render worker to a painting worker
//   renders arrive over the channel as { type: "rendered", ... }; the painting worker answers { type: "done", ... }
import { renderJob } from "./figjob.mjs";
import { finishFigure, postFigure } from "./figure-core.mjs";
import { medianOf } from "./expose.mjs";
import { footprintMask, withLookups } from "./groundshadow.mjs";
// the frame's contact shadow, from the crop of the plate's cells that came with it (groundshadow.mjs)
const shadowOf = (post) => { const S = post.shadow; if (!S) return null; const m = footprintMask(S.fp, withLookups(S.crop), S.W, S.H); m.at = S.fp.at; return m; };
const shadowBufs = (m) => (m && m.mask.length ? [m.mask.buffer] : []);
import { CAST } from "./castmap.mjs";
import { metaOfBuilt } from "./actor.mjs";
import { occludeDepth } from "../../engine/ui/occlude.mjs";

let hour = 23, painter = null;
const ready = (async () => {
  try {
    const { installPainter } = await import("../../engine/paint/install.mjs");
    const ok = await installPainter({ hourOf: () => hour, base: new URL("../", import.meta.url).href, anchor: "bind" });
    painter = ok ? globalThis.__lwPainter : null;
  } catch (e) { console.warn(`figure worker: no painter (${e.message})`); }
})();
const meshes = {}, bufs = new Map();
const meshOf = (who, lod, tool) => meshes[`${who}|${lod}|${tool}`] || (meshes[`${who}|${lod}|${tool}`] = CAST[who].build({ lod, tool }));

async function run(m) {
  await ready;
  const { job, post } = m, b = bufs.get(m.fid) || (bufs.set(m.fid, { r: {}, p: {} }), bufs.get(m.fid));
  hour = post.hour;
  globalThis.__lwPerf = post.perf ? {} : null;
  const t0 = performance.now();
  const r = renderJob(job, meshOf(job.who, job.lod, job.tool), b.r);
  const depthAt = depthFor(post);
  const d = new Uint8ClampedArray(r.w * r.h * 4);
  const Z = finishFigure(r, { ...post, look: new Set(post.look), depthAt, painter: post.paint && painter ? painter : null }, b.p, d);
  const perf = globalThis.__lwPerf; globalThis.__lwPerf = null;
  const ps = Z.paintStats ? { ...Z.paintStats } : null;
  let hidden = 0; if (post.verify) for (let i = 0; i < Z.vis.length; i++) hidden += Z.vis[i] ? 0 : 1;
  const shadow = shadowOf(post);
  postMessage({ type: "done", id: m.id, fid: m.fid, d, hidden, shadow, preHash: Z.preHash, w: r.w, h: r.h, gain: Z.gain, ceil: Z.ceil, paintStats: ps && { ms: ps.ms, px: ps.px }, perf, ms: performance.now() - t0, occluded: !!depthAt }, [d.buffer, ...shadowBufs(shadow)]);
}

// the occlusion test from the crop of the plate's data that came with the job (occlude.mjs cropOcclusion)
const depthFor = (post, crop = post.occ && post.occ.crop) => { const occ = post.occ; return crop && occ && occ.view ? (sx, sy, floorY) => occludeDepth(crop.O, crop.rgb, occ.view, sx, sy, floorY, occ.overhead) : null; };
const bufOf = (fid) => bufs.get(fid) || (bufs.set(fid, { r: {}, p: {} }), bufs.get(fid));
// stage one: the render and the shade; the arrays the painting needs are copied out (the render's own are reused)
async function render(m) {
  await ready;
  const { job, post } = m, b = bufOf(m.fid); globalThis.__lwPerf = post.perf ? {} : null;
  const t0 = performance.now(), r = renderJob(job, meshOf(job.who, job.lod, job.tool), b.r), depthAt = depthFor(post), n = r.w * r.h;
  const d = new Uint8ClampedArray(n * 4), A = finishFigure(r, { ...post, split: true, look: new Set(post.look), depthAt, painter: null }, b.p, d);
  const G = r.G, half = { w: r.w, h: r.h, d, G: { w: G.w, h: G.h, id: G.id.slice(), N: G.N.slice(), loc: G.loc.slice(), wp: G.wp.slice(), curv: G.curv.slice(), cav: G.cav.slice() }, alpha: new Float32Array(n), vis: A.vis.slice(), X: A.X, seatSlack: A.seatSlack, preHash: A.preHash, occluded: !!depthAt, crop: post.occ && post.occ.crop, shadow: shadowOf(post) };
  for (let i = 0; i < n; i++) half.alpha[i] = r.rgba[i * 4 + 3];
  const perf = globalThis.__lwPerf; globalThis.__lwPerf = null;
  // straight to the figure's painting worker over their channel (the main thread only hears that the render is done)
  const msg = { type: "rendered", id: m.id, fid: m.fid, half, perf, ms: performance.now() - t0 }, port = toPaint.get(m.to);
  const cropBufs = half.crop ? [half.crop.O.D.buffer, half.crop.O.up.buffer, ...(half.crop.rgb ? [half.crop.rgb.d.buffer] : [])] : [];
  (port || globalThis).postMessage(msg, [d.buffer, half.G.id.buffer, half.G.N.buffer, half.G.loc.buffer, half.G.wp.buffer, half.G.curv.buffer, half.G.cav.buffer, half.alpha.buffer, half.vis.buffer, ...cropBufs, ...shadowBufs(half.shadow)]);
  postMessage({ type: "ack", id: m.id, fid: m.fid });
}
// the painting side: the main thread says which frames to expect, in order; renders arrive over the channels,
// possibly out of order, and are painted in the order expected
const toPaint = new Map(), expects = new Map(), arrived = new Map();
let chain = Promise.resolve();
function pump(fid) {
  const q = expects.get(fid);
  while (q && q.length && arrived.has(q[0].id)) {
    const e = q.shift(), r = arrived.get(e.id); arrived.delete(e.id);
    chain = chain.then(() => (r.error ? postMessage({ type: "done", id: e.id, fid, error: r.error }) : paint({ id: e.id, fid, half: r.half, post: { ...e.post, perf: e.post.perf || !!r.perf }, renderPerf: r.perf, renderMs: r.ms })))
      .catch((err) => { console.error(`figure worker: ${fid} failed: ${err.stack || err.message}`); postMessage({ type: "done", id: e.id, fid, error: err.message }); });
  }
}
function onRendered(r) { arrived.set(r.id, r); pump(r.fid); }

// A figure in bands (the player's lane, and large figures): each render worker draws its rows; the painting
// worker gathers the bands' exposure samples, answers each with the median, then puts the rows together
// and paints the frame as one. (render side: band, onIrr; painting side: onSamples, onBand)
const pendingBands = new Map();   // render side: id -> the band's render, waiting for the median
async function band(m) {
  await ready;
  const { job, post } = m, t0 = performance.now(), buf = {}, r = renderJob(job, meshOf(job.who, job.lod, job.tool), buf), depthAt = depthFor(post), d = new Uint8ClampedArray(r.w * r.h * 4);
  const { samples } = finishFigure(r, { ...post, split: true, band: job.band, look: new Set(post.look), depthAt, painter: null }, buf, d);
  pendingBands.set(m.id, { m, r, buf, d, depthAt, ms: performance.now() - t0 });
  toPaint.get(m.to).postMessage({ type: "samples", id: m.id, fid: m.fid, k: m.k, K: m.K, w: r.w, h: r.h, samples }, [samples.buffer]);
}
function onIrr(q) {
  const P = pendingBands.get(q.id); if (!P) return; pendingBands.delete(q.id);
  const { m, r, buf, d, depthAt } = P, t0 = performance.now(), [y0, y1] = m.job.band, w = r.w, G = r.G;
  const A = finishFigure(r, { ...m.post, split: true, band: m.job.band, irr: q.irr, look: new Set(m.post.look), depthAt, painter: null }, buf, d);
  const rows = (a, k) => a.slice(y0 * w * k, y1 * w * k), alpha = new Float32Array((y1 - y0) * w);
  for (let i = y0 * w, j = 0; i < y1 * w; i++, j++) alpha[j] = r.rgba[i * 4 + 3];
  const part = { type: "band", id: m.id, fid: m.fid, k: m.k, y0, y1, d: rows(d, 4), vis: rows(A.vis, 1), alpha, id8: rows(G.id, 1), N: rows(G.N, 3), loc: rows(G.loc, 3), wp: rows(G.wp, 3), curv: rows(G.curv, 1), cav: rows(G.cav, 1), X: A.X, seatSlack: A.seatSlack, occluded: !!depthAt, ms: P.ms + performance.now() - t0, shadow: m.k === 0 ? shadowOf(m.post) : null };
  toPaint.get(m.to).postMessage(part, [part.d.buffer, part.vis.buffer, part.alpha.buffer, part.id8.buffer, part.N.buffer, part.loc.buffer, part.wp.buffer, part.curv.buffer, part.cav.buffer, ...shadowBufs(part.shadow)]);
  postMessage({ type: "ack", id: m.id, fid: m.fid, k: m.k });
}
const gathering = new Map();   // painting side: id -> { samples, ports, parts }
function onSamples(q, port) {
  const g = gathering.get(q.id) || (gathering.set(q.id, { samples: [], ports: [], parts: [], got: 0, w: q.w, h: q.h, K: q.K, fid: q.fid }), gathering.get(q.id));
  g.samples[q.k] = q.samples; g.ports[q.k] = port;
  if (g.samples.filter(Boolean).length === g.K) { const irr = medianOf(g.samples); g.ports.forEach((p) => p.postMessage({ type: "irr", id: q.id, irr })); }
}
function onBand(q) {
  const g = gathering.get(q.id); if (!g) return;
  g.parts[q.k] = q; if (++g.got < g.K) return;
  gathering.delete(q.id);
  const { w, h } = g, n = w * h, half = { w, h, d: new Uint8ClampedArray(n * 4), vis: new Uint8Array(n), alpha: new Float32Array(n), G: { w, h, id: new Uint8Array(n), N: new Float32Array(n * 3), loc: new Float32Array(n * 3), wp: new Float32Array(n * 3), curv: new Uint8Array(n).fill(128), cav: new Uint8Array(n) } };
  let ms = 0;
  for (const p of g.parts) {
    const o = p.y0 * w; half.d.set(p.d, o * 4); half.vis.set(p.vis, o); half.alpha.set(p.alpha, o); half.G.id.set(p.id8, o); half.G.N.set(p.N, o * 3); half.G.loc.set(p.loc, o * 3); half.G.wp.set(p.wp, o * 3); half.G.curv.set(p.curv, o); half.G.cav.set(p.cav, o); ms = Math.max(ms, p.ms);
  }
  Object.assign(half, { X: g.parts[0].X, seatSlack: g.parts[0].seatSlack, occluded: g.parts[0].occluded, preHash: null, shadow: g.parts[0].shadow });
  onRendered({ id: q.id, fid: g.fid, half, ms });
}
function onPort(q, port) { if (q.type === "samples") onSamples(q, port); else if (q.type === "band") onBand(q); else onRendered(q); }
// stage two: the painter, the cap, the ink line and the ghost, on the figure's own painting worker
async function paint(m) {
  await ready;
  const { half, post } = m, b = bufOf(m.fid); hour = post.hour; globalThis.__lwPerf = post.perf ? {} : null;
  const t0 = performance.now(), d = half.d, r = { w: half.w, h: half.h, G: half.G, alpha: half.alpha }, depthAt = depthFor(post, half.crop);
  const Z = postFigure(r, { ...post, look: new Set(post.look), depthAt, painter: post.paint && painter ? painter : null }, b.p, d, { X: half.X, vis: half.vis, dbg: null, seatSlack: half.seatSlack });
  const perf = globalThis.__lwPerf, ps = Z.paintStats ? { ...Z.paintStats } : null; globalThis.__lwPerf = null;
  if (perf && m.renderPerf) for (const [k, e] of Object.entries(m.renderPerf)) perf['r.' + k] = e;   // the render stage's timers, carried with the frame
  let hidden = 0; if (post.verify) for (let i = 0; i < half.vis.length; i++) hidden += half.vis[i] ? 0 : 1;
  postMessage({ type: "done", id: m.id, fid: m.fid, d, hidden, shadow: half.shadow, preHash: half.preHash, w: r.w, h: r.h, gain: half.X.gain, ceil: half.X.ceil, paintStats: ps && { ms: ps.ms, px: ps.px }, perf, ms: performance.now() - t0 + (m.renderMs || 0), renderMs: m.renderMs || 0, paintMs: performance.now() - t0, occluded: half.occluded }, [d.buffer, ...shadowBufs(half.shadow)]);
}

onmessage = (e) => {
  const m = e.data;
  if (m.type === "port-out") { toPaint.set(m.to, m.port); m.port.onmessage = (ev) => { if (ev.data.type === "irr") onIrr(ev.data); }; return; }
  if (m.type === "port-in") { m.port.onmessage = (ev) => onPort(ev.data, m.port); return; }
  if (m.type === "meta") { try { postMessage({ type: "meta", id: m.id, meta: metaOfBuilt(meshOf(m.who, "far", m.tool)) }); } catch (err) { postMessage({ type: "meta", id: m.id, error: err.message }); } return; }   // what the drawer's pose solve needs, from a build here (actor.mjs metaOfBuilt)
  if (m.type === "expect") { (expects.get(m.fid) || expects.set(m.fid, []).get(m.fid)).push({ id: m.id, post: m.post }); pump(m.fid); return; }
  if (m.type === "rendered") { onRendered(m); return; }
  const fail = (err) => { console.error(`figure worker: ${m.fid} failed: ${err.stack || err.message}`); postMessage({ type: m.type === "render" ? "ack" : "done", id: m.id, fid: m.fid, error: err.message }); if (m.type === "render") (toPaint.get(m.to) || globalThis).postMessage({ type: "rendered", id: m.id, fid: m.fid, error: err.message }); };
  if (m.type === "render") render(m).catch(fail);
  if (m.type === "band") band(m).catch((err) => { console.error(`figure worker: ${m.fid} band failed: ${err.stack || err.message}`); postMessage({ type: "ack", id: m.id, fid: m.fid, k: m.k, error: err.message }); });
  if (m.type === "paint") paint(m).catch(fail);
  if (m.type === "job") run(m).catch((err) => { console.error(`figure worker: ${m.fid} failed: ${err.stack || err.message}`); postMessage({ type: "done", id: m.id, fid: m.fid, error: err.message }); });
};
