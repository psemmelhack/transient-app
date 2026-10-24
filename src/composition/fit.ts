/**
 * Fit a line of type to a width using ink bounds, not the em-box advance.
 * The probe metrics come from canvas measureText plus a DOM correction so
 * variable-font axes that canvas ignores still size correctly.
 */

export interface ProbeMetrics {
  probeSize: number;
  /** canvas measureText().width at the probe size */
  advanceWidth: number;
  /** DOM advance width at the same probe size */
  domAdvanceWidth: number;
  actualBoundingBoxLeft: number;
  actualBoundingBoxRight: number;
  actualBoundingBoxAscent: number;
  actualBoundingBoxDescent: number;
  fontBoundingBoxAscent: number;
  fontBoundingBoxDescent: number;
}

export interface FittedLine {
  fontSize: number;
  /** Ink height. The line box is cropped to this. */
  height: number;
  /** Applied as a negative-or-positive top offset so the ink sits in the box. */
  shiftTop: number;
  /** Shifts the glyph run so the ink's left edge lands on x = 0. */
  shiftLeft: number;
}

export function fitLine(metrics: ProbeMetrics, targetWidth: number): FittedLine {
  const probe = metrics.probeSize > 0 ? metrics.probeSize : 200;
  const advance = metrics.advanceWidth > 0 ? metrics.advanceWidth : metrics.domAdvanceWidth;
  const dom = metrics.domAdvanceWidth > 0 ? metrics.domAdvanceWidth : advance;
  const cr = advance > 0 ? dom / advance : 1;
  const ink = (metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight) * cr;
  const fontSize = ink > 0.5 ? (probe * targetWidth) / ink : probe;
  const k = fontSize / probe;
  const kx = k * cr;
  const inkA = metrics.actualBoundingBoxAscent * k;
  const inkD = metrics.actualBoundingBoxDescent * k;
  const fA = metrics.fontBoundingBoxAscent * k;
  const fD = metrics.fontBoundingBoxDescent * k;
  const half = (fontSize - (fA + fD)) / 2;
  const inkTop = half + fA - inkA;
  return {
    fontSize,
    height: Math.max(1, inkA + inkD),
    shiftTop: -inkTop,
    shiftLeft: metrics.actualBoundingBoxLeft * kx,
  };
}

/** Ink width that `fitLine` will produce, given the same probe metrics. */
export function fittedInkWidth(metrics: ProbeMetrics, targetWidth: number): number {
  const fitted = fitLine(metrics, targetWidth);
  const advance = metrics.advanceWidth > 0 ? metrics.advanceWidth : metrics.domAdvanceWidth;
  const dom = metrics.domAdvanceWidth > 0 ? metrics.domAdvanceWidth : advance;
  const cr = advance > 0 ? dom / advance : 1;
  const scale = fitted.fontSize / (metrics.probeSize || 200);
  return (metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight) * cr * scale;
}
