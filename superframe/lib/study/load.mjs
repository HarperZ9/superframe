// load.mjs: a subject image to 8-bit sRGB RGBA, with the source file's SHA-256 and the decoder that read it.
// PNG (8-bit, not interlaced) is read natively. Any other format goes through OpenCV (cv2) in the Python that
// SUPERFRAME_PY names (else python on PATH), written to a temporary PNG and read back; study.json names
// which decoder ran, because a JPEG decoded by two libraries can differ by a code value or two.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { decodePNG } from '../../adapters/core.mjs';

export const PY = process.env.SUPERFRAME_PY ?? 'python';
const CV = 'import sys,cv2\nim=cv2.imread(sys.argv[1],cv2.IMREAD_COLOR)\nif im is None: sys.exit("cv2 could not read "+sys.argv[1])\ncv2.imwrite(sys.argv[2],im)\n';

export const sha256 = buf => createHash('sha256').update(buf).digest('hex');

export function loadSubject(path) {
  const buf = readFileSync(path), hash = sha256(buf), isPNG = buf.readUInt32BE(0) === 0x89504e47;
  if (isPNG) {
    try { return { ...decodePNG(buf), sha256: hash, file: basename(path), decoder: 'superframe decodePNG (adapters/core.mjs)' }; }
    catch (e) { console.error(`study: native PNG read failed for ${path} (${e.message}); trying OpenCV`); }
  }
  const dir = mkdtempSync(join(tmpdir(), 'study-')), png = join(dir, 'subject.png');
  try {
    execFileSync(PY, ['-I', '-c', CV, path, png], { stdio: ['ignore', 'ignore', 'pipe'] });
    return { ...decodePNG(readFileSync(png)), sha256: hash, file: basename(path), decoder: 'OpenCV cv2.imread (IMREAD_COLOR), via SUPERFRAME_PY' };
  } catch (e) {
    console.error(`study: could not decode ${path}: ${e.message}`);
    throw e;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// A subject made in memory (tests, graph nodes): no file, so the hash is of the pixels.
export function subjectFromRGBA(w, h, rgba, name = 'in-memory') {
  return { w, h, rgba, sha256: sha256(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength)), file: name, decoder: 'none (pixels supplied)' };
}
