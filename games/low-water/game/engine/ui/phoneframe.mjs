// The phone's frame (era 5, The Quota; design/eras/era5.md section 10, design/sensory/01-LOOKS.md L14): the clip of
// Danil Saro is shown on a phone at every table, so while camera: phone holds (world/camera.mjs) the scene is seen
// through a handset held sideways: a black bezel with rounded corners, the lens dot, the player's scrub bar with the
// clip's own clock, and the picture inside drawn cooler and coarser, a phone's video under the painted frame. Plates
// agent, 2026-10-23. No red anywhere in it (the F5 rule: no saturated red); it loops, so the bar's time loops too.
import { h } from "./dom.mjs";

const CSS = `
.phoneframe{position:absolute;inset:0;pointer-events:none;z-index:6;display:none}
.phoneframe.on{display:block}
.phoneframe .bezel{position:absolute;left:6%;right:6%;top:7%;bottom:15%;border-radius:38px;box-shadow:0 0 0 2000px rgba(9,6,3,0.92),inset 0 0 0 14px #0b0b0d,inset 0 0 0 16px #2a2a2e}
.phoneframe .lens{position:absolute;left:calc(6% + 22px);top:50%;width:10px;height:10px;margin-top:-5px;border-radius:50%;background:#1c1d22;box-shadow:inset 0 0 0 2px #34353b}
.phoneframe .bar{position:absolute;left:calc(6% + 48px);right:calc(6% + 48px);bottom:calc(15% + 26px);display:flex;align-items:center;gap:12px;font:600 13px/1 var(--mono, ui-monospace, monospace);color:#e8ecf2;opacity:.86}
.phoneframe .track{flex:1;height:3px;background:rgba(232,236,242,.28);border-radius:2px;position:relative}
.phoneframe .fill{position:absolute;left:0;top:0;bottom:0;background:#e8ecf2;border-radius:2px}
.phoneframe .knob{position:absolute;top:-5px;width:13px;height:13px;margin-left:-6px;border-radius:50%;background:#e8ecf2}
.phoneframe .scan{position:absolute;left:6%;right:6%;top:7%;bottom:15%;border-radius:38px;background:repeating-linear-gradient(0deg,rgba(96,156,255,.05) 0 2px,transparent 2px 4px);mix-blend-mode:screen}
.scene.phone-on .platebox{filter:saturate(.55) contrast(1.12) brightness(.92) hue-rotate(-8deg)}
@media (prefers-reduced-motion: reduce){.phoneframe .fill,.phoneframe .knob{transition:none}}
`;
const LEN = 249; // the clip runs four minutes and nine seconds (content/quota/e5_town.lwd, e5.clip.stop)
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// phoneFrame(ctx, scene): mounts the frame over the scene and follows the game's camera events; returns { el, sync }
export function phoneFrame(ctx, scene) {
  if (!scene || !ctx || !ctx.G) return null;
  if (!document.getElementById("phoneframe-css")) document.head.append(Object.assign(document.createElement("style"), { id: "phoneframe-css", textContent: CSS }));
  const fill = h("div.fill"), knob = h("div.knob"), t = h("span.t", "0:00");
  const el = h("div.phoneframe", h("div.scan"), h("div.bezel"), h("div.lens"), h("div.bar", t, h("div.track", fill, knob), h("span", mmss(LEN))));
  el.setAttribute("aria-hidden", "true"); scene.append(el);
  let start = 0, raf = 0;
  const tick = () => {
    const s = ((performance.now() - start) / 1000) % LEN, p = (100 * s) / LEN;
    t.textContent = mmss(s); fill.style.width = `${p}%`; knob.style.left = `${p}%`;
    raf = requestAnimationFrame(tick);
  };
  const sync = () => {
    const on = !!(ctx.G.state.camera && ctx.G.state.camera.frame === "phone");
    if (on === el.classList.contains("on")) return;
    el.classList.toggle("on", on); scene.classList.toggle("phone-on", on);
    if (on) { start = performance.now(); raf = requestAnimationFrame(tick); } else cancelAnimationFrame(raf);
  };
  ctx.G.on("camera", sync); ctx.G.on("talk.end", () => setTimeout(sync, 0)); sync();
  return { el, sync };
}
