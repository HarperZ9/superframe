// The traits: every quality the character carries is a being in the inner arena (design/TRAITS.md; the author,
// 2026-10-23: "this is each trait embodied, and fought"). One table, read by the build (combat/data/build.mjs), the
// character page (ui/create.mjs, ui/build.mjs), the inner arena (combat/arena/*) and the story's hinge
// (combat/innerhook.mjs). The ids are the old ones, kept because saves, checks, traces and 4,000 lines of content
// read them (design/TRAITS-RENAME.md has the table); only the names and what each trait is changed.
//   compartments: four great traits, each a pillar of the fight and a gate of the Descent
//   voices: sixteen traits, four under each compartment, each one a boss (`flaw`)
// A trait's name never names a sin (combat/tools/notallycheck.mjs R3): the sin it feeds is kept in `sin`, for the
// designers, and is never drawn.

export const COMPARTMENT_TRAITS = {
  coat: { name: "HARDNESS", pillar: "Endure", form: "hardness", voices: ["knees", "ballast", "pride", "grip"],
    does: "What you can take: cold, a blow, a load, a night on your feet. Standing, the weight you carry, the heavy tools.",
    body: "a man poured in concrete, the shuttering boards still bolted to him, sacks set into his chest like stones in a wall",
    lines: [{ at: "start", voice: "coat", text: "You carried me all the way down here. You've carried worse. Stand up, then.", proposal: true }] },
  nose: { name: "FEAR", pillar: "Evade", form: "fear", voices: ["smell", "dark", "undertow", "salt"],
    does: "How you get out of the way: a step aside, a shadow, the door nobody saw you use. Dodges, footing, getting clear.",
    body: "a tall figure painted in stripes across every wall at once, so you only see it where the stripes bend",
    lines: [{ at: "start", voice: "nose", text: "Go on. Run. You know the way out of every room you've ever been in.", proposal: true }] },
  pen: { name: "SUSPICION", pillar: "Read", form: "suspicion", voices: ["sum", "precedent", "smallprint", "carbon"],
    does: "What you see coming: the lie, the light sack, the shoulder before the blow. Reading blows early, weak points, breath.",
    body: "a stepped column with a sunburst for a head, every ray an eye-slit, turning to follow you",
    lines: [{ at: "start", voice: "pen", text: "I saw you. Every time. I knew what was in the sack before you lifted it.", proposal: true }] },
  hat: { name: "AUTHORITY", pillar: "End", form: "authority", voices: ["condolence", "formletter", "chit", "hearsay"],
    does: "How you make a thing stop: the look that ends a quarrel, the word that ends a fight. People give in sooner.",
    body: "a stepped tower of a man in a crown of iron rays, standing on a plinth of clay he will not kneel to",
    lines: [{ at: "start", voice: "hat", text: "Kneel. No? Nor did I. Not to them, not to anyone. Look where it's got us.", proposal: true }] },
};

// flaw: the boss record (combat/data/flaws.mjs); sin: what the trait becomes when it is fed (never shown);
// does: one plain line for the character page; tools: the fight numbers it raises (combat/data/build.mjs)
export const VOICE_TRAITS = {
  sum: { name: "PRUDENCE", of: "pen", flaw: "prudence", sin: "avarice",
    does: "Knows what a thing weighs and what it's worth, and keeps quiet about it.", tools: "Swings cost less breath; the stick, the fid and the spanner hit harder." },
  precedent: { name: "LOYALTY", of: "pen", flaw: "order", sin: "wrath",
    does: "Your family's words in your mouth. What your father did, you do.", tools: "Finds the weak point after a blow you read." },
  smallprint: { name: "COWARDICE", of: "pen", flaw: "barn", sin: "false witness",
    does: "Finds the reason it was never your job. Quick to see a way out.", tools: "No tool of its own. It talks, and you meet its body inside." },
  carbon: { name: "GUILT", of: "pen", flaw: "figure", sin: "despair",
    does: "Puts the scene back as it happened, and makes you stand in it.", tools: "Reads a blow earlier and finds the weak point; the marlinspike and the fid." },
  knees: { name: "WEARINESS", of: "coat", flaw: "only", sin: "sloth",
    does: "Stairs, cold, the long day. Wants to sit down. Gets you through by wanting less.", tools: "More breath; the roll carries further; the oar, the beetle and bare hands." },
  ballast: { name: "OBEDIENCE", of: "coat", flaw: "forty", sin: "complicity",
    does: "Holds the line it's given. Keeps you on your feet when the ground moves.", tools: "Poise; the pole, the chain and the hammer." },
  pride: { name: "VANITY", of: "coat", flaw: "fond", sin: "pride",
    does: "Needs to be seen and liked. Keeps your back straight in a good coat.", tools: "The case catches a longer window; the key and the bell jar." },
  grip: { name: "APPETITE", of: "coat", flaw: "friday", sin: "gluttony",
    does: "The hands' wanting: the bread, the door, the man. Remembers in the knuckles.", tools: "Blows break poise; the hammer, the crowbar and bare hands." },
  condolence: { name: "TENDERNESS", of: "hat", flaw: "withme", sin: "the betrayed bond",
    does: "Sees the hurt in people and wants to hold on. Holds on too long.", tools: "People give in sooner; the bell jar." },
  formletter: { name: "CONTEMPT", of: "hat", flaw: "check", sin: "the refusal to bow",
    does: "Talks down. Makes a man feel the size he is.", tools: "People give in sooner; the case and the pole." },
  chit: { name: "JEALOUSY", of: "hat", flaw: "jealousy", sin: "envy",
    does: "Sees what the other man has and what he paid. Never lets it go.", tools: "No tool of its own. It talks, and you meet its body inside." },
  hearsay: { name: "SPITE", of: "hat", flaw: "says", sin: "slander",
    does: "Says the thing that will hurt, and says it where it will spread.", tools: "People give in sooner." },
  smell: { name: "DISGUST", of: "nose", flaw: "goats", sin: "hatred of a people",
    does: "Smells sickness, smoke, the store that isn't empty. Wants to wash its hands of people.", tools: "The eel spear." },
  dark: { name: "DREAD", of: "nose", flaw: "dread", sin: "flight from the field",
    does: "Knows what's coming before it comes. Sees in the dark.", tools: "Longer dodges; the knife and the stick." },
  undertow: { name: "SHAME", of: "nose", flaw: "shame", sin: "concealment",
    does: "Knows what people hide because it hides things too. Pulls you toward it.", tools: "Reads a blow earlier; the crowbar." },
  salt: { name: "NERVE", of: "nose", flaw: "nearest", sin: "murder",
    does: "The body's nerve: weather in the joints, the will to go first.", tools: "Longer dodges; the eel spear, the tiller, the boathook and the oar." },
};

// the boss id the story used before the rename (design/TRAITS-RENAME.md section 3): saves and old content read through it
export const MIGRATE_FLAW = { received: "prudence" };
export const flawId = (id) => MIGRATE_FLAW[id] || id;

export const TRAIT_OF_FLAW = Object.fromEntries(Object.entries(VOICE_TRAITS).map(([v, t]) => [t.flaw, v]));
export const COMPARTMENT_OF = Object.fromEntries(Object.entries(VOICE_TRAITS).map(([v, t]) => [v, t.of]));
// A voice or compartment id to its shown name; other speakers (the Host, a human voice) come back as given
export function traitName(id) {
  const k = String(id || "").toLowerCase();
  return (VOICE_TRAITS[k] || COMPARTMENT_TRAITS[k] || {}).name || null;
}

// Raising a trait and fighting it are the same story: the level the character has in a trait (the sheet's own
// value, attribute plus ranks plus every modifier) makes its being bigger and harder. Five is a middling man; each
// point above it adds standing and harm, each point below takes some away, within bounds.
export const EMBODY = { base: 5, standing: 0.06, harm: 0.04, min: 0.82, max: 1.5 };
export function embodied(level) {
  const d = (Number.isFinite(+level) ? +level : EMBODY.base) - EMBODY.base, clamp = (x) => Math.max(EMBODY.min, Math.min(EMBODY.max, x));
  return { standing: +clamp(1 + EMBODY.standing * d).toFixed(3), harm: +clamp(1 + EMBODY.harm * d).toFixed(3) };
}

// What each ending does to the trait in the character (design/TRAITS.md section 2). Beaten by force, the trait is
// cut back: the tools it scaled lose it, and it comes back in the Descent. Made terms with (yield, endure, refuse,
// name), it keeps the character's ear. Lost to, it has him: louder in every scene, stronger in his hands, and
// bigger when he meets it again. Every one of these is paid for somewhere: nothing here heals.
export const OUTCOME_MARK = { force: -1, terms: 1, lose: 2 };
export const markOf = (verb) => (verb === "force" ? "force" : verb === "lose" ? "lose" : "terms");
export const MARK_WORDS = { force: "cut back inside", terms: "made terms with inside", lose: "took him inside" };

// The Descent's gates: one per compartment, armed when a voice under it is fed (its level at or over FED) or was
// beaten or lost to; the gate's being fights as its most-fed voice, with the next voice's blows in its hands.
export const FED = 7;
