/**
 * Size a hero line from DOM layout.
 * Canvas ink on iOS ignores a variable font's weight axis, so the width can
 * come from the real face while the line box comes from a different one.
 * The box used here is the one the browser laid out for that face.
 */

export interface DomLayoutReading {
  probeSize: number;
  /** Text advance at the probe size, from the element's layout width. */
  advance: number;
  /** Line box at line-height 1, before any trim. */
  lineBox: number;
  /** Height after cap-to-baseline trim. 0 when trim was not applied. */
  trimmed: number;
  /** The line is capitals and digits, so a cap trim will not cut a descender. */
  trim: boolean;
}

export type LineSource = 'dom-trim' | 'dom-line';

export interface DomSizedLine {
  fontSize: number;
  /** Layout height at `fontSize`. The glyphs are not cropped inside a shorter box. */
  height: number;
  source: LineSource;
}

/** Cap-to-baseline trim clips descenders. Digits, capitals, and coordinate marks do not have any. */
export function lineCanTrim(text: string): boolean {
  return text.length > 0 && /^[0-9A-Z .:+\u2212\u2013\u2014\u00b0'’/|-]+$/.test(text);
}

/**
 * Fit the DOM advance to the target width and take the height from the same layout.
 * A trim that did not shrink the line, or that collapsed it, keeps the full line box.
 */
export function sizeFromDomLayout(reading: DomLayoutReading, targetWidth: number): DomSizedLine {
  const probe = reading.probeSize > 0 ? reading.probeSize : 200;
  const advance = reading.advance > 1 ? reading.advance : probe;
  const fontSize = (probe * Math.max(1, targetWidth)) / advance;
  const k = fontSize / probe;
  const trimmed = reading.trimmed;
  const trimOk =
    reading.trim &&
    trimmed >= probe * 0.45 &&
    trimmed <= probe * 1.15 &&
    reading.lineBox > trimmed + 0.5;
  if (trimOk) {
    return { fontSize, height: Math.max(1, trimmed * k), source: 'dom-trim' };
  }
  const line = reading.lineBox > 1 ? reading.lineBox : probe;
  return { fontSize, height: Math.max(1, line * k), source: 'dom-line' };
}
