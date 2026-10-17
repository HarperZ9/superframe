// Low Water, the Lamp Quay hour: the playable prototype. Runs on raw-native's web game runtime
// (web/game: the fixed-step loop, input actions) and its environment hub (web/env), over places
// baked by the engine's passes. Content (plates, the script) is loaded from the private content
// folders through the local server (serve.mjs).
import { createFixedLoop } from "/rn/web/game/loop.mjs";
import { createActionMap } from "/rn/web/game/input.mjs";
import { attachWebInput } from "/rn/web/game/input_web.mjs";
import { isoCamera, project } from "/rn/web/shaders/paintover/camera.mjs";
import * as LensSettings from "/rn/web/shaders/lens/settings.mjs";
import { loadLwd } from "./lwd.mjs";
import { createNight, clockText } from "./night.mjs";
import { findPath, passable, regionOf, HOTSPOTS, EXITS, ROOMS, ROOM_HOTSPOTS, ROOM_OF } from "./world.mjs";
import { createLook, drawRain, drawBeam, LAMPS } from "./look.mjs";
import { drawPerson } from "./figures.mjs";
import { createPeople } from "/characters/runtime/prototype.mjs";
import { loadPlace, lensWeights, mixPlate } from "./places.mjs";
import { drawTalk, drawClock, drawCard, drawPrompt, drawDaybook, drawEnd, FONT, wrap } from "./ui.mjs";

const q = new URLSearchParams(location.search), CAPTURE = q.has("capture");
// The gameplay camera (design/CAMERA.md, director 2026-10-17): 2.25x on the quay, 1.75x in rooms,
// scrolling in whole plate pixels, sliding left a third while talking. ?wide shows the whole plate.
const ZOOM = { quay: 2.25, room: 1.75 }, WIDE = q.has("wide"), OLD_FIGURES = q.has("cutouts");
const canvas = document.getElementById("c"), g = canvas.getContext("2d"), W = 1280, H = 720;
const status = (s) => { document.getElementById("status").textContent = s; };
const SETTINGS_KEY = "lowwater.lens";
function loadSettings() { try { return LensSettings.resolveLensSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); } catch (e) { console.warn("lens settings: using defaults:", e.message); return LensSettings.resolveLensSettings({}); } }
function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { console.warn("lens settings: not saved:", e.message); } }

async function boot() {
  status("loading Gullet");
  await Promise.all([new FontFace("LW Hanken", "url(fonts/hanken-grotesk.woff2)").load(), new FontFace("LW Conso", "url(fonts/conso-regular.woff2)").load(), new FontFace("LW Hanken", "url(fonts/hanken-grotesk-italic.woff2)", { style: "italic" }).load()].map((p) => p.then((f) => document.fonts.add(f))));
  const ctx = { isoCamera, project };
  const [quay, brine, weigh, lamp, script, night, people] = await Promise.all([loadPlace("quay", ctx), loadPlace("brine", ctx), loadPlace("weigh", ctx), loadPlace("lamp", ctx), fetch("/slice/lamp_quay_2300.lwd").then((r) => r.text()), createNight(), OLD_FIGURES ? null : createPeople()]);
  return game({ places: { quay, brine, weigh, lamp }, book: loadLwd(script), night, people });
}

// lights the water mirrors on the quay: the sodium lamps, the walkers' lanterns, the Brine's portholes
const QUAY_LIGHTS = [
  ...LAMPS.map((p) => ({ pos: p, sodium: true, k: 0.55, w: 5, c: [1, 0.58, 0.18] })),
  ...[[-5.05, -2.25, 6.75], [-3.2, -2.15, 9.0], [2.1, -2.3, 7.6], [4.8, -2.2, 10.3], [-9.2, -2.1, 9.5]].map((p) => ({ pos: p, k: 0.35, w: 3, c: [1, 0.78, 0.45] })),
  { pos: [-11.9, -2.4, 11.1], k: 0.3, w: 3, c: [1, 0.8, 0.5] },
];

function game({ places, book, night, people }) {
  const notes = new Set(), fired = new Set(), toasts = [];
  let settings = loadSettings();
  const S = {
    mode: "title", menu: 0, t: 0, room: "quay", place: "quay", talk: null, talkTitle: "", shown: 0, sel: 0, daybook: false, card: null, ended: null,
    fade: 0, fadeTarget: 0, arc: 0, boxes: [], walkedM: 0, midnight: false, wennaWith: false, goal: null,
    player: { pos: [-1.2, 0, -2.6], path: null, walking: false, face: 1 },
    cam: { x0: 0, y0: 0, zoom: 1, fx: null, fy: null },
  };
  const NPC = {
    quay: () => [
      { who: "keel", pos: [-2.2, 0, -0.9], face: 1 },
      night.clock < 23 * 60 + 47 ? { who: "fennick", pos: [-2.9, -2.3, 2.9], face: -1 } : null,
      night.clock < 23 * 60 + 40 ? { who: "merrow", pos: [-11.4, -3.2, 10.9], face: 1 } : null,
    ],
    brine: () => [{ who: "sabine", pos: [0.6, 0, -2.25], face: 1 }, S.wennaWith ? null : { who: "wenna", pos: [-3.4, 0, 0.35], face: 1 }, night.clock >= 23 * 60 + 45 ? { who: "merrow", pos: [4.2, 0, 0.0], face: -1 } : null],
    weigh: () => [{ who: "marrow", pos: [2.5, 0, -3.6], face: -1 }],
    lamp: () => [S.wennaWith ? { who: "wenna", pos: [-1.9, 0, 1.6], face: 1 } : null],
  };

  // ---------------------------------------------------------------- looks
  const looks = {}, base = {};
  function buildLooks() {
    const w = lensWeights(LensSettings, settings);
    for (const [name, P] of Object.entries(places)) for (const v of Object.keys(P.variants)) P.mixed[v] = mixPlate(P.variants[v], w);
    const Q = places.quay;
    looks.night = createLook({ W, H, night: Q.mixed.night, dark: Q.dark, world: Q.world, lights: QUAY_LIGHTS });
    looks.dark = createLook({ W, H, night: Q.mixed.night, dark: Q.dark, world: Q.world, lights: QUAY_LIGHTS });
    for (const k of ["night", "dark"]) base[k] = new OffscreenCanvas(W, H);
    for (const [name, P] of Object.entries(places)) if (name !== "quay") for (const v of Object.keys(P.mixed)) { const c = new OffscreenCanvas(W, H); c.getContext("2d").putImageData(vignette(P.mixed[v]), 0, 0); base[`${name}.${v}`] = c; }
    refreshLooks(true);
  }
  function vignette(img) { const o = new ImageData(new Uint8ClampedArray(img.data), W, H), d = o.data; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = x / W - 0.5, v = y / H - 0.5, k = 1 - 0.55 * Math.pow(Math.min(1, (u * u + v * v) * 2.4), 1.5), i = (y * W + x) * 4; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; } return o; }
  let lastKey = "";
  const lookState = (fade) => ({ fade, fog: night.fog(), waterY: night.waterY(), wet: Math.min(1, night.snap.zones.quay.wetness * 1.5 + (night.rain() > 0.5 ? 0.4 : 0)), clock: night.clock });
  function refreshLooks(full) {
    const key = `${Math.floor(night.clock * 2)}|${night.power}`, rows = full ? H : 90, darkWanted = S.fadeTarget > 0 || S.fade > 0;
    if (key !== lastKey) { lastKey = key; S.dirtyN = true; S.dirtyD = true; }
    if (S.dirtyN || looks.night.row || full) { if (looks.night.update(lookState(0), rows)) { base.night.getContext("2d").putImageData(looks.night.out, 0, 0); S.dirtyN = false; } }
    if ((darkWanted || full) && (S.dirtyD || looks.dark.row || full)) { if (looks.dark.update(lookState(1), rows)) { base.dark.getContext("2d").putImageData(looks.dark.out, 0, 0); S.dirtyD = false; } }
  }

  // ---------------------------------------------------------------- the script's world
  const lwdPlace = () => S.place;
  const here = () => book.places[lwdPlace()] || { light: 0.5, sodium: 0.5, dark: 0.1, zone: "quay" };
  const W0 = {
    notes, get clock() { return night.clock; }, get place() { return S.place; },
    set place(p) { S.place = p; const r = ROOM_OF[p] || "quay"; if (r !== S.room) switchRoom(r); },
    spend: (m) => advance(m),
    visit: (id) => { if (id === "mole.walk.wenna") S.wennaWith = true; },
    term: (name) => {
      const P = here(), off = night.power === "off" && P.zone === "quay";
      switch (name) {
        case "tide": return night.tide(); case "fog": return night.fog(); case "rain": return night.rain();
        case "wind.dir": return night.clock < 23 * 60 + 35 ? 270 : 225; case "wind.speed": return night.snap.wind.speed;
        case "light": return lwdPlace() === "lamproom" && night.mother === "burning" ? 0.9 : off ? P.dark : P.light;
        case "sodium": return off ? 0 : P.sodium; case "power.quay": return night.power; case "mother": return night.mother;
        case "chits": return notes.has("chits.refused") ? 0 : 10; case "paraffin": return 2; case "wet": return night.wet;
        default: return 0;
      }
    },
    noted: (id) => { if (book.facts[id] && book.facts[id].about && !/^(met|arrived|walked|key|blackout|mother|damp|chits|gorm|keel\.rattled|crake|merrow\.trust|wenna\.confessed|floor\.closed)/.test(id)) toasts.push({ who: "DAYBOOK", text: book.facts[id].about, t: 6 }); },
  };
  function onCmd([c, a, b]) {
    if (c === "setPower" && a === "quay") { night.power = b; S.fadeTarget = b === "off" ? 1 : 0; }
    if (c === "restrike") night.mother = "burning";
    if (c === "wet") night.wet = Math.min(1, night.wet + +b);
  }
  function advance(min) {
    if (!S.midnight) min = Math.min(min, Math.max(0, 24 * 60 - night.clock));
    night.advance(min);
    for (const e of book.events) if (!fired.has(e.id) && night.clock >= e.at) {
      fired.add(e.id);
      for (const { key, value } of e.kv) {
        if (key === "set") notes.add(value);
        if (key === "nar") toasts.push({ who: "", text: value, t: 9 });
        if (key === "inst") { const k = value.indexOf(": "); toasts.push({ who: value.slice(0, k), text: value.slice(k + 2), t: 8 }); }
      }
    }
  }
  function switchRoom(r) {
    const from = S.room; S.room = r; S.player.path = null; S.goal = null;
    if (r === "quay") S.player.pos = [...ROOMS[from].quayDoor]; else S.player.pos = [...ROOMS[r].spawn];
  }
  function startTalk(node, title) {
    S.talk = book.start(node, W0, { exits: EXITS, onCmd, onEnd: (id) => { if (!EXITS.has(id)) S.ended = id; else if (S.midnight) S.ended = "wait"; else if (id === "hub" && S.room !== "quay") S.leaveRoom = true; } });
    S.talkTitle = title; S.shown = 1; S.sel = 0; S.player.path = null;
  }
  function choose(i) {
    if (!S.talk || !S.talk.beat.options) return;
    const o = S.talk.beat.options[i]; if (!o) return;
    S.talk.choose(i); S.shown = 1; S.sel = 0;
    S.talk.beat.lines.unshift({ kind: "line", who: "LAMB", text: o.label.replace(/^"|"$/g, "") });
  }
  function closeTalk() {
    S.talk = null;
    if (S.leaveRoom) { S.leaveRoom = false; S.place = "quay"; switchRoom("quay"); }
    if (S.room === "quay") S.place = regionOf(places.quay.world, S.player.pos[0], S.player.pos[2]);
  }

  // ---------------------------------------------------------------- input
  const map = createActionMap({
    moveX: { type: "axis", bind: ["key:KeyD", "-key:KeyA", "key:ArrowRight", "-key:ArrowLeft", "pad.axis:0"] },
    moveY: { type: "axis", bind: ["key:KeyS", "-key:KeyW", "key:ArrowDown", "-key:ArrowUp", "pad.axis:1"] },
    use: { type: "button", bind: ["key:KeyE", "key:Space", "key:Enter", "pad.button:0"] },
    click: { type: "button", bind: ["pointer:0"] },
    book: { type: "button", bind: ["key:Tab", "key:KeyN", "pad.button:3"] },
    back: { type: "button", bind: ["key:Escape", "pad.button:1"] },
    almanac: { type: "button", bind: ["key:KeyT"] }, glass: { type: "button", bind: ["key:KeyG"] }, vane: { type: "button", bind: ["key:KeyV"] },
    candlemas: { type: "button", bind: ["key:KeyC"] }, damp: { type: "button", bind: ["key:KeyH"] },
    ...Object.fromEntries(Array.from({ length: 9 }, (_, k) => [`o${k + 1}`, { type: "button", bind: [`key:Digit${k + 1}`] }])),
  });
  const devices = CAPTURE ? null : attachWebInput(canvas, { design: [W, H] });
  let fakeIn = CAPTURE ? emptyDev() : null;

  const world = () => places[S.room].world;
  const hotspots = () => (S.room === "quay" ? HOTSPOTS : ROOM_HOTSPOTS[S.room]).filter((h) => !(h.once && notes.has(h.once)) && (!h.when || h.when(night.clock)));
  function nearHotspot() {
    let best = null;
    for (const h of hotspots()) { const d = Math.hypot(S.player.pos[0] - h.at[0], S.player.pos[2] - h.at[2]) + Math.abs(S.player.pos[1] - h.at[1]) * 0.5; if (d < h.r && (!best || d < best.d)) best = { h, d }; }
    return best && best.h;
  }
  function useHotspot(h) {
    if (h.leave) { S.place = "quay"; switchRoom("quay"); S.place = regionOf(places.quay.world, S.player.pos[0], S.player.pos[2]); return; }
    if (h.id === "mother") notes.add("walked.mole.tonight");
    startTalk(h.node(notes), h.label);
  }
  const rules = () => ({ waterY: S.room === "quay" ? night.waterY() : -99, floorClosed: notes.has("floor.closed"), gullyDeep: night.tide() >= -0.35 });
  function walkTo(target) { const p = findPath(world(), S.player.pos, target, rules()); if (p) { S.player.path = p.slice(1); return true; } return false; }
  function instrument(name) {
    const h = night.tide(), rising = night.tide(night.clock + 5) > h, P = S.player.pos, onQuay = S.room === "quay";
    let sod = 0; if (night.power === "on" && onQuay) for (const L of LAMPS) sod += 26 / ((L[0] - P[0]) ** 2 + (L[1] - P[1]) ** 2 + (L[2] - P[2]) ** 2);
    const frac = Math.round((100 * sod) / (sod + 0.02)), dir = night.clock < 23 * 60 + 35 ? "west" : "south-west";
    const lines = {
      almanac: ["THE ALMANAC", `${h >= 0 ? "Plus" : "Minus"} ${Math.abs(h).toFixed(2)} metres, and ${rising ? "rising" : "falling"}. The gully is ${h < -0.35 ? "open" : "closed, unless you like swimming"}. ${notes.has("floor.closed") ? "The floor belongs to the sea again." : "The floor is the floor until about twelve minutes to midnight."} The moon, as ever, is responsible.`],
      glass: ["THE GLASS", night.clock < 23 * 60 + 35 ? `Falling, darling. ${night.clock < 23 * 60 + 20 ? "Fog first, off the Flats, then rain by twenty-five to twelve." : "Rain within the quarter hour."} And someone in this town is about to say something they can't take back.` : "Raining. I did say. Everyone always says I did say."],
      vane: ["THE VANE", onQuay ? `${dir.toUpperCase()}! ${night.snap.wind.speed.toFixed(0)} metres a second! Everything said here goes ${dir === "west" ? "east" : "north-east"}. Mind your mouth on the windward side.` : "Indoors! Nothing! I hate indoors!"],
      candlemas: ["CANDLEMAS", !onQuay ? (S.room === "lamp" && night.mother === "burning" ? "The arc. White, nearly. And green, wherever the bottle glass is. Honest light, dishonest lens." : "Paraffin. Honest light at last. Ask me the colour of anything.") : night.power === "off" ? "Dark. Two parts in a hundred, and none of them mine. You are invisible, and so is the edge of the quay." : frac > 55 ? `Sodium, ${frac} parts in a hundred. I see one colour and I will not call it a colour. Take it to a fire.` : `Mixed light. Sodium ${frac} in a hundred; the rest is honest. Colours, of a sort.`],
      damp: ["THE DAMP", notes.has("damp.saturated") ? "Saturated. I'm no use until a fire has had me." : night.wet > 0.5 ? "You're wet through. So am I, in sympathy." : night.wet > 0.2 ? "Your left side is wet. The mole, I expect. Everyone's left side is wet tonight, except one." : "Dry, nearly. Enjoy it."],
    };
    S.card = { who: lines[name][0], text: lines[name][1], t: 7 };
  }

  // ---------------------------------------------------------------- title and settings
  const TITLE_ITEMS = ["Begin the night", "Settings", "How to play"];
  const SET_ROWS = ["preset", "flare", "streaks", "halation", "fringing", "flashSafe", "back"];
  function settingsStep(inp) {
    const n = SET_ROWS.length, ay = navAxis(inp);
    if (ay) S.menu = (S.menu + ay + n) % n;
    const row = SET_ROWS[S.menu], ax = navAxis(inp, "moveX"), sch = LensSettings.LENS_SETTINGS_SCHEMA[row];
    let changed = false;
    if (row === "preset" && (ax || inp.pressed.use)) { const names = Object.keys(LensSettings.LENS_SETTINGS_PRESETS), cur = S.preset ?? 0, k = (cur + (ax || 1) + names.length) % names.length; S.preset = k; settings = LensSettings.resolveLensSettings(names[k]); changed = true; }
    else if (sch && sch.type === "number" && ax) { settings = LensSettings.resolveLensSettings({ ...settings, [row]: Math.min(sch.max, Math.max(sch.min, Math.round((settings[row] + ax * 0.25) * 100) / 100)) }); changed = true; }
    else if (sch && sch.type === "boolean" && (ax || inp.pressed.use)) { settings = LensSettings.resolveLensSettings({ ...settings, [row]: !settings[row] }); changed = true; }
    else if (row === "back" && inp.pressed.use) { S.mode = "title"; S.menu = 1; }
    if (inp.pressed.back) { S.mode = "title"; S.menu = 1; }
    if (changed) { saveSettings(settings); buildLooks(); }
  }
  function navAxis(inp, axis = "moveY") {
    const a = inp.axes[axis] || 0; S.navCool = (S.navCool || 0) - 1 / 60;
    if (Math.abs(a) > 0.5 && S.navCool <= 0) { S.navCool = 0.2; return a > 0 ? 1 : -1; }
    return 0;
  }
  function begin() { S.mode = "play"; startTalk("arrive", "Lamp Quay, Low Night"); }

  // ---------------------------------------------------------------- simulation
  function step(dt) {
    if (fakeIn && fakeIn.held) for (const k of fakeIn.held) fakeIn.keys.add(k);
    const dev = CAPTURE ? fakeIn : devices.poll(), inp = map.sample(dev);
    if (devices) devices.consume();
    if (fakeIn) { fakeIn.keys.clear(); fakeIn.taps.clear(); if (fakeIn.pointer) fakeIn.pointer.taps.clear(); }
    S.t += dt;
    if (S.mode === "title") {
      const ay = navAxis(inp); if (ay) S.menu = (S.menu + ay + TITLE_ITEMS.length) % TITLE_ITEMS.length;
      if (inp.pressed.use) { if (S.menu === 0) begin(); else if (S.menu === 1) { S.mode = "settings"; S.menu = 0; } else S.mode = "help"; }
      return;
    }
    if (S.mode === "settings") { settingsStep(inp); return; }
    if (S.mode === "help") { if (inp.pressed.use || inp.pressed.back) S.mode = "title"; return; }
    for (const k of toasts) k.t -= dt; while (toasts.length && toasts[0].t <= 0) toasts.shift();
    if (S.card) { S.card.t -= dt; if (S.card.t <= 0) S.card = null; }
    S.fade += Math.sign(S.fadeTarget - S.fade) * Math.min(Math.abs(S.fadeTarget - S.fade), dt / 1.4);
    S.arc += Math.sign((night.mother === "burning" ? 1 : 0) - S.arc) * Math.min(Math.abs((night.mother === "burning" ? 1 : 0) - S.arc), dt / 0.8);
    if (inp.pressed.book) S.daybook = !S.daybook;
    if (S.daybook) { if (inp.pressed.back) S.daybook = false; return; }
    for (const n of ["almanac", "glass", "vane", "candlemas", "damp"]) if (inp.pressed[n]) instrument(n);
    if (S.talk) {
      const beat = S.talk.beat, more = S.shown < beat.lines.length;
      const pickOpt = [...Array(9)].findIndex((_, k) => inp.pressed[`o${k + 1}`]);
      if (inp.pressed.click && inp.pointer) { const b = S.boxes.find((b) => inp.pointer[0] >= b.rect[0] && inp.pointer[0] <= b.rect[0] + b.rect[2] && inp.pointer[1] >= b.rect[1] && inp.pointer[1] <= b.rect[1] + b.rect[3]); if (b && !more) { choose(b.i); return; } if (more) { S.shown = beat.lines.length; return; } }
      if (more) { if (inp.pressed.use) S.shown = Math.min(beat.lines.length, S.shown + 1); return; }
      if (beat.options && beat.options.length) {
        if (pickOpt >= 0 && pickOpt < beat.options.length) { choose(pickOpt); return; }
        const ay = navAxis(inp); if (ay) S.sel = (S.sel + ay + beat.options.length) % beat.options.length;
        if (inp.pressed.use) choose(S.sel);
      } else if (inp.pressed.use || inp.pressed.back || inp.pressed.click) closeTalk();
      return;
    }
    if (S.ended) { if (inp.pressed.use || inp.pressed.click) { if (CAPTURE) S.endAck = true; else location.reload(); } return; }
    if (night.clock >= 24 * 60 && !S.midnight) { S.midnight = true; if (S.room !== "quay") { S.place = "quay"; switchRoom("quay"); } startTalk("midnight", "The weigh-house, midnight"); return; }
    const Wd = world(), ax = inp.axes.moveX || 0, ay = inp.axes.moveY || 0, P = S.player;
    let moved = 0;
    if (Math.abs(ax) + Math.abs(ay) > 0.2) {
      P.path = null; const R = Wd.camera.right, F = [Wd.camera.fwd[0], 0, Wd.camera.fwd[2]], fl = Math.hypot(F[0], F[2]);
      const vx = R[0] * ax - (F[0] / fl) * ay, vz = R[2] * ax - (F[2] / fl) * ay, vl = Math.hypot(vx, vz) || 1, sp = 2.6 * dt;
      const nx = P.pos[0] + (vx / vl) * sp, nz = P.pos[2] + (vz / vl) * sp, [gx, gz] = Wd.cellOf(nx, nz), c = passable(Wd, gx, gz, rules()), h = Wd.groundAt(nx, nz);
      if (c && Math.abs(h - P.pos[1]) < 0.6) { P.pos = [nx, h, nz]; moved = sp; P.face = vx * R[0] + vz * R[2] >= 0 ? 1 : -1; }
    } else if (inp.pressed.click && inp.pointer) {
      const V = S.cam, hit = Wd.at(Math.floor(V.x0 + inp.pointer[0] / V.zoom), Math.floor(V.y0 + inp.pointer[1] / V.zoom));
      if (hit) { const hs = hotspots().find((h) => Math.hypot(hit.P[0] - h.at[0], hit.P[2] - h.at[2]) < h.r * 1.2); walkTo(hs ? hs.at : hit.P); S.goal = hs || null; }
    }
    if (P.path && P.path.length) {
      const [tx, tz] = P.path[0], dx = tx - P.pos[0], dz = tz - P.pos[2], d = Math.hypot(dx, dz), sp = 2.6 * dt;
      if (d <= sp) { P.path.shift(); P.pos = [tx, Wd.groundAt(tx, tz), tz]; moved = d; } else { const nx = P.pos[0] + (dx / d) * sp, nz = P.pos[2] + (dz / d) * sp; P.pos = [nx, Wd.groundAt(nx, nz), nz]; moved = sp; }
      P.face = dx * Wd.camera.right[0] + dz * Wd.camera.right[2] >= 0 ? 1 : -1;
      if (Wd.inGully(P.pos[0], P.pos[2]) && P.pos[1] < -3) { night.wet = Math.min(1, night.wet + dt * 0.05); if (night.tide() >= -0.35) notes.add("damp.saturated"); }
      if (!P.path.length) { P.path = null; if (S.goal) { const hs = S.goal; S.goal = null; useHotspot(hs); return; } }
    }
    P.walking = moved > 0;
    if (moved) { S.walkedM += moved; if (S.walkedM >= 6) { advance(Math.floor(S.walkedM / 6)); S.walkedM %= 6; } if (S.room === "quay") S.place = regionOf(Wd, P.pos[0], P.pos[2]); }
    if (S.room === "quay" && P.pos[0] > 13.5) night.wet = Math.min(1, night.wet + dt * 0.02);
    if (inp.pressed.use) { const h = nearHotspot(); if (h) useHotspot(h); }
  }

  // ---------------------------------------------------------------- drawing
  const scratch = new OffscreenCanvas(8, 8);
  const talkPartner = () => { const P = S.player.pos, o = NPC[S.room]().filter(Boolean).map((f) => ({ f, d: Math.hypot(f.pos[0] - P[0], f.pos[2] - P[2]) })).sort((a, b) => a.d - b.d)[0]; return o && o.d < (S.room === "quay" ? 5 : 9) ? o.f : null; };
  // the camera's window on the plate: eased toward Lamb, the talk slide, clamped, snapped to plate pixels
  function updateCam(dt) {
    const C = S.cam, zoom = WIDE || S.mode !== "play" ? 1 : S.room === "quay" ? ZOOM.quay : ZOOM.room;
    // while talking, frame Lamb and the nearest other person together (the talk slide keeps both left of the panel)
    let F = S.player.pos; const o = S.talk ? talkPartner() : null;
    if (o) F = [(F[0] + o.pos[0]) / 2, (F[1] + o.pos[1]) / 2, (F[2] + o.pos[2]) / 2];
    const [px, py] = project(world().camera, W, H, [F[0], F[1] + 1, F[2]]);
    const k = C.fx == null ? 1 : Math.min(1, dt * 4); C.zoom += (zoom - C.zoom) * k;
    const tx = px - (S.talk ? W / 3 : W / 2) / C.zoom, ty = py - (H * 0.52) / C.zoom;
    C.fx = C.fx == null ? tx : C.fx + (tx - C.fx) * k; C.fy = C.fy == null ? ty : C.fy + (ty - C.fy) * k;
    C.x0 = Math.round(Math.max(0, Math.min(W - W / C.zoom, C.fx))); C.y0 = Math.round(Math.max(0, Math.min(H - H / C.zoom, C.fy)));
  }
  const toScreen = ([x, y]) => [(x - S.cam.x0) * S.cam.zoom, (y - S.cam.y0) * S.cam.zoom];
  function drawPlace() {
    g.globalAlpha = 1; const C = S.cam; g.save(); g.setTransform(C.zoom, 0, 0, C.zoom, -C.x0 * C.zoom, -C.y0 * C.zoom); g.imageSmoothingEnabled = true;
    if (S.room === "quay") { g.drawImage(base.night, 0, 0); if (S.fade > 0) { g.globalAlpha = S.fade; g.drawImage(base.dark, 0, 0); g.globalAlpha = 1; } if (night.mother === "burning") drawBeam(g, places.quay.world, W, H, { t: S.t, fog: night.fog(), fade: S.fade }); }
    else if (S.room === "lamp") { g.drawImage(base["lamp.dark"], 0, 0); if (S.arc > 0) { g.globalAlpha = S.arc; g.drawImage(base["lamp.lit"], 0, 0); g.globalAlpha = 1; } }
    else g.drawImage(base[`${S.room}.night`], 0, 0);
    g.restore();
  }
  function lightOn(pos) {
    if (S.room !== "quay") return { light: 0.85, sodium: 0, side: 1 };
    let sod = 0, side = 0; if (night.power === "on") for (const L of LAMPS) { const k = 26 / ((L[0] - pos[0]) ** 2 + (L[1] - pos[1]) ** 2 + (L[2] - pos[2]) ** 2); sod += k; side += k * Math.sign((L[0] - pos[0]) * places.quay.world.camera.right[0] + (L[2] - pos[2]) * places.quay.world.camera.right[2]); }
    const light = Math.min(1, 0.22 + sod * 2.4) * (1 - S.fade * 0.75);
    return { light, sodium: S.fade > 0.5 ? 0 : 1, side: side >= 0 ? 1 : -1 };
  }
  const figures = () => [{ who: "lamb", ...S.player }, ...NPC[S.room]().filter(Boolean)];
  function drawPeople() {
    const Wd = world(), figs = figures(), C = S.cam;
    figs.sort((a, b) => project(Wd.camera, W, H, b.pos)[2] - project(Wd.camera, W, H, a.pos)[2]);
    // the cutouts (characters not built yet, or ?cutouts) draw in plate pixels under the camera transform
    const cutout = (f) => { g.save(); g.setTransform(C.zoom, 0, 0, C.zoom, -C.x0 * C.zoom, -C.y0 * C.zoom); const r = drawPerson(g, scratch, f, { world: Wd, W, H, t: S.t, ...lightOn(f.pos) }); g.restore(); return r; };
    if (!people) { for (const f of figs) cutout(f); return; }
    people.draw(g, scratch, figs, { room: S.room, world: Wd, W, H, cam: places[S.room].info.camera, view: C, fallback: cutout, fade: S.room === "quay" ? S.fade : 0 });
  }
  function draw() {
    if (S.mode !== "play") return drawMenus();
    drawPlace(); drawPeople();
    if (S.room === "quay") drawRain(g, W, H, { rate: night.rain(), wind: 1, t: S.t, fade: S.fade });
    const tide = night.tide();
    drawClock(g, clockText(night.clock), `tide ${tide >= 0 ? "+" : "−"}${Math.abs(tide).toFixed(2)} m   ${night.rain() > 0.5 ? "rain" : night.fog() > 0.03 ? "fog" : "clear"}${night.power === "off" ? "   quay dark" : ""}`);
    if (!S.talk && !S.ended) { const h = nearHotspot(); if (h) { const [x, y] = toScreen(project(world().camera, W, H, [S.player.pos[0], S.player.pos[1] + 2.2, S.player.pos[2]])); drawPrompt(g, x, y - 10, h.label); } }
    if (S.talk) { const beat = { lines: S.talk.beat.lines.slice(0, S.shown), options: S.shown >= S.talk.beat.lines.length ? S.talk.beat.options : null }; S.boxes = drawTalk(g, W, H, beat, { sel: S.sel, title: S.midnight ? S.talkTitle : (book.places[S.place]?.name || S.talkTitle) }); }
    const toast = toasts[0]; if (!S.talk && toast) drawCard(g, W, H, toast.who || "THE NIGHT", toast.text, Math.min(1, toast.t));
    if (S.card) drawCard(g, W, H, S.card.who, S.card.text, Math.min(1, S.card.t));
    if (S.daybook) drawDaybook(g, W, H, { notes, facts: book.facts, clock: clockText(night.clock), tide });
    if (S.ended && !S.talk) drawEnd(g, W, H, ENDS[S.ended]?.[0] || "Midnight", (ENDS[S.ended]?.[1] || "") + "  Press SPACE.");
  }
  function drawMenus() {
    g.drawImage(base.night, 0, 0); g.fillStyle = "rgba(6,4,9,0.55)"; g.fillRect(0, 0, W, H);
    const cx = 120;
    g.fillStyle = "rgba(240,232,214,0.96)"; g.font = `600 84px ${FONT.body}`; g.fillText("LOW WATER", cx, 230);
    g.font = `italic 20px ${FONT.body}`; g.fillStyle = "rgba(240,232,214,0.75)"; g.fillText("A night-shift thriller in a tidal town. Lamp Quay, 23:00 to midnight.", cx, 270);
    if (S.mode === "title") TITLE_ITEMS.forEach((t, k) => { g.font = `${k === S.menu ? 600 : 400} 26px ${FONT.body}`; g.fillStyle = k === S.menu ? "#f0c58a" : "rgba(240,232,214,0.85)"; g.fillText((k === S.menu ? "→ " : "   ") + t, cx, 370 + k * 46); });
    if (S.mode === "help") {
      g.font = `18px ${FONT.body}`; g.fillStyle = "rgba(240,232,214,0.9)";
      ["Click a place, or walk with WASD, the arrows or a stick.", "E or SPACE to talk, to read on and to choose. 1 to 9 answer at once.", "TAB opens the Daybook: what Lamb has noticed.", "The instruments: T the Almanac (tide), G the Glass (weather), V the Vane (wind), C Candlemas (light), H the Damp (wet).", "The night moves when Lamb does. The tide does not wait.", "", "SPACE to go back."].forEach((t, k) => g.fillText(t, cx, 360 + k * 32));
    }
    if (S.mode === "settings") {
      const sch = LensSettings.LENS_SETTINGS_SCHEMA, names = Object.keys(LensSettings.LENS_SETTINGS_PRESETS);
      g.font = `12px ${FONT.mono}`; g.fillStyle = "rgba(240,232,214,0.6)"; g.fillText("SETTINGS   LENS", cx, 330);
      SET_ROWS.forEach((r, k) => {
        const y = 372 + k * 40, on = k === S.menu; g.font = `${on ? 600 : 400} 21px ${FONT.body}`; g.fillStyle = on ? "#f0c58a" : "rgba(240,232,214,0.88)";
        const label = r === "preset" ? "Preset" : r === "back" ? "Back" : sch[r].label; g.fillText((on ? "→ " : "   ") + label, cx, y);
        let val = ""; if (r === "preset") val = names[S.preset ?? 0]; else if (r !== "back") val = sch[r].type === "boolean" ? (settings[r] ? "on" : "off") : settings[r].toFixed(2);
        g.font = `18px ${FONT.mono}`; g.fillText(val, cx + 420, y);
        if (r !== "back" && r !== "preset" && sch[r].type === "number") { g.fillStyle = "rgba(240,232,214,0.25)"; g.fillRect(cx + 520, y - 8, 200, 4); g.fillStyle = on ? "#f0c58a" : "rgba(240,232,214,0.8)"; g.fillRect(cx + 520, y - 8, (200 * settings[r]) / sch[r].max, 4); }
      });
      const row = SET_ROWS[S.menu], help = row === "preset" ? "Default, reduced flash (the accessibility preset), or off." : row === "back" ? "" : sch[row].help;
      g.font = `italic 17px ${FONT.body}`; g.fillStyle = "rgba(240,232,214,0.7)"; g.fillText(help, cx, 372 + SET_ROWS.length * 40 + 20);
      g.font = `12px ${FONT.mono}`; g.fillText("UP DOWN choose   LEFT RIGHT change   ESC back", cx, H - 18);
    }
  }
  const ENDS = {
    wreckers: ["Malice, by wreckers", "The Board will have its lens. The salvor will have the Board. Out on the floor, under the water, a lantern goes out."],
    guild: ["The Guild's switch", "The singing in the weigh-house runs down like a clock nobody wound. The strike will be fined into the mud."],
    trust: ["The Trust, and the Board's clock", "The telephone in the harbour office rings and rings. The harbourmaster stands in the doorway and drips."],
    keeper: ["The keeper, and the glass", "Sabine wipes the slate clean, every column, and pours two drinks, and charges for neither."],
    wait: ["Cause to follow at dawn", "The Shelf suspends the chits. The night goes on without the assessor's money, and with the assessor."],
  };

  // ---------------------------------------------------------------- run
  buildLooks();
  const loop = createFixedLoop({ hz: 60 });
  const api = {
    S, night, notes, places, startTalk, choose, walkTo, closeTalk, instrument, begin,
    get talking() { return !!S.talk; },
    get optionsShown() { return !!(S.talk && S.shown >= S.talk.beat.lines.length && S.talk.beat.options); },
    get walking() { return !!S.player.path; },
    reveal() { if (S.talk) S.shown = Math.min(S.talk.beat.lines.length, S.shown + 1); },
    chooseLabel(sub) { const i = S.talk.beat.options.findIndex((o) => o.label.toLowerCase().includes(sub.toLowerCase())); if (i < 0) throw new Error(`no option "${sub}": ${S.talk.beat.options.map((o) => o.label).join(" | ")}`); S.sel = i; choose(i); },
    goTo(id) { const h = hotspots().find((x) => x.id === id); if (!h) throw new Error(`no hotspot ${id} in ${S.room}`); if (!walkTo(h.at)) throw new Error(`no path to ${id} in ${S.room}`); S.goal = h; },
    skip(min) { advance(min); },
    setSettings(s) { settings = LensSettings.resolveLensSettings(s); buildLooks(); },
    tick(dt) { loop.advance(dt, (_, h) => step(h)); if (S.mode === "play") { refreshLooks(false); updateCam(dt); if (people) people.step(dt, figures(), { talking: !!S.talk, speaker: S.talk ? talkPartner()?.who : null }); } draw(); },
    press(code) { fakeIn.keys.add(code); fakeIn.taps.add(code); },
    tap(x, y) { fakeIn.pointer = { x, y, buttons: new Set(), taps: new Set([0]) }; },
    hold(code, on) { fakeIn.held ||= new Set(); if (on) fakeIn.held.add(code); else fakeIn.held.delete(code); },
  };
  window.__lw = api;
  status("");
  if (!CAPTURE) { let last = performance.now(); const frame = (now) => { api.tick(Math.min(0.1, (now - last) / 1000)); last = now; requestAnimationFrame(frame); }; requestAnimationFrame(frame); }
  else draw();
}
function emptyDev() { return { keys: new Set(), taps: new Set(), padButtons: [], padAxes: [], pointer: null, wheel: 0 }; }
boot().catch((e) => { status("could not start: " + e.message); console.error(e); });
void wrap;
