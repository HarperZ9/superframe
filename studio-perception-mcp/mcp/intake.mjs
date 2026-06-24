// intake.mjs — zero-dep raster intake: pure-JS BMP <-> RGBA + an OS shim (Windows) for files/screen.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const u32 = (b, o) => b[o] | (b[o+1]<<8) | (b[o+2]<<16) | (b[o+3]<<24);
const i32 = (b, o) => { const v = u32(b, o) >>> 0; return v > 0x7fffffff ? v - 0x100000000 : v; };

export function parseBMP(buf) {
  if (buf[0] !== 0x42 || buf[1] !== 0x4d) throw new Error("not a BMP (bad magic)");
  const pixelOffset = u32(buf, 10), dibSize = u32(buf, 14);
  const width = i32(buf, 18); let height = i32(buf, 22);
  const bpp = buf[28] | (buf[29] << 8);
  const topDown = height < 0; height = Math.abs(height);
  if (bpp !== 24 && bpp !== 32) throw new Error(`unsupported bpp ${bpp}`);
  const bytesPP = bpp / 8, rowSize = Math.floor((bpp * width + 31) / 32) * 4;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcY = topDown ? y : height - 1 - y;
    let row = pixelOffset + srcY * rowSize;
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4, b = buf[row], g = buf[row+1], r = buf[row+2];
      data[o] = r; data[o+1] = g; data[o+2] = b; data[o+3] = bytesPP === 4 ? buf[row+3] : 255;
      row += bytesPP;
    }
  }
  return { data, width, height };
}

export function writeBMP24({ data, width, height }) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4, pixelOffset = 54;
  const size = pixelOffset + rowSize * height, buf = Buffer.alloc(size);
  buf[0] = 0x42; buf[1] = 0x4d; buf.writeUInt32LE(size, 2); buf.writeUInt32LE(pixelOffset, 10);
  buf.writeUInt32LE(40, 14); buf.writeInt32LE(width, 18); buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26); buf.writeUInt16LE(24, 28); buf.writeUInt32LE(rowSize * height, 34);
  for (let y = 0; y < height; y++) {
    let row = pixelOffset + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      buf[row++] = data[o+2]; buf[row++] = data[o+1]; buf[row++] = data[o]; // BGR
    }
  }
  return buf;
}

// Windows OS shim: load any image OR grab the screen via .NET, save BMP, parse it. Zero npm.
function runPowerShell(script) {
  const r = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "buffer", maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error("intake shim failed: " + (r.stderr && r.stderr.toString()));
}
export async function toRGBA(input) {
  if (process.platform !== "win32") throw new Error(`raster intake not implemented on ${process.platform} (Windows-first; mac/linux is a follow-up)`);
  const dir = mkdtempSync(join(tmpdir(), "spmcp-")), out = join(dir, "frame.bmp");
  if (input.base64) {
    const src = join(dir, "in.img"); writeFileSync(src, Buffer.from(input.base64, "base64"));
    runPowerShell(`Add-Type -A System.Drawing; $b=[System.Drawing.Image]::FromFile('${src}'); $b.Save('${out}',[System.Drawing.Imaging.ImageFormat]::Bmp)`);
  } else if (input.path) {
    runPowerShell(`Add-Type -A System.Drawing; $b=[System.Drawing.Image]::FromFile('${input.path.replace(/'/g, "''")}'); $b.Save('${out}',[System.Drawing.Imaging.ImageFormat]::Bmp)`);
  } else if (input.screen) {
    const r = input.screen, region = r && r.w ? `${r.x||0},${r.y||0},${r.w},${r.h}` : null;
    const grab = region
      ? `$bmp=New-Object System.Drawing.Bitmap(${r.w},${r.h}); $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen(${r.x||0},${r.y||0},0,0,(New-Object System.Drawing.Size(${r.w},${r.h})))`
      : `$bnd=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp=New-Object System.Drawing.Bitmap($bnd.Width,$bnd.Height); $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($bnd.X,$bnd.Y,0,0,$bnd.Size)`;
    runPowerShell(`Add-Type -A System.Drawing; Add-Type -A System.Windows.Forms; ${grab}; $bmp.Save('${out}',[System.Drawing.Imaging.ImageFormat]::Bmp)`);
  } else throw new Error("toRGBA: input must be {path} | {base64} | {screen}");
  return parseBMP(readFileSync(out));
}
