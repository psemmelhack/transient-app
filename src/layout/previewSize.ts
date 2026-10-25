/** Header row inside the pinned display. */
export const PIN_HEADER = 56;

export interface PreviewBox {
  width: number;
  height: number;
  pinHeight: number;
  /** Phone: paper that holds the parameters below the first screen. Desktop: a short pause under the note. */
  gap: number;
}

/** Desktop starts here. Phones keep a full-width card. */
export const DESKTOP_PREVIEW_MIN_WIDTH = 900;

/**
 * Size the pinned composition.
 * A phone card fills the width and stays one size while scrolling.
 * A desktop card is capped to about 42% of the viewport (280–440px) so the
 * parameters have room under the pin. Story, feed, and square keep their ratio.
 */
export function previewBox(input: {
  sceneWidth: number;
  sceneHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  dockHeight: number;
}): PreviewBox {
  const wide = input.viewportWidth >= DESKTOP_PREVIEW_MIN_WIDTH;
  const gutter = wide ? 96 : 36;
  const pad = 14;
  const maxW = Math.min(Math.max(160, input.viewportWidth - gutter), wide ? 640 : input.viewportWidth - gutter);
  const phoneH = Math.max(180, input.viewportHeight - PIN_HEADER - input.dockHeight - 18 - pad);
  const desktopTarget = Math.round(input.viewportHeight * 0.42);
  const desktopCap = Math.min(440, Math.max(280, desktopTarget));
  const available = Math.max(160, input.viewportHeight - PIN_HEADER - pad);
  const maxH = wide ? Math.min(desktopCap, available) : phoneH;
  const scale = Math.min(maxW / input.sceneWidth, maxH / input.sceneHeight);
  const width = Math.max(1, Math.round(input.sceneWidth * scale));
  const height = Math.max(1, Math.round(input.sceneHeight * scale));
  const pinHeight = PIN_HEADER + height + pad;
  const gap = wide ? 32 : Math.max(0, input.viewportHeight - pinHeight - input.dockHeight);
  return { width, height, pinHeight, gap };
}
