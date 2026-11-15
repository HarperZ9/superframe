// Shared settings for The Quota's era 3 plates (Allocation, year 20; design/eras/era3.md, plates package 2026-10-22).
// Look L3 (design/sensory/01-LOOKS.md): ground #0b0d0b, ink #ccd4c0, hot #e26040. The ration book's grey: a cool green-grey
// shadow family, colour held down, bare bulbs and brownouts. September to December: no snow until the fire's frost.
export const L3_GRADE = { shadowTint: [0.86, 0.92, 0.86], lift: [0.003, 0.0036, 0.003], saturation: 0.6 };
export const L3_NIGHT = { shadowTint: [0.84, 0.9, 0.86], lift: [0.002, 0.0026, 0.0024], saturation: 0.55 };
// a grey autumn day outdoors: an overcast sky, the sun a soft disc, no frost on the ground
export const AUTUMN_DAY = (sunPos = [-160, 60, -160], I = 90000) => ({ day: true, frost: 0, sun: { pos: sunPos, I, soft: 40 }, fill: 5, emit: { lantern: 0, window: 0.3 } });
// a room lit by its bulb: the brownout factor dims the bulbs, a little sky through the glass, a weak fill
export const BULB = (brown = 1, sky = 0.4, fill = 0.3) => ({ brown, sky, fill, emit: { lantern: 1, stove: 1 } });
// a room lit by its window: the bulbs off, the sun or sky in through the glass
export const WINDOW = (sunPos, I = 60000, fill = 1.2) => ({ day: true, sun: { pos: sunPos, I, soft: 25 }, sky: 3, fill, emit: { lantern: 0 } });
