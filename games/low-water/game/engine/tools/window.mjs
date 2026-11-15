// --window act:from-to (tools/playthrough.mjs): what is new to do in a stretch of the night. Each build's
// route is played to its first menu at or after `from`, and its state kept; then, every half hour from
// `from` to `to`, every hub of that act (a node marked hub: yes, or named .hub or .menu) is opened on a copy of that state
// with the clock moved on (a cut: no events played), and its options read. An option counts as new
// when it can be pressed (not locked, not said) and leads to a node this run has never visited.
//   node tools/playthrough.mjs --window 3:01:05-05:35 [--build fist,tongue,...]
const toMin = (s) => { const [h, m] = s.split(":").map(Number); return (h < 12 ? h + 24 : h) * 60 + m; };
const hm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export async function runWindow(X, spec, builds) {
  const [actS, rest] = [spec.split(":")[0], spec.slice(spec.indexOf(":") + 1)], act = +actS, [fromS, toS] = rest.split("-"), from = toMin(fromS), to = toMin(toS);
  const C = X.contents[act - 1], hubs = Object.values(C.book.nodes || {}).filter((n) => n.hub || /\.(hub|menu)$/.test(n.id)).map((n) => n.id); // marked hub: yes, or named so
  const out = [];
  for (const build of builds) {
    let snap = null;
    X.setMenuHook((G, t, a) => { if (!snap && a.act === act && G.clock() >= from) snap = { state: structuredClone(G.state), env: G.env.save(), node: t.node, clock: G.clock() }; });
    X.playGame({ build, seed: 1, shuffleSeed: 101 });
    X.setMenuHook(null);
    if (!snap) { out.push({ build, reached: false }); console.log(`${build}: never at a menu in act ${act} after ${fromS}`); continue; }
    const seen = new Map(); // option key -> first half hour it was new
    const per = [];
    for (let T = Math.max(from, snap.clock); T <= to; T += 30) {
      let n = 0;
      for (const hub of hubs) {
        const G = X.createFullGame({ content: C, seed: 1, state: structuredClone(snap.state) });
        await G.env.load(structuredClone(snap.env));
        if (T > G.clock()) G.env.advance(T - G.clock());
        let t; try { t = G.talk(hub); } catch (e) { continue; }
        for (const o of (t && t.beat && t.beat.options) || []) {
          const target = o.s && o.s.target;
          if (o.locked || o.said || !target || /\.(hub|menu)$/.test(target) || target.startsWith("^") || G.memory.visits(target) > 0) continue;
          const k = `${hub} -> ${target}`; n++;
          if (!seen.has(k)) seen.set(k, { at: T, label: o.label });
        }
      }
      per.push([hm(T), n]);
    }
    out.push({ build, reached: true, from: hm(snap.clock), at: snap.node, perHalfHour: per, distinct: [...seen].map(([k, v]) => ({ k, at: hm(v.at), label: v.label })) });
    console.log(`${build}: state at ${hm(snap.clock)} (${snap.node}); new options per half hour ${per.map(([h, n]) => `${h} ${n}`).join(", ")}; distinct ${seen.size}`);
    for (const [k, v] of seen) console.log(`    ${hm(v.at)}  ${k}  "${v.label}"`);
  }
  return out;
}
