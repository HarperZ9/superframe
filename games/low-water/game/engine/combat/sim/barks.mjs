// Voice barks in a fight (SYSTEMS-FULL 18.9, NOTES C3): one short line from a skill, chosen by
// the situation, never stopping the action. Each rule names a voice and a key; the world emits
// { type: "bark", voice, key, text }. Content will supply the lines as @bark records (skill, when,
// text); until then the engine's plain lines below stand in. A voice speaks at most once every `gap` frames, and
// only one bark plays every `spacing` frames.
import { angleTo, wrapAngle } from "./fighter.mjs";
import { rand01 } from "../../core/rng.mjs";
import { dhypot } from "./math.mjs";

export const BARK_TEXT = {
  // the engine's own lines, for a story with no @bark records and for the arena page: plain, and true of any
  // ground and any town, so a fight never shows a placeholder or another story's place
  // (tests/barks-story.test.mjs fails any line marked "[placeholder]" here or reached in a story)
  "footing.frost": "Frost under the boot. Short steps.",
  "footing.wet": "Wet ground. The whole foot down.",
  "breath.low": "Out of breath. Step back and let it come.",
  "tide.near": "Water coming up behind you. Move.",
  "smell.behind": "Sweat and smoke, behind you.",
  "tell.grab": "He wants you to block.",
  "dark.near": "Breathing, close, where the light isn't.",
  "pride.losing": "Losing, and everyone watching.",
  // the HAT voices: words that hold ground (director, 2026-10-17, "talkers earn the talk exit with words
  // and held ground"); each one spoken fills Composure (sim/world.mjs, COMPOSURE.words)
  "words.condolence": "He's hurt. Tell him you can see it.",
  "words.formletter": "Say it plainly. You've no quarrel with him.",
  "words.chit": "You owe nobody here a blow. Say so.",
  "words.hearsay": "The others are watching him. Say it where they can hear.",
};
// a HAT voice speaks only at this level or above (a talker's words, not anyone's)
export const WORDS_FROM = 4;
export const HAT_VOICES = ["condolence", "formletter", "chit", "hearsay"];

const RULES = [
  { voice: "ballast", key: "footing.frost", when: (W, L, s) => s.foot.frost },
  { voice: "ballast", key: "footing.wet", when: (W, L, s) => s.foot.kind === "wet stone" },
  { voice: "knees", key: "breath.low", when: (W, L) => L.st < 1.5 },
  { voice: "salt", key: "tide.near", when: (W, L, s) => s.rising && s.foot.depth > -0.12 && s.foot.depth < 0.08 },
  { voice: "smell", key: "smell.behind", when: (W, L, s) => s.foes.some((F) => behind(L, F) && W.defs[F.id] && upwind(W, L, F)) },
  { voice: "undertow", key: "tell.grab", when: (W, L, s) => s.grab },
  { voice: "dark", key: "dark.near", when: (W, L, s) => s.foes.some((F) => !W.visible(L, F) && dhypot(F.x - L.x, F.z - L.z) < 4) },
  { voice: "pride", key: "pride.losing", when: (W, L, s) => s.foot.wet && L.hp < L.hpMax * 0.4 },
  { voice: "condolence", key: "words.condolence", words: true, when: (W, L, s) => s.foes.some((F) => F.hp < F.hpMax * 0.7) },
  { voice: "formletter", key: "words.formletter", words: true, when: (W, L, s) => W.tick >= 240 && s.held },
  { voice: "chit", key: "words.chit", words: true, when: (W, L, s) => L.guardT > 0 && s.held },
  { voice: "hearsay", key: "words.hearsay", words: true, when: (W, L, s) => s.foes.length >= 2 && s.held },
];

const behind = (L, F) => Math.abs(wrapAngle(angleTo(L, F) - L.face)) > (2 * Math.PI) / 3;
const upwind = (W, L, F) => { const t = W.field.terms, d = dhypot(L.x - F.x, L.z - F.z) || 1, w = dhypot(t.windX, t.windZ) || 1; return ((L.x - F.x) * t.windX + (L.z - F.z) * t.windZ) / (d * w) > 0.5; };

export const BARK_KEYS = ["footing.frost", "footing.wet", "breath.low", "tide.near", "smell.behind", "tell.grab", "dark.near", "pride.losing", "words.condolence", "words.formletter", "words.chit", "words.hearsay"];

// A key's text is a line or a list of variants. Each bark picks one at random (the fight's seeded roll)
// among the lines not yet spoken this fight; when every variant has been spoken the key starts afresh.
export function pickLine(W, key, lines, used) {
  if (!Array.isArray(lines)) return lines;
  if (!lines.length) return key;
  let left = lines.map((_, i) => i).filter((i) => !used.has(`${key}#${i}`));
  if (!left.length) { for (let i = 0; i < lines.length; i++) used.delete(`${key}#${i}`); left = lines.map((_, i) => i); }
  const i = left[Math.min(left.length - 1, Math.floor(rand01(W.seed, `bark:${key}:${W.tick}`) * left.length))];
  used.add(`${key}#${i}`);
  return lines[i];
}

export function createBarks({ gap = 600, spacing = 150, every = 15, text = BARK_TEXT } = {}) {
  const last = {}, used = new Set();
  let lastAny = -1e9, tide = null;
  return (W) => {
    if (W.tick % every) return;
    const L = W.lamb(); if (!L || L.fallen) return;
    const rising = tide !== null && W.field.terms.tide > tide; tide = W.field.terms.tide;
    const foes = W.fighters.filter((F) => F.team !== L.team && !F.out && !F.yielded);
    const grab = W.events.some((e) => e.type === "tell" && e.kind === "grab") || foes.some((F) => F.act && W.moves[F.act.id].tell && W.moves[F.act.id].tell.kind === "grab" && F.act.f < 12);
    // held: Lamb has not struck in the last second (words come from holding ground, not trading blows)
    const s = { foot: W.field.footing(L.x, L.z), foes, rising, grab, held: W.tick - (L.struckAt ?? -1e9) > 60 };
    const lv = W.defs[L.id].levels || {};
    if (W.tick - lastAny < spacing) return;
    for (const r of RULES) {
      if (W.tick - (last[r.voice] ?? -1e9) < gap || (r.words && (lv[r.voice] ?? 0) < WORDS_FROM) || !r.when(W, L, s)) continue;
      last[r.voice] = lastAny = W.tick;
      W.emit({ type: "bark", voice: r.voice, key: r.key, text: pickLine(W, r.key, text[r.key] || r.key, used) });
      return;
    }
  };
}
