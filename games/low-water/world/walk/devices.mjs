// The browser's devices, read into the plain record world/play/input.mjs takes: keys, the mouse
// under pointer lock, the first gamepad, and two touch sticks on a phone (the left half of the
// screen moves, the right half looks). Also the small control for choosing a camera, which works
// by mouse and by touch.
export function makeDevices(canvas, { onKey = () => {} } = {}) {
  const keys = new Set(), pressed = new Set(), mouse = [0, 0], touch = { move: [0, 0], look: [0, 0], ids: {} };
  let wheel = 0, ui = null, padPrev = [], touched = false;
  addEventListener("keydown", (e) => { if (!keys.has(e.code)) pressed.add(e.code); keys.add(e.code); onKey(e); });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => keys.clear());
  canvas.addEventListener("click", () => { if (!touched && canvas.requestPointerLock) canvas.requestPointerLock(); });
  addEventListener("mousemove", (e) => { if (document.pointerLockElement === canvas) { mouse[0] += e.movementX; mouse[1] += e.movementY; } });
  addEventListener("wheel", (e) => { wheel += Math.sign(e.deltaY); }, { passive: true });

  // touch: a stick where the left thumb lands, a drag-to-look under the right
  const R = 60;
  canvas.addEventListener("touchstart", (e) => {
    touched = true;
    for (const t of e.changedTouches) {
      const side = t.clientX < innerWidth / 2 ? "move" : "look";
      if (Object.values(touch.ids).some((v) => v.side === side)) continue;
      touch.ids[t.identifier] = { side, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY };
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener("touchmove", (e) => {
    for (const t of e.changedTouches) {
      const s = touch.ids[t.identifier]; if (!s) continue;
      if (s.side === "look") { touch.look[0] += t.clientX - s.x; touch.look[1] += t.clientY - s.y; }
      s.x = t.clientX; s.y = t.clientY;
      if (s.side === "move") { const dx = s.x - s.x0, dy = s.y - s.y0, l = Math.hypot(dx, dy), k = Math.min(1, l / R) / (l || 1); touch.move = [dx * k, dy * k]; }
    }
    e.preventDefault();
  }, { passive: false });
  const end = (e) => { for (const t of e.changedTouches) { const s = touch.ids[t.identifier]; if (s && s.side === "move") touch.move = [0, 0]; delete touch.ids[t.identifier]; } };
  canvas.addEventListener("touchend", end); canvas.addEventListener("touchcancel", end);

  // the camera control: four marks, the live one inked in
  const bar = document.createElement("nav");
  bar.id = "cams"; bar.setAttribute("aria-label", "Camera");
  const NAMES = { nav: "Fly", follow: "Follow", first: "Eyes", iso: "Plan" };
  for (const [m, label] of Object.entries(NAMES)) {
    const b = document.createElement("button"); b.type = "button"; b.dataset.mode = m; b.textContent = label;
    b.addEventListener("click", (e) => { ui = m; e.stopPropagation(); });
    b.addEventListener("touchstart", (e) => { ui = m; e.stopPropagation(); e.preventDefault(); }, { passive: false });
    bar.appendChild(b);
  }
  document.body.appendChild(bar);
  const showMode = (m) => { for (const b of bar.children) b.setAttribute("aria-pressed", b.dataset.mode === m ? "true" : "false"); };

  function read() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    let pad = null;
    if (pads.length) {
      const g = pads[0], b = g.buttons.map((x) => x.pressed), pp = new Set(b.map((on, i) => (on && !padPrev[i] ? i : -1)).filter((i) => i >= 0));
      padPrev = b; pad = { axes: [...g.axes], buttons: b, pressed: pp };
    }
    const raw = { keys: new Set(keys), pressed: new Set(pressed), mouse: [mouse[0], mouse[1]], wheel, pad, touch: touched ? { move: [...touch.move], look: [...touch.look] } : null, ui };
    pressed.clear(); mouse[0] = mouse[1] = 0; wheel = 0; touch.look = [0, 0]; ui = null;
    return raw;
  }
  return { read, showMode, keys };
}
