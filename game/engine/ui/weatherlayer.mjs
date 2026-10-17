// The night over the plate, as the prototype laid it (game/look.mjs, retired): the tide's water,
// fog that takes the far and low things first (sodium-lit near the lamps, cold elsewhere, paper
// white in a blackout), rain streaks, Mother's beam when she burns, and the lights mirrored in the
// water. One canvas between the plate and the people. Water and fog are worked out per plate
// sample from the geo buffers (world/plateworld.mjs) into a field at the geo buffers' size, and
// only when the tide, the fog or the blackout has moved enough to show; the rest is drawn per
// frame. Plates without a datum (rooms, the hill) take no water.
//   const L = weatherLayer(ctx, host, cam); L.stop()
import { h } from "./dom.mjs";
import { camBasis } from "../world/plateworld.mjs";
import { projectPlate } from "../world/camera.mjs";

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const FOG_LIT = [0.62, 0.4, 0.17], FOG_COLD = [0.24, 0.22, 0.3], FOG_PAPER = [0.86, 0.83, 0.77];

export function weatherLayer(ctx, host, cam) {
  const G = ctx.G, canvas = h("canvas.weathercanvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
  host.append(canvas);
  const S = { field: null, key: "", plate: null, raf: 0, stopped: false, t: 0, last: performance.now() };
  const term = (k) => { try { return G.env.term(k, G.state.place); } catch (e) { return 0; } };

  function waterY(pj) { return pj && pj.datum ? pj.datum.a + pj.datum.b * (+term("tide") || 0) : -Infinity; }
  // the water and fog field at the geo buffers' size, premultiplied into an ImageData
  function build(pj, geo, wy, fog, fade) {
    const s = pj.geoScale || 1, gw = Math.round(pj.width * s), gh = Math.round(pj.height * s), P = geo.pos, B = camBasis(pj.camera);
    const c = (S.field && S.field.width === gw && S.field.height === gh) ? S.field : new OffscreenCanvas(gw, gh);
    const img = new ImageData(gw, gh), o = img.data;
    const lamps = ((pj.marks || {}).lamps || []).filter((l) => l.kind === "sodium").map((l) => projectPlate(pj.camera, gw, gh, l.at));
    const sodiumOn = 1 - fade, fogK = fog * 0.9, glowR = 260 * (gw / 1280); // the prototype's glow radius, at this plate's size
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const i = y * gw + x, px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
      if (!Number.isFinite(py)) continue;
      let r = 0, g = 0, b = 0, a = 0;
      if (py < wy) { // the tide: black and slick, deeper darker
        const dpt = clamp((wy - py) * 8), k = 0.55 + 0.4 * dpt;
        r = 0.045 * k; g = 0.07 * k; b = 0.11 * k; a = k;
        const above = y > 0 ? P[(i - gw) * 3 + 1] : py;
        if (!(above < wy)) { r += 0.12; g += 0.11; b += 0.1; a = Math.max(a, 0.5); } // a pale line where the water stops
      }
      if (fogK > 0) {
        const dep = (px - B.pos[0]) * B.f[0] + (py - B.pos[1]) * B.f[1] + (pz - B.pos[2]) * B.f[2];
        const far = clamp((dep - pj.camera.dist + 18) / 40), low = clamp(Math.exp(-(py + 3.4) / 7));
        const f = clamp(fogK * 13 * (0.3 + 0.7 * far) * (0.4 + 0.6 * low)) * 0.85;
        let gl = 0; for (const L of lamps) { const d = Math.hypot(x - L[0], (y - L[1]) * 1.3) / glowR; if (d < 1) gl = Math.max(gl, (1 - d) * (1 - d)); }
        gl *= sodiumOn;
        const fr = FOG_PAPER[0] * fade + (FOG_COLD[0] * (1 - gl) + FOG_LIT[0] * gl) * (1 - fade), fg = FOG_PAPER[1] * fade + (FOG_COLD[1] * (1 - gl) + FOG_LIT[1] * gl) * (1 - fade), fb = FOG_PAPER[2] * fade + (FOG_COLD[2] * (1 - gl) + FOG_LIT[2] * gl) * (1 - fade);
        r = r * (1 - f) + fr * f; g = g * (1 - f) + fg * f; b = b * (1 - f) + fb * f; a = a + f * (1 - a);
      }
      if (a <= 0) continue;
      const j = i * 4; o[j] = clamp(r / a) * 255; o[j + 1] = clamp(g / a) * 255; o[j + 2] = clamp(b / a) * 255; o[j + 3] = clamp(a) * 255;
    }
    c.getContext("2d").putImageData(img, 0, 0);
    return c;
  }
  function mirrors(g, pj, wy, fade, view) {
    const lights = [...((pj.lights && pj.lights[(cam.area() && cam.area().variant) || pj.variants[0]]) || [])].filter((L) => !(L.kind === "sodium" && fade > 0.5));
    g.save(); g.globalCompositeOperation = "lighter";
    for (const L of lights) {
      if (L.at[1] < wy) continue;
      const m = cam.toScreen([L.at[0], 2 * wy - L.at[1], L.at[2]]), top = cam.toScreen([L.at[0], wy, L.at[2]]); if (!m || !top) continue;
      const y = (m[1] + top[1]) / 2, under = cam.pointAt(m[0], y); if (!under || under[1] >= wy) continue; // only where the water is
      const hh = Math.min(26 * view.zoom, Math.max(14, Math.abs(m[1] - top[1]) * 0.8)), w = 4 * view.zoom, k = Math.min(1, (L.I || 1) * 0.35) * (0.55 + 0.45 * Math.sin(S.t * 1.7 + L.at[0]));
      const c = L.kind === "sodium" ? "255,150,60" : "255,200,120";
      const grd = g.createRadialGradient(m[0], y, 0, m[0], y, hh); grd.addColorStop(0, `rgba(${c},${0.45 * k})`); grd.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = grd; g.beginPath(); g.ellipse(m[0], y, w, hh, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  function rain(g, W, H, rate, fade) {
    if (rate <= 0.05) return;
    const n = Math.floor(Math.min(1, rate / 2) * 420), slant = -0.25;
    g.save(); g.lineWidth = 1;
    for (let k = 0; k < n; k++) {
      const hx = Math.abs((Math.sin(k * 12.9898 + 7) * 43758.5453) % 1), hy = Math.abs((Math.sin(k * 78.233 + 7) * 12543.12) % 1), sp = 0.9 + 0.4 * hx;
      const x = ((hx * W + S.t * 60 * slant * sp) % W + W) % W, y = ((hy * H + S.t * 900 * sp) % H + H) % H, len = 14 + 10 * hy, lit = fade > 0.5 ? 0.3 : 0.08 + 0.2 * Math.abs(Math.sin(k));
      g.strokeStyle = fade > 0.5 ? `rgba(230,225,214,${lit})` : `rgba(255,190,110,${lit})`;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + slant * len, y + len); g.stroke();
    }
    g.restore();
  }
  function beam(g, pj, fog) {
    const L = ((pj.marks || {}).lamps || []).find((l) => l.kind === "beam"); if (!L) return;
    const s = cam.toScreen(L.at); if (!s) return;
    const [hx, hy] = s, a = S.t * 0.35, len = 1400;
    g.save(); g.globalCompositeOperation = "lighter";
    for (const sg of [-1, 1]) {
      const ang = a + (sg > 0 ? 0 : Math.PI), spread = 0.1, k = 0.55 + 3 * fog, grd = g.createRadialGradient(hx, hy, 10, hx, hy, len);
      grd.addColorStop(0, `rgba(235,255,225,${0.55 * k})`); grd.addColorStop(0.35, `rgba(200,255,200,${0.18 * k})`); grd.addColorStop(1, "rgba(160,220,160,0)");
      g.fillStyle = grd; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + Math.cos(ang - spread) * len, hy + Math.sin(ang - spread) * len * 0.45); g.lineTo(hx + Math.cos(ang + spread) * len, hy + Math.sin(ang + spread) * len * 0.45); g.closePath(); g.fill();
    }
    const hg = g.createRadialGradient(hx, hy, 2, hx, hy, 70); hg.addColorStop(0, "rgba(240,255,230,0.95)"); hg.addColorStop(0.3, "rgba(150,255,140,0.5)"); hg.addColorStop(1, "rgba(80,200,80,0)");
    g.fillStyle = hg; g.beginPath(); g.arc(hx, hy, 70, 0, Math.PI * 2); g.fill(); g.restore();
  }
  function frame(now) {
    if (S.stopped) return;
    const dt = Math.min(0.1, (now - S.last) / 1000); S.last = now; S.t += dt;
    const r = host.getBoundingClientRect(); if (canvas.width !== Math.round(r.width) || canvas.height !== Math.round(r.height)) { canvas.width = Math.round(r.width); canvas.height = Math.round(r.height); }
    const g = canvas.getContext("2d"); g.clearRect(0, 0, canvas.width, canvas.height);
    const pj = cam.place(), geo = cam.geo(), view = cam.frameNow();
    if (cam.ready() && pj && geo && view) {
      const wy = waterY(pj), fog = +term("fog") || 0, fade = cam.darkness ? cam.darkness() : 0;
      const key = `${pj.place}|${Math.round(wy * 100)}|${Math.round(fog * 200)}|${Math.round(fade * 4)}`;
      if (key !== S.key) { S.key = key; S.field = build(pj, geo, wy, fog, fade); }
      const s = 1 / (pj.geoScale || 1);
      g.save(); g.imageSmoothingEnabled = true; g.setTransform(view.zoom * s, 0, 0, view.zoom * s, -view.left * view.zoom, -view.top * view.zoom); g.drawImage(S.field, 0, 0); g.restore();
      if (pj.datum) mirrors(g, pj, wy, fade, view);
      if (term("mother") === "burning") beam(g, pj, fog);
      const place = G.book.places[G.state.place] || {};
      if (!(place.shelter || place.stove)) rain(g, canvas.width, canvas.height, +term("rain") || 0, fade);
    }
    S.raf = requestAnimationFrame(frame);
  }
  S.raf = requestAnimationFrame(frame);
  return { canvas, stop() { S.stopped = true; cancelAnimationFrame(S.raf); canvas.remove(); } };
}
