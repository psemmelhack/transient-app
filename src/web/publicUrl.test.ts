import { describe, expect, it } from 'vitest';
import { publicAssetUrl } from './publicUrl';

describe('publicAssetUrl', () => {
  it('resolves public files at the custom domain root', () => {
    expect(publicAssetUrl('vendor/maplibre-gl.css', 'https://transient.notarist.art/')).toBe(
      'https://transient.notarist.art/vendor/maplibre-gl.css',
    );
  });

  it('resolves public files at the dev server root', () => {
    expect(publicAssetUrl('vendor/maplibre-gl.css', 'http://localhost:8081/')).toBe(
      'http://localhost:8081/vendor/maplibre-gl.css',
    );
  });

  it('follows a root base href when the address is not the site root', () => {
    expect(publicAssetUrl('fonts.css', 'https://transient.notarist.art/')).toBe(
      'https://transient.notarist.art/fonts.css',
    );
    expect(publicAssetUrl('sw.js', 'https://transient.notarist.art/a-missing-path')).toBe(
      'https://transient.notarist.art/sw.js',
    );
  });
});
