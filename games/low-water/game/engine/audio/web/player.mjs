// The score in the browser: Web Audio nodes driven by the runtime mixer. One cue plays at a time; its stems
// are rendered in a worker (worker.mjs), started together, and each runs through its own gain into a group
// gain (music or amb, where the ducks act) into the master. The mixer's ramps are copied onto the gains, so
// what plays is what the offline renders and the tests check.
//   const S = createScore(new AudioContext());
//   await S.cue("dawn", state)       start a cue (bar-aligned crossfade from the one playing)
//   S.update(state)                   the community model, the lens and the record, every few hundred ms
//   S.line(line, start, end)          a voice line, in the context's clock, for ducking
import { ALL } from "../pieces/index.mjs";
import { createMixer } from "../mixer.mjs";
import { duckFor } from "../duck.mjs";

const lin = (db) => (db == null ? 0 : Math.pow(10, db / 20));

function copyRamp(param, s) {
  param.cancelScheduledValues(s.t0);
  param.setValueAtTime(s.g0, s.t0);
  if (s.curve === "lin" || !s.curve) { param.linearRampToValueAtTime(s.g1, s.t1); return; }
  const k = 32, curve = new Float32Array(k);
  for (let i = 0; i < k; i++) { const u = i / (k - 1); curve[i] = s.curve === "in" ? s.g0 + (s.g1 - s.g0) * Math.sin(u * Math.PI / 2) : s.g1 + (s.g0 - s.g1) * Math.cos(u * Math.PI / 2); }
  param.setValueCurveAtTime(curve, s.t0, Math.max(0.01, s.t1 - s.t0));
}

function renderIn(worker, id, opts) {
  return new Promise((resolve, reject) => {
    const on = (m) => { if (m.data.id !== id) return; worker.removeEventListener("message", on); m.data.error ? reject(new Error(m.data.error)) : resolve(m.data); };
    worker.addEventListener("message", on);
    worker.postMessage({ id, opts });
  });
}

async function build(ctx, worker, cache, out, id, opts) {
  const key = id + JSON.stringify(opts || {});
  const data = cache[key] || (cache[key] = await renderIn(worker, id, opts || {}));
  const piece = ALL[id], groups = { music: ctx.createGain(), amb: ctx.createGain() }, nodes = {};
  for (const g of Object.values(groups)) g.connect(out);
  for (const [sid, [L, R]] of Object.entries(data.stems)) {
    const buf = ctx.createBuffer(2, L.length, data.sr); buf.copyToChannel(L, 0); buf.copyToChannel(R, 1);
    const src = ctx.createBufferSource(), gain = ctx.createGain();
    src.buffer = buf; src.loop = !!piece.loop; if (piece.loop) { src.loopStart = 0; src.loopEnd = data.n / data.sr; }
    gain.gain.value = 0; src.connect(gain);
    gain.connect(groups[(piece.stems[sid.split(/[@~]/)[0]] || {}).group || "music"]);
    nodes[sid] = { src, gain };
  }
  return { id, piece, data, groups, nodes, targets: {} };
}

function wire(c, origin) {
  c.mixer = createMixer({ bpm: c.piece.bpm, meter: c.piece.meter, origin });
  const hs = c.piece.harmonies || ["true"];
  for (const sid of Object.keys(c.nodes)) if (!sid.includes("~")) c.mixer.layer(sid, { db: null, group: (c.piece.stems[sid.split("@")[0]] || {}).group });
  for (const [base, st] of Object.entries(c.piece.stems)) if (st.harm) c.mixer.variants(base, Object.fromEntries(hs.map((h, i) => [h, i ? `${base}@${h}` : base])));
}
function apply(c, ramps) {
  for (const r of ramps) for (const [sid, nd] of Object.entries(c.nodes)) if (sid === r.id || sid === `${r.id}~wet`) copyRamp(nd.gain.gain, r);
}


export function createScore(ctx, { workerUrl = new URL("./worker.mjs", import.meta.url), master = -6 } = {}) {
  const worker = new Worker(workerUrl, { type: "module" }), out = ctx.createGain();
  out.gain.value = lin(master); out.connect(ctx.destination);
  const cache = {};
  let cur = null;

  return {
    get current() { return cur && cur.id; },
    async cue(id, state = {}, opts = null) {
      const next = await build(ctx, worker, cache, out, id, opts || (id === "coda" ? { missing: state.bowlsMissing } : { cls: state.cls }));
      const now = ctx.currentTime, start = cur ? cur.mixer.nextBar(now) : now + 0.1;
      if (cur) { const old = cur; for (const nd of Object.values(old.nodes)) { nd.gain.gain.setTargetAtTime(0, start, 0.4); nd.src.stop(start + 4); } }
      wire(next, start);
      for (const nd of Object.values(next.nodes)) nd.src.start(start);
      cur = next; this.update(state, start - next.mixer.barSec * 0.5, true);   // asked half a bar early: lands on the start
    },
    update(state, now = ctx.currentTime, first = false) {
      if (!cur) return;
      if (state.harm && state.harm !== cur.mixer.harm) apply(cur, cur.mixer.harmony(state.harm, now));
      const t = cur.piece.adapt ? cur.piece.adapt(state) : {};
      for (const [sid, db] of Object.entries(t)) {
        if (!first && cur.targets[sid] === db) continue;
        cur.targets[sid] = db; apply(cur, cur.mixer.set(sid, db, now, first ? 0.25 : 1));
      }
    },
    line(line, start, end) {
      if (!cur) return;
      const k = duckFor(line);
      for (const [g, depth] of [["music", k.music], ["amb", k.amb]]) {
        const p = cur.groups[g].gain, s = start - k.ahead, floor = depth === -Infinity ? 0 : lin(depth);
        p.setValueAtTime(p.value, s); p.linearRampToValueAtTime(floor, s + k.attack);
        p.setValueAtTime(floor, end); p.linearRampToValueAtTime(1, end + Math.max(0.01, k.release));
      }
    },
    stop(at = ctx.currentTime) { if (cur) for (const nd of Object.values(cur.nodes)) nd.src.stop(at + 0.05); cur = null; },
  };
}
