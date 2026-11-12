// The talk panel's portrait slot (design/UI-SYSTEM.md 7.5). Owned by the UI and UX lead. Painted
// portraits are baked by the character lead per speaking part (characters/portraits/<who>/
// <expression>-<light>.png, 512 x 640, straight alpha, eyes at 38 percent, three-quarters facing the
// viewer's right; index at characters/portraits/index.json). The slot sits at the top of the talk
// panel, left, on a ground washed in the light of the moment; the speaker's name in Conso small
// capitals beside it. Inner voices never take the slot: they are in Lamb's head, and the person in
// the room keeps looking at Lamb while a voice speaks. Lamb has no portrait in the slot. An
// expression changes on a line that names one (`face:`), with a 120 ms cross-fade; the light follows
// the place (sodium under sodium, paraffin indoors). A speaker with no portrait collapses the slot
// to the name line; nothing stands in for a face.
//   const P = portraitSlot()   P.el (mount at the top of the talk panel)   P.update({ who, face, light })
//   resolveWho(index, speaker)  lightOf(G)
import { h } from "./dom.mjs";

let INDEX = null, loading = null, lastTry = 0;
export function loadIndex(base = "/characters/portraits/index.json") {
  if (INDEX) return Promise.resolve(INDEX);
  if (!loading && performance.now() - lastTry < 10000) return Promise.resolve({}); // at most one try in ten seconds
  if (!loading) lastTry = performance.now();
  const get = (u) => fetch(u).then((r) => (r.ok ? r.json() : null));
  // the character lead's index; its working lane file while the full index is being baked
  // a failed or empty read is not kept: the next speaker tries again (the index may be mid-write)
  if (!loading) loading = get(base).then((j) => j || get(base.replace("index.json", "index.lane0.json")))
    .catch((e) => { console.warn(`portrait: no index yet (${e.message})`); return null; })
    .then((j) => { if (j && Object.keys(j).length) INDEX = j; else loading = null; return j || {}; });
  return loading;
}

// The portrait id for a speaker as the script names them ("Deacon Fennick" -> "fennick").
export function resolveWho(index, speaker) {
  if (!speaker || !index) return null;
  const s = String(speaker).trim().toLowerCase(), words = s.split(/\s+/);
  if (index[s]) return s;
  for (const [id, e] of Object.entries(index)) if (e && e.name && String(e.name).toLowerCase() === s) return id;
  for (const w of [words[words.length - 1], words[0]]) if (index[w]) return w;
  return null;
}

// The light a face is seen in: sodium where the place's sodium dominates, paraffin otherwise.
export function lightOf(G) {
  try { const sod = +G.env.term("sodium", G.state.place) || 0, light = +G.env.term("light", G.state.place) || 0; return sod >= 0.5 && light > 0.1 ? "sodium" : "paraffin"; }
  catch (e) { console.warn(`portrait: light unknown (${e.message})`); return "paraffin"; }
}

function pathFor(index, who, face, light) {
  const e = index[who]; if (!e) return null;
  const exp = e[face] || e.neutral || Object.values(e).find((v) => v && typeof v === "object");
  if (!exp) return null;
  return exp[light] || exp.paraffin || Object.values(exp)[0] || null;
}

export function portraitSlot() {
  loadIndex(); // fetch the index as the panel is built, so the first face is ready when someone speaks
  const a = h("img.pimg", { alt: "", draggable: "false" }), b = h("img.pimg", { alt: "", draggable: "false" });
  const frame = h("div.pframe", a, b), name = h("div.pname"), el = h("div.portrait", frame, name);
  let front = a, cur = null;
  el.hidden = true;
  async function update({ who = null, speaker = "", face = null, light = "paraffin" } = {}) {
    const index = await loadIndex();
    const id = who || resolveWho(index, speaker), src = id && id !== "lamb" ? pathFor(index, id, face || "neutral", light) : null;
    name.textContent = speaker || "";
    el.hidden = !speaker;
    el.classList.toggle("noface", !src);
    el.dataset.light = light;
    const url = src ? `/${src.replace(/^\/+/, "")}` : null;
    if (url === cur) return;
    cur = url;
    if (!url) return;
    const back = front === a ? b : a;
    back.onload = () => { back.classList.add("on"); front.classList.remove("on"); front = back; };
    back.onerror = () => console.warn(`portrait: missing ${url}`);
    back.src = url;
  }
  return { el, update };
}
