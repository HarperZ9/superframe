// Performance direction for spoken lines (design/VOICE-BIBLE.md section 5, DIRECTION/1).
// One set of tags drives three consumers: a human recording session (the script export), the
// synthesis renderer (tools/voice/), and the talking portrait (portraitCue below).
//
//   line: KEEL: [cold 2 slow] The Board is gratified. <beat> The Board is *very* gratified.
//   voice: undertow: [whisper 1] Ask yourself what he rehearsed. {dc: 6}
//   nar: [dry] Item: one harbourmaster, wet.
//   dir: KEEL: stern 1 slow          (node default for that speaker, until the node ends)
//   opt: "Nothing. It was dark." -> quay.keel.nothing {dir: flat 1 fast}
//
// The block sits right after "NAME: " (or at the start of a nar). Inline cues sit in the text.
//   parseDirection(src)   -> { dir, errors }      src is the inside of [ ... ] or a dir: value
//   splitDirected(text)   -> { text, dir, cues, spoken, errors }   text is what the screen shows
//   portraitCue(dir, base) -> expression sliders for characters/forge/headshapes.mjs
//   renderParams(dir)     -> deltas the synthesis renderer applies (semitones, range, rate, ...)

export const EMOTIONS = {
  // name: [valence -1..1, arousal 0..1]; the renderer and the portrait read the same two numbers
  flat: [0, 0.1], calm: [0.1, 0.15], dry: [0, 0.2], warm: [0.6, 0.3], tender: [0.5, 0.2],
  wry: [0.2, 0.35], amused: [0.6, 0.5], ecstatic: [0.8, 0.9], proud: [0.3, 0.45],
  cold: [-0.3, 0.2], stern: [-0.4, 0.45], angry: [-0.7, 0.85], contempt: [-0.6, 0.4],
  afraid: [-0.6, 0.75], anxious: [-0.4, 0.6], pleading: [-0.3, 0.65],
  grieving: [-0.8, 0.25], tired: [-0.3, 0.05], ashamed: [-0.6, 0.3], drunk: [0.1, 0.4],
};
export const DELIVERY = ["whisper", "low", "raised", "shout", "sung"];
export const PACES = { slow: 0.82, steady: 1, fast: 1.18 };
export const FLAGS = ["lie", "aside", "over", "cut", "held"];   // held: a line said through tears or a clamped jaw
export const CUES = { breath: 0.35, beat: 0.4, pause: 0.9, laugh: 0.6, sigh: 0.7, swallow: 0.35, cut: 0, drip: 0.3 };

const NUM = /^-?\d+(\.\d+)?$/;

// "cold 2 slow lie" or "emo: cold, int: 2, pace: 0.9" (both spellings mean the same)
export function parseDirection(src) {
  const dir = {}, errors = [], toks = String(src).split(/[\s,]+/).filter(Boolean);
  const set = (k, v, t) => { if (dir[k] != null && dir[k] !== v) errors.push(`two ${k} values (${dir[k]}, ${t})`); dir[k] = v; };
  for (let i = 0; i < toks.length; i++) {
    let t = toks[i].toLowerCase();
    if (t.endsWith(":")) { const k = t.slice(0, -1), v = (toks[++i] || "").toLowerCase(); t = `${k}:${v}`; }
    const [k, v] = t.includes(":") ? t.split(":") : [null, t];
    if (k === "emo" || (!k && v in EMOTIONS)) { if (!(v in EMOTIONS)) errors.push(`unknown emotion "${v}"`); else set("emo", v, v); }
    else if (k === "int" || (!k && /^[123]$/.test(v))) { if (!/^[123]$/.test(v)) errors.push(`intensity "${v}" is not 1, 2 or 3`); else set("int", +v, v); }
    else if (k === "pace") { if (v in PACES) set("pace", PACES[v], v); else if (NUM.test(v) && +v >= 0.5 && +v <= 1.6) set("pace", +v, v); else errors.push(`pace "${v}" is not slow, steady, fast or 0.5 to 1.6`); }
    else if (!k && v in PACES) set("pace", PACES[v], v);
    else if (k === "vol" || (!k && DELIVERY.includes(v))) { if (!DELIVERY.includes(v)) errors.push(`unknown delivery "${v}"`); else set("vol", v, v); }
    else if (!k && FLAGS.includes(v)) dir[v] = true;
    else errors.push(`unknown direction "${toks[i]}"`);
  }
  return { dir, errors };
}

// Pull the [direction] block and the <cues> out of a spoken text. `spoken` is the text as segments
// for the renderer: [{ say }, { cue, s }], with *stress* kept as { say, stress: [words] }.
export function splitDirected(raw) {
  let text = String(raw), dir = {}, errors = [];
  const m = text.match(/^\s*\[([^\]]*)\]\s*/);
  // A bracket whose words are all unknown is not a direction block (a writer's "[scaffold]" marker,
  // say): it stays in the text. One known word makes it a block, and the unknown ones are typos.
  if (m) { const p = parseDirection(m[1]); if (Object.keys(p.dir).length || !p.errors.length) { dir = p.dir; errors = p.errors; text = text.slice(m[0].length); } }
  const cues = [], spoken = [];
  const re = /<(\w+)(?:\s+(\d+(?:\.\d+)?))?>/g;
  let last = 0, k;
  const push = (s) => { const t = s.replace(/\s+/g, " ").trim(); if (t) spoken.push({ say: t.replace(/\*/g, ""), stress: [...t.matchAll(/\*([^*]+)\*/g)].map((x) => x[1]) }); };
  while ((k = re.exec(text))) {
    push(text.slice(last, k.index));
    const name = k[1].toLowerCase();
    if (!(name in CUES)) errors.push(`unknown cue <${k[1]}>`);
    else { const s = k[2] != null ? +k[2] : CUES[name]; if (name === "pause" && (s < 0.1 || s > 4)) errors.push(`<pause ${k[2]}> outside 0.1 to 4 s`); cues.push({ cue: name, s, at: spoken.length }); spoken.push({ cue: name, s }); }
    last = re.lastIndex;
  }
  push(text.slice(last));
  if (/<[^>]*$/.test(text.slice(last))) errors.push("unclosed <cue");
  if ((text.match(/\*/g) || []).length % 2) errors.push("unpaired * (stress)");
  if (dir.vol === "whisper" && dir.int === 3) errors.push("whisper at intensity 3: use low or raised");
  const shown = text.replace(re, " ").replace(/\*/g, "").replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
  return { text: shown, dir, cues, spoken, errors };
}

// Merge a node default (dir: NAME: ...) under a line's own block; the line wins key by key.
export const mergeDirection = (base, own) => ({ ...(base || {}), ...(own || {}) });

// The talking portrait reads the same tags. Sliders are those of characters/forge/headshapes.mjs
// (brow, browInner, lids, corners each -1..1; jaw 0..1 is driven by the audio envelope, not here).
// base: the character's resting face from design/voice/profiles.json ("face").
export function portraitCue(dir = {}, base = {}) {
  const [val, aro] = EMOTIONS[dir.emo || "flat"], g = [0, 0.45, 0.75, 1][dir.int || 1];
  const c = (x) => Math.max(-1, Math.min(1, x));
  const out = {
    brow: c((base.brow || 0) + g * (aro * 0.9 - 0.25 + (val < -0.5 && aro < 0.4 ? 0.3 : 0))),
    browInner: c((base.browInner || 0) + g * (val < 0 ? (aro > 0.6 ? -0.8 : 0.7) * -val : 0.1)),
    lids: c((base.lids || 0) + g * (aro < 0.25 ? 0.45 : aro > 0.7 ? -0.6 : 0) + (dir.emo === "tired" || dir.emo === "drunk" ? 0.4 : 0)),
    corners: c((base.corners || 0) + g * val * 0.9),
  };
  // a lie shows as a held face: the corners stay put and the lids steady, which a good reader notices
  if (dir.lie) { out.corners = c((base.corners || 0) + (out.corners - (base.corners || 0)) * 0.3); out.lids = c(out.lids + 0.15); }
  if (dir.vol === "whisper" || dir.aside) out.lids = c(out.lids + 0.2);
  const preset = dir.emo === "afraid" ? "startled" : ["cold", "stern", "contempt"].includes(dir.emo) ? "set" : ["anxious", "ashamed"].includes(dir.emo) ? "wary" : "neutral";
  return { preset, ...Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.round(v * 100) / 100])) };
}

// What the synthesis renderer changes for a direction, on top of the character's own setting
// (semitone offset, contour range multiplier, rate multiplier, spectral tilt dB above 2 kHz, breath).
export function renderParams(dir = {}) {
  const [val, aro] = EMOTIONS[dir.emo || "flat"], g = [0, 0.5, 0.8, 1][dir.int || 1];
  const p = { shift: g * (aro - 0.3) * 3, range: 1 + g * (aro - 0.3) * 0.9, rate: (dir.pace || 1) * (1 + g * (aro - 0.3) * 0.18), tilt: g * (aro - 0.3) * 6, breath: null, noise: 0 };
  if (val < -0.5 && aro < 0.4) { p.range *= 0.75; p.rate *= 0.94; p.breath = -30; }        // grief, shame: narrow, slow, breathy
  if (dir.lie) { p.range *= 0.85; p.rate *= 1.04; }                                          // a lie is smoother and a little quicker
  if (dir.held) { p.range *= 0.7; p.breath = -28; }
  if (dir.vol === "whisper") { p.noise = 1; p.tilt += 2; }
  if (dir.vol === "low" || dir.aside) { p.shift -= 1; p.tilt -= 2; p.noise = 0.25; }
  if (dir.vol === "raised") { p.shift += 1.5; p.tilt += 3; p.range *= 1.1; }
  if (dir.vol === "shout") { p.shift += 3.5; p.tilt += 6; p.range *= 1.25; }
  return p;
}
