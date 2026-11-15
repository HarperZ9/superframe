// The story systems a content set may use (The Quota first; design/quota/04-SYSTEMS.md and PITCHES 3c), loaded
// and installed together so the core game file carries two lines for all of them:
//   props (world/props.mjs)   examine, per-era prop states
//   lore (world/lore.mjs)     fragments in three layers, chains and their routes
//   world facts (save/worldrecord.mjs)  what a finished run leaves for the next; the record itself needs storage,
//                             so the shell and the harness install it (installWorldRecord)
//   the read-back (world/readback.mjs)  two columns, self-lies paired with what happened, unskippable
//   discourse (world/discourse.mjs)  claims on the model's carriers; repeat, challenge, tear down, paste over
//   dreams (world/dreams.mjs)  a possible future from the model, through the dreamer's fear; both readings kept
//   the witness (world/witness.mjs)  the read-back played as a scene; the ledger kept underneath as its oracle
//   perspectives (world/perspective.mjs)  a chapter on a second sheet, and the run's own character back whole
//   senses (world/senses.mjs)  @cue: what a moment does to the screen, the ears, the pad and the bodies
//   burden (world/burden.mjs)  @load and @scale: weight felt in the walk and the posture, never counted
//   echoes (world/echo.mjs)    @echo: what happened, shown in the place and the people when you come back
// Each part does nothing for content that has none of its records.
import { loadProps, installProps } from "./props.mjs";
import { loadLore, installLore } from "./lore.mjs";
import { loadWorldFacts } from "../save/worldrecord.mjs";
import { loadReadback, installReadback } from "./readback.mjs";
import { loadClaims, installDiscourse } from "./discourse.mjs";
import { loadDreams, installDreams } from "./dreams.mjs";
import { loadPerspectives, installPerspectives } from "./perspective.mjs";
import { loadWitness, installWitness } from "./witness.mjs";
import { loadCues, installSenses } from "./senses.mjs";
import { loadBurden, installBurden } from "./burden.mjs";
import { loadEchoes, installEcho } from "./echo.mjs";

export function loadStorySystems(book) {
  const props = loadProps(book), lore = loadLore(book), wf = loadWorldFacts(book), rb = loadReadback(book), cl = loadClaims(book), dr = loadDreams(book), pv = loadPerspectives(book), wi = loadWitness(book);
  const cu = loadCues(book), bu = loadBurden(book), ec = loadEchoes(book);
  return { cues: cu.cues, burden: { loads: bu.loads, scales: bu.scales }, echoes: ec.echoes, witness: wi.witnesses, perspectives: pv.perspectives, props: props.props, objects: props.objects, lore, worldfacts: wf.worldfacts, readback: rb, claims: cl.claims, dreams: dr.dreams, errors: [...props.errors, ...lore.errors, ...wf.errors, ...rb.errors, ...cl.errors, ...dr.errors, ...pv.errors, ...wi.errors, ...cu.errors, ...bu.errors, ...ec.errors] };
}

export function installStorySystems(G, S) {
  installSenses(G, S.cues || {}); // first: the others fire cues
  installBurden(G, S.burden || { loads: {}, scales: {} });
  installEcho(G, S.echoes || {});
  installProps(G, S.props);
  installLore(G, S.lore || { fragments: {}, chains: {} });
  installReadback(G, S.readback || { selflies: {}, said: {}, docs: {} });
  installDiscourse(G, S.claims || {});
  installDreams(G, S.dreams || {});
  installPerspectives(G, S.perspectives || {});
  installWitness(G, S.witness || {});
}
