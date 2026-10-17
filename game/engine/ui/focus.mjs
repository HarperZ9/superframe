// One focus model for keyboard, mouse and gamepad. Screens and panels push layers; the top layer
// owns the focus. Every focusable control carries the class "f". Arrow keys, the d-pad and the
// left stick move the focus to the nearest control in that direction; Enter, Space and A press
// it; Esc and B go back. The mouse moves the same focus when it passes over a control.
//   const F = createFocus();
//   F.push({ name, root, onAction(action) -> true if handled, onBack() });   F.pop();
export function createFocus() {
  const layers = [];
  const top = () => layers[layers.length - 1] || null;
  const visible = (el) => el.offsetParent !== null && !el.closest("[hidden]");
  const items = () => (top() ? [...top().root.querySelectorAll(".f")].filter(visible) : []);
  const current = () => { const a = document.activeElement; return a && a.classList && a.classList.contains("f") && top() && top().root.contains(a) ? a : null; };

  function focus(el, { scroll = true } = {}) {
    if (!el) return false;
    el.focus({ preventScroll: !scroll });
    if (scroll) el.scrollIntoView({ block: "nearest", inline: "nearest" });
    return true;
  }

  const api = {
    layers, top, items, current, focus,
    push(layer) {
      const prev = top(); if (prev) prev.lastFocus = current();
      layers.push(layer);
      requestAnimationFrame(() => api.first(layer));
      return layer;
    },
    pop(layer = top()) {
      const i = layers.indexOf(layer); if (i < 0) return;
      layers.splice(i, 1);
      if (layer.onClose) layer.onClose();
      const t = top();
      if (t) requestAnimationFrame(() => {
        if (api.current()) return;
        if (t.lastFocus && t.root.contains(t.lastFocus)) focus(t.lastFocus, { scroll: false }); else api.first(t);
      });
    },
    // Focus a layer's preferred control (data-first), else its first control.
    first(layer = top()) {
      if (layer !== top() || api.current()) return;
      const pref = layer.root.querySelector(".f[data-first]");
      focus(pref && visible(pref) ? pref : items()[0], { scroll: false });
    },
    move(dir) {
      const c = current();
      if (!c) return focus(items()[0]);
      return focus(nearest(items(), c, dir));
    },
    confirm() { const c = current(); if (c) { c.click(); return true; } return false; },
  };

  installHover(api);
  return api;
}

// The nearest control in a direction, scored by distance along it plus twice the drift across.
function nearest(list, from, dir) {
  const a = from.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bestScore = Infinity;
  for (const el of list) {
    if (el === from) continue;
    const b = el.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const along = dir === "up" ? a.top - b.bottom : dir === "down" ? b.top - a.bottom : dir === "left" ? a.left - b.right : b.left - a.right;
    const ahead = dir === "up" ? by < ay - 1 : dir === "down" ? by > ay + 1 : dir === "left" ? bx < ax - 1 : bx > ax + 1;
    if (!ahead) continue;
    const across = dir === "up" || dir === "down" ? Math.abs(bx - ax) : Math.abs(by - ay);
    const score = Math.max(0, along) + 2 * across;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  return best;
}

// The mouse moves the focus over controls of the top layer; the ring follows the focus.
function installHover(api) {
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest && e.target.closest(".f"), t = api.top();
    if (el && el !== document.activeElement && t && t.root.contains(el)) el.focus({ preventScroll: true });
  });
  document.addEventListener("focusin", (e) => {
    document.querySelectorAll(".is-focus").forEach((x) => x.classList.remove("is-focus"));
    if (e.target.classList && e.target.classList.contains("f")) e.target.classList.add("is-focus");
  });
}
