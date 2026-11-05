import { buildTrueType, type TtfContour, type TtfGlyph } from './trueType';
import { MADE_GLYPHS, MADE_NOTDEF } from './madeGlyphs';

const CELL = 96;

export function madeFamily(seed: number): string {
  return `Made ${(seed >>> 0).toString(16).padStart(8, '0')}`;
}

export function seedFromFamily(family: string): number | null {
  const match = family.trim().replace(/^["']|["']$/g, '').match(/^Made ([0-9a-f]{8})$/i);
  if (!match) return null;
  return Number.parseInt(match[1], 16);
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function unit(seed: number, code: number, salt: number): number {
  let value = (seed ^ Math.imul(code + 1, 0x9e3779b1) ^ Math.imul(salt + 3, 0x85ebca6b)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
}

interface Personality {
  kind: number;
  slant: number;
  width: number;
  /** Extra supersamples of stroke. Zero stays thin; one reads as a heavier cut. */
  grow: number;
  wobble: number;
  freq: number;
  phase: number;
  phase2: number;
  baseline: number;
  chip: number;
  spur: number;
  shear: number;
  gap: boolean;
}

function personality(seed: number): Personality {
  const rng = mulberry32(seed || 1);
  const kind = Math.floor(rng() * 5);
  const roll = rng();
  if (kind === 1) {
    return { kind, slant: (roll - 0.5) * 0.08, width: 1.02 + rng() * 0.08, grow: 1, wobble: 8 + rng() * 6, freq: 0.35 + rng() * 0.2, phase: rng() * Math.PI * 2, phase2: rng() * Math.PI * 2, baseline: 8, chip: 0, spur: 0, shear: 0, gap: true };
  }
  if (kind === 2) {
    return { kind, slant: (roll - 0.5) * 0.06, width: 1.38 + rng() * 0.14, grow: 1, wobble: 6 + rng() * 6, freq: 0.3 + rng() * 0.25, phase: rng() * Math.PI * 2, phase2: rng() * Math.PI * 2, baseline: 6, chip: 0.06, spur: 0.08, shear: 0, gap: false };
  }
  if (kind === 3) {
    return { kind, slant: 0.12 + roll * 0.22, width: 0.78 + rng() * 0.1, grow: 0, wobble: 34 + rng() * 16, freq: 1.15 + rng() * 0.7, phase: rng() * Math.PI * 2, phase2: rng() * Math.PI * 2, baseline: 32, chip: 0.1, spur: 0.12, shear: 0, gap: false };
  }
  if (kind === 4) {
    return { kind, slant: (roll - 0.5) * 0.1, width: 0.96 + rng() * 0.1, grow: 0, wobble: 12 + rng() * 8, freq: 0.4 + rng() * 0.3, phase: rng() * Math.PI * 2, phase2: rng() * Math.PI * 2, baseline: 10, chip: 0.28, spur: 0.22, shear: 1, gap: false };
  }
  return { kind, slant: (roll - 0.45) * 0.18, width: 0.96 + rng() * 0.12, grow: 0, wobble: 16 + rng() * 10, freq: 0.4 + rng() * 0.35, phase: rng() * Math.PI * 2, phase2: rng() * Math.PI * 2, baseline: 14, chip: 0.16, spur: 0.12, shear: 0, gap: false };
}

function parseCells(pattern: string): boolean[][] {
  const rows: boolean[][] = [];
  for (let row = 0; row < 9; row += 1) {
    const line: boolean[] = [];
    for (let col = 0; col < 5; col += 1) line.push(pattern[row * 5 + col] === '#');
    rows.push(line);
  }
  return rows;
}

function clone(cells: boolean[][]): boolean[][] {
  return cells.map((row) => row.slice());
}

function filledCells(cells: boolean[][]): { row: number; col: number }[] {
  const found: { row: number; col: number }[] = [];
  for (let row = 0; row < cells.length; row += 1) {
    for (let col = 0; col < cells[row].length; col += 1) if (cells[row][col]) found.push({ row, col });
  }
  return found;
}

/** One nick, one bite, or a dropped right side. The letter stays a letter. */
function mutate(cells: boolean[][], seed: number, code: number, face: Personality): boolean[][] {
  const next = clone(cells);
  if (unit(seed, code, 1) < face.chip) {
    const found = filledCells(next);
    if (found.length > 6) {
      const pick = found[Math.floor(unit(seed, code, 2) * found.length)];
      next[pick.row][pick.col] = false;
    }
  }
  if (unit(seed, code, 3) < face.spur) {
    const row = Math.floor(unit(seed, code, 4) * 7);
    const col = Math.floor(unit(seed, code, 5) * 4);
    if (row + 1 < next.length && col + 1 < 5) next[row][col + 1] = true;
  }
  if (face.shear > 0) {
    const shifted = next.map((row) => row.slice());
    for (let row = 0; row < next.length; row += 1) {
      for (let col = 3; col < 5; col += 1) {
        shifted[row][col] = false;
        const target = Math.min(next.length - 1, row + 1);
        if (next[row][col]) shifted[target][col] = true;
      }
    }
    if (shifted.some((row) => row.some(Boolean))) return shifted;
  }
  if (!next.some((row) => row.some(Boolean))) return cells;
  return next;
}

const SUPERSAMPLE = 3;

function raster(cells: boolean[][], grow: number): { grid: boolean[][]; pad: number } {
  const pad = grow;
  const rows = cells.length * SUPERSAMPLE + pad * 2;
  const cols = 5 * SUPERSAMPLE + pad * 2;
  const grid = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  for (let row = 0; row < cells.length; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      if (!cells[row][col]) continue;
      for (let dy = -grow; dy < SUPERSAMPLE + grow; dy += 1) {
        for (let dx = -grow; dx < SUPERSAMPLE + grow; dx += 1) {
          const r = row * SUPERSAMPLE + pad + dy;
          const c = col * SUPERSAMPLE + pad + dx;
          if (r >= 0 && c >= 0 && r < rows && c < cols) grid[r][c] = true;
        }
      }
    }
  }
  return { grid, pad };
}

/** A clean horizontal break through the upper stems, after the stroke has grown. */
function punchStencil(grid: boolean[][], pad: number): void {
  const start = SUPERSAMPLE + pad;
  for (let row = start; row < start + SUPERSAMPLE && row < grid.length; row += 1) grid[row].fill(false);
}

function soften(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length < 4) return points;
  const next: { x: number; y: number }[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const here = points[index];
    const there = points[(index + 1) % points.length];
    next.push({ x: here.x * 0.72 + there.x * 0.28, y: here.y * 0.72 + there.y * 0.28 });
    next.push({ x: here.x * 0.28 + there.x * 0.72, y: here.y * 0.28 + there.y * 0.72 });
  }
  return next;
}

function trace(cells: boolean[][]): { x: number; y: number }[][] {
  const rows = cells.length;
  const cols = cells[0]?.length ?? 0;
  const on = (col: number, row: number) => row >= 0 && col >= 0 && row < rows && col < cols && cells[row][col];
  const directed = new Map<string, { x: number; y: number }>();
  const toggle = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const forward = `${from.x},${from.y}|${to.x},${to.y}`;
    const back = `${to.x},${to.y}|${from.x},${from.y}`;
    if (directed.has(back)) directed.delete(back);
    else directed.set(forward, to);
  };
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!on(col, row)) continue;
      const y0 = rows - row - 1;
      const y1 = y0 + 1;
      if (!on(col, row + 1)) toggle({ x: col, y: y0 }, { x: col + 1, y: y0 });
      if (!on(col + 1, row)) toggle({ x: col + 1, y: y0 }, { x: col + 1, y: y1 });
      if (!on(col, row - 1)) toggle({ x: col + 1, y: y1 }, { x: col, y: y1 });
      if (!on(col - 1, row)) toggle({ x: col, y: y1 }, { x: col, y: y0 });
    }
  }
  const outgoing = new Map<string, string[]>();
  for (const key of directed.keys()) {
    const from = key.split('|')[0];
    const list = outgoing.get(from) ?? [];
    list.push(key);
    outgoing.set(from, list);
  }
  const used = new Set<string>();
  const contours: { x: number; y: number }[][] = [];
  for (const start of directed.keys()) {
    if (used.has(start)) continue;
    const contour: { x: number; y: number }[] = [];
    let key = start;
    while (key && !used.has(key)) {
      used.add(key);
      const [from, to] = key.split('|');
      const [x, y] = from.split(',').map(Number);
      contour.push({ x, y });
      const options = outgoing.get(to) ?? [];
      key = options.find((item) => !used.has(item)) ?? '';
    }
    if (contour.length >= 3) contours.push(contour);
  }
  return contours;
}

function warp(points: { x: number; y: number }[], face: Personality, seed: number, code: number): TtfContour[] {
  const drift = (unit(seed, code, 7) - 0.5) * face.baseline;
  const scale = 0.9 + unit(seed, code, 8) * 0.22;
  return points.map((point) => {
    const x = point.x * CELL;
    const y = (point.y - 2) * CELL;
    const along = Math.sin(y * face.freq * 0.01 + face.phase) * face.wobble;
    const rise = Math.sin(x * face.freq * 0.012 + face.phase2) * face.wobble * 0.65;
    return {
      x: (x + along + y * face.slant) * face.width * scale,
      y: y + rise + drift,
    };
  });
}

function glyphFor(pattern: string, seed: number, code: number, face: Personality, advancePad: number): TtfGlyph {
  const drawn = raster(mutate(parseCells(pattern), seed, code, face), face.grow);
  if (face.gap && pattern.replace(/[^#]/g, '').length > 8) punchStencil(drawn.grid, drawn.pad);
  const contours = trace(drawn.grid).map((contour) =>
    warp(
      soften(contour.map((point) => ({ x: (point.x - drawn.pad) / SUPERSAMPLE, y: (point.y - drawn.pad) / SUPERSAMPLE }))),
      face,
      seed,
      code,
    ),
  );
  let xMin = Infinity;
  let xMax = -Infinity;
  for (const contour of contours) {
    for (const point of contour) {
      xMin = Math.min(xMin, point.x);
      xMax = Math.max(xMax, point.x);
    }
  }
  if (xMin === Infinity) return { advance: Math.round(280 * face.width), lsb: 0, contours: [] };
  const lsb = Math.round(xMin - 36);
  const shift = 40 - lsb;
  const moved = contours.map((contour) => contour.map((point) => ({ x: point.x + shift, y: point.y })));
  const width = xMax + shift + advancePad;
  return { advance: Math.max(120, Math.round(width)), lsb: 40, contours: moved };
}

function spaceGlyph(face: Personality): TtfGlyph {
  return { advance: Math.round((kindSpace(face.kind) + face.width * 80)), lsb: 0, contours: [] };
}

function kindSpace(kind: number): number {
  if (kind === 2) return 420;
  if (kind === 3) return 240;
  return 320;
}

const cache = new Map<number, Uint8Array>();

/** The same seed always builds the same file. A new seed is a different face. */
export function madeFontBytes(seed: number): Uint8Array {
  const key = seed >>> 0;
  const hit = cache.get(key);
  if (hit) return hit;
  const face = personality(key);
  const family = madeFamily(key);
  const glyphs: TtfGlyph[] = [glyphFor(MADE_NOTDEF, key, 0, face, 90)];
  for (let code = 32; code <= 126; code += 1) {
    const char = String.fromCharCode(code);
    if (char === ' ') {
      glyphs.push(spaceGlyph(face));
      continue;
    }
    glyphs.push(glyphFor(MADE_GLYPHS[char] ?? MADE_NOTDEF, key, code, face, char === '.' || char === ',' ? 70 : 96));
  }
  const bytes = buildTrueType(glyphs, family);
  cache.set(key, bytes);
  return bytes;
}

export function madeFontBase64(seed: number): string {
  const bytes = madeFontBytes(seed);
  let binary = '';
  const step = 0x2000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary);
}

export function madeFaceCss(families: string[]): string {
  const blocks: string[] = [];
  for (const family of families) {
    const seed = seedFromFamily(family);
    if (seed == null) continue;
    blocks.push(
      `@font-face{font-family:'${family}';src:url('data:font/ttf;base64,${madeFontBase64(seed)}') format('truetype');font-weight:400;font-style:normal;font-display:block;}`,
    );
  }
  return blocks.join('\n');
}

const installed = new Set<string>();

/** Register the face so preview measurement and capture embed the same outlines. */
export async function installMadeFont(seed: number): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const family = madeFamily(seed);
  if (installed.has(family)) return;
  const bytes = madeFontBytes(seed);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  try {
    const face = new FontFace(family, buffer, { weight: '400', style: 'normal', display: 'block' });
    document.fonts.add(face);
    await face.load();
    installed.add(family);
  } catch {
    installed.delete(family);
  }
}
