import type { FormatId } from '../composition/formats';

export type LayoutMode = 'poster' | 'quiet' | 'note';
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
  /**
   * Rounded "lat,lon" cell the Made face was built from, or null before a fix.
   * Two decimal places, about a kilometer. Saved with the transient.
   */
  madeCell: string | null;
  /** 0 is the cell itself. Each regenerate asks for the next variation of that cell. */
  madeVariant: number;
  /** Derived from the cell and the variant. Preview, capture, and the saved record share it. */
  madeSeed: number;
  measurements: Record<string, boolean>;
  temperatureUnit: TempUnit;
}
