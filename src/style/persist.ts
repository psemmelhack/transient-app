import { DEFAULT_GRADIENT, normalizeAngle } from '../color/gradient';
import { isHex, normalizeHex } from '../color/oklch';
import { getFont } from '../composition/fonts';
import { isMadeCell, seedForCell } from '../composition/madeSeed';
import { FORMATS, resolvedFormat, type FormatId } from '../composition/formats';
import { RECIPES } from '../composition/recipes';
import { defaultMeasurements } from '../data/plugins';
import { defaultStyle } from './presets';
import { readStyleRaw, writeStyleRaw } from './styleStore';
import type { Align, BackgroundFill, BackgroundMode, CardGradient, LayoutMode, Style, TempUnit } from './types';

export const STYLE_KEY = 'transient.style.v1';

function isAlign(value: unknown): value is Align {
  return value === 'left' || value === 'center' || value === 'right';
}

function isLayout(value: unknown): value is LayoutMode {
  return value === 'poster' || value === 'quiet' || value === 'note' || value === 'jam' || value === 'crush';
}

function isFormat(value: unknown): value is FormatId {
  return typeof value === 'string' && value in FORMATS;
}

function isUnit(value: unknown): value is TempUnit {
  return value === 'F' || value === 'C' || value === 'both';
}

function isMode(value: unknown): value is BackgroundMode {
  return value === 'auto' || value === 'manual';
}

function isFill(value: unknown): value is BackgroundFill {
  return value === 'solid' || value === 'gradient';
}

function gradientOf(value: unknown): CardGradient {
  const base = DEFAULT_GRADIENT;
  if (!value || typeof value !== 'object') return base;
  const raw = value as Partial<CardGradient>;
  const incoming = Array.isArray(raw.colors) ? raw.colors : [];
  const colors = [0, 1, 2].map((index) => {
    const color = incoming[index];
    return typeof color === 'string' && isHex(color) ? normalizeHex(color) : base.colors[index];
  }) as [string, string, string];
  return {
    stops: raw.stops === 3 ? 3 : 2,
    colors,
    angle: normalizeAngle(typeof raw.angle === 'number' ? raw.angle : base.angle),
  };
}

function madeVariantOf(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 1_000_000) return 0;
  return value;
}

export function sanitizeStyle(input: unknown): Style {
  const base = defaultStyle();
  if (!input || typeof input !== 'object') return base;
  const raw = input as Partial<Style>;
  const display = typeof raw.displayFontId === 'string' ? getFont(raw.displayFontId) : getFont(base.displayFontId);
  const mono = typeof raw.monoFontId === 'string' ? getFont(raw.monoFontId) : getFont(base.monoFontId);
  const recipeId = typeof raw.recipeId === 'string' && raw.recipeId in RECIPES ? raw.recipeId : base.recipeId;
  const measurements = { ...defaultMeasurements(), ...(raw.measurements ?? {}) };
  return {
    presetId: typeof raw.presetId === 'string' ? raw.presetId : raw.presetId === null ? null : base.presetId,
    recipeId,
    layout: isLayout(raw.layout) ? raw.layout : base.layout,
    align: isAlign(raw.align) ? raw.align : base.align,
    format: resolvedFormat(isFormat(raw.format) ? raw.format : base.format),
    textColor: typeof raw.textColor === 'string' && isHex(raw.textColor) ? normalizeHex(raw.textColor) : base.textColor,
    backgroundColor:
      typeof raw.backgroundColor === 'string' && isHex(raw.backgroundColor)
        ? normalizeHex(raw.backgroundColor)
        : base.backgroundColor,
    backgroundMode: isMode(raw.backgroundMode) ? raw.backgroundMode : base.backgroundMode,
    backgroundFill: isFill(raw.backgroundFill) ? raw.backgroundFill : 'solid',
    gradient: gradientOf(raw.gradient),
    footerColor:
      typeof raw.footerColor === 'string' && isHex(raw.footerColor) ? normalizeHex(raw.footerColor) : null,
    displayFontId: display.id,
    monoFontId: mono.category === 'mono' ? mono.id : base.monoFontId,
    madeCell: isMadeCell(raw.madeCell) ? raw.madeCell : null,
    madeVariant: madeVariantOf(raw.madeVariant),
    madeSeed:
      typeof raw.madeSeed === 'number' && Number.isFinite(raw.madeSeed)
        ? raw.madeSeed >>> 0
        : seedForCell(isMadeCell(raw.madeCell) ? raw.madeCell : null, madeVariantOf(raw.madeVariant)),
    measurements,
    temperatureUnit: isUnit(raw.temperatureUnit) ? raw.temperatureUnit : 'F',
    photoTone: toneOf(raw.photoTone),
  };
}

function toneOf(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

export function hasSavedStyle(): boolean {
  try {
    if (typeof localStorage === 'undefined') return readStyleRaw() != null;
    return localStorage.getItem(STYLE_KEY) != null;
  } catch {
    return true;
  }
}

export function loadStyle(): Style {
  try {
    const raw = readStyleRaw();
    if (!raw) return defaultStyle();
    return sanitizeStyle(JSON.parse(raw));
  } catch {
    return defaultStyle();
  }
}

export function saveStyle(style: Style): void {
  try {
    writeStyleRaw(JSON.stringify(style));
  } catch {
    /* private mode and full disks should not break the maker */
  }
}
