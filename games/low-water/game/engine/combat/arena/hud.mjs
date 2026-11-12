// The arena's marks, drawn after the dither at full resolution: Standing and Breath as ticks
// along the bottom edge (Daybook-edge marks, not bars over the world), the clock, tide and wind,
// a lock mark, one bark line, short notes for catches and blocks, and the outcome.
const FONT = "13px ui-monospace, Consolas, monospace";

function ticks(g, x, y, n, max, label, on = "#efe4d2") {
  g.fillStyle = "#efe4d2"; g.fillText(label, x, y + 9);
  for (let i = 0; i < Math.ceil(max); i++) {
    const f = Math.max(0, Math.min(1, n - i));
    g.fillStyle = "rgba(239,228,210,0.25)"; g.fillRect(x + 64 + i * 9, y, 6, 10);
    if (f > 0) { g.fillStyle = on; g.fillRect(x + 64 + i * 9, y + 10 * (1 - f), 6, 10 * f); }
  }
}

const hhmm = (c) => { const m = Math.floor(c) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };

export function drawHud(g, V, Wpx, Hpx) {
  const W = V.W, L = W.lamb(), t = W.field.terms, foot = W.field.footing(L.x, L.z);
  g.font = FONT; g.textBaseline = "alphabetic";
  g.fillStyle = "rgba(10,6,8,0.55)"; g.fillRect(0, Hpx - 58, 420, 58);
  ticks(g, 14, Hpx - 48, L.hp, L.hpMax, "STANDING");
  ticks(g, 14, Hpx - 30, L.st, L.stMax, L.winded ? "BREATH !" : "BREATH");
  g.fillStyle = "#efe4d2";
  g.fillText(`${hhmm(t.clock)}  tide ${t.tide.toFixed(2)} m  wind ${t.windSpeed.toFixed(0)} m/s  fog ${t.fog.toFixed(2)}  ${foot.kind}${foot.band !== "dry" ? ", " + foot.band : ""}`, 14, Hpx - 8);
  const lock = L.lock != null && W.byId(L.lock);
  if (lock) { const [x, y] = V.proj(lock.x, lock.z, W.defs[lock.id].height + 0.4); g.fillStyle = "#efe4d2"; g.fillRect((x * Wpx) / 640 - 4, (y * Hpx) / 360 - 2, 8, 3); }
  if (V.barkT > 0) {
    V.barkT--; g.fillStyle = "rgba(10,6,8,0.6)"; g.fillRect(Wpx / 2 - 300, 18, 600, 26);
    g.fillStyle = "#efe4d2"; g.textAlign = "center"; g.fillText(`${V.bark.voice.toUpperCase()}  ${V.bark.text}`, Wpx / 2, 36); g.textAlign = "left";
  }
  V.flashes = V.flashes.filter((f) => --f.life > 0);
  V.flashes.forEach((f, i) => { g.fillStyle = `rgba(239,228,210,${f.life / 40})`; g.fillText(`${f.type}${f.id ? " " + f.id : ""}`, Wpx - 190, 60 + i * 16); });
  if (W.result) {
    g.fillStyle = "rgba(10,6,8,0.7)"; g.fillRect(Wpx / 2 - 160, Hpx / 2 - 30, 320, 60);
    g.fillStyle = "#efe4d2"; g.textAlign = "center"; g.font = "20px ui-monospace, Consolas, monospace";
    g.fillText(W.result.outcome.toUpperCase(), Wpx / 2, Hpx / 2 + 7); g.textAlign = "left"; g.font = FONT;
  }
}
