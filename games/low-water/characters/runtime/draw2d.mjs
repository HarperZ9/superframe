// Drawing an actor into the Canvas 2D prototype (game/main.mjs), in place of figures.mjs drawPerson.
// Browser only (ImageData). Same contract as drawPerson: hidden where the plate's world buffer
// stands in front; scaled by the plate camera at the actor's position.
//   drawActor(g, scratch, actor, { world, W, H, cam: place.info.camera, rig, tone, view })
// view { x0, y0, zoom }: the gameplay camera's window on the plate (plate pixels, whole numbers) and
// its zoom; screen = (plate - x0) * zoom. Without it the whole plate fills the screen.
// rig and tone: a place's light rig and ramp (characters/render/rigs.mjs).
export function drawActor(g, scratch, a, { world, W, H, cam, rig, tone = null, view = { x0: 0, y0: 0, zoom: 1 }, ss = 1 }) {
  const P = a.pos, c = [P[0], P[1] + 1.05, P[2]], [px, py, fz] = world.project(world.camera, W, H, c), z = view.zoom;
  const fx = (px - view.x0) * z, fy = (py - view.y0) * z;
  const ppm = (H / (2 * Math.tan(cam.fovY / 2) * fz)) * z, hM = 2.9, h = Math.ceil(hM * ppm), w = Math.ceil(h * 0.95);
  if (fx + w < 0 || fx - w > W || fy + h < 0 || fy - h > H) return null;   // off screen
  const r = a.render({ yawDeg: cam.yawDeg, elevDeg: cam.elevDeg, height: hM, centre: c }, w, h, rig, { ss, tone });
  const ox = Math.round(fx - r.w / 2), oy = Math.round(fy - r.h / 2), img = new ImageData(r.w, r.h), d = img.data, G = r.G, cp = world.camera.pos, cf = world.camera.fwd;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const i = y * r.w + x, sx = ox + x, sy = oy + y, al = r.rgba[i * 4 + 3];
    if (al <= 0 || sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
    const gi = (y * ss) * G.w + x * ss;
    {   // body pixels test their own depth; the outline outside the body tests the figure's centre depth
      const qx = Math.floor(view.x0 + sx / z), qy = Math.floor(view.y0 + sy / z);
      const dz = G.id[gi] ? (G.wp[gi * 3] - cp[0]) * cf[0] + (G.wp[gi * 3 + 1] - cp[1]) * cf[1] + (G.wp[gi * 3 + 2] - cp[2]) * cf[2] : fz;
      if (qx >= 0 && qy >= 0 && qx < W && qy < H && world.depth[qy * W + qx] < dz - 0.35) continue;
    }
    for (let k = 0; k < 3; k++) d[i * 4 + k] = Math.round(Math.max(0, Math.min(1, r.rgba[i * 4 + k])) * 255);
    d[i * 4 + 3] = Math.round(al * 255);
  }
  scratch.width = r.w; scratch.height = r.h; scratch.getContext("2d").putImageData(img, 0, 0); g.drawImage(scratch, ox, oy);
  return { x: fx, y: fy, top: fy - h / 2 };
}
