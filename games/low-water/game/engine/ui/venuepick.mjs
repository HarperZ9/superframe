// The arena's pick between rounds in the venue's own material (the UI art lead's, 2026-10-22): at the bread
// fights the picks are chalked on the foreman's slate; at the boxing club they are printed on a betting slip.
// Only the dressing changes: the same three buttons, the same keys (1 to 3), the same words. Low Water's
// arena (no venue) keeps its plain card. No odds or numbers are invented for the look.
//   dressPick(card, venueId, { round })   venueIdOf(run, SKINS) -> "bread" | "club" | null
import { loadHand, drawLettering } from "./lettering/hand.mjs";

export const VENUE_CSS = `
.runui .card.venue-bread{background:radial-gradient(ellipse at 30% 20%,rgba(255,255,255,.06),transparent 60%),radial-gradient(ellipse at 75% 80%,rgba(255,255,255,.05),transparent 55%),#262b28;color:#ebe8de;border:10px solid #5a3f27;box-shadow:inset 0 0 40px rgba(0,0,0,.5),0 10px 30px rgba(0,0,0,.6);padding:20px 26px 22px}
.runui .card.venue-bread p,.runui .card.venue-bread button{text-shadow:0 0 1.2px rgba(235,232,222,.7)}
.runui .card.venue-bread button{background:transparent;color:#ebe8de;border:0;border-bottom:1px dashed rgba(235,232,222,.35);font:16px/1.5 "LW Hanken","Segoe UI",sans-serif}
.runui .card.venue-bread button:focus,.runui .card.venue-bread button:hover{outline:2px solid #e8c79a;outline-offset:2px}
.runui .card.venue-club{background:#f3ecd9;color:#1b1a1c;border:0;padding:26px 22px 20px;min-width:380px;max-width:460px;font:13px/1.5 "LW Conso",Consolas,monospace;
  -webkit-mask:radial-gradient(circle 5px at 50% 0,transparent 98%,#000) 0 0/14px 100% repeat-x,linear-gradient(#000,#000) 0 6px/100% 100% no-repeat;box-shadow:0 8px 24px rgba(0,0,0,.55)}
.runui .card.venue-club .slip-head{display:flex;justify-content:space-between;border-bottom:2px solid #8a1f24;color:#8a1f24;letter-spacing:.12em;padding-bottom:4px;margin-bottom:8px;text-transform:uppercase}
.runui .card.venue-club button{background:transparent;border:0;border-bottom:1px dotted #555;padding:8px 4px}
.runui .card.venue-club button::before{content:"";display:inline-block;width:12px;height:12px;border:1.5px solid #1b1a1c;margin-right:10px;vertical-align:-1px}
.runui .card.venue-club button:focus,.runui .card.venue-club button:hover{outline:2px solid #8a1f24}
.runui .card canvas.venue-title{display:block;margin:0 0 6px}`;

export const venueIdOf = (run, SKINS) => (run && run.skin ? Object.keys(SKINS).find((k) => SKINS[k] === run.skin) || null : null);

// heading lettered in chalk or printed; the rest of the card keeps its words and buttons
export function dressPick(card, venue, { round = 0 } = {}) {
  if (!venue || !card) return;
  card.classList.add(`venue-${venue}`);
  const h2 = card.querySelector("h2");
  if (venue === "club") {
    const head = document.createElement("div"); head.className = "slip-head";
    const a = document.createElement("span"); a.textContent = "The club"; const b = document.createElement("span"); b.textContent = `Round ${round}`;
    head.append(a, b); if (h2) h2.replaceWith(head); return;
  }
  // the bread fights: the round chalked in the game's own brush lettering, the words kept for screen readers
  if (!h2) return;
  const cv = document.createElement("canvas"); cv.className = "venue-title"; cv.setAttribute("aria-hidden", "true");
  h2.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)"; h2.after(cv);
  loadHand("brush").then((H) => drawLettering(cv, H, h2.textContent.toLowerCase().replace(/^\w/, (c) => c.toUpperCase()), { px: 30, ink: "#ece9df", seed: round + 3 }))
    .catch((e) => { console.warn(`venue pick: ${e.message}; the heading stays in type`); h2.style.cssText = ""; cv.remove(); });
}
