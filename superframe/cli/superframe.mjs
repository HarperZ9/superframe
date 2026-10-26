#!/usr/bin/env node
// superframe: the command line. Every command is also a JSON tool (superframe tools), so a person and an agent drive
// the same nodes with the same parameters.
//
//   superframe list [--json]                    every node, its ports and lane
//   superframe show <node>                      one node: ports, parameters with ranges and units, cost
//   superframe try <node> [out-base] [--size N] run one node alone, fed by default sources
//   superframe render <recipe.json> [out-base]  evaluate a recipe and export every output (png, wav, svg, mid, stl)
//   superframe export <recipe.json> <out-base>  same as render, at the recipe's size or --size N
//        --for eye,ear,reader,screenreader,agent  also render for each named recipient
//   superframe explore --n 240 [--seed s]       sample, render, score, gate and rank; writes a run folder and channels
//   superframe rerank <run-dir>                 re-rank a run after the scorer or ranking changed (no rendering)
//   superframe room [--port 8742]                the assistive room on 127.0.0.1 (local only)
//   superframe gallery <run-dir> [--port 8731]  serve a run's gallery; keep and kill steer later runs
//   superframe verdict <run-dir> <id> keep|kill record a verdict without the gallery
//   superframe channels                         the saved channels (named recipes found by the explorer)
//   superframe docs                             regenerate docs/NODES.md
//   superframe tools                            the tool surface as JSON schemas (for agents)
//   superframe call <tool> '<json args>'        call one tool with JSON args; prints JSON
//   superframe make "<intent>" [out-dir]        describe an artifact in words; render paint, type, lines, material,
//        --seed s --size 3840x2160                sound, touch and the study from one seeded recipe (lib/artifact)
//   superframe artifact <recipe.json> [out-dir]  render an artifact recipe; any of these recombine it first:
//        --seed s --isomer permute|mirror --metamer <id> --route <id>:<medium>:<weight> --edit <path>=<json>
import { readFileSync, readdirSync, existsSync, createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname, resolve } from 'node:path';
import { registry, techniques } from '../lib/registry.mjs';
import { evaluate } from '../lib/graph.mjs';
import { exportAll, exportRecipients } from '../lib/export.mjs';
import { soloRecipe } from '../lib/autofeed.mjs';
import { TOOLS, callTool } from '../lib/tools.mjs';

const argv = process.argv.slice(2), cmd = argv[0];
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));

async function main() {
  switch (cmd) {
    case 'list': {
      const rows = techniques().map(n => ({ id: n.id, lane: n.lane, in: Object.entries(n.inputs).map(([k, s]) => `${k}:${s.type}${s.optional ? '?' : ''}`).join(' '), out: Object.entries(n.outputs).map(([k, t]) => `${k}:${t}`).join(' ') }));
      if (argv.includes('--json')) return console.log(JSON.stringify(rows, null, 1));
      for (const r of rows) console.log(`${r.id.padEnd(24)} ${r.lane.padEnd(10)} ${(r.in || '-').padEnd(34)} -> ${r.out}`);
      return console.log(`\n${rows.length} nodes, ${registry.size - rows.length} converters`);
    }
    case 'show': return console.log(JSON.stringify(await callTool('superframe_show', { node: pos[1] }), null, 1));
    case 'try': {
      const def = registry.get(pos[1]); if (!def) throw new Error(`no node ${pos[1]}`);
      const S = Number(flag('size', 256)), r = soloRecipe(def, { size: [S, S], optional: argv.includes('--optional') });
      const e = await evaluate(r, registry);
      return console.log((await exportAll(pos[2] ?? `out/try/${def.id}`, e.outputs, { seed: r.seed, palette: {} })).join('\n'));
    }
    case 'render': case 'export': {
      const recipe = JSON.parse(readFileSync(pos[1], 'utf8')), rec = recipe.recipe ?? recipe;
      if (flag('size')) rec.size = [Number(flag('size')), Number(flag('size'))];
      if (flag('for')) rec.for = flag('for').split(',');
      const e = await evaluate(rec, registry);
      const base = pos[2] ?? `out/render/${pos[1].replace(/.*[\\/]/, '').replace(/\.json$/, '')}`;
      if (rec.for) console.log((await exportRecipients(base, e, rec)).join('\n'));
      const files = await exportAll(base, e.outputs, { seed: rec.seed, palette: rec.palette ?? {} });
      console.log(files.join('\n')); return console.error(JSON.stringify(e.timings));
    }
    case 'explore': {
      const { runExplore } = await import('../explore/explore.mjs');
      const { out, summary, ranked } = await runExplore({ n: Number(flag('n', 240)), seed: flag('seed', `explore-${Date.now()}`), ...(flag('out') ? { out: resolve(flag('out')) } : {}) });
      console.log(JSON.stringify({ out, rendered: summary.rendered, rejected: summary.rejected, blocked: summary.blocked, best: ranked.map(r => ({ id: r.id, channel: r.channel, quality: r.quality, novelty: r.novelty, lanes: r.lanes })) }, null, 1));
      return;
    }
    case 'rerank': { const { rerank } = await import('../explore/explore.mjs'); const { ranked, summary } = rerank(resolve(pos[1])); return console.log(JSON.stringify({ blocked: summary.blocked, best: ranked.map(r => ({ id: r.id, channel: r.channel, quality: r.quality, novelty: r.novelty })) }, null, 1)); }
    case 'room': { const { startRoom } = await import('../room/serve.mjs'); startRoom(Number(flag('port', 8742))); return; }
    case 'gallery': return gallery(resolve(pos[1]), Number(flag('port', 8731)));
    case 'verdict': { const { verdict } = await import('../explore/explore.mjs'); verdict(resolve(pos[1]), pos[2], pos[3]); return console.log(`${pos[2]}: ${pos[3]}`); }
    case 'channels': { const d = new URL('../channels/', import.meta.url); if (!existsSync(d)) return; for (const f of readdirSync(d)) { const c = JSON.parse(readFileSync(new URL(f, d), 'utf8')); console.log(`${c.name.padEnd(48)} q ${c.quality}  nov ${c.novelty}  ${c.lanes.join(' / ')}`); } return; }
    case 'docs': { const { writeDocs } = await import('../tools/gendocs.mjs'); return console.log(writeDocs()); }
    case 'tools': return console.log(JSON.stringify(TOOLS, null, 1));
    case 'make': case 'artifact': return artifactCmd();
    case 'call': return console.log(JSON.stringify(await callTool(pos[1], JSON.parse(pos[2] ?? '{}')), null, 1));
    default: console.log(readFileSync(new URL(import.meta.url)).toString().split('\n').filter(l => l.startsWith('//   superframe')).map(l => l.slice(3)).join('\n'));
  }
}

async function artifactCmd() {
  const { parseIntent } = await import('../lib/artifact/intent.mjs'), { compute, write } = await import('../lib/artifact/render.mjs'), ops = await import('../lib/artifact/ops.mjs');
  const size = flag('size') ? flag('size').split('x').map(Number) : undefined;
  let recipe, intent = '', report = null;
  if (cmd === 'make') { ({ recipe, report } = parseIntent(pos[1] ?? '', { seed: flag('seed', 'artifact'), size })); intent = pos[1] ?? ''; }
  else { recipe = JSON.parse(readFileSync(resolve(pos[1]), 'utf8')); intent = recipe.intent ?? ''; if (size) recipe.size = size; }
  if (flag('seed') && cmd === 'artifact') recipe = ops.reseed(recipe, flag('seed'));
  if (flag('isomer')) recipe = ops.isomer(recipe, flag('isomer'));
  if (flag('metamer')) recipe = ops.metamer(recipe, flag('metamer'));
  if (flag('route')) { const [id, m, w] = flag('route').split(':'); recipe = ops.route(recipe, id, m, Number(w)); }
  if (flag('edit')) { const [p, v] = flag('edit').split('='); recipe = ops.edit(recipe, p, JSON.parse(v)); }
  if (size && !recipe.sim) delete recipe.sim;
  const out = compute(recipe); out.report = report;
  const dir = resolve(pos[2] ?? `out/artifact/${recipe.seed}`), m = write(out, dir, { intent, title: recipe.seed });
  console.log(JSON.stringify({ dir, recipe_hash: m.recipe_hash, size: m.size, times_ms: m.times_ms, unused_words: report?.unused ?? [], files: Object.keys(m.files) }, null, 1));
}

function gallery(dir, port) {
  const types = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.wav': 'audio/wav' };
  createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/steer') {
      let b = ''; for await (const c of req) b += c;
      try { const { id, verdict: v } = JSON.parse(b); const { verdict } = await import('../explore/explore.mjs'); verdict(dir, id, v); res.writeHead(204).end(); }
      catch (e) { console.error('steer failed:', e.message); res.writeHead(400).end(e.message); }
      return;
    }
    const p = join(dir, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(dir) || !existsSync(p)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); createReadStream(p).pipe(res);
  }).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/`));
}

main().catch(e => { console.error(`superframe ${cmd ?? ''}: ${e.message}`); process.exit(1); });
