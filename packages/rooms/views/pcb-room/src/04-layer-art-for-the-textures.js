// ======================================================================= Layer art for the textures
function layerCanvas(d, l, s) {
  const c = document.createElement("canvas");
  c.width = Math.ceil(d.W * s);
  c.height = Math.ceil(d.H * s);
  const x = c.getContext("2d");
  x.fillStyle = "#000";
  x.fillRect(0, 0, c.width, c.height);
  const X = (v) => v * s,
    Y = (v) => (d.H - v) * s;
  x.lineCap = "round";
  const disc = (a, b, r) => {
      x.beginPath();
      x.arc(X(a), Y(b), r * s, 0, 6.2832);
      x.fill();
    },
    seg = (t) => {
      x.lineWidth = t.w * s;
      x.beginPath();
      x.moveTo(X(t.x1), Y(t.y1));
      x.lineTo(X(t.x2), Y(t.y2));
      x.stroke();
    };
  const pl = (d.planes || []).find((p) => p.l === l),
    inner = d.layers === 4 && (l === 1 || l === 2);
  if (pl) {
    const I = DES.planeInset;
    x.fillStyle = "#f00";
    x.fillRect(X(I), Y(d.H - I), (d.W - 2 * I) * s, (d.H - 2 * I) * s);
    x.globalCompositeOperation = "multiply";
    x.fillStyle = x.strokeStyle = "#0ff";
    for (const k of planeClears(d, pl)) {
      if (k.x1 === k.x2 && k.y1 === k.y2) disc(k.x1, k.y1, k.r);
      else seg({ x1: k.x1, y1: k.y1, x2: k.x2, y2: k.y2, w: 2 * k.r });
    }
    x.globalCompositeOperation = "source-over";
  }
  x.globalCompositeOperation = "lighter";
  x.fillStyle = x.strokeStyle = "#f00";
  if (!inner) {
    for (const t of d.tracks) if (t.l === l) seg(t);
    for (const v of d.vias) disc(v.x, v.y, v.pad / 2);
    for (const p of d.parts)
      for (const q of p.pads) {
        if (l !== 0 && !q.th) continue;
        if (q.round) disc(q.x, q.y, q.w / 2);
        else x.fillRect(X(q.x - q.w / 2), Y(q.y + q.h / 2), q.w * s, q.h * s);
      }
    x.fillStyle = "#0f0";
    const g = DES.maskGrow;
    for (const p of d.parts)
      for (const q of p.pads) {
        if (l !== 0 && !q.th) continue;
        if (q.round) disc(q.x, q.y, q.w / 2 + g);
        else
          x.fillRect(
            X(q.x - q.w / 2 - g),
            Y(q.y + q.h / 2 + g),
            (q.w + 2 * g) * s,
            (q.h + 2 * g) * s
          );
      }
    if (l === 0) {
      x.strokeStyle = "#00f";
      for (const k of silkLines(d)) seg({ x1: k[0], y1: k[1], x2: k[2], y2: k[3], w: 0.12 });
    }
  }
  return c;
}
function drillCanvas(d, s) {
  const c = document.createElement("canvas");
  c.width = Math.ceil(d.W * s);
  c.height = Math.ceil(d.H * s);
  const x = c.getContext("2d");
  x.fillStyle = "#000";
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = "#fff";
  const disc = (a, b, r) => {
    x.beginPath();
    x.arc(a * s, (d.H - b) * s, r * s, 0, 6.2832);
    x.fill();
  };
  for (const v of d.vias) disc(v.x, v.y, v.d / 2);
  for (const h of d.holes) disc(h.x, h.y, h.d / 2);
  for (const p of d.parts) for (const q of p.pads) if (q.th) disc(q.x, q.y, q.drill / 2);
  return c;
}
function uploadTex(name, src, mip) {
  const gl = GLS.gl,
    t = GLS.tex[name];
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  if (mip) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    if (GLS.aniso) gl.texParameterf(gl.TEXTURE_2D, GLS.aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}
function uploadData(name, w, h, px) {
  const gl = GLS.gl;
  gl.bindTexture(gl.TEXTURE_2D, GLS.tex[name]);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}
