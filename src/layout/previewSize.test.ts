import { describe, expect, it } from 'vitest';
import { FORMAT_ORDER, FORMATS } from '../composition/formats';
import { previewBox } from './previewSize';

describe('preview box', () => {
  const phone = { viewportWidth: 390, viewportHeight: 844, dockHeight: 156 };

  it('keeps each format in ratio and leaves a band under the pin', () => {
    for (const id of FORMAT_ORDER) {
      const spec = FORMATS[id];
      const box = previewBox({ ...phone, sceneWidth: spec.width, sceneHeight: spec.height });
      expect(box.width / box.height).toBeCloseTo(spec.width / spec.height, 1);
      expect(box.pinHeight + box.gap + phone.dockHeight).toBeLessThanOrEqual(phone.viewportHeight + 1);
      expect(phone.viewportHeight - box.pinHeight).toBeGreaterThan(100);
      expect(box.width).toBeGreaterThan(140);
    }
  });

  it('keeps a phone story card at the resting size', () => {
    const box = previewBox({
      ...phone,
      sceneWidth: FORMATS.story.width,
      sceneHeight: FORMATS.story.height,
    });
    expect(box.height).toBeGreaterThan(box.width);
    expect(box.height).toBeGreaterThan(500);
    expect(box.pinHeight).toBeGreaterThan(600);
  });

  it('caps a desktop card so the parameters have room under the pin', () => {
    const box = previewBox({
      sceneWidth: FORMATS.square.width,
      sceneHeight: FORMATS.square.height,
      viewportWidth: 1440,
      viewportHeight: 900,
      dockHeight: 156,
    });
    expect(box.width).toBe(box.height);
    expect(box.height).toBeGreaterThanOrEqual(280);
    expect(box.height).toBeLessThanOrEqual(440);
    expect(box.height / 900).toBeGreaterThanOrEqual(0.4);
    expect(box.height / 900).toBeLessThanOrEqual(0.45);
    expect(900 - box.pinHeight).toBeGreaterThan(360);
  });

  it('keeps a short desktop window from growing the card past the cap', () => {
    const box = previewBox({
      sceneWidth: FORMATS.square.width,
      sceneHeight: FORMATS.square.height,
      viewportWidth: 1280,
      viewportHeight: 1400,
      dockHeight: 156,
    });
    expect(box.height).toBeLessThanOrEqual(440);
    expect(box.height).toBeGreaterThanOrEqual(280);
  });
});
