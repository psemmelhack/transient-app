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

/** A row is tight when justification adds at most this fraction of the width. */
const TIGHT_SLACK = 0.2;

/**
 * Breaks that minimize the sum of squared leftover width.
 * Any character may end a line. A line wider than the card is not used
 * unless it is a single glyph that cannot be split.
 */
export function breakJam(advances: number[], size: number, width: number): WrappedLine[] {
  const n = advances.length;
  const limit = Math.max(1, width);
  const prefix = new Array<number>(n + 1);
  prefix[0] = 0;
  for (let index = 0; index < n; index += 1) prefix[index + 1] = prefix[index] + Math.max(0, advances[index] ?? 0);
  const cost = new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY);
  const from = new Array<number>(n + 1).fill(-1);
  cost[0] = 0;
  for (let end = 1; end <= n; end += 1) {
    for (let start = end - 1; start >= 0; start -= 1) {
      const used = (prefix[end] - prefix[start]) * size;
      const glyphs = end - start;
      if (glyphs > 1 && used > limit + 1e-4) break;
      const slack = limit - used;
      const penalty = slack >= -1e-4 ? slack * slack : limit * limit * 64;
      const next = cost[start] + penalty;
      if (!(next < cost[end])) continue;
      cost[end] = next;
      from[end] = start;
      if (used > limit + 1e-4) break;
    }
  }
  if (!(cost[n] < Number.POSITIVE_INFINITY)) return wrapJam(advances, size, width);
  const lines: WrappedLine[] = [];
  let end = n;
  while (end > 0) {
    const start = from[end];
    if (start < 0 || start >= end) return wrapJam(advances, size, width);
    lines.push({ start, end, width: (prefix[end] - prefix[start]) * size });
    end = start;
  }
  lines.reverse();
  return lines;
}

function rowsWithin(lines: WrappedLine[], size: number, height: number, lineUnit: number): boolean {
  return lines.length > 0 && lines.length * size * lineUnit <= height + 0.05;
}

function overflows(lines: WrappedLine[], width: number): boolean {
  return lines.some((line) => line.width > width + 1e-4);
}

/** Every row is near the full width, and none is far shorter than the average row. */
function isTight(lines: WrappedLine[], width: number): boolean {
  if (lines.length === 0 || overflows(lines, width)) return false;
  const count = lines[lines.length - 1]?.end ?? 0;
  const average = count / lines.length;
  const minCount = Math.max(1, Math.round(average * 0.7));
  const floor = width * (1 - TIGHT_SLACK) - Math.max(0.05, width * 0.001);
  for (const line of lines) {
    if (line.end - line.start < minCount) return false;
    if (line.width < floor) return false;
  }
  return true;
}

interface Packed {
  size: number;
  lines: WrappedLine[];
}

function evaluate(advances: number[], size: number, width: number, height: number, lineUnit: number): { lines: WrappedLine[]; tight: boolean; fit: boolean } | null {
  if (!(size > 0)) return null;
  const lines = breakJam(advances, size, width);
  if (lines.length === 0 || lines[lines.length - 1]?.end !== advances.length) return null;
  if (!rowsWithin(lines, size, height, lineUnit)) return null;
  const fit = !overflows(lines, width);
  return { lines, tight: fit && isTight(lines, width), fit };
}

function deduped(sizes: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const size of sizes) {
    if (!(size > 0)) continue;
    const key = Math.round(size * 1000);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(size);
  }
  out.sort((a, b) => b - a);
  return out;
}

/**
 * Sizes worth scoring. The scan is coarse, and each scan size also nominates
 * the size that would bring its fullest row exactly to the card width, so a
 * narrow band of tight sizes is not skipped.
 */
function candidateSizes(advances: number[], width: number, maxSize: number): number[] {
  const total = advances.reduce((sum, advance) => sum + Math.max(0, advance), 0) || 1;
  const floor = Math.min(maxSize, Math.max(1, (width * 0.75) / total));
  const sizes: number[] = [];
  let cursor = maxSize;
  for (let step = 0; step < 180 && cursor >= floor * 0.97; step += 1) {
    sizes.push(cursor);
    const lines = breakJam(advances, cursor, width);
    let fullest = 0;
    let thinnest = Number.POSITIVE_INFINITY;
    let fullLine: WrappedLine | null = null;
    let thinLine: WrappedLine | null = null;
    for (const line of lines) {
      if (line.width > fullest) {
        fullest = line.width;
        fullLine = line;
      }
      if (line.width < thinnest) {
        thinnest = line.width;
        thinLine = line;
      }
    }
    const nominate = (line: WrappedLine | null) => {
      if (!line || !(cursor > 0)) return;
      const base = line.width / cursor;
      if (base > 0 && line.width < width - 0.25) sizes.push(Math.min(maxSize, width / base));
      const next = advances[line.end];
      if (line.end < advances.length && next > 0) sizes.push(Math.min(maxSize, width / (base + next)));
    };
    nominate(fullLine);
    if (thinLine !== fullLine) nominate(thinLine);
    cursor *= 0.97;
  }
  return deduped(sizes);
}

/**
 * Largest size whose balanced rows stay near the full width.
 * Rows keep their natural height and sit at the top, so a square that
 * cannot be filled without sparse rows keeps empty space at the bottom.
 */
function chooseSize(advances: number[], width: number, height: number, lineUnit: number): Packed {
  const maxSize = height / lineUnit;
  const sizes = candidateSizes(advances, width, maxSize);
  let bestTight: Packed | null = null;
  let bestFit: Packed | null = null;
  let ceiling = maxSize;
  for (const size of sizes) {
    const result = evaluate(advances, size, width, height, lineUnit);
    if (result?.fit && (!bestFit || size > bestFit.size)) bestFit = { size, lines: result.lines };
    if (!result?.tight) {
      if (!bestTight && size < ceiling) ceiling = size;
      continue;
    }
    bestTight = { size, lines: result.lines };
    let lo = size;
    let hi = Math.max(size, ceiling);
    for (let refine = 0; refine < 14; refine += 1) {
      const mid = (lo + hi) / 2;
      const finer = evaluate(advances, mid, width, height, lineUnit);
      if (finer?.tight) {
        lo = mid;
        bestTight = { size: mid, lines: finer.lines };
      } else {
        hi = mid;
      }
    }
    break;
  }
  if (bestTight) return bestTight;
  if (bestFit) return bestFit;
  const lines = breakJam(advances, Math.min(maxSize, width), width);
  return { size: Math.min(maxSize, width), lines };
}

function pack(advances: number[], width: number, height: number, lineUnit: number): JamLayout {
  const cardW = width > 0 ? width : 1;
  const cardH = height > 0 ? height : 1;
  const unit = lineUnit > 0 ? lineUnit : 1;
  const widths = advances.length > 0 ? advances.map((advance) => (advance > 0 ? advance : 0.01)) : [0.5];
  const chosen = chooseSize(widths, cardW, cardH, unit);
  return {
    fontSize: chosen.size,
    lineHeight: chosen.size * unit,
    lines: chosen.lines.map((line) => justifyLine(line, cardW)),
  };
}

/**
 * Largest type whose rows are each near the full width.
 * A short string therefore sets larger type. Rows stack from the top.
 * `advances` are per-glyph widths at font size 1, in the face being set.
 */
export function layoutJam(advances: number[], width: number, height: number): JamLayout {
  return pack(advances, width, height, 1);
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

/**
 * Same breaking as Jam, with each row only as tall as the cap.
 * The largest tight size wins. Rows that would have to go sparse to
 * reach the bottom of the square stop short and leave that space empty.
 */
export function layoutCrush(advances: number[], width: number, height: number, capRatio: number): JamLayout {
  const ratio = capRatio > 0 && capRatio <= 1 ? capRatio : 1;
  return pack(advances, width, height, ratio);
}
