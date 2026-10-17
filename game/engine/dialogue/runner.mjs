// A conversation in progress.
//   const talk = startTalk(G, "keel.start", { exits: new Set(["hub"]) });
//   talk.beat   { lines: [{ kind, who, text, skill, glyph, check }], options: [...] | null,
//                 end, exit, run, done }
//   talk.choose(i, { strain })    talk.afterRun()   (once the Tide Run in beat.run is over)
//   talk.afterFight()             (once the fight in beat.fight has ended, combat/encounter.mjs)
// Line kinds: nar, line, inst (LWD/0), voice (an inner voice interjecting), check (a dice
// check's result; fixed checks print nothing, the scene shows it), you (what Lamb said).
// Option kinds: opt, claim, check. A check option carries its preview (level, target, the parts,
// odds), its lock reason once failed, and what strain would cost (option.strain(n)).
// Flow keys: go, alt, call (push a return point), return (pop it), passive (a passive check
// that diverts into a node and comes back), end (the story's end), exit (back to the world).
// Special targets: ^hub returns to the most recent hub node (a node with hub: yes; when none was
// visited, the hub of the place Lamb is in), ^return
// pops the call stack. A node that runs out with no way on returns to the caller if there is
// one, and otherwise ends the conversation (the validator reports those as dead ends).
// Node boundaries: before entering a node the runner plays, as calls that come back, any meter
// that has filled (its full: node, R4) and any @event that is due (at and when both hold). Such
// an interruption that ends with exit: returns to what it interrupted instead of to the world. A
// run(id) effect ends the beat with beat.run; after the run, play goes to its win or lose node.
import { evaluate, runEffects } from "../core/expr.mjs";
import { setCamera } from "../world/camera.mjs";

const MAX_HOPS = 200;

export function startTalk(G, startId, { exits = new Set(), title = "" } = {}) {
  const talk = { beat: null, done: false, hub: null, stack: [], title, startId, node: null };

  // A line carries the speaker's char id (whoId, from @char speaker:) beside the display name, and
  // a face from its attributes ({face: wary}) for the portrait slot.
  function line(kind, who, text, extra = {}) {
    const l = { kind, who, text: text.includes("{{") ? G.fill(text) : text, ...extra };
    const id = charIdOf(G, who); if (id) l.whoId = id;
    G.memory.log({ node: talk.node, ...l });
    return l;
  }

  // Run a node from step i. Returns { next } to continue elsewhere, or a finished beat.
  function runNode(id, i, lines) {
    const n = G.book.nodes[id];
    if (!n) throw new Error(`dialogue: no node ${id}`);
    talk.node = id;
    if (i === 0) { G.memory.visit(id); if (n.hub) talk.hub = id; talk.speaker = n.speaker || ""; }
    const options = [];
    for (; i < n.steps.length; i++) {
      const s = n.steps[i], r = step(n, s, i, lines, options);
      if (r) return r;
      if (G.state.pendingRun) return { beat: { lines, options: null, run: G.runs.take() } };
      if (G.state.pendingFight) return { beat: { lines, options: null, fight: G.ext.combat.take() } };
      if (G.state.pendingSneak) return { beat: { lines, options: null, sneak: G.sneaks.take() } };
      if (G.state.pendingInterrog) { G.interrog.start(G.interrog.take()); return { beat: interrogBeat(lines) }; }
    }
    if (options.length) return { beat: { lines, options } };
    if (talk.stack.length) { const f = talk.stack.pop(); return { next: f.id, at: f.at }; }
    return { beat: { lines, options: null, deadEnd: id, done: true } };
  }

  function step(n, s, i, lines, options) {
    const S = G.scope;
    switch (s.kind) {
      case "when": if (!evaluate(s.cond, S)) { const e = n.steps.find((x) => x.kind === "else"); return { next: e ? e.value : "^return", at: 0 }; } return null;
      case "cost": G.advance(s.value); return null;
      case "place": G.setPlace(s.value); return null;
      case "speaker": talk.speaker = s.value; return null;
      case "camera": setCamera(G, s.value); return null; // wide | near | <scale> (design/CAMERA.md)
      case "set": case "clear": case "do": runEffects(s.effects, S); return null;
      case "if": if (evaluate(s.cond, S)) runEffects(s.effects, S); return null;
      case "cmd": G.command(s.args, n.id); return null;
      case "nar": if (shows(s)) lines.push(line("nar", "", s.value, s.attrs && s.attrs.face ? { face: String(s.attrs.face) } : {})); return null;
      case "line": case "inst": { if (!shows(s)) return null; const who = s.who || n.speaker; if (s.kind === "line" && s.who) talk.speaker = s.who; lines.push(line(s.kind, who, s.text, s.attrs && s.attrs.face ? { face: String(s.attrs.face) } : {})); return null; }
      case "read": { const out = G.read(s.value.split(/\s+/)); if (out) lines.push(line("inst", out.who, out.text)); return null; }
      case "voice": voice(s, lines); return null;
      case "passive": {
        if ((s.once && G.memory.heard(s.key)) || (s.cond && !evaluate(s.cond, S))) return null;
        if (s.dc != null && !G.checks.passive(s.key, s.skill, s.dc).pass) return null;
        G.memory.hear(s.key); talk.stack.push({ id: n.id, at: i + 1 }); return { next: s.target, at: 0 };
      }
      case "alt": return evaluate(s.cond, S) ? { next: s.target, at: 0 } : null;
      case "go": return { next: s.value, at: 0 };
      case "call": talk.stack.push({ id: n.id, at: i + 1 }); return { next: s.value, at: 0 };
      case "return": return { next: "^return", at: 0 };
      case "end": talk.done = true; G.emit("end", { id: s.value }); return { beat: { lines, options: null, end: s.value, done: true } };
      // exit goes back to the world, unless this scene interrupted something (a full meter, an
      // event): then play returns to what it interrupted, so waking from a nod resumes the dawn
      case "exit": { const k = talk.stack.map((f) => !!f.interrupt).lastIndexOf(true); if (k >= 0) { const f = talk.stack.splice(k)[0]; return { next: f.id, at: f.at }; } return { next: `^exit:${s.value}`, at: 0 }; }
      case "opt": case "claim": case "check": { const o = option(s); if (o) options.push(o); return null; }
      default: return null;
    }
  }

  // A conditioned nar, line or inst plays only while its {when} holds; {once} only the first time.
  function shows(s) {
    if (s.once && G.memory.heard(s.key)) return false;
    if (s.cond && !evaluate(s.cond, G.scope)) return false;
    if (s.once) G.memory.hear(s.key);
    return true;
  }

  // A voice line plays when its skill's level meets dc, and (R3) only while below `below`.
  function voice(s, lines) {
    if (s.once && G.memory.heard(s.key)) return;
    if (s.cond && !evaluate(s.cond, G.scope)) return;
    const sk = G.rs.skills[s.skill];
    let check = null;
    if (s.dc != null) { check = G.checks.passive(s.key, s.skill, s.dc); if (!check.pass) return; }
    if (s.below != null && G.sheet.skill(s.skill) >= s.below) return;
    G.memory.hear(s.key);
    lines.push(line("voice", sk ? sk.name : s.skill, s.text, { skill: s.skill, glyph: sk ? sk.glyph : "", check: check && { dc: check.dc, label: check.label, pass: true }, below: s.below }));
  }

  function option(s) {
    const S = G.scope, once = s.attrs.once || (s.kind === "check" && s.attrs.once !== false);
    if (s.kind !== "claim" && s.cond && !evaluate(s.cond, S)) return null;
    if (s.show && !evaluate(s.show, S)) return null;
    if (s.attrs.once && G.memory.said(s.key)) return null;
    const o = { label: s.label, kind: s.kind, key: s.key, s, voice: s.attrs.voice || null, said: G.memory.said(s.key), speaker: talk.speaker, node: talk.node };
    if (s.kind === "check") {
      const p = G.checks.preview(s.key, s.attrs.skill, +s.attrs.dc, s.attrs.retry || (s.attrs.red ? "never" : "raise"));
      if (p.passed && once) return null;
      if (p.attempts && p.locked && (s.attrs.retry === "never" || s.attrs.red)) return null;
      o.check = { ...p, skillName: G.rs.skills[s.attrs.skill] ? G.rs.skills[s.attrs.skill].name : s.attrs.skill, red: !!(s.attrs.red || s.attrs.retry === "never"), mode: G.checks.mode() };
      o.locked = p.locked;
      const speaker = talk.speaker, nostrain = !!s.attrs.nostrain;
      o.strain = (n) => G.checks.strain(s.attrs.skill, n, { speaker, nostrain });
      o.canStrain = !nostrain && G.checks.strain(s.attrs.skill, 1, { speaker }).why !== "This cannot be strained";
    }
    return o;
  }

  // Before entering a node: a filled meter's scene, then any due event, each as a call.
  function boundary(id) {
    const f = G.pressure.takeFull();
    if (f) { G.pressure.afterFull(f.id); talk.stack.push({ id, at: 0, interrupt: true }); G.emit("meter.scene", f); return f.node; }
    const e = G.dueEvent();
    if (e) { G.state.fired.push(e.id); talk.stack.push({ id, at: 0, interrupt: true }); G.emit("event", { id: e.id }); return `@event.${e.id}`; }
    return id;
  }

  function play(id, at = 0, lines = []) {
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      if (id === "^hub") { const hb = talk.hub || placeHub(G); if (!hb) throw new Error("dialogue: ^hub with no hub visited"); id = hb; at = 0; }
      if (id === "^interrog") return afterInterrog(lines);
      if (id === "^return") { const f = talk.stack.pop(); if (!f) return finish({ lines, options: null, exit: "^return", done: true }); id = f.id; at = f.at; }
      if (id === "^interrog") return afterInterrog(lines); // a press reply came back to the exchange
      if (id.startsWith("^exit:") || exits.has(id)) return finish({ lines, options: null, exit: id.replace(/^\^exit:/, ""), done: true });
      if (at === 0) id = boundary(id);
      const r = runNode(id, at, lines);
      if (r.beat) return finish(r.beat);
      id = r.next; at = r.at;
    }
    throw new Error(`dialogue: more than ${MAX_HOPS} hops without a choice, from ${startId}`);
  }
  function finish(beat) {
    beat.options = beat.options && beat.options.map((o, index) => ({ ...o, index }));
    talk.beat = beat; talk.done = !!beat.done;
    if (talk.done) { if (G.state.camera && G.state.camera.mode) setCamera(G, "near"); if (G.activeTalk === talk) G.activeTalk = null; G.emit("talk.end", { exit: beat.exit, end: beat.end, deadEnd: beat.deadEnd }); }
    return beat;
  }

  talk.choose = (i, { strain = 0 } = {}) => {
    const o = talk.beat.options && talk.beat.options[i];
    if (!o) throw new Error(`dialogue: no option ${i}`);
    if (o.locked) return talk.beat;
    if (talk.beat.interrogation) return pressChoose(o, strain);
    let st = null;
    if (strain && o.kind === "check") { st = o.strain(strain); if (!st.ok) return talk.beat; }
    const s = o.s, lines = [line("you", "LAMB", o.label.replace(/^"|"$/g, ""), { key: o.key })];
    G.memory.say(o.key, o.label);
    if (s.cost && !exits.has(s.target)) G.advance(s.cost);
    if (s.effects) runEffects(s.effects, G.scope);
    if (G.state.pendingRun) return finish({ lines, options: null, run: G.runs.take() });
    if (G.state.pendingFight) { const fs = liveLine("fightstart"); if (fs) lines.push(fs); return finish({ lines, options: null, fight: G.ext.combat.take() }); }
    if (G.state.pendingSneak) return finish({ lines, options: null, sneak: G.sneaks.take() });
    let target = s.target;
    if (s.kind === "claim") target = evaluate(s.cond, G.scope) ? s.target : s.fail;
    if (s.kind === "check") {
      if (st) G.checks.payStrain(st);
      const r = G.checks.resolve(s.key, s.attrs.skill, +s.attrs.dc, { strain: st ? st.n : 0 });
      const text = `${r.label}: ${r.pass ? "Success" : "Failure"}`;
      if (r.roll) lines.push(line("check", o.check.skillName, text, { skill: s.attrs.skill, check: { dc: r.dc, pass: r.pass, roll: r.roll, total: r.total, label: r.label } }));
      else G.memory.log({ node: talk.node, kind: "check", who: o.check.skillName, text: `${o.check.skillName} ${r.total} against ${r.dc}: ${r.pass ? "success" : "failure"}`, hidden: true });
      if (r.pass && s.attrs.xp) G.sheet.addXp(+s.attrs.xp);
      target = r.pass ? s.target : s.fail;
    } else if (s.attrs.xp) G.sheet.addXp(+s.attrs.xp);
    return play(target, 0, lines);
  };
  // After the Tide Run named in beat.run: play its win or lose node.
  talk.afterRun = () => { const n = G.runs.finish(); if (!n) throw new Error("dialogue: the run is not over"); return play(n); };
  // After the fight named in beat.fight ("fight.end" has fired): its outcome node.
  talk.afterFight = () => { const n = G.ext.combat.finish(); if (!n) throw new Error("dialogue: the fight is not over"); return play(n); };
  // After the sneak scene in beat.sneak: its node, or the fight it hands into (an alert that
  // names a fight, or a sneak attack: G.state.ambush tells the combat layer).
  talk.afterSneak = () => {
    const r = G.sneaks.finish(); if (!r) throw new Error("dialogue: the sneak is not over");
    if (r.node) return play(r.node);
    G.ext.combat.request(r.fight); return finish({ lines: [], options: null, fight: G.ext.combat.take() });
  };
  // Do an interaction verb inside a conversation: its lines, then its node if it names one.
  talk.verb = (obj, kind) => { const r = G.verbs.act(obj, kind); if (r.why) return { ...talk.beat, why: r.why }; return r.node ? play(r.node, 0, r.lines) : finish({ ...talk.beat, lines: r.lines }); };
  talk.jump = (id) => play(id);
  // A live conversation (author, 2026-10-17: the world never waits). The shell calls these while a
  // menu is open and the world runs on:
  //   talk.interrupt()  a due event or filled meter cuts in now; when it ends, play comes back to
  //                     this menu. The speaker's @char interrupted: line (if any) comes first.
  //   talk.walkAway()   Lamb walked off: the node's walk: node plays (a reaction that should end
  //                     the talk), else the speaker's @char walkaway: line closes it.
  const liveLine = (key) => { const c = G.rs.chars[charIdOf(G, talk.speaker) || ""]; const L = c && c.live && c.live[key]; return L && L.length ? line("line", talk.speaker, L[Math.floor(G.clock()) % L.length]) : null; };
  const atMenu = () => !!(talk.beat && talk.beat.options && talk.beat.options.length && !talk.done);
  talk.liveLine = liveLine;
  talk.interrupt = () => {
    if (!atMenu()) return null;
    const f = G.pressure.takeFull(), e = f ? null : G.dueEvent();
    if (!f && !e) return null;
    const n = G.book.nodes[talk.node], at = Math.max(0, n.steps.findIndex((s) => s.label != null)), lines = [];
    const cut = liveLine("interrupted"); if (cut) lines.push(cut);
    talk.stack.push(talk.beat.interrogation ? { id: "^interrog", at: 0, interrupt: true } : { id: talk.node, at, interrupt: true });
    if (f) { G.pressure.afterFull(f.id); G.emit("meter.scene", f); return play(f.node, 0, lines); }
    G.state.fired.push(e.id); G.emit("event", { id: e.id });
    return play(`@event.${e.id}`, 0, lines);
  };
  talk.walkAway = () => {
    if (talk.done) return null;
    if (G.interrog && G.interrog.current) { G.interrog.walkAway(); return afterInterrog([]); }
    const n = G.book.nodes[talk.node], w = n && n.steps.find((s) => s.kind === "walk");
    G.emit("talk.walkaway", { node: talk.node, speaker: talk.speaker });
    if (w) return play(w.value, 0, []);
    const said = liveLine("walkaway");
    return finish({ lines: said ? [said] : [], options: null, exit: "walk", done: true, walked: true });
  };
  // Interrogation (world/interrogation.mjs): the presses are this beat's options, built like any
  // option (a press with a skill is a visible check, with odds and strain), plus "That's a lie.".
  // A press plays its reply node, which returns here ("^interrog"); then the outcome, if any, plays:
  // break, bolt or walk nodes, or swing's fight. talk.interrogResolve() plays an outcome the clock
  // reached (silence ran out) with no press.
  function interrogBeat(lines) {
    const S = G.interrog.current, D = S.def;
    const options = G.interrog.presses().map((p) => { const o = option(p); if (o) { o.style = p.style; o.press = true; } return o; }).filter(Boolean);
    options.push({ label: "That's a lie.", kind: "opt", key: `${D.id}.lie`, s: { kind: "lie", attrs: {} }, lie: true, open: !!G.interrog.openLie(), speaker: talk.speaker, node: talk.node });
    return { lines, options, interrogation: { id: D.id, name: D.name, who: D.who, nerve: S.nerve, heat: S.heat, face: G.interrog.face() } };
  }
  function afterInterrog(lines) {
    const out = G.interrog.outcome();
    if (!out) return finish(interrogBeat(lines));
    G.interrog.finish();
    if (out.fight) { const fs = liveLine("fightstart"); if (fs) lines.push(fs); G.ext.combat.request(out.fight); return finish({ lines, options: null, fight: G.ext.combat.take() }); }
    if (out.node) return play(out.node, 0, lines);
    return finish({ lines, options: null, exit: "walk", done: true });
  }
  function pressChoose(o, strain) {
    const s = o.s, lines = [line("you", "LAMB", o.label.replace(/^"|"$/g, ""), { key: o.key })];
    G.memory.say(o.key, o.label);
    let r;
    if (s.kind === "lie") r = G.interrog.callLie();
    else {
      let pass = true;
      if (s.kind === "check") {
        let st = null; if (strain) { st = o.strain(strain); if (!st.ok) return talk.beat; G.checks.payStrain(st); }
        const c = G.checks.resolve(s.key, s.attrs.skill, +s.attrs.dc, { strain: st ? st.n : 0 }); pass = c.pass;
        lines.push(line("check", o.check.skillName, `${c.label}: ${c.pass ? "Success" : "Failure"}`, { skill: s.attrs.skill, check: { dc: c.dc, pass: c.pass, roll: c.roll, total: c.total, label: c.label } }));
      }
      r = G.interrog.press(s, { pass });
    }
    lines.push(...G.interrog.drain()); // a tell the press brought on, after Lamb's words
    if (r && r.node) { talk.stack.push({ id: "^interrog", at: 0 }); return play(r.node, 0, lines); }
    return afterInterrog(lines);
  }
  talk.interrogResolve = () => (G.interrog && G.interrog.current && G.interrog.outcome() ? afterInterrog([]) : null);
  // the speaker's char id beside talk.speaker (the display name), for portraits and the people layer
  Object.defineProperty(talk, "speakerId", { get: () => charIdOf(G, talk.speaker), enumerable: true });
  talk.start = () => { G.activeTalk = talk; G.emit("talk.start", { node: startId, title }); return play(startId); };
  return talk;
}

// A conversation opened away from its hub (a hotspot or a fight's way back straight into a scene)
// that says ^hub goes to the current place's hub: the hub node whose place: is where Lamb is.
function placeHub(G) {
  const here = G.state.place;
  for (const n of Object.values(G.book.nodes)) if (n.hub && n.steps.some((s) => s.kind === "place" && s.value === here)) return n.id;
  return null;
}

// The char id behind a display name: the @char whose speaker: (or id) matches, case aside.
const speakerIds = new WeakMap();
export function charIdOf(G, who) {
  if (!who) return null;
  let m = speakerIds.get(G.rs); if (!m) { m = new Map(); for (const c of Object.values(G.rs.chars || {})) { m.set(String(c.speaker).toUpperCase(), c.id); m.set(String(c.id).toUpperCase(), c.id); } speakerIds.set(G.rs, m); }
  return m.get(String(who).toUpperCase()) || null;
}
