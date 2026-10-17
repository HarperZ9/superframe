// The gameplay camera (design/CAMERA.md, 2026-10-17): how close, where it looks, and when it
// pulls back. Pure functions, so the shell, the prototype and tests frame alike.
//   scale        @area camera: n (or @place camera: n); else @rules camera-room (1.75) under
//                shelter or by a stove, camera-outdoor (2.25) elsewhere. 1 is the whole plate.
//   wide         a node or event line camera: wide pulls back to the whole plate and holds until
//                camera: near or the end of that conversation (the arrival, the blackouts, the
//                dawn minute). camera: <n> sets a scale for the conversation.
//   talk slide   while a conversation is open the subject sits at a third of the view's width
//                from the left (@rules camera-talk-x, default 1/3), clear of the talk panel.
//   pixel snap   the view's left and top are whole plate pixels; frame() returns them so.
//   runs         frame({ bounds }) fits a Tide Run's course (and its water front) in view,
//                pulling back past the area's scale when it has to.
// Plates carry their bake camera (content/<plate>/place.json: yawDeg, elevDeg, target, dist,
// ortho, fovY or scale, the orthographic half-height); projectPlate() turns a world point into
// plate pixels with it.
export function cameraScale(G, area = G.world.area()) {
  const C = (G.state.camera || {}).mode;
  if (C === "wide") return 1;
  if (typeof C === "number") return C;
  const place = G.book.places[(area && area.place) || G.state.place] || {};
  const own = area && area.camera != null ? +area.camera : place.camera != null ? +place.camera : null;
  if (own) return own;
  return place.shelter || place.stove ? +G.rs.rules["camera-room"] : +G.rs.rules["camera-outdoor"];
}

// camera: wide | near | <scale>, from a node or event line.
export function setCamera(G, value) {
  const v = String(value).trim();
  G.state.camera = v === "near" ? {} : { mode: v === "wide" ? "wide" : +v || "wide" };
  G.emit("camera", { mode: G.state.camera.mode || "near" });
}

// A world point to plate pixels with the plate's bake camera: the same maths as raw-native's
// web/shaders/paintover/camera.mjs (isoCamera, project), which baked the plates.
export function projectPlate(cam, W, H, P) {
  const yaw = (cam.yawDeg * Math.PI) / 180, el = (cam.elevDeg * Math.PI) / 180, t = cam.target, dist = cam.dist;
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const f = norm([-Math.sin(yaw) * Math.cos(el), -Math.sin(el), -Math.cos(yaw) * Math.cos(el)]);
  const right = norm(cross(f, [0, 1, 0])), up = norm(cross(right, f)), pos = [t[0] - f[0] * dist, t[1] - f[1] * dist, t[2] - f[2] * dist];
  const r = [P[0] - pos[0], P[1] - pos[1], P[2] - pos[2]], z = dot(r, f), asp = W / H, a = dot(r, right), b = dot(r, up);
  let u, v;
  if (cam.ortho) { u = a / ((cam.scale || 8) * asp); v = b / (cam.scale || 8); } else { const tt = Math.tan((cam.fovY || 0.5) / 2); u = a / (z * tt * asp); v = b / (z * tt); }
  return [((u + 1) / 2) * W - 0.5, ((1 - v) / 2) * H - 0.5];
}

// Where the view sits on the plate. Returns { zoom (screen px per plate px), left, top (whole
// plate pixels), w, h (plate pixels in view) }.
export function frame({ plateW, plateH, viewW, viewH, scale = 1, focus = null, talking = false, talkX = 1 / 3, bounds = null, margin = 0.08 }) {
  const fit = Math.max(viewW / plateW, viewH / plateH); // scale 1: the plate fills the view
  let zoom = fit * Math.max(1, scale);
  if (bounds) { const bw = (bounds[2] - bounds[0]) * (1 + 2 * margin), bh = (bounds[3] - bounds[1]) * (1 + 2 * margin); zoom = Math.max(fit, Math.min(zoom, viewW / bw, viewH / bh)); }
  const w = viewW / zoom, h = viewH / zoom;
  let fx = focus ? focus[0] : plateW / 2, fy = focus ? focus[1] : plateH / 2;
  if (bounds) { fx = (bounds[0] + bounds[2]) / 2; fy = (bounds[1] + bounds[3]) / 2; }
  let left = fx - (talking ? w * talkX : w / 2), top = fy - h / 2;
  left = Math.round(Math.max(0, Math.min(plateW - w, left))); top = Math.round(Math.max(0, Math.min(plateH - h, top)));
  return { zoom, left, top, w, h };
}

// One step of easing toward a target frame, snapped to whole plate pixels.
export function ease(cur, target, dt, rate = 6) {
  if (!cur) return { ...target };
  const k = 1 - Math.exp(-rate * dt);
  // whole plate pixels, at least one a step, so the view always arrives and never shimmers
  const step = (a, b) => (a === b ? b : a + Math.sign(b - a) * Math.min(Math.abs(b - a), Math.max(1, Math.round(Math.abs(b - a) * k))));
  const zoom = Math.abs(target.zoom - cur.zoom) < 1e-3 ? target.zoom : cur.zoom + (target.zoom - cur.zoom) * k;
  return { ...target, zoom, left: step(cur.left, target.left), top: step(cur.top, target.top) };
}
