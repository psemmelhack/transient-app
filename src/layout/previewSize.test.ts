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

  it('gives a desktop feed one large card', () => {
    const box = previewBox({
      sceneWidth: FORMATS.feed.width,
      sceneHeight: FORMATS.feed.height,
      viewportWidth: 1280,
      viewportHeight: 800,
      dockHeight: 156,
    });
    expect(box.height).toBeGreaterThan(480);
    expect(800 - box.pinHeight).toBeGreaterThan(80);
  });
});
