export type FontCategory = 'tall' | 'bold' | 'silky' | 'classic' | 'sans' | 'mono';

export type FontRole = 'display' | 'display-italic' | 'mono' | 'mono-medium';

export interface CssFont {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  variation?: string;
  features?: string;
}

export interface FontDef {
  id: string;
  name: string;
  family: string;
  category: FontCategory;
  weight: number;
  style: 'normal' | 'italic';
  variation?: string;
  /** OpenType features, such as tabular figures. */
  features?: string;
  italic: boolean;
  italicWeight?: number;
  italicVariation?: string;
  mediumWeight?: number;
}

export const CATEGORIES: { id: FontCategory; label: string }[] = [
  { id: 'tall', label: 'Tall / condensed' },
  { id: 'bold', label: 'Bold / expressive' },
  { id: 'silky', label: 'Silky serif' },
  { id: 'classic', label: 'Classic' },
  { id: 'sans', label: 'Sans' },
  { id: 'mono', label: 'Mono' },
];

export const FONTS: FontDef[] = [
  {
    id: 'anton',
    name: 'Anton',
    family: 'Anton',
    category: 'bold',
    weight: 400,
    style: 'normal',
    italic: false,
  },
  {
    id: 'big-shoulders',
    name: 'Big Shoulders Display',
    family: 'Big Shoulders Display',
    category: 'bold',
    weight: 900,
    style: 'normal',
    variation: "'wght' 900",
    italic: false,
  },
  {
    id: 'fraunces',
    name: 'Fraunces',
    family: 'Fraunces',
    category: 'bold',
    weight: 600,
    style: 'normal',
    variation: "'SOFT' 100, 'WONK' 1, 'opsz' 144, 'wght' 600",
    italic: true,
    italicWeight: 400,
    italicVariation: "'SOFT' 100, 'WONK' 1, 'opsz' 48, 'wght' 400",
  },
  {
    id: 'antonio',
    name: 'Antonio',
    family: 'Antonio',
    category: 'tall',
    weight: 700,
    style: 'normal',
    variation: "'wght' 700",
    italic: false,
  },
  {
    id: 'bebas',
    name: 'Bebas Neue',
    family: 'Bebas Neue',
    category: 'tall',
    weight: 400,
    style: 'normal',
    italic: false,
  },
  {
    id: 'league-gothic',
    name: 'League Gothic',
    family: 'League Gothic',
    category: 'tall',
    weight: 400,
    style: 'normal',
    variation: "'wdth' 75",
    italic: false,
  },
  {
    id: 'six-caps',
    name: 'Six Caps',
    family: 'Six Caps',
    category: 'tall',
    weight: 400,
    style: 'normal',
    italic: false,
  },
  {
    id: 'bodoni',
    name: 'Bodoni Moda',
    family: 'Bodoni Moda',
    category: 'silky',
    weight: 500,
    style: 'normal',
    variation: "'opsz' 11, 'wght' 500",
    italic: true,
    italicWeight: 500,
    italicVariation: "'opsz' 11, 'wght' 500",
  },
  {
    id: 'instrument',
    name: 'Instrument Serif',
    family: 'Instrument Serif',
    category: 'silky',
    weight: 400,
    style: 'normal',
    italic: true,
    italicWeight: 400,
  },
  {
    id: 'playfair',
    name: 'Playfair Display',
    family: 'Playfair Display',
    category: 'silky',
    weight: 500,
    style: 'italic',
    variation: "'wght' 500",
    italic: true,
    italicWeight: 500,
    italicVariation: "'wght' 500",
  },
  {
    id: 'dm-serif',
    name: 'DM Serif Display',
    family: 'DM Serif Display',
    category: 'classic',
    weight: 400,
    style: 'normal',
    italic: false,
  },
  {
    id: 'inter',
    name: 'Inter',
    family: 'Inter',
    category: 'sans',
    weight: 500,
    style: 'normal',
    variation: "'wght' 500",
    features: '"tnum" 1, "lnum" 1',
    italic: false,
  },
  {
    id: 'plex-sans',
    name: 'IBM Plex Mono',
    family: 'IBM Plex Mono',
    category: 'sans',
    weight: 400,
    style: 'normal',
    italic: false,
  },
  {
    id: 'plex',
    name: 'IBM Plex Mono',
    family: 'IBM Plex Mono',
    category: 'mono',
    weight: 400,
    style: 'normal',
    italic: false,
    mediumWeight: 500,
  },
  {
    id: 'jetbrains',
    name: 'JetBrains Mono',
    family: 'JetBrains Mono',
    category: 'mono',
    weight: 400,
    style: 'normal',
    italic: false,
    mediumWeight: 500,
  },
  {
    id: 'space-mono',
    name: 'Space Mono',
    family: 'Space Mono',
    category: 'mono',
    weight: 400,
    style: 'normal',
    italic: false,
    mediumWeight: 400,
  },
];

const byId = new Map(FONTS.map((font) => [font.id, font]));

/** Saved styles that named a removed face resolve to its replacement. */
const REPLACED_FONT_IDS: Record<string, string> = {
  italiana: 'dm-serif',
};

export function getFont(id: string): FontDef {
  const resolved = REPLACED_FONT_IDS[id] ?? id;
  return byId.get(resolved) ?? FONTS[0];
}

export function displayFonts(): FontDef[] {
  return FONTS.filter((font) => font.category !== 'mono');
}

export function monoFonts(): FontDef[] {
  return FONTS.filter((font) => font.category === 'mono');
}

export function fontsIn(category: FontCategory): FontDef[] {
  return FONTS.filter((font) => font.category === category);
}

export function resolveFont(displayId: string, monoId: string, role: FontRole): CssFont {
  if (role === 'mono' || role === 'mono-medium') {
    const font = getFont(monoId);
    const weight = role === 'mono-medium' ? (font.mediumWeight ?? font.weight) : font.weight;
    return { family: font.family, weight, style: 'normal', variation: font.variation, features: font.features };
  }
  const font = getFont(displayId);
  const italic = role === 'display-italic' && font.italic;
  if (italic) {
    return {
      family: font.family,
      weight: font.italicWeight ?? font.weight,
      style: 'italic',
      variation: font.italicVariation ?? font.variation,
      features: font.features,
    };
  }
  return {
    family: font.family,
    weight: font.weight,
    style: font.style,
    variation: font.variation,
    features: font.features,
  };
}

export function fontCss(font: CssFont): {
  fontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  fontVariationSettings?: string;
  fontFeatureSettings?: string;
} {
  const name = font.family.toLowerCase();
  const fallback = name.includes('mono') ? 'monospace' : name === 'inter' ? 'sans-serif' : 'serif';
  return {
    fontFamily: `'${font.family}', ${fallback}`,
    fontWeight: font.weight,
    fontStyle: font.style,
    fontVariationSettings: font.variation,
    fontFeatureSettings: font.features,
  };
}
