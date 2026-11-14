// Shared settings for the Quota spine plates of 2026-10-22 (render/worlds/q_rooms, q_office, q_streets, q_country).
// The author's references of that day, read for method only: one hard warm source against a cold field, and nights
// carried by warm brown-black land under a lit sky rather than a flat navy (the van der Neer moonlit rivers).
// WARM_DARK: a grade over the hour's look that keeps the shadow family brown-black and lifts it a little warm.
export const WARM_DARK = { shadowTint: [0.95, 0.8, 0.66], lift: [0.003, 0.002, 0.001] };
// the grey of a snowy winter day: the sky overcast, the sun a soft disc low in the south
export const SNOW_DAY = (hour, sunI = 70000) => ({ day: true, frost: 0.95, sun: { pos: [-160, 70, -200], I: sunI, soft: 60 }, fill: 4, emit: { lantern: 0, window: 0.35 } });
export const ROOM_CAM = { yawDeg: 34, elevDeg: 36, ppm: 220, W: 1920, H: 1300, dist: 20 };
// One three-quarter angle for every exterior plate (design/CAMERA.md, the Lamp Quay test of 2026-10-22: B, yaw 38,
// elevation 40), so neighbouring places join; exterior(ppm at the old 30 degrees, elev) keeps a person's size.
export const EXTERIOR = { yawDeg: 38, elevDeg: 40 };
export const exteriorPpm = (ppm, fromElev = 30) => +(ppm * Math.cos((fromElev * Math.PI) / 180) / Math.cos((EXTERIOR.elevDeg * Math.PI) / 180)).toFixed(1);
export const STREET_CAM = { ...EXTERIOR, ppm: exteriorPpm(115, 34), W: 1920, H: 1080, dist: 70 };
export const LAND_CAM = { ...EXTERIOR, ppm: exteriorPpm(80, 32), W: 1920, H: 1080, dist: 80 };
