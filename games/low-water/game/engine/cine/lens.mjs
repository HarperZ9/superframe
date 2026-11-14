// The tilt-shift lens for a cinematic: the play screen's lens (fx/tiltshift.mjs, raw-native P23's port) with its own
// WebGL canvas, fed a plate, its world positions and a lens geometry each frame instead of the play screen's camera.
// The same shaders: where a plate pixel's circle of confusion passes 1 px it is repainted coarser (a sector
// Kuwahara), never blurred. The output is premultiplied, drawn over the plate.
//   const L = cineLens(); L.place(key, img, pj, pos); L.draw(view, geom) -> canvas | null; L.stats
import { VS, FS1, FS2, tables, program } from "../fx/tiltshift.mjs";

export function cineLens() {
  const cv = document.createElement("canvas"), stats = { ms: 0, renders: 0, error: "" };
  const gl = cv.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true });
  if (!gl) { stats.error = "no WebGL2"; return { place() {}, draw: () => null, stats }; }
  let P1, P2;
  try { P1 = program(gl, FS1); P2 = program(gl, FS2); } catch (e) { stats.error = String(e.message || e); console.warn(`cine lens: ${stats.error}`); return { place() {}, draw: () => null, stats }; }
  const T = tables(), quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const tex = (filter) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, filter], [gl.TEXTURE_MAG_FILTER, filter], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
  const plateT = tex(gl.NEAREST), geoT = tex(gl.NEAREST), coarseT = tex(gl.LINEAR), fb = gl.createFramebuffer();
  let cur = null;

  // a plate: its colour (an image) and its world positions (Float32Array of x, y, z at geoScale)
  function place(key, img, pj, pos) {
    if (cur && cur.key === key) return;
    const s = pj.geoScale || 1, gw = Math.round(pj.width * s), gh = Math.round(pj.height * s), rgba = new Float32Array(gw * gh * 4);
    for (let i = 0; i < gw * gh; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], hit = Number.isFinite(x + y + z) && !(x === 0 && y === 0 && z === 0) && y < 999;
      rgba[i * 4] = hit ? x : 0; rgba[i * 4 + 1] = hit ? y : 0; rgba[i * 4 + 2] = hit ? z : 0; rgba[i * 4 + 3] = hit ? 1 : 0;
    }
    gl.bindTexture(gl.TEXTURE_2D, geoT); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, gw, gh, 0, gl.RGBA, gl.FLOAT, rgba);
    gl.bindTexture(gl.TEXTURE_2D, plateT); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
    cur = { key, pj, w: img.naturalWidth || img.width, h: img.naturalHeight || img.height };
  }

  const draw4 = (p) => { const a = gl.getAttribLocation(p, "a"); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
  function uniforms(p, g, rx, ry) {
    const u = (n) => gl.getUniformLocation(p, n);
    gl.uniform3fv(u("eye"), g.eye); gl.uniform3fv(u("fwd"), g.fwd); gl.uniform3fv(u("pn"), g.n);
    gl.uniform1f(u("pd"), g.d); gl.uniform1f(u("fpx"), g.fpx); gl.uniform1f(u("fmm"), g.fmm); gl.uniform1f(u("mmu"), g.mmPerUnit); gl.uniform1f(u("fN"), g.N);
    gl.uniform1f(u("cMax"), g.cMax); gl.uniform1f(u("ortho"), g.ortho ? 1 : 0); gl.uniform1f(u("geoScale"), cur.pj.geoScale || 1); gl.uniform2f(u("org"), rx, ry);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, geoT); gl.uniform1i(u("geo"), 1);
  }
  // view: { left, top, w, h, zoom } in plate pixels; geom: fx/focus.mjs lensGeom for the plate. Returns the canvas,
  // whose pixel (0, 0) is plate pixel (rx, ry) = canvas.dataset; the caller scales it by the view's zoom.
  function draw(view, geom) {
    if (!cur) return null;
    const t0 = performance.now(), pj = cur.pj, m = 32, sc = cur.w / pj.width;
    const rx = Math.max(0, Math.floor(view.left) - m), ry = Math.max(0, Math.floor(view.top) - m);
    const rw = Math.max(1, Math.min(pj.width - rx, Math.ceil(view.w) + 2 * m)), rh = Math.max(1, Math.min(pj.height - ry, Math.ceil(view.h) + 2 * m));
    if (cv.width !== rw || cv.height !== rh) { cv.width = rw; cv.height = rh; }
    const hw = Math.ceil(rw / 2), hh = Math.ceil(rh / 2), g = { ...geom, cMax: 48 / Math.max(1, view.zoom) };
    gl.bindTexture(gl.TEXTURE_2D, coarseT); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, hw, hh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.useProgram(P1); uniforms(P1, g, rx, ry);
    gl.uniform2f(gl.getUniformLocation(P1, "half_"), hw, hh); gl.uniform2f(gl.getUniformLocation(P1, "plateSize"), cur.w, cur.h);
    gl.uniform2fv(gl.getUniformLocation(P1, "disc"), T.disc); gl.uniform4fv(gl.getUniformLocation(P1, "wk4"), T.wk); gl.uniform1f(gl.getUniformLocation(P1, "plateScale"), sc);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, plateT); gl.uniform1i(gl.getUniformLocation(P1, "plate"), 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, coarseT, 0); gl.viewport(0, 0, hw, hh); draw4(P1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, rw, rh);
    gl.useProgram(P2); uniforms(P2, g, rx, ry); gl.uniform2f(gl.getUniformLocation(P2, "size"), rw, rh);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, coarseT); gl.uniform1i(gl.getUniformLocation(P2, "coarse"), 0);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); draw4(P2);
    cv.dataset.rx = rx; cv.dataset.ry = ry;
    stats.ms = +(performance.now() - t0).toFixed(2); stats.renders++;
    return cv;
  }
  return { place, draw, stats };
}
