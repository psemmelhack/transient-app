import { describe, expect, it } from 'vitest';
import app from '../../app.json';
import { pagesBaseHref, pagesCname, prepareHtml, readLinkPreview, readShippedCname } from '../../scripts/prepare-pages.mjs';

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

  it('ships the link-preview tags in the html template', () => {
    const { html, robots, ogWidth, ogHeight, pngSignature, touchWidth, touchHeight } = readLinkPreview();
    expect(html).toContain('<title>Transient</title>');
    expect(html).toContain('<meta name="description" content="Mark where and when you are." />');
    expect(html).toContain('<meta property="og:title" content="Transient" />');
    expect(html).toContain('<meta property="og:description" content="Mark where and when you are." />');
    expect(html).toContain('<meta property="og:url" content="https://transient.notarist.art/" />');
    expect(html).toContain('<meta property="og:type" content="website" />');
    expect(html).toContain('<meta property="og:image" content="https://transient.notarist.art/og.png" />');
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
    expect(html).toContain('<meta property="og:image:height" content="630" />');
    expect(html).toContain('<meta property="og:image:alt" content="A Transient for Green Valley, California." />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(html).toContain('<meta name="twitter:image" content="https://transient.notarist.art/og.png" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="icons/apple-touch-icon.png" sizes="180x180" />');
    expect(html).toContain('<link rel="icon" href="icons/favicon.png" />');
    expect(ogWidth).toBe(1200);
    expect(ogHeight).toBe(630);
    expect(pngSignature).toBe(0x89);
    expect(touchWidth).toBe(180);
    expect(touchHeight).toBe(180);
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).not.toContain('Disallow');
    const prepared = prepareHtml(html);
    expect(prepared).toContain('https://transient.notarist.art/og.png');
    expect(prepared).toContain('<title>Transient</title>');
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
