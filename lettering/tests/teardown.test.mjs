// A lettering is not rebuilt once it is destroyed, or once its host has left the page. The resize timer (160 ms) can
// outlive destroy(); before this guard, rebuild() then ran on a host no longer in the page, the font size read empty,
// the padding became NaN and the raked technique's getImageData threw. No canvas is needed: the build is counted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { letter } from '../lib/letter.mjs';

const make = (connected = true) => {
  const L = letter('AB', 'engraved', { reduced: true }); let builds = 0;
  L.host = { isConnected: connected, classList: { remove() {} } }; L._build = async () => { builds++; }; L._place = () => {};
  return { L, builds: () => builds };
};

test('rebuild runs while the lettering is live and its host is in the page', async () => {
  const { L, builds } = make(); await L.rebuild(); assert.equal(builds(), 1);
});
test('rebuild does nothing after destroy, as when the resize timer fires late', async () => {
  const { L, builds } = make(); L.destroy(); await L.rebuild(); assert.equal(builds(), 0);
});
test('rebuild does nothing when the host has left the page', async () => {
  const { L, builds } = make(false); await L.rebuild(); assert.equal(builds(), 0);
});
