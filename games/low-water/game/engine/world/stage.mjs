// The fight's stage in the world (author, 2026-10-17: the look does not change between walking,
// talking and fighting). A combat arena is laid in metres of its own (combat/data/arenas*.mjs);
// the stage puts it on the current area's plate so a fight plays in the plate view, under the
// game camera.
//   @area arena: <arena id> x y z yaw    where the arena's (0, 0) lies in the area's world and how
//                                        it is turned (degrees about the vertical). The art lead
//                                        places one per plate with fight ground (repeatable: the
//                                        first whose arena id matches the encounter's is used; a
//                                        line without an id matches any).
//   Without one, the arena is laid with its middle on Lamb's position, unturned.
// stageFor(G, arenaId, arenaSize) -> { toWorld([ax, az]) -> [x, y, z], placed: bool }
// fightBounds(project, stage, fighters, margin) -> plate-pixel bounds around every fighter, for
// world/camera.mjs frame({ bounds }): the camera keeps the game's closeness and pulls back only
// as far as it must to keep everyone in view.
export function parseArenaLines(lines) {
  return lines.map((v) => { const w = String(v).trim().split(/\s+/), id = isNaN(+w[0]) ? w.shift() : null; return { id, x: +w[0] || 0, y: +w[1] || 0, z: +w[2] || 0, yaw: +w[3] || 0 }; });
}

export function stageFor(G, arenaId = null, size = [16, 10]) {
  const area = G.world.area(), lines = (area && area.arenas) || [];
  const at = lines.find((l) => l.id === arenaId) || lines.find((l) => !l.id) || null;
  const lamb = G.state.pos || (area && area.spawn) || [0, 0, 0];
  const o = at || { x: lamb[0] - size[0] / 2, y: lamb[1], z: lamb[2] - size[1] / 2, yaw: 0 };
  const r = (o.yaw * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return { placed: !!at, origin: o, toWorld: ([ax, az], h = 0) => [o.x + ax * c + az * s, o.y + h, o.z - ax * s + az * c] };
}

export function fightBounds(project, stage, fighters, margin = 1.2) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const F of fighters) for (const [dx, dz, h] of [[-margin, -margin, 0], [margin, margin, 0], [0, 0, 2.2]]) {
    const [px, py] = project(stage.toWorld([F.x + dx, F.z + dz], h));
    x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
  }
  return Number.isFinite(x0) ? [x0, y0, x1, y1] : null;
}
