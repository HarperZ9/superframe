// Camera test (art archivist's proposal, 2026-10-22; design/CAMERA.md): Lamp Quay at the present camera (yaw 26, elevation 30), the night variant only,
// at a 3200 x 1800 window round the quay's own target, figure height held to the present camera's by ppm. A test
// plate baked to render/preview/camtest, never to content/.
import Q from "./quay.mjs";
export default { ...Q, name: "quay_camA", camera: { ...Q.camera, yawDeg: 26, elevDeg: 30, ppm: 80.0, W: 3200, H: 1800, dist: 110 }, variants: { night: Q.variants.night }, dark: undefined };
