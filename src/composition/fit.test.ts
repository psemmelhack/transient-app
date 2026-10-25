import { describe, expect, it } from 'vitest';
import { fittedInkWidth, fitLine, type ProbeMetrics } from './fit';

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
