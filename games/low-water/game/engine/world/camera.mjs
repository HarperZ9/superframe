// The gameplay camera (design/CAMERA.md, 2026-10-17): how close, where it looks, and when it
// pulls back. Pure functions, so the shell, the prototype and tests frame alike.
//   scale        @area camera: n (or @place camera: n); else @rules camera-room (1.75) under
//                shelter or by a stove, camera-outdoor (2.25) elsewhere. 1 is the whole plate; below 1
//                pulls back past it (a room baked close), the plate centred.
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

// camera: wide | near | phone | <scale>, from a node or event line. phone (era 5's clip, 2026-10-23): the whole plate,
// seen inside a phone's frame (ui/phoneframe.mjs draws the frame); it holds like wide until near or the talk's end.
export function setCamera(G, value) {
  const v = String(value).trim();
  G.state.camera = v === "near" ? {} : v === "phone" ? { mode: "wide", frame: "phone" } : { mode: v === "wide" ? "wide" : +v || "wide" };
  G.emit("camera", G.state.camera.frame ? { mode: G.state.camera.mode, frame: G.state.camera.frame } : { mode: G.state.camera.mode || "near" });
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
// bounds (plate px) keep a set of points in view, pulled back as needed. close > 1 (a fight) also lets the
// view come in past the area's closeness, up to close times it, so the fighters fill the view. free
// [x0, y0, x1, y1] (view px): the part of the view clear of the paper; bounds are fitted into it and centred on it.
export function frame({ plateW, plateH, viewW, viewH, scale = 1, focus = null, talking = false, talkX = 1 / 3, bounds = null, margin = 0.08, close = 1, free = null }) {
  const fit = Math.max(viewW / plateW, viewH / plateH); // scale 1: the plate fills the view
  // an area's camera below 1 pulls back past the plate (rooms baked close: the people keep play size,
  // 2026-10-21), the plate centred on the view's ground; at 1 and above the plate fills the view
  const floor = scale > 0 && scale < 1 ? fit * scale : fit;
  let zoom = scale > 0 && scale < 1 ? floor : fit * Math.max(1, scale);
  const fr = bounds && free ? free : [0, 0, viewW, viewH];
  if (bounds) { const bw = (bounds[2] - bounds[0]) * (1 + 2 * margin), bh = (bounds[3] - bounds[1]) * (1 + 2 * margin); zoom = Math.max(floor, Math.min(zoom * Math.max(1, close), (fr[2] - fr[0]) / bw, (fr[3] - fr[1]) / bh)); }
  const w = viewW / zoom, h = viewH / zoom;
  let fx = focus ? focus[0] : plateW / 2, fy = focus ? focus[1] : plateH / 2;
  if (bounds) { fx = (bounds[0] + bounds[2]) / 2 - ((fr[0] + fr[2]) / 2 - viewW / 2) / zoom; fy = (bounds[1] + bounds[3]) / 2 - ((fr[1] + fr[3]) / 2 - viewH / 2) / zoom; }
  let left = fx - (talking ? w * talkX : w / 2), top = fy - h / 2;
  left = Math.round(w >= plateW ? (plateW - w) / 2 : Math.max(0, Math.min(plateW - w, left))); top = Math.round(h >= plateH ? (plateH - h) / 2 : Math.max(0, Math.min(plateH - h, top)));
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

// The follow, as the reference's gameplay camera does it (cleanroom/spec/NRFTW-PRESENTATION-2.md 1.2;
// author 2026-10-21 "Make it more like No Rest for the Wicked"): a critically damped follow whose smooth
// time grows with speed (0.25 s at 2 m/s to 0.75 s at 10 m/s; in a fight 0.25 to 0.5 s), a look-ahead
// of up to 3 m along the walk (none under 0.75 m/s, full at 5 m/s; eased in at 3 /s, out at 4 /s) and
// room kept below a moving player (2 m toward the bottom of the screen, eased in over 2 s, out over 4).
export const FOLLOW = { smooth: [0.25, 0.75], fightSmooth: [0.25, 0.5], speed: [2, 10], lead: { dead: 0.75, full: 5, max: 3, in: 3, out: 4 }, below: { m: 2, in: 2, out: 4 }, viewShare: 0.15 };
const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
export const smoothTime = (speed, fight = false) => { const r = fight ? FOLLOW.fightSmooth : FOLLOW.smooth; return lerp(r[0], r[1], (speed - FOLLOW.speed[0]) / (FOLLOW.speed[1] - FOLLOW.speed[0])); };
export function leadFor(speed) { const L = FOLLOW.lead; return speed <= L.dead ? 0 : L.max * Math.min(1, (speed - L.dead) / (L.full - L.dead)); }
// one critically damped step of x toward target over smooth time T (the common closed form)
export function damp(st, target, T, dt) {
  const w = 2 / Math.max(1e-3, T), x = w * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x), ch = st.x - target, tmp = (st.v + w * ch) * dt;
  st.v = (st.v - w * tmp) * e; st.x = target + (ch + tmp) * e; return st.x;
}
// The framing follow (engine PROGRESS 37, 2026-10-22). The view's centre and its zoom (in log space) each
// take one critically damped step toward a target that is first held inside a dead band and then low-passed:
//   - the dead band (FRAMER.hold plate px of centre, FRAMER.holdZoom of log zoom) keeps a view at rest still
//     while bodies breathe, a panel's text changes size, or the target rounds back and forth;
//   - the low-pass (FRAMER.lowpass s) turns a target that jumps (a fighter out, new bounds, a way out nearer)
//     into a ramp, so the follow starts with no jump in its speed;
//   - centre and zoom eased together, left and top made from them, so a change of zoom never swings the
//     centre (the old follow eased left and top toward the target zoom's corner while the zoom lagged).
// Shown at whole plate pixels with hysteresis whenever the zoom is still: the shown corner moves only once the eased
// one is FRAMER.snap px away, so a view at rest never flips between two pixels. `eased` is the unsnapped corner.
export const FRAMER = { hold: 4, holdZoom: 0.006, lowpass: 0.12, snap: 0.6, settle: 1e-3 };
const clampEdge = (c, w, P) => (w >= P ? P / 2 : Math.max(w / 2, Math.min(P - w / 2, c)));
export function framer() {
  let S = null;
  const start = (t) => { const c = [t.left + t.w / 2, t.top + t.h / 2, Math.log(t.zoom)]; S = { want: [...c], lp: [...c], st: c.map((x) => ({ x, v: 0 })), out: t }; return t; };
  return {
    // target: a frame() result; dt seconds; T the smooth time; plateW, plateH, viewW, viewH; cur: the frame now
    // shown (null at a new plate; another object after a cut, a hold or calm mode: start again from it)
    step(target, dt, T, { plateW, plateH, viewW, viewH }, cur = null) {
      if (!cur) return start({ ...target });
      if (!S || cur !== S.out) start(cur);
      const tc = [target.left + target.w / 2, target.top + target.h / 2, Math.log(target.zoom)];
      if (Math.hypot(tc[0] - S.want[0], tc[1] - S.want[1]) > FRAMER.hold) { S.want[0] = tc[0]; S.want[1] = tc[1]; }
      if (Math.abs(tc[2] - S.want[2]) > FRAMER.holdZoom) S.want[2] = tc[2];
      const a = 1 - Math.exp(-dt / FRAMER.lowpass);
      for (let i = 0; i < 3; i++) {
        S.lp[i] += (S.want[i] - S.lp[i]) * a;
        damp(S.st[i], S.lp[i], T, dt);
        // arrived: rest exactly on the target, so a view at rest has nothing left to creep by
        if (Math.abs(S.st[i].x - S.want[i]) < (i < 2 ? 0.05 : FRAMER.settle) && Math.abs(S.st[i].v) < (i < 2 ? 0.5 : 0.01)) { S.st[i] = { x: S.want[i], v: 0 }; S.lp[i] = S.want[i]; }
      }
      const zoom = Math.exp(S.st[2].x), w = viewW / zoom, h = viewH / zoom, was = S.out;
      const left = clampEdge(S.st[0].x, w, plateW) - w / 2, top = clampEdge(S.st[1].x, h, plateH) - h / 2;
      // a still zoom keeps the shown pixel until the eased corner is FRAMER.snap px from it (whole plate pixels, so a
      // painted plate never shimmers as it scrolls); while the zoom moves the plate is resampled every frame anyway,
      // so the corner follows the eased path exactly and the zoom's arrival snaps it to the nearest pixel
      const moving = S.st[2].x !== S.want[2], snap = (x, w0) => (moving ? x : Math.abs(x - w0) >= FRAMER.snap || w0 !== Math.round(w0) ? Math.round(x) : w0);
      return (S.out = { ...target, zoom, w, h, left: snap(left, was.left), top: snap(top, was.top), eased: [left, top] });
    },
    reset() { S = null; },
  };
}

// The follow's state: feed it the player's velocity (m/s, world x and z) each frame; it returns the
// world offset to add to the focus point (look-ahead plus the room below)
export function follower() {
  const S = { lead: [0, 0], below: 0 };
  return {
    offset(vel, dt, screenDown) {
      const sp = Math.hypot(vel[0], vel[1]), want = leadFor(sp), dir = sp > 1e-3 ? [vel[0] / sp, vel[1] / sp] : [0, 0];
      for (let i = 0; i < 2; i++) { const tgt = dir[i] * want, rate = Math.abs(tgt) > Math.abs(S.lead[i]) ? FOLLOW.lead.in : FOLLOW.lead.out; S.lead[i] += (tgt - S.lead[i]) * (1 - Math.exp(-rate * dt)); }
      const bw = sp > FOLLOW.lead.dead ? FOLLOW.below.m : 0, bt = bw > S.below ? FOLLOW.below.in : FOLLOW.below.out; S.below += (bw - S.below) * (1 - Math.exp(-dt * 3 / bt));
      return [S.lead[0] + screenDown[0] * S.below, S.lead[1] + screenDown[1] * S.below];
    },
    speed: (vel) => Math.hypot(vel[0], vel[1]),
  };
}
