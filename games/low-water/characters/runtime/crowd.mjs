// The wide lens's crowd tier: hundreds of distant people drawn as cards (tools/crowd-cards.mjs paints them
// once through the full figure pipeline under the plate's camera and light), a drawImage each from one
// atlas, with full figures (the drawer, workers and all) kept for the few near the camera.
//   const C = await loadCrowd("/characters/crowd/out/quay-night.json")
//   const crowd = makeCrowd(C, people)      people: [{ at: [x, y, z], face, who, walk: speed m/s or 0 }]
//   crowd.step(dt, open)                    walkers move on; open(x, z): ground they may walk onto
//   crowd.items(cam)                        [{ depth, draw(g) }] to sort in with the full figures
// A card is the body at the nearest of the baked facings and phases, scaled from the baked metre to the
// one at its feet; a person whose middle is behind the painted room is not drawn (no partial occlusion).
export async function loadCrowd(url) {
  const meta = await (await fetch(url)).json(), img = new Image();
  img.src = new URL(meta.atlas.src, new URL(url, globalThis.location ? globalThis.location.href : undefined)).href; await img.decode();
  const atlas = typeof createImageBitmap === "function" ? await createImageBitmap(img) : img;
  return { meta, atlas };
}

const TAU = Math.PI * 2, STRIDE = 1.4;   // metres a walk cycle covers (a card per phase of it)

export function makeCrowd({ meta, atlas }, people) {
  const bodies = Object.keys(meta.bodies), F = meta.facings, P = meta.phases, I = meta.idlePhases || 1;
  const list = people.map((p, i) => ({ at: [...p.at], face: p.face || 0, who: meta.bodies[p.who] ? p.who : bodies[i % bodies.length], walk: p.walk || 0, u: p.u ?? (i * 0.137) % 1, t: (i * 0.71) % I }));
  const card = (p) => {
    const k = Math.round((((p.face % TAU) + TAU) % TAU) / TAU * F) % F, B = meta.bodies[p.who];
    const ids = p.walk ? B.walk[k] : B.idle[k], n = ids.length, q = p.walk ? Math.floor(p.u * n) % n : Math.floor(p.t) % n;
    return meta.rects[ids[q] ?? ids[0]];
  };
  return {
    people: list,
    step(dt, open = null) {
      for (const p of list) {
        if (!p.walk) { p.t = (p.t + dt) % I; continue; }   // an idle phase a second
        const nx = p.at[0] + Math.cos(p.face) * p.walk * dt, nz = p.at[2] + Math.sin(p.face) * p.walk * dt;
        if (open && !open(nx, nz)) { p.face += Math.PI * (0.6 + 0.8 * ((p.u * 7.3) % 1)); continue; }   // turned back from a wall or a prop
        p.at[0] = nx; p.at[2] = nz; p.u = (p.u + (p.walk * dt) / STRIDE) % 1;
      }
    },
    // each person as an item to sort with the full figures by depth (cam: toScreen, scaleAt, depthOf, depthAt)
    // cull: leave out a person whose middle is behind the room (no depth planes to cut them partly)
    items(cam, { cull = true } = {}) {
      const out = [];
      for (const p of list) {
        const s = cam.toScreen(p.at); if (!s) continue;
        const depth = cam.depthOf(p.at), ppm = cam.scaleAt(p.at);
        if (cull && cam.depthAt && cam.depthAt(s[0], s[1] - 0.9 * ppm) < depth - 0.35) continue;   // behind the room
        const r = card(p), k = ppm / meta.ppm;
        const x = s[0] - r[4] * k, y = s[1] - r[5] * k, w = r[2] * k, h = r[3] * k;
        out.push({ depth, rect: [x, y, w, h], draw: (g) => g.drawImage(atlas, r[0], r[1], r[2], r[3], x, y, w, h) });
      }
      return out;
    },
  };
}
