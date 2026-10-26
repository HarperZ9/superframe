// lib/mosaic: the one tile and marks library (BLEED section 3, "one tile library"; CORE.md, "Marks"), exported
// through the superframe. Every part loads in node and in a browser.
//   marks       the law family of binary marks: Bayer ordered, Floyd-Steinberg, void-and-cluster blue noise, AM
//               halftone, and the eye (marks.mjs); their readouts (analysis.mjs)
//   glyphs      glyphs as marks: atlases in the face drawn, ramps measured from them or from living type's states,
//               the ASCII field (glyphs.mjs); the code mosaic of real lines from our public repos (codemosaic.mjs)
//   field       a marks field as a medium element with weights and timing, driven by the top view or living type
//   recipes     the site's mark recipes: ordered, ASCII, poster, riso, duotone, fax noise, glyph stamps, hue poster,
//               xerox tiles (recipes.mjs)
//   tiles       the mosaics merged here: the name mosaic (andamento, smalti, echo, code, scales) and its text field,
//               from name-art; the top view's digit tesserae (digits.mjs); the medium's tesserae additive
//               (lib/medium/tesserae.mjs, which lives with the water it rides); the recut grid
//               (playbook/mosaic.js, re-exported in place, one copy)
export * from './marks.mjs';
export * from './analysis.mjs';
export * from './glyphs.mjs';
export * from './codemosaic.mjs';
export * from './field.mjs';
export * from './recipes.mjs';
export * from './digits.mjs';
export { mosaic as nameMosaic, STYLES as NAME_STYLES, layTiles, shade, codeInk, imageInk, engineSource, loadEngineSource } from './tiles/index.mjs';
export { textField } from './tiles/textfield.mjs';
export { tesserae as tesseraeAdditive, PALETTE as TILE_PALETTE } from '../medium/tesserae.mjs';
export * as recut from '../../../playbook/mosaic.js';
