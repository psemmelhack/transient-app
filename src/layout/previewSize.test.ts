import { describe, expect, it } from 'vitest';
import { FORMAT_ORDER, FORMATS } from '../composition/formats';
import { previewBox } from './previewSize';

describe('preview box', () => {
  const phone = { viewportWidth: 390, viewportHeight: 844, dockHeight: 156 };

  it('keeps each format in ratio and leaves room under the pin while editing', () => {
    for (const id of FORMAT_ORDER) {
      const spec = FORMATS[id];
      const rest = previewBox({ ...phone, sceneWidth: spec.width, sceneHeight: spec.height, engaged: false });
      const editing = previewBox({ ...phone, sceneWidth: spec.width, sceneHeight: spec.height, engaged: true });
      expect(rest.height).toBeGreaterThanOrEqual(editing.height);
      expect(phone.viewportHeight - editing.pinHeight).toBeGreaterThan(300);
      expect(editing.width).toBeGreaterThan(140);
      expect(rest.pinHeight + rest.gap + phone.dockHeight).toBeLessThanOrEqual(phone.viewportHeight + 1);
      expect(editing.width / editing.height).toBeCloseTo(spec.width / spec.height, 1);
      expect(editing.gap).toBe(0);
    }
  });

  it('narrows a story card on a phone so controls can sit beneath it', () => {
    const box = previewBox({
      ...phone,
      sceneWidth: FORMATS.story.width,
      sceneHeight: FORMATS.story.height,
      engaged: true,
    });
    expect(box.height).toBeGreaterThan(box.width);
    expect(box.width).toBeLessThan(300);
    expect(box.pinHeight).toBeLessThan(520);
  });

  it('gives a desktop feed a large resting card that shrinks while editing', () => {
    const shared = {
      sceneWidth: FORMATS.feed.width,
      sceneHeight: FORMATS.feed.height,
      viewportWidth: 1280,
      viewportHeight: 800,
      dockHeight: 156,
    };
    const rest = previewBox({ ...shared, engaged: false });
    const editing = previewBox({ ...shared, engaged: true });
    expect(rest.height).toBeGreaterThan(480);
    expect(editing.pinHeight).toBeLessThan(rest.pinHeight);
    expect(800 - editing.pinHeight).toBeGreaterThan(280);
  });
});
