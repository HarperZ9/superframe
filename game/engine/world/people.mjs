// The people of the town as data (@char): who speaks for which faction, and where they are.
//   @char id   name, speaker (the capitals used in line:), faction, role, about,
//              sched (repeatable: hh:mm-hh:mm place), sched lines are optional
// The Record is written by content as flags (design/LWD1-FORMAT.md 5.2); this module answers
// the questions the engine needs: whose faction a node's speaker owes (strain on HAT checks),
// and who is where.
//   state.moved = { char: place }   overrides a schedule from the moment it is set
import { toMin } from "../core/expr.mjs";

export function loadSchedules(book) {
  const out = {}, errors = [];
  for (const r of Object.values((book.records || {}).char || {})) {
    out[r.id] = [];
    for (const e of r.kv.filter((x) => x.key === "sched")) {
      const m = e.value.trim().match(/^(\d+:\d{2})\s*-\s*(\d+:\d{2})\s+([\w.]+)$/);
      if (!m) { errors.push({ file: r.file, line: e.line, msg: `char ${r.id}: sched: expected "hh:mm-hh:mm place", got ${e.value}` }); continue; }
      out[r.id].push({ from: toMin(m[1]), to: toMin(m[2]), place: m[3] });
    }
  }
  return { schedules: out, errors };
}

export function createPeople(G, schedules = {}) {
  const rs = G.rs;
  const api = {
    list: () => Object.values(rs.chars),
    bySpeaker: (speaker) => Object.values(rs.chars).find((c) => c.speaker === String(speaker || "").toUpperCase()) || null,
    factionOf(speaker) { const c = rs.chars[speaker] || api.bySpeaker(speaker); return c ? c.faction : null; },
    where(id) {
      const moved = (G.state.moved || {})[id]; if (moved) return moved;
      const t = G.clock(), s = (schedules[id] || []).find((x) => t >= x.from && t < x.to);
      return s ? s.place : null;
    },
    move(id, place) { (G.state.moved ||= {})[id] = place; G.emit("move", { id, place }); },
    here: (id) => api.where(id) === G.state.place,
    present: () => Object.keys(rs.chars).filter((id) => api.here(id)),
  };
  return api;
}
