// Hesh letters (the UI art lead's, 2026-10-22). PROVISIONAL until the author approves it (coordinator, 2026-10-22).
// An invented script for the Hesh of the plain, so that a Hesh
// writer's own notes look like their own language. Letters hang from a headline drawn through the whole word
// (one stroke on top, the letters falling from it), built from seven shapes and four marks. It is a design
// for the game, not any real script; the clean transcription beside a Hesh note is in Tarnish.
//   HESH[ch] -> { w, s }  for a to z (the Tarnish letter a Hesh letter stands for), digits as the print set
import { GLYPHS as PRINT } from "./skeleton.mjs";

const W = 30, TOP = 46;
const SHAPES = [
  [[[15, TOP], [15, 4]]],                                                              // a fall
  [[[20, TOP], [20, 18], [12, 4], [4, 10]]],                                           // a fall hooked back
  [[[10, TOP], [10, 16], [18, 4], [26, 10]]],                                          // a fall hooked on
  [[[15, TOP], [15, 26], [6, 18], [10, 6], [20, 8], [22, 20], [15, 26]]],              // a fall into a loop
  [[[6, TOP], [24, 8]]],                                                               // a slant
  [[[6, 40], [6, 14], [15, 4], [24, 14], [24, 40]]],                                   // a cup
  [[[8, TOP], [22, 32], [8, 20], [22, 6]]],                                            // a zig
];
const MARKS = [[], [[[15, -5], [16, -9]]], [[[11, 52], [19, 58]]], [[[6, 24], [24, 24]]]];   // none, a dot below, a tick above, a bar

export const HESH = { " ": { w: 22, s: [] } };
"abcdefghijklmnopqrstuvwxyz".split("").forEach((ch, i) => {
  const s = [[[0, TOP], [W, TOP + 0.5]], ...SHAPES[i % 7], ...MARKS[Math.floor(i / 7) % 4]];
  HESH[ch] = { w: W, s }; HESH[ch.toUpperCase()] = { w: W, s: [...s, [[2, TOP + 6], [W - 2, TOP + 6]]] };   // a capital: the headline doubled above it
});
for (const ch of "0123456789.,'\":;-!?()&/") HESH[ch] = PRINT[ch];
