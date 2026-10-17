// The interface, drawn on the canvas: Lamb's notebook (the Daybook) as the dialogue column, the
// instrument cards, the clock, toasts for what the night does. Paper and ink; two faces, Hanken
// Grotesk for the words and Conso for names, times and readings.
export const FONT = { body: "'LW Hanken', 'Segoe UI', sans-serif", mono: "'LW Conso', 'Consolas', monospace" };
const PAPER = "rgba(233,227,212,0.95)", INK = "#1d1418", INK2 = "#5a4c4a", HOT = "#9a3b1f";

export function wrap(g, text, maxW) {
  const words = text.split(/\s+/), lines = []; let cur = "";
  for (const w of words) { const t = cur ? cur + " " + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}

// The dialogue column. beat: { lines: [{kind, who, text}], options: [{label, claim}] }.
// Returns option hit boxes for the pointer.
export function drawTalk(g, W, H, beat, { sel = 0, title = "", scroll = 0 } = {}) {
  const x0 = W - 418, w = 396, pad = 20, boxes = [];
  g.save(); g.fillStyle = PAPER; g.shadowColor = "rgba(0,0,0,0.5)"; g.shadowBlur = 24; g.fillRect(x0, 18, w, H - 36); g.restore();
  g.save(); g.strokeStyle = "rgba(29,20,24,0.25)"; for (let y = 64; y < H - 30; y += 26) { g.beginPath(); g.moveTo(x0 + 12, y); g.lineTo(x0 + w - 12, y); g.stroke(); } g.restore();
  g.fillStyle = INK2; g.font = `12px ${FONT.mono}`; g.fillText(title.toUpperCase(), x0 + pad, 44);
  // lay out from the bottom up so the newest line sits above the options
  const blocks = [];
  g.font = `16px ${FONT.body}`;
  for (const l of beat.lines) {
    const who = l.kind === "nar" ? "" : l.who;
    g.font = l.kind === "nar" ? `italic 16px ${FONT.body}` : `16px ${FONT.body}`;
    blocks.push({ who, kind: l.kind, lines: wrap(g, l.text, w - pad * 2), font: g.font });
  }
  const opts = (beat.options || []).map((o, i) => { g.font = `600 16px ${FONT.body}`; return { ...o, i, lines: wrap(g, `${i + 1}. ${o.label}`, w - pad * 2 - 10) }; });
  const optH = opts.reduce((a, o) => a + o.lines.length * 21 + 8, 0) + (opts.length ? 16 : 0);
  let y = H - 40 - optH - (opts.length ? 0 : 26);             // keep the "to go on" footer clear
  // text column: stack blocks upward
  const heights = blocks.map((b) => (b.who ? 18 : 0) + b.lines.length * 22 + 12);
  let top = y; for (let k = blocks.length - 1; k >= 0; k--) top -= heights[k];
  top = Math.min(70, top) + scroll;
  let ty = top;
  g.save(); g.beginPath(); g.rect(x0, 60, w, y - 60); g.clip();
  blocks.forEach((b, k) => {
    if (b.who) { g.font = `11px ${FONT.mono}`; g.fillStyle = b.kind === "inst" ? HOT : INK2; g.fillText(b.who, x0 + pad, ty + 12); ty += 18; }
    g.font = b.font; g.fillStyle = b.kind === "nar" ? "#3b2e2e" : INK;
    for (const t of b.lines) { ty += 22; g.fillText(t, x0 + pad, ty - 4); }
    ty += 12; void k;
  });
  g.restore();
  if (opts.length) {
    g.strokeStyle = "rgba(29,20,24,0.4)"; g.beginPath(); g.moveTo(x0 + pad, y); g.lineTo(x0 + w - pad, y); g.stroke(); y += 16;
    for (const o of opts) {
      const h = o.lines.length * 21 + 4;
      if (o.i === sel) { g.fillStyle = "rgba(154,59,31,0.12)"; g.fillRect(x0 + 10, y - 4, w - 20, h + 4); }
      g.font = `600 16px ${FONT.body}`; g.fillStyle = o.claim ? HOT : INK;
      o.lines.forEach((t, k) => g.fillText(t, x0 + pad + (k ? 18 : 0), y + 14 + k * 21));
      boxes.push({ i: o.i, rect: [x0 + 10, y - 4, w - 20, h + 4] }); y += h + 8;
    }
  } else { g.font = `12px ${FONT.mono}`; g.fillStyle = INK2; g.fillText("SPACE  to go on", x0 + pad, H - 44); }
  return boxes;
}

export function drawClock(g, text, sub) {
  g.save(); g.font = `20px ${FONT.mono}`; g.fillStyle = "rgba(240,232,214,0.92)"; g.shadowColor = "rgba(0,0,0,0.7)"; g.shadowBlur = 6; g.fillText(text, 26, 40);
  g.font = `12px ${FONT.mono}`; g.fillStyle = "rgba(240,232,214,0.7)"; g.fillText(sub, 26, 60); g.restore();
}
export function drawCard(g, W, H, who, text, alpha = 1) {
  g.save(); g.globalAlpha = alpha; g.font = `16px ${FONT.body}`; const lines = wrap(g, text, 520), h = 46 + lines.length * 22;
  const x = 26, y = H - h - 26; g.fillStyle = PAPER; g.fillRect(x, y, 560, h);
  g.font = `11px ${FONT.mono}`; g.fillStyle = HOT; g.fillText(who, x + 18, y + 22);
  g.font = `16px ${FONT.body}`; g.fillStyle = INK; lines.forEach((t, k) => g.fillText(t, x + 18, y + 44 + k * 22)); g.restore();
}
export function drawPrompt(g, x, y, label) {
  g.save(); g.font = `13px ${FONT.mono}`; const t = `E  ${label}`, w = g.measureText(t).width + 20;
  g.fillStyle = "rgba(20,14,18,0.78)"; g.fillRect(x - w / 2, y - 30, w, 22); g.fillStyle = "rgba(240,232,214,0.95)"; g.fillText(t, x - w / 2 + 10, y - 14); g.restore();
}
export function drawDaybook(g, W, H, { notes, facts, clock, tide }) {
  const x0 = 60, y0 = 40, w = W - 120, h = H - 80;
  g.save(); g.fillStyle = "rgb(233,227,212)"; g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = 30; g.fillRect(x0, y0, w, h); g.restore();
  g.fillStyle = INK; g.font = `600 22px ${FONT.body}`; g.fillText("Daybook", x0 + 30, y0 + 44);
  g.font = `12px ${FONT.mono}`; g.fillStyle = INK2; g.fillText(`${clock}   tide ${tide >= 0 ? "+" : ""}${tide.toFixed(2)} m   claim 4471/G`, x0 + 30, y0 + 66);
  const list = [...notes].filter((n) => facts[n] && facts[n].about && !/^(met|arrived|walked|floor\.closed|damp|chits|blackout|mother|gorm|keel\.rattled|crake|merrow\.trust|wenna\.confessed|key)/.test(n));
  g.font = `16px ${FONT.body}`; let y = y0 + 104, col = 0;
  for (const n of list) {
    const lines = wrap(g, "• " + facts[n].about, w / 2 - 70);
    if (y + lines.length * 22 > y0 + h - 30) { col++; y = y0 + 104; if (col > 1) break; }
    g.fillStyle = INK; lines.forEach((t, k) => g.fillText(t, x0 + 30 + col * (w / 2), y + k * 22)); y += lines.length * 22 + 10;
  }
  if (!list.length) { g.fillStyle = INK2; g.font = `italic 16px ${FONT.body}`; g.fillText("Nothing written yet but the claim, and the time it came.", x0 + 30, y); }
  g.font = `12px ${FONT.mono}`; g.fillStyle = INK2; g.fillText("TAB  close", x0 + 30, y0 + h - 20);
}
export function drawEnd(g, W, H, title, text) {
  g.save(); g.fillStyle = "rgba(6,4,8,0.82)"; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(240,232,214,0.95)"; g.font = `600 44px ${FONT.body}`; const tw = g.measureText(title).width; g.fillText(title, (W - tw) / 2, H / 2 - 30);
  g.font = `17px ${FONT.body}`; const lines = wrap(g, text, 760); lines.forEach((t, k) => { const w = g.measureText(t).width; g.fillText(t, (W - w) / 2, H / 2 + 14 + k * 26); }); g.restore();
}
