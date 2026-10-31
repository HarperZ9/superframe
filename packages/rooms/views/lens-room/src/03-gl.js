// ======================================================================= GL plumbing
const cv = $("gl");
const gl = cv.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
function fail(m) {
  $("err").hidden = false;
  $("err").textContent = m;
}
if (!gl || !gl.getExtension("EXT_color_buffer_float"))
  fail("This view needs WebGL2 with floating point targets, and this browser has neither enabled.");
const compileLog = [];
function prog(vs, fs, soft) {
  const p = gl.createProgram();
  const hs = [];
  for (const [t, s] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ]) {
    const h = gl.createShader(t);
    gl.shaderSource(h, s.trim());
    gl.compileShader(h);
    hs.push(h);
    gl.attachShader(p, h);
  }
  gl.bindAttribLocation(p, 0, "a");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = hs.map((h) => gl.getShaderInfoLog(h)).join("\n") + gl.getProgramInfoLog(p);
    console.error("shader build failed", log);
    if (soft) throw new Error(log);
    fail("Shader error:\n" + log);
    throw new Error(log);
  }
  return p;
}
const D = prog(VS, VIEWS_DS);
const vb = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vb);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
function tgt(w, h, fmt = gl.RGBA32F, ty = gl.FLOAT, base = gl.RGBA) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, base, ty, null);
  for (const [a, b] of [
    [gl.TEXTURE_MIN_FILTER, gl.NEAREST],
    [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
    [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
    [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
  ])
    gl.texParameteri(gl.TEXTURE_2D, a, b);
  const f = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  return { t, f, w, h };
}
