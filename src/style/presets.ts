import { defaultMeasurements } from '../data/plugins';
import type { Style } from './types';

export interface Preset {
  id: string;
  name: string;
  recipeId: string;
  layout: Style['layout'];
  align: Style['align'];
  format: Style['format'];
  textColor: string;
  backgroundColor: string;
  footerColor: string | null;
  displayFontId: string;
  monoFontId: string;
  /** Sample note used only when reproducing the reference posters. */
  sampleMessage: string;
}

export const PRESETS: Preset[] = [
  {
    id: '01',
    name: 'Anton',
    recipeId: 'poster-anton',
    layout: 'poster',
    align: 'left',
    format: 'feed',
    textColor: '#D2231C',
    backgroundColor: '#DCEFE4',
    footerColor: '#B01E18',
    displayFontId: 'anton',
    monoFontId: 'plex',
    sampleMessage: 'We were here.',
  },
  {
    id: '02',
    name: 'Big Shoulders',
    recipeId: 'poster-shoulders',
    layout: 'poster',
    align: 'center',
    format: 'feed',
    textColor: '#F2E8D5',
    backgroundColor: '#14203A',
    footerColor: null,
    displayFontId: 'big-shoulders',
    monoFontId: 'jetbrains',
    sampleMessage: 'The light on the water, right now.',
  },
  {
    id: '03',
    name: 'Bodoni',
    recipeId: 'quiet-bodoni',
    layout: 'quiet',
    align: 'center',
    format: 'feed',
    textColor: '#4B1C40',
    backgroundColor: '#F7E4E1',
    footerColor: null,
    displayFontId: 'bodoni',
    monoFontId: 'plex',
    sampleMessage: 'Walking home the long way, slowly.',
  },
  {
    id: '04',
    name: 'Instrument',
    recipeId: 'quiet-instrument',
    layout: 'quiet',
    align: 'right',
    format: 'feed',
    textColor: '#CBA65E',
    backgroundColor: '#121110',
    footerColor: null,
    displayFontId: 'instrument',
    monoFontId: 'space-mono',
    sampleMessage: 'We were here.',
  },
  {
    id: '05',
    name: 'Antonio',
    recipeId: 'poster-antonio',
    layout: 'poster',
    align: 'right',
    format: 'story',
    textColor: '#111111',
    backgroundColor: '#E3F03A',
    footerColor: null,
    displayFontId: 'antonio',
    monoFontId: 'plex',
    sampleMessage: 'Low tide. Everyone barefoot.',
  },
  {
    id: '06',
    name: 'Fraunces',
    recipeId: 'poster-fraunces',
    layout: 'poster',
    align: 'left',
    format: 'square',
    textColor: '#1E3A2D',
    backgroundColor: '#F1EADC',
    footerColor: null,
    displayFontId: 'fraunces',
    monoFontId: 'jetbrains',
    sampleMessage: 'The light on the water, right now.',
  },
  {
    id: '07',
    name: 'Ledger',
    recipeId: 'quiet-ledger',
    layout: 'quiet',
    align: 'left',
    format: 'feed',
    textColor: '#1A1F2B',
    backgroundColor: '#F5F3EE',
    footerColor: null,
    displayFontId: 'inter',
    monoFontId: 'plex',
    sampleMessage: 'For the record.',
  },
  {
    id: '08',
    name: 'Boardroom',
    recipeId: 'quiet-boardroom',
    layout: 'quiet',
    align: 'left',
    format: 'feed',
    textColor: '#ECE8DF',
    backgroundColor: '#0E1A2B',
    footerColor: null,
    displayFontId: 'instrument',
    monoFontId: 'plex',
    sampleMessage: 'Approved as presented.',
  },
  {
    id: '09',
    name: 'Title block',
    recipeId: 'quiet-title-block',
    layout: 'quiet',
    align: 'left',
    format: 'feed',
    textColor: '#23262B',
    backgroundColor: '#E6E8EB',
    footerColor: null,
    displayFontId: 'plex',
    monoFontId: 'plex',
    sampleMessage: 'Issued for record.',
  },
];

export function presetById(id: string): Preset {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[0];
}

export function styleFromPreset(preset: Preset, previous?: Style): Style {
  return {
    presetId: preset.id,
    recipeId: preset.recipeId,
    layout: preset.layout,
    align: preset.align,
    format: preset.format,
    textColor: preset.textColor,
    backgroundColor: preset.backgroundColor,
    backgroundMode: 'manual',
    footerColor: preset.footerColor,
    displayFontId: preset.displayFontId,
    monoFontId: preset.monoFontId,
    measurements: previous?.measurements ?? defaultMeasurements(),
    temperatureUnit: previous?.temperatureUnit ?? 'F',
  };
}

export function defaultStyle(): Style {
  return styleFromPreset(PRESETS[0]);
}
