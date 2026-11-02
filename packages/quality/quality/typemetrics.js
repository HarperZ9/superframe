// SPDX-License-Identifier: FSL-1.1-MIT
// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// typemetrics.js: collect type metrics for every visible element that owns text.
// Evaluate in a page (Playwright page.evaluate(src)); returns {fonts, items}. Read-only.
(() => {
  const parse = c => { const m = c.match(/[\d.]+/g); return m ? m.map(Number) : [0, 0, 0, 0]; };
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const over = (top, bot) => { const a = top[3] ?? 1; return [0, 1, 2].map(i => top[i] * a + bot[i] * (1 - a)).concat(1); };
  const bgOf = el => {
    // composite background colours up the tree; an image or canvas backdrop makes the result unknown
    const stack = [];
    let unknown = false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') unknown = true;
      const c = parse(cs.backgroundColor);
      if (cs.backgroundColor.startsWith('rgba') && c[3] === 0) continue;
      stack.push(c.length === 3 ? c.concat(1) : c);
      if ((c[3] ?? 1) >= 1) break;
    }
    let col = [255, 255, 255, 1];
    for (let i = stack.length - 1; i >= 0; i--) col = over(stack[i], col);
    return { col, unknown };
  };
  // Art under the text: a canvas, image, video or svg that the text does not contain and that covers a quarter of
  // the text's box. Computed colours cannot see what such an element paints (2026-10-26: transparent DOM text laid
  // over a living-type canvas scored 1:1), so the item is unknown and carries its box for a pixel measurement.
  const media = [...document.querySelectorAll('canvas, img, video, svg')].filter(m => { const b = m.getBoundingClientRect(); return b.width > 4 && b.height > 4; });
  // A fixed layer stays in the viewport while the page scrolls, so it lies under any text once that text is scrolled
  // into view: test it against the text's box moved into the viewport (2026-10-26: a label 1600 px down the page over
  // a fixed full-viewport canvas was not seen as over art).
  const isFixed = m => { for (let a = m; a && a.nodeType === 1; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') return true; return false; };
  const overMedia = (el, r) => media.some(m => {
    if (el.contains(m)) return false;
    const b = m.getBoundingClientRect();
    let top = r.top, bottom = r.bottom;
    if (isFixed(m)) { const t = Math.max(0, Math.min(r.top, innerHeight - r.height)); top = t; bottom = t + r.height; }
    const w = Math.min(r.right, b.right) - Math.max(r.left, b.left), h = Math.min(bottom, b.bottom) - Math.max(top, b.top);
    return w > 0 && h > 0 && w * h >= 0.25 * r.width * r.height;
  });
  const loaded = [...document.fonts].filter(f => f.status === 'loaded').map(f => ({
    family: f.family.replace(/["']/g, ''), weight: f.weight, style: f.style, stretch: f.stretch,
  }));
  const covers = (face, w, style) => {
    const parts = String(face.weight).split(/\s+/).map(Number);
    const lo = parts[0], hi = parts[1] ?? parts[0];
    const okW = w >= lo - 1 && w <= hi + 1;
    const okS = style === 'normal' ? face.style === 'normal' : face.style !== 'normal';
    return okW && okS;
  };
  const items = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  for (let el = walker.currentNode; el; el = walker.nextNode()) {
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').replace(/\s+/g, ' ').trim();
    if (!own || own.length < 2) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0 || cs.display === 'none') continue;
    const size = parseFloat(cs.fontSize);
    const lh = cs.lineHeight === 'normal' ? size * 1.2 : parseFloat(cs.lineHeight);
    const weight = +cs.fontWeight;
    const style = cs.fontStyle;
    const family = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    const faces = loaded.filter(f => f.family === family);
    const synthesis = cs.fontSynthesis || `${cs.fontSynthesisWeight || 'auto'} ${cs.fontSynthesisStyle || 'auto'}`;
    const want = style === 'normal' ? 'normal' : 'italic';
    let faux = null;
    if (faces.length && !faces.some(f => covers(f, weight, want))) {
      const styleOk = faces.some(f => (want === 'normal') === (f.style === 'normal'));
      const kind = styleOk ? 'weight' : 'style';
      const blocked = !new RegExp(`${kind}|auto`).test(synthesis);
      faux = blocked ? `${kind}-fallback` : kind;  // fallback: no synthesis, nearest face used instead
    }
    // line count from client rects. A block whose children are all inline (a paragraph with links, cite, b) is
    // measured whole, so inline children count toward its lines and characters; otherwise only its own text.
    let lines = 0;
    const tops = new Set(), widths = new Map();
    const inlineOnly = /^(block|list-item|flow-root|table-cell)$/.test(cs.display) &&
      ![...el.querySelectorAll('*')].some(d => !/^(inline|inline-block|contents|none)$/.test(getComputedStyle(d).display));
    const measured = inlineOnly ? el.textContent.replace(/\s+/g, ' ').trim() : own;
    const sources = inlineOnly ? [el] : [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
    for (const n of sources) {
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const rr of range.getClientRects()) {
        if (rr.width <= 1 || rr.height <= 1) continue;
        // one line per baseline band: inline boxes on the same line differ by sub-pixel tops (a cite, a link)
        let k = [...tops].find(t => Math.abs(t - rr.top) < size * 0.5);
        if (k === undefined) { k = rr.top; tops.add(k); }
        widths.set(k, Math.max(widths.get(k) || 0, rr.right));
      }
    }
    // per line, keep the right edge; the line width is right edge minus the block's content left
    const left = r.left + parseFloat(cs.paddingLeft || 0);
    for (const [k, right] of widths) widths.set(k, Math.max(1, right - left));
    lines = tops.size || 1;
    // characters on a full line: total characters scaled by the widest line over the summed line widths, so a
    // short last line does not drag the average down (a 2.1-line paragraph is not a narrow measure)
    const ws = [...widths.values()], sumW = ws.reduce((a, b) => a + b, 0), maxW = Math.max(0, ...ws);
    const cplFull = sumW > 0 ? Math.round(measured.length * maxW / sumW) : measured.length;
    // outlined type (transparent fill, text stroke) is read by its stroke colour
    const strokeW = parseFloat(cs.webkitTextStrokeWidth || '0');
    const fill = parse(cs.color);
    const fg = (fill.length > 3 && fill[3] === 0 && strokeW > 0) ? parse(cs.webkitTextStrokeColor) : fill;
    const decorative = !!el.closest('[aria-hidden="true"]');
    const { col: bg, unknown: bgUnknown } = bgOf(el);
    const invisibleFill = fill.length > 3 && fill[3] === 0 && !(strokeW > 0);
    const onArt = overMedia(el, r), unknown = bgUnknown || onArt || invisibleFill;
    const fgc = over(fg.length === 3 ? fg.concat(1) : fg, bg);
    const L1 = lum(fgc), L2 = lum(bg);
    const contrast = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); // from computed colours only
    items.push({
      tag: el.tagName.toLowerCase(), cls: (el.className && el.className.baseVal === undefined ? el.className : '').slice(0, 40),
      text: own.slice(0, 60), chars: measured.length, lines, cpl: cplFull, cpl_mean: Math.round(measured.length / lines), viewport: innerWidth,
      width: Math.round(r.width), family, size, weight, style, lh: +(lh / size).toFixed(3),
      tracking_em: cs.letterSpacing === 'normal' ? 0 : +(parseFloat(cs.letterSpacing) / size).toFixed(4),
      transform: cs.textTransform, kerning: cs.fontKerning, optical: cs.fontOpticalSizing, synthesis,
      variation: cs.fontVariationSettings, faux, contrast: +contrast.toFixed(2), contrast_computed: +contrast.toFixed(2), bg_unknown: unknown,
      outlined: strokeW > 0 && fill.length > 3 && fill[3] === 0, decorative,
      // what the reader sees is what is painted there: measure those pixels (typemetrics.measure_rendered)
      measure: unknown && (onArt || invisibleFill) ? { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, art: onArt, transparent: invisibleFill, key: (el.dataset.tmMeasure = String(items.length)) } : null,
    });
  }
  return { fonts: loaded, items };
})()
