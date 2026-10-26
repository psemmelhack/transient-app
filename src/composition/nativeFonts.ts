import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import type { CssFont } from './fonts';

/**
 * Faces Expo Go can draw. Variable axes from the web CSS are not applied;
 * each file is registered as one family name.
 */
export const posterFontMap = {
  Anton: require('../../public/fonts/Anton-Regular.ttf'),
  'Big Shoulders Display': require('../../public/fonts/BigShouldersDisplay-wght.ttf'),
  Fraunces: require('../../public/fonts/Fraunces-SOFT-WONK-opsz-wght.ttf'),
  'Fraunces Italic': require('../../public/fonts/Fraunces-Italic-SOFT-WONK-opsz-wght.ttf'),
  Antonio: require('../../public/fonts/Antonio-wght.ttf'),
  'Bebas Neue': require('../../public/fonts/BebasNeue-Regular.ttf'),
  'League Gothic': require('../../public/fonts/LeagueGothic-wdth.ttf'),
  'Six Caps': require('../../public/fonts/SixCaps.ttf'),
  'Bodoni Moda': require('../../public/fonts/BodoniModa-opsz-wght.ttf'),
  'Bodoni Moda Italic': require('../../public/fonts/BodoniModa-Italic-opsz-wght.ttf'),
  'Instrument Serif': require('../../public/fonts/InstrumentSerif-Regular.ttf'),
  'Instrument Serif Italic': require('../../public/fonts/InstrumentSerif-Italic.ttf'),
  'Playfair Display': require('../../public/fonts/PlayfairDisplay-Italic-wght.ttf'),
  'DM Serif Display': require('../../public/fonts/DMSerifDisplay-Regular.ttf'),
  Inter: Inter_500Medium,
  'Inter Regular': Inter_400Regular,
  'Inter Medium': Inter_500Medium,
  'IBM Plex Mono': require('../../public/fonts/IBMPlexMono-Regular.ttf'),
  'IBM Plex Mono Medium': require('../../public/fonts/IBMPlexMono-Medium.ttf'),
  'JetBrains Mono': require('../../public/fonts/JetBrainsMono-wght.ttf'),
  'Space Mono': require('../../public/fonts/SpaceMono-Regular.ttf'),
} as const;

/** The loaded face for a scene font. Weight and style select a file, not a synthetic face. */
export function nativeFontFamily(font: CssFont): string {
  if (font.family === 'Inter') return font.weight >= 500 ? 'Inter Medium' : 'Inter Regular';
  if (font.family === 'IBM Plex Mono' && font.weight >= 500) return 'IBM Plex Mono Medium';
  if (font.style === 'italic' && font.family !== 'Playfair Display') return `${font.family} Italic`;
  return font.family;
}
