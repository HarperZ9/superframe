// The boot in the page (design/CINEMATICS.md section 2): the studio card, the engine card, the photosensitivity
// notice, then the opening film, then the title. The rules (order, skips, what is remembered) are cine/boot.mjs;
// this shows them. The film's plates, light and sound load while the cards show.
//   await runBoot(ctx)   resolves when the title should open; ctx.q, ctx.prefs, ctx.stage
//   window.__lwBoot      { step, seen, film } for the harness (cine/tools/cinecapture.mjs)
import { bootPlan, canSkip, readSeen, markSeen, FADE_S, COLORS } from "../cine/boot.mjs";
import { OPENING } from "../cine/opening.mjs";
import { preloadFilm, playFilm } from "../cine/player.mjs";
import { filmSound } from "../cine/sound.mjs";

const storage = () => { try { return globalThis.localStorage || null; } catch { return null; } };
export const calmNow = (prefs) => !!(prefs && prefs.calm) || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

// One card or the notice: shown for its seconds, ended early by a key or a click when the rules allow.
function card(host, step, { calm, seen }) {
  return new Promise((done) => {
    const el = document.createElement("div"), fade = calm ? 0 : FADE_S;
    el.className = `bootcard bootcard-${step.id}`; el.setAttribute("role", step.kind === "notice" ? "alert" : "img"); el.setAttribute("aria-label", step.text);
    el.style.cssText = `position:fixed;inset:0;display:grid;place-items:center;background:${COLORS.ground};z-index:60;opacity:${calm ? 1 : 0};transition:opacity ${fade}s linear`;
    const t = document.createElement(step.kind === "notice" ? "p" : "div");
    t.textContent = step.text;
    t.style.cssText = step.kind === "notice"
      ? `max-width:34em;margin:0 8vw;color:${COLORS.ink};font:400 clamp(1rem, 1.6vw, 1.35rem)/1.6 'LW Hanken', sans-serif;text-align:left`
      : `color:${COLORS.ink};letter-spacing:${step.face === "mono" ? "0.08em" : "0.22em"};font:${step.face === "mono" ? "400 clamp(1rem, 1.8vw, 1.5rem) 'LW Conso', monospace" : "500 clamp(1.1rem, 2.2vw, 1.9rem) 'LW Hanken', sans-serif"}`;
    el.append(t); host.append(el);
    let over = false, timer = 0;
    const end = async () => {
      if (over) return; over = true; clearTimeout(timer); removeEventListener("keydown", onKey, true); el.removeEventListener("pointerdown", onKey);
      el.style.opacity = "0"; if (fade) await sleep(fade * 1000); el.remove(); done();
    };
    const onKey = (e) => { if (!canSkip(step, { seen, calm })) return; if (e.preventDefault) e.preventDefault(); end(); };
    addEventListener("keydown", onKey, true); el.addEventListener("pointerdown", onKey);
    requestAnimationFrame(() => { el.style.opacity = "1"; });
    timer = setTimeout(end, (step.secs + 2 * fade) * 1000);
    window.__lwBoot.step = step.id;
  });
}

export async function runBoot(ctx) {
  const plan = bootPlan(ctx.q); if (!plan) return false;
  const S = storage(), seen = readSeen(S), calm = calmNow(ctx.prefs) || ctx.q.get("calm") === "1", host = document.body;
  window.__lwBoot = { step: "", seen, film: null, ended: null };
  const manual = ctx.q.get("filmclock") === "manual", film = preloadFilm(OPENING), sound = manual || ctx.q.get("filmsound") === "0" ? null : filmSound(OPENING.cue);
  film.ready.catch((e) => console.error(`boot: the opening film could not load: ${e.message}`));
  for (const step of plan) {
    if (step.kind === "card" || step.kind === "notice") { await card(host, step, { calm, seen }); continue; }
    if (step.kind === "film") {
      window.__lwBoot.step = "opening";
      let plates = null; try { plates = await film.ready; } catch { continue; }   // logged above; on to the title
      await new Promise((done) => {
        const skippable = canSkip("opening", { seen, calm });
        window.__lwBoot.film = playFilm(host, OPENING, { ...film, plates, sound }, { calm, skippable, captions: !!(ctx.prefs && ctx.prefs.captions), clock: manual ? "manual" : "real",
          onEnd: (how) => { window.__lwBoot.ended = how; if (how === "ended") markSeen(S, "opening"); done(); } });
      });
    }
  }
  markSeen(S, "booted"); window.__lwBoot.step = "title";
  return true;
}
