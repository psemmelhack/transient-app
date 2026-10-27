import { describe, expect, it } from 'vitest';
import { chooseVertical, fittedInkWidth, fitLine, metricsForFit, placeLineBox, type ProbeMetrics } from './fit';

const probe: ProbeMetrics = {
  probeSize: 200,
  advanceWidth: 120,
  domAdvanceWidth: 120,
  actualBoundingBoxLeft: 8,
  actualBoundingBoxRight: 100,
  actualBoundingBoxAscent: 140,
  actualBoundingBoxDescent: 20,
  fontBoundingBoxAscent: 160,
  fontBoundingBoxDescent: 40,
};

describe('fitLine', () => {
  it('scales ink to the target width', () => {
    const target = 960;
    expect(fittedInkWidth(probe, target)).toBeCloseTo(target, 6);
    const fitted = fitLine(probe, target);
    expect(fitted.fontSize).toBeGreaterThan(0);
    expect(fitted.height).toBeGreaterThan(0);
  });

  it('corrects canvas metrics with the DOM advance ratio', () => {
    const domWider: ProbeMetrics = { ...probe, domAdvanceWidth: 150 };
    const plain = fitLine(probe, 900).fontSize;
    const corrected = fitLine(domWider, 900).fontSize;
    expect(corrected).toBeLessThan(plain);
    expect(fittedInkWidth(domWider, 900)).toBeCloseTo(900, 5);
  });

  it('shifts left by the left side bearing so ink starts at zero', () => {
    const fitted = fitLine(probe, 900);
    const scale = fitted.fontSize / probe.probeSize;
    expect(fitted.shiftLeft).toBeCloseTo(probe.actualBoundingBoxLeft * scale, 5);
  });

  it('uses a fixed leading when vertical metrics are missing', () => {
    const broken: ProbeMetrics = {
      ...probe,
      actualBoundingBoxAscent: 0,
      actualBoundingBoxDescent: Number.NaN,
      fontBoundingBoxAscent: Number.NaN,
      fontBoundingBoxDescent: 0,
    };
    const fitted = fitLine(broken, 900, { leading: 0.92, trusted: false });
    expect(fitted.height).toBeCloseTo(fitted.fontSize * 0.92, 5);
    expect(fitted.shiftTop).toBe(0);
    expect(fitted.shiftLeft).toBe(0);
  });

  it('ignores a canvas width that is many times the DOM advance', () => {
    const wild: ProbeMetrics = {
      ...probe,
      advanceWidth: 400,
      domAdvanceWidth: 400,
      actualBoundingBoxLeft: 1600,
      actualBoundingBoxRight: 1600,
    };
    const fitted = metricsForFit(wild);
    expect(fitted.actualBoundingBoxLeft).toBe(0);
    expect(fitted.actualBoundingBoxRight).toBe(400);
    expect(fitLine(fitted, 900).fontSize).toBeGreaterThan(fitLine(wild, 900).fontSize * 3);
  });

  it('keeps the desktop ink crop when the baseline matches the canvas', () => {
    const shoulders: ProbeMetrics = {
      probeSize: 200,
      advanceWidth: 200,
      domAdvanceWidth: 200,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: 200,
      actualBoundingBoxAscent: 162,
      actualBoundingBoxDescent: 2,
      fontBoundingBoxAscent: 197,
      fontBoundingBoxDescent: 43,
    };
    const fitted = fitLine(shoulders, 200);
    const box = placeLineBox({ fontSize: fitted.fontSize, probeSize: 200, baseline: 177, ascent: 162, descent: 2 });
    expect(box.crop).toBe(true);
    expect(box.height).toBeCloseTo(fitted.height, 5);
    expect(box.shiftTop).toBeCloseTo(fitted.shiftTop, 5);
  });

  it('uses painted pixels when the canvas box is too short to trust', () => {
    const chosen = chooseVertical(200, { ascent: 80, descent: 2, fontAscent: 197 }, { ascent: 162, descent: 2 });
    expect(chosen).toEqual({ ascent: 162, descent: 2 });
    const box = placeLineBox({ fontSize: 200, probeSize: 200, baseline: 177, ascent: chosen?.ascent ?? null, descent: chosen?.descent ?? null });
    expect(box.height).toBeCloseTo(164, 5);
    expect(box.crop).toBe(true);
  });

  it('does not crop when neither reading describes the glyphs', () => {
    expect(chooseVertical(200, { ascent: 0, descent: 0, fontAscent: 0 }, null)).toBeNull();
    const box = placeLineBox({ fontSize: 180, probeSize: 200, baseline: null, ascent: null, descent: null });
    expect(box).toEqual({ height: 180, shiftTop: 0, crop: false });
  });

  it('survives a zero ink measurement', () => {
    const empty: ProbeMetrics = {
      ...probe,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: 0,
      advanceWidth: 0,
      domAdvanceWidth: 0,
    };
    expect(fitLine(empty, 400).fontSize).toBe(200);
  });
});
