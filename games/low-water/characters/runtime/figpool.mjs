// The figure workers, from the main thread (frame scheduler side of the drawer). Each figure is
// assigned to workers for good (its painter history lives in one); the drawer shows the newest
// finished image of each figure every frame, placed at the figure's feet as they are now. The
// job carries the crop of the plate's occlusion data its box reads.
// Two stages (stages: 2, the default where there are cores for it): a figure's render and shade run on
// one worker and its painting on another, so the next frame's render runs while this frame is painted
// (about twice the images a second, one stage more of latency); a figure has two render workers taken in
// turn, so a render longer than a frame does not halve the rate, and their results are painted in the
// order they were sent. stages: 1 runs both halves on one worker.
//   const pool = figPool({ size, stages }) | null      null where module workers are not available
//   pool.busy(fid)  pool.send(fid, job, post, occSource, transfer, meta)  pool.latest(fid)  pool.stats()
// the crop function lives with the occlusion test (game/engine/ui/occlude.mjs, served at /engine/); loaded
// where workers run, and until it is in, the pool takes no jobs (a figure is never drawn unoccluded)
let cropOcclusion = null;
if (typeof Worker !== "undefined") import(new URL("../../engine/ui/occlude.mjs", import.meta.url).href).then((m) => { cropOcclusion = m.cropOcclusion; }).catch((e) => console.warn(`figures: occlusion crop not loaded (${e.message})`));
const CORES = (globalThis.navigator && navigator.hardwareConcurrency) || 4, SPLIT_MS = 25, LANE_TARGET = 90, BUDGET = Math.max(2, Math.floor(CORES / 3));
export function figPool({ splitMs = SPLIT_MS, budget = Infinity, adapt = false, laneTarget = LANE_TARGET, lanes = true, stages = CORES >= 8 ? 2 : 1, size = Math.max(1, Math.min(stages === 2 ? 12 : 4, CORES - 4)), url = new URL("./figworker.mjs", import.meta.url) } = {}) {
  if (typeof Worker === "undefined") return null;
  const workers = [], owner = new Map(), rendering = new Map(), painting = new Map(), meta = new Map(), latest = new Map(), stats = { sent: 0, done: 0, failed: 0, ms: 0, lat: 0, stages };
  let seq = 0, metaId = 0, metaNext = 0; const metaWait = new Map(); globalThis.__lwFigPoolStats = stats;   // read by tools/bench.mjs
  // per figure: frames in flight, the newest image's id and age (for tests and debugging)
  globalThis.__lwFigPoolDebug = () => Object.fromEntries([...owner.keys()].map((fid) => { const L = latest.get(fid), o = owner.get(fid); return [fid, { rendering: rendering.get(fid) || 0, painting: painting.get(fid) || 0, split: !!o.split, image: L ? L.seq : null, behind: L ? seq - L.seq : null, at: L ? Math.round(performance.now() - L.t) : null }]; }));
  const count = (M, fid, d) => { const v = (M.get(fid) || 0) + d; if (v > 0) M.set(fid, v); else M.delete(fid); };
  // the job's crop of the plate's occlusion data (ui/occlude.mjs): only what the figure's box reads, moved with the job
  function occFor(post, occ, box) { if (!(occ && occ.O && occ.view)) return (post.occ = null, []); const crop = cropOcclusion(occ, occ.view, box); post.occ = { crop, view: occ.view, overhead: occ.overhead }; return [crop.O.D.buffer, crop.O.up.buffer, ...(crop.rgb ? [crop.rgb.d.buffer] : [])]; }
  function finished(m) {
    const q = meta.get(m.id); meta.delete(m.id); if (!(q && q.lost)) { count(painting, m.fid, -1); if (stages === 1) count(rendering, m.fid, -1); }
    if (m.error) { stats.failed++; return; }
    stats.done++; stats.ms += m.ms; if (q) stats.lat += performance.now() - q.t0;
    if (q && (owner.get(m.fid) || {}).lane) laneSeen(performance.now() - q.t0);
    { const F = ((stats.byFig ||= {})[m.fid] ||= { n: 0, lat: 0, render: 0, paint: 0, ms: 0 }); F.n++; F.ms += m.ms; F.render += m.renderMs || 0; F.paint += m.paintMs != null ? m.paintMs : m.ms; if (q) F.lat += performance.now() - q.t0; }   // per figure, for the latency measure   // lat: send to finished image, wall time
    const prev = latest.get(m.fid), c = prev && prev.canvas ? prev.canvas : new OffscreenCanvas(m.w, m.h);
    if (c.width !== m.w || c.height !== m.h) { c.width = m.w; c.height = m.h; }
    c.getContext("2d").putImageData(new ImageData(m.d, m.w, m.h), 0, 0);   // once per finished frame, not once per drawn frame
    latest.set(m.fid, { t: performance.now(), sentAt: q ? q.t0 : null, canvas: c, w: m.w, h: m.h, meta: q ? q.meta : null, gain: m.gain, ceil: m.ceil, seq: m.id, paintStats: m.paintStats, perf: m.perf, ms: m.ms, occluded: m.occluded, d: q && q.meta && q.meta.want ? m.d : null, hidden: m.hidden, preHash: m.preHash, shadow: m.shadow || null });
  }
  function make() {
    const w = new Worker(url, { type: "module" }); w.plate = null; w.figs = 0; w.idx = workers.length; w.ports = new Set();
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "done") return finished(m);
      if (m.type === "meta") { const q = metaWait.get(m.id); if (q) { metaWait.delete(m.id); if (m.error) q.no(new Error(m.error)); else q.ok(m.meta); } return; }
      if (m.type === "ack") { const q = meta.get(m.id); if (q && q.lost) return; if (q && q.bands) { if (++q.acks < q.bands) return; } count(rendering, m.fid, -1); return; }   // a render finished; it went straight to the painting worker
      if (m.type === "rendered") { const o = owner.get(m.fid); if (o) o.paint.postMessage(m, m.half ? [m.half.d.buffer, m.half.G.id.buffer, m.half.G.N.buffer, m.half.G.loc.buffer, m.half.G.wp.buffer, m.half.G.curv.buffer, m.half.G.cav.buffer, m.half.alpha.buffer, m.half.vis.buffer] : []); }   // no channel: relayed
    };
    w.onerror = (e) => { console.error(`figure worker failed: ${e.message}`); };
    workers.push(w); return w;
  }
  // an idle worker first, then a new one while under size, then the least loaded; a reserved worker (the
  // player's lane) is never shared
  const least = (not = []) => { const ok = (w) => !w.reserved && !not.includes(w), idle = workers.find((w) => !w.figs && ok(w)); if (idle) return idle; if (workers.filter((w) => !w.reserved).length < size) return make(); const c = workers.filter(ok); return (c.length ? c : workers.filter((w) => !w.reserved)).reduce((a, b) => (a.figs <= b.figs ? a : b)); };
  // the player's lane: workers of its own, made for it beyond size, so its frames never queue behind another figure's
  const own = () => { const w = workers.find((x) => !x.figs && !x.reserved) || make(); w.reserved = true; w.figs++; return w; };
  // a figure's painting worker at once; its two render workers only when it first splits (a slow frame never does)
  function workersFor(fid, lane) {
    let o = owner.get(fid);
    if (!o) { const p = lane ? own() : least(); if (!lane) p.figs++; o = { renders: stages === 1 ? [p] : null, paint: p, next: 0, lane }; owner.set(fid, o); }
    return o;
  }
  function rendersFor(o, k = 2) {
    if (!o.renders) o.renders = [];
    while (o.renders.length < k) { const w = o.lane ? own() : least([o.paint, ...o.renders]); if (o.renders.includes(w)) break; if (!o.lane) w.figs++; o.renders.push(w); }
    return o.renders;
  }
  const portTo = (rw, pw) => { if (!rw.ports.has(pw.idx)) { const ch = new MessageChannel(); rw.postMessage({ type: "port-out", to: pw.idx, port: ch.port1 }, [ch.port1]); pw.postMessage({ type: "port-in", port: ch.port2 }, [ch.port2]); rw.ports.add(pw.idx); } };
  // bands for a frame: the player's figure over three render workers, a large figure (BIG pixels) over two;
  // the same pixels as one render (characters/proto/band_test.mjs), sooner
  const BIG = 120000, bandsFor = (o, job) => (stages !== 2 || job.ss !== 1 ? 1 : o.lane ? 3 : job.w * job.h >= BIG ? 2 : 1);
  // a frame lost (a worker that failed mid-way) frees its figure after LOST ms, and a late answer is still taken
  const LOST = 4000;
  function sweep(fid) { const now = performance.now(); for (const [id, q] of meta) if (q.fid === fid && !q.lost && now - q.t0 > LOST) { q.lost = true; stats.lost = (stats.lost || 0) + 1; count(painting, fid, -1); if (rendering.has(fid)) count(rendering, fid, -1); } }
  // The other figures' share when the CPU is shared (a loaded machine: other apps, a bake). Feedback on
  // what the player sees: when the player's frames take longer than laneTarget ms from pose to image,
  // the other figures together hold one frame in flight fewer, and one more again when the lane is well
  // under it (0.6 of the target), up to no limit. A fixed ?figbudget=N holds it at N. Under a limit the
  // figure whose newest image is oldest goes first, so no figure is starved (a plain cap let the figures
  // drawn first in each frame take every slot).
  const ctl = { cap: budget, lat: null, at: 0, auto: adapt && budget === Infinity };
  function laneSeen(ms) {
    ctl.lat = ctl.lat == null ? ms : ctl.lat * 0.8 + ms * 0.2;
    const now = performance.now(); if (!ctl.auto || now - ctl.at < 400) return; ctl.at = now;
    const inFlight = others();
    if (ctl.lat > laneTarget) ctl.cap = Math.max(1, Math.min(ctl.cap, Math.max(inFlight, 2)) - 1);
    else if (ctl.lat < 0.6 * laneTarget && ctl.cap !== Infinity) ctl.cap = ctl.cap + 1 > size ? Infinity : ctl.cap + 1;
    stats.cap = ctl.cap === Infinity ? null : ctl.cap; stats.laneLat = Math.round(ctl.lat);
  }
  const others = () => { let n = 0; for (const [f, c] of painting) if (!(owner.get(f) || {}).lane) n += c; return n; };
  const asks = new Map();   // figure -> when it last asked to send while limited
  function allowed(fid) {
    if (ctl.cap === Infinity) return true;
    const now = performance.now(), n = others(); asks.set(fid, now);
    if (n >= ctl.cap) return false;
    const age = (f) => { const L = latest.get(f); return L ? L.t : -Infinity; }, mine = age(fid);
    let older = 0; for (const [f, t] of asks) { if (now - t > 150) { asks.delete(f); continue; } if (f !== fid && !painting.has(f) && age(f) < mine) older++; }
    if (older >= ctl.cap - n) return false;
    asks.delete(fid); return true;
  }
  for (let i = 0; i < Math.min(size, 4); i++) make();   // started with the drawer: a module worker takes a while to load the cast and the painter
  return {
    size, stages,
    // a figure takes a new frame while a render worker is free and at most one painting is under way (a
    // deeper queue adds latency, not images)
    // and, under the share above, the other figures together hold at most ctl.cap frames in flight
    busy: (fid) => { if (!cropOcclusion) return true; const o = owner.get(fid);
      if (!(o && o.lane) && !painting.has(fid) && !allowed(fid)) return true; sweep(fid); return o && !o.split ? (painting.get(fid) || 0) >= 1 : (rendering.get(fid) || 0) >= (o && o.banded ? 1 : o && o.renders ? o.renders.length : 1) || (painting.get(fid) || 0) >= 2; },
    latest: (fid) => latest.get(fid) || null,
    // a figure's build summary (actor.mjs metaOfBuilt) from a worker that builds its mesh, which it keeps
    meta(who, tool) { const shared = workers.filter((w) => !w.reserved), w = shared[metaNext++ % shared.length]; return new Promise((ok, no) => { const id = ++metaId; metaWait.set(id, { ok, no }); w.postMessage({ type: "meta", id, who, tool }); }); },
    stats: () => ({ ...stats, workers: workers.length }),
    // occ: the plate camera's occlusion source (ui/platecam.mjs occlusion()), or null; meta comes back with the image
    // frameMs: the frames' interval now. The split pays only while frames come faster than a figure's whole
    // job (on a slow frame the dispatch, not the worker, sets the rate, and the second stage only adds
    // latency); the figure changes mode only with nothing in flight, so its paintings stay in order
    // lane: the player's figure (runtime/fightdrawer.mjs passes it for Lamb), on workers no other figure uses
    send(fid, job, post, occ, transfer = [], m = null, { frameMs = 16.7, lane = false } = {}) {
      const o = workersFor(fid, lane && lanes), id = ++seq;
      if (stages === 2 && !painting.has(fid) && !rendering.has(fid)) o.split = o.lane || frameMs < splitMs;   // the lane always bands: its latency, not the rate, is what it is for
      const cb = occFor(post, occ, [post.ox, post.oy, post.ox + job.w, post.oy + job.h]);
      if (stages === 2 && !o.split) {
        meta.set(id, { meta: m, post, fid, t0: performance.now() }); count(painting, fid, 1); stats.sent++; stats.whole = (stats.whole || 0) + 1;
        o.paint.postMessage({ type: "job", id, fid, job, post }, [...transfer, ...cb]); return id; }   // the whole job on the painting worker
      const K = bandsFor(o, job);
      if (K > 1) {   // the frame in K bands, gathered and painted on the painting worker
        const R = rendersFor(o, K), Kn = Math.min(K, R.length), pw = o.paint, h = job.h, edges = Array.from({ length: Kn + 1 }, (_, k) => Math.round((k * h) / Kn));
        o.banded = true; meta.set(id, { meta: m, post, fid, bands: Kn, acks: 0, t0: performance.now() }); count(rendering, fid, 1); count(painting, fid, 1); stats.sent++; stats.banded = (stats.banded || 0) + 1;
        pw.postMessage({ type: "expect", id, fid, post: { ...post, shadow: null } }, cb);   // the shadow's cells go with band 0   // with the whole figure's crop, for the ink line
        for (let k = 0; k < Kn; k++) {
          const rw = R[k], band = [edges[k], edges[k + 1]], jb = { ...job, band, S: !job.S || k === Kn - 1 ? job.S : { pos: job.S.pos.slice(), nrm: job.S.nrm.slice() } };   // unskinned (skinAt "worker"): each band skins
          const cropB = occ && occ.O && occ.view ? cropOcclusion(occ, occ.view, [post.ox, post.oy + band[0] - 1, post.ox + job.w, post.oy + band[1] + 1]) : null;
          const postB = { ...post, occ: cropB ? { crop: cropB, view: occ.view, overhead: occ.overhead } : null, shadow: k === 0 ? post.shadow : null };
          portTo(rw, pw);
          rw.postMessage({ type: "band", id, fid, job: jb, post: postB, to: pw.idx, k, K: Kn }, [...(jb.S ? [jb.S.pos.buffer, jb.S.nrm.buffer] : []), ...(cropB ? [cropB.O.D.buffer, cropB.O.up.buffer, ...(cropB.rgb ? [cropB.rgb.d.buffer] : [])] : []), ...(k === 0 && post.shadow ? [post.shadow.crop.pos.buffer, post.shadow.crop.valid.buffer] : [])]);
        }
        return id;
      }
      o.banded = false;
      const R = rendersFor(o), rw = R[o.next++ % R.length];
      meta.set(id, { meta: m, post, fid, occ: occ && occ.O ? occ : null, t0: performance.now() }); count(rendering, fid, 1); count(painting, fid, 1); stats.sent++;
      if (stages === 2) {
        const pw = o.paint;
        portTo(rw, pw);
        pw.postMessage({ type: "expect", id, fid, post: { ...post, shadow: null, occ: post.occ && { view: post.occ.view, overhead: post.occ.overhead } } });   // the crop goes with the render
      }
      rw.postMessage({ type: stages === 2 ? "render" : "job", id, fid, job, post, to: o.paint.idx }, [...transfer, ...cb]);
      return id;
    },
  };
}
