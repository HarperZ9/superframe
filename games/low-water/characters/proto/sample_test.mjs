// Clip sampling with the prepared keys kept (anim/pose.mjs sample) against sampling from scratch every call
// (the earlier code, kept here): every clip, every character's timing, frames across and past the clip, the
// same pose to the last bit, the same key order, and a fresh object each call. A control changes one key.
//   node characters/proto/sample_test.mjs        (exits non-zero on any difference)
import { readFile } from "node:fs/promises";
const { CLIPS, makeLibrary } = await import("../anim/library.mjs");
const { sample, layout, merge } = await import("../anim/pose.mjs");
const timing = JSON.parse(await readFile(new URL("../anim/timing.json", import.meta.url), "utf8"));
let fails = 0; const expect = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails++; };
// the earlier sample, verbatim but for the helpers it imports
const keyFrame = (k, L) => { if (Array.isArray(k.at)) { const [ph, u] = k.at, s = L.starts[{ s: "startup", w: "sweep", a: "active", r: "recovery" }[ph] || ph]; return s[0] + u * s[1]; } return k.at * L.length; };
function mcubic(ts, vs, t, smooth = false) {
  const n = ts.length; if (n === 1 || t <= ts[0]) return vs[0]; if (t >= ts[n - 1]) return vs[n - 1];
  let i = 0; while (t > ts[i + 1]) i++;
  const d = (k) => (vs[k + 1] - vs[k]) / Math.max(1e-6, ts[k + 1] - ts[k]);
  const tan = (k) => { if (k === 0) return d(0); if (k === n - 1) return d(n - 2); const a = d(k - 1), b = d(k);
    if (smooth) { const h0 = ts[k] - ts[k - 1], h1 = ts[k + 1] - ts[k]; if (h0 > 0.25 && h1 > 0.25) { const m = (h1 * a + h0 * b) / (h0 + h1), lim = 1.5 * Math.max(Math.abs(a), Math.abs(b)); return Math.max(-lim, Math.min(lim, m)); } }
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b); };
  const h = ts[i + 1] - ts[i], s = (t - ts[i]) / h, m0 = tan(i) * h, m1 = tan(i + 1) * h;
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * vs[i] + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * vs[i + 1] + (s3 - s2) * m1;
}
function sampleOld(clip, T, f, base = {}) {
  const L = layout(clip, T), keys = clip.keys.map((k) => ({ t: keyFrame(k, L), pose: merge(base, k.pose) }));
  if (clip.loop) { f = ((f % L.length) + L.length) % L.length; keys.push({ t: L.length, pose: keys[0].pose }); }
  const chans = new Set(); for (const k of keys) for (const [j, c] of Object.entries(k.pose)) if (!Array.isArray(c)) for (const ch of Object.keys(c)) chans.add(j + "." + ch);
  const ts = keys.map((k) => k.t), out = {};
  for (const jc of chans) { const [j, ch] = jc.split("."), vs = keys.map((k) => k.pose[j]?.[ch] ?? base[j]?.[ch] ?? 0); (out[j] = out[j] || {})[ch] = mcubic(ts, vs, f, !!clip.smooth); }
  let shown = keys[0]; for (const k of keys) if (k.t <= f + 1e-6) shown = k;
  for (const k of ["hide", "hands"]) if (shown.pose[k]) out[k] = shown.pose[k];
  return out;
}
const lib = makeLibrary(timing, {}, null, {}), whos = ["lamb", "warden", "fewell", "strand", "salvor"];
let n = 0, bad = 0, shared = 0;
for (const name of Object.keys(CLIPS)) for (const who of whos) {
  const c = CLIPS[name], T = lib.timing(who, name), len = layout(c, T).length;
  for (let q = -3; q <= 64; q++) { const f = (q / 50) * len * 1.2 + (q % 3) * 0.37; const a = sample(c, T, f), b = sampleOld(c, T, f), a2 = sample(c, T, f); n++;
    if (JSON.stringify(a) !== JSON.stringify(b) || Object.keys(a).join() !== Object.keys(b).join()) bad++;
    if (a === a2 || Object.keys(a).some((j) => a[j] && typeof a[j] === "object" && !Array.isArray(a[j]) && a[j] === a2[j])) shared++; }
}
expect(bad === 0, `${n} samples over ${Object.keys(CLIPS).length} clips and ${whos.length} timings: ${bad} differ from sampling from scratch`);
expect(shared === 0, `every call returns its own objects (${shared} shared)`);
{ const c = CLIPS.walk, T = lib.timing("lamb", "walk"); const before = JSON.stringify(sample(c, T, 7.3)); const c2 = { ...c, keys: c.keys.map((k) => ({ ...k, pose: merge(k.pose, { chest: { bend: 33.3 } }) })) };
  expect(JSON.stringify(sample(c2, T, 7.3)) !== before, "control: a changed key changes the pose (a new clip object is prepared anew)"); }
if (fails) { console.log(`${fails} failed`); process.exit(1); }
