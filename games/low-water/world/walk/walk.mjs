// Walk or fly the island. One WebGPU device from the engine's web host (native/web/raw-gpu.mjs),
// four passes: sky, ground, masses, water. The clock, the weather and the sky events come from
// world/weather.mjs; the ground, the settlements and the landmarks from the generated world.
//
//   ?world=out/20261118   which generated world to load (under games/low-water/world/)
//   ?x=&z=&alt=&yaw=&pitch=&clock=&day=&fly=1   a starting view (km, m, degrees, hours)
//   ?still=1              hold the clock (for stills); ?quality=0.5 scales tree and grass reach
import { createHost } from "/rn/web/raw-gpu.mjs";
import { loadWorld, groundAt, regionAt, waterAt, bakeMaps, heightPyramid } from "./data.mjs";
import { selectNodes, frustumPlanes } from "./lod.mjs";
import { MESHES, architecture, flora } from "./masses.mjs";
import { frameLight } from "./light.mjs";
import { sky as skyAt, makeRegionField } from "../weather.mjs";

const Q = new URLSearchParams(location.search), num = (k, d) => Q.has(k) ? +Q.get(k) : d;
const canvas = document.getElementById("view"), hud = document.getElementById("hud"), note = document.getElementById("note");
const say = (t) => { note.textContent = t; note.hidden = !t; };
const REGION_NAMES = ["Open Sea", "Thaw Country", "The Folded Uplands", "The Fog Forest", "The Storm Coast", "The Canyon and Badlands", "The Marsh", "The City Across the Water", "The Works", "The Monument Ground", "The Drowned Quarter", "The Far-North Works Town"];

// ---------------------------------------------------------------- maths (column-major 4 x 4)
function viewProj(cam, aspect, fovY = 1.05, near = 0.3) {
  const cp = Math.cos(cam.pitch), f = [Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp];           // yaw 0 looks north
  const r = [Math.cos(cam.yaw), 0, Math.sin(cam.yaw)], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const e = [cam.x, cam.y, cam.z], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const V = [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dot(r, e), -dot(u, e), dot(f, e), 1];
  const t = 1 / Math.tan(fovY / 2), P = [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, 0, -1, 0, 0, near, 0];                   // reversed depth, no far plane
  const M = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let rI = 0; rI < 4; rI++) { let s = 0; for (let k = 0; k < 4; k++) s += P[k * 4 + rI] * V[c * 4 + k]; M[c * 4 + rI] = s; }
  return { M, f, r, u };
}
function invert(m) {
  const inv = new Float32Array(16), a = m;
  inv[0] = a[5] * a[10] * a[15] - a[5] * a[11] * a[14] - a[9] * a[6] * a[15] + a[9] * a[7] * a[14] + a[13] * a[6] * a[11] - a[13] * a[7] * a[10];
  inv[4] = -a[4] * a[10] * a[15] + a[4] * a[11] * a[14] + a[8] * a[6] * a[15] - a[8] * a[7] * a[14] - a[12] * a[6] * a[11] + a[12] * a[7] * a[10];
  inv[8] = a[4] * a[9] * a[15] - a[4] * a[11] * a[13] - a[8] * a[5] * a[15] + a[8] * a[7] * a[13] + a[12] * a[5] * a[11] - a[12] * a[7] * a[9];
  inv[12] = -a[4] * a[9] * a[14] + a[4] * a[10] * a[13] + a[8] * a[5] * a[14] - a[8] * a[6] * a[13] - a[12] * a[5] * a[10] + a[12] * a[6] * a[9];
  inv[1] = -a[1] * a[10] * a[15] + a[1] * a[11] * a[14] + a[9] * a[2] * a[15] - a[9] * a[3] * a[14] - a[13] * a[2] * a[11] + a[13] * a[3] * a[10];
  inv[5] = a[0] * a[10] * a[15] - a[0] * a[11] * a[14] - a[8] * a[2] * a[15] + a[8] * a[3] * a[14] + a[12] * a[2] * a[11] - a[12] * a[3] * a[10];
  inv[9] = -a[0] * a[9] * a[15] + a[0] * a[11] * a[13] + a[8] * a[1] * a[15] - a[8] * a[3] * a[13] - a[12] * a[1] * a[11] + a[12] * a[3] * a[9];
  inv[13] = a[0] * a[9] * a[14] - a[0] * a[10] * a[13] - a[8] * a[1] * a[14] + a[8] * a[2] * a[13] + a[12] * a[1] * a[10] - a[12] * a[2] * a[9];
  inv[2] = a[1] * a[6] * a[15] - a[1] * a[7] * a[14] - a[5] * a[2] * a[15] + a[5] * a[3] * a[14] + a[13] * a[2] * a[7] - a[13] * a[3] * a[6];
  inv[6] = -a[0] * a[6] * a[15] + a[0] * a[7] * a[14] + a[4] * a[2] * a[15] - a[4] * a[3] * a[14] - a[12] * a[2] * a[7] + a[12] * a[3] * a[6];
  inv[10] = a[0] * a[5] * a[15] - a[0] * a[7] * a[13] - a[4] * a[1] * a[15] + a[4] * a[3] * a[13] + a[12] * a[1] * a[7] - a[12] * a[3] * a[5];
  inv[14] = -a[0] * a[5] * a[14] + a[0] * a[6] * a[13] + a[4] * a[1] * a[14] - a[4] * a[2] * a[13] - a[12] * a[1] * a[6] + a[12] * a[2] * a[5];
  inv[3] = -a[1] * a[6] * a[11] + a[1] * a[7] * a[10] + a[5] * a[2] * a[11] - a[5] * a[3] * a[10] - a[9] * a[2] * a[7] + a[9] * a[3] * a[6];
  inv[7] = a[0] * a[6] * a[11] - a[0] * a[7] * a[10] - a[4] * a[2] * a[11] + a[4] * a[3] * a[10] + a[8] * a[2] * a[7] - a[8] * a[3] * a[6];
  inv[11] = -a[0] * a[5] * a[11] + a[0] * a[7] * a[9] + a[4] * a[1] * a[11] - a[4] * a[3] * a[9] - a[8] * a[1] * a[7] + a[8] * a[3] * a[5];
  inv[15] = a[0] * a[5] * a[10] - a[0] * a[6] * a[9] - a[4] * a[1] * a[10] + a[4] * a[2] * a[9] + a[8] * a[1] * a[6] - a[8] * a[2] * a[5];
  const det = a[0] * inv[0] + a[1] * inv[4] + a[2] * inv[8] + a[3] * inv[12];
  for (let i = 0; i < 16; i++) inv[i] /= det;
  return inv;
}

// ---------------------------------------------------------------- start
async function start() {
  say("Opening the GPU");
  const host = await createHost({ canvas, timing: false }), dev = host.device, fmt = host.format;
  say("Reading the island");
  const world = await loadWorld(`/world/${Q.get("world") || "out/20261118"}`, (p, n) => say(`Reading the island: ${n} (${Math.round(p * 100)} %)`));
  say("Drawing the ground maps");
  const maps = bakeMaps(world), pyramid = heightPyramid(world), seed = world.json.seed, W = world.W, H = world.H;
  const shares = makeRegionField((x, z) => regionAt(world, x, z), world.width, world.depth);

  const tex = (format, data, bytes) => {
    const t = dev.createTexture({ size: [W, H], format, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST, mipLevelCount: format === "rgba8unorm" ? 3 : 1 });
    dev.queue.writeTexture({ texture: t }, data, { bytesPerRow: W * bytes }, [W, H]);
    return t;
  };
  const heightTex = tex("r32float", world.height, 4), waterTex = tex("r32float", world.water, 4), albTex = tex("rgba8unorm", maps.alb, 4), auxTex = tex("rgba8unorm", maps.aux, 4);
  // two coarser levels of the aux map, by box average, for the lamp reflections on water
  for (const t of [albTex, auxTex]) {
    let src = t === albTex ? maps.alb : maps.aux, w = W, h = H;
    for (let l = 1; l < 3; l++) {
      const nw = w >> 1, nh = h >> 1, dst = new Uint8Array(nw * nh * 4);
      for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) for (let c = 0; c < 4; c++) dst[(y * nw + x) * 4 + c] = (src[(2 * y * w + 2 * x) * 4 + c] + src[(2 * y * w + 2 * x + 1) * 4 + c] + src[((2 * y + 1) * w + 2 * x) * 4 + c] + src[((2 * y + 1) * w + 2 * x + 1) * 4 + c]) >> 2;
      dev.queue.writeTexture({ texture: t, mipLevel: l }, dst, { bytesPerRow: nw * 4 }, [nw, nh]);
      src = dst; w = nw; h = nh;
    }
  }
  const sampler = dev.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });

  const text = async (f) => (await fetch(new URL(f, import.meta.url))).text();
  const common = await text("common.wgsl"), mod = async (f) => dev.createShaderModule({ code: common + "\n" + await text(f), label: f });
  const [terrainM, skyM, massM] = await Promise.all([mod("terrain.wgsl"), mod("sky.wgsl"), mod("mass.wgsl")]);
  for (const m of [terrainM, skyM, massM]) { const info = await m.getCompilationInfo(); const bad = info.messages.filter((x) => x.type === "error"); if (bad.length) throw new Error(`${m.label}: ${bad.map((x) => `${x.lineNum}: ${x.message}`).join("; ")}`); }

  const FRAME_FLOATS = 100, frame = new Float32Array(FRAME_FLOATS), frameBuf = dev.createBuffer({ size: FRAME_FLOATS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const VIS = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
  const frameLayout = dev.createBindGroupLayout({ entries: [{ binding: 0, visibility: VIS, buffer: {} }] });
  const groundLayout = dev.createBindGroupLayout({ entries: [
    { binding: 0, visibility: VIS, buffer: {} }, { binding: 1, visibility: VIS, texture: { sampleType: "unfilterable-float" } }, { binding: 2, visibility: VIS, texture: { sampleType: "unfilterable-float" } },
    { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} }, { binding: 4, visibility: VIS, texture: {} }, { binding: 5, visibility: VIS, sampler: {} }] });
  const frameBind = dev.createBindGroup({ layout: frameLayout, entries: [{ binding: 0, resource: { buffer: frameBuf } }] });
  const groundBind = dev.createBindGroup({ layout: groundLayout, entries: [{ binding: 0, resource: { buffer: frameBuf } }, { binding: 1, resource: heightTex.createView() }, { binding: 2, resource: waterTex.createView() }, { binding: 3, resource: albTex.createView() }, { binding: 4, resource: auxTex.createView() }, { binding: 5, resource: sampler }] });
  const depthState = (write) => ({ format: "depth32float", depthWriteEnabled: write, depthCompare: "greater" });
  const gridBuffers = [{ arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }] }, { arrayStride: 16, stepMode: "instance", attributes: [{ shaderLocation: 1, offset: 0, format: "float32x4" }] }];
  const pipe = (layout, module, vs, fs, buffers, { depth = true, write = true, blend = null } = {}) => dev.createRenderPipeline({
    layout: dev.createPipelineLayout({ bindGroupLayouts: [layout] }), vertex: { module, entryPoint: vs, buffers },
    fragment: { module, entryPoint: fs, targets: [{ format: fmt, blend: blend || undefined }] }, primitive: { topology: "triangle-list", cullMode: "none" },
    depthStencil: depth ? depthState(write) : { format: "depth32float", depthWriteEnabled: false, depthCompare: "always" },
  });
  const alpha = { color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } };
  const skyPipe = pipe(frameLayout, skyM, "vsSky", "fsSky", [], { depth: false });
  const groundPipe = pipe(groundLayout, terrainM, "vsGround", "fsGround", gridBuffers);
  const waterPipe = pipe(groundLayout, terrainM, "vsWater", "fsWater", gridBuffers, { write: false, blend: alpha });
  const massBuffers = [{ arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }, { shaderLocation: 1, offset: 12, format: "float32x3" }] },
    { arrayStride: 48, stepMode: "instance", attributes: [{ shaderLocation: 2, offset: 0, format: "float32x4" }, { shaderLocation: 3, offset: 16, format: "float32x4" }, { shaderLocation: 4, offset: 32, format: "float32x4" }] }];
  const massPipe = pipe(frameLayout, massM, "vsMass", "fsMass", massBuffers);

  // the 32 x 32 grid every terrain node is drawn with
  const N = 32, grid = new Float32Array(N * N * 12);
  for (let j = 0, o = 0; j < N; j++) for (let i = 0; i < N; i++) for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) { grid[o++] = (i + a) / N; grid[o++] = (j + b) / N; }
  const vbuf = (data, usage = GPUBufferUsage.VERTEX) => { const b = dev.createBuffer({ size: Math.max(16, data.byteLength), usage: usage | GPUBufferUsage.COPY_DST }); dev.queue.writeBuffer(b, 0, data); return b; };
  const gridBuf = vbuf(grid), MAX_NODES = 2048, nodes = new Float32Array(MAX_NODES * 4), nodeBuf = dev.createBuffer({ size: nodes.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  const meshBuf = Object.fromEntries(Object.entries(MESHES).map(([k, v]) => [k, { buf: vbuf(v), count: v.length / 6 }]));

  say("Raising the towns");
  const arch = architecture(world), archBuf = Object.fromEntries(Object.entries(arch).filter(([, v]) => v.length).map(([k, v]) => [k, { buf: vbuf(v), count: v.length / 12 }]));
  const FLORA_MAX = 90000, floraBuf = { cone: { buf: dev.createBuffer({ size: FLORA_MAX * 48, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }), count: 0 }, cyl: { buf: dev.createBuffer({ size: FLORA_MAX * 48, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }), count: 0 } };
  const quality = num("quality", 1);
  let floraAt = [1e12, 1e12];
  function growFlora(x, z) {
    if (Math.hypot(x - floraAt[0], z - floraAt[1]) < 6) return;
    floraAt = [x, z];
    const f = flora(world, x, z, 2200 * quality, 26 * Math.min(1, quality * 1.5));
    for (const k of ["cone", "cyl"]) { const n = Math.min(FLORA_MAX, f[k].length / 12); floraBuf[k].count = n; if (n) dev.queue.writeBuffer(floraBuf[k].buf, 0, f[k], 0, n * 12); }
  }

  // ---------------------------------------------------------------- the walker
  const seat = world.json.settlements.find((s) => s.name === "Gullet") || world.json.settlements[0];
  const cam = { x: num("x", seat.x * 0.064 + 1.2) * 1000, z: num("z", seat.y * 0.064 + 0.4) * 1000, y: 0, yaw: num("yaw", 80) * Math.PI / 180, pitch: num("pitch", -4) * Math.PI / 180, fly: Q.get("fly") === "1", alt: num("alt", 1.7) };
  const time = { day: num("day", 3), clock: num("clock", 17.2), hold: Q.get("still") === "1", rate: num("rate", 30) };   // rate: game seconds per real second
  const keys = new Set();
  addEventListener("keydown", (e) => { keys.add(e.code); if (e.code === "KeyF") cam.fly = !cam.fly; if (e.code === "KeyT") time.hold = !time.hold; if (e.code === "KeyH") hud.hidden = !hud.hidden; if (e.code.startsWith("Digit") || e.code === "Minus") jump(e.code === "Minus" ? 11 : e.code === "Digit0" ? 10 : +e.code.slice(5)); });
  addEventListener("keyup", (e) => keys.delete(e.code));
  canvas.addEventListener("click", () => canvas.requestPointerLock && canvas.requestPointerLock());
  addEventListener("mousemove", (e) => { if (document.pointerLockElement === canvas) { cam.yaw += e.movementX * 0.0022; cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - e.movementY * 0.0022)); } });
  addEventListener("wheel", (e) => { time.clock = (time.clock + Math.sign(e.deltaY) * 0.25 + 24) % 24; });
  function jump(region) {
    const s = world.json.settlements.find((q) => q.kind === "seat" && q.region === region) || world.json.regions.find((r) => r.id === region);
    if (!s) return;
    cam.x = ((s.x ?? s.cx) + 6) * world.cell; cam.z = ((s.y ?? s.cy) + 9) * world.cell; cam.yaw = -0.6; cam.pitch = -0.05;
  }
  const surfaceAt = (x, z) => Math.max(groundAt(world, x, z), waterAt(world, x, z) > -500 ? waterAt(world, x, z) - 1.1 : -1e9);
  function move(dt) {
    const fwd = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0), side = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0), rise = (keys.has("Space") ? 1 : 0) - (keys.has("KeyC") ? 1 : 0);
    const fast = keys.has("ShiftLeft") || keys.has("ShiftRight");
    if (keys.has("BracketRight")) time.clock = (time.clock + dt * 2) % 24;
    if (keys.has("BracketLeft")) time.clock = (time.clock - dt * 2 + 24) % 24;
    if (cam.fly) {
      const v = (fast ? 1200 : 120) * Math.max(1, cam.alt / 300), cp = Math.cos(cam.pitch);
      cam.x += (Math.sin(cam.yaw) * cp * fwd + Math.cos(cam.yaw) * side) * v * dt; cam.z += (-Math.cos(cam.yaw) * cp * fwd + Math.sin(cam.yaw) * side) * v * dt;
      cam.alt = Math.max(2, cam.alt + (Math.sin(cam.pitch) * fwd + rise) * v * dt);
    } else {
      const v = fast ? 5.5 : 1.4;                                                                                        // a walk and a run, in metres a second
      cam.x += (Math.sin(cam.yaw) * fwd + Math.cos(cam.yaw) * side) * v * dt; cam.z += (-Math.cos(cam.yaw) * fwd + Math.sin(cam.yaw) * side) * v * dt;
      cam.alt = 1.7;
    }
    cam.x = Math.max(-20000, Math.min(world.width + 20000, cam.x)); cam.z = Math.max(-20000, Math.min(world.depth + 20000, cam.z));
    cam.y = surfaceAt(cam.x, cam.z) + cam.alt;
  }

  // ---------------------------------------------------------------- a frame
  let depthTex = null, last = performance.now(), t0 = last, frames = 0, nodeCount = 0, state = null;
  const gaps = [];
  let grabbing = null;
  function draw(now) {
    const dt = Math.min(0.1, (now - last) / 1000); gaps.push(now - last); if (gaps.length > 240) gaps.shift(); last = now;
    const cw = Math.max(1, Math.floor(canvas.clientWidth * (num("scale", 1)))), chh = Math.max(1, Math.floor(canvas.clientHeight * num("scale", 1)));
    if (canvas.width !== cw || canvas.height !== chh || !depthTex) { canvas.width = cw; canvas.height = chh; if (depthTex) depthTex.destroy(); depthTex = dev.createTexture({ size: [cw, chh], format: "depth32float", usage: GPUTextureUsage.RENDER_ATTACHMENT }); }
    move(dt);
    if (!time.hold) { time.clock += dt * time.rate / 3600; if (time.clock >= 24) { time.clock -= 24; time.day++; } }
    growFlora(cam.x, cam.z);
    const vp = viewProj(cam, cw / chh), s = skyAt(seed, shares, cam.x, cam.z, world.depth, time.day, time.clock);
    const flash = s.events.cells.some((c) => c.flash) && ((now / 90) | 0) % 3 === 0 ? 1 : 0, L = frameLight(s, flash);
    L.fogp[0] = Math.max(0, groundAt(world, cam.x, cam.z)) * (s.weather.cloudSea > 0 ? 0 : 0.85);
    frame.set(vp.M, 0); frame.set(invert(vp.M), 16); frame.set([cam.x, cam.y, cam.z, (now - t0) / 1000], 32);
    let o = 36; for (const k of ["key", "sun", "moon", "zenith", "horizon", "fog", "fogp", "wx", "ev", "misc", "keyCol", "amb", "lamp"]) { frame.set(L[k], o); o += 4; }
    frame.set([world.width, world.depth, world.cell, W], o); frame.set(L.glow, o + 4);
    dev.queue.writeBuffer(frameBuf, 0, frame);
    nodeCount = selectNodes(pyramid, [cam.x, cam.y, cam.z], frustumPlanes(vp.M), nodes);
    dev.queue.writeBuffer(nodeBuf, 0, nodes, 0, nodeCount * 4);

    const enc = dev.createCommandEncoder(), pass = enc.beginRenderPass({
      colorAttachments: [{ view: host.context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }],
      depthStencilAttachment: { view: depthTex.createView(), depthClearValue: 0, depthLoadOp: "clear", depthStoreOp: "store" },
    });
    pass.setPipeline(skyPipe); pass.setBindGroup(0, frameBind); pass.draw(3);
    pass.setPipeline(groundPipe); pass.setBindGroup(0, groundBind); pass.setVertexBuffer(0, gridBuf); pass.setVertexBuffer(1, nodeBuf); pass.draw(N * N * 6, nodeCount);
    pass.setPipeline(massPipe); pass.setBindGroup(0, frameBind);
    for (const set of [archBuf, floraBuf]) for (const [k, b] of Object.entries(set)) if (b.count) { pass.setVertexBuffer(0, meshBuf[k].buf); pass.setVertexBuffer(1, b.buf); pass.draw(meshBuf[k].count, b.count); }
    pass.setPipeline(waterPipe); pass.setBindGroup(0, groundBind); pass.setVertexBuffer(0, gridBuf); pass.setVertexBuffer(1, nodeBuf); pass.draw(N * N * 6, nodeCount);
    pass.end(); dev.queue.submit([enc.finish()]);
    if (grabbing) { const g = grabbing; grabbing = null; g(canvas.toDataURL("image/png")); }   // read the canvas in the frame that drew it
    frames++; state = s;
    if (frames % 12 === 0 && !hud.hidden) writeHud(s);
    requestAnimationFrame(draw);
  }
  const hh = (c) => `${String(Math.floor(c)).padStart(2, "0")}:${String(Math.floor((c % 1) * 60)).padStart(2, "0")}`;
  function writeHud(s) {
    const g = gaps.slice(-60), ms = g.reduce((a, b) => a + b, 0) / Math.max(1, g.length);
    hud.querySelector(".place").textContent = REGION_NAMES[s.weather.region] || "";
    hud.querySelector(".air").textContent = `${s.weather.name}, ${s.part}`;
    hud.querySelector(".where").textContent = `day ${time.day}  ${hh(time.clock)}   ${(cam.x / 1000).toFixed(1)} km E  ${(cam.z / 1000).toFixed(1)} km S   ${Math.round(cam.y)} m   ${cam.fly ? "flying" : "on foot"}   ${ms.toFixed(1)} ms`;
  }

  // what a capture or a test can drive
  globalThis.__lwWorld = {
    world, cam, time,
    view(v) { Object.assign(cam, { x: (v.x ?? cam.x / 1000) * 1000, z: (v.z ?? cam.z / 1000) * 1000, alt: v.alt ?? cam.alt, fly: v.fly ?? cam.fly }); if (v.yaw !== undefined) cam.yaw = v.yaw * Math.PI / 180; if (v.pitch !== undefined) cam.pitch = v.pitch * Math.PI / 180; if (v.clock !== undefined) time.clock = v.clock; if (v.day !== undefined) time.day = v.day; if (v.hold !== undefined) time.hold = v.hold; floraAt = [1e12, 1e12]; },
    async settle(n = 3) { const f = frames; while (frames < f + n) await new Promise((r) => requestAnimationFrame(r)); await dev.queue.onSubmittedWorkDone(); return this.stats(); },
    stats() { const g = gaps.slice(2).sort((a, b) => a - b); return { frames, nodes: nodeCount, triangles: nodeCount * N * N * 4 + Object.values(floraBuf).reduce((a, b) => a + b.count * 14, 0), frameMs: g.length ? +(g.reduce((a, b) => a + b, 0) / g.length).toFixed(2) : 0, p95: g.length ? +g[Math.floor(g.length * 0.95)].toFixed(2) : 0, region: state && state.weather.region, air: state && state.weather.name, part: state && state.part, adapter: host.info || null, trees: floraBuf.cone.count + floraBuf.cyl.count }; },
    clearGaps() { gaps.length = 0; },
    grab() { return new Promise((ok) => { grabbing = ok; }); },
  };
  say("");
  move(0);
  requestAnimationFrame(draw);
}
start().catch((e) => { say(String(e && e.message || e)); console.error(e); globalThis.__lwWorldError = String(e && e.stack || e); });
