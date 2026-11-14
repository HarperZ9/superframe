// The Quota's arena (design/quota/05-ARENA.md): the arena mode's fiction, as data over the engine as built.
// Two venues in one yard behind the Orme mill: the bread fights (eras 2 and 3) and the boxing club (eras 4
// and 5). Each venue names the archetypes and gives them their kit (a tool), names the bosses, and names the
// boons; the moves, the brains, the ladder and the records are unchanged. Low Water's arena is the run with
// no skin (combat/arena/run.mjs createRun without `skin`).
//   SKINS[venue] = { name, eras, keeper, arena, archetypes: { style: { name, tool } }, bosses: [ids], boons: { id: { name, from } } }
// Bosses here are combat/data/bosses.mjs ids: foreman (the Yard Foreman), champion (the Club Champion),
// captain (the Requisition Captain), debtman (the Debt Man), sergeant (the Clearance Sergeant, a story boss).

const kit = (name, tool) => ({ name, tool });

export const SKINS = {
  bread: {
    name: "The bread fights", eras: [2, 3], keeper: "George Orme's yard foreman; the miller takes a cut",
    purse: "a loaf, then a sack: every one won is one a named family did not get, and the board by the gate chalks whose",
    arena: "millyard",
    archetypes: {
      holder: kit("The weighman", "w.boathook"), skirmisher: kit("The gleaner", "w.crowbar"),
      sweeper: kit("The thresher", "w.pole"), shield: kit("The doorman", "w.hands"), cutter: kit("The sickle boy", "w.knife"),
      hound: kit("The mill dogs", "w.hands"), swarm: kit("The rats", "w.hands"), grappler: kit("The sack man", "w.hands"),
      zealot: kit("The penitent", "w.stick"), captain: kit("The requisition corporal", "w.boathook"),
    },
    bosses: ["foreman", "captain"],
    boons: {
      wind: { name: "A crust", from: "a heel of bread from someone's share" },
      edge: { name: "A nip of spirit", from: "the foreman's bottle; the others see you take it", record: true },
      read: { name: "The corner man's advice", from: "an old fighter at the brazier" },
      footwork: { name: "Better boots", from: "off a man who lost" },
    },
  },
  club: {
    name: "The boxing club", eras: [4, 5], keeper: "the promoter, a Furrow League man; the purses paid by the ring-road syndicate",
    purse: "rent money from the Upper Town's houses: the board names the street it came from",
    arena: "clubring",
    archetypes: {
      holder: kit("The heavyweight", "w.hands"), skirmisher: kit("The mover", "w.hands"),
      sweeper: kit("The swinger", "w.hands"), shield: kit("The guard", "w.hands"), cutter: kit("The jabber", "w.hands"),
      hound: kit("The rusher", "w.hands"), swarm: kit("Tag bouts", "w.hands"), grappler: kit("The clincher", "w.hands"),
      zealot: kit("The brawler", "w.hands"), captain: kit("The ex-copper", "w.hands"),
    },
    bosses: ["champion", "debtman"],
    boons: {
      wind: { name: "A crust", from: "the cafe on Mill Street, on tick" },
      edge: { name: "A nip of spirit", from: "the promoter's flask; the others see you take it", record: true },
      read: { name: "The corner man's advice", from: "the old trainer in the corner" },
      footwork: { name: "Better boots", from: "the club's lost-property box" },
    },
  },
};

// the archetype's name and def for a venue (a foeDef with the venue's kit, combat/roster.mjs)
export function skinFoe(skin, style, def, profileOf) {
  const k = SKINS[skin] && SKINS[skin].archetypes[style]; if (!k) return def;
  return { ...def, name: k.name, ...(k.tool && profileOf ? { tool: profileOf(k.tool) } : {}) };
}
