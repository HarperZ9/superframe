// resource-live.mjs — the perception://live resource: most-recent readout, refreshed on a tick,
// emits only on change (idle when static) → near-ambient perception for a subscribing client.
const URI = "perception://live";
export function createLive({ sense, intervalMs = 500 }) {
  let frame = null, last = null, lastKey = null, timer = null;
  const subs = new Set();
  const perceive = (f) => sense.assembleFullPerception(f.data, f.width, f.height, 4, { source: "live" });
  const keyOf = (r) => JSON.stringify(r.multiScale.grid8) + "|" + (r.phash || "");
  return {
    setSource(f) { frame = f; },
    current() { return frame; },
    list() { return [{ uri: URI, name: "Live perception", mimeType: "application/json" }]; },
    read() { last = frame ? perceive(frame) : null; return { contents: [{ uri: URI, mimeType: "application/json", text: JSON.stringify(last || {}) }] }; },
    subscribe(_uri, onUpdate) { if (onUpdate) subs.add(onUpdate); },
    tickOnce() {
      if (!frame) return;
      const r = perceive(frame), key = keyOf(r);
      if (key !== lastKey) { lastKey = key; last = r; for (const cb of subs) cb({ uri: URI }); }
    },
    start() { if (!timer) { timer = setInterval(() => this.tickOnce(), intervalMs); if (timer.unref) timer.unref(); } },
    stop() { if (timer) { clearInterval(timer); timer = null; } },
  };
}
