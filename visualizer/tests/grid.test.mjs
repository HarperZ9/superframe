// grid.test.mjs: the MIDI reader and writer, and the struck grid built from the clean-room spec (INBOX-K4ITE1-SPEC.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMidi, writeMidi, toEvents, fromEvents } from '../lib/midi.mjs';
import { prepareScore, stateAt, maskCoverage, MASKS, drawGrid, gridLayout, cellOf, gutterPx } from '../render/grid.mjs';
import { plane } from '../lib/draw.mjs';

test('MIDI: write then read gives the same notes, within one tick', () => {
  const notes = [{ t: 0, dur: 0.5, pitch: 60, vel: 0.8 }, { t: 0.3137, dur: 0.25, pitch: 64, vel: 0.5 }, { t: 1.75, dur: 1, pitch: 67, vel: 1 }];
  const m = parseMidi(writeMidi({ ppq: 960, bpm: 135, tracks: [{ name: 'keys', notes }] })), tick = 60 / 135 / 960;
  assert.equal(m.format, 1); assert.equal(m.ppq, 960); assert.equal(m.tracks[1].name, 'keys');
  assert.equal(m.notes.length, 3);
  m.notes.forEach((n, i) => { assert.ok(Math.abs(n.t - notes[i].t) <= tick, `t ${n.t}`); assert.ok(Math.abs(n.dur - notes[i].dur) <= 2 * tick); assert.equal(n.pitch, notes[i].pitch); assert.ok(Math.abs(n.vel - notes[i].vel) < 0.01); });
  assert.ok(Math.abs(m.tempos[0].bpm - 135) < 0.01);
});

test('MIDI: running status, note-on with velocity 0, and a tempo change half way', () => {
  // format 0, 480 ppq; 120 BPM, then 60 BPM from tick 960; notes at ticks 0 and 960 with running status
  const trk = [0x00, 0xff, 0x51, 3, 0x07, 0xa1, 0x20, 0x00, 0x90, 60, 100, 0x87, 0x40, 60, 0, 0x00, 0xff, 0x51, 3, 0x0f, 0x42, 0x40, 0x00, 62, 90, 0x87, 0x40, 62, 0, 0x00, 0xff, 0x2f, 0];
  const bytes = Uint8Array.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0, 0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, trk.length, ...trk]);
  const m = parseMidi(bytes);
  assert.deepEqual(m.notes.map(n => n.pitch), [60, 62]);
  assert.ok(Math.abs(m.notes[1].t - 1) < 1e-9, `second note at ${m.notes[1].t} s (two beats at 120)`);
  assert.ok(Math.abs(m.notes[1].dur - 2) < 1e-9, `second note lasts ${m.notes[1].dur} s (two beats at 60)`);
  assert.throws(() => parseMidi(new Uint8Array(20)), /MThd/);
});

test('MIDI: events round trip through the superframe events shape', () => {
  const ev = { duration: 2, events: [{ t: 0.5, voice: 'a', args: { note: 50, dur: 0.2, vel: 0.6 } }, { t: 1, voice: 'b', args: { note: 70, dur: 0.4, vel: 0.9 } }] };
  const back = toEvents(parseMidi(writeMidi(fromEvents(ev, { bpm: 120 }))));
  assert.deepEqual(back.events.map(e => [e.voice, e.args.note]), [['a', 50], ['b', 70]]);
});

test('mapping is deterministic: pitch class across, octave up; rank spreads distinct keys', () => {
  const P = { cols: 12, rows: 3, mapping: 'pitch' }, ctx = { octLo: 4, rank: new Map() };
  assert.equal(cellOf({ pitch: 48 }, 0, ctx, P), 2 * 12 + 0);   // C3 clamps to the bottom row, column 0
  assert.equal(cellOf({ pitch: 67 }, 0, ctx, P), 1 * 12 + 7);   // G4, one octave above the lowest: middle row
  const a = prepareScore([{ t: 0, pitch: 40 }, { t: 1, pitch: 50 }, { t: 2, pitch: 60 }], { cols: 3, rows: 3, mapping: 'rank' });
  assert.deepEqual(a.strikes.map((s, i) => (s.length ? i : -1)).filter(i => i >= 0), [0, 4, 8]);
  const s1 = prepareScore([{ t: 0, pitch: 40 }, { t: 1, pitch: 40 }], { mapping: 'seeded', seed: 3 }), s2 = prepareScore([{ t: 0, pitch: 40 }, { t: 1, pitch: 40 }], { mapping: 'seeded', seed: 3 });
  assert.deepEqual(s1.strikes.map(s => s.length), s2.strikes.map(s => s.length));
});

test('the decay: opacity and the ground mask share one ease-out quad; velocity sets the fill; a retrigger restarts the one state', () => {
  const prep = prepareScore([{ t: 1, dur: 0.25, pitch: 60, vel: 0.8 }, { t: 1.5, dur: 0.25, pitch: 60, vel: 0.4 }], { cols: 1, rows: 1, fade: 2, durScale: false });
  const at = t => stateAt(prep, t)[0];
  assert.equal(at(0.5).opacity, 0);
  assert.ok(Math.abs(at(1).opacity - 0.8) < 1e-12);
  assert.ok(Math.abs(at(1.25).e - (1 - 0.875 ** 2)) < 1e-12, 'e is the eased progress');
  assert.ok(Math.abs(at(1.25).opacity - 0.8 * 0.875 ** 2) < 1e-12);
  assert.ok(Math.abs(at(1.5).opacity - 0.4) < 1e-12, 'the second strike replaces the first at once');
  assert.equal(at(3.6).opacity, 0);
});

test('masks: empty at e = 0, the whole cell at e = 1, and a ring of ink round the core mid-way', () => {
  for (const m of MASKS) {
    let lo = 0, hi = 1; for (let j = 0; j <= 20; j++) for (let i = 0; i <= 20; i++) { const u = i / 20 - 0.5, v = j / 20 - 0.5; lo = Math.max(lo, maskCoverage(m, u, v, 0, 0.01)); hi = Math.min(hi, maskCoverage(m, u, v, 1, 0.01)); }
    assert.equal(lo, 0, `${m} at e = 0`); assert.equal(hi, 1, `${m} at e = 1`);
  }
  assert.equal(maskCoverage('square', 0, 0, 0.5, 0.01), 1); assert.equal(maskCoverage('square', 0.45, 0.45, 0.5, 0.01), 0);
});

test('drawn cells: the frame is always there, the fill is inside it, and the core empties first', () => {
  const prep = prepareScore([{ t: 0, dur: 0.25, pitch: 60, vel: 1 }], { cols: 1, rows: 1, fade: 2, durScale: false, mask: 'square' });
  const w = 200, h = 200, L = gridLayout(w, h, prep.p), P = plane(w, h); drawGrid(P, prep, 0.4, w, h);
  const at = (u, v) => P.data[Math.floor(L.y0 + v * L.cell) * w + Math.floor(L.x0 + u * L.cell)];
  assert.ok(at(0.5, 0.5) < 0.05, `core ${at(0.5, 0.5)}`); assert.ok(at(0.15, 0.15) > 0.3, `ring ${at(0.15, 0.15)}`);
  const Q = plane(w, h); drawGrid(Q, prep, 99, w, h);
  const col = Math.floor(L.x0 + L.cell / 2), top = [-1, 0, 1, 2].reduce((a, d) => a + Q.data[(Math.floor(L.y0) + d) * w + col], 0);
  assert.ok(Math.abs(top - 1) < 0.05, `the one-pixel frame stays after the fade, its coverage summed over the rows it straddles: ${top}`);
  assert.ok(Q.data[Math.floor(L.y0 + L.cell / 2) * w + col] === 0, 'and the cell is empty');
});

// Sync (spec section 6, change 2): render frames at 60 Hz from the same note times the audio uses and find the first
// frame where each cell lights. The lag behind the audio onset must be at least 0 and under one frame.
test('sync: every cell lights on the first 60 Hz frame at or after its note, never before and never a frame late', () => {
  const rate = 48000, fps = 60, times = [0.3137, 0.81, 1.2345, 1.7, 2.0001, 2.61];
  const notes = times.map((t, i) => ({ t, dur: 0.1, pitch: 60 + 2 * i, vel: 1 }));
  // audio from the same score: a click per note, and its onsets read back off the samples
  const x = new Float32Array(rate * 3); for (const n of notes) for (let i = 0; i < 400; i++) x[Math.round(n.t * rate) + i] += Math.cos(i / 3) * Math.exp(-i / 80);
  const onsets = []; for (let i = 1; i < x.length; i++) if (Math.abs(x[i]) > 0.05 && !onsets.some(o => i / rate - o < 0.05)) onsets.push(i / rate);
  assert.equal(onsets.length, times.length);
  const prep = prepareScore(notes, { cols: 6, rows: 1, mapping: 'rank', fade: 0.3, durScale: false });
  for (let k = 0; k < notes.length; k++) {
    let f = 0; while (stateAt(prep, f / fps)[k].opacity <= 0) f++;
    const lag = f / fps - onsets[k];
    assert.ok(lag >= -0.5 / rate && lag < 1 / fps,   // half a sample: the click starts on the nearest sample to the note
      `note ${k}: lag ${(lag * 1000).toFixed(2)} ms`);
  }
});

// An idle cell must be the plain frame on bare ground: no residue of a mask or of partial ink at its border. Every
// mask shape is decayed to the end and compared with a cell that was never struck; and while a cell decays, the ring
// between its frame and its fill stays bare, so a fading remnant never sits on the frame.
test('an idle cell matches a never-struck cell exactly, frame and interior, for every mask; the gutter stays bare', () => {
  const w = 240, h = 240;
  const ref = plane(w, h); drawGrid(ref, prepareScore([], { cols: 1, rows: 1 }), 0, w, h);
  for (const mask of MASKS) {
    const prep = prepareScore([{ t: 0, dur: 0.25, pitch: 60, vel: 1 }], { cols: 1, rows: 1, fade: 1, durScale: false, mask });
    const done = plane(w, h); drawGrid(done, prep, 1, w, h);
    assert.ok(done.data.every((v, i) => v === ref.data[i]), `${mask}: decayed cell differs from a never-struck one`);
    const L = gridLayout(w, h, prep.p), fw = Math.max(1, prep.p.frame * h / 1080), g = fw + gutterPx(L, prep.p);
    for (const t of [0.05, 0.5, 0.8, 0.95, 0.99]) {
      const P = plane(w, h); drawGrid(P, prep, t, w, h);
      // pixels whose centres lie strictly inside the gutter ring (one pixel clear of the frame and of the fill edge)
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const qx = x + 0.5 - L.x0, qy = y + 0.5 - L.y0, inside = Math.min(qx, qy, L.cell - qx, L.cell - qy);
        if (inside > fw + 1 && inside < g - 1) assert.equal(P.data[y * w + x], ref.data[y * w + x], `${mask} at t = ${t}: ink in the gutter at ${x}, ${y}`);
      }
    }
  }
});

test('every mask grows by area: at progress e it covers the share e of the cell, so no shape ends in specks', () => {
  for (const m of MASKS) for (const e of [0.25, 0.5, 0.82, 0.95]) {
    let c = 0; const N = 96; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) c += maskCoverage(m, (i + 0.5) / N - 0.5, (j + 0.5) / N - 0.5, e, 1 / N);
    assert.ok(Math.abs(c / (N * N) - e) < 0.03, `${m} at e = ${e}: covers ${(c / N / N).toFixed(3)}`);
  }
});
