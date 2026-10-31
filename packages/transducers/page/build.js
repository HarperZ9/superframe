/* Build the one-file page. Field and perceive come through the adapter's root, the kit through TRANSDUCERS_KIT. The measured rows the
   demos use are inlined, so the built page is an internal artifact until the data's terms are settled (RECONCILE.md);
   it goes to TRANSDUCERS_OUT, never into this repo.   node page/build.js */
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const T = require("../src/index.js");
const here = __dirname, src = path.join(here, "..", "src"), out = process.env.TRANSDUCERS_OUT;
if (!out) throw new Error("set TRANSDUCERS_OUT");
const root = (rel) => fs.readFileSync(T.rootPath(rel), "utf8");
const FIELD = ["units", "field", "ledger", "grade", "transducer", "ops", "converters"].map((f) => root(`field/src/${f}.js`));
const PERCEIVE = ["signal", "loss", "cmf"].map((f) => root(`perceive/src/${f}.js`));
const mine = T.FILES.map((f) => fs.readFileSync(path.join(src, f + ".js"), "utf8"));
const pick = () => {
  const s = T.data("schott"), m = T.data("materials"), k = T.data("kodak5219");
  return { schott: { provenance: s.provenance, rows: s.rows.filter((r) => r.glass === "N-BK7") }, materials: { grid_nm: m.grid_nm, materials: m.materials.filter((x) => x.id === "aluminium").map((x) => ({ id: x.id, optics: { n: { value: x.optics.n.value, source: x.optics.n.source }, k: x.optics.k } })) }, codata: { rows: T.data("codata").rows.filter((r) => r.quantity === "Boltzmann constant") } };
};
const scripts = [read("shim.js")].concat(PERCEIVE, FIELD, [`globalThis.TRANSDUCERS_DATA = ${JSON.stringify(pick())};`], mine, [read("view.js"), read("chainview.js"), read("axes.js"), read("app.js")]);
function read(f) { return fs.readFileSync(path.join(here, f), "utf8"); }
const tag = scripts.map((s) => `<script>\n${s.replace(/<\/script/gi, "<\\/script")}\n</script>`).join("\n");
const html = read("template.html").replace("<!-- transducers:scripts -->", () => tag), page = path.join(out, "transducers.html");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(page, html);
if (process.env.TRANSDUCERS_KIT) cp.execFileSync("python", ["-B", path.join(process.env.TRANSDUCERS_KIT, "inline.py"), page], { stdio: "inherit" });
console.log("built", page, Math.round(fs.statSync(page).size / 1024) + " KB");
