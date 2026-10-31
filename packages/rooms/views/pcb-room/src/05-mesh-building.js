// ======================================================================= Mesh building
function Mesh(W, H) {
  this.a = [];
  this.W = W;
  this.H = H;
}
Mesh.prototype.v = function (x, y, z, n, c, m, u) {
  const U = u || [x / this.W + 0.5, y / this.H + 0.5];
  this.a.push(x, y, z, n[0], n[1], n[2], c[0], c[1], c[2], U[0], U[1], m);
};
Mesh.prototype.tri = function (a, b, e, n, c, m, u) {
  this.v(...a, n, c, m, u);
  this.v(...b, n, c, m, u);
  this.v(...e, n, c, m, u);
};
Mesh.prototype.quad = function (a, b, e, f, n, c, m, u) {
  const N =
    n ||
    nrm(cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [f[0] - a[0], f[1] - a[1], f[2] - a[2]]));
  this.tri(a, b, e, N, c, m, u);
  this.tri(a, e, f, N, c, m, u);
};
Mesh.prototype.box = function (x, y, z0, w, h, z1, c, m, bev) {
  const a = x - w / 2,
    b = x + w / 2,
    e = y - h / 2,
    f = y + h / 2,
    B = Math.min(bev || 0, w / 2.2, h / 2.2, (z1 - z0) / 2.2),
    zt = z1 - B;
  this.quad([a, e, z0], [b, e, z0], [b, e, zt], [a, e, zt], null, c, m);
  this.quad([b, e, z0], [b, f, z0], [b, f, zt], [b, e, zt], null, c, m);
  this.quad([b, f, z0], [a, f, z0], [a, f, zt], [b, f, zt], null, c, m);
  this.quad([a, f, z0], [a, e, z0], [a, e, zt], [a, f, zt], null, c, m);
  const A = a + B,
    C = b - B,
    E = e + B,
    F = f - B;
  this.quad([a, e, zt], [b, e, zt], [C, E, z1], [A, E, z1], null, c, m);
  this.quad([b, e, zt], [b, f, zt], [C, F, z1], [C, E, z1], null, c, m);
  this.quad([b, f, zt], [a, f, zt], [A, F, z1], [C, F, z1], null, c, m);
  this.quad([a, f, zt], [a, e, zt], [A, E, z1], [A, F, z1], null, c, m);
  this.quad([A, E, z1], [C, E, z1], [C, F, z1], [A, F, z1], null, c, m);
};
Mesh.prototype.tube = function (x, y, z0, z1, r, c, m) {
  const n = 12;
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * 6.2832,
      t1 = ((i + 1) / n) * 6.2832,
      a = [Math.cos(t0), Math.sin(t0)],
      b = [Math.cos(t1), Math.sin(t1)];
    const na = [a[0], a[1], 0],
      nb = [b[0], b[1], 0],
      P = [x + a[0] * r, y + a[1] * r, z0],
      Q = [x + b[0] * r, y + b[1] * r, z0],
      R = [x + b[0] * r, y + b[1] * r, z1],
      S = [x + a[0] * r, y + a[1] * r, z1];
    this.v(...P, na, c, m);
    this.v(...Q, nb, c, m);
    this.v(...R, nb, c, m);
    this.v(...P, na, c, m);
    this.v(...R, nb, c, m);
    this.v(...S, na, c, m);
  }
};
function addPart(M, p, z, ox, oy) {
  const C = [p.x - ox, p.y - oy],
    f = p.f,
    k = f.kind,
    lb = (dx, dy, z0, w, h, z1, c, m, b) => {
      const [r1, r2] = rot(dx, dy, p.rot),
        sw = p.rot % 180 !== 0;
      M.box(C[0] + r1, C[1] + r2, z + z0, sw ? h : w, sw ? w : h, z + z1, c, m, b);
    };
  const b = f.body,
    tin = [0.78, 0.78, 0.76],
    sold = [0.72, 0.72, 0.74];
  for (const q of p.pads)
    if (!q.th) M.box(q.x - ox, q.y - oy, z, q.w * 0.92, q.h * 0.92, z + 0.05, sold, 1, 0.03);
  if (k === "res" || k === "cap") {
    const col = k === "res" ? [0.03, 0.03, 0.035] : [0.42, 0.31, 0.17],
      e = b[0] * 0.2;
    lb(0, 0, 0.05, b[0] - 2 * e + 0.02, b[1] * 0.96, b[2], col, 0, 0.03);
    lb(-(b[0] - e) / 2, 0, 0.05, e, b[1], b[2] + 0.01, tin, 1, 0.03);
    lb((b[0] - e) / 2, 0, 0.05, e, b[1], b[2] + 0.01, tin, 1, 0.03);
  } else if (k === "pd") {
    lb(0, 0, 0.05, b[0], b[1], b[2] * 0.55, [0.12, 0.12, 0.13], 0, 0.03);
    lb(0, 0, b[2] * 0.55, b[0] * 0.72, b[1] * 0.8, b[2], [0.02, 0.03, 0.09], 1, 0.02);
    lb(-(b[0] - 0.3) / 2, 0, 0.05, 0.3, b[1], b[2] * 0.5, tin, 1, 0.02);
    lb((b[0] - 0.3) / 2, 0, 0.05, 0.3, b[1], b[2] * 0.5, tin, 1, 0.02);
  } else if (k === "pdl") {
    lb(0, 0, 0.1, b[0], b[1], b[2] * 0.8, [0.02, 0.02, 0.025], 0, 0.15);
    lb(0, 0, b[2] * 0.8, b[0] * 0.6, b[1] * 0.75, b[2], [0.03, 0.04, 0.1], 1, 0.03);
    for (const s of [-1, 1]) lb(s * (b[0] / 2 + 0.05), 0, 0.05, 0.5, 1.4, 0.3, tin, 1, 0.03);
  } else if (k === "ic" || k === "sot") {
    lb(0, 0, 0.18, b[0], b[1], b[2], [0.022, 0.022, 0.025], 0, 0.12);
    for (const q of f.pads) {
      const out = k === "ic" ? [Math.sign(q.x), 0] : [0, Math.sign(q.y)],
        lw = k === "ic" ? 0.4 : 0.35,
        ex = k === "ic" ? Math.abs(q.x) - b[0] / 2 : Math.abs(q.y) - b[1] / 2;
      const x1 = q.x - out[0] * ex * 0.5,
        y1 = q.y - out[1] * ex * 0.5,
        x2 = q.x - out[0] * (ex + 0.05),
        y2 = q.y - out[1] * (ex + 0.05);
      const hor = out[0] !== 0;
      lb(q.x, q.y, 0.05, hor ? 0.9 : lw, hor ? lw : 0.9, 0.13, tin, 1);
      lb(x1, y1, 0.1, hor ? ex : lw, hor ? lw : ex, 0.65, tin, 1);
    }
    lb(
      k === "ic" ? -b[0] / 2 + 0.6 : -b[0] / 2 + 0.35,
      k === "ic" ? b[1] / 2 - 0.6 : -b[1] / 2 + 0.35,
      b[2],
      0.45,
      0.45,
      b[2] + 0.01,
      [0.2, 0.2, 0.22],
      0
    );
  } else if (k === "hdr") {
    const pp = f.pitch;
    for (const q of f.pads) {
      lb(q.x, q.y, 0, pp * 0.92, pp * 0.92, b[2], [0.03, 0.03, 0.035], 0, 0.15);
      lb(q.x, q.y, -1.8, pp * 0.25, pp * 0.25, b[2] + 4.2 * (pp / 2.54), [0.9, 0.72, 0.3], 1, 0.04);
    }
  }
}
function buildMesh(d, S) {
  const M = new Mesh(d.W, d.H),
    ox = d.W / 2,
    oy = d.H / 2,
    lz = layerZ(d.layers),
    T = lz.total / 2,
    zs = S.view === "section" ? S.zs : 1,
    cu = [0.955, 0.64, 0.54],
    W2 = d.W / 2,
    H2 = d.H / 2;
  const mask = 0.02;
  const plate = (z, mat, col) =>
    M.quad([-W2, -H2, z], [W2, -H2, z], [W2, H2, z], [-W2, H2, z], [0, 0, 1], col, mat);
  const hl = [];
  for (const v of d.vias) hl.push([v.x, v.y, v.d / 2, 1]);
  for (const p of d.parts) for (const q of p.pads) if (q.th) hl.push([q.x, q.y, q.drill / 2, 1]);
  for (const h of d.holes) hl.push([h.x, h.y, h.d / 2, 0]);
  if (S.view === "exploded") {
    const g = S.gap,
      items = [];
    const list = [
      ["Silk", 8, [0, 0, 0]],
      ["Top mask", 7, [0, 0, 0]],
    ];
    for (let i = 0; i < d.layers; i++) {
      list.push([
        "L" + (i + 1) + " copper " + (d.stack.cu[i] * 1e3).toFixed(0) + " um",
        5,
        [i, 1, 0],
      ]);
      if (i < d.layers - 1)
        list.push([
          (d.layers === 4 && i !== 1 ? "Prepreg " : "Core ") + d.stack.diel[i].toFixed(2) + " mm",
          6,
          [0, 0.32, 0],
        ]);
    }
    list.push(["Bottom mask", 7, [d.layers - 1, 0, 0]]);
    let z = ((list.length - 1) * g) / 2 + 0.0;
    const top = z;
    S.labelsAt = [];
    for (const it of list) {
      plate(z, it[1], it[2]);
      if (it[1] === 5 || it[1] === 7) {
        M.quad([W2, H2, z], [-W2, H2, z], [-W2, -H2, z], [W2, -H2, z], [0, 0, -1], it[2], it[1]);
      }
      S.labelsAt.push({ text: it[0], p: [W2 + 1, -H2, z] });
      z -= g;
    }
    for (const h of hl) if (h[3]) M.tube(h[0] - ox, h[1] - oy, z + g, top, h[2], cu, 1);
    for (const p of d.parts) addPart(M, p, top + g * 1.1, ox, oy);
    M.zBottom = z;
  } else {
    const t = T + mask,
      Z = t * zs;
    plate(Z, 2, [0, 0, 0]);
    M.quad([W2, -H2, -Z], [-W2, -H2, -Z], [-W2, H2, -Z], [W2, H2, -Z], [0, 0, -1], [0, 0, 0], 3);
    M.quad([-W2, -H2, -Z], [W2, -H2, -Z], [W2, -H2, Z], [-W2, -H2, Z], [0, -1, 0], [0, 0, 0], 4);
    M.quad([W2, -H2, -Z], [W2, H2, -Z], [W2, H2, Z], [W2, -H2, Z], [1, 0, 0], [0, 0, 0], 4);
    M.quad([W2, H2, -Z], [-W2, H2, -Z], [-W2, H2, Z], [W2, H2, Z], [0, 1, 0], [0, 0, 0], 4);
    M.quad([-W2, H2, -Z], [-W2, -H2, -Z], [-W2, -H2, Z], [-W2, H2, Z], [-1, 0, 0], [0, 0, 0], 4);
    for (const h of hl) if (h[3]) M.tube(h[0] - ox, h[1] - oy, -Z, Z, h[2], cu, 1);
    for (const p of d.parts) addPart(M, p, Z, ox, oy);
    M.zBottom = -Z;
    if (S.view === "section") {
      const yc = S.cutY - oy,
        e = 0.0;
      M.tri([-W2, yc, -Z], [W2, yc, -Z], [W2, yc, Z], [0, -1, 0], [0, 0, 0], 9);
      M.a.length -= 36;
      M.v(-W2, yc, -Z, [0, -1, 0], [0, 0, 0], 9, [0, 0]);
      M.v(W2, yc, -Z, [0, -1, 0], [0, 0, 0], 9, [1, 0]);
      M.v(W2, yc, Z, [0, -1, 0], [0, 0, 0], 9, [1, 0]);
      M.v(-W2, yc, -Z, [0, -1, 0], [0, 0, 0], 9, [0, 0]);
      M.v(W2, yc, Z, [0, -1, 0], [0, 0, 0], 9, [1, 0]);
      M.v(-W2, yc, Z, [0, -1, 0], [0, 0, 0], 9, [0, 0]);
      S.labelsAt = [];
      const lzz = lz.z;
      S.labelsAt.push({ text: "mask", left: 1, p: [0, yc, (T + mask / 2) * zs] });
      lzz.forEach((q, i) => {
        S.labelsAt.push({
          text: "L" + (i + 1) + " " + (d.stack.cu[i] * 1e3).toFixed(0) + " um",
          left: 1,
          p: [0, yc, ((q.top + q.bot) / 2) * zs],
        });
        if (i < d.layers - 1)
          S.labelsAt.push({
            text: d.stack.mat + " " + d.stack.diel[i].toFixed(3) + " mm",
            left: 1,
            p: [0, yc, ((q.bot + lzz[i + 1].top) / 2) * zs],
          });
      });
    } else S.labelsAt = [];
  }
  const n = M.a.length / 12,
    arr = new Float32Array(M.a);
  M.a = null;
  return { arr, n, zBottom: M.zBottom };
}
function ribbonMesh(d, tl) {
  const a = [],
    ox = d.W / 2,
    oy = d.H / 2,
    T = layerZ(d.layers).total / 2 + 0.03,
    N = tl.N;
  for (const e of tl.e) {
    if (e.pad) continue;
    const A = tl.nodes[e.a],
      B = tl.nodes[e.b],
      dx = B.x - A.x,
      dy = B.y - A.y,
      l = Math.hypot(dx, dy) || 1,
      w = Math.max(0.16, 0.24),
      nx = ((-dy / l) * w) / 2,
      ny = ((dx / l) * w) / 2,
      push = (x, y, n) => a.push(x - ox, y - oy, T, 0, 0, 1, 0, 0, 0, (n + 0.5) / N, 0.5, 10);
    push(A.x + nx, A.y + ny, e.a);
    push(A.x - nx, A.y - ny, e.a);
    push(B.x - nx, B.y - ny, e.b);
    push(A.x + nx, A.y + ny, e.a);
    push(B.x - nx, B.y - ny, e.b);
    push(B.x + nx, B.y + ny, e.b);
  }
  return new Float32Array(a);
}
function makeVAO(arr) {
  const gl = GLS.gl,
    v = gl.createVertexArray(),
    b = gl.createBuffer();
  gl.bindVertexArray(v);
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
  const s = 48;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, s, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, s, 12);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, s, 24);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 2, gl.FLOAT, false, s, 36);
  gl.enableVertexAttribArray(4);
  gl.vertexAttribPointer(4, 1, gl.FLOAT, false, s, 44);
  gl.bindVertexArray(null);
  return { v, b, n: arr.length / 12 };
}
function freeVAO(o) {
  if (!o) return;
  const gl = GLS.gl;
  gl.deleteBuffer(o.b);
  gl.deleteVertexArray(o.v);
}
