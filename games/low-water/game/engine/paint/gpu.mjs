// The brush painter's per-pixel stages on the GPU (WebGL2), with the CPU painter (painter.mjs) as the
// reference and the fallback. Two passes per stroke layer:
//   membership  each figure pixel's stroke: the topmost stroke (by paint order) of the eight cells round its
//               bind point whose tapered ellipse holds it, or, in a ground coat, the nearest (strokes.mjs
//               strokeAt, the same hashes in 32-bit unsigned arithmetic). Out: key, u, v, m per pixel, read back
//               so the CPU can average each stroke's pixels and choose its paint (a few hundred strokes).
//   lay         each pixel's paint laid over what is there in pigment space (Kubelka-Munk), with the
//               bristle texture and the drawer's own value kept a little inside the stroke; the result stays
//               on the GPU between layers and is read back once at the end.
// Directions fixed at a stroke's birth (painter.mjs a.dirs) are uploaded as an open-addressed table.
// Float32 on the GPU against float64 on the CPU: a pixel on a stroke's very edge can fall to a neighbour,
// so GPU and CPU images agree within a tolerance, not byte for byte (paint/tools/gpuverify.mjs measures it).
// Original code.
//   const gpu = makePaintGpu(); if (gpu) { gpu.begin(w, h, pos4); const mem = gpu.membership(...); ... gpu.lay(...); gpu.end() }
const VS = `#version 300 es
in vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }`;
const HASH = `
uint hash4(int a, int b, int c, int d) {
  uint h = (uint(a) * 0x8da6b343u) ^ (uint(b) * 0xd8163841u) ^ (uint(c) * 0xcb1ab31fu) ^ (uint(d) * 0x165667b1u);
  h = (h ^ (h >> 15u)) * 0x2c1b3c6du; h = (h ^ (h >> 12u)) * 0x297a2d39u; return h ^ (h >> 15u);
}
float U(uint h, uint k) { uint x = (h ^ (k * 0x9e3779b9u)) * 0x85ebca6bu; x ^= x >> 13u; x *= 0xc2b2ae35u; x ^= x >> 16u; return float(x) / 4294967296.0; }`;
const MEMBER = `#version 300 es
precision highp float; precision highp int; precision highp usampler2D;
uniform highp sampler2D uPos;   // xyz bind point, w material id (0: not a figure pixel)
uniform highp sampler2D uLut;   // per id: x group, y flow, z slot at this level (-1 not painted, 1 ground coat, 2 partial)
uniform usampler2D uDirs;       // birth directions: x key, yzw direction bits; open addressing, uDirsN slots
uniform int uDirsN, uDirsW, uLayer, uBug;
uniform float uS;
out uvec4 o;
${HASH}
const float HALF_LEN = 0.85, HALF_WID = 0.36;
vec3 dirOf(uint h, vec3 C, float flow) {
  if (uDirsN > 0) {
    uint m = uint(uDirsN - 1); uint i = h & m;
    for (int p = 0; p < 64; p++) { uvec4 e = texelFetch(uDirs, ivec2(int(i) % uDirsW, int(i) / uDirsW), 0); if (e.x == h && e.x != 0u) return vec3(uintBitsToFloat(e.y), uintBitsToFloat(e.z), uintBitsToFloat(e.w)); if (e.x == 0u) break; i = (i + 1u) & m; }
  }
  float r = length(C.xz); if (r == 0.0) r = 1.0;
  float ax = -C.z / r, az = C.x / r, lean = (U(h, 4u) - 0.5) * 0.9;
  vec3 d = vec3(ax * (1.0 - flow) + (U(h, 5u) - 0.5) * 0.5 * flow, flow + lean * (1.0 - flow) * 0.6, az * (1.0 - flow) + (U(h, 6u) - 0.5) * 0.5 * flow);
  float l = length(d); return l > 0.0 ? d / l : d;
}
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy); vec4 P = texelFetch(uPos, px, 0);
  if (P.w < 0.5) { o = uvec4(0u, 0u, 0u, floatBitsToUint(-10.0)); return; }
  vec4 lut = texelFetch(uLut, ivec2(int(P.w + 0.5), 0), 0); int slot = int(floor(lut.z + 0.5));
  if (slot < 0) { o = uvec4(0u, 0u, 0u, floatBitsToUint(-10.0)); return; }
  int g = uLayer * 131 + int(lut.x + 0.5); float flow = lut.y, s = uS;
  int bi = int(floor(P.x / s - 0.5)), bj = int(floor(P.y / s - 0.5)), bk = int(floor(P.z / s - 0.5));
  uint best = 0u, near = 0u; bool hasBest = false; float bestM = 0.0, bestOrd = -1.0, bu = 0.0, bv = 0.0, nearM = -1e9, nu = 0.0, nv = 0.0;
  for (int n = 0; n < 8; n++) {
    int i = bi + (n & 1), j = bj + ((n >> 1) & 1), k = bk + ((n >> 2) & 1); uint h = hash4(i, j, k, g);
    vec3 C = vec3((float(i) + 0.5 + (U(h, 1u) - 0.5) * 0.8) * s, (float(j) + 0.5 + (U(h, 2u) - 0.5) * 0.8) * s, (float(k) + 0.5 + (U(h, 3u) - 0.5) * 0.8) * s);
    vec3 D = dirOf(h, C, flow);
    float L = s * HALF_LEN * (0.8 + 0.5 * U(h, 7u)), w = s * HALF_WID * (0.8 + 0.4 * U(h, 8u)), ord = U(h, 9u);
    vec3 q = P.xyz - C; float along = dot(q, D), u = along / L; vec3 pp = q - along * D; float taper = 1.0 - 0.45 * u * u;
    float v = length(pp) / (w * (taper > 0.2 ? taper : 0.2)), m = 1.0 - u * u - v * v;
    bool above = uBug == 1 ? (ord < bestOrd || bestOrd < 0.0) : ord > bestOrd;   // uBug: the stroke-order control (paint order reversed)
    if (m > 0.0 && above) { best = h; hasBest = true; bestOrd = ord; bestM = m; bu = u; bv = v; }
    if (m > nearM) { near = h; nearM = m; nu = u; nv = v; }
  }
  if (hasBest) o = uvec4(best, floatBitsToUint(bu), floatBitsToUint(bv), floatBitsToUint(bestM));
  else if (slot == 1) o = uvec4(near, floatBitsToUint(nu), floatBitsToUint(nv), floatBitsToUint(0.0));
  else o = uvec4(0u, 0u, 0u, floatBitsToUint(-9.0));   // a partial layer with no stroke over the pixel
}`;

export function makePaintGpu() {
  let cv, gl;
  try { cv = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1) : document.createElement("canvas"); gl = cv.getContext("webgl2", { antialias: false, preserveDrawingBuffer: false }); } catch { gl = null; }
  if (!gl || !gl.getExtension("EXT_color_buffer_float")) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`paint gpu: ${gl.getShaderInfoLog(s)}`); return s; };
  const prog = (fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, "a"); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`paint gpu: ${gl.getProgramInfoLog(p)}`); return p; };
  let member;
  try { member = prog(MEMBER); } catch (e) { console.warn(e.message); return null; }
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const tex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
  const tPos = tex(), tLut = tex(), tDirs = tex(), tOut = tex(), fb = gl.createFramebuffer();
  const U = (name) => gl.getUniformLocation(member, name), uni = Object.fromEntries(["uPos", "uLut", "uDirs", "uDirsN", "uDirsW", "uLayer", "uBug", "uS"].map((n) => [n, U(n)]));
  let W = 0, H = 0, outSize = "";
  const lutData = new Float32Array(256 * 4);
  return {
    gl, bug: 0,
    // a figure's bind points and materials (pos4: x, y, z, id per pixel, row 0 first)
    begin(w, h, pos4) {
      W = w; H = h; gl.bindTexture(gl.TEXTURE_2D, tPos); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, pos4);
      if (outSize !== `${w}x${h}`) { gl.bindTexture(gl.TEXTURE_2D, tOut); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32UI, w, h, 0, gl.RGBA_INTEGER, gl.UNSIGNED_INT, null); outSize = `${w}x${h}`; gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tOut, 0); }
    },
    // the birth directions of one figure (a Map key -> [x, y, z]) as a table; returns the slot count used
    dirs(map) {
      let n = 1; while (n < map.size * 2 + 2) n <<= 1; const w = Math.min(n, 2048), hh = Math.ceil(n / w), buf = new Uint32Array(w * hh * 4), fl = new Float32Array(1), fu = new Uint32Array(fl.buffer);
      for (const [k, d] of map) { if (!k) continue; let i = k & (n - 1); while (buf[i * 4]) i = (i + 1) & (n - 1); buf[i * 4] = k; fl[0] = d[0]; buf[i * 4 + 1] = fu[0]; fl[0] = d[1]; buf[i * 4 + 2] = fu[0]; fl[0] = d[2]; buf[i * 4 + 3] = fu[0]; }
      gl.bindTexture(gl.TEXTURE_2D, tDirs); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32UI, w, hh, 0, gl.RGBA_INTEGER, gl.UNSIGNED_INT, buf);
      this.dirsN = map.size ? n : 0; this.dirsW = w; return n;
    },
    // one layer's membership: per id the group, flow and slot (-1, 1, 2); out: Uint32Array w*h*4 (key, u, v, m bits)
    membership(L, s, groupOf, flowOf, slotOf, out) {
      for (let id = 0; id < 256; id++) { lutData[id * 4] = groupOf[id]; lutData[id * 4 + 1] = flowOf[id]; lutData[id * 4 + 2] = slotOf[id]; }
      gl.bindTexture(gl.TEXTURE_2D, tLut); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 256, 1, 0, gl.RGBA, gl.FLOAT, lutData);
      gl.useProgram(member); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, W, H);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tPos); gl.uniform1i(uni.uPos, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tLut); gl.uniform1i(uni.uLut, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tDirs); gl.uniform1i(uni.uDirs, 2);
      gl.uniform1i(uni.uDirsN, this.dirsN || 0); gl.uniform1i(uni.uDirsW, this.dirsW || 1); gl.uniform1i(uni.uLayer, L); gl.uniform1i(uni.uBug, this.bug | 0); gl.uniform1f(uni.uS, s);
      gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      const o = out && out.length === W * H * 4 ? out : new Uint32Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA_INTEGER, gl.UNSIGNED_INT, o);
      return o;
    },
  };
}
