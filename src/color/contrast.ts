import { hexToLinearRgb, normalizeHex } from './oklch';

/** WCAG relative luminance from a #RRGGBB color. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToLinearRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(normalizeHex(a));
  const l2 = relativeLuminance(normalizeHex(b));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function formatContrast(ratio: number): string {
  const rounded = ratio >= 10 ? ratio.toFixed(1) : ratio.toFixed(2);
  return `${rounded} : 1`;
}
