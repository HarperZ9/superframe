// Heightfield terrain with continuous level of detail (CDLOD, Strugar 2009): one 32 x 32 grid
// drawn once per quadtree node, each vertex sliding onto the next coarser grid as it nears the
// edge of its level's range, so levels meet without cracks. The second entry point draws the
// water surface on the same nodes.

@group(0) @binding(1) var heightTex: texture_2d<f32>;   // ground, metres
@group(0) @binding(2) var waterTex: texture_2d<f32>;    // water surface, metres; -512 where dry
@group(0) @binding(3) var albTex: texture_2d<f32>;      // ground colour, a = river
@group(0) @binding(4) var auxTex: texture_2d<f32>;      // normal x, normal z, canopy, built
@group(0) @binding(5) var samp: sampler;

const GRID: f32 = 32.0;
const RANGE0: f32 = 250.0;

struct VOut {
  @builtin(position) clip: vec4f,
  @location(0) wp: vec3f,
  @location(1) wet: f32,
}

fn texel(c: vec2i) -> f32 {
  let s = vec2i(textureDimensions(heightTex));
  return textureLoad(heightTex, clamp(c, vec2i(0), s - vec2i(1)), 0).r;
}
fn groundAt(xz: vec2f) -> f32 {
  let q = xz / F.world.z - 0.5; let i = vec2i(floor(q)); let f = fract(q);
  return mix(mix(texel(i), texel(i + vec2i(1, 0)), f.x), mix(texel(i + vec2i(0, 1)), texel(i + vec2i(1, 1)), f.x), f.y);
}
fn waterTexel(c: vec2i) -> f32 {
  let s = vec2i(textureDimensions(waterTex));
  return textureLoad(waterTex, clamp(c, vec2i(0), s - vec2i(1)), 0).r;
}
// water level and how much of the four texels round a point is water
fn waterAt(xz: vec2f) -> vec2f {
  let q = xz / F.world.z - 0.5; let i = vec2i(floor(q)); let f = fract(q);
  let a = waterTexel(i); let b = waterTexel(i + vec2i(1, 0)); let c = waterTexel(i + vec2i(0, 1)); let d = waterTexel(i + vec2i(1, 1));
  let level = max(max(a, b), max(c, d));
  let wa = step(-500.0, a); let wb = step(-500.0, b); let wc = step(-500.0, c); let wd = step(-500.0, d);
  return vec2f(level, mix(mix(wa, wb, f.x), mix(wc, wd, f.x), f.y));
}

// slide a grid point toward the coarser grid by k
fn morphed(grid: vec2f, inst: vec4f, k: f32) -> vec2f {
  let gi = grid * GRID;
  let odd = fract(gi * 0.5) * 2.0;
  return inst.xy + (gi - odd * k) / GRID * inst.z;
}
fn morphK(p: vec3f, level: f32) -> f32 {
  let range = RANGE0 * exp2(level);
  return clamp((distance(p, F.cam.xyz) - range * 0.70) / (range * 0.24), 0.0, 1.0);
}

@vertex fn vsGround(@location(0) grid: vec2f, @location(1) inst: vec4f) -> VOut {
  var xz = inst.xy + grid * inst.z;
  let k = morphK(vec3f(xz.x, groundAt(xz), xz.y), inst.w);
  xz = morphed(grid, inst, k);
  var y = groundAt(xz);
  // relief, flattened where people have built and under water
  let built = textureSampleLevel(auxTex, samp, xz / F.world.xy, 0.0).a;
  y += relief(xz, distance(vec3f(xz.x, y, xz.y), F.cam.xyz)) * (1.0 - built) * clamp(y, 0.0, 1.0);
  var o: VOut;
  o.wp = vec3f(xz.x, y, xz.y);
  o.clip = F.viewProj * vec4f(o.wp, 1.0);
  o.wet = 0.0;
  return o;
}

@vertex fn vsWater(@location(0) grid: vec2f, @location(1) inst: vec4f) -> VOut {
  var xz = inst.xy + grid * inst.z;
  let k = morphK(vec3f(xz.x, max(waterAt(xz).x, 0.0), xz.y), inst.w);
  xz = morphed(grid, inst, k);
  let w = waterAt(xz);
  var o: VOut;
  o.wp = vec3f(xz.x, max(w.x, -1.0), xz.y);
  o.clip = F.viewProj * vec4f(o.wp, 1.0);
  o.wet = w.y;
  return o;
}

// Is the key light blocked by the ground between here and it? A march over the heightfield with
// steps that grow, so a ridge 6 km off still throws its shadow at dusk.
fn groundShadow(p: vec3f) -> f32 {
  let l = F.key.xyz;
  if (l.y <= 0.01) { return 0.0; }
  var shade = 1.0; var s = 45.0;
  for (var i = 0; i < 14; i++) {
    let q = p + l * s;
    let h = texel(vec2i(floor(q.xz / F.world.z)));
    shade = min(shade, clamp((q.y - h) / (s * 0.06) + 1.0, 0.0, 1.0));
    s *= 1.45;
  }
  return shade;
}

@fragment fn fsGround(v: VOut) -> @location(0) vec4f {
  let uv = v.wp.xz / F.world.xy;
  // Far from the eye the mesh is coarse, and a triangle that spans the shore can stand above water
  // that the raster says is there. Where the true ground is under water, show the water.
  let wl = waterAt(v.wp.xz);
  let trueGround = groundAt(v.wp.xz);
  if (wl.y > 0.5 && trueGround < wl.x - 0.3 && v.wp.y > wl.x - 0.2) {
    let c = waterColour(vec3f(v.wp.x, wl.x, v.wp.z), wl.x - trueGround);
    return vec4f(c.rgb, 1.0);
  }
  let alb = textureSampleLevel(albTex, samp, uv, 0.0);
  let aux = textureSampleLevel(auxTex, samp, uv, 0.0);
  let dist = distance(v.wp, F.cam.xyz);
  let near = 1.0 - smoothstep(150.0, 2500.0, dist);
  // normal from the baked map, roughened close up
  var n = vec3f(aux.r * 2.0 - 1.0, 0.0, aux.g * 2.0 - 1.0);
  let e = 0.35;
  let nz = vec2f(vnoise(v.wp.xz * 0.21 + vec2f(e, 0.0)) - vnoise(v.wp.xz * 0.21 - vec2f(e, 0.0)), vnoise(v.wp.xz * 0.21 + vec2f(0.0, e)) - vnoise(v.wp.xz * 0.21 - vec2f(0.0, e)));
  let big = vec2f(vnoise(v.wp.xz * 0.013 + vec2f(e, 0.0)) - vnoise(v.wp.xz * 0.013 - vec2f(e, 0.0)), vnoise(v.wp.xz * 0.013 + vec2f(0.0, e)) - vnoise(v.wp.xz * 0.013 - vec2f(0.0, e)));
  n = vec3f(n.x - nz.x * 0.45 * near - big.x * 0.15, 0.0, n.z - nz.y * 0.45 * near - big.y * 0.15);
  n.y = sqrt(max(1.0 - n.x * n.x - n.z * n.z, 0.04));
  n = normalize(n);
  let slope = 1.0 - n.y;

  // the ground is never one colour: patches 250 m across, tussocks and stones 6 m and 1 m across,
  // and the hollows of the small relief sit darker than its crowns
  let close = 1.0 - smoothstep(60.0, 500.0, dist);
  let hollow = lnoise(v.wp.xz / 4.0 + 50.0) * 0.6 + lnoise(v.wp.xz / 16.0) * 0.4;
  var col = alb.rgb * (0.82 + 0.36 * fbm(v.wp.xz * 0.004)) * (0.92 + 0.16 * near * fbm(v.wp.xz * 0.05)) * (0.90 + 0.20 * close * vnoise(v.wp.xz * 2.3));
  col *= mix(1.0, 0.86 + 0.26 * hollow, close);
  // bare rock on the steeps, darker than the ground it breaks through
  let rock = smoothstep(0.16, 0.34, slope);
  col = mix(col, mix(col * 0.55, vec3f(0.27, 0.26, 0.27), 0.5), rock * 0.85);
  // snow by temperature, thinner on slopes, drifted by a low noise
  let t = warmth(v.wp) + (fbm(v.wp.xz * 0.0016) - 0.5) * 3.0;
  let snow = smoothstep(-0.8, -2.4, t) * (1.0 - smoothstep(0.30, 0.55, slope)) * (1.0 - aux.b * 0.55);
  let snowCol = mix(vec3f(0.78, 0.83, 0.92), vec3f(0.95, 0.96, 0.98), n.y * n.y);
  col = mix(col, snowCol, snow);
  // rivers: a ribbon of dark water that takes the sky
  let river = smoothstep(0.30, 0.55, alb.a) * (1.0 - smoothstep(0.5, 0.75, slope));
  // wet ground after rain is darker
  col *= 1.0 - 0.35 * F.wx.w * (1.0 - snow);

  let ndl = max(dot(n, F.key.xyz), 0.0);
  let shade = groundShadow(v.wp + n * 2.0);
  var lit = col * (F.amb.rgb * (0.55 + 0.45 * n.y) + F.keyCol.rgb * F.key.w * ndl * shade);
  // lightning lights everything for a frame
  lit += col * F.ev.w * vec3f(0.7, 0.75, 0.9);
  // lamp glow where people live, at night: the hue names the place
  // pools, not a wash: sodium on the ground with the place's own hue mixed in
  let pool = smoothstep(0.35, 0.8, vnoise(v.wp.xz * 0.011)) * (0.4 + 0.6 * vnoise(v.wp.xz * 0.07));
  lit += col * aux.a * aux.a * F.misc.x * mix(vec3f(1.0, 0.55, 0.16), F.lamp.rgb, 0.3) * 1.6 * pool;
  if (river > 0.0) {
    let view = normalize(v.wp - F.cam.xyz);
    let r = reflect(view, vec3f(0.0, 1.0, 0.0));
    let fres = 0.04 + 0.96 * pow(1.0 - max(-view.y, 0.0), 5.0);
    let waterCol = mix(vec3f(0.02, 0.035, 0.04) * (F.amb.rgb + F.keyCol.rgb * F.key.w), skyBase(r), 0.25 + 0.75 * fres);
    lit = mix(lit, waterCol, river);
  }
  return vec4f(toneMap(inAir(lit, v.wp)), 1.0);
}

// wave slope from three sliding noises; wind lengthens the swell
fn waveNormal(xz: vec2f, dist: f32) -> vec3f {
  let t = F.cam.w; let w = 0.4 + F.wx.z;
  let e = 0.6;
  var g = vec2f(0.0);
  let p1 = xz * 0.045 + vec2f(t * 0.6, t * 0.25) * w;
  let p2 = xz * 0.17 - vec2f(t * 0.5, -t * 0.8) * w;
  let p3 = xz * 0.008 + vec2f(-t * 0.12, t * 0.2) * w;
  g += vec2f(vnoise(p1 + vec2f(e, 0.0)) - vnoise(p1 - vec2f(e, 0.0)), vnoise(p1 + vec2f(0.0, e)) - vnoise(p1 - vec2f(0.0, e))) * 0.32;
  g += vec2f(vnoise(p2 + vec2f(e, 0.0)) - vnoise(p2 - vec2f(e, 0.0)), vnoise(p2 + vec2f(0.0, e)) - vnoise(p2 - vec2f(0.0, e))) * 0.30 * (1.0 - smoothstep(200.0, 1500.0, dist));
  let p4 = xz * 0.9 + vec2f(t * 1.1, t * 0.7) * w;
  g += vec2f(vnoise(p4 + vec2f(e, 0.0)) - vnoise(p4 - vec2f(e, 0.0)), vnoise(p4 + vec2f(0.0, e)) - vnoise(p4 - vec2f(0.0, e))) * 0.16 * (1.0 - smoothstep(30.0, 250.0, dist));
  g += vec2f(vnoise(p3 + vec2f(e, 0.0)) - vnoise(p3 - vec2f(e, 0.0)), vnoise(p3 + vec2f(0.0, e)) - vnoise(p3 - vec2f(0.0, e))) * 0.22;
  g *= w * (1.0 - 0.6 * smoothstep(3000.0, 30000.0, dist));
  return normalize(vec3f(-g.x, 1.0, -g.y));
}

// What water looks like at a surface point with `depth` metres under it. a is how solid it reads.
fn waterColour(p: vec3f, depth: f32) -> vec4f {
  let dist = distance(p, F.cam.xyz);
  let view = normalize(p - F.cam.xyz);
  let n = waveNormal(p.xz, dist);
  let r = reflect(view, n);
  let fres = 0.03 + 0.97 * pow(1.0 - max(dot(-view, n), 0.0), 5.0);
  // the body of the water: shallow shows the bed, deep goes to black-green
  let lightAll = F.amb.rgb + F.keyCol.rgb * F.key.w * max(F.key.y, 0.0);
  let shallow = vec3f(0.10, 0.16, 0.15); let deep = vec3f(0.012, 0.03, 0.04);
  let body = mix(shallow, deep, 1.0 - exp(-depth * 0.35)) * lightAll;
  var col = mix(body, skyBase(vec3f(r.x, abs(r.y), r.z)), fres);
  // the path of the light on the water
  let spec = pow(max(dot(r, F.key.xyz), 0.0), 220.0) * 6.0 + pow(max(dot(r, F.key.xyz), 0.0), 24.0) * 0.25;
  col += F.keyCol.rgb * F.key.w * spec * (1.0 - 0.8 * F.horizon.a);
  // lamps doubled in the water near where people live: long broken streaks toward the eye
  let aux = textureSampleLevel(auxTex, samp, p.xz / F.world.xy, 1.0);
  col += aux.a * F.misc.x * F.lamp.rgb * 0.6 * pow(vnoise(vec2f(p.x * 0.03, p.z * 0.004 + F.cam.w * 0.05)), 3.0);
  // foam where the water is thin and the wind is up
  let foam = (1.0 - smoothstep(0.0, 1.6 + 2.5 * F.wx.z, depth)) * smoothstep(0.45, 0.75, vnoise(p.xz * 0.35 + F.cam.w * 0.3)) * (0.3 + F.wx.z) * (1.0 - smoothstep(400.0, 2500.0, dist));
  col = mix(col, lightAll * 0.8, clamp(foam, 0.0, 1.0));
  col += F.ev.w * vec3f(0.35, 0.4, 0.5) * fres;
  return vec4f(toneMap(inAir(col, p)), clamp(0.55 + depth * 0.5 + fres, 0.0, 1.0));
}

@fragment fn fsWater(v: VOut) -> @location(0) vec4f {
  if (v.wet < 0.5) { discard; }
  let depth = v.wp.y - groundAt(v.wp.xz);
  if (depth < 0.0) { discard; }
  return waterColour(v.wp, depth);
}
