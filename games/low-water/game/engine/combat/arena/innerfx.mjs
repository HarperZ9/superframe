// Smoke, debris and the weight of blows in the inner arena (the Trafalgar paintings, references 26 to 29: smoke
// as a mass, things torn loose, flashes). Values into the 640 x 360 buffer, under the care limits of
// design/sensory/05-CARE.md section 2: nothing here flickers; the one bright thing a blow makes is small (well
// under 1/16 of the frame), short, and at most one every half second; a morph is a change of look (03-SURREAL
// rule 9), so its burst is dust and darkness, never light. inner-capture's F5 measures all of it.
//   smokeBank(V, g)   puffs(V, g)   debris(V, g)   bursts(V, g)   fxEvents(V, ev)
// The rising puffs are the engine's own smoke field (game/engine/paint/smoke.mjs), fed the room's sources.
import { smokeField } from "../../paint/smoke.mjs";
import { gray, hash } from "./innerstage.mjs";

const IW = 640, S = 30, TILT = 0.62;
const noise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), tx = x - xi, ty = y - yi, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy; };

// a bank of smoke at the foot of the building, rolling slowly: a low-resolution field drawn soft over the plinth and
// the back of the floor (its lit side toward the shaft's source)
export function smokeBank(V, g) {
  const G = V.stage, w = 80, h = 16, c = (V.bankC ||= new OffscreenCanvas(w, h)), cg = c.getContext("2d"), img = cg.createImageData(w, h), t = V.t * 0.004;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = 0.6 * noise(x * 0.18 + t, y * 0.35 - t * 0.3) + 0.4 * noise(x * 0.45 - t * 1.7, y * 0.8), fall = Math.sin((y / (h - 1)) * Math.PI);
    const near = Math.max(0, 1 - Math.abs(x / w * IW - G.src[0]) / 280), v = 0.1 + 0.32 * near * n, a = Math.max(0, n - 0.35) * 1.5 * fall;
    const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(v * 255); img.data[i + 3] = Math.round(Math.min(0.85, a) * 255);
  }
  cg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.drawImage(c, -20, G.yWall - 58, IW + 40, 84); g.imageSmoothingEnabled = false;
}

// the rising puffs from the room's sources (the engine's smoke field: puffs swell, drift and thin)
export function puffs(V, g) {
  const st = V.stage.st, F = (V.smoke ||= smokeField(7));
  const pj = { place: V.W.field.arena.name, marks: { smoke: (st.smoke || []).map(([x, z]) => ({ at: [x, 0.2, z], k: 1 })) } };
  F.step(pj, "inner", 1 / 60, 0.12);
  for (const q of F.puffs) {
    const [x, y] = V.proj(q.p[0], q.p[2], q.p[1]), r = q.r * S * 1.6, a = Math.min(0.5, q.d * 0.55);
    if (a < 0.02) continue;
    const lit = Math.max(0, 1 - Math.abs(x - V.stage.src[0]) / 300), grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, gray(0.12 + 0.3 * lit, a)); grd.addColorStop(1, gray(0.12 + 0.3 * lit, 0));
    g.fillStyle = grd; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
}

// what drifts in the air: sheets, dust, ash, snow, grain, shards; fixed by index, falling slowly and wrapping
const DEBRIS = { paper: [26, 0.25, 3, 2, 0.62], dust: [30, 0.05, 1, 1, 0.5], ash: [40, 0.1, 1, 1, 0.42], snow: [60, 0.35, 1, 1, 0.75], grain: [36, 0.18, 1, 1, 0.5], shards: [30, 0.2, 2, 1, 0.7] };
export function debris(V, g) {
  const st = V.stage.st, [n, fall, w, h, v] = DEBRIS[st.debris] || DEBRIS.dust, still = st.shaft.still;
  for (let i = 0; i < n; i++) {
    const t = still ? 0 : V.t, x = (hash(i, 1) * IW + Math.sin(t * 0.008 + i) * 12 + t * 0.05 * (hash(i, 4) - 0.3)) % IW, y = (hash(i, 2) * 360 + t * fall * (0.5 + hash(i, 3))) % 360;
    const tum = st.debris === "paper" ? ((t >> 3) + i) % 3 : 0;
    g.fillStyle = gray(v * (0.6 + 0.4 * hash(i, 5)), 0.75); g.fillRect(x | 0, y | 0, tum === 1 ? 1 : w, tum === 2 ? 1 : h);
  }
}

// a blow's weight: chips torn loose and a dust burst at the contact; a heavy blow also a short glow, at most one every
// 30 frames, sized so it changes a 1/16 window by well under 0.1 of full luminance (05-CARE section 2, WCAG's wording;
// ?innerfx=glow leaves it out). A morph throws a ring of dust across the floor from the boss, dark, never a light.
export function fxEvents(V, ev) {
  const W = V.W, B = (V.bursts ||= []);
  for (const e of ev) {
    if (e.type === "hit" || e.type === "block" || e.type === "parry") {
      const T = W.byId(e.id); if (!T) continue; const big = e.type !== "hit" || e.dmg >= 1.5, y = W.defs[T.id].height * 0.55;
      B.push({ kind: "dust", x: T.x, z: T.z, life: 50, max: 50, r: big ? 1.2 : 0.8 });
      for (let k = 0; k < (big ? 10 : 5); k++) B.push({ kind: "chip", x: T.x, z: T.z, y, vx: (hash(V.t, k) - 0.5) * 0.12, vz: (hash(k, V.t) - 0.5) * 0.06, vy: 0.04 + 0.06 * hash(V.t, k, 2), life: 34, max: 34 });
      if (big && V.t - (V.lastGlow || -99) >= 30 && !V.off.has("glow")) { V.lastGlow = V.t; B.push({ kind: "glow", x: T.x, z: T.z, y, life: 4, max: 4 }); }
    }
    if (e.type === "morph") { const T = W.byId("boss"); if (T) B.push({ kind: "ring", x: T.x, z: T.z, life: 60, max: 60 }); }
  }
}

export function bursts(V, g) {
  V.bursts = (V.bursts || []).filter((b) => b.life-- > 0);
  for (const b of V.bursts) {
    const u = 1 - b.life / b.max;
    if (b.kind === "dust") { const [x, y] = V.proj(b.x, b.z, 0.3 + u * 0.5), r = b.r * S * (0.5 + u); g.fillStyle = gray(0.3, 0.3 * Math.sin(u * Math.PI)); g.beginPath(); g.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2); g.fill(); }
    if (b.kind === "chip") { b.x += b.vx; b.z += b.vz; b.y = Math.max(0, b.y + b.vy); b.vy -= 0.006; const [x, y] = V.proj(b.x, b.z, b.y); g.fillStyle = gray(0.06); g.fillRect(x | 0, y | 0, 2, 2); }
    if (b.kind === "glow") { const [x, y] = V.proj(b.x, b.z, b.y), grd = g.createRadialGradient(x, y, 0, x, y, 34); grd.addColorStop(0, `rgba(255,240,215,${(0.7 * (1 - u)).toFixed(3)})`); grd.addColorStop(1, "rgba(255,240,215,0)"); g.fillStyle = grd; g.fillRect(x - 34, y - 34, 68, 68); }
    if (b.kind === "ring") { const [x, y] = V.proj(b.x, b.z), r = 20 + u * 260; g.strokeStyle = gray(0.2, 0.4 * (1 - u)); g.lineWidth = 10 * (1 - u) + 2; g.beginPath(); g.ellipse(x, y, r, r * TILT, 0, 0, Math.PI * 2); g.stroke(); }
  }
}
