# Cases for uxshots.py. Each tests one screen with keyboard, mouse and the simulated pad.
P = "/engine/play.html?shot="
LAB = "/engine/uxlab.html?"
G = "window.__shell.G"
CASES = [
  {"name": "title", "url": P + "title", "steps": [("shot", "title-1080"), ("pad", 13), ("shot", "title-pad"),
     ("expect", "document.documentElement.dataset.device === 'pad' && !!document.querySelector('.hint .key.pad')", "pad prompt glyphs after a pad press")]},
  {"name": "world", "url": P + "world", "steps": [("shot", "world-1080"),
     ("expect", "[...document.querySelectorAll('.act .cost')].map(e => e.textContent).join('|')", "Go and Wait rows carry minutes"),
     ("expect", "getComputedStyle(document.querySelector('.hud')).backgroundColor !== 'rgba(0, 0, 0, 0)'", "HUD sits on paper")]},
  {"name": "talk", "url": P + "talk", "steps": [("shot", "talk-1080"),
     ("expect", "getComputedStyle(document.querySelector('aside.talk')).visibility === 'visible'", "talk panel visible while talking")]},
  {"name": "talk-720", "size": (1280, 720), "url": P + "check", "steps": [("shot", "check-720"),
     ("expect", "Math.min(...[...document.querySelectorAll('aside.talk *')].filter(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).map(e => parseFloat(getComputedStyle(e).fontSize)))", "smallest text in the talk panel at 720p (px, floor 12.5)")]},
  {"name": "talk-deck", "size": (1280, 800), "url": P + "check", "steps": [("shot", "check-deck")]},
  {"name": "talk-4k", "size": (3840, 2160), "url": P + "check", "steps": [("shot", "check-4k"),
     ("expect", "parseFloat(getComputedStyle(document.documentElement).fontSize)", "root size at 4K (px; was 22)")]},
  {"name": "check", "url": P + "check", "steps": [("shot", "check-1080"),
     ("expect", "document.querySelectorAll('.tag.chk').length", "checks carry ruled tags"), ("expect", "getComputedStyle(document.querySelector('.tag.chk')).borderTopStyle", "a pencil tag is dashed"),
     ("key", "ArrowDown"), ("key", "ArrowDown"), ("shot", "check-focus2")]},
  {"name": "slide", "url": P + "world&motion", "steps": [
     ("expect", "getComputedStyle(document.querySelector('aside.talk')).visibility", "talk panel hidden in the world"),
     ("key", "Enter"), ("wait", 60), ("shot", "slide-mid"), ("wait", 400), ("shot", "slide-end"),
     ("expect", "getComputedStyle(document.querySelector('aside.talk')).visibility === 'visible'", "Enter on a Here row opens the talk panel by sliding")]},
  {"name": "daybook", "url": P + "daybook-notes", "steps": [("shot", "daybook-1080"), ("key", "KeyE"), ("key", "KeyE"),
     ("expect", "document.querySelector('.tab.on').textContent", "E turns two pages"), ("pad", 4), ("expect", "document.querySelector('.tab.on').textContent", "pad LB turns back one"),
     ("shot", "daybook-margin-1080"), ("key", "Tab"), ("expect", "!document.querySelector('.daybook')", "Tab closes the Daybook")]},
  {"name": "fight", "url": P + "fight&motion", "steps": [("wait", 300), ("shot", "fight-1080"),
     ("expect", "!!document.querySelector('.strip') && !document.querySelector('.fighthud:not([hidden])')?.offsetParent", "the strip replaces the old HUD"),
     ("eval", G + ".emit('fight.bark', { voice: 'eye', text: 'Frost under the left boot.' })"),
     ("eval", G + ".emit('fight.parry', { id: 'lamb', by: 'guard#0' })"), ("wait", 80), ("shot", "fight-parry"),
     ("expect", "document.querySelector('.strip .xline').textContent", "a catch answers in the strip"),
     ("expect", "document.querySelector('.voiceline .vl')?.textContent", "a bark speaks in the voice line"),
     ("eval", G + ".emit('fight.hit', { id: 'lamb', by: 'guard#0', dmg: 1.4 })"), ("wait", 60), ("shot", "fight-hit"),
     ("key", "Escape"), ("wait", 100), ("shot", "fight-pause"), ("expect", G + ".loop.paused === true", "Esc pauses the fight"),
     ("key", "Escape"), ("expect", G + ".loop.paused === false", "Esc resumes"),
     ("pad", 9), ("expect", G + ".loop.paused === true", "pad Start pauses"), ("pad", 1), ("expect", G + ".loop.paused === false", "pad B resumes from pause"),
     ("eval", "window.__seen = []; const I = " + G + ".input, p = I.press.bind(I); I.press = (n) => { window.__seen.push(n); return p(n); };"),
     ("pad", 5), ("pad", 6), ("key", "KeyJ"),
     ("expect", "window.__seen.join(',')", "pad RB light, LT catch, key J light reach the fight"),
     ("eval", G + ".emit('fight.rumble', { id: 'lamb', by: 'guard#0', low: 0.6, high: 0.3, frames: 8 })"),
     ("expect", "(window.__rumbles || []).length", "a blow on Lamb rumbles the pad")]},
  {"name": "settings", "url": P + "settings", "steps": [("shot", "settings-1080"),
     ("eval", "document.querySelectorAll('.row')[document.querySelectorAll('.row').length - 18].focus()"), ("shot", "settings-controls"),
     ("eval", "[...document.querySelectorAll('.row')].find(r => r.textContent.includes('Light strike')).focus()"), ("key", "Enter"), ("wait", 200), ("key", "KeyU"), ("wait", 100),
     ("expect", "JSON.parse(localStorage.getItem('lowwater.bindings') || '{}').key?.light?.[0]", "rebinding light strike to U is saved"),
     ("expect", "[...document.querySelectorAll('.row')].find(r => r.textContent.includes('Light strike')).textContent", "the row shows the new key")]},
  {"name": "build-plain", "url": LAB + "screen=build", "steps": [("shot", "build-plain-1080")]},
  {"name": "build-plan", "url": LAB + "screen=build&numbers=1&plan=grip:2,nose:1", "steps": [("shot", "build-numbers-plan-1080"),
     ("expect", "document.querySelectorAll('.stats td.to').length", "planned changes shown as old to new")]},
  {"name": "build-compare", "url": LAB + "screen=build&numbers=1&compare=boathook", "steps": [("shot", "build-compare-1080")]},
  {"name": "build-keys", "url": LAB + "screen=build&numbers=1", "steps": [
     ("eval", "document.querySelector('[data-plan=\"grip\"]').focus()"), ("key", "ArrowRight"),
     ("expect", "document.querySelector('[data-plan=\"grip\"] .pl').textContent", "Right pencils a rank in"),
     ("pad", 15), ("expect", "document.querySelector('[data-plan=\"grip\"] .pl').textContent", "pad d-pad right pencils another"),
     ("pad", 3), ("expect", "!!document.querySelector('.plainline')", "pad Y switches to the plain page"),
     ("key", "KeyN"), ("expect", "!!document.querySelector('.stats')", "N switches back to every number"),
     ("move", 500, 400), ("shot", "build-keys")]},
  {"name": "build-720", "size": (1280, 720), "url": LAB + "screen=build&numbers=1&plan=grip:1", "steps": [("shot", "build-720")]},
  {"name": "build-deck", "size": (1280, 800), "url": LAB + "screen=build", "steps": [("shot", "build-deck")]},
  {"name": "build-bench", "url": LAB + "screen=build&numbers=1&bench=1", "steps": [("eval", "[...document.querySelectorAll('.bench .mini')][0]?.focus()"), ("shot", "build-bench")]},
]
CASES += [
  {"name": "fightview", "url": "/engine/combat/tools/fightview.html?node=floor.salvors.fight&archetype=p.ledger&pilot=1", "steps": [("wait", 4000), ("shot", "fightview-pilot"),
     ("expect", "!!document.querySelector('.strip')", "combat's harness mounts the new strip"),
     ("expect", "window.__fv.log.map(e => e.name).filter((v, i, a) => a.indexOf(v) === i).join(',')", "fight events seen by the harness")]},
  {"name": "slide-capture", "url": P + "world&motion", "steps": [("key", "Enter")] + [("shot", f"cap-slide-{i:02d}") for i in range(10)]},
]
CASES += [
  {"name": "slide-slowmo", "url": P + "world&motion", "steps": [("eval", "document.documentElement.style.setProperty('--t-in', '2400ms'); document.documentElement.style.setProperty('--t-out', '1600ms')"), ("key", "Enter")] + [("shot", f"slow-slide-{i:02d}") for i in range(6)]},
  {"name": "daybook-slowmo", "url": P + "world&motion", "steps": [("eval", "document.documentElement.style.setProperty('--t-in', '2400ms')"), ("key", "Tab")] + [("shot", f"slow-book-{i:02d}") for i in range(5)]},
]
PICK = "(t) => { const c = window.__shell, b = c.play.P.beat, o = b.options.find((x) => x.label.includes(t)); c.play.choose(o.index, 0); }"
CASES += [
  {"name": "sneak-world", "url": P + "world&motion", "steps": [
     ("eval", f"window.__shell.G.state.runMode = 'full'; window.__shell.play.startTalk('t.r.hub'); ({PICK})('Test sneak.')"), ("wait", 600), ("shot", "sneak-world-1"),
     ("expect", "!!document.querySelector('.sneaklayer .sneakstrip') && !document.querySelector('.runview')", "the sneak plays on the plate, no chart screen"),
     ("down", "KeyC"), ("down", "ArrowRight"), ("wait", 900), ("up", "ArrowRight"), ("shot", "sneak-world-2"),
     ("expect", "document.querySelector('.sneakstrip').textContent", "the strip reads pace, cover, time and watchers"),
     ("up", "KeyC"), ("key", "Escape"), ("expect", G + ".loop.paused === true", "Esc pauses the sneak"), ("shot", "sneak-world-pause"), ("key", "Escape"),
     ("pad", 9), ("expect", G + ".loop.paused === true", "pad Start pauses the sneak"), ("pad", 9),
     ("pad", 1, 400), ("expect", G + ".loop.paused === false", "pad B crouches, never pauses")]},
  {"name": "run-world", "url": P + "world&motion", "steps": [
     ("eval", f"window.__shell.G.state.runMode = 'full'; window.__shell.play.startTalk('t.r.hub'); ({PICK})('Test run.')"), ("wait", 600), ("shot", "run-world-1"),
     ("expect", "!!document.querySelector('.runlayer .runstrip') && !document.querySelector('.runview')", "the Tide Run plays on the plate"),
     ("down", "ArrowRight"), ("wait", 1500), ("up", "ArrowRight"), ("shot", "run-world-2"),
     ("expect", "document.querySelector('.runstrip').textContent", "the strip reads the water in words")]},
  {"name": "sneak-stepped", "url": P + "sneak", "steps": [("expect", "!!document.querySelector('.runview')", "stepped mode keeps the chart view")]},
  {"name": "fight-frame", "url": P + "fight&motion", "steps": [("wait", 1500), ("shot", "fight-frame"),
     ("expect", "(() => { const d = document.querySelector('.dock').getBoundingClientRect(), c = window.__shell.G.ext.combat.current; if (!c) return 'no fight'; return 'strip ' + Math.round(d.right) + 'x' + Math.round(d.top); })()", "strip extent (fighters should sit right of or above it; see the still)")]},
  {"name": "catch-hard", "url": P + "fight&motion", "steps": [("wait", 300),
     ("eval", G + ".loop.paused = true"), ("eval", G + ".emit('fight.parry', { id: 'lamb', by: 'guard#0' })"),
     ("expect", "document.querySelector('.strip').dataset.history.split(' | ').includes('Caught: strike now')", "a catch answers in the strip (loop frozen, read from the strip's own history)"),
     ("expect", "document.querySelector('.strip .xline').textContent === 'Caught: strike now'", "and it is the line on screen")]},
]
CASES += [
  {"name": "create", "url": P + "create", "steps": [("shot", "create-1080"), ("key", "ArrowDown"), ("shot", "create-focus2"),
     ("expect", "document.querySelector('.cfight').textContent", "focusing a card shows it in a fight"),
     ("key", "Enter"), ("expect", "document.activeElement.dataset.begin !== undefined", "choosing a Precedent moves focus to Begin"),
     ("expect", "getComputedStyle(document.querySelector('.create-art')).backgroundImage !== 'none'", "the painted scene sits behind")]},
  {"name": "create-custom", "url": P + "create-custom", "steps": [("shot", "create-custom-1080"), ("expect", "!!document.querySelector('.errs p')", "a short spread shows G.create's errors")]},
  {"name": "create-act1", "url": LAB + "screen=create", "steps": [("shot", "create-act1-1080"), ("pad", 13), ("shot", "create-act1-pad")]},
  {"name": "create-act1-720", "size": (1280, 720), "url": LAB + "screen=create", "steps": [("shot", "create-act1-720")]},
]
CASES += [
  {"name": "inked", "url": P + "world&motion", "steps": [
     ("eval", G + ".emit('trait.done', { id: 't.tide_reader', name: 'Test trait' })"), ("wait", 700), ("shot", "inked-leaf"),
     ("expect", "document.querySelector('.leaf .ltitle')?.textContent", "an inked note opens a leaf"),
     ("key", "Enter"), ("wait", 400), ("expect", "!document.querySelector('.leaf')", "Enter puts it in the book"),
     ("eval", G + ".emit('chapter', { name: 'A chapter page' })"), ("wait", 700), ("shot", "chapter-leaf"), ("pad", 1), ("wait", 400),
     ("expect", "!document.querySelector('.leaf')", "pad B closes the chapter leaf")]},
]
CASES += [
  {"name": "map", "url": P + "world", "steps": [("key", "Tab"), ("eval", "window.__shell.daybook('map')"), ("wait", 300), ("shot", "map-test"),
     ("expect", "document.querySelectorAll('.mapspot').length", "districts drawn as buttons")]},
  {"name": "map-act1", "url": LAB + "screen=map", "steps": [("shot", "map-act1-1080"), ("key", "ArrowRight"), ("shot", "map-act1-focus"),
     ("expect", "document.querySelector('.mapinfo h3')?.textContent", "focus describes a district")]},
  {"name": "wait-turn", "url": P + "world", "steps": [
     ("eval", "window.__t0 = window.__shell.G.clock()"),
     ("expect", "[...document.querySelectorAll('.act')].map(e => e.textContent).find(t => /Wait for/.test(t))", "the tide wait row is offered"),
     ("eval", "[...document.querySelectorAll('.act')].find(e => /Wait for/.test(e.textContent)).click()"), ("wait", 300), ("shot", "wait-turn"),
     ("expect", "window.__shell.G.clock() - window.__t0", "minutes the wait took (stops at a turn, a scene, or 180)")]},
]
CASES += [
  {"name": "portrait", "url": P + "talk", "steps": [("shot", "portrait-noface"),
     ("expect", "document.querySelector('.portrait').classList.contains('noface')", "a speaker with no portrait collapses to the name"),
     ("eval", "window.__shell.play.els.portrait.update({ who: 'fennick', speaker: 'Deacon Fennick', light: 'sodium' })"), ("wait", 1500), ("shot", "portrait-fennick"),
     ("expect", "!!document.querySelector('.portrait .pimg.on') && !document.querySelector('.portrait').classList.contains('noface')", "a baked portrait shows"),
     ("eval", "window.__shell.play.els.portrait.update({ who: 'lamb', speaker: 'Lamb' })"), ("wait", 300),
     ("expect", "document.querySelector('.portrait').classList.contains('noface')", "Lamb never takes the slot")]},
  {"name": "portrait-720", "size": (1280, 720), "url": P + "talk", "steps": [("eval", "window.__shell.play.els.portrait.update({ who: 'fennick', speaker: 'Deacon Fennick', light: 'paraffin' })"), ("wait", 1500), ("shot", "portrait-720")]},
]
POS = "JSON.stringify((window.__shell.G.state.pos || []).map((v) => +v.toFixed(2)))"
FOC = "(document.activeElement && document.activeElement.textContent || '').slice(0, 40)"
CASES += [
  {"name": "keys-walk", "url": P + "world", "steps": [
     ("eval", f"window.__p0 = {POS}; window.__f0 = {FOC}"),
     ("expect", "window.__shell.input.mode()", "the play screen is in walk mode"),
     ("down", "KeyD"), ("wait", 700), ("up", "KeyD"),
     ("expect", f"{POS} !== window.__p0", "D walks Lamb"), ("expect", f"{FOC} === window.__f0", "D leaves the menu focus alone"),
     ("eval", f"window.__p1 = {POS}"), ("key", "ArrowDown"), ("wait", 300),
     ("expect", f"{FOC} !== window.__f0", "Down arrow moves the focus"), ("expect", f"{POS} === window.__p1", "Down arrow does not walk"),
     ("eval", f"window.__f1 = {FOC}; window.__p2 = {POS}"), ("stick", 1, 0, 700),
     ("expect", f"{POS} !== window.__p2", "the left stick walks"), ("expect", f"{FOC} === window.__f1", "the left stick leaves the focus alone"),
     ("eval", f"window.__p3 = {POS}"), ("pad", 12), ("wait", 300),
     ("expect", f"{FOC} !== window.__f1", "the d-pad moves the focus"), ("expect", f"{POS} === window.__p3", "the d-pad does not walk")]},
  {"name": "keys-talk", "url": P + "talk", "steps": [
     ("eval", f"window.__p0 = {POS}; window.__f0 = {FOC}"),
     ("expect", "window.__shell.input.mode()", "talking is menu mode"),
     ("down", "KeyS"), ("wait", 250), ("up", "KeyS"), ("wait", 200),
     ("expect", f"{FOC} !== window.__f0", "S moves the focus through the options"), ("expect", f"{POS} === window.__p0", "S does not walk while talking"),
     ("eval", f"window.__f1 = {FOC}"), ("stick", 0, 1, 250),
     ("expect", f"{FOC} !== window.__f1", "the stick moves the focus while talking")]},
  {"name": "keys-daybook", "url": P + "world", "steps": [
     ("key", "Tab"), ("wait", 300), ("eval", f"window.__p0 = {POS}"),
     ("expect", "window.__shell.input.mode()", "the Daybook is menu mode"),
     ("key", "KeyD"), ("wait", 300), ("expect", f"{POS} === window.__p0", "D does not walk behind the Daybook")]},
]
CASES += [{"name": "keys-scene", "url": P + "world&motion", "steps": [
  ("eval", f"window.__shell.G.state.runMode = 'full'; window.__shell.play.startTalk('t.r.hub'); ({PICK})('Test sneak.')"), ("wait", 500),
  ("expect", "window.__shell.input.mode()", "a real-time sneak is scene mode"),
  ("eval", "window.__x0 = window.__shell.G.sneaks.current.state.x"), ("down", "ArrowRight"), ("wait", 800), ("up", "ArrowRight"),
  ("expect", "window.__shell.G.sneaks.current.state.x !== window.__x0", "arrows move Lamb in a scene"),
  ("eval", "window.__x1 = window.__shell.G.sneaks.current.state.x"), ("down", "KeyD"), ("wait", 800), ("up", "KeyD"),
  ("expect", "window.__shell.G.sneaks.current.state.x !== window.__x1", "WASD moves Lamb in a scene")]}]
