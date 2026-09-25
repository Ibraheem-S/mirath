/**
 * Exact rational arithmetic for faraid (Islamic inheritance) computation.
 * All shares are computed as exact fractions so that rounding never
 * introduces a legal error into a distribution.
 */

export interface Frac {
  n: number; // numerator
  d: number; // denominator (always > 0)
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

export function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

export function frac(n: number, d = 1): Frac {
  if (d === 0) throw new Error("Fraction with zero denominator");
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

export const ZERO: Frac = { n: 0, d: 1 };
export const ONE: Frac = { n: 1, d: 1 };

export function add(a: Frac, b: Frac): Frac {
  return frac(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function sub(a: Frac, b: Frac): Frac {
  return frac(a.n * b.d - b.n * a.d, a.d * b.d);
}

export function mul(a: Frac, b: Frac): Frac {
  return frac(a.n * b.n, a.d * b.d);
}

export function div(a: Frac, b: Frac): Frac {
  if (b.n === 0) throw new Error("Division by zero fraction");
  return frac(a.n * b.d, a.d * b.n);
}

/** Multiply a fraction by an integer. */
export function scale(a: Frac, k: number): Frac {
  return frac(a.n * k, a.d);
}

/** -1, 0, 1 comparison */
export function cmp(a: Frac, b: Frac): number {
  const lhs = a.n * b.d;
  const rhs = b.n * a.d;
  return lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
}

export function isZero(a: Frac): boolean {
  return a.n === 0;
}

export function toNumber(a: Frac): number {
  return a.n / a.d;
}

/** Pretty-print as "1/2", "2/3", or whole numbers. */
export function fmt(a: Frac): string {
  if (a.d === 1) return String(a.n);
  return `${a.n}/${a.d}`;
}

/** Percentage string with up to 2 decimals, trimmed. */
export function fmtPct(a: Frac): string {
  const p = (a.n / a.d) * 100;
  const s = p.toFixed(4).replace(/\.?0+$/, "");
  return `${s}%`;
}

/**
 * Common-denominator representation of a set of fractions.
 * Returns the base (asl al-mas'ala) and numerators in input order.
 */
export function commonBase(fractions: Frac[]): { base: number; numerators: number[] } {
  let base = 1;
  for (const f of fractions) base = lcm(base, f.d);
  return { base, numerators: fractions.map((f) => f.n * (base / f.d)) };
}
