import { measurementLines } from '../data/plugins';
import { linesForCard, omitSupersededAccuracy, shownSpeed } from '../data/telemetry';
import type { Moment } from '../data/moment';
import type { Style } from '../style/types';
import { momentText } from './text';

/**
 * One character used to fill a grid cell that the data does not cover.
 * It is never a copy of the data. A dot stays visible; a space would look empty.
 */
export const JAM_SEPARATOR = '\u00b7';

/** Cell width/height may sit this far from 1 before a square-er padded grid is preferred. */
const GOOD_ASPECT = Math.log(1.5);

export interface JamPlan {
  glyphs: string;
  columns: number;
  rows: number;
  /** Em size shared by every glyph. The cell height, so a short string is larger type. */
  fontSize: number;
}

interface GridChoice {
  columns: number;
  rows: number;
  extra: number;
  err: number;
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

function gridChoice(columns: number, count: number, width: number, height: number): GridChoice {
  const rows = Math.ceil(count / columns);
  const extra = columns * rows - count;
  const ratio = width / columns / (height / rows);
  return { columns, rows, extra, err: Math.abs(Math.log(ratio)) };
}

function prefer(next: GridChoice, current: GridChoice): boolean {
  if (next.extra !== current.extra) return next.extra < current.extra;
  if (Math.abs(next.err - current.err) > 1e-9) return next.err < current.err;
  const nextWide = next.rows >= next.columns;
  const currentWide = current.rows >= current.columns;
  if (nextWide !== currentWide) return nextWide;
  return false;
}

function pushChoice(choices: GridChoice[], columns: number, rows: number, count: number, width: number, height: number) {
  if (columns < 1 || rows < 1) return;
  const extra = columns * rows - count;
  if (extra < 0) return;
  const ratio = width / columns / (height / rows);
  if (!(ratio > 0)) return;
  choices.push({ columns, rows, extra, err: Math.abs(Math.log(ratio)) });
}

/**
 * Columns and rows whose product covers `count`.
 * An even split with a near-square cell wins. Otherwise the fewest separator
 * cells that still keep the cell aspect near square. Rows may be one step
 * past ceil(count/columns) so a short string can grow into a fuller square
 * instead of stretching into a single strip.
 */
export function planJamGrid(count: number, width: number, height: number): GridChoice {
  const length = Math.max(1, Math.floor(count));
  const cardW = width > 0 ? width : 1;
  const cardH = height > 0 ? height : 1;
  const maxColumns = Math.min(length, Math.max(1, Math.ceil(Math.sqrt((length * 1.5 * cardW) / cardH)) + 2));
  const choices: GridChoice[] = [];
  for (let columns = 1; columns <= maxColumns; columns += 1) {
    const minRows = Math.ceil(length / columns);
    const low = Math.max(1, Math.ceil((columns * cardH) / cardW / 1.5));
    const high = Math.max(low, Math.floor((columns * cardH * 1.5) / cardW));
    const rows = new Set<number>([minRows]);
    for (let row = Math.max(minRows, low); row <= Math.max(minRows, high); row += 1) rows.add(row);
    for (const row of rows) pushChoice(choices, columns, row, length, cardW, cardH);
  }
  if (choices.length === 0) return gridChoice(1, length, cardW, cardH);
  const good = choices.filter((choice) => choice.err <= GOOD_ASPECT + 1e-6);
  const pool = good.length > 0 ? good : choices;
  return pool.reduce((current, next) => (prefer(next, current) ? next : current));
}

function weaveInside(text: string, extra: number): string {
  const gaps = text.length - 1;
  if (gaps <= 0) return text + JAM_SEPARATOR.repeat(extra);
  const counts = new Array<number>(gaps).fill(0);
  for (let index = 0; index < extra; index += 1) counts[index % gaps] += 1;
  let out = text[0] ?? '';
  for (let gap = 0; gap < gaps; gap += 1) {
    out += JAM_SEPARATOR.repeat(counts[gap] ?? 0);
    out += text[gap + 1] ?? '';
  }
  return out;
}

/** Insert `extra` separator glyphs between fields. The data itself is not repeated. */
export function weaveFields(fields: string[], extra: number): string {
  const parts = fields.filter((field) => field.length > 0);
  if (parts.length === 0) return JAM_SEPARATOR.repeat(Math.max(0, extra));
  if (extra <= 0) return parts.join('');
  if (parts.length === 1) return weaveInside(parts[0] ?? '', extra);
  const gaps = parts.length - 1;
  const counts = new Array<number>(gaps).fill(0);
  for (let index = 0; index < extra; index += 1) counts[index % gaps] += 1;
  let out = parts[0] ?? '';
  for (let gap = 0; gap < gaps; gap += 1) {
    out += JAM_SEPARATOR.repeat(counts[gap] ?? 0);
    out += parts[gap + 1] ?? '';
  }
  return out;
}

/** One grid-filling string. Short data becomes larger cells, never a second copy. */
export function planJam(fields: string[], width: number, height: number): JamPlan {
  const parts = fields.filter((field) => field.length > 0);
  const count = parts.reduce((sum, field) => sum + field.length, 0);
  const cardH = height > 0 ? height : 1;
  if (count === 0) {
    return { glyphs: JAM_SEPARATOR, columns: 1, rows: 1, fontSize: cardH };
  }
  const grid = planJamGrid(count, width, cardH);
  return {
    glyphs: weaveFields(parts, grid.extra),
    columns: grid.columns,
    rows: grid.rows,
    fontSize: cardH / grid.rows,
  };
}
