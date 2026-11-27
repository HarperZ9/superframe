// SPDX-License-Identifier: MIT
// Minimal WebGL2 helpers for the example backend: a context, a program with its
// uniform locations, a fullscreen triangle and an RGBA8 render target.

export function getGL2(canvas, opts = {}) {
  return canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, ...opts });
}

const VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

function shader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader compile failed');
  return s;
}

export function program(gl, fragmentSource) {
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, shader(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link failed');
  const loc = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog, i);
    loc[info.name] = gl.getUniformLocation(prog, info.name);
    if (info.name.endsWith('[0]')) loc[info.name.slice(0, -3)] = loc[info.name];
  }
  return { prog, loc };
}

export function fullscreenTriangle(gl) {
  const vao = gl.createVertexArray();
  return {
    draw() { gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null); },
    dispose() { gl.deleteVertexArray(vao); },
  };
}

export function target(gl, w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fb, dispose() { gl.deleteFramebuffer(fb); gl.deleteTexture(tex); } };
}
