// One main light aimed at a room's focal area (plates pass 2026-10-24). Eleven of seventeen era 5 rooms, and the era 4
// tube rooms, lit their walls as brightly as the thing the room is about: an even line of tubes, two tall windows, a
// fill from the camera side. aimLight makes the room's key a spot (the shader's mode 1: full strength on its axis,
// falling to nothing about 37 degrees off it) from its motivating fixture toward the focal area, so the pool lands on
// the table, the bench or the rugs and the walls keep only the weaker lights. Original code.
export function aimLight(from, at, { type = 1, I = 8, reach = 10, key = "key_light", group = "key", soft } = {}) {
  const d = [at[0] - from[0], at[1] - from[1], at[2] - from[2]], n = Math.hypot(d[0], d[1], d[2]) || 1;
  return { pos: from, type, I, reach, key, group, cone: d.map((v) => +(v / n).toFixed(4)), mode: 1, ...(soft ? { soft } : {}) };
}
