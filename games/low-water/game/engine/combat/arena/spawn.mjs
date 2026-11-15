// Fighters for the arena mode: an archetype (or its elite) and a boss, as fighter specs a world takes at
// its start or through W.addFighter mid-fight. Kept apart from the brains so they can import nothing here.
//   foeSpec(id, style, at, { elite })   bossSpec(id, bossId, at)   summoner(W)
import { foeDef, fighterSpec } from "../roster.mjs";
import { elite } from "../data/archetypes.mjs";
import { BOSSES, BOSS_SPECIALS } from "../data/bosses.mjs";
import { createBossBrain } from "../ai/boss.mjs";
import { ARCHETYPES } from "../data/foes.mjs";
import { skinFoe } from "../data/skins-quota.mjs";
import { profileOf } from "../data/tools.mjs";

export function foeSpec(id, style, at, { elite: el = false, face = -Math.PI / 2, skin = null } = {}) {
  const d = skin ? skinFoe(skin, style, foeDef(null, style), profileOf) : foeDef(null, style); // a venue's name and kit (combat/data/skins-quota.mjs)
  return fighterSpec(id, "foe", el ? elite(d) : d, at, { face, brain: true });
}

// A boss: the holder's body numbers replaced by the boss's own, its specials, its look, its brain.
export function bossSpec(id, bossId, at, { face = -Math.PI / 2 } = {}) {
  const B = BOSSES[bossId], D = B.defaults;
  const rec = { tool: D.tool, standing: D.standing, breath: D.breath, poise: D.poise, name: B.name };
  const def = { ...foeDef(rec, "holder", { speed: D.speed, accel: D.accel, turn: D.turn, radius: D.radius, height: D.height, grip: D.grip }), kind: bossId, style: null, boss: bossId, look: B.look, items: { stone: 0, ...(B.items || {}) }, frontGuard: D.frontGuard || 0 };
  const spec = fighterSpec(id, "foe", def, at, { face, brain: false });
  for (const s of B.specials) spec.moves[s] = BOSS_SPECIALS[s];
  spec.brain = createBossBrain(B);
  return spec;
}

// W.summon for a world: hands called in arrive at the arena's edge furthest from Lamb.
export function summoner(W) {
  let n = 0;
  return (F, S) => {
    const L = W.lamb(), b = W.field.bounds;
    for (let k = 0; k < (S.n || 1); k++) {
      const x = L.x < (b.x0 + b.x1) / 2 ? b.x1 - 1.2 : b.x0 + 1.2, z = b.z0 + 1.5 + ((b.z1 - b.z0 - 3) * (k + 1)) / ((S.n || 1) + 1);
      if (!ARCHETYPES[S.style]) continue;
      W.addFighter(foeSpec(`${F.id}-hand${n++}`, S.style, [x, z], { elite: !!S.elite }));
    }
  };
}
