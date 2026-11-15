// The navigation debug view (?debug=nav): the plate's visibility graph (world/visgraph.mjs) as thin
// lines between its corner nodes, and each walker's path as it will be walked: Lamb's in white, the
// wanderers' in amber, with the waypoints marked. Drawn over the people, under the paper.
import { visGraph } from "../world/visgraph.mjs";
import { groundAt } from "../world/plateworld.mjs";

export function navDebug(host, cam, paths) {
  const cv = document.createElement("canvas"); cv.className = "navdebug";
  cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3";
  host.append(cv);
  const at = (A, p) => cam.toScreen([p[0], groundAt(A, p[0], p[1]) ?? 0, p[1]]);
  function line(g, A, pts, colour, w) {
    g.strokeStyle = colour; g.lineWidth = w; g.beginPath(); let first = true;
    for (const p of pts) { const s = at(A, p); if (!s) continue; if (first) g.moveTo(s[0], s[1]); else g.lineTo(s[0], s[1]); first = false; }
    g.stroke();
    g.fillStyle = colour; for (const p of pts.slice(1)) { const s = at(A, p); if (s) g.fillRect(s[0] - 3, s[1] - 3, 6, 6); }
  }
  return {
    draw() {
      const W = host.clientWidth, H = host.clientHeight; if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const g = cv.getContext("2d"); g.clearRect(0, 0, W, H);
      const A = cam.arena && cam.arena(); if (!A) return;
      const G = visGraph(A);
      g.strokeStyle = "rgba(120, 200, 255, 0.18)"; g.lineWidth = 1; g.beginPath();
      G.adj.forEach((list, i) => { const a = at(A, G.nodes[i]); if (!a) return; for (const [j] of list) if (j > i) { const b = at(A, G.nodes[j]); if (b) { g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } } });
      g.stroke();
      g.fillStyle = "rgba(120, 200, 255, 0.8)"; for (const n of G.nodes) { const s = at(A, n); if (s) g.fillRect(s[0] - 1.5, s[1] - 1.5, 3, 3); }
      const P = paths();
      if (P.lamb && P.path && P.path.length) line(g, A, [[P.lamb[0], P.lamb[2]], ...P.path], "rgba(255, 255, 255, 0.95)", 2);
      for (const w of Object.values(P.wander || {})) if (w.to) line(g, A, [[w.at[0], w.at[2]], w.to, ...(w.way || [])], "rgba(255, 190, 80, 0.95)", 2);
      g.fillStyle = "rgba(255, 255, 255, 0.9)"; g.font = "12px monospace";
      g.fillText(`nav: ${G.nodes.length} nodes, ${G.edges} edges, built in ${G.ms.toFixed(1)} ms`, 12, H - 12);
    },
    remove() { cv.remove(); },
  };
}
