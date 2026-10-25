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

/** Greedy word wrap, so a 200-character sentence lands on a real line count. */
export function wrappedLineCount(text: string, fontSize: number, maxWidth: number, rhythm: NoteRhythm): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const { em } = MEASURE[rhythm];
  const charsPerLine = Math.max(8, Math.floor(maxWidth / Math.max(1, fontSize * em)));
  const words = trimmed.split(/\s+/);
  let lines = 1;
  let column = 0;
  for (const word of words) {
    const width = Math.max(1, word.length);
    const extra = width > charsPerLine ? Math.ceil(width / charsPerLine) - 1 : 0;
    if (column === 0) {
      column = Math.min(width, charsPerLine);
      lines += extra;
      continue;
    }
    if (column + 1 + width <= charsPerLine) {
      column += 1 + width;
      continue;
    }
    lines += 1 + extra;
    column = Math.min(width, charsPerLine);
  }
  return lines;
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
