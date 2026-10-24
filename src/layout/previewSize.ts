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
 * At rest it fills the screen above the note. While style controls are in view
 * it scales down so a phone still shows a band of controls beneath it.
 * Story, feed, and square each keep their aspect ratio.
 */
export function previewBox(input: {
  sceneWidth: number;
  sceneHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  engaged: boolean;
  dockHeight: number;
}): PreviewBox {
  const wide = input.viewportWidth >= 900;
  const gutter = wide ? 96 : 36;
  const pad = 14;
  const maxW = Math.min(
    Math.max(160, input.viewportWidth - gutter),
    input.engaged ? (wide ? 560 : input.viewportWidth - gutter) : wide ? 640 : input.viewportWidth - gutter,
  );
  const restMaxH = Math.max(180, input.viewportHeight - PIN_HEADER - input.dockHeight - (wide ? 36 : 18) - pad);
  const roomBelow = input.viewportHeight * (wide ? 0.46 : 0.46);
  const compactMaxH = Math.max(168, Math.min(input.viewportHeight - roomBelow - PIN_HEADER - pad, wide ? 440 : 400));
  const maxH = input.engaged ? compactMaxH : restMaxH;
  const scale = Math.min(maxW / input.sceneWidth, maxH / input.sceneHeight);
  const width = Math.max(1, Math.round(input.sceneWidth * scale));
  const height = Math.max(1, Math.round(input.sceneHeight * scale));
  const pinHeight = PIN_HEADER + height + pad;
  const gap = input.engaged ? 0 : Math.max(0, input.viewportHeight - pinHeight - input.dockHeight);
  return { width, height, pinHeight, gap };
}
