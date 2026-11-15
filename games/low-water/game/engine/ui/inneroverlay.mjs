// The inner fight over a scene (design/COMPLETION.md row S18): the story's hinge (combat/innerhook.mjs) ends a beat
// with beat.inner, and the shell opens the inner arena's page over the stage in a frame (combat/arena/innerpage.mjs,
// ?mode=inner&story=1). The frame takes the keys while it is open; at the morning it posts its records back and
// closes, and the scene that follows plays. Nothing of the fight is shown after it: no card, no count (08-ARENA rule
// 8). Until the arena draws on raw-native this is the browser build's way in; tools/quota-shell.mjs drives it with
// window.__lwInnerBot (force, endure, name, ...) for its unattended runs.
//   openInner(ctx, inner, done)   done(records)
export function openInner(ctx, inner, done) {
  const q = new URLSearchParams({ mode: "inner", story: "1", flaw: inner.id, seed: String((ctx.G && ctx.G.state.seed) || 1) });
  if ((inner.heard || []).length) q.set("heard", inner.heard.join(","));
  if (inner.id === "host") q.set("kept", (inner.kept || []).join(","));
  if (inner.levels && Object.keys(inner.levels).length) q.set("levels", Object.entries(inner.levels).map(([k, v]) => `${k}:${v}`).join(",")); // the sheet, so the trait is his size (design/TRAITS.md)
  if (inner.id === "descent") q.set("resolved", Object.entries(inner.resolved || {}).map(([k, v]) => `${k}:${v}`).join(","));
  // never capture=1 here: on the arena page it holds the clock for a tool to step frames; over a scene it runs live
  const bot = typeof window !== "undefined" && window.__lwInnerBot; if (bot) q.set("bot", typeof bot === "function" ? bot(inner) : String(bot));
  const frame = document.createElement("iframe");
  frame.src = `/engine/combat/arena/index.html?${q}`; frame.className = "innerframe"; frame.title = "";
  Object.assign(frame.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", border: "0", zIndex: "50", background: "#0b0709" });
  const onMsg = (e) => {
    if (e.source !== frame.contentWindow || !e.data || e.data.type !== "lw.inner.done") return;
    window.removeEventListener("message", onMsg); frame.remove();
    try { done(e.data.records || []); } catch (err) { console.error(`inner overlay: the scene after ${inner.id} failed: ${err.message}`); throw err; }
  };
  window.addEventListener("message", onMsg);
  document.body.append(frame);
  frame.addEventListener("load", () => { try { frame.contentWindow.focus(); } catch (err) { console.warn(`inner overlay: focus: ${err.message}`); } });
  return frame;
}
