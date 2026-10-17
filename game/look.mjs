// The look at run time. The plates are baked by the engine's passes (sodium shading, paint-over
// painter, lens suite, dither lighting); this module lays the night over them as it changes:
// the blackout cross-fade from the painted plate to the dither plate, the rising water, fog that
// takes the far things first (sodium-lit near the lamps, paper white in a blackout), rain, Mother's
// beam when she burns, and the people. Canvas 2D on the CPU.
import { ID } from "./world.mjs";

let look_lights = [];
const SODIUM_ID = 19, WATERISH = new Set([ID.mud, ID.pool, ID.steps, ID.wall, ID.weed, ID.drowned, 31]);
export const LAMPS = [[-9.5, 4.35, -0.7], [-0.5, 4.65, -0.7], [7.5, 4.15, -0.7]];
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);

export function createLook({ W, H, night: nightImg, dark: darkImg, world, lights = [] }) {
  const out = new ImageData(W, H), N = nightImg.data, D = darkImg.data, glow = new Float32Array(W * H);
  look_lights = lights;
  // the sodium glow field: where the lamps light the air, the fog goes orange
  for (const L of LAMPS) {
    const [sx, sy] = world.project(world.camera, W, H, L), r = 260;
    for (let y = Math.max(0, Math.floor(sy - r)); y < Math.min(H, sy + r); y++) for (let x = Math.max(0, Math.floor(sx - r)); x < Math.min(W, sx + r); x++) {
      const d = Math.hypot(x - sx, (y - sy) * 1.3) / r; if (d < 1) glow[y * W + x] = Math.max(glow[y * W + x], (1 - d) * (1 - d));
    }
  }
  const look = { out, fade: 0, row: 0, state: null, ready: false };
  // where each light's mirror image falls on the water: the light reflected in the plane y = waterY
  look.mirrors = (waterY, fade) => look_lights.filter((L) => !(L.sodium && fade > 0.5)).map((L) => {
    const m = world.project(world.camera, W, H, [L.pos[0], 2 * waterY - L.pos[1], L.pos[2]]), top = world.project(world.camera, W, H, [L.pos[0], waterY, L.pos[2]]);
    return { x: m[0], y: (m[1] + top[1]) / 2, w: L.w || 4, h: Math.max(14, Math.abs(m[1] - top[1]) * 0.8), k: (L.k || 0.5) * 1.8, c: L.c || [1, 0.62, 0.22] };
  });
  // Recompute a band of rows toward the target state; call every frame. Returns true when a full
  // frame has been finished since the last call that returned true.
  look.update = (st, rows = H) => {
    if (!look.state || look.row === 0) look.state = { ...st, mirrors: look.mirrors(st.waterY, st.fade) };
    const s = look.state, o = out.data, P = world.pos, ids = world.ids, dep = world.depth;
    const fogK = s.fog * 0.9, sodiumOn = 1 - s.fade;
    const fogLit = [0.62, 0.4, 0.17], fogCold = [0.24, 0.22, 0.3], fogPaper = [0.86, 0.83, 0.77];
    const y1 = Math.min(H, look.row + rows);
    for (let y = look.row; y < y1; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, j = i * 4, id = ids[i], py = P[i * 3 + 1];
      let r = (N[j] * (1 - s.fade) + D[j] * s.fade) / 255, g = (N[j + 1] * (1 - s.fade) + D[j + 1] * s.fade) / 255, b = (N[j + 2] * (1 - s.fade) + D[j + 2] * s.fade) / 255;
      // the tide: water over the floor and up the steps, black and slick, holding a little lamp light
      const wet = WATERISH.has(id) && py < s.waterY;
      if (wet) {
        const dpt = clamp((s.waterY - py) * 8), rip = 0.5 + 0.5 * Math.sin(x * 0.09 + y * 1.3 + s.clock * 0.8 + Math.sin(y * 0.21) * 2);
        const k = 0.55 + 0.4 * dpt, sheen = 0.5 + 0.5 * rip;
        r = r * (1 - k) + (0.03 + 0.03 * sheen) * k; g = g * (1 - k) + (0.05 + 0.05 * sheen) * k; b = b * (1 - k) + (0.08 + 0.07 * sheen) * k;
        // the lights, mirrored in the water: a long broken streak under each one
        for (const L of s.mirrors) {
          const dx = (x - L.x) / L.w, dy = (y - L.y) / L.h; if (dx * dx > 9 || dy * dy > 9) continue;
          const e = Math.exp(-dx * dx - dy * dy * 0.5) * (0.55 + 0.45 * Math.sin(y * 0.8 + s.clock * 1.7 + L.x)) * L.k;
          r += e * L.c[0]; g += e * L.c[1]; b += e * L.c[2];
        }
        // a pale line where the water meets what it has not reached yet
        const above = y > 0 ? (y - 1) * W + x : i, pa = P[above * 3 + 1];
        if (!(WATERISH.has(ids[above]) && pa < s.waterY) && ids[above] !== 255) { const k2 = 0.5 + 0.3 * rip; r += 0.16 * k2; g += 0.15 * k2; b += 0.13 * k2; }
      }
      // fog: low and thick over the water, thinner up the hill, deeper with distance from the camera
      if (fogK > 0) {
        const far = id === 255 ? 1 : clamp((dep[i] - 52) / 40), low = id === 255 ? 0.6 : clamp(Math.exp(-(py + 3.4) / 7));
        const f = clamp(fogK * 13 * (0.3 + 0.7 * far) * (0.4 + 0.6 * low)) * 0.85;
        const gl = glow[i] * sodiumOn, fr = fogPaper[0] * s.fade + (fogCold[0] * (1 - gl) + fogLit[0] * gl) * (1 - s.fade), fg = fogPaper[1] * s.fade + (fogCold[1] * (1 - gl) + fogLit[1] * gl) * (1 - s.fade), fb = fogPaper[2] * s.fade + (fogCold[2] * (1 - gl) + fogLit[2] * gl) * (1 - s.fade);
        r = r * (1 - f) + fr * f; g = g * (1 - f) + fg * f; b = b * (1 - f) + fb * f;
      }
      // wet stone darkens and takes a sheen of lamp light
      if (s.wet > 0 && (id === ID.quay || id === ID.mole) ) { const k = 0.25 * s.wet; r *= 1 - k * 0.5; g *= 1 - k * 0.5; b *= 1 - k * 0.4; r += k * 0.35 * glow[i] * sodiumOn; g += k * 0.2 * glow[i] * sodiumOn; }
      // the vignette of the house look
      const u = x / W - 0.5, v = y / H - 0.5, vg = 1 - 0.55 * Math.pow(Math.min(1, (u * u + v * v) * 2.4), 1.5);
      o[j] = clamp(r * vg) * 255; o[j + 1] = clamp(g * vg) * 255; o[j + 2] = clamp(b * vg) * 255; o[j + 3] = 255;
    }
    look.row = y1 >= H ? 0 : y1;
    if (look.row === 0) { look.ready = true; return true; }
    return false;
  };
  return look;
}

// Rain: streaks that fall a little sideways in the wind, bright where the lamps catch them.
export function drawRain(g, W, H, { rate, wind, t, fade, seed = 7 }) {
  if (rate <= 0.05) return;
  const n = Math.floor(Math.min(1, rate / 2) * 420), slant = -0.25 * (wind || 0);
  g.save(); g.lineWidth = 1;
  for (let k = 0; k < n; k++) {
    const hx = (Math.sin(k * 12.9898 + seed) * 43758.5453) % 1, hy = (Math.sin(k * 78.233 + seed) * 12543.12) % 1, sp = 0.9 + 0.4 * Math.abs(hx);
    const x = ((Math.abs(hx) * W + t * 60 * slant * sp) % W + W) % W, y = ((Math.abs(hy) * H + t * 900 * sp) % H + H) % H, len = 14 + 10 * Math.abs(hy);
    const lit = fade > 0.5 ? 0.3 : 0.08 + 0.2 * Math.abs(Math.sin(k));
    g.strokeStyle = fade > 0.5 ? `rgba(230,225,214,${lit})` : `rgba(255,190,110,${lit})`;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + slant * len, y + len); g.stroke();
  }
  g.restore();
}

// Mother's beam, when she burns: a slow blade turning in the fog, green at its edges.
export function drawBeam(g, world, W, H, { t, fog, fade }) {
  const [hx, hy] = world.project(world.camera, W, H, [20.6, 11.2, -2.0]);
  const a = t * 0.35, len = 1400;
  g.save(); g.globalCompositeOperation = "lighter";
  for (const s of [-1, 1]) {
    const ang = a + (s > 0 ? 0 : Math.PI), spread = 0.1, k = 0.55 + 3 * fog;
    const grd = g.createRadialGradient(hx, hy, 10, hx, hy, len);
    grd.addColorStop(0, `rgba(235,255,225,${0.55 * k})`); grd.addColorStop(0.35, `rgba(200,255,200,${0.18 * k})`); grd.addColorStop(1, "rgba(160,220,160,0)");
    g.fillStyle = grd; g.beginPath(); g.moveTo(hx, hy);
    g.lineTo(hx + Math.cos(ang - spread) * len, hy + Math.sin(ang - spread) * len * 0.45); g.lineTo(hx + Math.cos(ang + spread) * len, hy + Math.sin(ang + spread) * len * 0.45); g.closePath(); g.fill();
  }
  const hg = g.createRadialGradient(hx, hy, 2, hx, hy, 70); hg.addColorStop(0, "rgba(240,255,230,0.95)"); hg.addColorStop(0.3, "rgba(150,255,140,0.5)"); hg.addColorStop(1, "rgba(80,200,80,0)");
  g.fillStyle = hg; g.beginPath(); g.arc(hx, hy, 70, 0, Math.PI * 2); g.fill();
  g.restore(); void fade;
}

