// tools/verify-room.mjs: checks the assistive room in a real browser, keyboard only. R&D tooling (Playwright and
// axe-core live outside the shipped code; output goes to out/verify-room).
//   node tools/verify-room.mjs
// Env: PW (playwright module, else 'playwright'), CHROME (browser, else Playwright's own), AXE (axe.min.js, else
// axe-core resolved from node_modules), OUT (screenshot folder).
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { startRoom } from '../room/serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW ?? 'playwright');
const AXE = readFileSync(process.env.AXE ?? require.resolve('axe-core/axe.min.js'), 'utf8');
const OUT = process.env.OUT ?? 'out/verify-room';
mkdirSync(OUT, { recursive: true });
const PORT = 8749, server = startRoom(PORT), report = { checks: [], axe: {}, console: [] };
const check = (name, ok, detail = '') => { report.checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`); };

const browser = await chromium.launch({ executablePath: process.env.CHROME });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') report.console.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', e => report.console.push(`pageerror: ${e.message}`));
const offOrigin = []; page.on('request', r => { const u = r.url(); if (!u.startsWith(`http://127.0.0.1:${PORT}/`) && !u.startsWith('data:') && !u.startsWith('blob:')) offOrigin.push(u); });

async function axe(label) {
  await page.evaluate(AXE);
  const r = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }));
  report.axe[label] = r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }));
  check(`axe ${label}: no violations`, r.violations.length === 0, r.violations.map(v => `${v.id} (${v.nodes.length})`).join(', '));
}
const focused = () => page.evaluate(() => { const e = document.activeElement; return e ? (e.id || e.textContent.trim().slice(0, 30) || e.tagName) : ''; });
async function tabTo(test, max = 60) { for (let i = 0; i < max; i++) { await page.keyboard.press('Tab'); const f = await focused(); if (test(f)) return f; } return null; }
const shot = name => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

await page.goto(`http://127.0.0.1:${PORT}/`);
await shot('01-start'); await axe('start');
check('settings start closed and hidden things stay hidden', await page.isHidden('#settings') && await page.isHidden('#save-controls') && await page.isHidden('#result'));
check('nothing plays at load', await page.evaluate(() => document.querySelectorAll('audio,video').length === 0 && document.getAnimations().length === 0));

// keyboard only: the words field, type, then make a story
check('Tab reaches the words field', await tabTo(f => f === 'words'));
await page.keyboard.type('I like the sea. Do you?');
check('Tab reaches the story choice', await tabTo(f => f === 'Moving mosaic story'));
await page.keyboard.press('Enter');
await page.waitForFunction(() => /Made a story/.test(document.getElementById('status').textContent), null, { timeout: 60000 });
await shot('02-story'); await axe('story result');
const src0 = await page.getAttribute('#picture', 'src');
await page.waitForTimeout(1500);
check('the story does not move by itself', src0 === await page.getAttribute('#picture', 'src'));
check('Play is hidden until motion is allowed', await page.isHidden('#play'));
const cap0 = await page.textContent('#caption');
check('Tab reaches Next', await tabTo(f => f === 'next'));
await page.keyboard.press('Enter');
check('Next moves to the next beat', cap0 !== await page.textContent('#caption'), `${cap0} -> ${await page.textContent('#caption')}`);
check('no sound started without a press', await page.evaluate(() => [...document.querySelectorAll('audio')].every(a => a.paused)));

// keep and share: the one-page save opens on its own, plays nothing, and passes axe
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#save-story')]);
const saved = `${OUT}/saved-story.html`; await dl.saveAs(saved);
const keep = await browser.newPage(); const keepErrors = [];
keep.on('console', m => { if (m.type() === 'error') keepErrors.push(m.text()); }); keep.on('pageerror', e => keepErrors.push(e.message));
await keep.goto('file:///' + saved.replaceAll('\\', '/'));
await keep.waitForTimeout(800);
check('the saved page plays nothing by itself', await keep.evaluate(() => [...document.querySelectorAll('audio')].every(a => a.paused) && document.getAnimations().length === 0));
await keep.evaluate(AXE);
const kv = await keep.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22aa', 'best-practice'] } }).then(r => r.violations.map(v => `${v.id} (${v.nodes.length})`)));
report.axe['saved page'] = kv; check('axe saved page: no violations', kv.length === 0, kv.join(', '));
await keep.click('#n'); check('the saved page steps by beat', /sea/.test(await keep.textContent('#c')), await keep.textContent('#c'));
check('the saved page has 0 console errors', keepErrors.length === 0, keepErrors.join(' | '));
await keep.screenshot({ path: `${OUT}/07-saved-page.png`, fullPage: true }); await keep.close();

// undo and redo from the keyboard (outside a text field)
await page.focus('#next');
await page.keyboard.press('Control+z');
check('Undo takes back the story', await page.isHidden('#result'));
await page.keyboard.press('Control+y');
check('Redo brings it back', await page.isVisible('#result'));

// tiles: switch tab with arrow keys, pick tiles with arrows and Enter
await page.focus('#tab-type'); await page.keyboard.press('ArrowRight');
check('arrow keys switch to Tiles', await page.isVisible('#pane-tiles'));
check('Tab enters the tile grid', await tabTo(f => f === 'I'));
await page.keyboard.press('Enter'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
const sentence = await page.textContent('#tile-sentence');
check('tiles build a sentence', sentence.split(' ').length === 3, sentence);
await shot('03-tiles'); await axe('tiles');
// the result names its input and says when the input has changed; Make again uses the new input
check('the result names the words that made it', /I like the sea/.test(await page.textContent('#source')));
check('a changed input marks the result as made from earlier words', await page.isVisible('#stale') && /earlier/.test(await page.textContent('#stale')));
check('Tab reaches Make again', await tabTo(f => f === 'remake'));
await page.keyboard.press('Enter');
await page.waitForFunction(() => /Made a story/.test(document.getElementById('status').textContent) && /I like music/.test(document.getElementById('source').textContent), null, { timeout: 60000 });
check('Make again uses the new words and clears the marker', await page.isHidden('#stale'));
await shot('03b-remade');

// numbers to sound, by keypad
await page.focus('#tab-tiles'); await page.keyboard.press('ArrowRight');
check('Tab enters the keypad', await tabTo(f => f === '1'));
for (const k of ['Enter', 'ArrowRight', 'Enter', 'ArrowRight', 'Enter']) await page.keyboard.press(k);
check('the keypad types numbers', (await page.inputValue('#numbers')) === '123');
await page.focus('#numbers'); await page.keyboard.type(' 5 8 13'); await page.keyboard.press('Tab');
check('Tab reaches the sound choice', await tabTo(f => f === 'Sound of the numbers'));
await page.keyboard.press('Enter');
await page.waitForFunction(() => /Made a sound/.test(document.getElementById('status').textContent), null, { timeout: 60000 });
check('the sound waits for a press', await page.evaluate(() => document.querySelectorAll('audio').length === 0));
await shot('04-numbers-sound'); await axe('numbers sound');

// settings, larger text, motion allowed but reduced motion still wins
await page.click('#settings-open'); await page.check('#opt-large'); await page.check('#opt-motion');
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.focus('#tab-numbers'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
await shot('05-settings-large'); await axe('settings and large');
await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' }); await shot('06-dark'); await axe('dark');

// transition frames at calm (1), middle (3) and vivid (5): every frame from the end of beat 1 to the start of beat 2
const { make } = await import('../room/serve.mjs');
mkdirSync(`${OUT}/transitions`, { recursive: true });
for (const level of [1, 3, 5]) {
  const r = await make({ kind: 'story', input: 'I like the sea. Do you?', intensity: level }), c = r.captions;
  for (let f = c[0].to; f <= c[1].from; f++) writeFileSync(`${OUT}/transitions/level${level}_frame${String(f).padStart(2, '0')}.png`, Buffer.from(r.frames[f].split(',')[1], 'base64'));
  report.transitions = { ...(report.transitions ?? {}), [level]: { kinds: r.transitions.map(t => t.kind), frames: c[1].from - c[0].to + 1, fps: r.fps, flash: r.flash } };
  check(`level ${level} story passes the flash check`, r.flash?.pass === true, `${r.flash?.flashesPerSecond} per second at ${r.fps} fps`);
}

writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
check('no request leaves 127.0.0.1', offOrigin.length === 0, offOrigin.join(' '));
check('0 console errors or warnings', report.console.length === 0, report.console.join(' | '));
await browser.close(); server.close();
const failed = report.checks.filter(c => !c.ok).length;
console.log(`\n${report.checks.length - failed} of ${report.checks.length} checks passed. Screenshots: ${OUT}`);
process.exit(failed ? 1 : 0);
