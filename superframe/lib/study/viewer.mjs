// viewer.mjs: writes study.html beside study.json. One self-contained page with no network: the study.json bytes
// embedded with only "<" escaped (as a JSON < escape), so JSON.parse returns the same record and it stays
// the single source of numbers; a preview of the subject; and each preview pixel's swatch index, so a swatch can
// light up where it sits. Plate PNGs are linked by name, so
// the page works from the CLI output folder as it stands.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { encodePNG } from '../../../feed-23/build/brush/png.js';

const asset = f => readFileSync(new URL(`./viewer/${f}`, import.meta.url), 'utf8');
const safe = s => s.replace(/</g, '\\u003c');          // keeps "</script>" out of embedded JSON; still valid JSON

// Preview at most `max` px on the long side: colours area-averaged, labels sampled at each cell's centre.
function preview(S, labels, max) {
  const f = Math.max(1, Math.max(S.w, S.h) / max), w = Math.round(S.w / f), h = Math.round(S.h / f);
  const rgba = new Uint8ClampedArray(w * h * 4), lab = new Uint8Array(w * h).fill(255);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ya = Math.floor(y * S.h / h), yb = Math.max(ya + 1, Math.floor((y + 1) * S.h / h)), xa = Math.floor(x * S.w / w), xb = Math.max(xa + 1, Math.floor((x + 1) * S.w / w));
    const acc = [0, 0, 0]; for (let j = ya; j < yb; j++) for (let i = xa; i < xb; i++) for (let c = 0; c < 3; c++) acc[c] += S.rgba[4 * (j * S.w + i) + c];
    const n = (yb - ya) * (xb - xa), o = 4 * (y * w + x); for (let c = 0; c < 3; c++) rgba[o + c] = Math.round(acc[c] / n); rgba[o + 3] = 255;
    if (labels) { const v = labels[Math.min(S.h - 1, (ya + yb) >> 1) * S.w + Math.min(S.w - 1, (xa + xb) >> 1)]; lab[y * w + x] = v < 0 ? 255 : v; }
  }
  return { w, h, rgba, lab };
}

export async function viewerHTML(r, { max = 960 } = {}) {
  const S = r.subject, labels = r.measured?.colour?.work?.labels ?? null, P = preview(S, labels, max);
  const png = Buffer.from(await encodePNG(P.w, P.h, P.rgba, b => deflateSync(b, { level: 9 }))).toString('base64');
  const img = { w: P.w, h: P.h, png: `data:image/png;base64,${png}`, labels: Buffer.from(P.lab).toString('base64') };
  const title = `Colour study: ${S.file}`.replace(/[<&]/g, '');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><style>${asset('page.css')}</style></head>
<body>
<header><h1>${S.file.replace(/[<&]/g, '')}</h1><nav class="path" id="path" aria-label="Where you are"></nav></header>
<main>
<figure><canvas id="subject" role="img" aria-label="The subject picture; the selected part is lit and the rest dimmed"></canvas><figcaption id="cap" aria-live="polite"></figcaption></figure>
<section id="stage"></section>
</main>
<script type="application/json" id="study">${safe(r.bytes.toString('utf8'))}</script>
<script type="application/json" id="img">${safe(JSON.stringify(img))}</script>
<script>${asset('core.js')}</script>
<script>${asset('lenses.js')}
state = parse(); render(false); image.src = IMG.png;</script>
</body></html>
`;
}

export async function writeViewer(out, r, opts) {
  const f = join(out, 'study.html');
  writeFileSync(f, await viewerHTML(r, opts));
  return f;
}
