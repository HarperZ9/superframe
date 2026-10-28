// presets.mjs: period presets. Each one names what is hardware fact, what is authored, and the viewing distance
// it is judged at (pixels per degree, from a stated display size and distance: the geometry is computed, the
// display and the distance are authored). `axis: 'lightness'` marks a one-axis codebook, judged on L* alone. Facts marked "memory" are from memory at moderate confidence.
import * as CB from './codebook.mjs';
import { ordered, diffuse, ps1, bayer } from './dither.mjs';
import { halftone, duotone } from './print.mjs';
import { twoInk } from './twoink.mjs';
import { ppdFrom } from './eye.mjs';

const DMG = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];   // the commonly cited DMG greens; authored, not measured
const crtTV = ppdFrom({ pitch: 406 / 320, dist: 2500 });     // 20 inch 4:3 TV, 320 px across, 2.5 m (authored)
const monitor17 = ppdFrom({ pitch: 320 / 640, dist: 600 });  // 17 inch monitor, 640 px across, 60 cm (authored)
const dmgLCD = ppdFrom({ pitch: 47 / 160, dist: 300 });      // 47 mm LCD, 160 px across, 30 cm (authored)
const mac = ppdFrom({ pitch: 25.4 / 72, dist: 500 });        // 72 dpi CRT, 50 cm (authored)
const NEWS = 8 * 23;                                          // 85 lpi at 40 cm is about 23 cycles per degree; 8 px cell

export const PRESETS = [
  { id: 'ps1-15bit', title: 'PS1 15-bit, dithered', scale: 'pixel', ppd: crtTV,
    fact: 'RGB555 framebuffer; GPU adds a 4x4 offset table before truncating to 5 bits (memory)', authored: 'viewing distance',
    run: img => ps1(img, { dither: true }) },
  { id: 'banding-15bit', title: 'Early 3D, 15-bit, no dither', scale: 'pixel', ppd: crtTV,
    fact: 'RGB555 truncation', authored: 'dither switched off to show the banding of the period',
    run: img => ps1(img, { dither: false }) },
  { id: 'rgb565-bayer', title: '16-bit, 4x4 Bayer', scale: 'pixel', ppd: monitor17,
    fact: 'RGB565 codebook', authored: 'Bayer 4x4 on code values, as 16-bit 3D cards of the late 1990s are described (memory)',
    run: img => ordered(img, CB.bits([5, 6, 5]), { matrix: bayer(4), space: 'srgb' }) },
  { id: 'ega64-fs', title: '64 colours, error diffusion', scale: 'pixel', ppd: 60,
    fact: 'the 64-colour 2-bit-per-channel gamut (codes 0, 85, 170, 255)', authored: 'Floyd-Steinberg in linear light, serpentine',
    run: img => diffuse(img, CB.levels(4)) },
  { id: 'posterize-64', title: '64 colours, nearest (control)', scale: 'pixel', ppd: 60,
    fact: 'same codebook', authored: 'no dither: the control that must band',
    run: img => CB.nearest(img, CB.levels(4)) },
  { id: 'dmg-bayer', axis: 'lightness', title: 'Handheld 4 greens, Bayer', scale: 'pixel', ppd: dmgLCD,
    fact: 'four shades', authored: 'the green hex values and the ordered dither (period games dithered by hand)',
    run: img => ordered(img, CB.list(DMG, { label: 'DMG greens', ramp: true }), { matrix: bayer(4) }) },
  { id: 'mac-atkinson', axis: 'lightness', title: '1-bit, Atkinson', scale: 'pixel', ppd: mac,
    fact: 'Atkinson kernel, 6/8 of the error diffused', authored: 'linear light',
    run: img => diffuse(img, CB.list(['#000000', '#ffffff'], { label: '1-bit' }), { kernel: 'atkinson' }) },
  { id: 'newsprint', axis: 'lightness', title: 'Newsprint halftone, 45 deg', scale: 'print', ppd: NEWS,
    fact: 'area-true round-dot screen; Murray-Davies tone', authored: 'ink, paper and 8 px cell',
    run: img => halftone(img, { cell: 8, angle: 45 }) },
  { id: 'duotone', axis: 'lightness', title: 'Duotone map', scale: 'print', ppd: 60,
    fact: 'one axis in linear RGB', authored: 'the two inks (navy, buff)',
    run: img => duotone(img) },
  { id: 'two-ink', title: 'Two-ink overprint, 15/75 deg', scale: 'print', ppd: NEWS,
    fact: 'overlap = paper x T1 x T2; Neugebauer-Demichel mean', authored: 'cyan and warm red inks, angles, cell',
    run: img => twoInk(img, { cell: 8 }) },
];

export const preset = id => { const p = PRESETS.find(q => q.id === id); if (!p) throw new Error(`quantize: no preset ${id}`); return p; };
