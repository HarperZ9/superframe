// The opening film: day 41 at dawn, Edrin's Upper Town (design/CINEMATICS.md section 3.2). Shots in order; times
// are local seconds within each shot; world points are the plates' own (place.json marks). The sound is one cue,
// audio/pieces/opening.mjs, laid to the same seconds. Cinematics lead, 2026-10-22.
//   look: the tilt-shift look (fx/focus.mjs LOOKS); morph: a time morph into the record look and back
//   people: who, path, from/to (walked between those seconds), face (radians, standing), acts (gestures)
const QUEUE = [-17, -15.2, -13.4, -11.6, -9.8, -8, -6.2, -4.4, -2.6, -0.8, 1, 2.8, 4.6, 6.4];
// bodies: the slice's townsfolk who have one (characters/cast/quota2.mjs), repeated, until the crowd tier has era 2
// bodies; the Gullet folk set is kept off the queue (two of them carry weapons in their idle)
const QUEUE_WHO = ["lil", "edie", "davey", "rose", "lil", "edie", "rose", "davey", "lil", "edie", "davey", "rose", "dunlin", "edie"];
// the queue stands across the open square from the district office's door, its head at the door, facing it (along
// the front terrace's face it stood behind the terrace from the tower, out of sight)
const queue = (skip = -1) => QUEUE.map((x, k) => ({ who: QUEUE_WHO[k], slot: `q${k}`, path: [[x, 0, -3.6 + (k % 3) * 0.25]], face: Math.PI + 0.15 * Math.sin(k * 1.7) })).filter((_, k) => k !== skip);
// two men carry sacks from the pile to the wagon door and back, under Holt's eye and Gedge's (the requisition
// captain's body is cast id "holt", characters/runtime/castmap.mjs)
const LOAD_A = [[13.6, 0, -3.4], [15.3, 0, -3.4]], LOAD_B = [[13.6, 0, -4.6], [15.3, 0, -4.6]];
const loader = (who, line, dur, phase) => {
  const legs = [], n = Math.ceil(dur / 3) + 1;
  for (let k = 0; k < n; k++) legs.push(line[(k + phase) % 2]);
  return { who, path: legs, from: 0, to: (n - 1) * 3 };
};
const guards = [{ who: "holt", path: [[15.2, 0, -6.4]], face: Math.PI * 0.75 }, { who: "gedge", path: [[15.8, 0, 1.4]], face: Math.PI }];
const SPLIT = [11.6, 0, -0.9];
// the observer's miniature in the square: stronger than the daily look (K 8 left nearly every pixel sharp at these
// zooms, 2026-10-22 stills), short of the town map's K 40
const MINI = { K: 22, fNumber: 1.6, tiltDeg: 80 };   // where the sack splits, at the end of the line nearest the wagons

export const OPENING = {
  id: "opening", title: "The Prayer for the Water", cue: "opening", ground: "#070a11",
  shots: [
    { id: "black", dur: 4, black: true, captions: [{ s0: 0.5, s1: 4, text: "[Wind over the tower.]" }] },
    { id: "district", dur: 16, plate: "q_town", variant: "dawn", look: "town_map", dissolve: 1.5,
      cam: [{ s: 0, at: [12, 0, -12], zoom: 1 }, { s: 16, at: [2, 0, -2], zoom: 1.6 }],
      focus: [{ s: 0, at: [0, 0, 0] }],
      captions: [{ s0: 6, s1: 9, text: "[A church bell, far off.]" }] },
    { id: "queue", dur: 16, plate: "q_square_wide", variant: "dawn", look: "daily", lens: MINI, fx: { snowfall: 0.3 },
      cam: [{ s: 0, at: [-2, 0, -2], zoom: 1.55 }, { s: 16, at: [8, 0, -2], zoom: 1.75 }],
      focus: [{ s: 0, at: [-4, 0.9, 0.8] }, { s: 9, at: [-1, 0.9, 0.8] }, { s: 15, at: [15.5, 1, -3.5] }],
      people: [...queue(), loader("cockle", LOAD_A, 16, 0), loader("pardew", LOAD_B, 16, 1), ...guards],
      captions: [{ s0: 1, s1: 5, text: "[Feet shifting on frozen ground. A cough.]" }] },
    { id: "train", dur: 14, plate: "q_square_wide", variant: "dawn", look: "daily", lens: MINI, fx: { snowfall: 0.3 },
      cam: [{ s: 0, at: [14.5, 0, -2.5], zoom: 2.6 }, { s: 14, at: [15.5, 0, -3], zoom: 2.9 }],
      focus: [{ s: 0, at: [15, 1, -3.8] }],
      morph: { look: "record", in: [3, 4.5], out: [9, 10.5] },
      text: [{ s0: 4.5, s1: 9, kind: "stencil", text: "HALVARD GRAIN CO., VIA ARLEN", at: [15, 0.9, -3.9] }],
      people: [loader("cockle", LOAD_A, 14, 1), loader("pardew", LOAD_B, 14, 0), ...guards],
      captions: [{ s0: 1, s1: 4, text: "[Sacks thrown down on boards.]" }] },
    // the blow (CINEMATICS.md 3.2 beat 4): held still, no cut, the music gone; Gedge owns it
    { id: "blow", dur: 14, plate: "q_square_wide", variant: "dawn", look: "daily", lens: MINI, fx: { snowfall: 0.3 },
      cam: [{ s: 0, at: [9.5, 0, -0.5], zoom: 2.3 }],
      focus: [{ s: 0, at: [11, 0.9, -0.6] }],
      people: [...queue(12).slice(9), loader("pardew", LOAD_B, 14, 0), guards[0],
        { who: "dunlin", path: [[4.6, 0, -3.6], [SPLIT[0] - 0.6, 0, SPLIT[2] + 0.2]], from: 1.0, to: 4.2,
          acts: [{ s: 4.4, anim: "examine", dur: 2.4, hold: true }, { s: 7.6, anim: "knockdown", dur: 1.4, hold: true }] },
        { who: "gedge", path: [[15.8, 0, 1.4], [SPLIT[0] + 0.5, 0, SPLIT[2] + 0.1]], from: 4.6, to: 7.0,
          acts: [{ s: 7.1, anim: "long.heavy", dur: 1.0, faceTo: [SPLIT[0] - 0.6, SPLIT[2] + 0.2] }, { s: 8.4, anim: "long.heavy", dur: 1.0, faceTo: [SPLIT[0] - 0.6, SPLIT[2] + 0.2] },
            { s: 9.8, anim: "shove", dur: 0.9, faceTo: [SPLIT[0] - 1.2, SPLIT[2]] }] }],
      captions: [{ s0: 5, s1: 13, text: "[The music stops. Wind. An engine idling.]" }] },
    { id: "rows", dur: 12, plate: "q_square_wide", variant: "dawn", look: "daily", lens: MINI, fx: { snowfall: 0.3 }, dissolve: 1.2,
      cam: [{ s: 0, at: [9, 0, -30], zoom: 1.9 }, { s: 12, at: [11, 0, -36], zoom: 2.2 }],
      focus: [{ s: 0, at: [11, 0.5, -34] }],
      captions: [{ s0: 1, s1: 9, text: "[A church bell, three strokes.]" }] },
    { id: "boy", dur: 12, plate: "q_square_wide", variant: "dawn", look: "daily", lens: MINI, fx: { snowfall: 0.3 },
      cam: [{ s: 0, at: [-11, 0, -14], zoom: 2.2 }, { s: 12, at: [-15, 0, -6], zoom: 2.5 }],
      focus: [{ s: 0, at: [-13.4, 0.9, -19] }, { s: 11.5, at: [-19.2, 0.9, -1.4] }],
      people: [...queue().slice(0, 6), { who: "tomas", path: [[-13.4, 0, -21], [-13.4, 0, -6.6], [-19.2, 0, -1.4]], from: 0.5, to: 11.5, faceEnd: Math.PI }],
      captions: [{ s0: 2, s1: 8, text: "[A train pulling out. Under it, an old man humming.]" }] },
    // the grating: the train has gone (the quiet plate), and the hum comes up through the cells' grating
    { id: "grating", dur: 4, plate: "q_square_wide_quiet", variant: "dawn", look: "daily", lens: MINI, dissolve: 2,
      cam: [{ s: 0, at: [-15, 0, -6], zoom: 2.5 }],
      focus: [{ s: 0, at: [-19.2, 0.9, -1.4] }],
      people: [...queue().slice(0, 6), { who: "tomas", path: [[-19.2, 0, -1.4]], face: Math.PI, acts: [{ s: 0.5, anim: "examine", dur: 2, hold: true }] }],
      captions: [{ s0: 0, s1: 4, text: "[Humming, close, from below.]" }] },
    { id: "title", dur: 8, black: true, dissolve: 1,
      text: [{ s0: 1.5, s1: 8, kind: "title", text: "THE PRAYER FOR THE WATER" }] },
  ],
};
