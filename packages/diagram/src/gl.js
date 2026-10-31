// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/gl: the WebGL2 path. It draws the same draw list as the software raster, with the same flat shading
   computed per triangle, so both paths show one picture. Cut faces use the stencil buffer: each loop is fanned
   with INVERT (even-odd, so cavities stay open), then the same fans are drawn again where the stencil is set,
   with the hatch shader, at the plane's depth. Returns null when WebGL2 is not available. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});

  const VS = `#version 300 es
in vec3 p; in vec4 c; uniform mat4 vp; uniform float ps; out vec4 vc;
void main(){ vc=c; gl_Position=vp*vec4(p,1.); gl_PointSize=ps; }`;
  const FS = `#version 300 es
precision highp float; in vec4 vc; uniform int disc; uniform int hatch; uniform vec3 ink; uniform vec2 hv; uniform float gap; out vec4 o;
void main(){
  if(disc==1){ vec2 q=gl_PointCoord-.5; if(dot(q,q)>.25) discard; }
  vec3 col=vc.rgb;
  if(hatch==1){ float h=mod(dot(floor(gl_FragCoord.xy),hv),gap); if(h<1.3) col=ink; }
  o=vec4(col,vc.a);
}`;

  D.glRenderer = (canvas) => {
    const gl = canvas.getContext("webgl2", { antialias: true, stencil: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    const U = (n) => gl.getUniformLocation(prog, n), aP = gl.getAttribLocation(prog, "p"), aC = gl.getAttribLocation(prog, "c");
    const buf = gl.createBuffer(), vao = gl.createVertexArray();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(aC); gl.vertexAttribPointer(aC, 4, gl.FLOAT, false, 28, 12);
    const draw = (data, mode) => { if (!data.length) return; gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW); gl.drawArrays(mode, 0, data.length / 7); };

    function render(list, cam, opt = {}) {
      const W = canvas.width, H = canvas.height;
      gl.viewport(0, 0, W, H);
      const bg = opt.bg || [0.95, 0.94, 0.9];
      gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clearStencil(0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      gl.useProgram(prog); gl.bindVertexArray(vao);
      gl.uniformMatrix4fv(U("vp"), false, Float32Array.from(cam.vp));
      gl.uniform1i(U("disc"), 0); gl.uniform1i(U("hatch"), 0); gl.uniform1f(U("ps"), 1);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.depthMask(true);
      const T = list.tris, nT = T.length / 9, opaque = [], glass = [];
      for (let t = 0; t < nT; t++) {
        const st = list.style[list.triPart[t]], a = [T[t * 9], T[t * 9 + 1], T[t * 9 + 2]];
        const n = D.v3.norm(D.v3.cross(D.v3.sub([T[t * 9 + 3], T[t * 9 + 4], T[t * 9 + 5]], a), D.v3.sub([T[t * 9 + 6], T[t * 9 + 7], T[t * 9 + 8]], a)));
        const c = D.shade(st.rgb, n, D.v3.sub(cam.eye, a), st.emit, st.glow);
        const rec = [t, c, st.alpha];
        (st.alpha >= 1 ? opaque : glass).push(rec);
      }
      const pack = (recs) => {
        const o = new Float32Array(recs.length * 21);
        recs.forEach(([t, c, al], i) => { for (let k = 0; k < 3; k++) { o.set([T[t * 9 + k * 3], T[t * 9 + k * 3 + 1], T[t * 9 + k * 3 + 2], c[0], c[1], c[2], al], i * 21 + k * 7); } });
        return o;
      };
      draw(pack(opaque), gl.TRIANGLES);
      /* cut faces */
      gl.enable(gl.STENCIL_TEST);
      for (const cap of list.caps || []) {
        const fans = [];
        for (const L of cap.loops) for (let i = 1; i + 1 < L.length; i++) fans.push(...L[0], ...cap.rgb, 1, ...L[i], ...cap.rgb, 1, ...L[i + 1], ...cap.rgb, 1);
        const data = Float32Array.from(fans);
        gl.colorMask(false, false, false, false); gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
        gl.stencilFunc(gl.ALWAYS, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
        draw(data, gl.TRIANGLES);
        gl.colorMask(true, true, true, true); gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
        gl.stencilFunc(gl.NOTEQUAL, 0, 0xff); gl.stencilOp(gl.KEEP, gl.ZERO, gl.ZERO);
        const ang = ((cap.hatch && cap.hatch.angle) || 45) * Math.PI / 180;
        gl.uniform1i(U("hatch"), 1); gl.uniform3fv(U("ink"), cap.ink); gl.uniform2f(U("hv"), Math.cos(ang), -Math.sin(ang)); gl.uniform1f(U("gap"), ((cap.hatch && cap.hatch.gap) || 7) * (opt.dpr || 1));
        draw(data, gl.TRIANGLES);
        gl.uniform1i(U("hatch"), 0);
        gl.stencilFunc(gl.ALWAYS, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO);
        gl.colorMask(false, false, false, false); gl.depthMask(false); draw(data, gl.TRIANGLES); gl.colorMask(true, true, true, true); gl.depthMask(true);
      }
      gl.disable(gl.STENCIL_TEST);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const ln = [];
      for (const l of list.lines || []) for (let i = 0; i + 1 < l.pts.length; i++) ln.push(...l.pts[i], ...l.rgb, l.alpha || 1, ...l.pts[i + 1], ...l.rgb, l.alpha || 1);
      draw(Float32Array.from(ln), gl.LINES);
      const pts = list.points || [];
      gl.uniform1i(U("disc"), 1);
      for (const r of [...new Set(pts.map((p) => p.r || 3))]) {
        gl.uniform1f(U("ps"), 2 * r * (opt.dpr || 1));
        const d = [];
        for (const p of pts) if ((p.r || 3) === r) d.push(...p.p, ...p.rgb, 1);
        draw(Float32Array.from(d), gl.POINTS);
      }
      gl.uniform1i(U("disc"), 0);
      const md = (t) => { const e = cam.eye; let s = 0; for (let k = 0; k < 3; k++) s += Math.hypot(T[t * 9 + k * 3] - e[0], T[t * 9 + k * 3 + 1] - e[1], T[t * 9 + k * 3 + 2] - e[2]); return s; };
      glass.sort((a, b) => md(b[0]) - md(a[0]));
      gl.depthMask(false); draw(pack(glass), gl.TRIANGLES); gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    return { gl, render, kind: "WebGL2" };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = D;
})(typeof globalThis !== "undefined" ? globalThis : this);
