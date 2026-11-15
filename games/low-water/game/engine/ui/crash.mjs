// Local crash reports (design/COMPLETION.md B6): when the page or a worker throws and nothing catches it, a
// report is written on this computer and one plain screen says so. Nothing is sent anywhere.
//   const C = installCrashReporter({ storage, build, target: window, doc: document })
//   C.watchGame(G)          keeps the last 200 game events (names and ids only) for the report
//   C.watchWorker(w, name)  names a worker's errors (an unnamed worker's error still reaches the page)
//   C.report(error, where)  writes a report by hand; returns its id
//   C.reports()             the ids kept, oldest first
//
// A report: { format: "low-water.crash", version: 1, id, at, build, where, error: { name, message, stack },
//   slot, beats: [{ ev, id?, node?, place?, slot? }], incidents }
// where: "page", "page (promise)" or "worker <name>". slot: the save slot last written. incidents: what the
// file store found wrong with files (save/filestore.mjs), as relative paths.
//
// No personal data: no user agent, screen, locale, time zone, save state, character name or player text. The
// error's message and stack are scrubbed: a home folder becomes <home>, an address's host becomes <host>,
// query strings and fragments go, and an e-mail address becomes <email>. A beat keeps only its event name and
// fixed ids from the content (node, place, slot), each checked against an id pattern.
//
// Stored under lw.crash.<id> in the game's storage (crash/<id>.json with the file store), with an index at
// lw.crash.index; the newest KEEP reports stay. One screen per session; later errors still write reports
// (up to MAX_PER_SESSION, so a throw in a frame loop cannot fill the disk).
export const CRASH_FORMAT = "low-water.crash";
export const KEEP = 10, MAX_PER_SESSION = 5, BEATS = 200;
const INDEX = "lw.crash.index";
const ID_RE = /^[\w.:-]{1,80}$/;

export function scrub(text) {
  return String(text ?? "")
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "<email>")
    .replace(/\b[a-z][\w+.-]*:\/\/[^/\s)'"]*/gi, (m) => `${m.slice(0, m.indexOf("://") + 3)}<host>`)
    .replace(/(\/\/<host>[^\s)'"?#]*)[?#][^\s)'"]*?((?::\d+){1,2})?(?=[\s)'"]|$)/g, "$1$2")
    .replace(/[A-Za-z]:[\\/]+(Users|Documents and Settings)[\\/]+[^\\/\s)'"]+/gi, "<home>")
    .replace(/\/(home|Users)\/[^/\s)'"]+/g, "<home>")
    .replace(/\\\\[^\\\s]+\\[^\\\s]+/g, "<share>")
    .slice(0, 8000);
}

// The fields a beat may keep, each an id from the content or the engine; anything else is left out.
function beatOf(ev, data) {
  const b = { ev: ID_RE.test(ev) ? ev : "?" };
  if (data && typeof data === "object") for (const k of ["id", "node", "place", "slot", "area"]) if (typeof data[k] === "string" && ID_RE.test(data[k])) b[k] = data[k];
  return b;
}

function errorOf(e) {
  if (e instanceof Error || (e && typeof e === "object" && "message" in e)) return { name: scrub(e.name || "Error").slice(0, 80), message: scrub(e.message), stack: scrub(e.stack || "") };
  return { name: "Thrown", message: scrub(typeof e === "string" ? e : (() => { try { return JSON.stringify(e); } catch { return String(e); } })()), stack: "" };
}

export function installCrashReporter({ storage, build = globalThis.__lwBuild || "dev", target = globalThis, doc = globalThis.document || null, now = () => new Date(), fileStore = globalThis.__lwFileStore || null, screen = true } = {}) {
  const beats = [];
  let written = 0, shown = false, lastSlot = null;
  const readIndex = () => { try { const v = JSON.parse(storage.get(INDEX) || "[]"); return Array.isArray(v) ? v.filter((x) => ID_RE.test(x)) : []; } catch (e) { console.warn(`crash: the report index is unreadable (${e.message}); starting a new one`); return []; } };
  const api = {
    report(error, where = "page") {
      if (written >= MAX_PER_SESSION) return null;
      try {
        const id = `${now().toISOString().replace(/[:.]/g, "-")}-${written}`;
        const slot = (fileStore && fileStore.lastSlot && fileStore.lastSlot()) || lastSlot;
        const incidents = fileStore && fileStore.incidents ? fileStore.incidents().map((x) => ({ at: x.at, kind: x.kind, path: x.path, kept: x.kept || null, why: scrub(x.why || "") })) : [];
        const r = { format: CRASH_FORMAT, version: 1, id, at: now().toISOString(), build: scrub(build).slice(0, 80), where: scrub(where).slice(0, 80), error: errorOf(error), slot: slot && ID_RE.test(slot) ? slot : null, beats: beats.slice(), incidents };
        storage.set(`lw.crash.${id}`, JSON.stringify(r));
        const ids = [...readIndex(), id];
        for (const old of ids.slice(0, Math.max(0, ids.length - KEEP))) storage.remove(`lw.crash.${old}`);
        storage.set(INDEX, JSON.stringify(ids.slice(-KEEP)));
        written++;
        if (screen && !shown && doc) { shown = true; showScreen(doc, id, fileStore ? `crash/${id}.json` : null); }
        return id;
      } catch (e) { console.error(`crash: could not write the report: ${e && e.message}`, error); return null; }
    },
    reports: () => readIndex(),
    read: (id) => { try { return JSON.parse(storage.get(`lw.crash.${id}`)); } catch { return null; } },
    watchGame(G) {
      return G.on("*", (data, ev) => {
        beats.push(beatOf(ev, data)); if (beats.length > BEATS) beats.shift();
        if ((ev === "saved" || ev === "loaded") && data && typeof data.slot === "string") lastSlot = data.slot;
      });
    },
    watchWorker(w, name = "worker") {
      const on = (e) => api.report(e && (e.error || { name: "WorkerError", message: e.message || "a worker stopped", stack: e.filename ? `at ${e.filename}:${e.lineno}:${e.colno}` : "" }), `worker ${name}`);
      w.addEventListener("error", (e) => { on(e); if (e.preventDefault) e.preventDefault(); }); // reported here, so not again by the page
      return w;
    },
  };
  // an uncaught throw in the page, a worker's error nobody handled (it reaches the page), and a promise nobody caught
  target.addEventListener("error", (e) => {
    if (e && e.target && e.target !== target && e.target.tagName) return; // a failed image or script fetch is not a crash
    api.report(e.error || { name: "Error", message: e.message || "unknown error", stack: e.filename ? `at ${e.filename}:${e.lineno}:${e.colno}` : "" }, "page");
  });
  target.addEventListener("unhandledrejection", (e) => api.report(e.reason, "page (promise)"));
  return api;
}

// One plain screen: what happened, where the report is, and the two ways on. Built with the DOM directly, so a
// broken game module cannot stop it.
function showScreen(doc, id, file) {
  const el = doc.createElement("div");
  el.className = "crashscreen"; el.setAttribute("role", "alertdialog"); el.setAttribute("aria-label", "Low Water stopped");
  el.style.cssText = "position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#070a11;color:#c4d8ee;font:400 1.1rem/1.6 'LW Hanken', sans-serif";
  const box = doc.createElement("div"); box.style.cssText = "max-width:34em;margin:0 8vw";
  const p = (t) => { const x = doc.createElement("p"); x.textContent = t; return x; };
  const h = doc.createElement("h2"); h.textContent = "Something went wrong."; h.style.cssText = "font-weight:500;margin:0 0 0.6em";
  const where = p(file ? `A report was saved on this computer, in the game's folder: ${file}. Nothing was sent.` : `A report was saved on this computer (${id}). Nothing was sent.`);
  where.style.fontFamily = "'LW Conso', monospace"; where.style.fontSize = "0.9rem";
  const row = doc.createElement("p");
  const b = (t, fn) => { const x = doc.createElement("button"); x.textContent = t; x.style.cssText = "margin-right:1em;font:inherit;padding:0.3em 1em;color:inherit;background:transparent;border:1px solid #c4d8ee;border-radius:3px;cursor:pointer"; x.addEventListener("click", fn); return x; };
  row.append(b("Restart", () => { try { globalThis.location.reload(); } catch (e) { console.error(`crash: could not restart: ${e.message}`); } }), b("Keep playing", () => el.remove()));
  box.append(h, p("The game stopped working as it should. Your last save is safe."), where, row);
  el.append(box); (doc.body || doc.documentElement).append(el);
  try { row.firstChild.focus(); } catch { /* a page with no focus */ }
}
