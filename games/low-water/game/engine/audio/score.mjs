// The score renderer: a piece is data plus a compose(ctx) function that returns note events; this file
// turns them into stems (stereo pairs), one per layer and per harmonic variant, each with its own
// processing and room. The same code runs in Node (renders, tests) and in a browser worker (the game).
//   piece: { id, bpm, meter, bars, loop, harmonies, stems: { id: { room, send, tape, echo, leslie, hp, lp,
//            gain (dB), harm (true: differs per harmony) } }, compose(ctx) -> [event] }
//   event: { stem, at (beats), dur (beats), inst, p, v, pan, gain (dB), opt, jitter (s) }
import { SR, seedOf, addStereo, biquad, dbToGain, rng } from "./lib/dsp.mjs";
import { voice } from "./voices.mjs";
import { convolve } from "./lib/fft.mjs";
import { makeIR } from "./lib/ir.mjs";
import { tape, echo, leslie, tremolo, autopan, width } from "./lib/fx.mjs";
import { placeSource } from "./place.mjs";
import { soundboardIR, sympathetic } from "./lib/inst/piano.mjs";

let board = null;
const BOARD = () => (board ||= soundboardIR());

const IRS = {};
const irOf = (room) => (IRS[room] ||= makeIR(room));
export const barSec = (piece) => piece.meter * 60 / piece.bpm;
export const lengthSec = (piece) => piece.bars * barSec(piece);
export const variantId = (stem, harm, first) => (harm === first ? stem : `${stem}@${harm}`);

// every event of every harmony, each tagged with the stem id it renders into
export function events(piece, opts = {}) {
  const hs = piece.harmonies || ["true"], out = [];
  for (const h of hs) {
    const evs = piece.compose({ harm: h, seed: opts.seed ?? 1, ...opts });
    for (const e of evs) {
      const st = piece.stems[e.stem];
      if (!st) throw new Error(`${piece.id}: event on unknown stem ${e.stem}`);
      if (!st.harm && h !== hs[0]) continue;
      out.push({ ...e, id: st.harm ? variantId(e.stem, h, hs[0]) : e.stem });
    }
  }
  return out;
}

// a placed event (e.place, see place.mjs) is filtered for distance and split: the dry part into its stem,
// the wet part into the stem's wet bus (`id~wet`), which goes all to the room
function place(L, R, e, piece, k, seed, wet, n) {
  const beat = 60 / piece.bpm, r = rng(seedOf(piece.id, e.id, k, seed));
  let buf = voice({ inst: e.inst, p: e.p, dur: (e.dur ?? 1) * beat, v: e.v ?? 0.6, seed: seedOf(piece.id, e.id, k, e.p ?? 0, seed), opt: e.opt });
  if (e.xfade) (Array.isArray(buf) ? buf : [buf]).forEach((c) => edges(c, e.xfade));
  let at = Math.round(((e.at * beat) + (e.jitter ? r.gauss() * e.jitter : 0)) * SR);
  if (piece.loop && at < 0) at += n;                           // a note pushed before the loop's start belongs at its end
  let g = dbToGain(e.gain ?? 0), pan = e.pan ?? 0, share = 1;
  if (e.place) {
    const P = placeSource(e.place);
    if (P.lowpass < 17000) buf = Array.isArray(buf) ? buf.map((c) => biquad("lp", P.lowpass, 0.6).run(Float32Array.from(c))) : biquad("lp", P.lowpass, 0.6).run(Float32Array.from(buf));
    g *= P.gain; pan = P.pan; share = wet ? P.wet : 1 - P.wet * 0.6;
    addStereo(L, R, buf, at + Math.round(P.delay * SR), g * share, pan);
    return;
  }
  if (!wet) addStereo(L, R, buf, at, g, pan);
}

// equal-power edges for a looped bed: its folded tail fades out exactly as its head fades in
function edges(buf, x) {
  const k = Math.min(Math.round(x * SR), buf.length >> 1);
  for (let i = 0; i < k; i++) { buf[i] *= Math.sin(Math.PI / 2 * i / k); buf[buf.length - 1 - i] *= Math.sin(Math.PI / 2 * i / k); }
}

function treat(pair, st, seed) {
  let [L, R] = pair;
  if (st.leslie) { const mono = new Float32Array(L.length); for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) * 0.5; [L, R] = leslie(mono, st.leslie); }
  for (const [type, key] of [["hp", "hp"], ["lp", "lp"]]) if (st[key]) { biquad(type, st[key], 0.7).run(L); biquad(type, st[key], 0.7).run(R); }
  if (st.trem) tremolo([L, R], st.trem[0], st.trem[1], st.trem[2] || 0);
  if (st.autopan) [L, R] = autopan([L, R], st.autopan[0], st.autopan[1]);
  if (st.tape) [L, R] = tape([L, R], st.tape, seed);
  if (st.echo) [L, R] = echo([L, R], st.echo);
  if (st.room && st.send) {
    const [iL, iR] = irOf(st.room), wL = convolve(L, iL), wR = convolve(R, iR), dry = st.dry ?? 1;
    const n = L.length, oL = new Float32Array(n), oR = new Float32Array(n);
    for (let i = 0; i < n; i++) { oL[i] = L[i] * dry + wL[i] * st.send; oR[i] = R[i] * dry + wR[i] * st.send; }
    [L, R] = [oL, oR];
  }
  if (st.board) [L, R] = [L, R].map((c) => convolve(c, BOARD()).subarray(0, c.length));
  if (st.sympathetic) { const mono = new Float32Array(L.length); for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) * 0.5; const s = sympathetic(mono, st.sympathetic); for (let i = 0; i < L.length; i++) { L[i] += s[i]; R[i] += s[i]; } }
  if (st.width != null) width([L, R], st.width);
  const g = dbToGain(st.gain ?? 0);
  for (let i = 0; i < L.length; i++) { L[i] *= g; R[i] *= g; }
  return [L, R];
}

// a loop folds its tail back onto its head, so the reverb of the last bar sounds under the first
function finish(pair, n, loop) {
  if (!loop) return pair;
  return pair.map((c) => { const o = c.slice(0, n); for (let i = n; i < c.length; i++) o[(i - n) % n] += c[i]; return o; });
}

// render: { stems: { id: [L, R] }, n (samples of the form), barSec, ids }
export function render(piece, opts = {}) {
  const seed = opts.seed ?? 1, n = Math.round(lengthSec(piece) * SR), tail = Math.round((opts.tail ?? 8) * SR);
  const evs = events(piece, opts), stems = {};
  const ids = [...new Set(evs.flatMap((e) => (e.place ? [e.id, `${e.id}~wet`] : [e.id])))];
  if (opts.only) ids.splice(0, ids.length, ...ids.filter((id) => opts.only.includes(id.split(/[@~]/)[0])));
  for (const id of ids) {
    const [base, wet] = id.split("~"), L = new Float32Array(n + tail), R = new Float32Array(n + tail);
    evs.forEach((e, k) => { if (e.id === base && (!wet || e.place)) place(L, R, e, piece, k, seed, !!wet, n); });
    const st0 = piece.stems[base.split("@")[0]], st = wet ? { ...st0, send: 1, dry: 0 } : st0;
    stems[id] = finish(treat([L, R], st, seedOf(piece.id, id, seed)), n, piece.loop);
  }
  return { stems, n, barSec: barSec(piece), ids };
}
