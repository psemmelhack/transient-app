import { getFont, resolveFont, type CssFont, type FontRole } from './fonts';

/** Smallest note size that stays readable on the 1080 square and a phone preview. */
export const NOTE_MIN_PX = 28;
export const NOTE_LEADING = 1.4;

const MEASURE = {
  mono: { em: 0.6, chars: 34 },
  /** Inter is wider than a serif italic, so its measure is a little wider to stay near six lines. */
  sans: { em: 0.5, chars: 36 },
  serif: { em: 0.42, chars: 32 },
} as const;

export type NoteRhythm = keyof typeof MEASURE;

export function noteRhythm(family: string): NoteRhythm {
  const name = family.toLowerCase();
  if (name.includes('mono')) return 'mono';
  if (name.includes('inter') || name.includes('sans')) return 'sans';
  return 'serif';
}

export function isMonoFamily(family: string): boolean {
  return noteRhythm(family) === 'mono';
}

/**
 * A condensed display face is a poor paragraph. Silky and text italics keep
 * their own voice; everything else that cannot set a note uses the mono.
 */
export function noteFace(displayId: string, monoId: string, role: FontRole): CssFont {
  if (role === 'mono' || role === 'mono-medium') return resolveFont(displayId, monoId, role);
  const display = getFont(displayId);
  if (display.category === 'sans') return resolveFont(displayId, monoId, 'display');
  const textItalic = display.category === 'silky' || display.category === 'classic' || display.id === 'fraunces';
  if (role === 'display-italic' && display.italic && textItalic) return resolveFont(displayId, monoId, 'display-italic');
  const condensed = display.category === 'tall' || display.category === 'bold';
  if (condensed || (role === 'display-italic' && !display.italic)) return resolveFont(displayId, monoId, 'mono-medium');
  return resolveFont(displayId, monoId, 'display');
}

/** Short notes hold the ceiling. From 60 characters the size steps down to the floor. */
export function noteFontSize(length: number, ceiling: number): number {
  const cap = Math.max(NOTE_MIN_PX, Math.round(ceiling));
  if (length <= 60) return cap;
  if (length >= 180) return NOTE_MIN_PX;
  const t = (length - 60) / (180 - 60);
  return Math.max(NOTE_MIN_PX, Math.round(cap + (NOTE_MIN_PX - cap) * t));
}

export function noteMaxWidth(fontSize: number, rhythm: NoteRhythm, contentWidth: number): number {
  const { em, chars } = MEASURE[rhythm];
  const wanted = Math.round(fontSize * em * chars);
  return Math.max(fontSize * 8, Math.min(contentWidth, wanted));
}

const RUNT_RATIO = 0.4;

interface NoteAtom {
  text: string;
  spaceBefore: boolean;
}

/** Character columns that fit the measure. The same count drives preview and export. */
export function noteColumns(fontSize: number, maxWidth: number, rhythm: NoteRhythm): number {
  const unit = Math.max(1, fontSize * MEASURE[rhythm].em);
  return Math.max(8, Math.floor(maxWidth / unit));
}

/**
 * Balanced note lines. Greedy wrap first, then the narrowest measure that keeps
 * that line count, then words are pulled down until the last line is at least
 * ~40% of the original measure. A word longer than the measure is broken into
 * even pieces. Preview and export both render these lines, so they match.
 */
export function wrapNote(text: string, fontSize: number, maxWidth: number, rhythm: NoteRhythm): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const columns = noteColumns(fontSize, maxWidth, rhythm);
  const atoms = noteAtoms(trimmed, columns);
  const greedy = packAtoms(atoms, columns).map(renderAtoms);
  if (greedy.length <= 1) return greedy;
  let low = 1;
  let high = columns;
  let balanced = greedy;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const lines = packAtoms(atoms, mid).map(renderAtoms);
    if (lines.length <= greedy.length) {
      balanced = lines;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return fillLastLine(balanced, columns);
}

/** Greedy word wrap, so a 200-character sentence lands on a real line count. */
export function wrappedLineCount(text: string, fontSize: number, maxWidth: number, rhythm: NoteRhythm): number {
  return wrapNote(text, fontSize, maxWidth, rhythm).length;
}

function noteAtoms(text: string, columns: number): NoteAtom[] {
  const atoms: NoteAtom[] = [];
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const pieces = word.length <= columns ? [word] : evenPieces(word, columns);
    pieces.forEach((piece, index) => {
      atoms.push({ text: piece, spaceBefore: index === 0 && atoms.length > 0 });
    });
  }
  return atoms;
}

function evenPieces(word: string, columns: number): string[] {
  const count = Math.max(1, Math.ceil(word.length / columns));
  const size = Math.ceil(word.length / count);
  const pieces: string[] = [];
  for (let index = 0; index < word.length; index += size) pieces.push(word.slice(index, index + size));
  return pieces;
}

function renderAtoms(atoms: NoteAtom[]): string {
  let line = '';
  for (const atom of atoms) {
    if (line && atom.spaceBefore) line += ' ';
    line += atom.text;
  }
  return line;
}

function packAtoms(atoms: NoteAtom[], columns: number): NoteAtom[][] {
  const lines: NoteAtom[][] = [];
  let current: NoteAtom[] = [];
  for (const atom of atoms) {
    const candidate = current.concat(atom);
    if (current.length > 0 && renderAtoms(candidate).length > columns) {
      lines.push(current);
      current = [{ text: atom.text, spaceBefore: false }];
      continue;
    }
    current = candidate;
  }
  if (current.length) lines.push(current);
  return lines;
}

function fillLastLine(lines: string[], columns: number): string[] {
  const rows = lines.map((line) => line.split(' ').filter(Boolean));
  const minimum = Math.ceil(columns * RUNT_RATIO);
  const width = (words: string[]) => words.join(' ').length;
  while (rows.length > 1 && width(rows[rows.length - 1]) < minimum) {
    const previous = rows[rows.length - 2];
    if (previous.length === 0) {
      rows.splice(rows.length - 2, 1);
      continue;
    }
    const word = previous[previous.length - 1];
    const candidate = [word, ...rows[rows.length - 1]];
    if (width(candidate) > columns) break;
    previous.pop();
    rows[rows.length - 1] = candidate;
    if (previous.length === 0) rows.splice(rows.length - 2, 1);
  }
  return rows.filter((row) => row.length > 0).map((row) => row.join(' '));
}

export interface PosterNoteLayout {
  fontSize: number;
  lineHeight: number;
  maxWidth: number;
  marginBottom: number;
  arrangement: 'split' | 'stack' | 'message-then-split';
  lines: number;
}

/**
 * A short note may sit beside the small print. A long one becomes its own
 * block above the data, at a 30–45 character measure, and never shrinks onto one line.
 */
export function layoutPosterNote(input: {
  text: string;
  ceiling: number;
  contentWidth: number;
  rhythm: NoteRhythm;
  arrangement: PosterNoteLayout['arrangement'];
  splitWidth?: number;
  marginBottom: number;
}): PosterNoteLayout {
  const fontSize = noteFontSize(input.text.length, input.ceiling);
  const measured = noteMaxWidth(fontSize, input.rhythm, input.contentWidth);
  let arrangement = input.arrangement;
  let maxWidth = measured;
  let marginBottom = input.marginBottom;
  if (arrangement === 'split') {
    const column = Math.min(input.splitWidth ?? measured, Math.round(input.contentWidth * 0.46));
    const beside = wrappedLineCount(input.text, fontSize, column, input.rhythm);
    if (input.text.length <= 60 && beside <= 3) {
      maxWidth = column;
    } else {
      arrangement = 'stack';
      maxWidth = measured;
      marginBottom = Math.max(marginBottom, 22);
    }
  }
  return {
    fontSize,
    lineHeight: NOTE_LEADING,
    maxWidth,
    marginBottom,
    arrangement,
    lines: wrappedLineCount(input.text, fontSize, maxWidth, input.rhythm),
  };
}
