const INSET = 2;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Builds an SVG path for a no-axes error-rate sparkline. Points are evenly spaced across the full
 * width; the tallest bucket sits at the top inset and zero at the bottom inset. A single bucket is
 * drawn as a flat line across the width. Identical input always yields identical text.
 */
export function sparklinePath(counts: readonly number[], width: number, height: number): string {
  if (counts.length === 0) return '';
  let max = 0;
  for (const count of counts) if (count > max) max = count;
  const span = height - INSET * 2;
  const yFor = (count: number): number => (max <= 0 ? height - INSET : INSET + (1 - count / max) * span);

  if (counts.length === 1) {
    const y = String(round2(yFor(counts[0] ?? 0)));
    return `M0 ${y}L${String(width)} ${y}`;
  }

  const last = counts.length - 1;
  return counts
    .map((count, index) => {
      const x = String(round2((index * width) / last));
      const y = String(round2(yFor(count)));
      return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
    })
    .join('');
}
