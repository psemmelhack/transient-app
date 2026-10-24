import { complementaryBackground } from '../color/complement';
import { isHex, normalizeHex } from '../color/oklch';
import type { FormatId } from '../composition/formats';
import { styleFromPreset, type Preset } from './presets';
import type { Align, LayoutMode, Style, TempUnit } from './types';

function leavePreset(style: Style, patch: Partial<Style>): Style {
  return { ...style, presetId: null, ...patch };
}

export function withPreset(style: Style, preset: Preset): Style {
  return styleFromPreset(preset, style);
}

export function withLayout(style: Style, layout: LayoutMode): Style {
  return leavePreset(style, {
    layout,
    recipeId: layout === 'poster' ? 'poster-generic' : 'quiet-generic',
    footerColor: null,
  });
}

export function withAlign(style: Style, align: Align): Style {
  return leavePreset(style, { align });
}

export function withFormat(style: Style, format: FormatId): Style {
  return leavePreset(style, { format });
}

export function withDisplayFont(style: Style, id: string): Style {
  return leavePreset(style, { displayFontId: id });
}

export function withMonoFont(style: Style, id: string): Style {
  return leavePreset(style, { monoFontId: id });
}

export function withTextColor(style: Style, hex: string): Style {
  if (!isHex(hex)) return style;
  const textColor = normalizeHex(hex);
  return leavePreset(style, {
    textColor,
    backgroundColor: complementaryBackground(textColor),
    backgroundMode: 'auto',
    footerColor: null,
  });
}

export function withBackground(style: Style, hex: string): Style {
  if (!isHex(hex)) return style;
  return leavePreset(style, {
    backgroundColor: normalizeHex(hex),
    backgroundMode: 'manual',
  });
}

export function withAutoBackground(style: Style): Style {
  return leavePreset(style, {
    backgroundMode: 'auto',
    backgroundColor: complementaryBackground(style.textColor),
    footerColor: null,
  });
}

export function withMeasurement(style: Style, id: string, enabled: boolean): Style {
  return { ...style, measurements: { ...style.measurements, [id]: enabled } };
}

export function withTemperatureUnit(style: Style, unit: TempUnit): Style {
  return { ...style, temperatureUnit: unit };
}
