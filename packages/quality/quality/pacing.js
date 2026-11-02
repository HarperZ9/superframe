// SPDX-License-Identifier: FSL-1.1-MIT
// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// pacing.js: frame-pacing recorder. Inject before page scripts run (Playwright add_init_script).
// Wraps requestAnimationFrame to time every callback, observes layout shifts and long animation
// frames, and exposes window.__pacing.collect(ms) -> {ts, cb, cls, loaf, dpr, canvases}.
(() => {
  if (window.__pacing) return;
  const raf = window.requestAnimationFrame.bind(window);
  const cb = [];
  let cls = 0;
  const loaf = [];
  window.requestAnimationFrame = fn => raf(t => {
    const s = performance.now();
    try { fn(t); } finally { cb.push(performance.now() - s); if (cb.length > 20000) cb.splice(0, 10000); }
  });
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
  } catch (e) { console.info('pacing: layout-shift observer unavailable', e.message); }
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) loaf.push(Math.round(e.duration)); })
      .observe({ type: 'long-animation-frame', buffered: true });
  } catch (e) { console.info('pacing: long-animation-frame observer unavailable', e.message); }
  const canvases = () => [...document.querySelectorAll('canvas')].filter(c => c.clientWidth > 0).map(c => ({
    id: c.id || c.className || c.parentElement?.className || 'canvas',
    css: [c.clientWidth, c.clientHeight], px: [c.width, c.height],
    ratio: +(c.width / c.clientWidth).toFixed(3),
  }));
  window.__pacing = {
    collect(ms) {
      const start = cb.length;
      return new Promise(res => {
        const ts = [];
        const t0 = performance.now();
        const tick = t => {
          ts.push(t);
          if (performance.now() - t0 < ms) raf(tick);
          else res({ ts, cb: cb.slice(start), cls, loaf: loaf.slice(), dpr: devicePixelRatio, canvases: canvases() });
        };
        raf(tick);
      });
    },
    canvases,
  };
})();
