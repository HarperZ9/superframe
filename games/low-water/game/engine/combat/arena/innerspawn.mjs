// Fighters for the inner arena (combat/arena/innerworld.mjs): an inner boss from its flaw record, the hands it
// calls in (the coats, the carts) at the places its arena names, and the character with the boons the run took.
//   flawBossSpec(id, flaw, at)   innerSummoner(W, arena)   innerLamb(flaw, { levels, boons })
import { foeDef, fighterSpec, lambDef } from "../roster.mjs";
import { BOSS_SPECIALS } from "../data/bosses.mjs";
import { createBossBrain } from "../ai/boss.mjs";
import { createDuelBrain } from "../ai/duel.mjs";
import { ARCHETYPES } from "../data/foes.mjs";
import { datan2 } from "../sim/math.mjs";
import { embodied } from "../data/traits.mjs";

// An inner boss: the holder's body numbers replaced by the flaw's own, its specials, its form, its brain.
// def.boss names it as a boss (the HUD's name line, the hands that give up with it); def.inner and def.form
// tell the drawer (combat/arena/forms.mjs) which placeholder form to draw; def.floor is its unbeatable floor.
export function flawBossSpec(id, flaw, at, { face = -Math.PI / 2, body = flaw.body.defaults, phases = flaw.phases, form = flaw.body.form, floor = flaw.floor || 0 } = {}) {
  const D = body, rec = { tool: D.tool, standing: D.standing, breath: D.breath, poise: D.poise, name: flaw.town };
  const def = { ...foeDef(rec, "holder", { speed: D.speed, accel: D.accel, turn: D.turn, radius: D.radius, height: D.height, grip: D.grip }),
    kind: flaw.id, style: null, boss: flaw.id, inner: flaw.id, form, word: (flaw.body || {}).word || null, items: { stone: 0 }, floor, frontGuard: D.frontGuard || 0, baseHeight: D.height, baseRadius: D.radius };
  const spec = fighterSpec(id, "foe", def, at, { face, brain: false });
  for (const [k, m] of Object.entries(flaw.specials || {})) spec.moves[k] = m;
  spec.moves["boss.roar"] = BOSS_SPECIALS["boss.roar"];
  spec.brain = phases.some((p) => p.attacks) ? createDuelBrain({ phases }) : createBossBrain({ phases }); // a real fight's moveset (combat/data/fights.mjs)
  return spec;
}

// W.summon for an inner world: hands come in at the arena's named places (the chairs round the table, the dip
// in the road) or at the edge furthest from the character; each wears its form and may override its numbers
// ({ hp, speed, accel }). Ids follow the boss's (`boss-handN`), so the hands give up when the boss goes down.
export function innerSummoner(W, arena) {
  let n = 0;
  return (F, S) => {
    if (S.max) { const live = W.fighters.filter((O) => O.id.startsWith(`${F.id}-hand`) && !O.out && !O.fallen && O.hp > 0).length; S = { ...S, n: Math.max(0, Math.min(S.n || 1, S.max - live)) }; if (!S.n) return; } // a cap on the hands at once
    const L = W.lamb(), b = W.field.bounds, places = S.at === "chairs" ? arena.chairs || [] : S.at && arena.anchors[S.at] ? arena.anchors[S.at] : [];
    for (let k = 0; k < (S.n || 1); k++) {
      if (!ARCHETYPES[S.style]) continue;
      const p = places.length ? places[(n + k) % places.length] : null;
      const x = p ? p[0] + (S.at === "dip" ? -0.8 * k : 0) : L.x < (b.x0 + b.x1) / 2 ? b.x1 - 1.2 : b.x0 + 1.2;
      const z = p ? p[1] + (S.at === "dip" ? (k % 2 ? 1.2 : -1.2) : 0) : b.z0 + 1.5 + ((b.z1 - b.z0 - 3) * (k + 1)) / ((S.n || 1) + 1);
      const d = S.def || {}, over = { form: S.form || null, ...(d.speed != null ? { speed: d.speed } : {}), ...(d.accel != null ? { accel: d.accel } : {}) };
      const def = foeDef(null, S.style, over); if (d.hp != null) def.hp = d.hp;
      const hs = fighterSpec(`${F.id}-hand${n + k}`, "foe", def, [x, z], { face: datan2(L.z - z, L.x - x), brain: true });
      // the hands' own blows scaled for the fight (combat/data/fights.mjs): their tool strikes and their kind's specials,
      // never the moves every body shares (the shove, the riposte: the player's too)
      const own = new Set(ARCHETYPES[S.style].specials || []), mine = (id) => id.startsWith(`${hs.id}:`) || own.has(id);
      if (d.harm != null) hs.moves = Object.fromEntries(Object.entries(hs.moves).map(([id, m]) => [id, m.dmg && mine(id) ? { ...m, dmg: +(m.dmg * d.harm).toFixed(3) } : m]));
      W.addFighter(hs);
    }
    n += S.n || 1;
  };
}

// The character in the dream: the build given (the story's sheet, or the arena page's), the flaw's tool, and the
// boons the run has taken. A boon sharpens the harmful verb (critic 06 rule 3): harder blows, a quicker stroke,
// feet kept under a grab; it is never a disposition.
export function innerLamb(flaw, { levels = {}, boons = [] } = {}) {
  const def = lambDef(levels, flaw.tool || "w.stick");
  const sum = (k) => boons.reduce((s, b) => s + (+((b.effect || b)[k]) || 0), 0), has = (k) => boons.some((b) => (b.effect || b)[k] === true);
  if (sum("hp")) def.hp += sum("hp");
  if (sum("st")) { def.stamina += sum("st"); def.staminaRegen = (def.staminaRegen || 0) * (1 + sum("st") / 8); }
  if (has("keepFeet")) def.keepFeet = true;
  if (has("ways")) def.ways = true;
  if (sum("nose")) def.nose = sum("nose"); // The Nose (Under the Goats): the character reads tells sooner (innerworld.mjs moves them)
  if (sum("poise")) def.poise = (def.poise || 0) + sum("poise"); // The Good Hat (Fond of Them)
  if (sum("frontGuard")) def.frontGuard = Math.min(0.65, sum("frontGuard")); // The Line (Order's boon): front blows glance
  const reach = sum("reach"); // Reach (Everybody Says' boon): light strikes reach further
  const spec = fighterSpec("lamb", "lamb", def, [0, 0], { face: Math.PI / 2 });
  if (sum("heavy")) for (const [id, m] of Object.entries(spec.moves)) if (/^lamb:(hands:)?heavy/.test(id)) spec.moves[id] = { ...m, dmg: +(m.dmg * (1 + sum("heavy"))).toFixed(3) };
  if (reach) for (const [id, m] of Object.entries(spec.moves)) if (/^lamb:(hands:)?light_\d$/.test(id)) spec.moves[id] = { ...m, hits: (m.hits || []).map((h) => (h.r ? { ...h, r: [h.r[0], +(h.r[1] + reach).toFixed(3)] } : h)) };
  if (sum("quick")) for (const [id, m] of Object.entries(spec.moves)) if (/^lamb:(hands:)?light_\d$/.test(id)) spec.moves[id] = quicken(m, sum("quick"));
  return spec;
}

// A strike that starts q frames sooner: every window at or after the old wind-up's end moves back with it.
export function quicken(m, q) {
  const s = m.startup, n = Math.max(2, s - q), d = s - n, sh = (w) => (w ? [w[0] >= s ? w[0] - d : w[0], w[1] >= s ? w[1] - d : w[1], ...w.slice(2)] : w);
  const out = { ...m, startup: n, hits: (m.hits || []).map((h) => (h.at ? { ...h, at: sh(h.at) } : h)), cancel: Object.fromEntries(Object.entries(m.cancel || {}).map(([k, w]) => [k, sh(w)])) };
  for (const k of ["iframes", "parry", "armor"]) if (m[k]) out[k] = sh(m[k]);
  if (m.root) out.root = m.root.map((r) => sh(r));
  if (m.tell) out.tell = { ...m.tell, at: [Math.min(m.tell.at[0], n - 1), Math.min(m.tell.at[1], n - 1)] };
  if (m.sweep) out.sweep = m.sweep[0] < n ? [m.sweep[0], n] : null;
  return out;
}

// Raising a trait and fighting it are the same story (design/TRAITS.md section 2): the character's level in the
// flaw's trait (levels[flaw.trait], the sheet's own value) makes its being bigger, longer to bring down and harder
// hitting; a trait he has let go thin is a smaller thing. combat/data/traits.mjs EMBODY sets the bounds. Returns what
// it applied, for the drawer and the checks.
export function embody(spec, flaw, levels = {}) {
  const lv = flaw && flaw.trait != null ? levels[flaw.trait] : undefined, k = embodied(lv);
  spec.def.hp = Math.max(1, Math.round(spec.def.hp * k.standing));
  spec.def.height = +(spec.def.height * (1 + (k.standing - 1) * 0.5)).toFixed(3); spec.def.baseHeight = spec.def.height;
  for (const [id, m] of Object.entries(spec.moves)) if (m && m.dmg && !id.startsWith("lamb")) spec.moves[id] = { ...m, dmg: +(m.dmg * k.harm).toFixed(3), ...(m.hazard ? { hazard: { ...m.hazard, dmg: +((m.hazard.dmg ?? 1) * k.harm).toFixed(3) } } : {}) };
  return { trait: flaw && flaw.trait, level: lv ?? null, ...k };
}
