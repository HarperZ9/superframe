// The tilt-shift lens on the painted plate (design/sensory/08-FOCUS.md; raw-native P23, PR #211). A WebGL2
// canvas sits between the plate and the blackout plate inside the plate camera's wrap, over the part of the
// plate in view. Where a plate pixel's circle of confusion (its world point from geo-pos.f32 against the
// director's tilted plane of focus) passes 1 px, it is repainted coarser: a sector Kuwahara at half resolution
// whose radius follows the CoC, mixed in by smoothstep(1, 2.5, c) with a rim guard round nearer in-focus
// things. Figures are drawn above it and stay as painted. Focus follows story intent through fx/focus.mjs.
// Differences from raw-native, recorded: the Kuwahara averages sRGB colour, not pigment latents; it is
// isotropic (no structure tensor); the plate's ink is baked in, so it fades only as the Kuwahara drops it; the
// rim guard reads the half-size geo buffer. Settings: ?tilt=daily|town_map|record|memory|dream|night (off by
// default, see tiltSettings). Stats on globalThis.__lwTilt.
//   const T = installTiltShift(ctx, host, api); T.stop()
// The shaders and their helpers (VS, FS1, FS2, tables, program) are exported for the cinematics' lens (cine/lens.mjs).
import { Director, LOOKS, lensOf } from "./focus.mjs";

export const VS = `#version 300 es
in vec2 a; out vec2 uv; void main() { uv = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }`;
// shared: the lens (as fx/focus.mjs cocAt) on a world point read from the geo texture
const LENS = `
uniform sampler2D geo; uniform vec3 eye, fwd, pn; uniform float pd, fpx, fmm, mmu, fN, cMax, ortho, geoScale;
float cocOf(vec3 P) {
  vec3 r = P - eye; float z = dot(r, fwd); if (z <= 1e-6) return 0.0;
  vec3 dir = ortho > 0.5 ? fwd : normalize(r); vec3 o = ortho > 0.5 ? P - fwd * z : eye;
  float dn = dot(dir, pn), tP = abs(dn) > 1e-12 ? (pd - dot(o, pn)) / dn : -1.0, cosA = ortho > 0.5 ? 1.0 : dot(dir, fwd), Z = z * mmu, c;
  if (tP <= 0.0) c = fpx * fmm / (fN * Z); else { float S = max(tP * cosA * mmu, 2.0 * fmm); c = fpx * fmm * abs(Z - S) / (fN * Z * (S - fmm)); }
  return min(c, cMax);
}
vec4 geoAt(vec2 platePx) { ivec2 s = textureSize(geo, 0); ivec2 q = clamp(ivec2(floor(platePx * geoScale)), ivec2(0), s - 1); return texelFetch(geo, q, 0); }
vec2 cz(vec2 platePx) { vec4 g = geoAt(platePx); if (g.w < 0.5) return vec2(0.0, 1e9); return vec2(cocOf(g.xyz), dot(g.xyz - eye, fwd)); }`;
// pass 1: the coarse paint at half resolution of the region
export const FS1 = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D plate; uniform vec2 org, half_, plateSize; uniform float plateScale; uniform vec2 disc[48]; uniform vec4 wk4[96];
float wk(int s, int k) { vec4 v = wk4[s * 2 + k / 4]; int j = k - (k / 4) * 4; return j == 0 ? v.x : j == 1 ? v.y : j == 2 ? v.z : v.w; }
vec3 plateAt(vec2 p) { return texelFetch(plate, ivec2(clamp(floor(p * plateScale), vec2(0.0), plateSize - 1.0)), 0).rgb; }
${LENS}
void main() {
  vec2 hp = floor(uv * half_), p = org + hp * 2.0 + 1.0; vec2 c0 = cz(p);
  vec3 src = plateAt(p);
  if (c0.x <= 1.0) { o = vec4(src, 0.0); return; }
  float rad = 0.5 * c0.x; float W[8], M[24], S[24];
  for (int k = 0; k < 8; k++) W[k] = 0.0; for (int k = 0; k < 24; k++) { M[k] = 0.0; S[k] = 0.0; }
  vec3 cs[48]; float wo[48];
  for (int s = 0; s < 48; s++) {
    vec2 off = disc[s] * rad, q = floor(p + off) + 0.5;
    vec3 col = plateAt(q); vec2 cq = cz(q); float w = 1.0;
    if (cq.y < c0.y) w = clamp(0.5 * cq.x - length(off) + 1.0, 0.0, 1.0);
    cs[s] = col; wo[s] = w;
    for (int k = 0; k < 8; k++) { float g = wk(s, k) * w; W[k] += g; for (int j = 0; j < 3; j++) { M[k * 3 + j] += g * col[j]; S[k * 3 + j] += g * col[j] * col[j]; } }
  }
  float al[8];
  for (int k = 0; k < 8; k++) {
    al[k] = 0.0; if (W[k] <= 0.0) continue;
    float v = 0.0; for (int j = 0; j < 3; j++) { float m = M[k * 3 + j] / W[k]; v += max(0.0, S[k * 3 + j] / W[k] - m * m); }
    float sd = sqrt(v) * 255.0; al[k] = 1.0 / (1.0 + (sd > 1e-6 ? pow(sd, 8.0) : 0.0)) / W[k];
  }
  vec3 acc = vec3(0.0); float ws = 0.0;
  for (int s = 0; s < 48; s++) { float cw = 0.0; for (int k = 0; k < 8; k++) cw += al[k] * wk(s, k); cw *= wo[s]; ws += cw; acc += cw * cs[s]; }
  o = vec4(ws > 0.0 ? acc / ws : src, 1.0);
}`;
// pass 2: the region at plate resolution, premultiplied by the weight
export const FS2 = `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D coarse; uniform vec2 org, size;
${LENS}
void main() {
  // the canvas shows GL row 0 at its bottom: plate rows run down the canvas, so the row is flipped here (2026-10-22: it
  // was not, and the lens drew the plate upside down wherever it painted, the "roof paint for wall paint" glitch)
  vec2 lp = floor(vec2(uv.x, 1.0 - uv.y) * size), p = org + lp + 0.5; vec2 c0 = cz(p);
  float w = smoothstep(1.0, 2.5, c0.x);
  if (w > 0.0) for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) { vec2 q = cz(p + vec2(dx, dy) * 2.0); if (q.x <= 1.0 && q.y < 0.98 * c0.y) w = 0.0; }
  vec3 c = texture(coarse, (lp + 0.5) / size).rgb;
  o = vec4(c * w, w);
}`;

export function tables() {
  const zeta = 0.33, eta = (zeta + Math.cos(Math.PI / 8)) / Math.sin(Math.PI / 8) ** 2, disc = [], wk = [];
  for (let i = 0; i < 48; i++) {
    const r = Math.sqrt((i + 0.5) / 48), a = i * 2.399963229728653, u = r * Math.cos(a), v = r * Math.sin(a), g = Math.exp(-2 * (u * u + v * v));
    disc.push(u, v);
    for (let k = 0; k < 8; k++) { const an = (-2 * Math.PI * k) / 8, xk = u * Math.cos(an) - v * Math.sin(an), yk = u * Math.sin(an) + v * Math.cos(an), z = xk + zeta - eta * yk * yk; wk.push(z > 0 ? z * z * g : 0); }
  }
  return { disc: new Float32Array(disc), wk: new Float32Array(wk) };
}

export function program(gl, fs) {
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

// Behind a flag for now (2026-10-22): off unless ?tilt=<look> is given (or localStorage lw.tilt). The daily look
// reads as intended; the dream look's strong isotropic Kuwahara swaps roof paint for wall paint across edges and
// reads as a glitch (game/capture/focus-2026-10-22), so the default waits for the structure tensor and a
// gentler dream strength.
export function tiltSettings(q) {
  let v = q && q.get("tilt");
  if (!v) { try { v = localStorage.getItem("lw.tilt"); } catch { v = null; } }
  if (!v || v === "off") return null;
  return LOOKS[v] ? v : "daily";
}

export function installTiltShift(ctx, host, api) {
  const look0 = tiltSettings(ctx.q);
  const stats = { on: false, look: look0, ms: 0, renders: 0, intent: "", target: "", fNumber: 0, error: "" };
  globalThis.__lwTilt = { stats };
  if (!look0) return { stop() {}, stats };
  const G = ctx.G, cv = document.createElement("canvas");
  cv.className = "platecam-tilt"; cv.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;transform-origin:0 0";
  const gl = cv.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) { stats.error = "no WebGL2"; return { stop() {}, stats }; }
  let P1, P2;
  try { P1 = program(gl, FS1); P2 = program(gl, FS2); } catch (e) { stats.error = String(e.message || e); console.warn(`tiltshift: ${stats.error}`); return { stop() {}, stats }; }
  const T = tables(), quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const tex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
  const plateT = tex(), geoT = tex(), coarseT = tex(), fb = gl.createFramebuffer();
  gl.bindTexture(gl.TEXTURE_2D, coarseT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  let raf = 0, stopped = false, pj = null, placeKey = "", plateKey = "", plateW = 0, plateH = 0, dir = null, dirKey = "", last = performance.now(), lastSig = "", query = null, loading = false;

  async function loadPlace() {
    const pjNow = api.cam.place && api.cam.place();
    if (!pjNow || loading) return;
    const key = `${pjNow.place}|${pjNow.width}`; if (key === placeKey) return;
    loading = true;
    try {
      const b = await (await fetch(`/content/${pjNow.place}/geo-pos.f32`)).arrayBuffer(), pos = new Float32Array(b), s = pjNow.geoScale || 1;
      const gw = Math.round(pjNow.width * s), gh = Math.round(pjNow.height * s), rgba = new Float32Array(gw * gh * 4);
      for (let i = 0; i < gw * gh; i++) {
        const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], hit = Number.isFinite(x + y + z) && !(x === 0 && y === 0 && z === 0) && y < 999;
        rgba[i * 4] = hit ? x : 0; rgba[i * 4 + 1] = hit ? y : 0; rgba[i * 4 + 2] = hit ? z : 0; rgba[i * 4 + 3] = hit ? 1 : 0;
      }
      gl.bindTexture(gl.TEXTURE_2D, geoT); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, gw, gh, 0, gl.RGBA, gl.FLOAT, rgba);
      pj = pjNow; placeKey = key; plateKey = ""; dir = null;
    } catch (e) { stats.error = `geo: ${e.message}`; console.warn(`tiltshift: no geo buffer for ${pjNow.place} (${e.message}); the lens is off here`); placeKey = key; pj = null; }
    finally { loading = false; }
  }

  const figs = () => { try { return api.people.figures(true); } catch { return []; } };
  const head = (f) => [f.at[0], (f.at[1] || 0) + 1.6, f.at[2]], body = (f) => [f.at[0], (f.at[1] || 0) + 0.9, f.at[2]];
  const events = [];
  const offs = [];
  if (G && G.on) {
    const near = (who) => figs().find((f) => f.who === who);
    offs.push(G.on("sneak.noise", (e) => events.push({ p: [e.x, 1, e.z], kind: "noise", salience: 0.8 })));
    offs.push(G.on("stealth.noticed", () => { const f = figs().find((x) => x.who !== "lamb"); if (f) events.push({ p: head(f), kind: "noticed", salience: 0.7 }); }));
    offs.push(G.on("voice.bark", (e) => { const f = e && e.who ? near(e.who) : null; if (f) events.push({ p: head(f), kind: "bark", salience: 0.6 }); }));
  }

  function inputs() {
    const F = figs(), lamb = F.find((f) => f.who === "lamb"), player = lamb ? body(lamb) : (G.state.pos ? [G.state.pos[0], (G.state.pos[1] || 0) + 0.9, G.state.pos[2]] : [0, 0.9, 0]);
    const doc = document.documentElement, others = F.filter((f) => f.who !== "lamb");
    const fighting = !!document.querySelector(".fighting") || !!(G.ext && G.ext.combat && G.ext.combat.current && !G.ext.combat.current.W.result);
    const talking = !fighting && (!!document.querySelector(".talking") || !!G.activeTalk), req = globalThis.__lwFocusRequest, dream = (G.state.dream || 0) > 0.3;
    const dist = (f) => Math.hypot(f.at[0] - player[0], f.at[2] - player[2]);
    let speaker = null;
    if (talking) { const id = G.activeTalk && G.activeTalk.speaker, byId = others.find((f) => f.who === id); speaker = byId || others.slice().sort((a, b) => dist(a) - dist(b))[0] || null; }
    const intent = fighting ? "fight" : talking ? "talk" : req && req.at ? "examine" : dream ? "dream" : "walk";
    const fighters = fighting ? [player, ...(lamb ? [head(lamb)] : []), ...others.filter((f) => dist(f) < 10).flatMap((f) => [body(f), head(f)])] : [];
    return { intent, player, speaker: speaker ? head(speaker) : null, prop: req && req.at, fighters, living: others.filter((f) => f.walking || dist(f) < 25).map((f) => ({ p: head(f), id: f.who, salience: 0.5 })),
      events: events.splice(0), playerMoving: !!(lamb && lamb.walking), reducedMotion: doc.classList.contains("calm") || matchMedia("(prefers-reduced-motion: reduce)").matches };
  }

  function frame(now) {
    if (stopped) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const wrap = host.querySelector(".platecam:not(.platecam-lens)"), img = wrap && wrap.querySelector("canvas.platecam-img"), view = api.cam.frameNow && api.cam.frameNow();
    if (!wrap || !img || !view || !img.width) { cv.hidden = true; return; }
    if (cv.parentNode !== wrap) wrap.insertBefore(cv, img.nextSibling);   // above the plate, under the blackout plate and every figure
    loadPlace();
    if (!pj) { cv.hidden = true; return; }
    const lookName = (pj.place === "q_town" ? "town_map" : (G.state.dream || 0) > 0.3 ? "dream" : look0), dk = `${pj.place}|${lookName}`;
    if (!dir || dirKey !== dk) { dir = new Director(lookName === "dream" ? "child" : lookName === "record" ? "accuser" : "naturalist", lensOf(LOOKS[lookName], [0, 0.9, 0]), pj.camera); dirKey = dk; }
    const s = dir.step(inputs(), dt);
    stats.intent = dir.last; stats.target = s.target; stats.fNumber = +s.fNumber.toFixed(2); stats.look = lookName;
    // upload the plate when it changes (a new place, a variant swap or the lens mix redrawn by the plate camera)
    const pk = `${pj.place}|${img.width}x${img.height}|${wrap.dataset.variant || ""}|${img.dataset.v || ""}`;
    if (pk !== plateKey) { gl.bindTexture(gl.TEXTURE_2D, plateT); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img); plateKey = pk; plateW = img.width; plateH = img.height; lastSig = ""; }
    // the region in view, in plate pixels, with a margin for the gather
    // the view in place pixels (pj.width x pj.height); a 4K plate image is twice them (plateScale)
    const z = view.zoom, m = 32, sc = plateW / pj.width, rx = Math.max(0, Math.floor(view.left) - m), ry = Math.max(0, Math.floor(view.top) - m);
    const rw = Math.max(1, Math.min(pj.width - rx, Math.ceil(view.w || (wrap.clientWidth || 1920) / z) + 2 * m)), rh = Math.max(1, Math.min(pj.height - ry, Math.ceil(view.h || (wrap.clientHeight || 1080) / z) + 2 * m));
    cv.hidden = false;
    cv.style.width = `${rw * z}px`; cv.style.transform = `translate(${(rx - view.left) * z}px, ${(ry - view.top) * z}px)`;
    const sig = `${rx},${ry},${rw},${rh},${z.toFixed(3)},${s.focus.map((v) => v.toFixed(4))},${s.tiltDeg.toFixed(3)},${s.fNumber.toFixed(4)},${plateKey}`;
    if (sig === lastSig) return;   // nothing moved: the canvas keeps its last frame
    lastSig = sig;
    const t0 = performance.now();
    if (cv.width !== rw || cv.height !== rh) { cv.width = rw; cv.height = rh; }
    // the CoC is in plate pixels, but the cap is a screen size: 48 px at 1080 lines, so 48 / zoom plate pixels
    // (a large Kuwahara radius moves edges by up to its radius; magnified by the zoom it doubled the houses)
    const g = dir.geom(pj.width, pj.height, 1080), hw = Math.ceil(rw / 2), hh = Math.ceil(rh / 2);
    g.cMax = (48 * ((wrap.clientHeight || 1080) / 1080)) / Math.max(1, z);
    gl.bindTexture(gl.TEXTURE_2D, coarseT); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, hw, hh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const lensU = (p) => {
      const u = (n) => gl.getUniformLocation(p, n);
      gl.uniform3fv(u("eye"), g.eye); gl.uniform3fv(u("fwd"), g.fwd); gl.uniform3fv(u("pn"), g.n);
      gl.uniform1f(u("pd"), g.d); gl.uniform1f(u("fpx"), g.fpx); gl.uniform1f(u("fmm"), g.fmm); gl.uniform1f(u("mmu"), g.mmPerUnit); gl.uniform1f(u("fN"), g.N);
      gl.uniform1f(u("cMax"), g.cMax); gl.uniform1f(u("ortho"), g.ortho ? 1 : 0); gl.uniform1f(u("geoScale"), pj.geoScale || 1);
      gl.uniform2f(u("org"), rx, ry);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, geoT); gl.uniform1i(u("geo"), 1);
    };
    const draw = (p) => { const a = gl.getAttribLocation(p, "a"); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
    if (query && gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) { if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) stats.gpuMs = +(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6).toFixed(3); gl.deleteQuery(query); query = null; }
    const timing = !!timer && !query; if (timing) { query = gl.createQuery(); gl.beginQuery(timer.TIME_ELAPSED_EXT, query); }
    gl.useProgram(P1); lensU(P1);
    gl.uniform2f(gl.getUniformLocation(P1, "half_"), hw, hh); gl.uniform2f(gl.getUniformLocation(P1, "plateSize"), plateW, plateH);
    gl.uniform2fv(gl.getUniformLocation(P1, "disc"), T.disc); gl.uniform4fv(gl.getUniformLocation(P1, "wk4"), T.wk); gl.uniform1f(gl.getUniformLocation(P1, "plateScale"), sc);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, plateT); gl.uniform1i(gl.getUniformLocation(P1, "plate"), 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, coarseT, 0); gl.viewport(0, 0, hw, hh); draw(P1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, rw, rh);
    gl.useProgram(P2); lensU(P2); gl.uniform2f(gl.getUniformLocation(P2, "size"), rw, rh);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, coarseT); gl.uniform1i(gl.getUniformLocation(P2, "coarse"), 0);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); draw(P2);
    if (timing) gl.endQuery(timer.TIME_ELAPSED_EXT);
    stats.ms = +(performance.now() - t0).toFixed(2); stats.renders++; stats.on = true; stats.region = [rx, ry, rw, rh];
  }
  raf = requestAnimationFrame(frame);
  return { stats, stop() { stopped = true; cancelAnimationFrame(raf); for (const o of offs) if (typeof o === "function") o(); cv.remove(); } };
}
