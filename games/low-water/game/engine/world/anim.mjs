// The animation interface: clip timings are data, so the same numbers drive the character
// renderer, combat's windows and footsteps.
//   @anim id
//   actor: lamb                 the actor (character rig) the clip belongs to
//   length: 0.8                 seconds; or frames: 24 with fps: 30
//   loop: yes                   loops; otherwise holds the last frame, then plays next:
//   next: lamb.idle
//   rate: 1 + 0.1 * (skill.knees - 3)   playback speed, an expression read when the clip starts
//   event: 0.2 step             named moments (seconds from the start; repeatable)
//   phase: 0.10 0.25 active     named spans (start end name; repeatable): windup, active,
//                               recovery, cancel, iframes, ... whatever combat reads
//   blend: 0.12                 cross-fade seconds into this clip
//   clip: run_cycle             the art pipeline's clip name in the rig (default: the id)
// Runtime:
//   const a = G.anims.actor("lamb")       one animator per actor id
//   a.play("lamb.attack1")                starts a clip (returns false if no such clip)
//   a.state() -> { clip, art, t, u, frame, phase: [names], blend: { from, w } }
//   G.loop runs every animator at order 30; each event fires G.emit("anim.event",
//   { actor, clip, name, t }) and each phase edge "anim.phase" { actor, clip, name, on }.
import { compile, evaluate } from "../core/expr.mjs";

export function loadAnims(book) {
  const out = {}, errors = [];
  for (const r of Object.values((book.records || {}).anim || {})) {
    try {
      const one = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
      const fps = +(one("fps") || 30), length = one("length") != null ? +one("length") : one("frames") != null ? +one("frames") / fps : NaN;
      if (!(length > 0)) throw new SyntaxError("needs length: seconds or frames: n");
      const events = r.kv.filter((e) => e.key === "event").map((e) => { const [t, ...n] = e.value.trim().split(/\s+/); return { t: +t, name: n.join(" ") }; }).sort((a, b) => a.t - b.t);
      const phases = r.kv.filter((e) => e.key === "phase").map((e) => { const [a, b, ...n] = e.value.trim().split(/\s+/); return { from: +a, to: +b, name: n.join(" ") }; });
      for (const x of [...events.map((e) => e.t), ...phases.flatMap((p) => [p.from, p.to])]) if (isNaN(x) || x < 0 || x > length + 1e-9) throw new SyntaxError(`time ${x} is outside 0..${length}`);
      out[r.id] = { id: r.id, actor: one("actor") || r.id.split(".")[0], length, fps, loop: /^(yes|true)$/i.test(one("loop") || ""), next: one("next") || null,
        rate: compile(one("rate") || "1"), events, phases, blend: +(one("blend") || 0), art: one("clip") || r.id, file: r.file, line: r.line };
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `anim ${r.id}: ${e.message}` }); }
  }
  return { anims: out, errors };
}

export function createAnims(G, clips) {
  const actors = new Map();
  function animator(id) {
    let cur = null, t = 0, rate = 1, from = null, fromT = 0, blendT = 0, blendLen = 0, on = new Set();
    const a = {
      id,
      play(clipId, { restart = false } = {}) {
        const c = clips[clipId]; if (!c) return false;
        if (cur && cur.id === clipId && !restart) return true;
        from = cur; fromT = t; blendLen = c.blend; blendT = 0;
        for (const n of on) G.emit("anim.phase", { actor: id, clip: cur.id, name: n, on: false });
        cur = c; t = 0; on = new Set(); rate = Math.max(0, +evaluate(c.rate, G.scope) || 0);
        G.emit("anim.start", { actor: id, clip: c.id });
        return true;
      },
      update(dt) {
        if (!cur) return;
        const t0 = t, len = cur.length; t += dt * rate; blendT += dt;
        const fire = (a0, a1) => { for (const e of cur.events) if (e.t > a0 && e.t <= a1) G.emit("anim.event", { actor: id, clip: cur.id, name: e.name, t: e.t }); };
        if (t >= len) {
          if (cur.loop) { fire(t0, len); t -= len; fire(-1, t); }
          else { fire(t0, len); t = len; phases(); if (cur.next && clips[cur.next]) a.play(cur.next); else G.emit("anim.end", { actor: id, clip: cur.id }); return; }
        } else fire(t0, t);
        phases();
      },
      state: () => (cur ? { clip: cur.id, art: cur.art, t, u: t / cur.length, frame: Math.floor(t * cur.fps), phase: [...on], blend: from && blendT < blendLen ? { from: from.art, fromT, w: blendT / blendLen } : null } : null),
      in: (name) => on.has(name),
      // Set the clip and its time directly (combat warps clips to its frames); no events fire.
      at(clipId, time) {
        const c = clips[clipId]; if (!c) return false;
        if (!cur || cur.id !== clipId) { cur = c; on = new Set(); from = null; rate = 1; }
        t = Math.max(0, Math.min(c.length, time)); phases(); return true;
      },
    };
    function phases() {
      for (const p of cur.phases) {
        const inside = t >= p.from && t < p.to;
        if (inside && !on.has(p.name)) { on.add(p.name); G.emit("anim.phase", { actor: id, clip: cur.id, name: p.name, on: true }); }
        else if (!inside && on.has(p.name)) { on.delete(p.name); G.emit("anim.phase", { actor: id, clip: cur.id, name: p.name, on: false }); }
      }
    }
    return a;
  }
  return {
    clips,
    actor(id) { if (!actors.has(id)) actors.set(id, animator(id)); return actors.get(id); },
    update(dt) { for (const a of actors.values()) a.update(dt); },
    of: (actor) => Object.values(clips).filter((c) => c.actor === actor),
  };
}
