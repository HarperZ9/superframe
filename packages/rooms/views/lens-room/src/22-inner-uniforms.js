function setInner(St, mode) {
  if (!U.uIO) return;
  const ov = St.ioOverride;
  const d = ov ? { io: ov, ca: [], cb: [], ip: -99, lamp: null } : innerData(St);
  useLens(St);
  const pad = (a, n) => {
    const f = new Float32Array(n);
    f.set(a.slice(0, n));
    return f;
  };
  gl.uniform4fv(U.uIO, pad(d.io, 56));
  gl.uniform4fv(U.uCa, pad(d.ca, 96));
  gl.uniform4fv(U.uCb, pad(d.cb, 96));
  sI("uNIO", Math.min(14, d.io.length / 4));
  sI("uNC", Math.min(24, d.ca.length / 4));
  sF("uIP", d.ip);
  sI("uFive", 6);
  sI("uInner", mode == 0 || St.innerProbe ? 1 : 0);
  if (U.uLampI) gl.uniform4fv(U.uLampI, d.lamp ? new Float32Array(d.lamp) : new Float32Array(4));
}
