// The community model's stocks for the proofs, read straight from content/quota/q_community.lwd (@street and
// @household records, numeric fields only), with named states laid over them: the slice's start, and the
// week after the requisition on the honest route (food down, hunger up). In the game the same reads come
// from G.community.stock (world/community.mjs).
//   const R = readerOf(parseLwd(text), state)  -> read(name, subject)   (stocks.mjs reads the file in node)
export const STATES = {
  // the smoke weather: a riot, fields burning, a clearance fire (the community model's smoke stock)
  riot: { "": { smoke: 0.75 } },
  start: {},
  // the week after: the requisition has taken a quarter of the yard's food and a sixth of the square's; Mill Street's work gone
  after: { square: { food: 0.25, hunger: 0.5, work: 0.35, theft: 0.25 }, mill: { food: 0.15, hunger: 0.65, work: 0.2, theft: 0.35 }, haldane_yard: { food: 0.08, hunger: 0.8, theft: 0.3 }, haldane: { portion: 0.25 }, brack: { portion: 0.5 } },
  // the far end of the curve: a street with nothing left to burn
  dark: { "": { "volume.notices": 0.7, export: 1 }, square: { light: 0.05, hunger: 0.8 }, mill: { light: 0 }, haldane_yard: { light: 0 }, haldane: { portion: 0.05, food: 0.02 }, furrowe: { portion: 0.2 }, brack: { portion: 0.1 } },
};
const LINE = /\r?\n/, REC = /^@(street|household)\s+(\S+)/, KV = /^([a-z_.]+):\s*(-?\d+(?:\.\d+)?)\s*$/;
export function parseLwd(text) {
  const recs = {}; let cur = null;
  for (const line of text.split(LINE)) {
    const m = line.match(REC); if (m) { cur = recs[m[2]] = { kind: m[1] }; continue; }
    if (line.startsWith("@")) { cur = null; continue; }
    const kv = cur && line.match(KV); if (kv) cur[kv[1]] = +kv[2];
  }
  return recs;
}
export function readerOf(base, state = "start") {
  const over = STATES[state] || {};
  return (name, subject) => { const o = over[subject] && over[subject][name]; if (o !== undefined) return o; const r = base[subject]; return r ? r[name] : undefined; };
}
