// Poses and clip sampling. A pose is { joint: { channel: degrees or metres } } (rig/skeleton.mjs).
// A clip is a list of keys on a timeline that the timing data lays out:
//   { name, loop, frames }                          a clip with a fixed length (30 fps frames)
//   { name, phases: ["startup", "active", "recovery"] }  lengths come from timing.json per clip
// Keys: { at: [phase, u] | u, pose, ease? }  where u is 0..1 inside the phase (or the whole clip).
// Sampling interpolates every channel with a monotone cubic through the keys, so motion is smooth
// and never overshoots a key (a held guard stays held).
import { mirror } from "../rig/skeleton.mjs";

export const merge = (...ps) => { const o = {}; for (const p of ps) for (const [j, c] of Object.entries(p || {})) o[j] = Array.isArray(c) ? c : { ...(o[j] || {}), ...c }; return o; };
export const add = (a, b) => { const o = merge(a); for (const [j, c] of Object.entries(b || {})) { if (Array.isArray(c)) { o[j] = c; continue; } o[j] = o[j] || {}; for (const [k, v] of Object.entries(c)) o[j][k] = (o[j][k] || 0) + v; } return o; };
export { mirror };

// Frame layout of a clip under a timing record: { length, starts: { phase: [from, len] } }.
// When combat gives a move one span (startup and active 0, all of it recovery), the art's own phase
// proportions (T.art) are scaled to that span so the keys keep their spacing.
export function layout(clip, T = {}) {
  const span = (t) => (t.startup || 0) + (t.active || 0) + (t.recovery || 0);
  if (!clip.phases) { const n = T.frames ?? (span(T) || clip.frames); return { length: n, starts: { all: [0, n] } }; }
  let src = T;
  if (!T.startup && !T.active && T.recovery && T.art && span(T.art)) { const k = T.recovery / span(T.art); src = Object.fromEntries(clip.phases.map((p) => [p, (T.art[p] || 0) * k])); }
  let f = 0; const starts = {};
  for (const ph of clip.phases) { const n = src[ph] ?? clip.defaults?.[ph] ?? 6; starts[ph] = [f, n]; f += n; }
  return { length: f, starts };
}
const keyFrame = (k, L) => { if (Array.isArray(k.at)) { const [ph, u] = k.at, s = L.starts[{ s: "startup", a: "active", r: "recovery" }[ph] || ph]; return s[0] + u * s[1]; } return k.at * L.length; };

// Monotone cubic (Fritsch-Carlson) through (t_i, v_i), evaluated at t.
function mcubic(ts, vs, t, smooth = false) {
  const n = ts.length; if (n === 1 || t <= ts[0]) return vs[0]; if (t >= ts[n - 1]) return vs[n - 1];
  let i = 0; while (t > ts[i + 1]) i++;
  const d = (k) => (vs[k + 1] - vs[k]) / Math.max(1e-6, ts[k + 1] - ts[k]);
  // monotone (Fritsch-Carlson) by default: holds stay held. smooth: non-uniform Catmull-Rom, velocity
  // carried through each key (a strike's momentum through contact; it may overshoot a key slightly)
  const tan = (k) => { if (k === 0) return d(0); if (k === n - 1) return d(n - 2); const a = d(k - 1), b = d(k);
    if (smooth) { const h0 = ts[k] - ts[k - 1], h1 = ts[k + 1] - ts[k]; if (h0 > 0.25 && h1 > 0.25) { const m = (h1 * a + h0 * b) / (h0 + h1), lim = 1.5 * Math.max(Math.abs(a), Math.abs(b)); return Math.max(-lim, Math.min(lim, m)); } }
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b); };
  const h = ts[i + 1] - ts[i], s = (t - ts[i]) / h, m0 = tan(i) * h, m1 = tan(i + 1) * h;
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * vs[i] + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * vs[i + 1] + (s3 - s2) * m1;
}

// Sample a clip at frame f (may be fractional). base fills channels a key leaves out.
export function sample(clip, T, f, base = {}) {
  const L = layout(clip, T), keys = clip.keys.map((k) => ({ t: keyFrame(k, L), pose: merge(base, k.pose) }));
  if (clip.loop) { f = ((f % L.length) + L.length) % L.length; keys.push({ t: L.length, pose: keys[0].pose }); }
  const chans = new Set(); for (const k of keys) for (const [j, c] of Object.entries(k.pose)) if (!Array.isArray(c)) for (const ch of Object.keys(c)) chans.add(j + "." + ch);
  const ts = keys.map((k) => k.t), out = {};
  for (const jc of chans) {
    const [j, ch] = jc.split("."), vs = keys.map((k) => k.pose[j]?.[ch] ?? base[j]?.[ch] ?? 0);
    (out[j] = out[j] || {})[ch] = mcubic(ts, vs, f, !!clip.smooth);
  }
  let shown = keys[0]; for (const k of keys) if (k.t <= f + 1e-6) shown = k;
  for (const k of ["hide", "hands"]) if (shown.pose[k]) out[k] = shown.pose[k];   // stepped, not interpolated
  return out;
}

// What the game needs per frame besides the pose: phase, and the flags combat reads.
export function events(clip, T, f) {
  const L = layout(clip, T); let phase = "all";
  for (const [ph, [s, n]] of Object.entries(L.starts)) if (f >= s && f < s + n) phase = ph;
  const iframes = T.iframes ? f >= T.iframes[0] && f < T.iframes[1] : false;
  const cancel = (T.cancel != null && L.starts.recovery ? f >= L.starts.recovery[0] + T.cancel : false) || (T.free != null && f >= T.free);
  return { phase, length: L.length, iframes, cancel, hit: phase === "active" && !!T.hit, done: !clip.loop && f >= L.length };
}
