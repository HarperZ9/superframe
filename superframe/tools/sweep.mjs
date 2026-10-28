// tools/sweep.mjs: run every technique alone at a small size, write its picture, report time and errors.
//   node tools/sweep.mjs [outDir] [size]
import { registry, techniques } from '../lib/registry.mjs';
import { evaluate } from '../lib/graph.mjs';
import { soloRecipe } from '../lib/autofeed.mjs';
import { writePNG } from '../lib/export.mjs';
const [dir = 'out/sweep', size = '160'] = process.argv.slice(2);
const S = Number(size); let ok = 0; const fails = [];
for (const def of techniques()) {
  for (const optional of [false, true]) {
    if (optional && !Object.values(def.inputs).some(s => s.optional)) continue;
    const r = soloRecipe(def, { size: [S, S], optional });
    try {
      const t0 = performance.now(), e = await evaluate(r, registry);
      const img = e.outputs.image ?? Object.values(e.outputs).find(v => v?.data?.length === v.w * v.h * 4);
      if (img) await writePNG(`${dir}/${def.id}${optional ? '+opt' : ''}.png`, img, { ground: '#000000' });
      console.log(`ok   ${def.id}${optional ? ' +opt' : ''}  ${(performance.now() - t0).toFixed(0)} ms`); ok++;
    } catch (e) { fails.push(def.id); console.log(`FAIL ${def.id}${optional ? ' +opt' : ''}: ${e.message.split('\n')[0]}`); }
  }
}
console.log(`\n${ok} ok, ${fails.length} failed`);
