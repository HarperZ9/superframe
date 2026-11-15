// Close captures of each tool's first landed blow on the quay (Lamb vs the lamplighters), 1080p, frames 0, 2, 4, 8, 14 after contact.
//   node tools/toolhits.mjs [w.knife,w.stick,...] with the game served on 8754; OUT below
import { launch, sleep } from "./visualcheck/cdp.mjs";
import { VIEWS } from "./visualcheck/views.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
const exe = `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
const OUT = process.env.OUT || new URL("../../capture/tool-hits/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"); mkdirSync(OUT, { recursive: true });
const B = await launch({ exe, port: 9400 + Math.floor(Math.random() * 300) });
const POS = (process.env.POS || "0.6,-1.5").split(",").map(Number); // Lamb's spot before the fight (POS=x,z)
const FV = VIEWS.find((x) => x.id === "fight-against-a-wall");
try {
  for (const tool of (process.argv[2] || "w.knife,w.stick,w.crowbar,w.boathook,w.hammer").split(",")) {
    const P = await B.page(1920, 1080);
    await P.go(`http://127.0.0.1:8754/engine/play.html?capture=1`);
    await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
    await P.eval(FV.steps[0]); await P.eval(`(async () => { const p = window.__lw.play; p.people.walkTo([${POS[0]}, 0, ${POS[1]}], () => {}); for (let i = 0; i < 300 && p.people.walking(); i++) await new Promise((r) => setTimeout(r, 100)); const G = window.__lw.G; G.state.pos = [${POS[0]}, G.state.pos[1], ${POS[1]}]; return true; })()`); await P.eval(FV.steps[3]);
    const r = await P.eval(`(async () => { const c = window.__lw, p = c.play, G = c.G; G.inv.give('${tool}', 1); ((G.state.inv ||= {}).equipped ||= {}).hand = '${tool}';
      globalThis.__lwFxHold = 0; G.loop.paused = true; p.people.talkingWith('fewell'); p.startTalk('quay.lamplighters.stop'); const i = p.P.beat.options.findIndex((o) => /Stand your ground/.test(o.label)); p.choose(i); await new Promise((r) => setTimeout(r, 600));
      const C = G.ext.combat, W = C.current.W, L = W.lamb(); for (const F of W.fighters) if (F.team !== 'lamb') F.hp = 999;
      let landed = -1;
      for (let k = 0; k < 900 && landed < 0; k++) { const T = W.fighters.filter((f) => f.team !== 'lamb' && !f.out).sort((a, b) => Math.hypot(a.x - L.x, a.z - L.z) - Math.hypot(b.x - L.x, b.z - L.z))[0], d = Math.hypot(T.x - L.x, T.z - L.z);
        const inp = d > 1.2 ? { mx: (T.x - L.x) / d, mz: (T.z - L.z) / d } : (k % 2 ? { press: ['light'] } : {});
        const ev = C.step(inp); if (ev.some((e) => e.type === 'hit' && e.by === 'lamb')) { landed = k; globalThis.__lwLandEv = ev.filter((e) => e.by === 'lamb' || e.id === 'lamb').map((e) => e.type + ':' + (e.move || '')); } }
      globalThis.__lwFxHold = 1; return { landed, cls: W.defs.lamb.tool.cls, ev: globalThis.__lwLandEv };   // hold the marks from the contact itself (a slow frame used to age them out before the first still)
    })()`);
    const at = {};
    for (const f of [0, 2, 4, 8, 14]) {
      await P.eval(`globalThis.__lwFxHold = ${f <= 4 ? 1 : 0}; 1`);
      await sleep(350);
      at[f] = await P.eval(`(() => { const G = window.__lw.G, W = G.ext.combat.current.W, L = W.lamb(), cam = window.__lw.play.cam, s = cam.toScreen([L.x, 0, L.z]); return s && [s[0], s[1], cam.scaleAt([L.x, 0, L.z])]; })()`);
      await P.shot(`${OUT}/${tool}-f${f}.png`);
      const next = { 0: 2, 2: 2, 4: 4, 8: 6, 14: 0 }[f];
      await P.eval(`(() => { for (let k = 0; k < ${next}; k++) window.__lw.G.ext.combat.step({}); return 1; })()`);
    }
    writeFileSync(`${OUT}/${tool}-at.json`, JSON.stringify({ ...r, at }));
    console.log(tool, JSON.stringify(r), JSON.stringify(at[0]));
    await P.close();
  }
} finally { await B.close(); }
