// Keyboard and gamepad turned into the shell's actions, sent to one handler.
// Actions: up, down, left, right, confirm, back, daybook, tabPrev, tabNext, opt:1..opt:9,
// terms (held: show the sums of checks), and the raw state for a Tide Run: vector() and run().
//   Keyboard: arrows or WASD, Enter or Space, Esc, Tab (Daybook), Q and E (Daybook tabs),
//             1 to 9 (options), Shift held (sums; in a run, hurry).
//   Gamepad:  d-pad or left stick, A confirm, B back, Y Daybook, LB and RB tabs, X held (sums;
//             in a run, hurry), Start back.
const KEYS = {
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
  Enter: "confirm", NumpadEnter: "confirm", Space: "confirm", Escape: "back", Backspace: "back", Tab: "daybook", KeyQ: "tabPrev", KeyE: "tabNext", KeyN: "alt",
};
const PAD = { 0: "confirm", 1: "back", 3: "alt", 8: "daybook", 4: "tabPrev", 5: "tabNext", 9: "back", 12: "up", 13: "down", 14: "left", 15: "right" }; // ux: View opens the Daybook; Y is the page's alt key (Build: density)
const DEAD = 0.35, FIRST = 0.34, REPEAT = 0.13;

export function createInput(handle) {
  const held = new Set();
  let padPrev = [], stickDir = null, stickT = 0, last = performance.now(), termsOn = false, pad = null;

  function setTerms(on) { if (on !== termsOn) { termsOn = on; handle(on ? "terms:on" : "terms:off"); } }

  listenKeys(held, handle, setTerms);

  // Buttons fire on press; the stick repeats like a held key.
  function poll(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    pad = pads[0] || null;
    if (pad) {
      pad.buttons.forEach((b, i) => {
        const down = b.pressed, was = padPrev[i];
        if (down && !was && PAD[i]) handle(PAD[i], { source: "pad" });
        padPrev[i] = down;
      });
      setTerms(!!(pad.buttons[2] && pad.buttons[2].pressed) || held.has("ShiftLeft") || held.has("ShiftRight"));
      stick(dt);
    }
    requestAnimationFrame(poll);
  }

  function stick(dt) {
    const [x, y] = [pad.axes[0] || 0, pad.axes[1] || 0];
    const dir = Math.hypot(x, y) < DEAD ? null : Math.abs(x) > Math.abs(y) ? (x > 0 ? "right" : "left") : y > 0 ? "down" : "up";
    if (dir !== stickDir) { stickDir = dir; stickT = FIRST; if (dir) handle(dir, { source: "stick" }); return; }
    if (!dir) return;
    stickT -= dt;
    if (stickT <= 0) { stickT = REPEAT; handle(dir, { source: "stick", repeat: true }); }
  }
  requestAnimationFrame(poll);

  return {
    held,
    // A movement direction from keys and the stick: x right, z down the screen, length <= 1.
    vector: () => vectorOf(held, pad),
    run: () => held.has("ShiftLeft") || held.has("ShiftRight") || !!(pad && ((pad.buttons[2] && pad.buttons[2].pressed) || (pad.buttons[10] && pad.buttons[10].pressed))), // X held or the left stick pushed
    terms: () => termsOn,
  };
}

function listenKeys(held, handle, setTerms) {
  window.addEventListener("keydown", (e) => {
    held.add(e.code);
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") { setTerms(true); return; }
    const digit = /^(Digit|Numpad)([1-9])$/.exec(e.code);
    const action = digit ? `opt:${digit[2]}` : KEYS[e.code];
    if (!action) return;
    if (handle(action, { repeat: e.repeat, source: "key", code: e.code })) e.preventDefault();
    else if (action === "daybook" || action === "confirm") e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    held.delete(e.code);
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") setTerms(false);
  });
  window.addEventListener("blur", () => { held.clear(); setTerms(false); });
}

// A movement direction from keys, the d-pad and the stick: x right, z down the screen, length <= 1.
function vectorOf(held, pad) {
  let x = 0, z = 0;
  const on = (...codes) => codes.some((c) => held.has(c)), btn = (i) => !!(pad && pad.buttons[i] && pad.buttons[i].pressed);
  if (on("ArrowLeft", "KeyA") || btn(14)) x -= 1;
  if (on("ArrowRight", "KeyD") || btn(15)) x += 1;
  if (on("ArrowUp", "KeyW") || btn(12)) z -= 1;
  if (on("ArrowDown", "KeyS") || btn(13)) z += 1;
  if (pad) { const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0; if (Math.hypot(ax, ay) >= DEAD) { x += ax; z += ay; } }
  const L = Math.hypot(x, z);
  return L > 1 ? { x: x / L, z: z / L } : { x, z };
}
