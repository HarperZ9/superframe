// A headless Chromium driven over the DevTools protocol, with nothing installed: Node's own fetch
// and WebSocket. Launches the headless shell with the GPU off and no window.
//   const B = await launch({ exe, port }); const P = await B.page(w, h);
//   await P.go(url); await P.eval("expr"); await P.shot(path); await B.close()
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ exe, port = 9333, args = [] }) {
  const proc = spawn(exe, ["--headless", `--remote-debugging-port=${port}`, "--disable-gpu", "--disable-gpu-compositing", "--no-first-run", "--no-default-browser-check", "--window-size=1280,720", "about:blank", ...args], { stdio: "ignore", windowsHide: true });
  let info = null;
  for (let i = 0; i < 100 && !info; i++) { try { info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(100); } }
  if (!info) { proc.kill(); throw new Error(`cdp: no browser on port ${port}`); }
  return {
    async page(width = 1280, height = 720) {
      const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
      const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
      let id = 0; const wait = new Map(), logs = [];
      ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } else if (d.method === "Runtime.exceptionThrown") logs.push(`exception: ${d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text}`); else if (d.method === "Runtime.consoleAPICalled" && (d.params.type === "error" || d.params.type === "warning")) logs.push(`${d.params.type}: ${d.params.args.map((a) => a.value ?? a.description ?? "").join(" ")}`); };
      const send = (method, params = {}) => new Promise((ok) => { const k = ++id; wait.set(k, ok); ws.send(JSON.stringify({ id: k, method, params })); });
      await send("Runtime.enable"); await send("Page.enable"); await send("Page.bringToFront"); // a view runs in the front tab: a background tab's frames are throttled
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
      const P = {
        logs,
        async go(url) { await send("Page.navigate", { url }); },
        async eval(expr, { await: aw = true } = {}) {
          const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: aw, returnByValue: true });
          if (r.result && r.result.exceptionDetails) throw new Error(`page: ${r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text}`);
          return r.result && r.result.result ? r.result.result.value : undefined;
        },
        async until(expr, ms = 120000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await P.eval(expr)) return true; } catch { /* the page is loading */ } await sleep(250); } throw new Error(`timed out waiting for ${expr}`); },
        async shot(path) { const r = await send("Page.captureScreenshot", { format: "png" }); await writeFile(path, Buffer.from(r.result.data, "base64")); },
        // close the tab itself, so an earlier view never keeps running beside the next one
        async close() { ws.close(); try { await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`); } catch { /* already gone */ } },
      };
      return P;
    },
    async close() { proc.kill(); await sleep(200); },
  };
}
export { sleep };
