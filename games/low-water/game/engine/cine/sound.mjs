// A film's sound: its cue (audio/pieces/<id>.mjs) rendered stem by stem in the score's own workers
// (audio/web/worker.mjs), several at once, the stems first heard rendered first, and each started at the film's
// clock when it arrives, so a slow stem joins late rather than holding the picture. A whole cue takes about 50 s
// of CPU on one thread (2026-10-22, the opening); stems in parallel arrive in about the time of the slowest one.
//   const S = filmSound("opening"); S.start(); S.stop(); S.stats
//   The AudioContext may start suspended (no gesture yet); the first key or click resumes it.
import { ALL } from "../audio/pieces/index.mjs";

const lin = (db) => Math.pow(10, db / 20);
export function stemOrder(piece) {
  const first = {};
  for (const e of piece.compose({ harm: (piece.harmonies || ["true"])[0], seed: 1 })) first[e.stem] = Math.min(first[e.stem] ?? Infinity, e.at);
  return Object.keys(piece.stems).sort((a, b) => (first[a] ?? Infinity) - (first[b] ?? Infinity));
}

export function filmSound(id, { workers = Math.max(2, Math.min(6, (globalThis.navigator && navigator.hardwareConcurrency) || 4)), master = -6 } = {}) {
  const piece = ALL[id], stats = { arrived: [], failed: [], ms: {} };
  let ac = null, out = null, t0 = null; const live = [], bufs = {};
  try { const AC = globalThis.AudioContext || globalThis.webkitAudioContext; ac = new AC(); out = ac.createGain(); out.gain.value = lin(master); out.connect(ac.destination); }
  catch (e) { console.warn(`film sound: no audio (${e.message})`); return { start() {}, stop() {}, stats }; }
  const resume = () => { if (ac.state === "suspended") ac.resume().catch(() => {}); };
  addEventListener("keydown", resume, true); addEventListener("pointerdown", resume, true);
  const play = (sid) => {
    const b = bufs[sid]; if (!b || t0 === null) return;
    const off = ac.currentTime - t0; if (off >= b.duration) return;
    const src = ac.createBufferSource(); src.buffer = b; src.connect(out); src.start(ac.currentTime + 0.02, Math.max(0, off + 0.02)); live.push(src);
  };
  const queue = stemOrder(piece), pool = [];
  const next = (w) => {
    const sid = queue.shift(); if (!sid) { w.terminate(); return; }
    const t = performance.now();
    w.onmessage = (m) => {
      if (m.data.error) { stats.failed.push(sid); console.warn(`film sound: ${sid}: ${m.data.error}`); }
      else for (const [k, [L, R]] of Object.entries(m.data.stems)) { const b = ac.createBuffer(2, L.length, m.data.sr); b.copyToChannel(L, 0); b.copyToChannel(R, 1); bufs[k] = b; stats.arrived.push(k); stats.ms[k] = Math.round(performance.now() - t); play(k); }
      next(w);
    };
    w.postMessage({ id, opts: { only: [sid] }, seed: 1 });   // the worker renders ALL[id], this stem only
  };
  for (let k = 0; k < workers; k++) { try { const w = new Worker(new URL("../audio/web/worker.mjs", import.meta.url), { type: "module" }); pool.push(w); next(w); } catch (e) { console.warn(`film sound: no worker (${e.message})`); break; } }
  return {
    stats,
    start() { resume(); t0 = ac.currentTime; for (const k of Object.keys(bufs)) play(k); },
    stop() { for (const s of live) { try { s.stop(); } catch { /* already stopped */ } } live.length = 0; queue.length = 0; for (const w of pool) w.terminate(); removeEventListener("keydown", resume, true); removeEventListener("pointerdown", resume, true); ac.close().catch(() => {}); },
  };
}
