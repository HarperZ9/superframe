// The arena's marks, drawn after the dither at full resolution: Standing and Breath as ticks
// along the bottom edge (Daybook-edge marks, not bars over the world), the clock, tide and wind,
// a lock mark, one bark line, short notes for catches and blocks, and the outcome.
import { traitName } from "../data/traits.mjs";

const FONT = "13px ui-monospace, Consolas, monospace";

// The sins are the designer's labels and never reach the player (design/spine-plan/inferno/02-BESTIARY-A.md
// rule 2; 08-CRITIQUE.md point 1). Some of the game's skill voices share a sin's name (PRIDE); inside the inner
// arena a line in such a voice is captioned with the boss's shown name instead (07-SENSES.md section 3: "the
// speaker named as the skill (SUM, BALLAST) or as the boss's town name, never as a demon"). Since the traits pass
// (2026-10-23) a voice is captioned by its trait's name (PRUDENCE, OBEDIENCE), and no trait's name is a sin's.
export const SIN_WORDS = /\b(pride|proud|wrath|anger|envy|greed|avarice|gluttony|lust|sloth|acedia|vainglory|sadness|false witness|slander|deadly sin)\b/i;
// the speakers that are not traits: the Adversary's movements
const SPEAKERS = { accuser: "THE ACCUSER", host: "THE HOST" };
export function captionOf(W, bark) {
  // a trait speaks under its own name (combat/data/traits.mjs: the voice id "sum" is PRUDENCE), which never names a sin
  const voice = String(traitName(bark.voice) || SPEAKERS[bark.voice] || bark.voice || "");
  if (!W.inner || !SIN_WORDS.test(voice)) return voice.toUpperCase();
  const B = W.fighters.find((F) => W.defs[F.id].boss), d = B && W.defs[B.id];
  return String((d && d.name) || "").toUpperCase();
}

function ticks(g, x, y, n, max, label, on = "#efe4d2") {
  g.fillStyle = "#efe4d2"; g.fillText(label, x, y + 9);
  for (let i = 0; i < Math.ceil(max); i++) {
    const f = Math.max(0, Math.min(1, n - i));
    g.fillStyle = "rgba(239,228,210,0.25)"; g.fillRect(x + 64 + i * 9, y, 6, 10);
    if (f > 0) { g.fillStyle = on; g.fillRect(x + 64 + i * 9, y + 10 * (1 - f), 6, 10 * f); }
  }
}

const hhmm = (c) => { const m = Math.floor(c) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };

export function drawHud(g, V, Wpx, Hpx) {
  const W = V.W, L = W.lamb(), t = W.field.terms, foot = W.field.footing(L.x, L.z);
  g.font = FONT; g.textBaseline = "alphabetic";
  g.fillStyle = "rgba(10,6,8,0.55)"; g.fillRect(0, Hpx - 58, 420, 58);
  ticks(g, 14, Hpx - 48, L.hp, L.hpMax, "STANDING");
  ticks(g, 14, Hpx - 30, L.st, L.stMax, L.winded ? "BREATH !" : "BREATH");
  g.fillStyle = "#efe4d2";
  if (!W.inner) g.fillText(`${hhmm(t.clock)}  tide ${t.tide.toFixed(2)} m  wind ${t.windSpeed.toFixed(0)} m/s  fog ${t.fog.toFixed(2)}  ${foot.kind}${foot.band !== "dry" ? ", " + foot.band : ""}`, 14, Hpx - 8);
  const lock = L.lock != null && W.byId(L.lock);
  if (lock) { const [x, y] = V.proj(lock.x, lock.z, W.defs[lock.id].height + 0.4); g.fillStyle = "#efe4d2"; g.fillRect((x * Wpx) / 640 - 4, (y * Hpx) / 360 - 2, 8, 3); }
  if (V.barkT > 0) {
    V.barkT--; g.fillStyle = "rgba(10,6,8,0.6)"; g.fillRect(Wpx / 2 - 300, 18, 600, 26);
    g.fillStyle = "#efe4d2"; g.textAlign = "center"; g.fillText(`${captionOf(W, V.bark)}  ${V.bark.text}`, Wpx / 2, 36); g.textAlign = "left";
  }
  V.flashes = V.flashes.filter((f) => --f.life > 0);
  V.flashes.forEach((f, i) => { g.fillStyle = `rgba(239,228,210,${f.life / 40})`; g.fillText(`${f.type}${f.id && !W.inner ? " " + f.id : ""}`, Wpx - 190, 60 + i * 16); });
  // damage numbers, rising and fading
  V.numbers = (V.numbers || []).filter((n) => --n.life > 0);
  g.textAlign = "center";
  for (const n of V.numbers) { const [x, y] = V.proj(n.x, n.z, n.y + (50 - n.life) * 0.02); g.fillStyle = n.lamb ? `rgba(255,190,140,${n.life / 50})` : `rgba(239,228,210,${n.life / 50})`; g.fillText(n.text || n.n.toFixed(1), (x * Wpx) / 640, (y * Hpx) / 360); }
  g.textAlign = "left";
  // a boss's name, standing, and the phase it is in (pips)
  const B = W.fighters.find((F) => W.defs[F.id].boss && !F.out);
  if (B) {
    const w = 520, x0 = Wpx / 2 - w / 2, d = W.defs[B.id], ph = (B.mem && B.mem.phase) || 0;
    g.fillStyle = "rgba(10,6,8,0.6)"; g.fillRect(x0 - 10, 52, w + 20, 34);
    g.fillStyle = "#efe4d2"; g.fillText(d.name.toUpperCase(), x0, 66);
    g.fillStyle = "rgba(239,228,210,0.25)"; g.fillRect(x0, 72, w, 6); g.fillStyle = "#efe4d2"; g.fillRect(x0, 72, (w * Math.max(0, B.hp)) / B.hpMax, 6);
    if (!W.inner) for (let i = 0; i <= ph; i++) g.fillRect(x0 + w - 12 - i * 14, 58, 8, 8); // the inner arena shows its phase by its form, not by pips
    if (B.mem && W.tick < B.mem.rest && d.form !== "accuser") { g.fillText("winded", x0 + w / 2 - 24, 66); }
  }
  if (V.runLine && !W.inner) { g.fillStyle = "#efe4d2"; g.fillText(V.runLine, 14, 22); }
  if (W.result && !W.inner) { // an inner outcome is announced by sound and picture, never a banner (08-ARENA rule 7)
    g.fillStyle = "rgba(10,6,8,0.7)"; g.fillRect(Wpx / 2 - 160, Hpx / 2 - 30, 320, 60);
    g.fillStyle = "#efe4d2"; g.textAlign = "center"; g.font = "20px ui-monospace, Consolas, monospace";
    g.fillText(W.result.outcome.toUpperCase(), Wpx / 2, Hpx / 2 + 7); g.textAlign = "left"; g.font = FONT;
  }
}
