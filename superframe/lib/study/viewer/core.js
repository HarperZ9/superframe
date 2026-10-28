// core.js: the study viewer's frame. One gesture means one thing at every depth: click or Enter opens a part one
// level deeper; Escape or Back goes one level up. State lives in the address hash, so any view can be returned to.
// study.json, embedded byte for byte, is the only source of numbers.
const RAW = document.getElementById('study').textContent;
const S = JSON.parse(RAW), C = S.criteria.colour, SW = C.palette.swatches;
const IMG = JSON.parse(document.getElementById('img').textContent);
const $ = (s, r = document) => r.querySelector(s);
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'on') for (const [ev, f] of Object.entries(v)) e.addEventListener(ev, f);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : String(k));
  return e;
}
const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`;
const num = (v, d = 2) => (v === null || v === undefined ? 'n/a' : (+v).toFixed(d));
const lumOf = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const inkOn = hex => (lumOf(hex) > 0.3 ? '#0d0b12' : '#f4f2f8');
const chip = (hex, text) => el('span', { class: 'chip', style: { background: hex, color: inkOn(hex) }, 'aria-hidden': 'true' }, text ?? '');

// ---- colour arithmetic for live controls (the same formulas as lib/study/cmath.mjs)
const lin = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4), encS = v => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const fL = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
function labOfLin([r, g, b]) {
  const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b, Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b, Z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b;
  const fx = fL(X / 0.95047), fy = fL(Y), fz = fL(Z / 1.08883); return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const hexOfLin = l => '#' + l.map(v => Math.round(encS(Math.min(1, Math.max(0, v))) * 255).toString(16).padStart(2, '0')).join('');

// ---- state <-> hash
const DEF = { lens: null, part: null, method: false, scale: 'lstar', lace: '#ffffff', view: 'subject' };
function parse() {
  const [p, q] = location.hash.replace(/^#\/?/, '').split('?'), seg = p ? p.split('/').filter(Boolean) : [], qs = new URLSearchParams(q ?? '');
  const st = { ...DEF, lens: seg[0] ?? null, part: seg[1] ?? null, method: seg[2] === 'method' };
  if (['goethe', 'lstar'].includes(qs.get('scale'))) st.scale = qs.get('scale');
  if (/^[0-9a-f]{6}$/i.test(qs.get('lace') ?? '')) st.lace = '#' + qs.get('lace').toLowerCase();
  if (['subject', 'shuffled', 'grey'].includes(qs.get('view'))) st.view = qs.get('view');
  if (st.lens && !LENS[st.lens]) Object.assign(st, { lens: null, part: null, method: false });
  return st;
}
function hashOf(st) {
  const seg = [st.lens, st.lens && st.part, st.lens && st.part && st.method ? 'method' : null].filter(Boolean), qs = new URLSearchParams();
  if (st.scale !== DEF.scale) qs.set('scale', st.scale); if (st.lace !== DEF.lace) qs.set('lace', st.lace.slice(1)); if (st.view !== DEF.view) qs.set('view', st.view);
  return '#/' + seg.join('/') + (qs.toString() ? '?' + qs : '');
}
let state = DEF, origin = null, back = null;
function go(next, from) {
  origin = from ? from.getBoundingClientRect() : null;
  const h = hashOf({ ...state, ...next }); if (h === location.hash) { render(); return; }
  state = { ...state, ...next }; location.hash = h;     // state moves now, so a fast second key acts on the new depth
}
function up() {
  back = state.method ? 'method' : state.part ?? state.lens;
  if (state.method) go({ method: false }); else if (state.part !== null) go({ part: null }); else if (state.lens) go({ lens: null });
}
// Control changes replace the history entry, so Back still walks depth, not every slider move.
function set(next) { history.replaceState(null, '', hashOf({ ...state, ...next })); state = parse(); render(false); }

// ---- the subject image and its highlight
const cv = $('#subject'), cx = cv.getContext('2d'); let base = null, labels = null, Lmap = null, Hmap = null;
const image = new Image();
image.onload = () => { cv.width = IMG.w; cv.height = IMG.h; cx.drawImage(image, 0, 0); base = cx.getImageData(0, 0, IMG.w, IMG.h); labels = Uint8Array.from(atob(IMG.labels), c => c.charCodeAt(0)); paint(); };

function maps() {
  if (Lmap) return; Lmap = new Float32Array(IMG.w * IMG.h); Hmap = new Int16Array(IMG.w * IMG.h); const d = base.data;
  for (let i = 0; i < Lmap.length; i++) { const [L, a, b] = labOfLin([lin(d[4 * i] / 255), lin(d[4 * i + 1] / 255), lin(d[4 * i + 2] / 255)]); Lmap[i] = L; const c = Math.hypot(a, b); Hmap[i] = c < 8 ? -1 : Math.floor((((Math.atan2(b, a) * 180 / Math.PI) + 360) % 360) / (360 / C.hue.bins)); }
}
function shuffledData() {
  let s = 0x9e3779b9; const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const n = IMG.w * IMG.h, idx = Uint32Array.from({ length: n }, (_, i) => i), out = new ImageData(IMG.w, IMG.h);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  for (let i = 0; i < n; i++) out.data.set(base.data.subarray(4 * idx[i], 4 * idx[i] + 4), 4 * i);
  return out;
}
let hover = null, shuf = null;
// mask: null, or a function of pixel index -> true where the region is.
function paint(mask = hover ?? activeMask()) {
  if (!base) return;
  if (state.view === 'grey') { cx.fillStyle = C.controls?.grey.hex ?? '#808080'; cx.fillRect(0, 0, IMG.w, IMG.h); $('#cap').textContent = `Control: uniform grey ${C.controls?.grey.hex}`; return; }
  const src = state.view === 'shuffled' ? (shuf ??= shuffledData()) : base;
  $('#cap').textContent = state.view === 'shuffled' ? 'Control: the same pixels, shuffled' : `${S.subject.file}  sha256 ${S.subject.sha256.slice(0, 16)}`;
  if (!mask || state.view !== 'subject') { cx.putImageData(src, 0, 0); return; }
  const out = new ImageData(IMG.w, IMG.h), d = src.data, o = out.data;
  for (let i = 0; i < IMG.w * IMG.h; i++) { const on = mask(i), p = 4 * i; for (let c = 0; c < 3; c++) o[p + c] = on ? d[p + c] : d[p + c] * 0.16 + 13 * 0.84; o[p + 3] = 255; }
  cx.putImageData(out, 0, 0);
}
const swatchMask = k => i => labels[i] === k;
const bandMask = b => (maps(), i => Math.min(4, Math.floor(Lmap[i] / 20)) === b);
const hueMask = b => (maps(), i => Hmap[i] === b);
function activeMask() { const L = LENS[state.lens]; if (!L || state.part === null) return null; const p = L.parts().find(q => q.key === state.part); return p?.mask ?? null; }
function hoverable(btn, mask) {
  if (!mask) return btn;
  const on = () => { hover = mask; paint(); }, off = () => { hover = null; paint(); };
  btn.addEventListener('mouseenter', on); btn.addEventListener('focus', on); btn.addEventListener('mouseleave', off); btn.addEventListener('blur', off);
  return btn;
}

// ---- rendering by depth
function crumbs() {
  const L = LENS[state.lens], p = L && state.part !== null ? L.parts().find(q => q.key === state.part) : null;
  const steps = [['Study', { lens: null, part: null, method: false }]];
  if (L) steps.push([L.name, { part: null, method: false }]);
  if (p) steps.push([p.label, { method: false }]);
  if (p && state.method) steps.push(['Method', {}]);
  const ol = el('ol');
  steps.forEach(([t, nx], i) => ol.append(el('li', {}, el('button', { 'aria-current': i === steps.length - 1 ? 'location' : null, on: { click: e => go(nx, e.currentTarget) } }, t))));
  $('#path').replaceChildren(ol);
}
function render(animate = true) {
  const stage = $('#stage'), L = LENS[state.lens];
  crumbs(); hover = null;
  let body;
  if (!L) body = overview();
  else if (state.part === null) body = lensView(L);
  else { const p = L.parts().find(q => q.key === state.part); body = !p ? lensView(L) : state.method ? methodView(L, p) : partView(L, p); }
  stage.replaceChildren(...body);
  if (animate) {
    stage.classList.remove('grow');
    if (origin) { const r = stage.getBoundingClientRect(); stage.style.transformOrigin = `${origin.left + origin.width / 2 - r.left}px ${origin.top + origin.height / 2 - r.top}px`; }
    void stage.offsetWidth; stage.classList.add('grow');
    const prev = back && [...stage.querySelectorAll('[data-key]')].find(e => e.dataset.key === back);
    const target = prev ?? stage.querySelector('[data-focus]') ?? stage.querySelector('h2'); target?.focus({ preventScroll: true }); back = null;
  }
  paint();
}
function opener(label, sub, weight, swatchHex, chipText, onOpen, mask) {
  const b = el('button', { class: 'part', 'aria-label': [label, sub, weight !== null && weight !== undefined ? `weight ${pct(weight)}` : null].filter(Boolean).join(', '), on: { click: e => onOpen(e.currentTarget) } },
    swatchHex ? chip(swatchHex, chipText) : el('span', { class: 'chip', style: { background: 'var(--panel)' }, 'aria-hidden': 'true' }, chipText ?? ''),
    el('span', {}, el('span', { class: 'label' }, label), sub ? el('span', { class: 'sub' }, sub) : null, weight !== null && weight !== undefined ? el('span', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: { width: pct(Math.min(1, weight)) } })) : null),
    el('span', { class: 'w' }, weight !== null && weight !== undefined ? pct(weight) : ''));
  return hoverable(b, mask);
}
function lensView(L) {
  const parts = L.parts();
  const list = el('ul', { class: 'parts', 'aria-label': `${L.name} parts` }, parts.map((p, i) => { const b = opener(p.label, p.sub, p.weight, p.hex, p.chip ?? String(i + 1), t => go({ part: p.key }, t), p.mask); b.dataset.key = p.key; return el('li', {}, b); }));
  return [el('h2', { tabindex: '-1' }, L.name), el('p', { class: 'q' }, L.question), ...L.view(), list];
}
function partView(L, p) {
  return [el('h2', { tabindex: '-1' }, p.label), el('p', { class: 'q' }, `${L.name}, part ${L.parts().findIndex(q => q.key === p.key) + 1} of ${L.parts().length}`),
    p.hex ? el('div', { style: { height: '72px', background: p.hex, borderRadius: '6px', outline: '1px solid #4a4458' }, role: 'img', 'aria-label': `colour ${p.hex}` }) : null,
    el('dl', {}, p.cells.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)]), el('dt', {}, 'lens'), el('dd', {}, L.lensLine)),
    el('button', { class: 'open', 'data-focus': true, 'data-key': 'method', on: { click: e => go({ method: true }, e.currentTarget) } }, 'Method')];
}
function methodView(L, p) {
  const plate = S.plates.find(q => q.id === L.plate);
  return [el('h2', { tabindex: '-1' }, 'Method'), el('p', { class: 'q' }, `${L.name}: how ${p.label} was read`),
    el('div', { class: 'law', 'aria-label': 'law' }, L.law), el('p', { class: 'method' }, L.method()),
    el('dl', {}, el('dt', {}, 'source'), el('dd', {}, `${S.subject.file}, ${S.subject.w} x ${S.subject.h}, sha256 ${S.subject.sha256}`), el('dt', {}, 'decoder'), el('dd', {}, S.subject.decoder),
      el('dt', {}, 'region'), el('dd', {}, p.mask ? 'lit in the picture; everything else is dimmed' : 'the whole picture'),
      el('dt', {}, 'receipt'), el('dd', {}, S.receipt_sha256)),
    plate ? el('p', {}, el('a', { href: plate.file }, `${plate.title}: full plate, ${plate.w} x ${plate.h} PNG`)) : null];
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); up(); } });
window.addEventListener('hashchange', () => { state = parse(); render(); });
