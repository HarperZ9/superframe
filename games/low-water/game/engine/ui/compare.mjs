// The notice beside the person (the UI art lead's, 2026-10-22; author direction: the player should be able to
// set a poster beside the real person and see the lie). An overlay with the claim's notice as its era printed
// it on the left (ui/propaganda/poster.mjs) and the person's painted portrait on the right, each with its words:
// the notice's slogan, and the person's name and trade from the cast. Esc or B closes it. No verdict is written:
// the two pictures are the argument.
//   openCompare(ctx, { claim, who, torn, pasted, era, myth }) -> { close }   (claim: an @claim id; who: a portrait id;
//   era and myth from the notice or the claim when it names them: the compare verb, world/discourse.mjs)
import { h, btn } from "./dom.mjs";
import { renderNotice } from "./propaganda/poster.mjs";
import { loadIndex, resolveWho } from "./portrait.mjs";

const MYTH_OF = { hesh: "hoard", vell: "tide", tarn: "dole" };   // the picture a people's notice draws, until a claim names its own

export function openCompare(ctx, { claim, who = null, torn = false, pasted = null, era: eraOf = null, myth: mythOf = null } = {}) {
  const G = ctx.G, C = G && G.discourse && G.discourse.claims[claim];
  if (!C) { console.warn(`compare: no claim ${claim}`); return null; }
  // the notice's own era when it names one (verb compare, world/discourse.mjs)
  const era = +eraOf || +document.body.dataset.uiEra || 2, poster = h("canvas.cmp-notice"), face = h("img.cmp-face", { alt: "" });
  const card = h("div.cmp-person", face, h("div.cmp-name"), h("div.cmp-trade.small.quiet"));
  const root = h("div.screen.compare", h("div.cmp.sheet.fade-in", h("div.cmp-col", h("div.caps.quiet", "The notice"), poster, h("p.cmp-words.small", C.words)), h("div.cmp-col", h("div.caps.quiet", "Beside it"), card),
    h("div.cmp-foot.small.quiet", btn("Put it away", () => close(), { cls: "btn" }))));
  ctx.stage.append(root);
  renderNotice(poster, { era, words: C.words, carrier: (C.carriers || [])[0] === "notices" ? "The district office" : "", people: C.target || "hesh", myth: mythOf || C.myth || MYTH_OF[C.target] || "hoard", seed: 11, torn, pasted }).catch((e) => console.error(`compare: notice: ${e.message}`));
  (async () => {
    const index = await loadIndex(), id = resolveWho(index, who || C.victim || "") || who, e = index && id && index[id];
    const path = e && (e.neutral || Object.values(e).find((v) => v && typeof v === "object")); const src = path && (path.paraffin || Object.values(path)[0]);
    if (src) face.src = `/${String(src).replace(/^\/+/, "")}`; else face.hidden = true;
    card.querySelector(".cmp-name").textContent = (G.rs && G.rs.chars && G.rs.chars[who] && G.rs.chars[who].name) || (who ? who[0].toUpperCase() + who.slice(1) : "");
  })().catch((e) => console.warn(`compare: portrait: ${e.message}`));
  const close = () => { ctx.F.pop(layer); root.remove(); };
  const layer = ctx.F.push({ name: "compare", root, onAction: (a) => a.startsWith("opt:"), onBack: close });
  ctx.F.focus(root.querySelector(".f"));
  return { close, root };
}
