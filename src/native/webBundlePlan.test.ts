import { describe, expect, it } from 'vitest';
import { assetTransferKind, cacheFolderName, cacheRoot, directoryFor, isSafeRelative, normalizeLocalUri } from './webBundlePlan';

describe('web bundle plan', () => {
  it('names the cache folder with the update and the pack revision', () => {
    expect(cacheFolderName('8c02cd25-aaaa', '962762e3668b')).toBe('transient-web-8c02cd25-aaaa-962762e3668b');
    expect(cacheFolderName(null, '962762e3668b')).toBe('transient-web-embedded-962762e3668b');
    expect(cacheFolderName('id with spaces', 'rev')).toBe('transient-web-idwithspaces-rev');
  });

  it('keeps a trailing slash on the cache root', () => {
    expect(cacheRoot('file:///cache/', 'transient-web-embedded-rev')).toBe('file:///cache/transient-web-embedded-rev/');
    expect(cacheRoot('file:///cache', 'transient-web-embedded-rev')).toBe('file:///cache/transient-web-embedded-rev/');
  });

  it('turns a bare absolute path into a file URL and leaves schemes alone', () => {
    expect(normalizeLocalUri('/var/mobile/Containers/Data/file.html')).toBe('file:///var/mobile/Containers/Data/file.html');
    expect(normalizeLocalUri('file:///cache/app.webjs')).toBe('file:///cache/app.webjs');
    expect(normalizeLocalUri('content://media/external/file/1')).toBe('content://media/external/file/1');
    expect(normalizeLocalUri('https://cdn.example/app.webjs')).toBe('https://cdn.example/app.webjs');
  });

  it('downloads remote URLs and copies local ones', () => {
    expect(assetTransferKind('https://cdn.example/app.webjs')).toBe('download');
    expect(assetTransferKind('file:///cache/app.webjs')).toBe('copy');
    expect(assetTransferKind('content://media/external/file/1')).toBe('copy');
  });

  it('finds the parent directory of a nested pack file', () => {
    expect(directoryFor('file:///cache/pack/', 'fonts/a.woff')).toBe('file:///cache/pack/fonts');
    expect(directoryFor('file:///cache/pack/', '_expo/static/js/web/app.js')).toBe('file:///cache/pack/_expo/static/js/web');
    expect(directoryFor('file:///cache/pack/', 'index.html')).toBeNull();
    expect(isSafeRelative('fonts/a.woff')).toBe(true);
    expect(isSafeRelative('../secrets')).toBe(false);
  });
});
