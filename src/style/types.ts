import type { FormatId } from '../composition/formats';

export type LayoutMode = 'poster' | 'quiet';
export type Align = 'left' | 'center' | 'right';
export type BackgroundMode = 'auto' | 'manual';
export type TempUnit = 'F' | 'C' | 'both';

export interface Style {
  presetId: string | null;
  recipeId: string;
  layout: LayoutMode;
  align: Align;
  format: FormatId;
  textColor: string;
  backgroundColor: string;
  backgroundMode: BackgroundMode;
  /** When set, footer type uses this instead of the hero color. Preset 01. */
  footerColor: string | null;
  displayFontId: string;
  monoFontId: string;
  measurements: Record<string, boolean>;
  temperatureUnit: TempUnit;
}
