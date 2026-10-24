/** Header row inside the pinned display. */
export const PIN_HEADER = 56;

export interface PreviewBox {
  width: number;
  height: number;
  pinHeight: number;
  /** Empty paper between the display and the note, so controls start below the fold. */
  gap: number;
}

/**
 * Size the pinned composition.
 * It stays one size: large enough to fill the screen above the note.
 * Scrolling does not scale it. Story, feed, and square each keep their aspect ratio.
 * pinHeight leaves a band of the viewport below the pin so controls can scroll into view.
 */
export function previewBox(input: {
  sceneWidth: number;
  sceneHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  dockHeight: number;
}): PreviewBox {
  const wide = input.viewportWidth >= 900;
  const gutter = wide ? 96 : 36;
  const pad = 14;
  const maxW = Math.min(Math.max(160, input.viewportWidth - gutter), wide ? 640 : input.viewportWidth - gutter);
  const maxH = Math.max(180, input.viewportHeight - PIN_HEADER - input.dockHeight - (wide ? 36 : 18) - pad);
  const scale = Math.min(maxW / input.sceneWidth, maxH / input.sceneHeight);
  const width = Math.max(1, Math.round(input.sceneWidth * scale));
  const height = Math.max(1, Math.round(input.sceneHeight * scale));
  const pinHeight = PIN_HEADER + height + pad;
  const gap = Math.max(0, input.viewportHeight - pinHeight - input.dockHeight);
  return { width, height, pinHeight, gap };
}
