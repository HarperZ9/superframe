// Skill checks. Two modes, chosen by content in @rules check-mode:
//   dice   2d6 + skill + modifiers >= difficulty; double six always passes, double one always
//          fails. Rolls are a pure function of the save seed, the check and the attempt number,
//          so reloading does not change the result.
//   fixed  skill + modifiers >= difficulty; no chance at all. The odds read 0 or 100 percent.
// Environment modifiers (@modifier records: tide, weather and light against named skills) are
// part of every check, and the breakdown lists each with its reason.
// Retry rules for visible checks ({retry: ...} on a check line):
//   raise (default)  retry once the total has gone up since the failure (a skill point, a coat,
//                    the fog lifting)
//   skill            retry once the skill's own rank has gone up
//   time:N           retry after N minutes on the clock
//   never / red      one try only
// Strain (R1): before a visible check the player may add +1 to +3, paid by the skill's
// attribute (@attr strain: a meter and its cost per +1, or rep: favour with the faction of the
// node's speaker). Refused when it would fill the meter or take favour below rep-min. Skills
// without an attribute (the Kit) cannot be strained; {nostrain} on the option turns it off.
import { evaluate } from "../core/expr.mjs";
import { dice } from "../core/rng.mjs";

const DEFAULT_LABELS = [[0, "Trivial"], [8, "Easy"], [10, "Medium"], [12, "Challenging"], [14, "Formidable"], [16, "Legendary"], [18, "Heroic"], [20, "Impossible"]];

export function createChecks(G) {
  const rs = G.rs, mode = () => String(rs.rules["check-mode"] || "dice");
  const store = () => (G.state.checks ||= {});
  const labels = () => (rs.rules["dc-labels"] ? String(rs.rules["dc-labels"]).split(",").map((s) => { const [n, ...w] = s.trim().split(/\s+/); return [+n, w.join(" ")]; }) : DEFAULT_LABELS);
  const api = {
    mode,
    envMods(skill) {
      return rs.modifiers.filter((m) => (m.skills.includes("*") || m.skills.includes(skill)) && (!m.cond || evaluate(m.cond, G.scope))).map((m) => ({ amount: m.amount, why: m.why, env: true }));
    },
    // Everything that makes up the number for a check, in order.
    breakdown(skill, extra = []) {
      const sh = G.sheet, sk = rs.skills[skill];
      const parts = [{ amount: sh.skillBase(skill), why: sk && sk.attr ? `${rs.attrs[sk.attr].name}` : "base" }];
      if (sh.ranks(skill)) parts.push({ amount: sh.ranks(skill), why: "training" });
      parts.push(...sh.mods(`skill.${skill}`), ...api.envMods(skill), ...extra);
      return { parts, total: parts.reduce((a, p) => a + p.amount, 0) };
    },
    odds(total, dc) {
      if (mode() === "fixed") return total >= dc ? 1 : 0;
      let ok = 0;
      for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) { const s = a + b; if (s === 12 || (s !== 2 && s + total >= dc)) ok++; }
      return ok / 36;
    },
    label(dc) { let l = ""; for (const [n, w] of labels()) if (dc >= n) l = w; return l; },
    // What straining by n costs for this skill, and whether it is allowed now.
    //   { ok, why, kind: "meter"|"rep", id, cost, n }
    strain(skill, n, { speaker = "", nostrain = false } = {}) {
      n = Math.max(0, Math.min(rs.rules["strain-max"], Math.floor(+n || 0)));
      if (!n) return { ok: true, n: 0, cost: 0 };
      const sk = rs.skills[skill], at = sk && sk.attr ? rs.attrs[sk.attr] : null, how = at ? at.strain : null;
      if (nostrain || !how || how.kind === "none") return { ok: false, n, why: "This cannot be strained" };
      const cost = how.cost * n;
      if (how.kind === "meter") {
        const m = G.content.meters[how.id]; if (!m) return { ok: false, n, why: "This cannot be strained" };
        const v = G.pressure.meter(how.id);
        if (v + cost >= m.max) return { ok: false, n, kind: "meter", id: how.id, cost, why: `${m.name} would fill` };
        return { ok: true, n, kind: "meter", id: how.id, cost };
      }
      const f = G.people ? G.people.factionOf(speaker) : null;
      if (!f) return { ok: false, n, why: "Nobody here to owe" };
      if (G.factions.get(f) - cost < rs.rules["rep-min"]) return { ok: false, n, kind: "rep", id: f, cost, why: `${rs.factions[f].name} will not give that much` };
      return { ok: true, n, kind: "rep", id: f, cost };
    },
    payStrain(st) {
      if (!st || !st.ok || !st.n) return;
      if (st.kind === "meter") G.pressure.addMeter(st.id, st.cost); else G.factions.add(st.id, -st.cost);
      G.emit("strain", st);
    },
    // Preview for the interface: odds, label, the parts, and whether it is locked.
    preview(key, skill, dc, retry = "raise", { strain = 0 } = {}) {
      const extra = strain ? [{ amount: strain, why: "strain" }] : [];
      const b = api.breakdown(skill, extra), rec = store()[key], lock = rec && !rec.pass ? api.lockReason(rec, skill, b.total - strain, retry) : null;
      return { key, skill, dc, label: api.label(dc), total: b.total, parts: b.parts, odds: api.odds(b.total, dc), attempts: rec ? rec.attempts : 0, passed: !!(rec && rec.pass), locked: lock };
    },
    lockReason(rec, skill, total, retry) {
      const r = String(retry || "raise");
      if (r === "never" || r === "red") return "Only one try";
      if (r === "raise" && total <= rec.total) return mode() === "fixed" ? "Nothing has changed." : `Try again when your ${rs.skills[skill] ? rs.skills[skill].name : skill} is higher`;
      if (r === "skill" && G.sheet.ranks(skill) <= rec.ranks) return `Try again after training ${rs.skills[skill] ? rs.skills[skill].name : skill}`;
      if (r.startsWith("time:")) { const wait = +r.slice(5), left = rec.at + wait - G.clock(); if (left > 0) return `Try again in ${Math.ceil(left)} minutes`; }
      return null;
    },
    // Resolve a check now. Records the attempt; returns the result with its parts.
    resolve(key, skill, dc, { passive = false, strain = 0 } = {}) {
      const b = api.breakdown(skill, strain ? [{ amount: strain, why: "strain" }] : []), rec = (store()[key] ||= { attempts: 0 });
      let roll = null, pass;
      if (mode() === "fixed") pass = b.total >= dc;
      else {
        roll = dice(G.state.seed, `${key}|${rec.attempts}`); const s = roll[0] + roll[1];
        pass = s === 12 ? true : s === 2 ? false : s + b.total >= dc;
      }
      if (!passive) Object.assign(rec, { attempts: rec.attempts + 1, pass, total: b.total - strain, ranks: G.sheet.ranks(skill), at: G.clock() });
      const out = { key, skill, dc, pass, roll, total: b.total, parts: b.parts, label: api.label(dc), passive, odds: api.odds(b.total, dc) };
      G.emit("check", out);
      return out;
    },
    // A passive check never rolls: it passes when the total meets the difficulty.
    passive(key, skill, dc) {
      const b = api.breakdown(skill), pass = b.total >= dc, out = { key, skill, dc, pass, roll: null, total: b.total, parts: b.parts, label: api.label(dc), passive: true };
      if (pass) G.emit("check", out);
      return out;
    },
  };
  return api;
}
