import { describe, expect, it } from 'vitest';
import { relativeLuminance } from '../color/contrast';
import { exampleMoment, EXAMPLE_INSTANT } from '../data/moment';
import { presetById, styleFromPreset } from '../style/presets';
import { buildScene, type SceneNode } from './scene';
import {
  averageLuminance,
  coverSquare,
  fittedEdge,
  legibilityFor,
  resizeForCard,
  storedPhoto,
} from './posterPhoto';

const moment = exampleMoment(EXAMPLE_INSTANT);

function ratio(a: number, b: number): number {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

function geometry(nodes: SceneNode[]): unknown {
  return JSON.parse(
    JSON.stringify(nodes, (key, value) => (key === 'color' ? undefined : value)),
  );
}

describe('poster photo', () => {
  it('cover-crops the center square', () => {
    expect(coverSquare(4000, 3000)).toEqual({ sx: 500, sy: 0, side: 3000 });
    expect(coverSquare(1080, 1920)).toEqual({ sx: 0, sy: 420, side: 1080 });
    expect(coverSquare(1080, 1080)).toEqual({ sx: 0, sy: 0, side: 1080 });
  });

  it('downscales the long edge and keeps a card-sized short edge', () => {
    expect(fittedEdge(4032, 3024, 2160)).toEqual({ width: 2160, height: 1620 });
    expect(fittedEdge(800, 600, 2160)).toEqual({ width: 800, height: 600 });
    expect(resizeForCard(4000, 3000)).toEqual({ width: 1440, height: 1080 });
    expect(resizeForCard(1080, 1080)).toEqual({ width: 1080, height: 1080 });
    expect(resizeForCard(8000, 1000).width).toBeLessThanOrEqual(2160);
  });

  it('reads luminance from pixels', () => {
    expect(averageLuminance(new Uint8ClampedArray([255, 255, 255, 255]))).toBeCloseTo(1, 2);
    expect(averageLuminance(new Uint8ClampedArray([0, 0, 0, 255]))).toBeCloseTo(0, 5);
    expect(averageLuminance(new Uint8ClampedArray([0, 0, 0, 0]))).toBe(0.5);
  });

  it('keeps light type on a dark photo and still clears a bright one', () => {
    const cream = '#F2E8D5';
    const gold = '#CBA65E';
    const dark = legibilityFor(cream, null, 0.04);
    const bright = legibilityFor(cream, null, 0.96);
    const goldDark = legibilityFor(gold, null, 0.04);
    expect(dark.scrim).toContain('12, 16, 28');
    expect(dark.textColor).toBe(cream);
    expect(goldDark.textColor).toBe(gold);
    expect(bright.textColor).toBe('#161513');
    expect(ratio(relativeLuminance(bright.textColor), bright.composite)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(relativeLuminance(goldDark.textColor), goldDark.composite)).toBeGreaterThanOrEqual(4.5);
    const goldBright = legibilityFor(gold, null, 0.96);
    expect(ratio(relativeLuminance(goldBright.textColor), goldBright.composite)).toBeGreaterThanOrEqual(4.5);
  });

  it('lifts a light veil under dark type on a dark photo', () => {
    const ink = '#111111';
    const look = legibilityFor(ink, null, 0.03);
    expect(look.scrim).toContain('244, 241, 234');
    expect(ratio(relativeLuminance(look.textColor), look.composite)).toBeGreaterThanOrEqual(4.5);
    const onWhite = legibilityFor(ink, null, 0.98);
    expect(onWhite.textColor).toBe(ink);
    expect(ratio(relativeLuminance(onWhite.textColor), onWhite.composite)).toBeGreaterThanOrEqual(4.5);
  });

  it('accepts a stored jpeg and drops anything else', () => {
    const jpeg = `data:image/jpeg;base64,${'A'.repeat(40)}`;
    expect(storedPhoto({ jpeg, luminance: 0.2 })).toEqual({ jpeg, luminance: 0.2 });
    expect(storedPhoto({ jpeg, luminance: 4 })).toEqual({ jpeg, luminance: 1 });
    expect(storedPhoto({ jpeg: 'data:image/png;base64,aaaa', luminance: 0.2 })).toBeNull();
    expect(storedPhoto({ jpeg, luminance: 'bright' })).toBeNull();
    expect(storedPhoto(null)).toBeNull();
  });

  it('does not move the type when a photo is behind it', () => {
    const photo = { jpeg: 'data:image/jpeg;base64,aaaa', luminance: 0.92 };
    for (const id of ['02', '04']) {
      const style = styleFromPreset(presetById(id));
      const plain = buildScene(style, moment, 'The light on the water, right now.', EXAMPLE_INSTANT);
      const over = buildScene(style, moment, 'The light on the water, right now.', EXAMPLE_INSTANT, photo);
      expect(over.width).toBe(plain.width);
      expect(over.height).toBe(plain.height);
      expect(geometry(over.nodes)).toEqual(geometry(plain.nodes));
      expect(over.photo?.href).toBe(photo.jpeg);
      expect(over.photo?.scrim).toContain('linear-gradient');
      const colored = JSON.stringify(over.nodes);
      expect(colored.length).toBeGreaterThan(0);
    }
  });
});
