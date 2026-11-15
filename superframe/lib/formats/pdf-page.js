// Origin: HarperZ9.github.io system/exporters.js (exportPDF) at commit c8866cc4, carried on 2026-11-14.
// pdf-page.js
// A minimal single-page PDF that embeds one JPEG (a DCTDecode image XObject).
// Byte offsets for the xref table are computed from real chunk lengths, so the
// file is valid without a library. No font is embedded and no text is set.
//
// On the site the JPEG came from canvas.toBlob. Here the caller passes the
// JPEG bytes with the picture's pixel size; the engine has no JPEG encoder of
// its own yet, so the bytes come from outside it.
//
// paper "a4" | "a3" | "letter" sizes the page in points (72 to the inch); the
// image is fitted inside a 6% margin with its aspect kept, and a landscape
// image turns the page to landscape.

const PAPERS = { a4: [595, 842], a3: [842, 1191], letter: [612, 792] };

export function jpegToPdf(jpeg, iw, ih, opts = {}) {
  if (!(jpeg instanceof Uint8Array) || jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
    throw new TypeError("jpegToPdf needs JPEG bytes (a Uint8Array that starts FF D8)");
  }
  if (!(iw > 0) || !(ih > 0)) throw new RangeError("jpegToPdf needs the image width and height in pixels");
  let [pw, ph] = PAPERS[opts.paper || "a4"] || PAPERS.a4;
  if (iw > ih && pw < ph) { const t = pw; pw = ph; ph = t; } // landscape image -> landscape page
  const margin = 0.06;
  const availW = pw * (1 - 2 * margin), availH = ph * (1 - 2 * margin);
  const scale = Math.min(availW / iw, availH / ih);
  const dw = iw * scale, dh = ih * scale;
  const dx = (pw - dw) / 2, dy = (ph - dh) / 2;

  const enc = (s) => { const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 0xff; return a; };
  const chunks = [];
  let offset = 0;
  const offsets = [];
  const push = (bytes) => { chunks.push(bytes); offset += bytes.length; };
  const pushStr = (s) => push(enc(s));
  const startObj = () => { offsets.push(offset); };

  pushStr("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
  startObj(); pushStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  startObj(); pushStr("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  startObj(); pushStr("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pw + " " + ph
    + "] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n");
  startObj();
  pushStr("4 0 obj\n<< /Type /XObject /Subtype /Image /Width " + iw + " /Height " + ih
    + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpeg.length + " >>\nstream\n");
  push(jpeg);
  pushStr("\nendstream\nendobj\n");
  const content = "q\n" + dw.toFixed(2) + " 0 0 " + dh.toFixed(2) + " " + dx.toFixed(2) + " " + dy.toFixed(2) + " cm\n/Im0 Do\nQ\n";
  startObj(); pushStr("5 0 obj\n<< /Length " + content.length + " >>\nstream\n" + content + "endstream\nendobj\n");
  const xrefStart = offset;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (const o of offsets) xref += String(o).padStart(10, "0") + " 00000 n \n";
  pushStr(xref);
  pushStr("trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xrefStart + "\n%%EOF\n");

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}
