import { measurementLines } from '../data/plugins';
import { linesForCard, omitSupersededAccuracy, shownSpeed } from '../data/telemetry';
import type { Moment } from '../data/moment';
import type { Style } from '../style/types';
import { momentText } from './text';

export interface JamLine {
  start: number;
  end: number;
  /** Extra pixels between glyphs so this line, including the last, meets both edges. */
  gap: number;
}

export interface JamLayout {
  /** One size for every glyph. */
  fontSize: number;
  /** Each row's box. The rows together are the card height. */
  lineHeight: number;
  lines: JamLine[];
}

interface WrappedLine {
  start: number;
  end: number;
  width: number;
}

function densify(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/[\s\u00a0]+/g, '');
}

/**
 * The card's own readings, in order, with whitespace removed.
 * Labels stay out. Speed follows the same above-1-mph rule as the other layouts.
 */
export function jamFields(style: Style, moment: Moment, message: string): string[] {
  const text = momentText(moment);
  const telemetry = linesForCard(style.measurements, moment);
  const speed = shownSpeed(moment.speed);
  const fields: string[] = [];
  const push = (value: string | null | undefined) => {
    const dense = densify(value);
    if (dense) fields.push(dense);
  };
  push(message);
  push(text.placeFull);
  push(text.dateLong);
  push(text.timeShort);
  push(text.lat);
  push(text.lon);
  push(text.alt);
  push(speed);
  const readings = omitSupersededAccuracy(measurementLines(style.measurements, style.temperatureUnit, moment), telemetry);
  for (const line of readings) push(line.text);
  for (const line of telemetry) {
    if (line.id === 'spd' && speed) continue;
    for (const value of line.values) push(value);
  }
  return fields;
}

export function jamText(style: Style, moment: Moment, message: string): string {
  return jamFields(style, moment, message).join('');
}

/** Greedy character wrap. `advances` are widths at font size 1. */
export function wrapJam(advances: number[], size: number, width: number): WrappedLine[] {
  const lines: WrappedLine[] = [];
  const limit = Math.max(1, width);
  let index = 0;
  while (index < advances.length) {
    let end = index;
    let used = 0;
    while (end < advances.length) {
      const next = Math.max(0, advances[end] ?? 0) * size;
      if (end > index && used + next > limit) break;
      used += next;
      end += 1;
    }
    if (end === index) {
      end = index + 1;
      used = Math.max(0, advances[index] ?? 0) * size;
    }
    lines.push({ start: index, end, width: used });
    index = end;
  }
  return lines;
}

function fits(advances: number[], size: number, width: number, height: number): boolean {
  if (!(size > 0)) return false;
  const lines = wrapJam(advances, size, width);
  if (lines.length * size > height + 0.05) return false;
  const shared = advances.length >= 2;
  for (const line of lines) {
    if (line.width > width + 0.05) return false;
    if (shared && line.end - line.start < 2) return false;
  }
  return lines.length > 0;
}

/**
 * Largest type size whose greedy lines still fit the square.
 * Rows then split the height evenly, and each line's spare width becomes
 * the gap between its glyphs. A short string therefore sets larger type.
 * `advances` are per-glyph widths at font size 1, in the face being set.
 */
export function layoutJam(advances: number[], width: number, height: number): JamLayout {
  const cardW = width > 0 ? width : 1;
  const cardH = height > 0 ? height : 1;
  const widths = advances.length > 0 ? advances.map((advance) => (advance > 0 ? advance : 0.01)) : [0.5];
  let low = 0;
  let high = cardH;
  for (let step = 0; step < 48; step += 1) {
    const mid = (low + high) / 2;
    if (fits(widths, mid, cardW, cardH)) low = mid;
    else high = mid;
  }
  let size = low > 0.5 ? low : Math.min(cardH, cardW);
  let lines = wrapJam(widths, size, cardW);
  if (lines.length > 0) {
    const grown = cardH / lines.length;
    if (grown > size + 0.1 && fits(widths, grown, cardW, cardH)) {
      const next = wrapJam(widths, grown, cardW);
      if (next.length === lines.length) {
        size = grown;
        lines = next;
      }
    }
  }
  const lineHeight = cardH / Math.max(1, lines.length);
  return {
    fontSize: size,
    lineHeight,
    lines: lines.map((line) => {
      const count = line.end - line.start;
      const gap = count > 1 ? Math.max(0, (cardW - line.width) / (count - 1)) : 0;
      return { start: line.start, end: line.end, gap };
    }),
  };
}
