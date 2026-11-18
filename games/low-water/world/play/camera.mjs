// The camera: four ways of looking at the island, and a blend between any two of them that never
// cuts. Engine-free: it reads the body, the animator's root, the input and the solids, and writes
// a pose that any host turns into a view matrix.
//   nav     free flight for exploring and building: faster the higher it flies, never under the
//           ground or inside a wall
//   follow  a spring arm over the shoulder: it leaves room ahead of the walker, gives way to walls,
//           roofs and the ground, and in open country slowly draws back until the figure is small
//   first   the walker's eyes: the step's rise and fall, the arms in view, nothing clipped
//   iso     the 2D game's fixed three-quarter angle (yaw 26, down 30; design/CAMERA.md and the fight
//           drawer), orthographic, a person about 134 px tall in a 1080-line view at zoom 1, walls
//           between it and the walker cut away
// A pose is { target, yaw, pitch, dist, fov (degrees), ortho (bool), near }: the eye stands `dist`
// behind `target` along the view. Two poses blend in that form, so the subject stays framed while
// one becomes the other; perspective turns into orthographic by a dolly zoom (the field narrows to
// 3 degrees while the eye draws back) and the switch to a true orthographic view comes at the end.
import { clamp, damp, dampAngle, lerp, lerpAngle, smooth, forward, heading, wrap } from "./math.mjs";

export const MODES = ["nav", "follow", "first", "iso"];
const ISO = { yaw: 26 * Math.PI / 180, pitch: -30 * Math.PI / 180, half: 7.25, fov: 3 };
const BLEND_S = 0.9, R2D = 180 / Math.PI, D2R = Math.PI / 180;

export function makeCamera({ solids, ground, mode = "follow", yaw = 0, pitch = -0.1 } = {}) {
  const st = {
    mode, from: null, w: 1,                                     // the blend: from-pose and its weight
    nav: { p: [0, 30, 0], v: [0, 0, 0], yaw, pitch },
    follow: { yaw, pitch: -0.12, arm: 3.8, lead: [0, 0], open: 0, idle: 0, pivot: null },
    first: { yaw, pitch: 0 },
    iso: { zoom: 1, turn: 0, target: null },
    pose: null, collide: true, hits: 0,
  };
  const eyeOf = (P) => { const f = forward(P.yaw, P.pitch); return [P.target[0] - f[0] * P.dist, P.target[1] - f[1] * P.dist, P.target[2] - f[2] * P.dist]; };
  // push a point out of every solid and up off the ground, to `pad` metres clear
  function clear(p, pad) {
    for (let i = 0; i < 6; i++) {
      const d = solids ? solids.sdfSolids(p) : 1e9;
      if (d >= pad) break;
      const e = 0.05, g = [solids.sdfSolids([p[0] + e, p[1], p[2]]) - solids.sdfSolids([p[0] - e, p[1], p[2]]), solids.sdfSolids([p[0], p[1] + e, p[2]]) - solids.sdfSolids([p[0], p[1] - e, p[2]]), solids.sdfSolids([p[0], p[1], p[2] + e]) - solids.sdfSolids([p[0], p[1], p[2] - e])], l = Math.hypot(...g) || 1;
      for (let k = 0; k < 3; k++) p[k] += (g[k] / l) * (pad - d + 0.01);
    }
    p[1] = Math.max(p[1], ground(p[0], p[2]) + pad);
    return p;
  }

  function navPose(dt, inp) {
    const N = st.nav;
    N.yaw = wrap(N.yaw + inp.look[0]); N.pitch = clamp(N.pitch - inp.look[1], -1.5, 1.5);
    const agl = Math.max(0, N.p[1] - ground(N.p[0], N.p[2])), v = (inp.fast ? 6 : 1) * 9 * Math.max(1, agl / 12);
    const f = forward(N.yaw, N.pitch), r = [Math.cos(N.yaw), 0, Math.sin(N.yaw)], m = inp.move;
    const want = [(f[0] * -m[1] + r[0] * m[0]) * v, (f[1] * -m[1] + (inp.rise || 0)) * v, (f[2] * -m[1] + r[2] * m[0]) * v];
    for (let k = 0; k < 3; k++) { N.v[k] = damp(N.v[k], want[k], 0.18, dt); N.p[k] += N.v[k] * dt; }
    // the floor: a metre and a half over the ground, and out of anything built
    const floor = ground(N.p[0], N.p[2]) + 1.5;
    if (N.p[1] < floor) { N.p[1] = floor; N.v[1] = Math.max(0, N.v[1]); }
    clear(N.p, 0.5);
    return { target: N.p.slice(), yaw: N.yaw, pitch: N.pitch, dist: 0, fov: 60, ortho: false, near: 0.3 };
  }

  function followPose(dt, inp, body) {
    const F = st.follow, looking = Math.abs(inp.look[0]) + Math.abs(inp.look[1]) > 1e-5;
    F.yaw = wrap(F.yaw + inp.look[0]); F.pitch = clamp(F.pitch - inp.look[1], -1.2, 0.75);
    F.idle = looking ? 0 : F.idle + dt;
    // after a while without the mouse, the arm swings in behind a walker who keeps going
    if (F.idle > 1.6 && body.speed > 0.8) F.yaw = dampAngle(F.yaw, heading(body.vx, body.vz), 1.6, dt);
    // room ahead: the frame leads the walk by about a third of a second
    F.lead[0] = damp(F.lead[0], body.vx * 0.35, 0.5, dt); F.lead[1] = damp(F.lead[1], body.vz * 0.35, 0.5, dt);
    // open country: no solid within 16 m and the walker on the move; the arm draws back over ten
    // seconds, holds while the walker stands, and comes in over two and a half once walls are near
    const crowd = solids ? solids.near(body.x, body.z, 16, []).length : 0, open = crowd === 0 && body.speed > 0.6;
    F.open = clamp(F.open + (open ? dt / 10 : crowd > 0 ? -dt / 2.5 : 0), 0, 1);
    const pull = smooth(F.open), r = [Math.cos(F.yaw), 0, Math.sin(F.yaw)];
    const shoulder = lerp(0.42, 0.15, pull), pivot = [body.x + F.lead[0] + r[0] * shoulder, body.y + 1.55 + pull * 0.6, body.z + F.lead[1] + r[2] * shoulder];
    F.pivot = F.pivot ? F.pivot.map((v, k) => damp(v, pivot[k], k === 1 ? 0.12 : 0.05, dt)) : pivot;
    const want = lerp(3.8, 15, pull), pitch = F.pitch - pull * 0.14, f = forward(F.yaw, pitch);
    let reach = want;
    if (st.collide && solids) {
      // the arm gives way at once and comes back slowly: never inside a wall, never a jitter
      const end = [F.pivot[0] - f[0] * want, F.pivot[1] - f[1] * want, F.pivot[2] - f[2] * want];
      const t = solids.castSphere(F.pivot, end, 0.3);
      reach = Math.max(0.12, want * t - 0.05);
      if (t < 1) st.hits++;
    }
    F.arm = reach < F.arm ? reach : damp(F.arm, reach, 0.45, dt);
    return { target: F.pivot.slice(), yaw: F.yaw, pitch, dist: F.arm, fov: 55 - pull * 6, ortho: false, near: 0.2 };
  }

  function firstPose(dt, inp, body, anim) {
    const P = st.first;
    P.yaw = wrap(P.yaw + inp.look[0]); P.pitch = clamp(P.pitch - inp.look[1], -1.35, 1.35);
    // the eyes: above the neck, a hand ahead of it; the step's rise and fall from the stride's phase
    const u = anim ? anim.phase : 0, mv = anim ? anim.moving : 0, run = clamp((body.speed - 1.9) / 1.6, 0, 1), A = lerp(0.028, 0.055, run) * mv;
    const neck = anim ? anim.neck : [body.x, body.y + 1.6, body.z], f = forward(P.yaw, 0), r = [Math.cos(P.yaw), 0, Math.sin(P.yaw)];
    const bob = -A * (1 + Math.cos(4 * Math.PI * u)) / 2, sway = Math.sin(2 * Math.PI * u) * A * 0.45;
    const eye = [neck[0] + f[0] * 0.13 + r[0] * sway, neck[1] + 0.13 + bob, neck[2] + f[2] * 0.13 + r[2] * sway];
    if (st.collide && solids) clear(eye, 0.12);
    return { target: eye, yaw: P.yaw, pitch: P.pitch, dist: 0, fov: 68, ortho: false, near: 0.05, roll: Math.sin(2 * Math.PI * u) * 0.006 * mv };
  }

  function isoPose(dt, inp, body) {
    const I = st.iso;
    I.zoom = clamp(I.zoom * Math.pow(1.15, inp.zoom || 0), 0.4, 5);
    if (inp.turnIso) I.turn = (I.turn + inp.turnIso) % 4;
    const goal = [body.x + body.vx * 0.25, body.y + 1.0, body.z + body.vz * 0.25];
    I.target = I.target ? I.target.map((v, k) => damp(v, goal[k], 0.14, dt)) : goal;
    const half = ISO.half * I.zoom, fov = ISO.fov;
    return { target: I.target.slice(), yaw: wrap(ISO.yaw + I.turn * Math.PI / 2), pitch: ISO.pitch, dist: half / Math.tan(fov * D2R / 2), fov, ortho: true, half, near: 1 };
  }

  // blend two poses in framing space
  function blend(a, b, w) {
    if (w >= 1) return b; if (w <= 0) return a;
    const ha = Math.max(0.05, a.dist) * Math.tan(a.fov * D2R / 2), hb = Math.max(0.05, b.dist) * Math.tan(b.fov * D2R / 2);
    const fov = Math.exp(lerp(Math.log(a.fov), Math.log(b.fov), w)), half = Math.exp(lerp(Math.log(ha), Math.log(hb), w));
    const dist = (a.dist < 0.05 && b.dist < 0.05) ? 0 : half / Math.tan(fov * D2R / 2);
    return { target: a.target.map((v, k) => lerp(v, b.target[k], w)), yaw: lerpAngle(a.yaw, b.yaw, w), pitch: lerp(a.pitch, b.pitch, w), dist, fov, ortho: false, near: Math.min(a.near, b.near), roll: lerp(a.roll || 0, b.roll || 0, w) };
  }

  function setMode(m) {
    if (!MODES.includes(m) || m === st.mode) return;
    const cur = st.pose;
    if (cur) {
      // the from-pose is held as it was; a mode taken up starts from where the camera is
      st.from = cur.ortho ? { ...cur, ortho: false } : cur;
      const eye = eyeOf(cur);
      if (m === "nav") Object.assign(st.nav, { p: eye, v: [0, 0, 0], yaw: cur.yaw, pitch: cur.pitch });
      if (m === "follow") { st.follow.yaw = cur.yaw; st.follow.pitch = clamp(cur.pitch, -1.2, 0.75); }
      if (m === "first") { st.first.yaw = cur.yaw; st.first.pitch = clamp(cur.pitch, -1.35, 1.35); }
      st.w = 0;
    }
    st.mode = m;
  }

  // inp: { look: [dyaw, dpitch] radians, move: [x, y] (stick: x right, y back), rise, fast, zoom, turnIso }
  function update(dt, inp, body, anim) {
    const live = { nav: () => navPose(dt, inp, body), follow: () => followPose(dt, inp, body), first: () => firstPose(dt, inp, body, anim), iso: () => isoPose(dt, inp, body) };
    // the walker's own camera keeps its place while another is in use, so going back is no jump
    if (st.mode !== "follow") followPose(dt, { ...inp, look: [0, 0] }, body);
    let P = live[st.mode]();
    if (st.w < 1 && st.from) {
      st.w = Math.min(1, st.w + dt / BLEND_S);
      const k = smooth(st.w), to = P.ortho ? { ...P, ortho: false } : P;
      P = blend(st.from, to, k);
      if (st.w >= 1) { P = st.mode === "iso" ? { ...to, ortho: true } : to; st.from = null; }
      // on the way between, the eye may not pass through a wall
      else if (st.collide && solids && P.dist > 0.05) { const eye = clear(eyeOf(P), 0.2), f = forward(P.yaw, P.pitch); P.dist = Math.max(0, (P.target[0] - eye[0]) * f[0] + (P.target[1] - eye[1]) * f[1] + (P.target[2] - eye[2]) * f[2]); }
    }
    st.pose = P;
    const eye = eyeOf(P), f = forward(P.yaw, P.pitch);
    // where the world should be detailed and lit from: the walker, except when flying free
    const focus = st.mode === "nav" ? eye : [body.x, body.y + 1.6, body.z];
    return {
      mode: st.mode, blending: st.w < 1, eye, yaw: P.yaw, pitch: P.pitch, roll: P.roll || 0, fov: P.fov, near: P.near, ortho: P.ortho ? P.half : 0,
      // fog and light are reckoned from a point near the subject, so a far orthographic eye sees the same air
      fogEye: P.ortho ? [P.target[0] - f[0] * 16 * st.iso.zoom, P.target[1] - f[1] * 16 * st.iso.zoom, P.target[2] - f[2] * 16 * st.iso.zoom] : eye,
      focus, target: P.target,
      // what the iso cut-away keeps clear: the walker, seen from this eye
      cut: st.mode === "iso" ? { at: [body.x, body.y + 1.0, body.z], radius: 2.4 * Math.max(1, st.iso.zoom * 0.7), share: P.ortho ? 1 : smooth(st.w) } : null,
      moveYaw: st.mode === "first" ? st.first.yaw : P.yaw,
    };
  }
  return { state: st, update, setMode, cycle: () => setMode(MODES[(MODES.indexOf(st.mode) + 1) % MODES.length]), eyeOf };
}
export { R2D };
