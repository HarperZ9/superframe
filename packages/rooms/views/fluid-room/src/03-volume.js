// The 3D cases: worker-run CPU reference, drawn by one volume program.
const Vol = {
  worker: null, tex: null, n: 0, last: null, yaw: 0.6, pitch: 0.35,
  start(c) {
    if (!this.worker) {
      this.worker = new Worker(URL.createObjectURL(new Blob([srcOf("worker3")], { type: "text/javascript" })));
      this.worker.onmessage = (e) => { this.last = e.data; this.upload(e.data); };
    }
    this.worker.postMessage({ run: true });
    this.worker.postMessage({ start: c.three, n: c.n, nu: c.nu });
  },
  stop() { if (this.worker) this.worker.postMessage({ run: false }); },
  upload(m) {
    if (!this.tex || this.n !== m.n) {
      this.tex = gl.createTexture();
      this.n = m.n;
      gl.bindTexture(gl.TEXTURE_3D, this.tex);
      gl.texStorage3D(gl.TEXTURE_3D, 1, gl.R32F, m.n, m.n, m.n);
      for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, LINEAR ? gl.LINEAR : gl.NEAREST], [gl.TEXTURE_MAG_FILTER, LINEAR ? gl.LINEAR : gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.REPEAT], [gl.TEXTURE_WRAP_R, gl.REPEAT]]) gl.texParameteri(gl.TEXTURE_3D, p, v);
    }
    gl.bindTexture(gl.TEXTURE_3D, this.tex);
    gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, m.n, m.n, m.n, gl.RED, gl.FLOAT, m.field);
    let peak = 0;
    for (const v of m.field) peak = Math.max(peak, Math.abs(v));
    m.peak = peak;
  },
  draw(signed) {
    if (!this.tex) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, this.tex);
    pass(PROG.vol, null, {}, { uRes: [canvas.width, canvas.height], uGain: 1 / Math.max(1e-6, this.last.peak * 0.75), uYaw: this.yaw, uPitch: this.pitch, uSigned: signed ? 1 : 0 });
  },
};
