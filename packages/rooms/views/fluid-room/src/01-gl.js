// The GPU step: same scheme and grid conventions as Spectral2 with scheme "ssp3".
const $ = (id) => document.getElementById(id), srcOf = (id) => $(id).textContent;
const canvas = $("gl"), gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
function fail(msg) { const e = $("err"); e.hidden = false; e.textContent = msg; }
if (!gl || !gl.getExtension("EXT_color_buffer_float")) fail("This view needs WebGL2 with float render targets. The solver itself runs without a browser: packages/rooms/solvers/fluid.");
const LINEAR = !!gl && !!gl.getExtension("OES_texture_float_linear");
const quad = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
function program(id) {
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(id + ": " + gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, srcOf("vs")));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, srcOf(id)));
  gl.bindAttribLocation(p, 0, "a");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(id + ": " + gl.getProgramInfoLog(p));
  const u = {};
  for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
  return { p, u };
}
const PROG = {};
for (const id of ["fft", "prep", "viewp", "nl", "rhs", "upd", "stir", "dye", "show", "vol"]) PROG[id] = program(id);
function target(w, h, filter = gl.NEAREST) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  const f = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  return { t, f, w, h };
}
function pass(prog, dst, tex = {}, uni = {}) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.f : null);
  gl.viewport(0, 0, dst ? dst.w : canvas.width, dst ? dst.h : canvas.height);
  gl.useProgram(prog.p);
  gl.enableVertexAttribArray(0);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  let unit = 0;
  for (const [k, v] of Object.entries(tex)) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v.t); gl.uniform1i(prog.u[k], unit++); }
  for (const [k, v] of Object.entries(uni)) {
    if (prog.u[k] === undefined) continue;
    if (Array.isArray(v)) gl.uniform2f(prog.u[k], v[0], v[1]);
    else if (k === "uAxis" || k === "uView" || k === "uSigned") gl.uniform1i(prog.u[k], v);
    else gl.uniform1f(prog.u[k], v);
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
/** One grid's worth of targets and the SSP RK3 step. */
class Gpu2 {
  constructor(N, dyeN) {
    Object.assign(this, { N, lg: Math.log2(N), mean: [0, 0], nu: 0.001, dt: 0.01, eta: 0.02, drive: 0, kf: 4, drag: 0, hasS: false });
    const T = () => target(N, N);
    Object.assign(this, { W: T(), W1: T(), W2: T(), W3: T(), R0: T(), U: T(), V: T(), N1: T(), a: T(), b: T(), A: T(), S: target(N, N, LINEAR ? gl.LINEAR : gl.NEAREST), Tg: T(), P: target(N, N, LINEAR ? gl.LINEAR : gl.NEAREST) });
    this.D = [target(dyeN, dyeN, LINEAR ? gl.LINEAR : gl.NEAREST), target(dyeN, dyeN, LINEAR ? gl.LINEAR : gl.NEAREST)];
  }
  fft2(src, dst, sign) {
    const { N, lg, a, b } = this;
    let from = src, to = a;
    const total = 2 * lg, scale = sign > 0 ? 1 / (N * N) : 1;
    let done = 0;
    for (let ax = 0; ax < 2; ax++) for (let i = 1; i <= lg; i++) {
      done++;
      const out = done === total ? dst : to;
      pass(PROG.fft, out, { F: from }, { uAxis: ax, uSub: 2 ** i, uN: N, uSign: sign, uScale: done === total ? scale : 1 });
      from = out;
      to = out === a ? b : a;
    }
  }
  rhs(W, out) {
    const { N } = this;
    pass(PROG.prep, this.A, { W }, { uN: N });
    this.fft2(this.A, this.U, 1);
    if (this.hasS) this.fft2(W, this.V, 1);
    pass(PROG.nl, this.A, { U: this.U, V: this.V, S: this.S, T: this.Tg }, { uEta: this.eta, uMean: this.mean });
    this.fft2(this.A, this.N1, -1);
    pass(PROG.rhs, out, { N: this.N1 }, { uN: N, uDrive: this.drive, uKf: this.kf });
  }
  step() {
    const { N, dt, nu, drag, W, W1, W2 } = this, base = { uN: N, uDt: dt, uNu: nu, uDrag: drag };
    this.rhs(W, this.R0);
    pass(PROG.upd, W1, { W0: W, Wc: W, R: this.R0 }, { ...base, uA: 0, uP: 0, uB: 1, uQ: 1 });
    this.rhs(W1, this.R0);
    pass(PROG.upd, W2, { W0: W, Wc: W1, R: this.R0 }, { ...base, uA: 0.75, uP: 0.5, uB: 0.25, uQ: -0.5 });
    this.rhs(W2, this.R0);
    pass(PROG.upd, this.W3, { W0: W, Wc: W2, R: this.R0 }, { ...base, uA: 1 / 3, uP: 1, uB: 2 / 3, uQ: 0.5 });
    [this.W, this.W3] = [this.W3, this.W];
    this.dyeStep(dt);
  }
  dyeStep(dt) {
    pass(PROG.prep, this.A, { W: this.W }, { uN: this.N });
    this.fft2(this.A, this.P, 1);
    pass(PROG.dye, this.D[1], { D: this.D[0], U: this.P, S: this.S }, { uDt: dt, uRes: [this.D[0].w, this.D[0].h] });
    this.D.reverse();
  }
  upload(tgt, arr) {
    gl.bindTexture(gl.TEXTURE_2D, tgt.t);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, tgt.w, tgt.h, gl.RGBA, gl.FLOAT, arr);
  }
  read(tgt) {
    const a = new Float32Array(4 * tgt.w * tgt.h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, tgt.f);
    gl.readPixels(0, 0, tgt.w, tgt.h, gl.RGBA, gl.FLOAT, a);
    return a;
  }
  /** Load vorticity from f(x, y) by the CPU forward FFT, so GPU and CPU share a start. */
  setVorticity(f) {
    const N = this.N, re = new Float64Array(N * N), im = new Float64Array(N * N), h = (2 * Math.PI) / N;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) re[j * N + i] = f(i * h, j * h);
    fft2d(re, im, N, N);
    const a = new Float32Array(4 * N * N);
    for (let i = 0; i < N * N; i++) { a[4 * i] = re[i]; a[4 * i + 1] = im[i]; }
    this.upload(this.W, a);
    pass(PROG.upd, this.W3, { W0: this.W, Wc: this.W, R: this.R0 }, { uN: N, uDt: 0, uNu: 0, uDrag: 0, uA: 0, uP: 0, uB: 1, uQ: 1 });
    [this.W, this.W3] = [this.W3, this.W];
  }
  setDye(f) {
    const n = this.D[0].w, a = new Float32Array(4 * n * n), h = (2 * Math.PI) / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const c = f(i * h, j * h); a.set(c, 4 * (j * n + i)); }
    this.upload(this.D[0], a);
  }
  /** Fixed flow (ux, uy), wall mask, divergence and target from CPU arrays; null clears them. */
  setStatics(flow, wall) {
    const N = this.N, s = new Float32Array(4 * N * N), t = new Float32Array(4 * N * N);
    this.hasS = !!flow;
    this.hasWall = !!wall;
    if (flow) {
      const dv = flow.div;
      for (let i = 0; i < N * N; i++) { s[4 * i] = flow.ux[i]; s[4 * i + 1] = flow.uy[i]; s[4 * i + 3] = dv ? dv[i] : 0; }
    }
    if (wall) { this.hasS = true; for (let i = 0; i < N * N; i++) { s[4 * i + 2] = wall.chi[i]; t[4 * i] = wall.ux[i]; t[4 * i + 1] = wall.uy[i]; } this.eta = wall.eta; }
    this.upload(this.S, s);
    this.upload(this.Tg, t);
  }
  /** Energy, enstrophy and spectrum from the current spectrum. */
  measures() {
    const N = this.N, a = this.read(this.W), E = new Float64Array(N);
    let en = 0, z = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const kx = i < N / 2 ? i : i - N, ky = j < N / 2 ? j : j - N, k2 = kx * kx + ky * ky;
      if (!k2) continue;
      const m = a[4 * (j * N + i)] ** 2 + a[4 * (j * N + i) + 1] ** 2;
      z += m; en += m / k2;
      const b = Math.round(Math.sqrt(k2));
      if (b < N) E[b] += (0.5 * m) / k2 / (N * N * N * N);
    }
    return { E: (0.5 * en) / (N * N * N * N), Z: (0.5 * z) / (N * N * N * N), spec: E };
  }
}
