// Browser surface for the game's real modules, over QuickJS: timers, a small DOM, fetch, the file bridge.
// The DOM keeps a tree and no layout; the host reads the tree through __lwSnapshot() and paints it.
const H = globalThis.__host;
globalThis.window = globalThis; globalThis.self = globalThis; globalThis.global = globalThis;
globalThis.console = { log: (...a) => H.log(a.join(" ")), warn: (...a) => H.log("warn " + a.join(" ")), error: (...a) => H.log("error " + a.join(" ")), info: (...a) => H.log(a.join(" ")), debug() {} };
globalThis.performance = { now: () => H.now() };
// timers and animation frames, run by __lwTick() from the host loop
let tid = 1; const timers = new Map(); let raf = [];
globalThis.setTimeout = (fn, ms = 0, ...a) => { const id = tid++; timers.set(id, { at: H.now() + Math.max(0, +ms || 0), once: true, fn: () => fn(...a) }); return id; };
globalThis.setInterval = (fn, ms = 0, ...a) => { const id = tid++, step = Math.max(1, +ms || 1); const t = { at: H.now() + step, once: false, fn: () => { t.at = H.now() + step; fn(...a); } }; timers.set(id, t); return id; };
globalThis.clearTimeout = globalThis.clearInterval = (id) => { timers.delete(id); };
globalThis.requestAnimationFrame = (fn) => { raf.push(fn); return raf.length; };
globalThis.cancelAnimationFrame = () => {};
globalThis.queueMicrotask = (fn) => Promise.resolve().then(fn);
globalThis.__lwTick = () => {
  const now = H.now();
  for (const [id, t] of [...timers]) if (t.at <= now && timers.has(id)) { if (t.once) timers.delete(id); try { t.fn(); } catch (e) { console.error("timer: " + (e && e.stack || e)); } }
  const q = raf; raf = []; for (const f of q) try { f(now); } catch (e) { console.error("raf: " + (e && e.stack || e)); }
  return timers.size + raf.length;
};
// events: bubbling goes up the parents, then to the page (window)
const page = { _l: {} };
class Target {
  constructor() { this._l = {}; }
  addEventListener(t, f) { (this._l[t] ||= []).push(f); }
  removeEventListener(t, f) { const l = this._l[t]; if (l) this._l[t] = l.filter((x) => x !== f); }
  dispatchEvent(e) {
    e.target ||= this;
    for (let n = this; n && !e._stop; n = n.parentNode || (n === page ? null : page)) {
      e.currentTarget = n; for (const f of [...((n._l || {})[e.type] || [])]) f.call(n, e);
      if (e.bubbles === false) break;
    }
    return !e.defaultPrevented;
  }
}
globalThis.Event = class { constructor(type, o = {}) { this.type = type; Object.assign(this, o); } preventDefault() { this.defaultPrevented = true; } stopPropagation() { this._stop = true; } };
globalThis.KeyboardEvent = class extends Event {}; globalThis.CustomEvent = class extends Event {};
globalThis.URLSearchParams = class { constructor(s = "") { this.m = new Map(); for (const p of String(s).replace(/^\?/, "").split("&")) if (p) { const [k, v = ""] = p.split("="); this.m.set(decodeURIComponent(k), decodeURIComponent(v)); } } get(k) { return this.m.has(k) ? this.m.get(k) : null; } has(k) { return this.m.has(k); } };
globalThis.URL = class {
  constructor(u, base) {
    u = String(u);
    if (!/^[a-z]+:/i.test(u)) {
      const b = String(base || "file:///");
      if (u.startsWith("/")) u = b.replace(/^([a-z]+:\/\/[^/]*).*$/i, "$1") + u;
      else { const parts = b.replace(/[?#].*$/, "").split("/"); parts.pop(); for (const s of u.split("/")) { if (s === "..") parts.pop(); else if (s !== ".") parts.push(s); } u = parts.join("/"); }
    }
    this.href = u; const m = u.match(/^([a-z]+:)\/\/([^/]*)([^?#]*)(\?[^#]*)?/i) || [];
    this.protocol = m[1]; this.host = m[2]; this.pathname = m[3]; this.search = m[4] || "";
  }
  toString() { return this.href; }
};
// DOM
const parseSel = (s) => s.split(",").map((part) => part.trim().split(/\s*(>)\s*|\s+/).filter(Boolean).map((c) => {
  if (c === ">") return c;
  const out = { tag: null, id: null, cls: [], attrs: [], not: [] };
  c.replace(/:not\(([^)]*)\)/g, (_, n) => { out.not.push(n); return ""; }).replace(/^([a-z0-9-]+)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]/gi, (m, t, i, c2, a, v) => {
    if (t) out.tag = t.toUpperCase(); else if (i) out.id = i; else if (c2) out.cls.push(c2); else if (a) out.attrs.push([a, v]); return m; });
  return out;
}));
const matchCompound = (el, c) => (!c.tag || el.tagName === c.tag) && (!c.id || el.id === c.id) && c.cls.every((k) => el.classList.contains(k)) && c.attrs.every(([a, v]) => el.hasAttribute(a) && (v === undefined || el.getAttribute(a) === v)) && !c.not.some((n) => matchSel(el, parseSel(n)));
const matchSel = (el, sels) => sels.some((chain) => {
  const m = (e, i) => {
    if (!e || e.nodeType !== 1 || !matchCompound(e, chain[i])) return false;
    if (i === 0) return true;
    let j = i - 1, direct = false; if (chain[j] === ">") { direct = true; j--; }
    for (let p = e.parentNode; p && p.nodeType === 1; p = p.parentNode) { if (m(p, j)) return true; if (direct) return false; }
    return false;
  };
  return m(el, chain.length - 1);
});
class Node extends Target {
  constructor() { super(); this.childNodes = []; this.parentNode = null; }
  get firstChild() { return this.childNodes[0] || null; } get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  _adopt(n) { if (typeof n === "string") n = new Text(n); if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; return n; }
  append(...ns) { for (const n of ns) this.childNodes.push(this._adopt(n)); } appendChild(n) { this.append(n); return n; }
  prepend(...ns) { this.childNodes.unshift(...ns.map((n) => this._adopt(n))); }
  insertBefore(n, ref) { n = this._adopt(n); const i = this.childNodes.indexOf(ref); if (i < 0) this.childNodes.push(n); else this.childNodes.splice(i, 0, n); return n; }
  removeChild(n) { const i = this.childNodes.indexOf(n); if (i >= 0) this.childNodes.splice(i, 1); n.parentNode = null; return n; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  replaceChildren(...ns) { for (const c of this.childNodes) c.parentNode = null; this.childNodes = []; this.append(...ns); }
  contains(n) { for (; n; n = n.parentNode) if (n === this) return true; return false; }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(""); } set textContent(v) { this.replaceChildren(String(v)); }
  cloneNode() { return this; }
}
class Text extends Node { constructor(t) { super(); this.nodeType = 3; this.data = String(t); } get textContent() { return this.data; } set textContent(v) { this.data = String(v); } }
class ClassList {
  constructor(el) { this.el = el; } _a() { return this.el.className.split(/\s+/).filter(Boolean); } contains(c) { return this._a().includes(c); }
  add(...c) { const a = this._a(); for (const k of c) if (!a.includes(k)) a.push(k); this.el.className = a.join(" "); }
  remove(...c) { this.el.className = this._a().filter((k) => !c.includes(k)).join(" "); }
  toggle(c, f) { const on = f === undefined ? !this.contains(c) : !!f; if (on) this.add(c); else this.remove(c); return on; }
}
let activeEl = null;
class Element extends Node {
  constructor(tag) {
    super(); this.nodeType = 1; this.tagName = String(tag).toUpperCase(); this.className = ""; this.id = ""; this._attrs = {}; this.dataset = {}; this.classList = new ClassList(this);
    this.style = { cssText: "", setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } }; this.title = ""; this.hidden = false; this.type = ""; this.value = ""; this.tabIndex = -1;
  }
  get nodeName() { return this.tagName; }
  setAttribute(k, v) { v = String(v); this._attrs[k] = v; if (k === "class") this.className = v; else if (k === "id") this.id = v; else if (k.startsWith("data-")) this.dataset[k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = v; }
  getAttribute(k) { if (k === "class") return this.className; if (k === "id") return this.id || null; return k in this._attrs ? this._attrs[k] : null; }
  hasAttribute(k) { return k === "class" ? !!this.className : k in this._attrs || (k.startsWith("data-") && k.slice(5) in this.dataset); }
  removeAttribute(k) { delete this._attrs[k]; }
  matches(s) { return matchSel(this, parseSel(s)); }
  closest(s) { const sels = parseSel(s); for (let e = this; e && e.nodeType === 1; e = e.parentNode) if (matchSel(e, sels)) return e; return null; }
  querySelectorAll(s) { const sels = parseSel(s), out = []; const walk = (n) => { for (const c of n.childNodes) if (c.nodeType === 1) { if (matchSel(c, sels)) out.push(c); walk(c); } }; walk(this); return out; }
  querySelector(s) { return this.querySelectorAll(s)[0] || null; }
  getElementsByClassName(c) { return this.querySelectorAll("." + c); }
  focus() { activeEl = this; } blur() { if (activeEl === this) activeEl = null; } click() { this.dispatchEvent(new Event("click")); }
  scrollIntoView() {} scrollTo() {} animate() { return { finished: Promise.resolve(), cancel() {}, onfinish: null }; }
  get offsetParent() { return this.parentNode; } get offsetWidth() { return 100; } get offsetHeight() { return 30; } get clientWidth() { return 1920; } get clientHeight() { return 1080; }
  get isConnected() { return docRoot.contains(this); }
  getBoundingClientRect() {
    let i = 0, found = false;
    const walk = (n) => { for (const c of n.childNodes) { if (c === this) { found = true; return; } if (c.nodeType === 1) { i++; walk(c); if (found) return; } } };
    walk(docRoot); return { x: 0, y: i * 24, left: 0, top: i * 24, width: 100, height: 30, right: 100, bottom: i * 24 + 30 };
  }
  set innerHTML(v) { this.replaceChildren(); this._html = v; } get innerHTML() { return this._html || ""; }
}
const docRoot = new Element("html"), body = new Element("body"); docRoot.append(body);
const byId = (id) => docRoot.querySelector("#" + id);
const doc = new Element("#document");
Object.assign(doc, { documentElement: docRoot, body, head: new Element("head"), title: "",
  createElement: (t) => new Element(t), createElementNS: (n, t) => new Element(t), createTextNode: (t) => new Text(t), createDocumentFragment: () => new Element("#frag"),
  getElementById: byId, querySelector: (s) => docRoot.querySelector(s), querySelectorAll: (s) => docRoot.querySelectorAll(s), hasFocus: () => true,
  fonts: { ready: Promise.resolve(), add() {}, load: () => Promise.resolve([]), check: () => true, addEventListener() {} }, visibilityState: "visible", hidden: false, readyState: "complete" });
Object.defineProperty(doc, "activeElement", { get: () => activeEl || body });
doc.contains = (n) => docRoot.contains(n);
globalThis.document = doc; globalThis.Node = Node; globalThis.Element = Element; globalThis.HTMLElement = Element; globalThis.Text = Text;
for (const id of ["stage", "toasts"]) { const e = new Element("main"); e.id = id; body.append(e); }
for (const k of ["addEventListener", "removeEventListener", "dispatchEvent"]) globalThis[k] = Target.prototype[k].bind(page);
globalThis.getComputedStyle = () => ({ visibility: "visible", display: "block", getPropertyValue: () => "" });
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {} });
globalThis.location = { search: H.query(), href: "file:///game/engine/play.html", pathname: "/engine/play.html", origin: "file://", hash: "" };
globalThis.history = { replaceState() {}, pushState() {} };
globalThis.navigator = { userAgent: "lowwater-host", language: "en-US", languages: ["en-US"], platform: "Win32", hardwareConcurrency: 4, getGamepads: () => [globalThis.__pad || null], clipboard: null };
globalThis.devicePixelRatio = 1; globalThis.innerWidth = 1920; globalThis.innerHeight = 1080;
globalThis.MutationObserver = class { observe() {} disconnect() {} }; globalThis.ResizeObserver = class { observe() {} disconnect() {} }; globalThis.IntersectionObserver = globalThis.ResizeObserver;
globalThis.Image = class extends Target {
  set src(u) { this._src = u; setTimeout(() => { if (H.exists(u)) { this.naturalWidth = 1; this.onload && this.onload({ type: "load" }); } else this.onerror && this.onerror({ type: "error" }); }, 0); }
  get src() { return this._src; } decode() { return Promise.resolve(); }
};
globalThis.fetch = async (url) => {
  const u = String(url), t = H.readText(u), ok = t !== null;
  return { ok, status: ok ? 200 : 404, url: u, text: async () => t, json: async () => JSON.parse(t),
    arrayBuffer: async () => { throw new Error("fetch.arrayBuffer: not in the host yet"); }, blob: async () => { throw new Error("fetch.blob: not in the host yet"); } };
};
globalThis.__lwFileBridge = { read: (p) => H.bridge("read", p), write: (p, t) => { H.bridge("write", p, t); }, rename: (a, b) => { H.bridge("rename", a, b); }, remove: (p) => { H.bridge("remove", p); }, list: (d) => JSON.parse(H.bridge("list", d)) };
// what the host paints: the screen's text and the focus
const text = (n) => n.textContent.replace(/\s+/g, " ").trim();
globalThis.__lwSnapshot = () => {
  const stage = byId("stage"), cards = body.children.filter((c) => c.className.includes("bootcard"));
  if (cards.length) return JSON.stringify({ screen: "bootcard", text: text(cards[cards.length - 1]) });
  const root = stage.children[stage.children.length - 1]; if (!root) return JSON.stringify({ screen: "none" });
  const f = activeEl, art = root.querySelector(".title-art");
  const bg = art && art.style.backgroundImage ? String(art.style.backgroundImage).replace(/^url\("?|"?\)$/g, "") : "";
  const q = (s) => { const e = root.querySelector(s); return e ? text(e) : ""; };
  return JSON.stringify({ screen: root.className.replace(/\s+/g, " ").trim(), bg, h1: q("h1"), sub: q("p.sub"), hint: q(".hint"),
    buttons: root.querySelectorAll(".f").map((b) => ({ label: text(b), focus: b === f, disabled: b.getAttribute("aria-disabled") === "true" })) });
};
globalThis.__lwKey = (type, key) => { const e = new KeyboardEvent(type, { key, code: key, repeat: false }); dispatchEvent(e); return !e.defaultPrevented; };
globalThis.__lwPad = (p) => { globalThis.__pad = p; };
