/* transducers/adapter: the one place this package touches its neighbours. Field, perceive, measured data,
   materials, the circuit simulator and the kernels registry are bound here and nowhere else, so moving them
   changes this file only. In a page the same names come from globals set by the build (window.Field and
   window.TRANSDUCERS_DATA). In Node the root is TRANSDUCERS_ROOT, or the sibling packages folder, and both the
   workshop folder and the migrated monorepo use the same subpaths below that root. */
(function (g) {
  "use strict";
  const T = (g.Transducers = g.Transducers || {});
  const inNode = typeof require === "function" && typeof process !== "undefined" && !g.document;
  const path = inNode ? require("path") : null, fs = inNode ? require("fs") : null;
  const root = () => process.env.TRANSDUCERS_ROOT || path.join(__dirname, "..", "..");
  const SUBPATH = {
    field: "field/src/index.js", sim: "diagram/sim/load.js", perceive: "perceive/src/index.js",
    kodak5219: "measured/data/kodak_5219.json", schott: "measured/data/schott_glass.json",
    codata: "measured/data/codata2022.json", p22: "measured/data/p22_kuhn2002.json",
    materials: "materials/data/materials.json", kernels: "kernels/kernels.json",
  };
  class Unbound extends Error { constructor(m) { super(m); this.name = "Unbound"; } }
  T.Unbound = Unbound;

  /* Tables the measured package holds out of the public tree (measured/data/PRIVATE.json). They are read where its
     loader reads them: the folder named by MEASURED_PRIVATE, else measured/data/private/, else the public folder. */
  const PRIVATE = { kodak5219: 1, schott: 1 };
  const places = (k) => {
    const pub = path.join(root(), SUBPATH[k]);
    if (!PRIVATE[k]) return [pub];
    const name = path.basename(pub), env = process.env.MEASURED_PRIVATE;
    return [env ? path.join(env, name) : path.join(path.dirname(pub), "private", name), pub];
  };
  const file = (k) => {
    const p = places(k).find((x) => fs.existsSync(x));
    if (!p) throw new Unbound(PRIVATE[k] ? `${k} is a private measured table and is not bound; set MEASURED_PRIVATE` : `${k} not found at ${SUBPATH[k]} under the root; set TRANSDUCERS_ROOT`);
    return p;
  };
  const cache = {};
  const json = (k) => {
    if (cache[k]) return cache[k];
    if (g.TRANSDUCERS_DATA && g.TRANSDUCERS_DATA[k]) return (cache[k] = g.TRANSDUCERS_DATA[k]);
    if (!inNode) throw new Unbound(k + " is not in this page's data");
    return (cache[k] = JSON.parse(fs.readFileSync(file(k), "utf8")));
  };
  T.Field = () => (g.Field && g.Field.apply ? g.Field : require(file("field")));
  T.Perceive = () => { T.Field(); return g.Perceive; };
  T.sim = () => require(file("sim")).S;
  T.data = json;
  T.hasData = (k) => { try { json(k); return true; } catch (e) { if (e instanceof Unbound) return false; throw e; } };
  T.rootPath = (rel) => path.join(root(), rel);
  T.hasPath = (rel) => inNode && fs.existsSync(path.join(root(), rel));

  /* Measured records, read and never copied. Each returns its provenance with it. */
  const prov = (d) => ({ status: d.provenance.status || "measured", source: d.provenance.source, citation: d.provenance.citation });
  T.glass = (name) => {
    const d = json("schott"), r = d.rows.find((x) => x.glass === name);
    if (!r) throw new Unbound("no glass " + name);
    return Object.assign({}, r, { prov: prov(d) });
  };
  T.codata = (q) => {
    const d = json("codata"), r = d.rows.find((x) => x.quantity === q);
    if (!r) throw new Unbound("no CODATA row " + q);
    return { value: r.value, status: r.exact ? "defined" : "measured", source: "CODATA 2022", name: q };
  };
  /* n and k of a material at a wavelength, by linear interpolation on the record's grid. */
  T.nk = (id, nm) => {
    const d = json("materials"), m = d.materials.find((x) => x.id === id);
    if (!m) throw new Unbound("no material " + id);
    const G = d.grid_nm, x = (nm - G[0]) / (G[1] - G[0]), i = Math.min(G.length - 2, Math.max(0, Math.floor(x))), u = x - i;
    const at = (a) => a[i] * (1 - u) + a[i + 1] * u;
    return { n: at(m.optics.n.value), k: m.optics.k ? at(m.optics.k.value) : 0, source: m.optics.n.source };
  };
  T.cmf = () => { if (g.TRANSDUCERS_DATA && g.TRANSDUCERS_DATA.cmf) return g.TRANSDUCERS_DATA.cmf; T.Field(); return g.Perceive.CMF; };
  T.filmCurves = () => { const d = json("kodak5219"); return { curves: d.sensitometry.curves, dyes: d.dye_density.dyes, granularity: d.granularity, prov: prov(d) }; };
  T.p22 = () => { const d = json("p22"); return { model: d.model, prov: { status: "measured", source: "p22_kuhn2002" } }; };

  /* The kernels contract, as a row of its registry. The registry is read for collisions; a transducer maps onto
     its spec, reference and planted slots, and it has no GPU path unless a row says so. */
  T.kernelsRegistry = () => json("kernels");
  T.toKernelsRow = (k) => ({ name: k.id, spec: { group: k.group, axes: k.axes, from: k.from, to: k.to, claims: k.claims },
    reference: "cpu-js", gpu: k.gpu || null, equivalence: k.gpu ? "bit-identical" : "none, cpu reference only" });
  /* The BuildLang line breaker, read only. Null when the path is not set. */
  T.typesetPath = () => (inNode && process.env.TRANSDUCERS_TYPESET) || null;
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(globalThis);
