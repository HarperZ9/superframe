// Glyph's raster on the GPU (WebGL2): the frame's cells (glyph, ink, ground, emission) go up as small
// textures, and one fragment pass draws every pixel: the cell's glyph from the atlas, ink over ground,
// glyph-shaped bloom and a warmer halation from emitting cells within a cell or two (the atlas's soft
// copy), and the optional phosphor stage. GPU time per frame from EXT_disjoint_timer_query_webgl2
// where the driver has it. The CPU raster (raster.mjs) stays the reference and the fallback.
//   const R = makeGpuRaster(canvas, atlas) || null; R.draw(frame) -> { gpuMs (last finished) }
// Original code.
const VS = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `#version 300 es
precision highp float; precision highp int;
uniform highp usampler2D uG; uniform sampler2D uFG, uBG, uEM, uAtlas, uSoft;
uniform ivec2 uGrid, uCell, uOrigin, uAtlasCols; uniform vec2 uScreen; uniform float uBloom, uHal; uniform int uCrt;
out vec4 o;
float glyphA(sampler2D A, uint g, ivec2 px, ivec2 size) { ivec2 at = ivec2(int(g) % uAtlasCols.x, int(g) / uAtlasCols.x) * size; return texelFetch(A, at + px, 0).r; }
void main() {
  ivec2 p = ivec2(int(gl_FragCoord.x), int(uScreen.y) - 1 - int(gl_FragCoord.y));
  ivec2 rel = p - uOrigin; ivec2 c = ivec2(floor(vec2(rel) / vec2(uCell))); ivec2 in_ = rel - c * uCell;
  vec3 col = vec3(14.0, 10.0, 14.0) / 255.0;
  if (c.x >= 0 && c.y >= 0 && c.x < uGrid.x && c.y < uGrid.y) {
    uint g = texelFetch(uG, c, 0).r; vec3 fg = texelFetch(uFG, c, 0).rgb, bg = texelFetch(uBG, c, 0).rgb;
    col = mix(bg, fg, glyphA(uAtlas, g, in_, uCell));
    // bloom and halation from emitting cells round this one (each soft glyph spans three cells)
    if (uBloom > 0.0 || uHal > 0.0) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      ivec2 n = c + ivec2(i, j); if (n.x < 0 || n.y < 0 || n.x >= uGrid.x || n.y >= uGrid.y) continue;
      float e = texelFetch(uEM, n, 0).r; if (e <= 0.0) continue;
      uint ng = texelFetch(uG, n, 0).r; ivec2 sp = in_ - ivec2(i, j) * uCell + uCell;   // this pixel inside the neighbour's 3 x 3 soft field
      float a = glyphA(uSoft, ng, sp, uCell * 3);
      vec3 nf = texelFetch(uFG, n, 0).rgb; col += e * a * (nf * uBloom + vec3(0.9, 0.42, 0.22) * uHal);
    }
  }
  if (uCrt == 1) { float sl = 0.8 + 0.2 * cos(6.2831853 * float(p.y) / 3.0); int t = p.x % 3; col *= sl * vec3(t == 0 ? 1.12 : 0.92, t == 1 ? 1.12 : 0.92, t == 2 ? 1.12 : 0.92); }
  o = vec4(col, 1.0);
}`;

export function makeGpuRaster(canvas, atlas) {
  const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }); if (!gl) return null;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  const tex = (unit, name) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); gl.uniform1i(U(name), unit); return t; };
  const tG = tex(0, "uG"), tFG = tex(1, "uFG"), tBG = tex(2, "uBG"), tEM = tex(3, "uEM"), tA = tex(4, "uAtlas"), tS = tex(5, "uSoft");
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  // the atlas: every glyph's alpha in a grid of cells, and the soft copies at three cells a side
  const cols = 32, n = atlas.n, cw = atlas.cw, ch = atlas.ch, rows = Math.ceil(n / cols);
  const A = new Uint8Array(cols * cw * rows * ch), Sf = new Uint8Array(cols * cw * 3 * rows * ch * 3), aw = cols * cw, sw = cols * cw * 3;
  for (let g = 0; g < n; g++) {
    const gx = (g % cols) * cw, gy = Math.floor(g / cols) * ch, a = atlas.alpha[g];
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) A[(gy + y) * aw + gx + x] = a[y * cw + x];
    const s = atlas.soft(g), sx = (g % cols) * cw * 3, sy = Math.floor(g / cols) * ch * 3;
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) Sf[(sy + y) * sw + sx + x] = Math.round(255 * Math.min(1, s.al[y * s.w + x]));
  }
  gl.activeTexture(gl.TEXTURE4); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, aw, rows * ch, 0, gl.RED, gl.UNSIGNED_BYTE, A);
  gl.activeTexture(gl.TEXTURE5); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, sw, rows * ch * 3, 0, gl.RED, gl.UNSIGNED_BYTE, Sf);
  gl.uniform2i(U("uAtlasCols"), cols, 0); gl.uniform2i(U("uCell"), cw, ch);
  const tq = gl.getExtension("EXT_disjoint_timer_query_webgl2"), queries = []; let gpuMs = null;
  const rgb3to4 = (src, m) => { const d = new Uint8Array(m * 4); for (let i = 0; i < m; i++) { d[i * 4] = src[i * 3]; d[i * 4 + 1] = src[i * 3 + 1]; d[i * 4 + 2] = src[i * 3 + 2]; d[i * 4 + 3] = 255; } return d; };
  return {
    gl, timer: !!tq,
    draw(f) {
      const { cols: gc, rows: gr, W, H } = f, m = gc * gr;
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      gl.viewport(0, 0, W, H);
      gl.activeTexture(gl.TEXTURE0); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16UI, gc, gr, 0, gl.RED_INTEGER, gl.UNSIGNED_SHORT, new Uint16Array(f.G.buffer, f.G.byteOffset, m));
      gl.activeTexture(gl.TEXTURE1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gc, gr, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgb3to4(f.FG, m));
      gl.activeTexture(gl.TEXTURE2); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gc, gr, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgb3to4(f.BG, m));
      gl.activeTexture(gl.TEXTURE3); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gc, gr, 0, gl.RED, gl.UNSIGNED_BYTE, f.EM);
      gl.uniform2i(U("uGrid"), gc, gr); gl.uniform2i(U("uOrigin"), f.ox, f.oy); gl.uniform2f(U("uScreen"), W, H);
      gl.uniform1f(U("uBloom"), f.bloom); gl.uniform1f(U("uHal"), f.halation); gl.uniform1i(U("uCrt"), f.crt ? 1 : 0);
      let q = null; if (tq) { q = gl.createQuery(); gl.beginQuery(tq.TIME_ELAPSED_EXT, q); }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (q) { gl.endQuery(tq.TIME_ELAPSED_EXT); queries.push(q); }
      while (queries.length && gl.getQueryParameter(queries[0], gl.QUERY_RESULT_AVAILABLE)) { const r = queries.shift(); if (!gl.getParameter(tq.GPU_DISJOINT_EXT)) gpuMs = gl.getQueryParameter(r, gl.QUERY_RESULT) / 1e6; gl.deleteQuery(r); }
      return { gpuMs };
    },
  };
}
