// The tilt-shift lens and its focus director (design/sensory/08-FOCUS.md), a port of raw-native's P23
// (raw/renderer/art_tiltshift.hpp lens, raw/renderer/focus_director.hpp; raw-native PR #211, where both are
// measured). Pure functions, no DOM: fx/tiltshift.mjs draws with them, fx/tests/focus.test.mjs checks them.
//   lensGeom(lens, cam, W, H)      -> geometry: the plane of focus tilted in the world (Scheimpflug)
//   cocAt(g, P)                    -> circle of confusion in plate pixels of world point P
//   LOOKS[name], lensOf(look, focus, axis)
//   new Director(character, baseLens, cam) .step(inputs, dt) -> state; .lens(); .geom(W, H)
// Units: world metres; the scene is seen as a model at 1:K (the miniature strength); dioptres in the lens's
// own scale (K / axial metres) where checks need them.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const rotate = (v, k, t) => { const kv = cross(k, v), c = Math.cos(t), s = Math.sin(t), kd = dot(k, v) * (1 - c); return [v[0] * c + kv[0] * s + k[0] * kd, v[1] * c + kv[1] * s + k[1] * kd, v[2] * c + kv[2] * s + k[2] * kd]; };

// The plate camera's basis (world/plateworld.mjs camBasis, repeated so this file stays free of imports).
export function camBasisOf(cam) {
  const yaw = (cam.yawDeg * Math.PI) / 180, el = (cam.elevDeg * Math.PI) / 180, t = cam.target, d = cam.dist;
  const f = norm([-Math.sin(yaw) * Math.cos(el), -Math.sin(el), -Math.cos(yaw) * Math.cos(el)]), right = norm(cross(f, [0, 1, 0]));
  return { f, right, up: norm(cross(right, f)), pos: [t[0] - f[0] * d, t[1] - f[1] * d, t[2] - f[2] * d] };
}

// Looks: the lens settings of raw-native's tiltLook (art_tiltshift.cpp), the starting values to tune.
export const LOOKS = {
  daily: { K: 8, fNumber: 2.0, tiltDeg: 70, rollDeg: 0, streetAxis: false },
  town_map: { K: 40, fNumber: 1.4, tiltDeg: 90, rollDeg: 0, streetAxis: true },
  record: { K: 40, fNumber: 1.4, tiltDeg: 90, rollDeg: 0, streetAxis: true },
  memory: { K: 12, fNumber: 2.0, tiltDeg: 75, rollDeg: 0, streetAxis: false },
  dream: { K: 60, fNumber: 1.2, tiltDeg: 20, rollDeg: 35, streetAxis: false },
  night: { K: 20, fNumber: 1.8, tiltDeg: 80, rollDeg: 0, streetAxis: true },
};
export const lensOf = (look, focus, axis = [1, 0, 0]) => ({ focus, axis: look.streetAxis ? axis : null, tiltDeg: look.tiltDeg, rollDeg: look.rollDeg, K: look.K, fNumber: look.fNumber, unitMm: 1000, cMax1080: 48 });

// cam: place.json's camera ({ yawDeg, elevDeg, target, dist, fovY, ortho }); W, H: the plate in pixels. Plates
// draw one plate pixel to one screen pixel at 1080 lines, so the CoC cap follows the view (viewH), not the plate.
// An orthographic plate has no focal length: a nominal 0.3 rad lens sets the scale (the look's K tunes it).
export function lensGeom(l, cam, W, H, viewH = H) {
  const B = camBasisOf(cam), up = [0, 1, 0], fov = cam.ortho ? 0.3 : (cam.fovY || 0.5);
  let a = l.axis ? norm([l.axis[0], 0, l.axis[2]]) : B.right;
  if (l.rollDeg) a = norm(rotate(a, B.f, (l.rollDeg * Math.PI) / 180));
  const across = norm(cross(up, a)), t = (l.tiltDeg * Math.PI) / 180, u = [across[0] * Math.cos(t), across[1] * Math.cos(t) + Math.sin(t), across[2] * Math.cos(t)];
  const n = norm(cross(a, u));
  return { eye: B.pos, fwd: B.f, n, d: dot(n, l.focus), fpx: (0.5 * H) / Math.tan(0.5 * fov), fmm: 12 / Math.tan(0.5 * fov), mmPerUnit: l.unitMm / l.K, N: l.fNumber, cMax: (l.cMax1080 * viewH) / 1080, ortho: !!cam.ortho };
}

// The thin-lens CoC (pixels) of world point P against the tilted plane, as raw::art::cocAt: the in-focus
// distance is where P's view ray meets the plane, both measured along the view axis.
export function cocAt(g, P, cMax = g.cMax) {
  const r = sub(P, g.eye), z = dot(r, g.fwd);
  if (z <= 1e-6) return 0;
  const dir = g.ortho ? g.fwd : norm(r), o = g.ortho ? [P[0] - g.fwd[0] * z, P[1] - g.fwd[1] * z, P[2] - g.fwd[2] * z] : g.eye;
  const dn = dot(dir, g.n), tPlane = Math.abs(dn) > 1e-12 ? (g.d - dot(o, g.n)) / dn : -1, cosA = g.ortho ? 1 : dot(dir, g.fwd);
  const Z = z * g.mmPerUnit;
  const c = tPlane <= 0 ? (g.fpx * g.fmm) / (g.N * Z) : (() => { const S = Math.max(tPlane * cosA * g.mmPerUnit, 2 * g.fmm); return (g.fpx * g.fmm * Math.abs(Z - S)) / (g.N * Z * (S - g.fmm)); })();
  return Math.min(c, cMax);
}

export const CHARACTERS = {
  naturalist: { omega: 8, idle: 6, dwell: 3.5, eventHold: 2.5, eventMin: 0.5, jitterD: 0, jitterHz: 0, scan: false, aperture: 1 },
  accuser: { omega: 14, idle: 3, dwell: 1.5, eventHold: 1.2, eventMin: 0.3, jitterD: 0, jitterHz: 0, scan: true, aperture: 1 },
  child: { omega: 10, idle: 2.5, dwell: 1.2, eventHold: 1.5, eventMin: 0.2, jitterD: 0.08, jitterHz: 0.4, scan: false, aperture: 0.7 },
};

// A critically damped spring with an analytic step; on a new target it keeps only velocity toward it, at
// most w |e|, so every rack is monotone (no pumping). zeta < 1 is the underdamped control.
class Spring {
  constructor() { this.x = 0; this.v = 0; this.target = 0; }
  retarget(t, w) { this.target = t; const e = this.x - t; if (this.v * e >= 0) this.v = 0; else if (Math.abs(this.v) > w * Math.abs(e)) this.v = -w * e; }
  advance(dt, w, zeta = 1) {
    const e = this.x - this.target;
    if (zeta >= 1) { const k = Math.exp(-w * dt), q = this.v + w * e; this.x = this.target + (e + q * dt) * k; this.v = (this.v - w * q * dt) * k; return; }
    const wd = w * Math.sqrt(1 - zeta * zeta), k = Math.exp(-zeta * w * dt), c = Math.cos(wd * dt), s = Math.sin(wd * dt);
    this.x = this.target + k * (e * c + ((this.v + zeta * w * e) / wd) * s); this.v = k * (this.v * c - ((zeta * w * this.v + w * w * e) / wd) * s);
  }
  cut() { this.x = this.target; this.v = 0; }
}

const LOCKED = new Set(["talk", "fight", "examine"]);
// inputs: { intent: walk|talk|examine|fight|dream, player, speaker, prop, fighters: [P], living: [{ p, id, salience }],
//           events: [{ p, kind, salience }], playerMoving, reducedMotion, tension (0..1, narrows the wedge) }
export class Director {
  constructor(character, base, cam) {
    this.cp = CHARACTERS[character] || CHARACTERS.naturalist; this.base = { ...base, fNumber: base.fNumber * this.cp.aperture }; this.cam = cam;
    this.B = camBasisOf(cam); this.sD = new Spring(); this.sT = new Spring(); this.sN = new Spring();
    this.s = { dioptre: 0, rack: 0, tiltDeg: base.tiltDeg, focus: base.focus, target: "", targetPoint: base.focus, fNumber: base.fNumber, racking: false };
    this.time = 0; this.idleT = 0; this.dwellT = 0; this.eventT = 0; this.mode = 0; this.next = 0; this.ev = null; this.first = true; this.last = "walk";
    this.lockOff = false; this.damping = 1; this.jitterNow = 0;
  }
  axialOf(p) { return Math.max(1e-3, dot(sub(p, this.B.pos), this.B.f)); }
  aim(who, p) { const t = 1 / this.axialOf(p); if (who !== this.s.target || Math.abs(t - this.sD.target) > 1e-12) this.sD.retarget(t, this.cp.omega); this.s.target = who; this.s.targetPoint = p; }
  step(inp, dt) {
    const cp = this.cp, intent = inp.intent || "walk", calm = !!inp.reducedMotion, locked = !this.lockOff && LOCKED.has(intent);
    this.time += dt;
    if (this.first || intent !== this.last) { this.mode = 0; this.idleT = 0; this.next = 0; }
    let subject = inp.player, who = "player";
    if (intent === "talk" && inp.speaker) { subject = inp.speaker; who = "speaker"; }
    else if (intent === "examine" && inp.prop) { subject = inp.prop; who = "prop"; }
    else if (intent === "fight" && inp.fighters && inp.fighters.length) { subject = [0, 1, 2].map((k) => inp.fighters.reduce((s, f) => s + f[k], 0) / inp.fighters.length); who = "fight"; }
    const wander = !calm && !locked && (intent === "walk" || intent === "dream" || this.lockOff), living = inp.living || [];
    let ev = null;
    if (wander) for (const e of inp.events || []) if (e.salience >= cp.eventMin && (!ev || e.salience > ev.salience)) ev = e;
    if (ev) { this.mode = 2; this.eventT = cp.eventHold; this.ev = ev; }
    else if (this.mode === 2) { this.eventT -= dt; if (this.eventT <= 0 || !wander) { this.mode = 0; this.idleT = 0; } }
    if (!wander || inp.playerMoving) { if (this.mode === 1) this.mode = 0; this.idleT = 0; }
    else if (this.mode === 0 && living.length) { this.idleT += dt; if (this.idleT >= cp.idle) { this.mode = 1; this.dwellT = cp.dwell; this.next %= living.length; } }
    else if (this.mode === 1) {
      this.dwellT -= dt;
      if (this.dwellT <= 0) { this.next++; if (cp.scan && this.next < living.length) this.dwellT = cp.dwell; else { this.mode = 0; this.idleT = 0; if (cp.scan) this.next = 0; } }
    }
    if (this.mode === 1 && living.length) { const L = living[this.next % living.length]; this.aim(L.id, L.p); }
    else if (this.mode === 2 && this.ev) this.aim(`event:${this.ev.kind}`, this.ev.p);
    else this.aim(who, subject);
    this.sT.target = intent === "dream" ? this.base.tiltDeg - 45 : this.base.tiltDeg;
    // a fight stops the lens down until every fighter is sharp; tension opens it (the wedge narrows)
    let N = this.base.fNumber * (1 - 0.5 * Math.max(0, Math.min(1, inp.tension || 0)));
    if (intent === "fight" && inp.fighters && inp.fighters.length) {
      const ax = 1 / this.sD.target, f = this.B.f, axS = this.axialOf(subject), lat = sub(sub(subject, this.B.pos), [f[0] * axS, f[1] * axS, f[2] * axS]);
      const l = { ...this.base, focus: [this.B.pos[0] + lat[0] + f[0] * ax, this.B.pos[1] + lat[1] + f[1] * ax, this.B.pos[2] + lat[2] + f[2] * ax], cMax1080: 1e9 };
      const g = lensGeom(l, this.cam, 1080, 1080);
      let worst = 0; for (const p of inp.fighters) worst = Math.max(worst, cocAt(g, p, 1e9));
      N = this.base.fNumber * Math.max(1, worst / 0.9);
    }
    this.sN.target = Math.log(Math.min(N, 64));
    if (this.first || calm) { this.sD.cut(); this.sT.cut(); this.sN.cut(); }
    else { this.sD.advance(dt, cp.omega, this.damping); this.sT.advance(dt, cp.omega, this.damping); this.sN.advance(dt, cp.omega, this.damping); }
    this.jitterNow = cp.jitterD > 0 && wander ? cp.jitterD * this.sD.x * (0.7 * Math.sin(2 * Math.PI * cp.jitterHz * this.time) + 0.3 * Math.sin(2 * Math.PI * 0.23 * this.time + 1)) : 0;
    const s = this.s;
    s.dioptre = this.sD.x + this.jitterNow; s.rack = this.sD.x; s.tiltDeg = this.sT.x; s.fNumber = Math.exp(this.sN.x);
    s.racking = Math.abs(this.sD.x - this.sD.target) > 1e-6 * Math.abs(this.sD.target) || Math.abs(this.sN.x - this.sN.target) > 1e-6 || Math.abs(this.sT.x - this.sT.target) > 1e-6;
    const f = this.B.f, axP = this.axialOf(s.targetPoint), ax = 1 / s.dioptre, lat = sub(sub(s.targetPoint, this.B.pos), [f[0] * axP, f[1] * axP, f[2] * axP]);
    s.focus = [this.B.pos[0] + lat[0] + f[0] * ax, this.B.pos[1] + lat[1] + f[1] * ax, this.B.pos[2] + lat[2] + f[2] * ax];
    this.first = false; this.last = intent;
    return s;
  }
  lens() { return { ...this.base, focus: this.s.focus, tiltDeg: this.s.tiltDeg, fNumber: this.s.fNumber }; }
  geom(W, H, viewH = H) { return lensGeom(this.lens(), this.cam, W, H, viewH); }
}
