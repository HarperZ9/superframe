// Glyph's effects, in type: rain as glyph particles falling in world space (hidden behind nearer
// cells), wet ground mirroring the lamps as dimmed glyph streaks below them. Bloom, halation and the
// phosphor stage are the raster's. Original code.
//   const fx = makeEffects(atlas); fx.before(scene, grid, out, o); fx.after(scene, grid, out, o)
import { projectPlate } from "../../world/camera.mjs";

export function makeEffects(atlas) {
  let drops = null, last = performance.now();
  const rnd = (() => { let s = 2463534242; return () => ((s ^= s << 13), (s ^= s >>> 17), (s ^= s << 5), (s >>> 0) / 4294967296); })();
  return {
    // wet ground: each lamp mirrored about the ground under it, a short streak of dim glyphs below
    before(scene, grid, out, o) {
      const { C, cols, rows, ox, oy, cw, ch, z, left, top } = grid, pj = C.pj, wet = (scene.terms.rain || 0) > 0.1;
      for (const L of scene.lightsPlace || []) {
        if (L.group === "window" || L.group === "candle") continue;
        const s = projectPlate(pj.camera, pj.width, pj.height, L.at), sx = (s[0] - left) * z, sy = (s[1] - top) * z;
        const g = projectPlate(pj.camera, pj.width, pj.height, [L.at[0], 0, L.at[2]]), gy = (g[1] - top) * z, len = Math.max(ch * 2, (gy - sy) * 0.9);
        for (let k = 0; k < len / ch; k++) {
          const x = Math.floor((sx - ox) / cw), y = Math.floor((gy + k * ch * 0.9 - oy) / ch); if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const I = grid.I0 + x, J = grid.J0 + y; if (I < 0 || J < 0 || I >= C.nI || J >= C.nJ) continue;
          const c = J * C.nI + I, kind = scene.kinds[C.k1[c]]; if (!kind || !(kind.flags || "").includes("r") || C.N[c * 3 + 1] < 0.85 || (!wet && !["pool", "mud", "weed", "sand"].includes(kind.name))) continue;
          const oi = y * cols + x, fade = 1 - k / (len / ch); out.G[oi] = atlas.index(k % 2 ? "|" : "!"); out.FG[oi * 3] = Math.max(out.FG[oi * 3], 230 * fade); out.FG[oi * 3 + 1] = Math.max(out.FG[oi * 3 + 1], 150 * fade); out.FG[oi * 3 + 2] = Math.max(out.FG[oi * 3 + 2], 70 * fade);
        }
      }
    },
    // rain: drops in world space over the view, falling and slanting with the wind
    after(scene, grid, out, o) {
      const rain = scene.terms.rain || 0, now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (rain <= 0.05) { drops = null; return; }
      const { C, cols, rows, ox, oy, cw, ch, z, left, top } = grid, pj = C.pj, want = Math.floor(Math.min(1, rain / 2) * 900);
      // drops live in screen-relative world: spawned over the view, each a world point with a fall speed
      drops ||= []; while (drops.length < want) drops.push({ x: rnd(), y: rnd(), v: 0.7 + 0.6 * rnd() });
      drops.length = want;
      const wind = scene.terms.wind || 0.2;
      for (const d of drops) {
        d.y += dt * d.v * 0.9; d.x += dt * wind * 0.08; if (d.y > 1) { d.y -= 1; d.x = rnd(); } if (d.x > 1) d.x -= 1;
        const x = Math.floor(d.x * cols), y = Math.floor(d.y * rows); if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const oi = y * cols + x; if (out.EM[oi]) continue;
        out.G[oi] = atlas.index(wind > 0.4 ? "/" : "|"); out.FG[oi * 3] = 150; out.FG[oi * 3 + 1] = 160; out.FG[oi * 3 + 2] = 185;
      }
      void C; void ox; void oy; void cw; void ch; void z; void left; void top; void pj;
    },
  };
}
