import { isHex, normalizeHex } from '../color/oklch';
import { getFont } from '../composition/fonts';
import { FORMATS, resolvedFormat, type FormatId } from '../composition/formats';
import { RECIPES } from '../composition/recipes';
import { defaultMeasurements } from '../data/plugins';
import { defaultStyle } from './presets';
import type { Align, BackgroundMode, LayoutMode, Style, TempUnit } from './types';

const KEY = 'transient.style.v1';

function isAlign(value: unknown): value is Align {
  return value === 'left' || value === 'center' || value === 'right';
}

function isLayout(value: unknown): value is LayoutMode {
  return value === 'poster' || value === 'quiet';
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
    footerColor:
      typeof raw.footerColor === 'string' && isHex(raw.footerColor) ? normalizeHex(raw.footerColor) : null,
    displayFontId: display.id,
    monoFontId: mono.category === 'mono' ? mono.id : base.monoFontId,
    measurements,
    temperatureUnit: isUnit(raw.temperatureUnit) ? raw.temperatureUnit : 'F',
  };
}

export function loadStyle(): Style {
  try {
    if (typeof localStorage === 'undefined') return defaultStyle();
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultStyle();
    return sanitizeStyle(JSON.parse(raw));
  } catch {
    return defaultStyle();
  }
}

export function saveStyle(style: Style): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(KEY, JSON.stringify(style));
  } catch {
    /* private mode and full disks should not break the maker */
  }
}
