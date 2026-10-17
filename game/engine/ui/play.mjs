// The play screen: the scene on the left (plate or place card, the clock, what is here and where
// to go) and the dialogue panel on the right. After each world action (a hotspot, an exit,
// waiting) the shell asks G.nextScene() for anything that should play now and plays it. A beat
// with run set opens the Tide Run view; when the run is over, talk.afterRun() goes on.
// On a painted plate Lamb and the people stand in the scene (ui/peoplelayer.mjs): a click on the
// plate walks Lamb there (onto a hotspot or exit, it opens it on arrival), a hotspot or exit
// chosen from the list is walked to first, and a fight started from a conversation plays on the
// same plate and ground (the plate's arena with the art lead's fight marks, combat/sim/plate.mjs),
// after which Lamb stands where the fight left her and walks on.
import { h, btn, clear } from "./dom.mjs";
import { hudEl, meterMarks } from "./scene.mjs";
import { plateCam } from "./platecam.mjs";
import { lineEl, renderOptions } from "./talk.mjs";
import { openRun } from "./run.mjs";
import { fightLayer } from "./fightlayer.mjs";
import { openSneak } from "./sneak.mjs";
import { sneakLayer } from "./sneaklayer.mjs";
import { runLayer } from "./runlayer.mjs";
import { inkedPages } from "./inked.mjs";
import { waitRow } from "./waiting.mjs";
import { portraitSlot, lightOf } from "./portrait.mjs";
import { glyph, onDevice, watchDevice } from "./bindings.mjs";
import { peopleLayer } from "./peoplelayer.mjs";
import { weatherLayer } from "./weatherlayer.mjs";
import { plateArena } from "../combat/sim/plate.mjs";
import { PLATE_OF } from "../combat/data/plates.mjs";
import { fightFromScene } from "../world/plateworld.mjs";

const WAIT = 10; // minutes one "wait" lets pass

export function playScreen(ctx, { startNode = null } = {}) {
  const G = ctx.G;
  watchDevice();
  const P = { talk: null, beat: null, log: [], sel: {}, termsAll: false, ended: null };
  const els = {
    plate: h("div.platebox"), hud: h("div.hudbox"), edge: h("div.edge"), here: h("div.here.sheet"),
    title: h("div.ttitle.caps"), log: h("div.log"), opts: h("div.opts"), foot: h("div.tfoot"),
  };
  // ux: two chips with the active device's glyph; Save, Load, Settings and the title live on the pause page
  const bar = h("div.topbar");
  const drawBar = () => bar.replaceChildren(btn(["Daybook", glyph("daybook")], () => ctx.daybook(), { cls: "chip" }), btn(["Pause", glyph("pause")], () => ctx.savesPanel("menu"), { cls: "chip" }));
  drawBar(); const offDev = onDevice(drawBar);
  els.portrait = portraitSlot(); // ux: the portrait slot (ui/portrait.mjs, UI-SYSTEM 7.5)
  const panel = h("aside.talk", els.title, els.portrait.el, els.log, els.opts, els.foot);
  const root = h("div.screen.play", h("div.scene", els.plate, els.hud, els.edge, bar, els.here), panel);
  ctx.stage.append(root);

  const api = playApi(ctx, P, els, root);
  api.cam = plateCam(els.plate, ctx);
  api.weather = weatherLayer(ctx, els.plate, api.cam);
  api.people = peopleLayer(ctx, els.plate, api.cam, { onPick: (p) => api.pick(p), idle: () => !P.talk && !P.ended && !root.classList.contains("fighting") && ctx.F.top() && ctx.F.top().root === root, onClock: () => api.worldStep() });
  api.inked = inkedPages(ctx); // ux: the inked Margin page and the chapter page (ui/inked.mjs)

  const onKey = (e) => { if (e.code === "F5" && ctx.F.top() && ctx.F.top().root === root) { e.preventDefault(); ctx.savesPanel("save"); } };
  window.addEventListener("keydown", onKey);
  ctx.F.push({ name: "play", root, onAction: (a) => onAction(ctx, P, api, a), onBack: () => ctx.savesPanel("menu"), onClose: () => { window.removeEventListener("keydown", onKey); api.cam.stop(); api.weather.stop(); api.people.stop(); api.inked.stop(); offDev(); } });
  if (startNode) api.startTalk(startNode); else api.worldStep();
  return api;
}

// What the play screen can do: talk, choose, run, close, and the world actions.
function playApi(ctx, P, els, root) {
  const G = ctx.G;
  const inWorld = () => (G.state.runMode || "full") !== "stepped" && api.cam && api.cam.ready(); // ux
  const api = {
    P, root, els,
    render() {
      const talking = !!P.talk || !!P.ended;
      root.classList.toggle("talking", talking);
      root.querySelector("aside.talk").inert = !talking || root.classList.contains("fighting"); els.here.inert = talking; // ux: paper slid away takes no focus
      if (api.cam) { api.cam.talking(talking); if (!talking) api.cam.focus(null); }
      if (api.people && !talking) api.people.talkingWith(null);
      renderWorld(ctx, P, els, api); renderTalk(ctx, P, els, api);
    },
    startTalk(node) { P.log = []; P.seen = 0; P.sel = {}; P.talk = G.talk(node); api.take(P.talk.beat); },
    // A new beat: add its lines, then open a run, show options, or offer to go on.
    take(beat) {
      P.beat = beat; P.log.push(...beat.lines);
      if (beat.end) P.ended = beat.end;
      api.render();
      if (beat.run) api.runThen(beat.run);
      else if (beat.fight) api.fightThen(beat.fight);
      else if (beat.sneak) api.sneakThen(beat.sneak);
      else focusTalk(ctx, els);
    },
    choose(i, strain = 0) {
      if (!P.talk || !P.beat.options || !P.beat.options[i]) return;
      const o = P.beat.options[i]; if (o.locked) return;
      api.take(P.talk.choose(i, { strain }));
    },
    // A fight plays in the world: over the plate view, under the game camera, with no new screen.
    fightThen(id) {
      root.classList.add("fighting");
      const taken = usePlateFor(G, api.cam, id), P2 = api.people;
      if (P2) P2.hide(["lamb", ...taken]); // the fight draws them now
      const F = fightLayer(ctx, els.plate.parentElement, id, () => {
        root.classList.remove("fighting");
        // back to walking from where the fight left Lamb, on the same ground
        const L = F.W.lamb && F.W.lamb(); if (L && F.stage && F.stage.plate) G.state.pos = F.stage.toWorld([L.x, L.z]);
        if (P2) P2.hide([]);
        api.take(P.talk.afterFight());
      }, { cam: api.cam });
    },
    runThen(id) {
      if (G.state.runsOff) { console.warn(`run ${id} requested with runs off; content should branch on !runs`); }
      // ux: real-time runs play on the plate like fights; stepped mode and plate-less places keep the chart
      if (inWorld()) { root.classList.add("fighting"); return runLayer(ctx, els.plate.parentElement, id, () => { root.classList.remove("fighting"); api.take(P.talk.afterRun()); }, { cam: api.cam }); }
      openRun(ctx, id, () => api.take(P.talk.afterRun()));
    },
    sneakThen(id) {
      if (inWorld()) { root.classList.add("fighting"); return sneakLayer(ctx, els.plate.parentElement, id, () => { root.classList.remove("fighting"); api.take(P.talk.afterSneak()); }, { cam: api.cam }); }
      openSneak(ctx, id, () => api.take(P.talk.afterSneak()));
    },
    // The conversation is over: the end of the story, or back to the world.
    close() {
      const ended = P.ended; P.talk = null; P.beat = null;
      if (ended) return api.render();
      api.worldStep();
    },
    worldStep() {
      const s = G.nextScene();
      if (s) return api.startTalk(s.node);
      api.render();
      ctx.F.focus(els.here.querySelector(".f"), { scroll: false });
    },
    // A hotspot: Lamb walks to it on the plate, then it opens (at once where there is no ground).
    hotspot(hs) {
      const open = () => { if (api.cam) api.cam.focus(hs.at); if (api.people) api.people.talkingWith(hs.attrs && hs.attrs.who ? String(hs.attrs.who) : null); api.startTalk(hs.target); };
      if (!(api.people && api.cam.arena() && api.people.walkTo(hs.at, open))) open();
    },
    // A click on the plate: a hotspot or exit there opens on arrival; elsewhere Lamb walks.
    pick(p) {
      if (P.talk || P.ended || root.classList.contains("fighting")) return;
      const near = (x) => x.at && Math.hypot(p[0] - x.at[0], p[2] - x.at[2]) <= ((x.attrs && +x.attrs.r) || 1) * 1.2;
      const hs = G.world.hotspots().find(near); if (hs) return api.hotspot(hs);
      const x = G.world.exits().find(near); if (x) return api.exit(x);
      api.people.walkTo(p, () => api.render());
    },
    // An interaction verb from the world: its lines, then its node if it names one.
    verb(item) {
      const r = G.verbs.act(item.object.id, item.verb.kind, { label: item.verb.label });
      if (r.why) { P.log.push({ kind: "nar", who: "", text: r.why }); return api.render(); }
      P.log.push(...r.lines);
      if (r.node) { P.talk = G.talk(r.node); P.sel = {}; return api.take({ ...P.talk.beat, lines: P.talk.beat.lines }); }
      api.worldStep();
    },
    exit(x) {
      if (x.at && api.people && api.cam.arena() && !x.walked) { const go = () => api.exit({ ...x, walked: true }); if (api.people.walkTo(x.at, go)) return; }
      if (x.attrs && x.attrs.cost) G.advance(+x.attrs.cost);
      const node = G.world.enter(x.target, { spawn: x.spawnAt || null });
      if (node) return api.startTalk(node);
      api.worldStep();
    },
    wait() { G.advance(WAIT); api.worldStep(); },
  };
  return api;
}

function onAction(ctx, P, api, a) {
  if (a === "daybook") { ctx.daybook(); return true; }
  if (a === "terms:on" || a === "terms:off") { P.termsAll = a === "terms:on"; renderTalk(ctx, P, api.els, api, { keepFocus: true }); return true; }
  if (a.startsWith("opt:") && P.beat && P.beat.options) {
    const i = +a.slice(4) - 1, o = P.beat.options[i];
    if (o) api.choose(i, (o.check && P.sel[o.key]) || 0);
    return !!o;
  }
  return false;
}

function focusTalk(ctx, els) {
  const f = els.opts.querySelector(".f[data-first]") || els.foot.querySelector(".f");
  if (f) ctx.F.focus(f, { scroll: false });
  els.log.scrollTop = els.log.scrollHeight;
}

function renderWorld(ctx, P, els, api) {
  const G = ctx.G;
  els.hud.replaceChildren(hudEl(G));
  els.edge.replaceChildren(...meterMarks(G));
  const busy = !!P.talk || !!P.ended;
  const list = h("div.acts");
  for (const hs of G.world.hotspots()) list.append(btn([h("span.caps.kind", "Here"), hs.label.replace(/^"|"$/g, "")], () => api.hotspot(hs), { cls: "act", disabled: busy }));
  for (const v of G.verbs.list()) list.append(btn([h("span.caps.kind", v.verb.kind), v.label, v.why ? h("span.why.quiet.small", v.why) : null], () => api.verb(v), { cls: "act", disabled: busy || !!v.why }));
  // ux: every move that spends the night says how much (UX-AUDIT T6)
  for (const x of G.world.exits()) list.append(btn([h("span.caps.kind", "Go"), x.label.replace(/^"|"$/g, ""), x.attrs && +x.attrs.cost ? h("span.cost", `${+x.attrs.cost} min`) : null], () => api.exit(x), { cls: "act", disabled: busy }));
  list.append(btn([h("span.caps.kind", "Wait"), "Let the night move on", h("span.cost", `${WAIT} min`)], () => api.wait(), { cls: "act", disabled: busy }));
  list.append(waitRow(ctx, api, { busy })); // ux: wait for the tide to turn, stopped by anything the night has to say (ui/waiting.mjs)
  if (!busy && list.firstChild) list.firstChild.dataset.first = "";
  els.here.replaceChildren(h("div.caps.quiet", busy ? "In conversation" : "What is here"), list);
}

function renderTalk(ctx, P, els, api, { keepFocus = false } = {}) {
  const G = ctx.G, b = P.beat;
  const focused = keepFocus && document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.opt : null;
  const area = G.world.area();
  els.title.textContent = P.talk ? `${area ? area.name : ""}${P.talk.speaker ? `  /  ${P.talk.speaker}` : ""}` : area ? area.name : "";
  { const face = [...P.log].reverse().find((l) => l.face); els.portrait.update({ speaker: P.talk ? P.talk.speaker : "", face: face ? face.face : null, light: lightOf(G) }); } // ux
  if (!P.talk && !P.ended) return renderIdle(G, P, els);
  const seen = P.seen || 0; // ux: lines new since the last draw write themselves in
  els.log.replaceChildren(...P.log.map((l, i) => { const e = lineEl(l); if (i >= seen) e.classList.add("fresh"); return e; }));
  P.seen = P.log.length;
  clear(els.foot);
  if (b && b.options) renderOptions(els.opts, G, b, { sel: P.sel, termsAll: P.termsAll, onChoose: (i, s) => api.choose(i, s), rerender: () => renderTalk(ctx, P, els, api, { keepFocus: true }) });
  else els.opts.replaceChildren();
  if (P.ended) els.foot.append(h("p.endnote", h("span.caps", "The end"), ` ${P.ended}`), btn("Back to the title", () => ctx.title(), { cls: "btn go" }));
  else if (b && b.done) els.foot.append(btn(["Go on", h("span.k", "Enter")], () => api.close(), { cls: "btn go" }));
  if (focused != null) { const f = els.opts.querySelector(`[data-opt="${focused}"]`); if (f) f.focus({ preventScroll: true }); }
  els.log.scrollTop = els.log.scrollHeight;
}

function renderIdle(G, P, els) {
  els.log.replaceChildren(...P.log.slice(-6).map((l) => { const e = lineEl(l); e.classList.add("past"); return e; }), h("p.ln.idle", "Nobody is speaking. Choose someone or somewhere on the left, or wait."));
  els.opts.replaceChildren();
  els.foot.replaceChildren();
}

// Fights on a painted plate run on the plate's ground: the plate's arena handed to combat, laid
// where the scene stands (world/plateworld.mjs fightFromScene). Returns the figure ids it takes over.
function usePlateFor(G, cam, id) {
  const C = G.ext.combat, enc = C && C.defs[id], pj = cam && cam.place && cam.place(), geo = cam && cam.geo && cam.geo();
  if (!enc || !pj || !geo || PLATE_OF[enc.area] !== pj.place) return [];
  const S = fightFromScene(G, pj, id);
  try { C.usePlate(enc.area, plateArena(pj, geo.pos, geo.ids, { datum: pj.datum || null, fight: S.fight })); }
  catch (e) { console.warn(`fight ${id}: no plate arena on ${pj.place}: ${e.message}`); return []; }
  return S.taken;
}
