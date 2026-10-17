// What the figure drawer reads from the painted plate under it: the plate's place.json, its geo
// buffer (the world point painted under each plate pixel) and the brightness of the painting, so a
// figure is exposed to the plate's own local light and its contact shadow lands only on the ground.
// Loaded once per plate from /content/<plate>/ (the files the plate camera reads); until loaded,
// plateCtx() returns null and the drawer falls back to its plain treatment.
//   const P = plateCtx(args)   args: the figure hook's { x, y, ppm, at, cam, plate, lights, darkness }
//   P.toPlate(sx, sy) -> [px, py]    P.pointAt(sx, sy) -> [x, y, z] | null
//   P.lumaStats(boxes, n, ground) -> { mid, hi, lit, n }   linear luminance of the painting over screen boxes
const cache = new Map();   // plate -> { pj, pos, luma: { variant -> Float32Array }, dark, loading }
const D2R = Math.PI / 180;
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const LIN = Float32Array.from({ length: 256 }, (_, i) => lin(i));

function project(cam, W, H, P) {   // as world/camera.mjs projectPlate (the plate's bake camera)
  const yaw = cam.yawDeg * D2R, el = cam.elevDeg * D2R, t = cam.target, dist = cam.dist;
  const f = [-Math.sin(yaw) * Math.cos(el), -Math.sin(el), -Math.cos(yaw) * Math.cos(el)];
  const rl = Math.hypot(f[2], f[0]), right = [-f[2] / rl, 0, f[0] / rl];
  const up = [right[1] * f[2] - right[2] * f[1], right[2] * f[0] - right[0] * f[2], right[0] * f[1] - right[1] * f[0]];
  const pos = [t[0] - f[0] * dist, t[1] - f[1] * dist, t[2] - f[2] * dist], r = [P[0] - pos[0], P[1] - pos[1], P[2] - pos[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], z = dot(r, f), asp = W / H, a = dot(r, right), b = dot(r, up);
  let u, v;
  if (cam.ortho) { u = a / ((cam.scale || 8) * asp); v = b / (cam.scale || 8); } else { const tt = Math.tan((cam.fovY || 0.5) / 2); u = a / (z * tt * asp); v = b / (z * tt); }
  return [((u + 1) / 2) * W - 0.5, ((1 - v) / 2) * H - 0.5];
}

async function lumaOf(url, gw, gh) {   // the painting's linear luminance at the geo buffer's resolution
  const im = new Image(); im.src = url; await im.decode();
  const c = new OffscreenCanvas(gw, gh), g = c.getContext("2d"); g.drawImage(im, 0, 0, gw, gh);
  const d = g.getImageData(0, 0, gw, gh).data, L = new Float32Array(gw * gh);
  for (let i = 0; i < L.length; i++) L[i] = 0.2126 * LIN[d[i * 4]] + 0.7152 * LIN[d[i * 4 + 1]] + 0.0722 * LIN[d[i * 4 + 2]];
  return L;
}

function load(plate) {
  const e = { pj: null, pos: null, luma: {}, dark: null, failed: false };
  cache.set(plate, e);
  (async () => {
    const base = `/content/${plate}/`;
    const r = await fetch(base + "place.json"); if (!r.ok) throw new Error(`place.json ${r.status}`);
    const pj = await r.json(), s = pj.geoScale || 1, gw = Math.round(pj.width * s), gh = Math.round(pj.height * s);
    const g = await fetch(base + "geo-pos.f32"); if (!g.ok) throw new Error(`geo-pos ${g.status}`);
    e.pos = new Float32Array(await g.arrayBuffer()); e.gw = gw; e.gh = gh; e.s = s;
    await Promise.all((pj.variants || []).map(async (v) => { e.luma[v] = await lumaOf(`${base}${v}.png`, gw, gh); }));
    if (pj.dark) e.dark = await lumaOf(`${base}dark.png`, gw, gh).catch((err) => { console.warn(`figures: no dark plate luminance for ${plate}: ${err.message}`); return null; });
    e.pj = pj;
  })().catch((err) => { e.failed = true; console.warn(`figures: plate ${plate} not read for lighting and shadows (${err.message})`); });
  return e;
}

export function plateCtx(args) {
  const { plate, at, x, y, ppm, lights, darkness = 0 } = args;
  if (!plate || !at || !ppm) return null;
  const e = cache.get(plate) || load(plate);
  if (!e.pj) return null;
  const pj = e.pj, cam = pj.camera, A = project(cam, pj.width, pj.height, at), B = project(cam, pj.width, pj.height, [at[0], at[1] + 1, at[2]]);
  const zoom = ppm / (Math.abs(A[1] - B[1]) || 1), left = A[0] - x / zoom, top = A[1] - y / zoom;
  // the variant shown is the one whose lights the hook passed
  const key = JSON.stringify(lights || []), variant = Object.keys(pj.lights || {}).find((k) => JSON.stringify(pj.lights[k]) === key) || (pj.variants || [])[0];
  const L = e.luma[variant], Ld = e.dark;
  const toPlate = (sx, sy) => [left + sx / zoom, top + sy / zoom];
  const gidx = (sx, sy) => { const gx = Math.floor((left + sx / zoom) * e.s), gy = Math.floor((top + sy / zoom) * e.s); return gx < 0 || gy < 0 || gx >= e.gw || gy >= e.gh ? -1 : gy * e.gw + gx; };
  function pointAt(sx, sy) {
    const i = gidx(sx, sy); if (i < 0) return null;
    const px = e.pos[i * 3], py = e.pos[i * 3 + 1], pz = e.pos[i * 3 + 2];
    return Number.isFinite(px) && Number.isFinite(py) && Number.isFinite(pz) && !(px === 0 && py === 0 && pz === 0) ? [px, py, pz] : null;
  }
  // linear luminance of the painting (blended toward the dark plate as the plate goes dark) over
  // screen boxes [x0, y0, x1, y1], sampled on a grid: the median and the 90th percentile
  // ground: { at, r } keeps only samples whose painted point is ground near the feet' height within r
  // metres of at (the floor the figure could be lit like, never a wall or a table top); then
  // the median, the 90th percentile and the median of the brightest third (lit)
  function lumaStats(boxes, n = 20, ground = null) {
    if (!L) return null;
    const v = [];
    for (const [x0, y0, x1, y1] of boxes) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      const sx = x0 + ((k + 0.5) / n) * (x1 - x0), sy = y0 + ((j + 0.5) / n) * (y1 - y0), i = gidx(sx, sy); if (i < 0) continue;
      if (ground) { const p = pointAt(sx, sy); if (!p || Math.abs(p[1] - ground.at[1]) > 0.2 || Math.hypot(p[0] - ground.at[0], p[2] - ground.at[2]) > ground.r) continue; }
      v.push(Ld && darkness > 0 ? L[i] * (1 - darkness) + Ld[i] * darkness : L[i]);
    }
    if (v.length < 8) return null;
    v.sort((a, b) => a - b);
    return { mid: v[Math.floor(v.length * 0.5)], hi: v[Math.floor(v.length * 0.9)], lit: v[Math.floor(v.length * 0.833)], n: v.length };
  }
  return { toPlate, pointAt, lumaStats, zoom };
}
