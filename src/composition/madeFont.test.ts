import { describe, expect, it } from 'vitest';
import { exampleMoment, EXAMPLE_INSTANT } from '../data/moment';
import { remixMade, withDisplayFont, withMadePlace } from '../style/edit';
import { sanitizeStyle } from '../style/persist';
import { defaultStyle } from '../style/presets';
import { buildScene, type FitStackNode } from './scene';
import { MADE_GLYPHS } from './madeGlyphs';
import { madeFamily, madeFontBytes, seedFromFamily } from './madeFont';
import { madeCell, placeMadeSeed, seedForCell } from './madeSeed';

function u16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function u32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function table(bytes: Uint8Array, tag: string): { offset: number; length: number } {
  const count = u16(bytes, 4);
  for (let index = 0; index < count; index += 1) {
    const at = 12 + index * 16;
    const name = String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
    if (name === tag) return { offset: u32(bytes, at + 8), length: u32(bytes, at + 12) };
  }
  throw new Error(`missing ${tag}`);
}

describe('made font', () => {
  it('covers every printable character except space', () => {
    for (let code = 33; code <= 126; code += 1) {
      expect(MADE_GLYPHS[String.fromCharCode(code)]?.length, String.fromCharCode(code)).toBe(45);
    }
  });

  it('builds one file per seed, with ink in the letter A', () => {
    const first = madeFontBytes(0x4d414445);
    const again = madeFontBytes(0x4d414445);
    const other = madeFontBytes(0x00c0ffee);
    expect(first).toBe(again);
    expect(u32(first, 0)).toBe(0x00010000);
    expect(other.length === first.length && other.every((byte, index) => byte === first[index])).toBe(false);
    const loca = table(first, 'loca');
    const glyf = table(first, 'glyf');
    const glyph = 65 - 31;
    const start = u32(first, loca.offset + glyph * 4);
    const end = u32(first, loca.offset + (glyph + 1) * 4);
    expect(end).toBeGreaterThan(start);
    expect(u16(first, glyf.offset + start)).toBeGreaterThan(0);
    expect(seedFromFamily(madeFamily(0x4d414445))).toBe(0x4d414445);
  });

  it('seeds the face from two decimal places of the fix', () => {
    const here = placeMadeSeed(33.834452, -118.383318, 0);
    const sameCell = placeMadeSeed(33.831, -118.3849, 0);
    const nextCell = placeMadeSeed(33.836, -118.383318, 0);
    expect(madeCell(33.834452, -118.383318)).toBe('33.83,-118.38');
    expect(sameCell).toBe(here);
    expect(nextCell).not.toBe(here);
    expect(placeMadeSeed(-33.834, 118.381, 0)).toBe(seedForCell('-33.83,118.38', 0));
    expect(placeMadeSeed(33.834452, -118.383318, 1)).not.toBe(here);
    expect(placeMadeSeed(33.834452, -118.383318, 1)).toBe(placeMadeSeed(33.8301, -118.3801, 1));
    expect(placeMadeSeed(Number.NaN, 1, 0)).toBe(defaultStyle().madeSeed);
    expect(placeMadeSeed(undefined, undefined, 2)).toBe(placeMadeSeed(null, null, 2));
    expect(placeMadeSeed(undefined, undefined, 2)).not.toBe(placeMadeSeed(undefined, undefined, 0));

    const moment = exampleMoment(EXAMPLE_INSTANT);
    const style = withMadePlace(withDisplayFont(defaultStyle(), 'made'), moment.latitude, moment.longitude);
    expect(style.madeVariant).toBe(0);
    expect(style.madeCell).toBe('33.83,-118.38');
    expect(style.madeSeed).toBe(here);
    const scene = buildScene({ ...style, madeSeed: 1 }, moment, 'We were here.');
    const stack = scene.nodes.find((node) => node.kind === 'fit-stack') as FitStackNode;
    expect(stack.font.family).toBe(madeFamily(here));

    const remixed = remixMade(style, moment.latitude, moment.longitude);
    expect(remixed.displayFontId).toBe('made');
    expect(remixed.presetId).toBeNull();
    expect(remixed.madeVariant).toBe(1);
    expect(remixed.madeCell).toBe(style.madeCell);
    expect(remixed.madeSeed).toBe(placeMadeSeed(moment.latitude, moment.longitude, 1));
    const again = remixMade(remixed, 33.8304, -118.384);
    expect(again.madeVariant).toBe(2);
    expect(again.madeSeed).toBe(remixMade(remixed, 33.8304, -118.384).madeSeed);

    const noted = buildScene({ ...again, layout: 'note', recipeId: 'note-generic' }, moment, 'A short note.');
    const lead = noted.nodes.find((node) => node.kind === 'quiet');
    expect(lead && lead.kind === 'quiet' && lead.blocks.some((block) => 'font' in block && block.font.family === madeFamily(again.madeSeed))).toBe(true);
    expect(sanitizeStyle({ ...style, madeCell: '33.83,-118.38', madeVariant: 1 }).madeVariant).toBe(1);
    expect(sanitizeStyle({ ...style, madeCell: 'nope', madeVariant: -3 }).madeCell).toBeNull();
    expect(sanitizeStyle({ ...style, madeSeed: Number.NaN, madeCell: '33.83,-118.38', madeVariant: 0 }).madeSeed).toBe(here);
  });
});
