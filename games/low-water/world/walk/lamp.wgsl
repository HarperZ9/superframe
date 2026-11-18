// Each lamp as a point of light: a hot core the size of the lamp, never smaller than a pixel and
// a half, so a works two kilometres off is still a field of points. The glow round it comes from
// the bloom, and the air between dims it.

struct LOut {
  @builtin(position) clip: vec4f,
  @location(0) q: vec2f,
  @location(1) col: vec3f,
  @location(2) wp: vec3f,
  @location(3) @interpolate(flat) grow: f32,
}

@vertex fn vsLamp(@builtin(vertex_index) vi: u32, @location(0) p0: vec4f, @location(1) p1: vec4f) -> LOut {
  let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0;
  let c = F.viewProj * vec4f(p0.xyz, 1.0);
  // the lamp's radius in pixels, held to a floor
  let px = p0.w * F.view.y * 0.86 / max(c.w, 0.01);
  let grow = max(1.5 / max(px, 0.001), 1.0);
  let r = max(px, 1.5) * 2.2;
  var o: LOut;
  o.clip = vec4f(c.xy + corner * r * 2.0 / F.view.xy * c.w, c.z, c.w);
  o.q = corner * 2.2;
  // a lamp smaller than its floor keeps the light it sends, not the light per pixel
  var col = p1.rgb / (grow * grow);
  if (p1.w > 0.0) { col *= 0.75 + 0.25 * sin(F.cam.w * (7.0 + 9.0 * p1.w) + p0.x * 3.1 + p0.z * 1.7) * sin(F.cam.w * 2.3 + p0.x); }
  o.col = col * (1.0 - airAmount(p0.xyz));
  o.wp = p0.xyz;
  o.grow = grow;
  return o;
}

@fragment fn fsLamp(v: LOut) -> @location(0) vec4f {
  if (clipped(v.wp)) { discard; }
  let d = length(v.q);
  let core = smoothstep(1.15, 0.7, d);
  let halo = exp(-d * d * 1.6) * 0.35;
  return vec4f(v.col * (core + halo) * 0.9, 0.0);
}
