// Shared settings for The Quota's era 1 plates (package W3-C, 2026-10-22). Era 1 is year 0, harvest to the first
// frost (design/eras/era1.md): the game's warmest era, against era 2's white winter. A low gold sun, no frost, the
// shadow family warm brown rather than era 2's grey, and the colour let up to full where era 2 holds it at 0.6-0.75.
export const HARVEST_GRADE = { shadowTint: [1.0, 0.84, 0.64], lift: [0.006, 0.0035, 0.001], saturation: 0.98 };
export const NIGHT_GRADE = { shadowTint: [0.92, 0.76, 0.62], lift: [0.005, 0.003, 0.0015], saturation: 0.85 };
// a late-summer day outdoors: the sun low and hard, no frost, a warm fill
export const HARVEST_DAY = (sunPos = [-220, 45, -60], I = 260000) => ({ day: true, frost: 0, sun: { pos: sunPos, I, soft: 3 }, fill: 8, emit: { lantern: 0, window: 0.2 } });
