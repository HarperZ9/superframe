const free = (x) => {
  if (x) {
    gl.deleteTexture(x.t);
    gl.deleteFramebuffer(x.f);
  }
};
let A,
  B,
  frame = 0,
  W = 0,
  H = 0,
  Q = 360,
  qMax = 3840,
  tSum = 0,
  tN = 0,
  tLast = 0;
const targets = {};
const getT = (w, h, fmt, ty) => {
  const k = w + "x" + h + (fmt || "");
  return targets[k] || (targets[k] = tgt(w, h, fmt || gl.RGBA32F, ty || gl.FLOAT));
};
const imgT = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, imgT);
gl.texImage2D(
  gl.TEXTURE_2D,
  0,
  gl.RGBA,
  1,
  1,
  0,
  gl.RGBA,
  gl.UNSIGNED_BYTE,
  new Uint8Array([128, 128, 128, 255])
);
let hasImg = 0;
function size() {
  const r = cv.getBoundingClientRect();
  const dpr = Math.max(1, devicePixelRatio || 1);
  const big = Math.max(r.width, r.height, 1);
  const k = Math.min(Q / big, dpr * 2);
  const w = Math.max(2, Math.round(r.width * k)),
    h = Math.max(2, Math.round(r.height * k));
  if (w == W && h == H) return;
  W = w;
  H = h;
  cv.width = w;
  cv.height = h;
  free(A);
  free(B);
  A = tgt(w, h);
  B = tgt(w, h);
  reset();
}
const cache = {};
let P,
  U = {};
