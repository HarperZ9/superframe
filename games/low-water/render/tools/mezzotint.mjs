// Mezzotint mode on a baked plate (render/v2/mezzotint.mjs): node render/tools/mezzotint.mjs --in <plate.png> --out <file> [--gamma 1.9]
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { mezzotint } from "../v2/mezzotint.mjs";
import { rn } from "../rn.mjs";
const { readPng, writePng } = await import(rn("tools/shaders/png.mjs"));
const argv = process.argv.slice(2), opt = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1];
const img = readPng(opt.in); mkdirSync(dirname(opt.out), { recursive: true });
writePng(opt.out, { width: img.width, height: img.height, data: mezzotint(img.data, img.width, img.height, { gamma: +(opt.gamma || 1.9) }) }); console.log("mezzotint:", opt.out);
