// Moire: beat period along y against p/(2 sin(a/2)), from a column-averaged render, by a scan for the strongest sinusoid.
function moireCheck(deg, pit) {
  const q = {
    ...S,
    kind: "lens",
    shape: "none",
    two: 0,
    inner: null,
    scene: "patterns",
    pt: false,
    meta: false,
    frame: 0,
    zoom: 1,
    dist: 5,
    yaw: 0,
    pitch: 0,
    tilt: 0,
    spin: 0,
    ap: 0,
    disp: 0,
    polA: 0,
    polP: 0,
    patK: 0,
    moA: deg,
    moP: pit,
    persp: "look",
    scatOn: false,
    morphOn: false,
    absA: [0, 0, 0],
  };
  turing();
  const w = 1024,
    h = 1024,
    px = renderMean(q, w, h, 24);
  const hh = (2 * 11 * Math.tan(Math.atan(0.45))) / h;
  const prof = new Float64Array(h);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) s += px[(y * w + x) * 4 + 1];
    prof[y] = s / w;
  }
  const mean = prof.reduce((a, b) => a + b) / h;
  const pred = pit / (2 * Math.sin((deg * Math.PI) / 360));
  let best = 0,
    bp = 0;
  for (let P = pred * 0.5; P < pred * 1.6; P += pred * 0.002) {
    let c = 0,
      s = 0;
    for (let y = 0; y < h; y++) {
      const a = (2 * Math.PI * y * hh) / P;
      c += (prof[y] - mean) * Math.cos(a);
      s += (prof[y] - mean) * Math.sin(a);
    }
    const m = c * c + s * s;
    if (m > best) {
      best = m;
      bp = P;
    }
  }
  reset();
  return { pred, m: bp, err: (100 * (bp - pred)) / pred };
}
