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

export interface FitLineOptions {
  /** Line box as a fraction of font size, used when vertical metrics cannot be trusted. */
  leading?: number;
  /**
   * False when fontBoundingBox or actualBoundingBox was 0, NaN, or implausibly small.
   * The line box is then font size times `leading`, with no vertical shift.
   */
  trusted?: boolean;
}

/** A vertical metric is usable only when it is finite and at least `floorRatio` of the probe. */
export function verticalMetric(value: unknown, probe: number, floorRatio: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < probe * floorRatio) return null;
  return value;
}

/** Ascent boxes at 0, NaN, or a few pixels mean the face was not decoded. */
export function verticalMetricsTrusted(metrics: ProbeMetrics): boolean {
  const probe = metrics.probeSize > 0 ? metrics.probeSize : 200;
  return verticalMetric(metrics.actualBoundingBoxAscent, probe, 0.35) != null && verticalMetric(metrics.fontBoundingBoxAscent, probe, 0.45) != null;
}

export function fitLine(metrics: ProbeMetrics, targetWidth: number, options: FitLineOptions = {}): FittedLine {
  const probe = metrics.probeSize > 0 ? metrics.probeSize : 200;
  const leading = options.leading != null && Number.isFinite(options.leading) && options.leading > 0 ? options.leading : 0.92;
  const trusted = options.trusted !== false;
  const advance = metrics.advanceWidth > 0 ? metrics.advanceWidth : metrics.domAdvanceWidth;
  const dom = metrics.domAdvanceWidth > 0 ? metrics.domAdvanceWidth : advance;
  const cr = advance > 0 ? dom / advance : 1;
  const ink = (metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight) * cr;
  const fontSize = ink > 0.5 ? (probe * targetWidth) / ink : probe;
  if (!trusted) {
    return {
      fontSize,
      height: Math.max(1, fontSize * leading),
      shiftTop: 0,
      shiftLeft: 0,
    };
  }
  const k = fontSize / probe;
  const kx = k * cr;
  const inkA = metrics.actualBoundingBoxAscent * k;
  const inkD = metrics.actualBoundingBoxDescent * k;
  const fA = metrics.fontBoundingBoxAscent * k;
  const fD = metrics.fontBoundingBoxDescent * k;
  const half = (fontSize - (fA + fD)) / 2;
  const inkTop = half + fA - inkA;
  const inkHeight = Number.isFinite(inkA + inkD) ? inkA + inkD : 0;
  return {
    fontSize,
    height: Math.max(1, inkHeight > 0 ? inkHeight : fontSize * leading),
    shiftTop: Number.isFinite(inkTop) ? -inkTop : 0,
    shiftLeft: Number.isFinite(metrics.actualBoundingBoxLeft * kx) ? metrics.actualBoundingBoxLeft * kx : 0,
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
