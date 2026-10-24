import { describe, expect, it } from 'vitest';
import { fontsIn, getFont, monoFonts } from './fonts';

describe('font catalog', () => {
  it('replaces Italiana with DM Serif Display in Classic', () => {
    const classic = fontsIn('classic').map((font) => font.id);
    expect(classic).toContain('dm-serif');
    expect(classic).not.toContain('italiana');
    expect(getFont('italiana').id).toBe('dm-serif');
    expect(getFont('dm-serif').name).toBe('DM Serif Display');
  });

  it('lists IBM Plex Mono in Sans and still as a mono face', () => {
    const sans = fontsIn('sans');
    expect(sans.map((font) => font.name)).toEqual(['Inter', 'IBM Plex Mono']);
    expect(sans[1].family).toBe('IBM Plex Mono');
    expect(sans[1].id).toBe('plex-sans');
    const mono = monoFonts().find((font) => font.id === 'plex');
    expect(mono?.name).toBe('IBM Plex Mono');
    expect(mono?.category).toBe('mono');
  });
});