// lib/formatUtils.ts

/**
 * Convert a number to its ordinal form (1st, 2nd, 3rd, 4th, etc.)
 */
export function toOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
