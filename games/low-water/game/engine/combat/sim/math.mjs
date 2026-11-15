// Deterministic math for the combat sim and AI. Every function here uses only IEEE 754 double
// operations that both JS and C++ round the same way: + - * /, sqrt, floor, and comparisons. No
// libm call, no Math.pow, no fused multiply-add. Evaluated in the order written, the C++ port
// (compiled with -ffp-contract=off, no -ffast-math) reproduces every result bit for bit.
// The algorithms and constants are specified in design/DETMATH.md; change one there and here together.
//   dsin dcos datan datan2 dasin dacos dexp dhypot, and DPI (= Math.PI, the double nearest pi)

export const DPI = 3.141592653589793;
const PIO2 = DPI / 2; // exact: a power-of-two scale of DPI
const PIO2_HI = 1.57079632673412561417; // pi/2 split, Cody-Waite: the high part has 33 significant bits
const PIO2_LO = 6.07710050650619224932e-11;
const INV_PIO2 = 6.36619772367581382433e-1;
const PIO6 = DPI / 6;
const SQRT3 = Math.sqrt(3); // sqrt is correctly rounded in IEEE 754, so this is exact to the bit in both languages
const LN2_HI = 6.93147180369123816490e-1;
const LN2_LO = 1.90821492927058770002e-10;
const INV_LN2 = 1.44269504088896338700;

// sin and cos kernels on [-pi/4, pi/4]: the fdlibm minimax coefficients
const S1 = -1.66666666666666324348e-1, S2 = 8.33333333332248946124e-3, S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6, S5 = -2.50507602534068634195e-8, S6 = 1.58969099521155010221e-10;
const C1 = 4.16666666666666019037e-2, C2 = -1.38888888888741095749e-3, C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7, C5 = 2.08757232129817482790e-9, C6 = -1.13596475577881948265e-11;

const ksin = (r) => { const z = r * r; return r + r * z * (S1 + z * (S2 + z * (S3 + z * (S4 + z * (S5 + z * S6))))); };
const kcos = (r) => { const z = r * r; return 1 - 0.5 * z + z * z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6))))); };

// x = k * pi/2 + r with |r| <= about pi/4; k is taken mod 4. Exact for |k| < 2^20 (|x| under about 1.6e6).
function reduce(x) {
  const k = Math.floor(x * INV_PIO2 + 0.5);
  const r = (x - k * PIO2_HI) - k * PIO2_LO;
  return [r, ((k % 4) + 4) % 4];
}

export function dsin(x) {
  if (!Number.isFinite(x)) return NaN;
  const [r, q] = reduce(x);
  return q === 0 ? ksin(r) : q === 1 ? kcos(r) : q === 2 ? -ksin(r) : -kcos(r);
}

export function dcos(x) {
  if (!Number.isFinite(x)) return NaN;
  const [r, q] = reduce(x);
  return q === 0 ? kcos(r) : q === 1 ? -ksin(r) : q === 2 ? -kcos(r) : ksin(r);
}

// atan series on |t| <= tan(pi/12): sum of (-1)^n t^(2n+1) / (2n+1), n = 0..15, by Horner in t^2.
// Coefficients are 1 / (2n+1) as one correctly rounded double division each.
const AT = Array.from({ length: 16 }, (_, n) => (n % 2 ? -1 : 1) / (2 * n + 1));
const TAN_PI12 = 2 - SQRT3; // the reduction bound; above it the pi/6 identity applies
function katan(t) {
  const z = t * t; let p = AT[15];
  for (let n = 14; n >= 0; n--) p = AT[n] + z * p;
  return t * p;
}

export function datan(x) {
  if (Number.isNaN(x)) return NaN;
  if (x < 0) return -datan(-x);
  if (x === Infinity) return PIO2;
  let base = 0, sign = 1;
  if (x > 1) { x = 1 / x; base = PIO2; sign = -1; }
  let r;
  if (x > TAN_PI12) r = PIO6 + katan((x * SQRT3 - 1) / (x + SQRT3));
  else r = katan(x);
  return base + sign * r;
}

// atan2 with the C quadrant rules, signed zeros included
export function datan2(y, x) {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  const yneg = y < 0 || Object.is(y, -0);
  if (y === 0) {
    if (x > 0 || Object.is(x, 0)) return y; // +0 or -0
    return yneg ? -DPI : DPI;
  }
  if (x === 0) return yneg ? -PIO2 : PIO2;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    if (!Number.isFinite(y) && !Number.isFinite(x)) { const a = x > 0 ? DPI / 4 : 3 * DPI / 4; return yneg ? -a : a; }
    if (!Number.isFinite(y)) return yneg ? -PIO2 : PIO2;
    return x > 0 ? (yneg ? -0 : 0) : (yneg ? -DPI : DPI);
  }
  const a = datan(Math.abs(y / x));
  if (x > 0) return yneg ? -a : a;
  return yneg ? -(DPI - a) : DPI - a;
}

export const dasin = (x) => (x > 1 || x < -1 ? NaN : datan2(x, Math.sqrt((1 - x) * (1 + x))));
export const dacos = (x) => (x > 1 || x < -1 ? NaN : datan2(Math.sqrt((1 - x) * (1 + x)), x));

// exp: x = k ln2 + r, |r| <= ln2 / 2; exp(r) by its Taylor series to degree 13, Horner from the top;
// coefficients 1/n! built by successive correctly rounded divisions; scaled by 2^k built from its bits.
const EC = [1]; for (let n = 1; n <= 13; n++) EC.push(EC[n - 1] / n);
const BUF = new DataView(new ArrayBuffer(8));
function pow2(k) { BUF.setUint32(0, (k + 1023) << 20); BUF.setUint32(4, 0); return BUF.getFloat64(0); } // -1022 <= k <= 1023, exact
export function dexp(x) {
  if (Number.isNaN(x)) return NaN;
  if (x > 709.782712893384) return Infinity;
  if (x < -745.1332191019412) return 0;
  const k = Math.floor(x * INV_LN2 + 0.5);
  const r = (x - k * LN2_HI) - k * LN2_LO;
  let p = EC[13];
  for (let n = 12; n >= 0; n--) p = EC[n] + r * p;
  if (k > 1023) return p * pow2(1023) * pow2(k - 1023);
  if (k < -1000) return p * pow2(k + 1000) * pow2(-1000);
  return p * pow2(k);
}

// hypot as the plain root of the sum of squares. Math.hypot is not specified to the bit.
export const dhypot = (x, y) => Math.sqrt(x * x + y * y);
