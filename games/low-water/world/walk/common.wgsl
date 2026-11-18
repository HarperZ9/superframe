// Shared by every pass of the world traversal: the frame block, noise, the sky and the air.
// x runs east, y up, z south; one unit is one metre.

struct Frame {
  viewProj: mat4x4f,
  invViewProj: mat4x4f,
  cam: vec4f,       // position, time in seconds
  key: vec4f,       // direction to the light that shades the ground (sun, or moon at night), strength
  sun: vec4f,       // direction to the sun, disc strength
  moon: vec4f,      // direction to the moon, lit share
  zenith: vec4f,    // sky colour overhead, star amount
  horizon: vec4f,   // sky colour at the horizon, cloud cover
  fog: vec4f,       // air colour, density per metre at the fog base
  fogp: vec4f,      // fog base height, falloff per metre, cloud-sea top, cloud-sea density per metre
  wx: vec4f,        // rain, snow, wind, wetness
  ev: vec4f,        // aurora, halo, comet, lightning flash
  misc: vec4f,      // night 0..1, snow-line shift in degrees, exposure, storm
  keyCol: vec4f,    // colour of the key light
  amb: vec4f,       // ambient colour
  lamp: vec4f,      // the lamp hue of this place
  world: vec4f,     // width m, depth m, cell m, raster width
  glow: vec4f,      // colour of the glow round the sun, strength
}
@group(0) @binding(0) var<uniform> F: Frame;

fn hash21(p: vec2f) -> f32 {
  var q = fract(p * vec2f(0.1031, 0.1030));
  q += dot(q, q.yx + 33.33);
  return fract((q.x + q.y) * q.x);
}
fn hash31(p: vec3f) -> f32 {
  var q = fract(p * vec3f(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p); let f = fract(p); let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2f(1.0, 0.0)), u.x), mix(hash21(i + vec2f(0.0, 1.0)), hash21(i + vec2f(1.0, 1.0)), u.x), u.y);
}
// Noise on an integer lattice with an integer hash: the walker's feet (data.mjs) compute the same
// function, so the ground the eye sees is the ground the walker stands on.
fn ihash(x: i32, y: i32) -> f32 {
  var h = (u32(x) * 0x9E3779B1u) ^ (u32(y) * 0x85EBCA77u);
  h ^= h >> 15u; h *= 0x2C1B3C6Du; h ^= h >> 12u; h *= 0x297A2D39u; h ^= h >> 15u;
  return f32(h) / 4294967296.0;
}
fn lnoise(p: vec2f) -> f32 {
  let i = vec2i(floor(p)); let f = fract(p); let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(ihash(i.x, i.y), ihash(i.x + 1, i.y), u.x), mix(ihash(i.x, i.y + 1), ihash(i.x + 1, i.y + 1), u.x), u.y);
}
// small relief the 64 m raster cannot hold: swells 16 m across and lumps 4 m across, faded out
// with distance before the mesh gets too coarse to carry them
fn relief(xz: vec2f, dist: f32) -> f32 {
  return (lnoise(xz / 16.0) - 0.5) * 3.2 * (1.0 - smoothstep(700.0, 1600.0, dist)) + (lnoise(xz / 4.0 + 50.0) - 0.5) * 0.6 * (1.0 - smoothstep(150.0, 420.0, dist));
}
fn fbm(p: vec2f) -> f32 {
  var s = 0.0; var a = 0.5; var q = p;
  for (var i = 0; i < 4; i++) { s += a * vnoise(q); q = vec2f(q.x * 0.8 - q.y * 0.6, q.x * 0.6 + q.y * 0.8) * 2.03 + 7.1; a *= 0.5; }
  return s;
}

// The sky dome without discs and stars: what the air looks like in a direction.
fn skyBase(d: vec3f) -> vec3f {
  let up = clamp(d.y, -0.2, 1.0);
  let t = pow(1.0 - max(up, 0.0), 3.2);
  var c = mix(F.zenith.rgb, F.horizon.rgb, t);
  // the glow near the sun, flattened along the horizon
  let s = max(dot(d, F.sun.xyz), 0.0);
  let low = 1.0 - smoothstep(0.0, 0.5, abs(F.sun.y));
  c += F.glow.rgb * F.glow.a * (pow(s, 6.0) * 0.5 + pow(s, 40.0) * 0.8) * (0.4 + 0.6 * low) * (1.0 - 0.75 * F.horizon.a);
  // below the horizon the dome darkens into the far ground haze
  c = mix(c, F.fog.rgb, smoothstep(0.0, -0.12, d.y));
  return c;
}

// Air between the eye and a point: a fog that thins with height, plus a flat cloud deck that is
// dense below its top (the cloud sea) and absent above it. Far ground takes the sky's hue.
fn airAmount(p: vec3f) -> f32 {
  let d = p - F.cam.xyz; let dist = length(d);
  let b = F.fogp.y; let t = b * d.y;
  var k = 1.0;
  if (abs(t) > 0.001) { k = (1.0 - exp(-t)) / t; }
  var od = F.fog.a * exp(-b * max(F.cam.y - F.fogp.x, -200.0)) * dist * k;
  let top = F.fogp.z;
  if (top > 0.0) {
    let y0 = F.cam.y; let y1 = p.y; var frac = 0.0;
    if (y0 < top && y1 < top) { frac = 1.0; }
    else if (abs(d.y) > 0.01) { frac = clamp((top - min(y0, y1)) / abs(d.y), 0.0, 1.0); }
    od += F.fogp.w * dist * frac;
  }
  return 1.0 - exp(-od);
}
fn airColour(dir: vec3f) -> vec3f {
  let flat_dir = normalize(vec3f(dir.x, max(dir.y, 0.02), dir.z));
  return mix(F.fog.rgb, skyBase(flat_dir), 0.55);
}
fn inAir(col: vec3f, p: vec3f) -> vec3f {
  let a = airAmount(p);
  return mix(col, airColour(normalize(p - F.cam.xyz)), a);
}

// yearly mean temperature of a place in degrees, by the generator's own rule
fn warmth(p: vec3f) -> f32 {
  let v = clamp(p.z / F.world.y, 0.0, 1.0);
  return -3.0 + 16.5 * v - 5.0 * max(p.y, 0.0) / 1000.0 - 4.0 * max(0.35 - v, 0.0) / 0.35;
}
fn toneMap(c: vec3f) -> vec3f {
  // a filmic curve (Narkowicz's fit to ACES): deep shadows, a soft shoulder
  let x = c * F.misc.z * 0.9;
  let m = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  return pow(clamp(m, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2));
}
