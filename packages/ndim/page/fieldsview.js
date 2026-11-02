// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* ndim page: n-dimensional distance fields and the quaternion Julia set, sliced to 3D and ray-marched.
   The CPU path is the reference (NDim.renderSlice). The WebGL2 path runs the same camera, step rule,
   iteration counts and shading in a fragment shader; the page measures how far the two agree. */
(function () {
  "use strict";
  const N = window.NDim, D = window.NDraw, $ = (s) => document.querySelector(s);
  const JULIA_C = { a: [-0.2, 0.6, 0.2, 0], b: [-0.291, -0.399, 0.339, 0.437], c: [-1, 0.2, 0, 0] };
  const SHAPE_ID = { hypersphere: 0, hyperbox: 1, duocylinder: 2, tiger: 3, julia: 4 };
  const CAM = { yaw: 0.6, pitch: 0.35, dist: 3.2, eps: 1e-3, steps: 160, normalStep: 1e-3 };
  const camFor = (shape) => (shape === "julia" ? Object.assign({}, CAM, { eps: 2e-3, normalStep: 1e-2 }) : CAM);
  const sdfOf = (shape, c) => shape === "julia" ? N.juliaDE(c, 10) : shape === "hypersphere" ? N.sdf.hypersphere(1) : shape === "hyperbox" ? N.sdf.hyperbox(0.75) : shape === "duocylinder" ? N.sdf.duocylinder(0.7) : N.sdf.tiger(0.7, 0.32);

  const FS = `#version 300 es
precision highp float;
uniform int uShape; uniform float uW; uniform vec4 uC; uniform vec2 uRes; uniform vec3 uCam; uniform vec2 uEps; out vec4 o;
vec4 qsq(vec4 q){ return vec4(q.x*q.x-q.y*q.y-q.z*q.z-q.w*q.w, 2.0*q.x*q.y, 2.0*q.x*q.z, 2.0*q.x*q.w); }
float de(vec4 p){
  if (uShape==0) return length(p)-1.0;
  if (uShape==1) { vec4 q=abs(p)-0.75; return length(max(q,0.0))+min(max(max(q.x,q.y),max(q.z,q.w)),0.0); }
  if (uShape==2) return max(length(p.xy)-0.7, length(p.zw)-0.7);
  if (uShape==3) return length(vec2(length(p.xy)-0.7, length(p.zw)-0.7))-0.32;
  vec4 q=p; float dq=1.0, r=length(q);
  for (int i=0;i<10;i++){ if (r>=4.0) break; dq*=2.0*r; q=qsq(q)+uC; r=length(q); }
  return r<4.0 ? 0.0 : 0.5*r*log(r)/dq;
}
float f(vec3 q){ return de(vec4(q, uW)); }
void main(){
  float cy=cos(uCam.x), sy=sin(uCam.x), cp=cos(uCam.y), sp=sin(uCam.y);
  vec3 fwd=vec3(-sy*cp,-sp,-cy*cp), rt=vec3(cy,0.0,-sy), up=vec3(-sy*sp,cp,-cy*sp), ro=-fwd*uCam.z;
  float u=(2.0*gl_FragCoord.x-uRes.x)/uRes.y, v=(2.0*gl_FragCoord.y-uRes.y)/uRes.y;
  vec3 rd=normalize(fwd*1.6+rt*u+up*v); float t=0.0; bool hit=false;
  for (int i=0;i<160;i++){ float d=f(ro+t*rd); if (d<uEps.x){hit=true;break;} t+=d; if (t>8.0) break; }
  if (!hit) { o=vec4(0.0); return; }
  vec3 q=ro+t*rd; float e=uEps.y;
  vec3 n=normalize(vec3(f(q+vec3(e,0,0))-f(q-vec3(e,0,0)), f(q+vec3(0,e,0))-f(q-vec3(0,e,0)), f(q+vec3(0,0,e))-f(q-vec3(0,0,e))));
  float g=floor(40.0+200.0*max(0.0,dot(n,normalize(vec3(0.6,0.8,0.4))))*exp(-0.08*t)+0.5);
  o=vec4(vec3(g/255.0),1.0);
}`;
  let gl = null, prog = null, glCanvas = null;
  function glInit() {
    if (gl !== null) return !!gl;
    glCanvas = document.createElement("canvas");
    gl = glCanvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false }) || false;
    if (!gl) return false;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, "#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0,1);}"));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) { console.error("WebGL2 slice shader failed; the CPU path stays", e); gl = false; return false; }
    return true;
  }
  /* Gray levels from the GPU, top row first, matching the CPU image layout. */
  function gpuGray(shape, w4, c, W, H) {
    glCanvas.width = W; glCanvas.height = H; gl.viewport(0, 0, W, H); gl.useProgram(prog);
    const U = (n) => gl.getUniformLocation(prog, n);
    gl.uniform1i(U("uShape"), SHAPE_ID[shape]); gl.uniform1f(U("uW"), w4); gl.uniform4fv(U("uC"), c); gl.uniform2f(U("uRes"), W, H); gl.uniform3f(U("uCam"), CAM.yaw, CAM.pitch, CAM.dist); const cm = camFor(shape); gl.uniform2f(U("uEps"), cm.eps, cm.normalStep);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const img = new Uint8ClampedArray(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) img[j * W + i] = px[((H - 1 - j) * W + i) * 4];
    return img;
  }
  function paint(cv, img, W, H) {
    const T = D.tokens(), { ctx, w } = D.fit(cv, 1), rgb = hex(T.ink), off = document.createElement("canvas"), dark = !!(window.Kit && Kit.isDark());
    off.width = W; off.height = H;
    const id = off.getContext("2d").createImageData(W, H);
    for (let k = 0; k < W * H; k++) { id.data[4 * k] = rgb[0]; id.data[4 * k + 1] = rgb[1]; id.data[4 * k + 2] = rgb[2]; id.data[4 * k + 3] = img[k] ? (dark ? img[k] : Math.min(255, 300 - img[k])) : 0; }
    off.getContext("2d").putImageData(id, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, w, w);
  }
  function hex(c) { const m = /^#?([0-9a-f]{6})$/i.exec(c.trim()); if (!m) return [20, 20, 20]; const v = parseInt(m[1], 16); return [v >> 16, (v >> 8) & 255, v & 255]; }

  const views = {
    sdf: { cv: "#cv-sdf", cap: "#cap-sdf", res: 132, shape: () => $("#sdf-shape").value, w: () => +$("#sdf-w").value / 100, c: () => [0, 0, 0, 0], gpu: false },
    julia: { cv: "#cv-julia", cap: "#cap-julia", res: 150, shape: () => "julia", w: () => +$("#jul-w").value / 100, c: () => JULIA_C[$("#jul-c").value], gpu: false },
  };
  function render(key) {
    const v = views[key], shape = v.shape(), w4 = v.w(), c = v.c();
    let img, W = v.res, how = "CPU reference";
    if (v.gpu && glInit()) { W = v.res * 3; img = gpuGray(shape, w4, c, W, W); how = "WebGL2"; }
    else img = N.renderSlice(sdfOf(shape, c), N.sliceFrame(4, w4), W, W, camFor(shape)).img;
    paint($(v.cv), img, W, W);
    const what = shape === "julia" ? `the quaternion Julia set for c = (${c.join(", ")}), cut at the fourth coordinate = ${D.fmt(w4)}` : `a 4D ${shape} cut at w = ${D.fmt(w4)}`;
    $(v.cap).textContent = `${what}, ray-marched at ${W} x ${W} on the ${how}. ` + `Lens: slice, then a 3D camera. Keeps exact shape inside the cut. Loses everything off it.` + (v.note || "");
  }
  function compare(key) {
    const v = views[key];
    if (!glInit()) { v.note = " WebGL2 is not available here, so only the CPU path runs."; render(key); return; }
    const shape = v.shape(), w4 = v.w(), c = v.c(), W = v.res;
    const a = N.renderSlice(sdfOf(shape, c), N.sliceFrame(4, w4), W, W, camFor(shape)).img, b = gpuGray(shape, w4, c, W, W);
    let agree = 0, both = 0, diff = 0, maxd = 0;
    for (let k = 0; k < a.length; k++) { if (!!a[k] === !!b[k]) agree++; if (a[k] && b[k]) { both++; const d = Math.abs(a[k] - b[k]); diff += d; maxd = Math.max(maxd, d); } }
    v.note = ` GPU against CPU at ${W} x ${W}: hit or miss agrees on ${D.fmt((100 * agree) / a.length, 4)}% of pixels; where both hit, gray differs by ${D.fmt(both ? diff / both : 0)} on average and ${maxd} at most (of 255). Float32 on the GPU against float64 here, so equal bytes are not expected.`;
    render(key);
  }
  function init() {
    if (glInit()) { views.julia.gpu = true; document.querySelectorAll('[data-run="julia"]').forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.path === "gpu"))); }
    for (const key of Object.keys(views)) {
      const v = views[key], again = () => requestAnimationFrame(() => render(key));
      document.querySelectorAll(`[data-run="${key}"]`).forEach((b) => b.addEventListener("click", () => {
        v.gpu = b.dataset.path === "gpu"; v.note = "";
        document.querySelectorAll(`[data-run="${key}"]`).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); again();
      }));
      const cmp = $(`[data-compare="${key}"]`); if (cmp) cmp.addEventListener("click", () => compare(key));
      again();
    }
    ["#sdf-shape", "#sdf-w"].forEach((s) => $(s).addEventListener("input", () => render("sdf")));
    ["#jul-c", "#jul-w"].forEach((s) => $(s).addEventListener("input", () => render("julia")));
    if (window.Kit) Kit.on(() => { render("sdf"); render("julia"); });
  }
  window.NFields = { init };
})();
