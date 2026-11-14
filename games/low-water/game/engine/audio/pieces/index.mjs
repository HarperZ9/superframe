// Every piece by id: the slice's music (SCORE.md "Pieces") and the motif sheet.
import dawn from "./dawn.mjs";
import kitchen from "./kitchen.mjs";
import office from "./office.mjs";
import road from "./road.mjs";
import granary from "./granary.mjs";
import coda from "./coda.mjs";
import readback from "./readback.mjs";
import arena from "./arena.mjs";
import motifs from "./motifs.mjs";
import opening from "./opening.mjs";
import suite from "./suite.mjs";
import { square, kitchen as sfxKitchen, office as sfxOffice, post } from "./sfx.mjs";

export const PIECES = { dawn, kitchen, office, road, granary, coda, readback, arena, motifs, opening, suite };
export const SCENES = { "sfx-square": square, "sfx-kitchen": sfxKitchen, "sfx-office": sfxOffice, "sfx-post": post };
export const ALL = { ...PIECES, ...SCENES };
