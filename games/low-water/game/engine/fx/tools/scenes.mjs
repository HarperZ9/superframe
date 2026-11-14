// The effects proof scenes: the Quota slice's places with the weather and the people the effects answer to. Figures
// stand where the slice puts them (the relief queue along the square's queue path, the family at the table), facing
// as the scene has them; `walk` moves one along x (m/s) to leave prints.
export const FX_SCENES = [
  { id: "granary-fog", plate: "q_granary", hour: 23.7, terms: { fog: 0.8, snowfall: 0.4 }, label: "GRANARY, FOG BY HEIGHT", crop: [380, 150, 240, 150] },
  { id: "square-smoke", plate: "q_square_wide", hour: 18.2, state: "riot", terms: { snowfall: 0 }, queue: 12, label: "SQUARE, SMOKE (A RIOT)", crop: [300, 200, 240, 150] },
  // the thaw at noon: the ruts and the square's melt flooded, the low sun glinting on them
  { id: "thaw-glints", plate: "q_square_wide", hour: 12.5, terms: { snow: 0.4, snowfall: 0, rain: 0.9, thawHours: 0 }, label: "SQUARE 12:30, THAW, GLINTS", crop: [380, 260, 240, 150] },
  // the granary door's fight: the Captain winds up (a blow that cannot be caught), Will is struck hard, Ned falls
  { id: "fight", plate: "q_granary", hour: 23.7, t: 5, terms: { snowfall: 0.3 }, people: [["captain", [0, 0, -1.2], 1.57], ["will", [0.3, 0, 0.4], -1.57], ["ned", [-1.4, 0, 1.0], -1.2]],
    events: [{ type: "windup", at: [0, 0, -1.2], dir: [0, 1], t0: 4.7, dur: 0.6, unstoppable: true }, { type: "hit", at: [0.3, 0, 0.4], dir: [0.2, 1], t0: 4.88, power: 0.9 }, { type: "fall", at: [-1.4, 0, 1.0], dir: [-1, 0], t0: 4.5, power: 0.6 }, { type: "exert", at: [0, 0, -1.2], dir: [0, 1], t0: 4.8 }],
    label: "GRANARY FIGHT", crop: [380, 230, 240, 150] },
  // a dream at the Haldane table: where they will be sitting a week on
  { id: "dream", plate: "q_haldane", hour: 7.6, people: [["tomas", [0.3, 0, 0.9], 2.4]], future: [{ at: [1.1, 0, 1.3] }, { at: [-0.5, 0, 0.5] }], label: "HALDANE DREAM", crop: [200, 160, 240, 150] },
  { id: "square-day", plate: "q_square_wide", hour: 11, terms: { snow: 0.8, snowfall: 0, thawHours: 1.5 }, queue: 20, label: "SQUARE 11:00, NOTICES, RUTS", crop: [40, 80, 240, 150] },
  { id: "square-day-after", plate: "q_square_wide", hour: 11, state: "dark", day: 55, terms: { snow: 0.8, snowfall: 0, thawHours: 4 }, queue: 30, label: "SQUARE, STREETS GONE DARK", crop: [40, 80, 240, 150] },
  { id: "square-dawn-snow", plate: "q_square_wide", hour: 7.8, terms: { snowfall: 0.5, snow: 0.8 }, queue: 16, walker: true, label: "SQUARE DAWN, SNOW", crop: [520, 300, 240, 150] },
  { id: "square-night", plate: "q_square_wide", hour: 22, terms: { snowfall: 0.6, snow: 0.8 }, queue: 10, label: "SQUARE NIGHT", crop: [600, 330, 240, 150] },
  { id: "train", plate: "q_square_wide_quiet", hour: 5.6, t: 7, terms: { snow: 0.8, snowfall: 0.5 }, label: "TRAIN, SNOW IN THE HEADLAMP", crop: [640, 220, 240, 150] },
  { id: "granary", plate: "q_granary", hour: 23.7, terms: { snowfall: 0.3 }, people: [["captain", [0, 0, -2.4], 1.57], ["will", [0.4, 0, 2], -1.57], ["ned", [-1.6, 0, 1.2], -1.2]], label: "GRANARY NIGHT", crop: [470, 230, 240, 150] },
  { id: "haldane", plate: "q_haldane", hour: 8.4, people: [["tomas", [0.3, 0, 0.9], 2.4], ["anni", [1.1, 0, 1.3], 3.0]], label: "HALDANE 08:25, A SHAFT", crop: [330, 120, 240, 150] },
  { id: "brack", plate: "q_brack_kitchen", hour: 19.1, people: [["will", [0.2, 0, 1.4], 2.4]], label: "BRACK EVENING", crop: [270, 250, 240, 150] },
];
export function figuresFor(sc, pj) {
  const out = (sc.people || []).map(([id, at, facing]) => ({ id, at, facing }));
  const path = pj.marks && pj.marks.queue && pj.marks.queue.path;
  if (sc.queue && path) {
    let left = sc.queue, k = 0;
    for (let s = 0; s < path.length - 1 && left > 0; s++) {
      const a = path[s], b = path[s + 1], L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.floor(L / 0.75);
      for (let j = 0; j < n && left > 0; j++, left--, k++) { const u = j / n; out.push({ id: `q${k}`, at: [a[0] + (b[0] - a[0]) * u, 0, a[2] + (b[2] - a[2]) * u], facing: Math.atan2(a[2] - b[2], a[0] - b[0]) }); }
    }
  }
  if (sc.walker) out.push({ id: "walker", at: [-6, 0, 4], facing: 0, walk: 1.1 });
  return out;
}
