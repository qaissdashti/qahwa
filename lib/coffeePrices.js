// Canonical set of cup prices a creator can choose from. Hard-restricting
// to 0.5-KD multiples (up to 3.0) guarantees the public tipping page
// always renders clean one-decimal amounts for 1/3/5-cup pills with no
// rounding surprises, and keeps the choice fast on mobile (tap a chip,
// no typing).
export const COFFEE_PRICE_OPTIONS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];

// Strict membership check — used both by the chip UI (which chip is
// selected) and by the server validation (reject anything else). We
// round to one decimal first so JSON-parsed floats with the smallest
// IEEE drift still match the canonical list.
export function isAllowedCoffeePrice(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return false;
  const rounded = Number(n.toFixed(1));
  return COFFEE_PRICE_OPTIONS.includes(rounded);
}
