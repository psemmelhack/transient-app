import { describe, expect, it } from 'vitest';
import {
  PACK_WATCHDOG_REASON,
  SITE,
  SITE_WATCHDOG_REASON,
  appendFailure,
  failureText,
  httpFailureText,
  nextAfterFailure,
  watchdogReason,
  webViewSource,
} from './shellLoad';

const pack = {
  kind: 'pack' as const,
  indexUrl: 'file:///cache/transient-web-embedded-rev/index.html',
  readAccessUrl: 'file:///cache/transient-web-embedded-rev/',
};

describe('shell load', () => {
  it('loads the installed index as a file URI and grants read access to the cache directory', () => {
    const source = webViewSource(pack);
    expect(source).toEqual({
      uri: pack.indexUrl,
      allowingReadAccessToURL: pack.readAccessUrl,
    });
    expect('html' in source).toBe(false);
  });

  it('loads the live site with no file read access', () => {
    expect(webViewSource({ kind: 'site' })).toEqual({ uri: SITE });
  });

  it('falls back from the pack to the site, then stops', () => {
    expect(nextAfterFailure(null, 'Could not copy index.html (missing file)').kind).toBe('site');
    expect(nextAfterFailure(pack, PACK_WATCHDOG_REASON)).toEqual({ kind: 'site', reason: PACK_WATCHDOG_REASON });
    expect(nextAfterFailure({ kind: 'site' }, SITE_WATCHDOG_REASON)).toEqual({ kind: 'give-up', reason: SITE_WATCHDOG_REASON });
  });

  it('names the watchdog and http failures', () => {
    expect(watchdogReason(pack)).toBe(PACK_WATCHDOG_REASON);
    expect(watchdogReason({ kind: 'site' })).toBe(SITE_WATCHDOG_REASON);
    expect(httpFailureText(404)).toBe('The page returned 404.');
    expect(httpFailureText(undefined)).toBe('The page returned an error.');
    expect(failureText(new Error('The cache is unavailable'))).toBe('The cache is unavailable');
    expect(failureText(null)).toBe('The page could not be opened.');
  });

  it('keeps earlier failures when a later fallback also fails', () => {
    expect(appendFailure(null, 'Could not copy index.html (missing file)')).toBe('Could not copy index.html (missing file)');
    expect(appendFailure('Could not copy index.html (missing file)', SITE_WATCHDOG_REASON)).toBe(
      `Could not copy index.html (missing file)\n${SITE_WATCHDOG_REASON}`,
    );
  });
});
