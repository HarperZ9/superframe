// room/serve.mjs: the assistive room's local server. It binds to 127.0.0.1 only, serves the page, and runs the
// transformations on this machine. Nothing is stored on the server and nothing leaves the machine: the page keeps
// its own history in memory, and saving is a file download the person starts. The content security policy allows
// no other origin.
//   node cli/superframe.mjs room [--port 8742]
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registry } from '../lib/registry.mjs';
import { evaluate } from '../lib/graph.mjs';
import { pngBytes, wavBytes } from '../lib/export.mjs';
import { describePicture } from '../lib/transform.mjs';
import { recipeFor, KINDS } from './recipes.mjs';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const CSP = "default-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
const GAIN = [0.3, 0.4, 0.5, 0.6, 0.7];
const dataUrl = (mime, bytes) => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;

// Sound level follows the intensity setting: peak-normalised to a fixed, modest level, never louder.
function levelled(a, intensity) {
  let peak = 0; for (const c of a.channels) for (const v of c) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0 ? GAIN[intensity - 1] / peak : 1;
  return { rate: a.rate, channels: a.channels.map(c => Float32Array.from(c, v => v * g)) };
}

export async function make({ kind, input, intensity = 2 }) {
  if (!KINDS.includes(kind)) throw new Error('unknown transformation');
  if (!String(input ?? '').trim()) throw new Error('nothing to transform yet');
  const level = Math.max(1, Math.min(5, Math.round(Number(intensity) || 2))), recipe = recipeFor(kind, input, level);
  const ev = await evaluate(recipe, registry), o = ev.outputs, res = { kind, recipe };
  if (o.motion) {
    res.frames = await Promise.all(o.motion.frames.map(async f => dataUrl('image/png', await pngBytes({ w: o.motion.w, h: o.motion.h, data: f }, { seed: recipe.seed }))));
    res.fps = o.motion.fps; res.captions = o.motion.captions ?? []; res.transitions = o.motion.transitions ?? []; res.flash = o.motion.flash ?? null;
  }
  if (o.image) { res.image = dataUrl('image/png', await pngBytes(o.image, { seed: recipe.seed })); res.alt = describePicture(o.image); }
  if (o.audio) { const a = levelled(o.audio, level); res.audio = dataUrl('audio/wav', wavBytes(a)); res.seconds = +(a.channels[0].length / a.rate).toFixed(1); }
  if (o.text) res.text = o.text.text;
  res.words = kind === 'code-words' ? res.text : String(input).trim();
  return res;
}

export function startRoom(port = 8742) {
  const server = createServer(async (req, res) => {
    const head = { 'content-security-policy': CSP, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cache-control': 'no-store' };
    try {
      if (req.method === 'POST' && req.url === '/api/make') {
        let body = ''; for await (const c of req) { body += c; if (body.length > 64e3) throw new Error('input too long'); }
        const out = await make(JSON.parse(body));
        res.writeHead(200, { ...head, 'content-type': 'application/json' }).end(JSON.stringify(out));
        return;
      }
      const path = decodeURIComponent(req.url.split('?')[0]), file = join(DIR, path === '/' ? 'index.html' : path);
      if (!file.startsWith(DIR) || !existsSync(file) || !TYPES[extname(file)]) { res.writeHead(404, head).end(); return; }
      res.writeHead(200, { ...head, 'content-type': TYPES[extname(file)] }).end(readFileSync(file));
    } catch (e) {
      // the log names the route and the error kind only: never the person's words, which a parse error could quote
      console.error(`room: ${req.method} ${req.url.split('?')[0]} failed (${e.name})`);
      res.writeHead(400, { ...head, 'content-type': 'application/json' }).end(JSON.stringify({ error: e.message }));
    }
  });
  server.listen(port, '127.0.0.1', () => console.log(`room: http://127.0.0.1:${port}/`));
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) startRoom(Number(process.argv[2]) || 8742);
