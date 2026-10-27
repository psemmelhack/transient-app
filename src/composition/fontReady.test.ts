import { describe, expect, it } from 'vitest';
import { familyFromShorthand, familyLoaded } from './fontReady';

describe('font load', () => {
  it('reads the family from a font shorthand', () => {
    expect(familyFromShorthand('normal 900 200px "Big Shoulders Display"')).toBe('Big Shoulders Display');
    expect(familyFromShorthand('italic 400 64px Anton')).toBe('Anton');
  });

  it('is ready only after a registered face has loaded', () => {
    expect(familyLoaded([], 'Big Shoulders Display')).toBe(false);
    expect(familyLoaded([{ family: 'Big Shoulders Display', weight: '100 900', style: 'normal', status: 'loading' }], 'Big Shoulders Display')).toBe(false);
    expect(familyLoaded([{ family: '"Big Shoulders Display"', weight: '100 900', style: 'normal', status: 'loaded' }], 'Big Shoulders Display')).toBe(true);
  });
});
