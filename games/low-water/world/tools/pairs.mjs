// Pair images: a still of a region beside the saved reference it traces to, on one sheet, so the
// two can be judged together. The list of pairs is a JSON file kept outside the repository,
// because the references are other people's pictures on the author's own disk.
//   node games/low-water/world/tools/pairs.mjs --pairs pairs.json --stills DIR --out DIR
// pairs.json: [{ "still": "03-fog-forest", "ref": "E:/path/to/saved.jpg", "label": "B1.116", "region": "The Fog Forest", "note": "..." }]
import { spawnSync } from "node:child_process";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
if (!opt.pairs || !opt.stills || !opt.out) { console.error("pairs: need --pairs FILE --stills DIR --out DIR"); process.exit(2); }
const root = `${process.env.LOCALAPPDATA}/ms-playwright`, shell = opt.chrome || `${root}/${(await readdir(root)).filter((d) => d.startsWith("chromium_headless_shell-")).sort().at(-1)}/chrome-headless-shell-win64/chrome-headless-shell.exe`;
const pairs = JSON.parse(await readFile(opt.pairs, "utf8")), esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
await mkdir(opt.out, { recursive: true });
for (const p of pairs) {
  const still = pathToFileURL(resolve(opt.stills, `${p.still}.png`)).href, ref = pathToFileURL(resolve(p.ref)).href;
  const html = `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; background: #e9e1cd; color: #1f1a15; font: 15px/1.35 Georgia, serif; width: 1960px; }
    .row { display: flex; gap: 20px; padding: 20px 20px 8px; } figure { margin: 0; flex: 1; }
    img { width: 950px; height: 534px; object-fit: cover; display: block; border: 1px solid #1f1a15; }
    figcaption { padding: 6px 0 0; font-size: 14px; } h1 { font: 600 20px Georgia, serif; letter-spacing: 0.14em; text-transform: uppercase; margin: 0; padding: 16px 20px 0; }
    p { margin: 0; padding: 0 20px 18px; max-width: 1500px; }
  </style><h1>${esc(p.region)}</h1><div class="row">
  <figure><img src="${still}"><figcaption>The island, seed 20261118, still ${esc(p.still)}</figcaption></figure>
  <figure><img src="${ref}"><figcaption>Saved reference ${esc(p.label)}</figcaption></figure></div><p>${esc(p.note || "")}</p>`;
  const page = join(opt.out, `${p.still}.html`), png = join(opt.out, `pair-${p.still}.png`);
  await writeFile(page, html);
  const r = spawnSync(shell, ["--headless", "--disable-gpu", "--allow-file-access-from-files", `--screenshot=${png}`, "--window-size=1960,690", "--hide-scrollbars", pathToFileURL(page).href], { stdio: "ignore" });
  console.log(`${r.status === 0 ? "wrote" : "FAILED"} ${png}`);
}
