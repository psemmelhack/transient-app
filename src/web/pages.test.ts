import { describe, expect, it } from 'vitest';
import app from '../../app.json';
import { pagesBaseHref, pagesCname, prepareHtml, readShippedCname } from '../../scripts/prepare-pages.mjs';

describe('pages export', () => {
  it('serves the app from the domain root', () => {
    expect(app.expo.experiments.baseUrl).toBe('');
    expect(app.expo.web.startUrl).toBe('/');
    expect(readShippedCname()).toBe(pagesCname);
    expect(pagesBaseHref).toBe('/');
    expect(pagesCname).toBe('transient.notarist.art');
  });

  it('sets a root base href and keeps noindex', () => {
    const html = prepareHtml('<html><head><title>Transient</title></head><body></body></html>');
    expect(html).toContain('<base href="/" />');
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
    expect(html).not.toContain('/transient-app');
  });

  it('replaces a project-site base href', () => {
    const html = prepareHtml(
      '<html><head><base href="/transient-app/" /><meta name="robots" content="noindex, nofollow" /></head></html>',
    );
    expect(html).toContain('<base href="/" />');
    expect(html).not.toContain('/transient-app');
    expect(html.match(/name="robots"/g)).toHaveLength(1);
  });
});
