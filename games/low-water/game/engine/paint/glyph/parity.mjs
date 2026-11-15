// Style parity (design/art/STYLE-PARITY.md): every feature of the game with its painted form and its glyph
// form, each a module and an export the check can find, and a status. A side is null only where the table
// says it is missing, with the reason. The checks (paint/tests/parity.test.mjs, each with a control):
//   checkFeatures(root, list)            each side's module exists and exports what the entry names
//   checkDoc(text, list)                 every entry is in STYLE-PARITY.md
//   checkPanels(paintedSelectors, glyphPanels, exempt)   every painted panel selector is drawn in the grid
//   checkPlates(dirs)                    a plate the painted style can show (a variant picture) has the glyph
//                                        style's inputs (geo buffers), and the other way round
// Original code. Pure: no DOM.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// [id, feature, painted [file, export] | null, glyph [file, export] | null, status, note]
export const FEATURES = [
  ["lens-wide", "Wide lens: the district plate from the bell tower", ["ui/platecam.mjs", "plateCam"], ["paint/glyph/cells.mjs", "sceneCells"], "both", "one camera; glyph reads the plate's geo buffers"],
  ["lens-narrow", "Narrow lens: a household interior at the close camera", ["world/lens.mjs", "installLens"], ["paint/glyph/cells.mjs", "sceneCells"], "both", "the lens is a mechanic shared by both styles"],
  ["inkblot", "Ink-blot transition between lenses and places, and fainting", ["paint/inkblot.mjs", "inkBlots"], ["paint/glyph/blot.mjs", "drawBlot"], "both", "glyph reads the blot's mask only"],
  ["crowd", "Crowd tier in the wide lens", ["../../characters/runtime/crowd.mjs", "makeCrowd"], ["paint/glyph/crowd.mjs", "drawCrowd"], "both", "wired in the bench only, in both styles; glyph near people are material cards (glyph/matcard.mjs)"],
  ["figures", "People: posed figures lit by the scene", ["ui/peoplelayer.mjs", "peopleLayer"], ["paint/glyph/figures.mjs", "drawFigures"], "both", ""],
  ["faces-play", "Faces at play size", ["../../characters/render/figure.mjs", "gbuffer"], ["paint/glyph/face.mjs", "faceCells"], "both", "glyph: a face block where the head spans 3 x 2 cells"],
  ["figure-light", "Key, fill and rim on characters", ["paint/rim.mjs", null], ["paint/glyph/figlight.mjs", "screenLights"], "both", "glyph reads the light model's rig when it is ready"],
  ["contact-shadow", "Contact shadows", ["ui/peoplelayer.mjs", "peopleLayer"], ["paint/glyph/figcover.mjs", "contactShadow"], "both", ""],
  ["fight-body-tells", "Fight tells on the body (swing, throw, grab)", ["paint/decals.mjs", "installDecals"], ["paint/glyph/figures.mjs", "drawFigures"], "both", ""],
  ["arena-tells", "Arena ground telegraphs (sweep, slam, pounce, shout, grab)", ["ui/fightways.mjs", "drawTells"], ["paint/glyph/tells.mjs", "drawArenaTells"], "both", ""],
  ["ways-out", "A fight's ways out", ["ui/fightways.mjs", "drawWays"], ["paint/glyph/marks.mjs", "drawMarks"], "both", "on plates with an arena; arena-less preview plates show neither outline in glyph"],
  ["hud", "The HUD (clock, weather, place)", ["ui/hudtab.mjs", "hudTab"], ["paint/glyph/ui.mjs", "drawUi"], "both", ""],
  ["daybook", "The Daybook", ["ui/daybook.mjs", "openDaybook"], ["paint/glyph/ui.mjs", "drawUi"], "partial", "glyph sets its text; the riso map's drawing is not yet set in type"],
  ["dialogue", "The dialogue box", ["ui/talk.mjs", "renderOptions"], ["paint/glyph/ui.mjs", "drawUi"], "both", ""],
  ["portraits", "Dialogue portraits per speaker and mood", ["ui/portrait.mjs", "portraitSlot"], ["paint/glyph/portrait.mjs", "portraitCells"], "partial", "glyph baked for the Quota cast; Low Water's cast not yet; painted panel reads the Low Water index for the slice"],
  ["readback", "The read-back as a typed document", ["ui/talk.mjs", "lineEl"], ["paint/glyph/uiextra.mjs", "drawExtras"], "both", "the UI art lead's typed record (ui/typed.mjs) in both styles where a story opts in; glyph's plain typed sheet otherwise"],
  ["dream", "The dream look", ["paint/dream.mjs", "installDream"], ["paint/glyph/compose.mjs", "makeComposer"], "both", ""],
  ["decay", "Decay (letters drop out, lighter steps, smudged rows)", null, ["paint/glyph/compose.mjs", "makeComposer"], "glyph only", "painted decay is the plates' per-state variants (painted lead)"],
  ["era-palette", "A base palette per era", null, ["paint/glyph/eras.mjs", "eraLook"], "glyph only", "painted grade per era belongs to the light lead's model"],
  ["snow", "Snow and frost on the ground (era 2)", ["ui/platecam.mjs", "plateCam"], ["paint/glyph/compose.mjs", "makeComposer"], "both", "painted: in the plate; glyph: snow's language on up-facing outdoor cells"],
  ["water", "Water and reflections", ["ui/weatherlayer.mjs", "weatherLayer"], ["paint/glyph/water.mjs", "reflect"], "both", ""],
  ["smoke", "Smoke and steam", ["paint/smoke.mjs", "smokeField"], ["paint/glyph/smoke.mjs", "makeSmoke"], "both", ""],
  ["rain", "Rain", ["ui/weatherlayer.mjs", "weatherLayer"], ["paint/glyph/effects.mjs", "makeEffects"], "both", ""],
  ["props-eras", "Props that change across eras", ["ui/platecam.mjs", "plateCam"], ["paint/glyph/cells.mjs", "sceneCells"], "both", "a variant plate per era; glyph reads its geo buffers, so it follows"],
  ["arena-mode", "The arena mode page", ["combat/arena/main.mjs", null], null, "painted only", "the arena page has its own placeholder figures and no glyph renderer yet"],
  ["style-switch", "Switching style mid-scene (F7)", ["paint/renderer.mjs", "createRenderers"], ["paint/renderer.mjs", "createRenderers"], "both", "tested: paint/glyph/tools/switch.mjs"],
];
// painted panel selectors the glyph grid does not draw as a panel, with why
export const PANEL_EXEMPT = { ".pause": "the pause sheet is a .sheet inside .pause (drawn as .sheet)", ".topbar": "its buttons are .btn and .key (drawn)", ".daybook": "its pages are .dbook and .leaf (drawn)", ".screen.play .here": "a .sheet", ".fightlayer .dock": "the dock holds .strip and .sheet (drawn)", ".fightstrip": "no element carries this class; the fight strip is a .strip (drawn)" };

const hasExport = (text, name) => new RegExp(`export\\s+(async\\s+)?(function|const|let|class)\\s+${name}\\b|export\\s*\\{[^}]*\\b${name}\\b`).test(text);
export function checkFeatures(root, list = FEATURES) {
  const bad = [];
  for (const [id, , painted, glyph, status] of list) {
    if (!painted && !/glyph only/.test(status)) bad.push(`${id}: no painted form but status "${status}"`);
    if (!glyph && !/painted only/.test(status)) bad.push(`${id}: no glyph form but status "${status}"`);
    for (const [side, ref] of [["painted", painted], ["glyph", glyph]]) {
      if (!ref) continue; const f = join(root, ref[0]);
      if (!existsSync(f)) { bad.push(`${id}: ${side} module ${ref[0]} is missing`); continue; }
      if (ref[1] && !hasExport(readFileSync(f, "utf8"), ref[1])) bad.push(`${id}: ${side} module ${ref[0]} has no export ${ref[1]}`);
    }
  }
  return bad;
}
export const checkDoc = (text, list = FEATURES) => list.filter(([id]) => !text.includes(`\`${id}\``)).map(([id]) => `${id}: not in STYLE-PARITY.md`);
// a selector is drawn when the glyph panel list holds one of its last compound's classes
export function checkPanels(painted, glyphPanels, exempt = PANEL_EXEMPT) {
  const glyph = new Set(glyphPanels.split(",").map((s) => s.trim().replace(/^\./, "")));
  return painted.filter((sel) => !exempt[sel]).filter((sel) => { const last = sel.trim().split(/\s+/).pop(); return !last.split(".").slice(1).some((c) => glyph.has(c)); }).map((sel) => `panel ${sel}: drawn in the painted style, not in the glyph grid`);
}
// plates: a painted variant picture without geo buffers (glyph cannot draw it), or geo buffers with no picture
export function checkPlates(dirs) {
  const bad = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const p of readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const files = readdirSync(join(dir, p.name)); if (!files.includes("place.json")) continue;
      const pics = files.filter((f) => /^[a-z0-9_]+\.png$/.test(f) && !/^dark\.png$/.test(f)), geo = files.includes("geo-pos.f32") && files.includes("geo-id.u8");
      if (pics.length && !geo) bad.push(`plate ${p.name}: painted (${pics.length} variants) but no geo buffers for glyph`);
      if (!pics.length && geo) bad.push(`plate ${p.name}: geo buffers but no painted variant`);
    }
  }
  return bad;
}
