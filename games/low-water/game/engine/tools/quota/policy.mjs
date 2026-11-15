// The Quota slice's builds and routes (tools/use-policy.mjs, LW_STORY=quota). A build is a class line; a
// route is a class and the figure it reports at the district office, so eventcheck plays every branch.
// The menu machinery (intents, goal distances, route bonuses) is Low Water's, which reads only the
// script, so it is shared from tools/policy.mjs.
import { hashStr } from "../../core/rng.mjs";
import { intentOf, goalDist, routeBonus, endingFlags } from "../policy.mjs";
export { intentOf, goalDist, endingFlags };

// habit: how the harness fights for the build (tools/playthrough.mjs habits): an inspector talks, the militia fights
export const BUILDS = {
  // prefer: intents the build leans to (the Inspector reads the true figure aloud when he has it; the Sergeant
  // puts his back to the bar)
  inspector: { precedent: "q.ned", cls: "inspector", comps: ["pen", "hat"], voices: ["sum", "condolence"], weapons: [], ending: {}, habit: "tongue", prefer: { "sets:said.read_true_door": 6 } },
  militia: { precedent: "q.will", cls: "militia", comps: ["coat"], voices: ["grip", "ballast", "knees"], weapons: [], ending: {}, habit: "fist", prefer: { fight: 6 } },
};
// the story lead's variables: q_class (inspector, militia) and q_figure (true, inflated, blamed)
const R = (base, figure) => ({ base, want: [`assign:q_figure=${figure}`], avoid: [] });
export const ROUTES = {
  inspector_true: R("inspector", "true"), inspector_inflated: R("inspector", "inflated"), inspector_blamed: R("inspector", "blamed"),
  militia_true: R("militia", "true"), militia_inflated: R("militia", "inflated"), militia_blamed: R("militia", "blamed"),
  // 310, and standing aside at the granary door: the requisition takes Anni's bowl while Tomas is still at home
  // (q.coda.home, the children's home), which no other route reaches
  inspector_inflated_aside: { base: "inspector", want: ["assign:q_figure=inflated", "assign:q_door=aside"], avoid: ["sets:said.read_true_door"] },
  // the lore graph's routes (content/quota/q_lore.lwd, tools/lorecheck.mjs): the inspector who keeps his word and
  // goes up the hill with Tomas (the notebook), and the one who blames the Hesh and says nothing at the post
  // while Tomas is taken (the unmarked corner, a week later)
  inspector_hill: { base: "inspector", want: ["sets:q.promised_hill"], avoid: ["assign:q_cart=arrested"] },
  inspector_blamed_held: { base: "inspector", want: ["assign:q_figure=blamed", "assign:q_cart=arrested"], avoid: ["sets:said.read_true_door"] },
  // the fates (content/quota/q_week.lwd, design/spine-plan/03-FATES.md): the inspector who frees Tomas at the post
  // after blaming the Hesh, so the list comes to Haldane Yard for Aaron (H2, Gedge decides); the inspector who
  // puts his own name to Anni at the gate while Tomas is held (Bet walks her to the Furrowes' door); the inspector
  // who writes "of Tarn parentage" and nothing more; and the sergeant who keeps his bread, so Bet lets Anni go in
  inspector_blamed_free: { base: "inspector", want: ["assign:q_figure=blamed", "sets:said.ned_free_tomas", "sets:q.aaron_taken"], avoid: ["sets:said.read_true_door"] },
  inspector_claim: { base: "inspector", want: ["assign:q_figure=blamed", "assign:q_cart=arrested", "sets:q.ned_claimed"], avoid: ["sets:said.read_true_door", "sets:q.ned_food"] },
  inspector_parentage: { base: "inspector", want: ["assign:q_figure=inflated", "assign:q_door=aside", "sets:q.ned_parentage"], avoid: ["sets:said.read_true_door", "sets:q.ned_claimed"] },
  militia_gate_in: { base: "militia", want: ["assign:q_figure=inflated"], avoid: ["sets:q.will_bread"] },
  // the sergeant who goes down under the granary door (q.granary.broken.will, world.will_down and its echo, the
  // weighted-devices pass 2026-10-23): a route whose name ends in _down stands in a fight and takes it
  // (tools/playthrough.mjs habits), so the door is lost on some run
  militia_door_down: { base: "militia", want: ["assign:q_figure=inflated"], avoid: ["sets:said.read_true_door", "assign:q_door=aside"] },
  // chain B whole (design/eras/INDEX.md section 5): Will opens the Well House door in era 3 (B1), Ann sits back down
  // with Davey in era 4 (B2), and at the Haldane door in era 5 her words stand Leon down (B3); Dorrah's page catalogued
  // chain F reaches a Brack in era 5: Tom carries Nan's words to Ann's door (e5.fb), and she says them at the Haldane door
  inspector_door: { base: "inspector", want: ["sets:said.e4_ruth_stay", "sets:said.e5_tom_to_ann"], avoid: [] },
  militia_door: { base: "militia", want: ["sets:said.e3_will_door", "sets:said.e4_ann_stay", "sets:said.e5_leon_down", "sets:said.e5_page_kept"], avoid: [] },
  // era 5's movements (e5.move, design/eras/era5.md section 1), one route per class and movement, so each is played
  // through to e5.end (tools/endingcheck.mjs, Every movement); each also takes one era 5 decision the other routes
  // leave, so every ending variant is reached on some run (the true certificate, the torn page, the given page,
  // Leon's true statement, the flat cleared)
  ...movementRoutes(),
};
function movementRoutes() {
  const MV = { union: ["sets:e5.mv_union"], league: ["sets:e5.mv_league"], alliance: ["sets:e5.mv_alliance"], well: ["sets:e5.mv_well_asked"], none: ["sets:e5.mv_none"] };
  const AVOID = { none: ["sets:e5.mv_well_asked"] };
  const TAKE = {
    inspector: { union: ["sets:said.e5_tom_clip"], league: ["sets:said.e5_ledger_take"], alliance: ["sets:said.e5_page_given"], well: ["sets:said.e5_tom_resign"], none: ["sets:said.e5_page_lost"] },
    militia: { union: ["sets:said.e5_leon_true"], league: ["sets:said.e5_ledger_take"], alliance: ["sets:said.e5_page_given"], well: ["sets:e5.house_cleared"], none: ["sets:said.e5_page_lost"] },
  };
  const out = {};
  for (const cls of ["inspector", "militia"]) for (const m of Object.keys(MV)) out[`${cls}_mv_${m}`] = { base: cls, want: [...MV[m], ...TAKE[cls][m]], avoid: AVOID[m] || [] };
  return out;
}
export const baseOf = (b) => (ROUTES[b] ? ROUTES[b].base : b);

// a class option (one that assigns q_class) goes to its own build only; otherwise new options first, then an
// order fixed by the seed
export function score(G, build, o, { seed = 0 } = {}) {
  if (o.locked) return -Infinity;
  const b = baseOf(build), cls = [...intentOf(G, o)].map((k) => k.match(/^assign:q_class=(\w+)$/)).find(Boolean);
  if (cls) return !BUILDS[b] ? hashStr(o.key, seed) / 4294967296 : BUILDS[b].cls === cls[1] ? 100 : -Infinity; // a random run picks a class by its seed
  const tie = hashStr(o.key, seed) / 4294967296, visits = G.memory.visits(o.s.target) + (o.s.fail ? G.memory.visits(o.s.fail) : 0);
  let sc = tie * 0.5 + (visits === 0 ? 3 : -visits * 1.5) - (o.said ? 1 : 0);
  for (const k of intentOf(G, o)) sc += (BUILDS[b] && BUILDS[b].prefer && BUILDS[b].prefer[k]) || 0;
  if (ROUTES[build]) sc += routeBonus(G, ROUTES[build], o);
  return sc;
}
export const strainFor = () => 0;
export const applyMax = () => null;
// between beats: spend points into the build's own voices
export function upkeep(G, build) {
  const B = BUILDS[baseOf(build)]; if (!B) return;
  for (let guard = 0; G.state.sheet.points > 0 && guard < 20; guard++) { const v = B.voices.find((id) => G.rs.skills[id] && G.sheet.canRaise(id)); if (!v) break; G.sheet.raise(v); }
}
