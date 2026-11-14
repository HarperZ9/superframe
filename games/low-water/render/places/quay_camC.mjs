// Camera test (art archivist's proposal, 2026-10-22; design/CAMERA.md): Lamp Quay at candidate C (yaw 45, elevation 48, the isometric references 70 to 73), the night variant only,
// at a 3200 x 1800 window round the quay's own target, figure height held to the present camera's by ppm. A test
// plate baked to render/preview/camtest, never to content/.
import Q from "./quay.mjs";
export default { ...Q, name: "quay_camC", camera: { ...Q.camera, yawDeg: 45, elevDeg: 48, ppm: 103.5, W: 3200, H: 1800, dist: 110 }, variants: { night: Q.variants.night }, dark: undefined };
