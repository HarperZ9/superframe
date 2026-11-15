// The Adversary (DECISIONS-2026-10-22.md, inferno decision 1): B, the Host, in three movements, once, at the
// end of era 5, on the ice of the Cocytus ring (design/spine-plan/inferno/04-ADVERSARY.md).
//   1 the Accuser (variant A): a tall man in a black coat with a cane, under one lamp, who fights at a desk's
//     distance and closes it fast. Force ends him; so does standing still once the fight is joined, when he lets
//     the player go.
//   2 the Host proper (variant B): the run's kept lies in one body wearing the player's own line, its limbs
//     fighting beside it on ice that spreads. Force ends it; so does facing each limb in turn, standing under its
//     blows until it drops away.
//   3 the One Who Withdraws (variant C): it strikes and is gone, and comes again from behind; a whisper follows.
//     Force ends it, or facing it when it comes, and the one card says "It will be back."
// It is built from the run (04-ADVERSARY section 1.2): its limbs are the flaws this run kept (beaten by force),
// and a run that kept none still meets it, smaller. It touches no fate, wears only the player's line, and
// disclaims power once (section 1.3). Every line is a PROPOSAL. Captions name the speaker as the Accuser, the Host or
// the trait whose voice first said the lie, never by a devil's name (inferno/07-SENSES.md section 3).
// The traits pass (2026-10-23, design/TRAITS.md): the Accuser is no clerk and reads nothing. He is the one who stood at
// the player's shoulder for every fight, and he speaks the run's own traits back to it in their voices; the Host is
// the combined monstrosity, its limbs the traits the run cut back or lost to; the whisper is a trait that is never gone.
import { H, step, beat } from "./flaws-common.mjs";
import { ACCUSER_FIGHT, HOST_FIGHT, WITHDRAWS_FIGHT, LIMB_MOVES } from "./fights-host.mjs";
import { scaled } from "./fights.mjs";

const proposal = (ls) => ls.map((l) => ({ ...l, proposal: true }));

export const HOST = {
  id: "host", n: 13, era: 5, liar: "the line", line: "both", town: "The Host", sin: "the betrayed bond (Judecca)", adversary: true,
  method: "Job's adversary as an officer of the court; Judecca's ice; the whisperer who withdraws (Qur'an 114) and Mara, who goes when he is known",
  // era 5's night before the clearance day (design/eras/era5.md e5.s11), after the Descent (combat/arena/descent.mjs);
  // the clearance day's scenes (e5_day) follow, and no outcome changes their people (2026-10-23; it was q_coda while
  // the slice ended in era 2)
  hinge: { after: "e5_day", when: "once, the night before the clearance day, after the Descent" },
  arena: "ice", anchor: { name: "the lamp, which never goes out", key: "lamp", draw: "lamp" },
  // an amalgamation may exceed the room, which gives way round it (DECISIONS-2026-10-22, inner arena staging call 2);
  // it gets smaller with every name (04-ADVERSARY 3)
  cap: { height: 4.4 },
  specials: {
    // the Host's wings: a slow beat over the ice, a ring that closes as it winds up
    "host.wing": { startup: 44, active: 6, recovery: 40, stamina: 1, dmg: 1.0, poise: 3, hits: [H([-180, 180], [0, 3.0], { y: [0, 1.2] })], guardBreak: true, parryable: false, armor: [0, 50, 4],
      tell: { at: [6, 43], kind: "slam" }, hitstop: 7, knock: 2.4, shake: 0.5 },
    // a limb strikes with the move of the lie it was (the drawn form says which); one limb at a time
    "host.limb": { startup: 30, active: 6, recovery: 34, stamina: 1, dmg: 1.0, poise: 3, hits: [H([-40, 40], [0.3, 2.4])], tell: { at: [4, 29], kind: "swing" }, track: 8, trackUntil: 22, hitstop: 6, knock: 1.8, shake: 0.35 },
  },
  movements: [
    { id: "accuser", name: "the Accuser", shown: "The Accuser", form: "accuser", floor: 1,
      body: { tool: "w.hands", standing: 20, breath: 8, poise: 99, speed: 0, accel: 0, turn: 2, radius: 0.5, height: 1.8, grip: 5 },
      phases: [], // fights-host.mjs ACCUSER_FIGHT
      // once the fight is joined, eight seconds with no blow landed and he lets the player go
      silence: 480,
      verbs: { endure: { silence: 480, beat: beat("e5_day", "He lowers the cane, steps back into the dark past the lamp, and is not there. Nothing is won.") } },
      lines: proposal([
        { at: "start", voice: "accuser", text: "Sit down. You know why you're here. I was there every time. I was stood right behind you." },
        { at: "struck", voice: "accuser", text: "Again. You always do." },
        // said once per playthrough, one line, no music (inferno/08 section 3.3: may be cut to its act)
        { at: "once", voice: "accuser", text: "I never made you do anything. I asked, and you did it. Look at your hands." },
        { at: "end", voice: "accuser", text: "Go on, then. Go home. They'll all be there when you get in." },
      ]) },
    { id: "host", name: "the Host", shown: "The Host", form: "host", floor: 1,
      body: { tool: "w.hands", standing: 40, breath: 12, poise: 99, speed: 0.6, accel: 6, turn: 3, radius: 0.8, height: 4.4, grip: 10 },
      phases: [{ name: "the Host", until: -1, rest: 80, pattern: [step("host.wing", 0, 3.0)] }],
      // every blow the player lands spreads the ice one ring in from the edge; when it covers this share of the
      // floor, it has reached him
      freeze: { perBlow: 0.5, reach: 0.85 }, naming: { hold: 90 },
      verbs: {
        name: { hold: 90, beat: beat("e5_day", "The Host is a man of the player's line on the ice, alone. He wakes.") },
        lose: { beat: beat("e5_day", "The ice reaches him and closes over his boots, then his knees. He wakes stiff with cold.") },
      },
      lines: proposal([
        { at: "start", voice: "host", text: "You only did what they sent you to do." },
        { at: "struck", voice: "host", text: "Go on. Hit me. It's what we do." },
        { at: "named", voice: "host", text: "Somebody had to. Somebody had to. Nobody can say you didn't." },
        { at: "once", voice: "host", text: "I never made you do anything. You're the one that keeps me." },
      ]) },
    { id: "withdraws", name: "the One Who Withdraws", form: null, floor: 1,
      whisper: { every: 240 }, naming: { hold: 90 },
      verbs: { endure: { beat: beat("e5_day", "First light comes with the whisper still at the edge of hearing. He goes in to the table, and he can still hear it under the kettle.") },
        name: { hold: 90, card: "It will be back.", beat: beat("e5_day", "The yard at first light; snow light no lamp made. He goes in to the table. The table scene that follows is unchanged.") } },
      lines: proposal([
        { at: "whisper", voice: "ballast", text: "It was only the once." },
        { at: "whisper", voice: "condolence", text: "He's with you. He's all right." },
        { at: "whisper", voice: "formletter", text: "Nobody's going to come and check." },
      ]) },
  ],
  // the Host's faces are the player's line only
  faces: ["abel", "ned", "will", "pell", "ruth", "ann", "leon", "era5"], objects: ["the town's coats hung on it like rags on a scarecrow", "the cane and the lamp", "dark shapes under the ice"],
  senses: { look: "black ice, one lamp, dark shapes under the ice; then the frozen river, era 2 snow under era 5 sodium; then the empty yard", sound: "silence; every motif of the run falling away one by one as limbs are named; one whisper, then nothing, then the town waking", haptic: "a weak cold tremor that grows with each blow the player lands", grammar: "time held; the far wall in another era; then no break" },
  boon: null, // the Adversary offers nothing: force cannot end it
};

// each movement a real fight (combat/data/fights-host.mjs, the rework of 2026-10-23): its body, its moveset and its
// phases; force ends it. The stillness, facing it and the whisper stay, as layers over the fight.
for (const [M, Fi] of [[HOST.movements[0], scaled(ACCUSER_FIGHT)], [HOST.movements[1], scaled(HOST_FIGHT)], [HOST.movements[2], scaled(WITHDRAWS_FIGHT)]]) {
  M.body = { ...(M.body || {}), ...Fi.body }; M.phases = Fi.phases; M.floor = 0; M.form ||= "withdraws";
  Object.assign(HOST.specials, Fi.moves);
}
Object.assign(HOST.specials, scaled({ body: { standing: 1 }, moves: LIMB_MOVES, phases: [] }).moves);
HOST.boon = null;
