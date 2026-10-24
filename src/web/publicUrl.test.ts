import { describe, expect, it } from 'vitest';
import { publicAssetUrl } from './publicUrl';

describe('publicAssetUrl', () => {
  it('resolves public files under the pages prefix', () => {
    expect(publicAssetUrl('vendor/maplibre-gl.css', 'https://psemmelhack.github.io/transient-app/')).toBe(
      'https://psemmelhack.github.io/transient-app/vendor/maplibre-gl.css',
    );
  });

  it('resolves public files at the dev server root', () => {
    expect(publicAssetUrl('vendor/maplibre-gl.css', 'http://localhost:8081/')).toBe(
      'http://localhost:8081/vendor/maplibre-gl.css',
    );
  });

  it('follows a base href when the page URL is not the directory', () => {
    expect(publicAssetUrl('fonts.css', 'http://127.0.0.1:4173/transient-app/')).toBe(
      'http://127.0.0.1:4173/transient-app/fonts.css',
    );
  });
});
