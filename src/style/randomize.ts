import { complementaryBackground, MIN_AUTO_CONTRAST } from '../color/complement';
import { contrastRatio } from '../color/contrast';
import { displayFonts, monoFonts } from '../composition/fonts';
import type { Style } from './types';

/** Colors dark or light enough that a partner can clear the contrast bar. */
const TEXT_COLORS = [
  '#8E1B16',
  '#14203A',
  '#1C3A5F',
  '#4B1C40',
  '#1E3A2D',
  '#0F3D34',
  '#111111',
  '#2A2420',
  '#3A2418',
  '#CBA65E',
  '#E7D7B1',
  '#F2E8D5',
  '#F4EFE6',
  '#E3F03A',
  '#F7E4E1',
  '#D6E2F0',
  '#E4EFE8',
  '#F6F1E6',
].filter((hex) => contrastRatio(hex, '#FFFFFF') >= MIN_AUTO_CONTRAST || contrastRatio(hex, '#000000') >= MIN_AUTO_CONTRAST);

const LAYOUTS: Style['layout'][] = ['poster', 'quiet'];
const ALIGNS: Style['align'][] = ['left', 'center', 'right'];

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

/** New display face, mono, layout, alignment, and a complementary color pair. Format stays. */
export function randomStyle(current: Style, rng: () => number = Math.random): Style {
  const displays = displayFonts();
  const monos = monoFonts();
  let display = pick(displays, rng);
  let guard = 0;
  while (display.id === current.displayFontId && displays.length > 1 && guard < 6) {
    display = pick(displays, rng);
    guard += 1;
  }
  const mono = pick(monos, rng);
  const layout = pick(LAYOUTS, rng);
  const align = pick(ALIGNS, rng);
  const textColor = pick(TEXT_COLORS, rng);
  const backgroundColor = complementaryBackground(textColor, MIN_AUTO_CONTRAST);
  return {
    ...current,
    presetId: null,
    recipeId: layout === 'poster' ? 'poster-generic' : 'quiet-generic',
    layout,
    align,
    textColor,
    backgroundColor,
    backgroundMode: 'auto',
    footerColor: null,
    displayFontId: display.id,
    monoFontId: mono.id,
  };
}
