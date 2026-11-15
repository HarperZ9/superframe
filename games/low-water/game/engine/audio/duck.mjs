// Ducking under voice lines, read from the voice director's tags (VOICE-BIBLE 4.2, 4.3, 5; QUOTA-VOICES
// 11.4). A line is { speaker, kind: "line" | "nar" | "voice", dir: { emo, int, vol, lie, held, aside } }.
// What the duck reads: who speaks (READBACK silences everything), whether it is an inner voice (the room
// ducks 3 dB, rule 4.3.4), how quietly it is said (a whisper needs more room). What it never reads: `lie`.
// The mix must not give a lie away; a lie is ducked exactly like the truth.
export function duckFor(line = {}) {
  const d = line.dir || {};
  if (line.speaker === "READBACK") return { music: -Infinity, amb: -Infinity, attack: 1.2, release: 0, ahead: 1.4 };
  if (line.kind === "voice") return { music: -6, amb: -3, attack: 0.1, release: 0.6, ahead: 0.1 };
  if (line.kind === "nar") return { music: -6, amb: -2, attack: 0.15, release: 0.8, ahead: 0.15 };
  let music = -9, amb = -4;
  if (d.vol === "whisper") { music -= 6; amb -= 4; }
  else if (d.vol === "low" || d.aside) { music -= 3; amb -= 2; }
  if (d.held) music -= 2;                                   // a clamped throat is quieter than its intensity
  if ((d.int || 1) >= 3) music -= 2;
  return { music, amb, attack: 0.12, release: 0.8, ahead: 0.15 };
}

// put a line's duck on a mixer: start and end in the mixer's clock
export function duckLine(mixer, line, start, end) {
  const k = duckFor(line), common = { attack: k.attack, release: k.release, ahead: k.ahead };
  mixer.duck(start, end, { ...common, depth: k.music, groups: ["music"] });
  mixer.duck(start, end, { ...common, depth: k.amb, groups: ["amb"] });
  return k;
}
