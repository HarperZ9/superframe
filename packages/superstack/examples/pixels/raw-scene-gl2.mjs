// SPDX-License-Identifier: MIT
// WebGL2 backend for a superstack.scene/1 document, in the plugin shape
// { id, version, backends, create } that the site's media engine mounts.
// Method differs from the reference on purpose: primary visibility is an
// analytic ray cast through each pixel centre, not a rasterizer. The AO
// estimator shares the reference's stateless hash and cosine hemisphere,
// so the two can be compared sample for sample.
import { getGL2, program, fullscreenTriangle, target } from './gl2.mjs';
import { triangles } from './scene_ir.mjs';

const FS = (T) => `#version 300 es
precision highp float; precision highp int;
uniform vec3 uV[${T * 3}]; uniform vec3 uN[${T}]; uniform vec3 uA[${T}];
uniform vec3 uEye, uS, uU, uF, uL; uniform float uTanH, uAspect, uAmb, uLi, uRadius, uOff;
uniform vec2 uSize; uniform int uMode, uSamples;
out vec4 o;
uint mixh(uint x, uint y, uint s){
  uint h = x*374761393u + y*668265263u + s*2246822519u;
  h = (h ^ (h >> 13u)) * 1274126177u; h ^= h >> 16u; return h; }
float hash01(uint x, uint y, uint s){ return float(mixh(x,y,s) & 0xFFFFFFu) / 16777216.0; }
bool tri(vec3 ro, vec3 rd, int i, out float t){
  vec3 a = uV[i*3], e1 = uV[i*3+1]-a, e2 = uV[i*3+2]-a;
  vec3 p = cross(rd, e2); float det = dot(e1, p);
  if (det > -1e-7 && det < 1e-7) return false;
  float inv = 1.0/det; vec3 tv = ro - a; float u = dot(tv, p)*inv;
  if (u < 0.0 || u > 1.0) return false;
  vec3 q = cross(tv, e1); float v = dot(rd, q)*inv;
  if (v < 0.0 || u+v > 1.0) return false;
  t = dot(e2, q)*inv; return t > 1e-4; }
void main(){
  uint px = uint(gl_FragCoord.x); uint py = uint(uSize.y) - 1u - uint(gl_FragCoord.y);
  vec2 ndc = vec2((float(px)+0.5)/uSize.x*2.0-1.0, 1.0-(float(py)+0.5)/uSize.y*2.0);
  vec3 rd = normalize(uF + uS*(ndc.x*uTanH*uAspect) + uU*(ndc.y*uTanH));
  float best = 1e30; int hit = -1;
  for (int i = 0; i < ${T}; ++i){ float t; if (tri(uEye, rd, i, t) && t < best){ best = t; hit = i; } }
  if (hit < 0){ o = vec4(0.0, 0.0, 0.0, 1.0); return; }
  if (uMode == 2){ o = vec4(1.0/255.0, 0.0, 0.0, 1.0); return; }
  vec3 P = uEye + rd*best, N = uN[hit];
  vec3 ax = abs(N.x) > 0.9 ? vec3(0,1,0) : vec3(1,0,0);
  vec3 T = normalize(cross(ax, N)), B = cross(N, T), ro = P + N*uOff;
  int open = 0;
  for (int s = 0; s < uSamples; ++s){
    float u1 = hash01(px, py, uint(2*s)), u2 = hash01(px, py, uint(2*s+1));
    float r = sqrt(u1), phi = 6.2831853*u2;
    vec3 d = normalize(T*(r*cos(phi)) + B*(r*sin(phi)) + N*sqrt(max(0.0, 1.0-u1)));
    bool occ = false;
    for (int i = 0; i < ${T}; ++i){ float t; if (tri(ro, d, i, t) && t < uRadius){ occ = true; break; } }
    if (!occ) open++;
  }
  if (uMode == 1){ o = vec4(float(open)/255.0, 0.0, 0.0, 1.0); return; }
  float ao = float(open)/float(uSamples);
  float lit = (uAmb + max(0.0, dot(N, -uL))*uLi) * ao;
  vec3 c = floor(clamp(uA[hit]*lit, 0.0, 1.0)*255.0 + 0.5);
  o = vec4(c/255.0, 1.0);
}`;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };

export const rawSceneGL2 = {
  id: 'superstack-raw-scene', version: '0.1.0', backends: ['webgl2'], static: true,
  create({ canvas, params }) {
    const scene = params.scene;
    const W = scene.frame.width, H = scene.frame.height;
    canvas.width = W; canvas.height = H;
    const gl = getGL2(canvas, { preserveDrawingBuffer: true });
    if (!gl) throw new Error('webgl2 unavailable');
    const geo = triangles(scene);
    const { prog, loc } = program(gl, FS(geo.count));
    const tri = fullscreenTriangle(gl);
    const rt = target(gl, W, H);
    const cam = scene.camera;
    const f = nrm(sub(cam.target, cam.eye)), s = nrm(crs(f, cam.up)), u = crs(s, f);
    const draw = (mode) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fb); gl.viewport(0, 0, W, H); gl.useProgram(prog);
      gl.uniform3fv(loc['uV[0]'], geo.verts); gl.uniform3fv(loc['uN[0]'], geo.normals); gl.uniform3fv(loc['uA[0]'], geo.albedo);
      gl.uniform3fv(loc.uEye, cam.eye); gl.uniform3fv(loc.uS, s); gl.uniform3fv(loc.uU, u); gl.uniform3fv(loc.uF, f);
      gl.uniform3fv(loc.uL, nrm(scene.lights[0].dir));
      gl.uniform1f(loc.uTanH, Math.tan(cam.fovy / 2)); gl.uniform1f(loc.uAspect, W / H);
      gl.uniform1f(loc.uAmb, scene.shade.ambient); gl.uniform1f(loc.uLi, scene.lights[0].intensity);
      gl.uniform1f(loc.uRadius, scene.ao.radius); gl.uniform1f(loc.uOff, scene.ao.origin_offset);
      gl.uniform2f(loc.uSize, W, H); gl.uniform1i(loc.uMode, mode); gl.uniform1i(loc.uSamples, scene.ao.samples);
      tri.draw();
      const px = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const flipped = new Uint8Array(W * H * 4); // GL rows run bottom-up
      for (let y = 0; y < H; y++) flipped.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
      return flipped;
    };
    return {
      frame() { draw(0); },
      readPixels() { return draw(0); },
      readChannel(name) { return draw({ frame: 0, ao: 1, mask: 2 }[name]); },
      info() {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        return dbg ? { renderer: gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL), vendor: gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) }
          : { renderer: gl.getParameter(gl.RENDERER), vendor: gl.getParameter(gl.VENDOR) };
      },
      dispose() { tri.dispose(); rt.dispose(); gl.deleteProgram(prog); },
    };
  },
};
