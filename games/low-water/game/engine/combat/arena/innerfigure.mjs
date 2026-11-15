// The character in the inner arena, until the character lead's production figure is in the arena page: a silhouette
// built to read small against big forms, as Martin's figures read against his palaces. Legs that part as he walks,
// a coat with a hem that flares, a hat with a pale brim, a pale collar, and the tool (combat/arena/figure.mjs). His
// light side and his far side are found by the figure pass (combat/arena/innertone.mjs), so he never sinks into a
// dark ground. A roll or a fall uses the arena's own placeholder (drawFigure).
//   drawLambInner(g, V, F, pose, light, { height, value, trims })   `height` and `value` let the Minotaur's gap wear
//   the player's own shape (inferno/03-BESTIARY-B.md: "it is the player's own shape")
import { drawFigure, toolPose, tool } from "./figure.mjs";
import { gray, poly, oval, limb } from "./forms.mjs";

const S = 30;
export function drawLambInner(g, V, F, pose, light, opt = {}) {
  const kind = pose.kind || "free";
  if (!opt.height && (kind === "dodge" || kind === "down" || kind === "fall" || F.fallen || F.out)) return drawFigure(g, V, F, pose, light);
  const W = V.W, def = W.defs[F.id], [bx, by] = V.proj(F.x, F.z), H = (opt.height || def.height) * S * 0.9, w = 0.38 * S * 1.2;
  // the stride eases in and out with the speed, so a body that shuffles does not snap its legs frame to frame (a
  // snapping stride under a bright edge read as a flash in a dark window, 05-CARE section 2)
  const fx = Math.cos(F.face), s = fx >= 0 ? 1 : -1, sp = Math.min(1, Math.hypot(F.vx || 0, F.vz || 0) / 1.5), st = (V.stride ||= {});
  const amp = (st[F.id] = (st[F.id] || 0) + (sp - (st[F.id] || 0)) * 0.08), ph = opt.height ? 0 : amp * Math.sin(V.t * 0.32);
  const flat = V.off && V.off.has("lambflat"); // the control for the player's edge measure: drawn at the ground's value, no trims
  const lean = (kind === "stagger" ? -0.2 : 0.06) * s, ink = flat ? 0.13 : opt.value ?? 0.11 * (0.7 + 0.6 * Math.max(light, 0.35)), trim = opt.trims === false || flat ? null : 0.9;
  const hip = by - H * 0.42, sh = by - H * 0.78, top = [bx + lean * H, by - H];
  limb(g, [[bx - w * 0.28 + ph * 4, by], [bx - w * 0.22, hip]], 5, 5, ink * 0.8);
  limb(g, [[bx + w * 0.28 - ph * 4, by], [bx + w * 0.22, hip]], 5, 5, ink * 0.8);
  poly(g, [[bx - w * 0.8 - ph, by - H * 0.2], [bx + w * 0.8 - ph, by - H * 0.2], [top[0] + w * 0.62, sh], [top[0] - w * 0.62, sh]], ink);
  poly(g, [[top[0] - w * 0.75, sh + 1], [top[0] + w * 0.75, sh + 1], [top[0] + w * 0.6, sh - 3], [top[0] - w * 0.6, sh - 3]], ink);
  for (const k of [-1, 1]) limb(g, [[top[0] + k * w * 0.66, sh], [bx + k * w * 0.8, by - H * 0.36]], 4, 4, ink * 0.9);
  oval(g, top[0], top[1] + H * 0.12, w * 0.34, H * 0.08, ink);
  poly(g, [[top[0] - w * 0.36, top[1] + H * 0.07], [top[0] + w * 0.36, top[1] + H * 0.07], [top[0] + w * 0.3, top[1] - 1], [top[0] - w * 0.3, top[1] - 1]], ink * 0.8);
  if (trim) {
    g.fillStyle = gray(trim * (0.55 + 0.45 * Math.max(light, 0.35))); g.fillRect(top[0] - w * 0.68, top[1] + H * 0.07, w * 1.36, 2);
    g.strokeStyle = g.fillStyle; g.lineWidth = 2; g.beginPath(); g.moveTo(top[0] - w * 0.38, sh - 2); g.lineTo(top[0], sh + H * 0.08); g.lineTo(top[0] + w * 0.38, sh - 2); g.stroke();
  }
  if (F.tool && !opt.height) tool(g, V, F, def, toolPose(W, F, pose), top, H, fx, Math.sin(F.face), Math.max(light, 0.35));
}
