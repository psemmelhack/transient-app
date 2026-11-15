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

/** Jam's string in capitals. Crush is all caps, so the case is part of the text. */
export function crushText(style: Style, moment: Moment, message: string): string {
  return jamText(style, moment, message).toLocaleUpperCase('en-US');
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
    lines: lines.map((line) => justifyLine(line, cardW)),
  };
}

export interface CapBand {
  /** Cap height as a fraction of the font size. */
  ratio: number;
  /** Top of a `line-height: 1` box to the top of an H, as a fraction of the font size. */
  top: number;
  /** Ink of H above the baseline, as a fraction of the font size. */
  capAscent: number;
  /** Ink of H below the baseline, as a fraction of the font size. */
  capDescent: number;
}

export interface GlyphInk {
  ascent: number;
  descent: number;
}

/**
 * Where an H sits in a line-height of 1.
 * Chrome centers the font bounding box in that line, which is how the cap shift is derived.
 */
export function capBand(metrics: {
  fontSize: number;
  capAscent: number;
  capDescent: number;
  fontAscent: number;
  fontDescent: number;
}): CapBand {
  const size = metrics.fontSize > 0 ? metrics.fontSize : 1;
  const fontAscent = metrics.fontAscent / size;
  const fontDescent = metrics.fontDescent / size;
  const capAscent = metrics.capAscent / size;
  const capDescent = metrics.capDescent / size;
  const baseline = (1 - (fontAscent + fontDescent)) / 2 + fontAscent;
  return {
    ratio: Math.min(1, Math.max(0.05, capAscent + capDescent)),
    top: baseline - capAscent,
    capAscent,
    capDescent,
  };
}

/**
 * `translateY` that puts the cap band in the row.
 * A comma or a pipe keeps the same size and is nudged so its ink stays in the band.
 */
export function capShift(band: CapBand, ink: GlyphInk, fontSize: number): number {
  const above = (ink.ascent - band.capAscent) * fontSize;
  const below = (ink.descent - band.capDescent) * fontSize;
  const tolerance = Math.max(0.5, fontSize * 0.01);
  let nudge = 0;
  if (above > tolerance || below > tolerance) {
    if (above + below <= tolerance) nudge = below > tolerance ? -below : above;
    else nudge = (above - below) / 2;
  }
  return -band.top * fontSize + nudge;
}

function justifyLine(line: WrappedLine, width: number): JamLine {
  const count = line.end - line.start;
  const gap = count > 1 ? Math.max(0, (width - line.width) / (count - 1)) : 0;
  return { start: line.start, end: line.end, gap };
}

function expandLines(lines: WrappedLine[], advances: number[], size: number, want: number): WrappedLine[] {
  const out = lines.map((line) => ({ ...line }));
  while (out.length < want) {
    let best = -1;
    let bestCount = 1;
    for (let index = 0; index < out.length; index += 1) {
      const count = out[index].end - out[index].start;
      if (count > bestCount) {
        bestCount = count;
        best = index;
      }
    }
    if (best < 0) break;
    const line = out[best];
    const mid = line.start + Math.ceil((line.end - line.start) / 2);
    const widthOf = (start: number, end: number) =>
      advances.slice(start, end).reduce((sum, advance) => sum + Math.max(0, advance), 0) * size;
    out.splice(
      best,
      1,
      { start: line.start, end: mid, width: widthOf(line.start, mid) },
      { start: mid, end: line.end, width: widthOf(mid, line.end) },
    );
  }
  return out;
}

/**
 * All-caps packing. Row height is the cap height, the rows tile the square,
 * and the largest size that can do that wins. A short string therefore uses fewer,
 * taller rows. A one-glyph row is scaled to the width by the view.
 */
export function layoutCrush(advances: number[], width: number, height: number, capRatio: number): JamLayout {
  const cardW = width > 0 ? width : 1;
  const cardH = height > 0 ? height : 1;
  const ratio = capRatio > 0 && capRatio <= 1 ? capRatio : 1;
  const widths = advances.length > 0 ? advances.map((advance) => (advance > 0 ? advance : 0.01)) : [0.5];
  let chosen: { size: number; lines: WrappedLine[] } | null = null;
  for (let rows = 1; rows <= widths.length; rows += 1) {
    const size = cardH / (rows * ratio);
    const wrapped = wrapJam(widths, size, cardW);
    if (wrapped.length > rows) continue;
    chosen = { size, lines: expandLines(wrapped, widths, size, rows) };
    break;
  }
  if (!chosen) {
    return layoutJam(widths, cardW, cardH);
  }
  const lineHeight = cardH / Math.max(1, chosen.lines.length);
  return {
    fontSize: chosen.size,
    lineHeight,
    lines: chosen.lines.map((line) => justifyLine(line, cardW)),
  };
}
