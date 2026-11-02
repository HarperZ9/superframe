const $ = (id) => document.getElementById(id),
  cv = $("gl");
const gl = cv.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
const fail = (m) => {
  $("err").hidden = false;
  $("err").textContent = m;
};
if (!gl || !gl.getExtension("EXT_color_buffer_float"))
  fail("This view needs WebGL2 with floating point targets.");
gl.getExtension("OES_texture_float_linear");
function prog(fs) {
  const p = gl.createProgram();
  for (const [t, s] of [
    [gl.VERTEX_SHADER, $("vs").textContent],
    [gl.FRAGMENT_SHADER, fs],
  ]) {
    const h = gl.createShader(t);
    gl.shaderSource(h, s.trim());
    gl.compileShader(h);
    if (!gl.getShaderParameter(h, gl.COMPILE_STATUS)) {
      fail(gl.getShaderInfoLog(h));
      throw new Error("shader");
    }
    gl.attachShader(p, h);
  }
  gl.bindAttribLocation(p, 0, "a");
  gl.linkProgram(p);
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const m = gl.getActiveUniform(p, i).name;
    u[m] = gl.getUniformLocation(p, m);
  }
  return { p, u };
}
const PS = prog($("step").textContent),
  PM = prog($("mic").textContent),
  PV = prog($("show").textContent);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
function tex(w, h, filter) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const f = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  return { t, f };
}
let A = tex(N, N, gl.LINEAR),
  B = tex(N, N, gl.LINEAR);
const MT = gl.createTexture(),
  HW = 64,
  H = tex(HW, 1, gl.NEAREST);
const sel = $("room");
for (const k in rooms) {
  const o = document.createElement("option");
  o.textContent = k;
  sel.append(o);
}
const S = {
  f: 1500,
  damp: 0.0,
  speed: 1,
  gain: 1,
  srcType: 0,
  view: 0,
  room: "Open air",
  src: [256, 256],
  mic: [400, 256],
  amp: 0.05,
};
const sl = [
  ["f", "Frequency", 200, 8000, 10, (v) => v.toFixed(0) + " Hz"],
  ["speed", "Speed", 0.5, 1.4, 0.01, (v) => (C0 * v).toFixed(0) + " m/s"],
  ["damp", "Damping", 0, 0.01, 0.0001, (v) => v.toFixed(4)],
  ["gain", "Display", 0.2, 8, 0.01, (v) => v.toFixed(1) + "×"],
];
for (const [k, l, a, b, st, fm] of sl) {
  const r = document.createElement("div");
  r.className = "row";
  r.innerHTML = `<label for="s_${k}">${l}</label><input id="s_${k}" type="range" min="${a}" max="${b}" step="${st}" value="${S[k]}"><output></output>`;
  $("sl").append(r);
  const i = r.querySelector("input"),
    o = r.querySelector("output");
  const up = () => (o.textContent = fm(+i.value));
  up();
  i.oninput = () => {
    S[k] = +i.value;
    up();
    if (k == "speed") build();
  };
}
