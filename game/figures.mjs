// The people of Gullet, drawn by the game: ink silhouettes with the town's proportions, each with
// one thing you can read from across the quay (a hat, a surplice, a rope, an apron). Under the
// sodium there is no colour, so each design is built on value: black against white, a pale collar,
// a dark cap. The light colours by tone: deep orange in the mids, cream in the highlights, never
// pink. In paraffin rooms the true colours come back.
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);

// Each part: value v (0 black .. 1 white) and its true colour c for honest light.
export const PEOPLE = {
  lamb: { h: 1.95, head: 0.24, neck: 0.28, stoop: 0.12, girth: 0.33, coat: { v: 0.22, c: [0.24, 0.22, 0.26] }, collar: { v: 0.85, c: [0.88, 0.85, 0.78] }, skin: { v: 0.6, c: [0.86, 0.68, 0.56] }, hat: "brim", hatV: 0.08, lantern: true, skirt: 1.0 },
  keel: { h: 2.4, head: 0.25, neck: 0.48, stoop: 0.32, girth: 0.34, coat: { v: 0.14, c: [0.1, 0.13, 0.24] }, collar: { v: 0.25, c: [0.16, 0.2, 0.32] }, skin: { v: 0.42, c: [0.6, 0.6, 0.58] }, hat: "peak", hatV: 0.9, buttons: true, drip: true, skirt: 1.05 },
  fennick: { h: 2.35, head: 0.21, neck: 0.6, stoop: 0.08, girth: 0.26, coat: { v: 0.06, c: [0.07, 0.06, 0.08] }, surplice: { v: 0.95, c: [0.96, 0.95, 0.9] }, skin: { v: 0.62, c: [0.86, 0.72, 0.62] }, hat: "bald", jar: true, skirt: 0.95 },
  merrow: { h: 1.68, head: 0.29, neck: 0.12, stoop: 0.5, girth: 0.44, coat: { v: 0.66, c: [0.85, 0.72, 0.2] }, collar: { v: 0.1, c: [0.12, 0.1, 0.08] }, skin: { v: 0.45, c: [0.7, 0.52, 0.42] }, hat: "cap", hatV: 0.1, rope: true, skirt: 0.8 },
  marrow: { h: 2.1, head: 0.3, neck: 0.18, stoop: 0.16, girth: 0.56, coat: { v: 0.18, c: [0.2, 0.22, 0.3] }, apron: { v: 0.92, c: [0.92, 0.9, 0.86] }, skin: { v: 0.6, c: [0.86, 0.62, 0.5] }, hat: "band", hatV: 0.95, skirt: 0.85 },
  sabine: { h: 1.75, head: 0.27, neck: 0.15, stoop: 0.18, girth: 0.5, coat: { v: 0.12, c: [0.18, 0.1, 0.12] }, apron: { v: 0.9, c: [0.93, 0.9, 0.84] }, skin: { v: 0.62, c: [0.88, 0.66, 0.54] }, hat: "bun", hatV: 0.35, fork: true, skirt: 1.0 },
  wenna: { h: 1.55, head: 0.33, neck: 0.1, stoop: 0.42, girth: 0.36, coat: { v: 0.28, c: [0.45, 0.12, 0.1] }, collar: { v: 0.2, c: [0.3, 0.08, 0.08] }, skin: { v: 0.6, c: [0.86, 0.7, 0.6] }, hat: "crop", hatV: 0.95, skirt: 1.0 },
};

// colour of a part: under sodium a tone ramp; in honest light the part's own colour
function tone(part, light, sodium) {
  const v = part.v * light;
  if (sodium > 0.5) { const t = clamp(v); return [clamp(0.06 + 1.15 * Math.pow(t, 0.85)), clamp(0.03 + 0.78 * Math.pow(t, 1.15)), clamp(0.04 + 0.42 * Math.pow(t, 2.0))]; }
  return part.c.map((c) => clamp(c * light * 1.1 + 0.02));
}
const css = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

// Draw one person. f: { who, pos, face, walking }; env: { world, W, H, t, light, sodium, side }
// light 0..1 (how lit the person is), sodium 0..1, side +1 when the light is on the right.
export function drawPerson(g, scratch, f, env) {
  const { world, W, H, t } = env, D = PEOPLE[f.who] || PEOPLE.lamb, face = f.face || 1;
  const project = (p) => world.project(world.camera, W, H, p);
  const [fx, fy, fz] = project(f.pos), [, hy] = project([f.pos[0], f.pos[1] + D.h, f.pos[2]]), px = (1.2 * Math.max(8, fy - hy)) / D.h;
  const bw = Math.ceil(px * 2.0), bh = Math.ceil(px * (D.h + 0.7)), ox = Math.round(fx - bw / 2), oy = Math.round(fy - bh + 6);
  scratch.width = bw; scratch.height = bh; const s = scratch.getContext("2d"); s.clearRect(0, 0, bw, bh);
  const X = (m) => bw / 2 + m * px * face, Y = (m) => bh - 6 - m * px, L = env.light, Sd = env.sodium;
  const bob = f.walking ? Math.abs(Math.sin(t * 8)) * 0.04 : 0, step = f.walking ? Math.sin(t * 8) * 0.12 : 0, hh = D.h + bob;
  const ink = "rgba(22,10,18,0.95)", lw = Math.max(1.4, px * 0.045);
  // ground shadow
  s.fillStyle = "rgba(8,4,10,0.5)"; s.beginPath(); s.ellipse(bw / 2, bh - 6, D.girth * 2.3 * px, D.girth * 0.65 * px, 0, 0, Math.PI * 2); s.fill();
  // legs (seen under the coat when walking)
  s.strokeStyle = css(tone({ v: 0.1, c: [0.1, 0.08, 0.1] }, L, Sd)); s.lineWidth = Math.max(2, px * 0.12); s.lineCap = "round";
  for (const k of [-1, 1]) { s.beginPath(); s.moveTo(X(k * D.girth * 0.35), Y(hh * 0.3)); s.lineTo(X(k * D.girth * 0.35 + k * step), Y(0.03)); s.stroke(); }
  // the coat: shoulders, a long skirt flaring at the hem
  const sh = hh * 0.8, hem = hh * (1 - D.skirt) * 0.35 + 0.18, g0 = D.girth;
  const coatPath = () => { s.beginPath(); s.moveTo(X(-g0 * 1.25), Y(hem)); s.quadraticCurveTo(X(0), Y(hem - 0.06), X(g0 * 1.2 + D.stoop * 0.25), Y(hem));
    s.quadraticCurveTo(X(g0 * 1.15 + D.stoop * 0.3), Y(sh * 0.55), X(g0 * 0.95 + D.stoop * 0.55), Y(sh)); s.quadraticCurveTo(X(D.stoop * 0.45), Y(sh + 0.1), X(-g0 * 0.8 + D.stoop * 0.35), Y(sh - 0.02));
    s.quadraticCurveTo(X(-g0 * 1.15), Y(sh * 0.5), X(-g0 * 1.25), Y(hem)); s.closePath(); };
  coatPath(); s.fillStyle = css(tone(D.coat, L, Sd)); s.fill();
  // surplice or apron over it: the pale shape that reads from across the quay
  const over = D.surplice || D.apron;
  if (over) { s.save(); coatPath(); s.clip(); s.fillStyle = css(tone(over, L, Sd)); s.beginPath();
    if (D.surplice) { s.moveTo(X(-g0 * 1.1), Y(hh * 0.33)); s.quadraticCurveTo(X(0), Y(hh * 0.27), X(g0 * 1.25), Y(hh * 0.35)); s.lineTo(X(g0 * 0.8 + D.stoop * 0.5), Y(sh + 0.05)); s.lineTo(X(-g0 * 0.7 + D.stoop * 0.3), Y(sh)); }
    else { s.moveTo(X(-g0 * 0.55), Y(hem + 0.05)); s.lineTo(X(g0 * 0.7), Y(hem + 0.05)); s.lineTo(X(g0 * 0.55 + D.stoop * 0.3), Y(sh * 0.82)); s.lineTo(X(-g0 * 0.35 + D.stoop * 0.25), Y(sh * 0.82)); }
    s.closePath(); s.fill(); s.restore(); }
  // the shade: the side away from the light
  s.save(); coatPath(); s.clip(); s.fillStyle = "rgba(10,4,12,0.42)"; const away = (env.side || 1) * face > 0 ? -1 : 1;
  s.fillRect(Math.min(X(0), X(away * g0 * 2)), 0, Math.abs(X(away * g0 * 2) - X(0)), bh); s.restore();
  coatPath(); s.strokeStyle = ink; s.lineWidth = lw; s.stroke();
  if (D.buttons) { s.fillStyle = css(tone({ v: 0.95, c: [0.9, 0.75, 0.4] }, L, Sd)); for (let k = 0; k < 4; k++) { s.beginPath(); s.arc(X(D.stoop * 0.3 + 0.02), Y(sh * (0.45 + k * 0.12)), Math.max(1, px * 0.03), 0, 7); s.fill(); } }
  if (D.collar) { s.fillStyle = css(tone(D.collar, L, Sd)); s.beginPath(); s.ellipse(X(D.stoop * 0.5), Y(sh + 0.02), g0 * 0.75 * px, 0.08 * px, 0, 0, 7); s.fill(); }
  // an arm, to the knee, the hand pale
  const handX = g0 * 1.05 + 0.12 + step * 0.8, handY = hh * 0.3;
  s.strokeStyle = css(tone(D.coat, L * 0.9, Sd)); s.lineWidth = Math.max(2, px * 0.13);
  s.beginPath(); s.moveTo(X(g0 * 0.8 + D.stoop * 0.45), Y(sh - 0.05)); s.quadraticCurveTo(X(g0 * 1.2), Y(hh * 0.55), X(handX), Y(handY)); s.stroke();
  s.fillStyle = css(tone(D.skin, L, Sd)); s.beginPath(); s.ellipse(X(handX), Y(handY - 0.04), 0.07 * px, 0.1 * px, 0, 0, 7); s.fill();
  // neck, the heavy head, the nose
  const hx = X(D.stoop * 0.55 + D.neck * 0.55), hyy = Y(sh + D.neck + D.head * 0.75);
  s.strokeStyle = css(tone(D.skin, L * 0.8, Sd)); s.lineWidth = Math.max(2, px * 0.1); s.beginPath(); s.moveTo(X(D.stoop * 0.5), Y(sh)); s.lineTo(hx, hyy + D.head * 0.5 * px); s.stroke();
  s.fillStyle = css(tone(D.skin, L, Sd)); s.strokeStyle = ink; s.lineWidth = lw;
  s.beginPath(); s.ellipse(hx, hyy, D.head * 1.1 * px, D.head * px, 0, 0, 7); s.fill(); s.stroke();
  s.beginPath(); s.ellipse(hx + D.head * 1.0 * px * face, hyy + D.head * 0.2 * px, D.head * 0.5 * px, D.head * 0.2 * px, 0, 0, 7); s.fill(); s.stroke();
  s.fillStyle = ink; s.beginPath(); s.arc(hx + D.head * 0.45 * px * face, hyy - D.head * 0.15 * px, Math.max(1, px * 0.03), 0, 7); s.fill();
  // what is on the head
  const hatC = css(tone({ v: D.hatV ?? 0.1, c: D.hatV > 0.5 ? [0.9, 0.88, 0.84] : [0.08, 0.07, 0.08] }, L, Sd));
  s.fillStyle = hatC;
  if (D.hat === "brim") { s.beginPath(); s.ellipse(hx, hyy - D.head * 0.55 * px, D.head * 2.0 * px, D.head * 0.28 * px, 0, 0, 7); s.fill(); s.stroke(); s.fillRect(hx - D.head * 0.9 * px, hyy - D.head * 1.25 * px, D.head * 1.8 * px, D.head * 0.7 * px); }
  if (D.hat === "peak") { s.fillRect(hx - D.head * 1.0 * px, hyy - D.head * 1.35 * px, D.head * 2.0 * px, D.head * 0.6 * px); s.fillStyle = css(tone({ v: 0.08, c: [0.08, 0.08, 0.12] }, L, Sd)); s.fillRect(hx - D.head * 1.05 * px, hyy - D.head * 0.8 * px, D.head * 2.1 * px, D.head * 0.25 * px); s.beginPath(); s.ellipse(hx + D.head * 1.1 * px * face, hyy - D.head * 0.7 * px, D.head * 0.6 * px, D.head * 0.12 * px, 0, 0, 7); s.fill(); }
  if (D.hat === "cap") { s.beginPath(); s.ellipse(hx, hyy - D.head * 0.6 * px, D.head * 1.25 * px, D.head * 0.45 * px, 0, Math.PI, 0); s.fill(); s.beginPath(); s.ellipse(hx + D.head * 1.0 * px * face, hyy - D.head * 0.6 * px, D.head * 0.6 * px, D.head * 0.12 * px, 0, 0, 7); s.fill(); }
  if (D.hat === "band") { s.fillRect(hx - D.head * 1.1 * px, hyy - D.head * 0.15 * px + D.head * 1.3 * px, D.head * 2.2 * px, D.head * 0.3 * px); }
  if (D.hat === "bun") { s.beginPath(); s.arc(hx - D.head * 0.7 * px * face, hyy - D.head * 0.9 * px, D.head * 0.5 * px, 0, 7); s.fill(); s.stroke(); }
  if (D.hat === "crop") { s.beginPath(); s.ellipse(hx - D.head * 0.15 * px * face, hyy - D.head * 0.45 * px, D.head * 1.05 * px, D.head * 0.6 * px, 0, Math.PI, 0); s.fill(); }
  if (D.fork) { s.strokeStyle = css(tone({ v: 0.8, c: [0.75, 0.75, 0.78] }, L, Sd)); s.lineWidth = Math.max(1, px * 0.03); s.beginPath(); s.moveTo(hx - D.head * 0.9 * px * face, hyy - D.head * 0.5 * px); s.lineTo(hx - D.head * 1.6 * px * face, hyy - D.head * 1.6 * px); s.stroke(); }
  if (D.rope) { s.strokeStyle = css(tone({ v: 0.55, c: [0.6, 0.5, 0.32] }, L, Sd)); s.lineWidth = Math.max(2, px * 0.07); s.beginPath(); s.ellipse(X(-g0 * 0.2), Y(sh - 0.15), g0 * 0.9 * px, g0 * 0.5 * px, 0.4, 0, 7); s.stroke(); }
  if (D.jar) { const jx = X(-g0 * 1.2), jy = Y(hh * 0.5); s.fillStyle = "rgba(220,235,240,0.18)"; s.strokeStyle = "rgba(240,240,230,0.7)"; s.lineWidth = Math.max(1, px * 0.025); s.beginPath(); s.arc(jx, jy, 0.18 * px, Math.PI, 0); s.lineTo(jx + 0.18 * px, jy + 0.16 * px); s.lineTo(jx - 0.18 * px, jy + 0.16 * px); s.closePath(); s.fill(); s.stroke(); }
  if (D.drip) { s.fillStyle = "rgba(255,210,150,0.55)"; for (let k = 0; k < 6; k++) { const d = ((t * 1.2 + k * 0.17) % 1); s.fillRect(X(handX) - 1 + (k % 2) * 3, Y(handY - 0.1 - d * handY * 0.9), 1.5, 3); } }
  // hide whatever the painting puts in front of the person
  const img = s.getImageData(0, 0, bw, bh), d = img.data;
  for (let y = 0; y < bh; y++) { const sy = oy + y; if (sy < 0 || sy >= H) continue; for (let x = 0; x < bw; x++) { const sx = ox + x; if (sx < 0 || sx >= W) continue; if (world.depth[sy * W + sx] < fz - 0.7) d[(y * bw + x) * 4 + 3] = 0; } }
  s.putImageData(img, 0, 0); g.drawImage(scratch, ox, oy);
  if (D.lantern) {
    const lx = ox + X(handX), ly = oy + Y(handY - 0.06), r = px * 1.7;
    g.save(); g.globalCompositeOperation = "lighter"; const gr = g.createRadialGradient(lx, ly, 1, lx, ly, r);
    gr.addColorStop(0, "rgba(255,236,190,0.95)"); gr.addColorStop(0.15, "rgba(255,200,120,0.45)"); gr.addColorStop(1, "rgba(255,160,80,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(lx, ly, r, 0, Math.PI * 2); g.fill(); g.restore();
  }
  return { x: fx, y: fy, top: hy };
}
