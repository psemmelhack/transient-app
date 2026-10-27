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

/**
 * Canvas ink that disagrees with the DOM advance is a bad measurement
 * (WebKit sometimes reports a box many times the glyphs). Fit from the DOM width then.
 */
export function metricsForFit(metrics: ProbeMetrics): ProbeMetrics {
  const advance = metrics.advanceWidth > 0 ? metrics.advanceWidth : metrics.domAdvanceWidth;
  const dom = metrics.domAdvanceWidth > 0 ? metrics.domAdvanceWidth : advance;
  const reference = dom > 1 ? dom : advance;
  const ink = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
  const ratio = reference > 1 ? ink / reference : 0;
  const sane =
    reference > 1 &&
    ink > 1 &&
    ratio >= 0.65 &&
    ratio <= 1.35 &&
    metrics.actualBoundingBoxLeft > -reference &&
    metrics.actualBoundingBoxLeft < reference;
  if (sane) return metrics;
  return {
    ...metrics,
    advanceWidth: reference,
    domAdvanceWidth: reference,
    actualBoundingBoxLeft: 0,
    actualBoundingBoxRight: reference,
  };
}

export interface VerticalInk {
  ascent: number;
  descent: number;
}

/**
 * Prefer the canvas API when it agrees with the painted pixels.
 * A box that is far shorter than the font, or that disagrees with the pixels, is discarded
 * so the line can fall back to the em square instead of cropping the glyphs.
 */
export function chooseVertical(
  probe: number,
  api: VerticalInk & { fontAscent: number },
  pixels: VerticalInk | null,
): VerticalInk | null {
  const size = probe > 0 ? probe : 200;
  const plausible = (ascent: number, descent: number) =>
    Number.isFinite(ascent) &&
    Number.isFinite(descent) &&
    ascent >= size * 0.55 &&
    ascent <= size * 1.25 &&
    descent >= 0 &&
    descent <= size * 0.5;
  const apiOk = plausible(api.ascent, api.descent);
  const pixOk = pixels != null && plausible(pixels.ascent, pixels.descent);
  if (apiOk && pixOk && Math.abs(api.ascent - pixels.ascent) <= 3 && Math.abs(api.descent - pixels.descent) <= 3) {
    return { ascent: api.ascent, descent: api.descent };
  }
  if (pixOk && pixels) return { ascent: pixels.ascent, descent: pixels.descent };
  if (apiOk && api.fontAscent > size * 0.45 && api.ascent >= api.fontAscent * 0.68) {
    return { ascent: api.ascent, descent: api.descent };
  }
  return null;
}

export interface LineBox {
  height: number;
  shiftTop: number;
  /** False when the em square must stay open so a bad metric cannot crop the type. */
  crop: boolean;
}

/**
 * Place the line box on the browser's baseline plus the ink height.
 * The same numbers the desktop canvas already reports keep today's crop.
 * Missing ink uses the full em square and does not crop.
 */
export function placeLineBox(input: {
  fontSize: number;
  probeSize: number;
  baseline: number | null;
  ascent: number | null;
  descent: number | null;
}): LineBox {
  const probe = input.probeSize > 0 ? input.probeSize : 200;
  const k = input.fontSize / probe;
  const ascent = input.ascent;
  const descent = input.descent ?? 0;
  const baseline = input.baseline;
  if (
    ascent != null &&
    baseline != null &&
    baseline > probe * 0.3 &&
    baseline < probe * 1.4 &&
    ascent >= probe * 0.55 &&
    ascent <= probe * 1.25 &&
    descent >= 0 &&
    descent <= probe * 0.5
  ) {
    const top = baseline - ascent;
    const bottom = baseline + descent;
    return { height: Math.max(1, (bottom - top) * k), shiftTop: -top * k, crop: true };
  }
  return { height: Math.max(1, input.fontSize), shiftTop: 0, crop: false };
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
