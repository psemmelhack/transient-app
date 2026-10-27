import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { factsFromUpdates, formatBuildStamp, normalizeBuild } from './buildStamp';
import { PACK_REVISION } from './packRevision';

describe('build stamp', () => {
  it('names a browser tab web and the embedded pack', () => {
    expect(formatBuildStamp({ platform: 'web' })).toBe(`web\nrevision ${PACK_REVISION}`);
  });

  it('prints the expo-updates fields and the installed pack', () => {
    const update = factsFromUpdates(
      {
        updateId: '1D4CF072-AAAA-BBBB-CCCC-DDDDEEEEFFFF',
        createdAt: new Date('2026-10-22T21:09:09.000Z'),
        channel: 'production',
        runtimeVersion: 'exposdk:58.0.0',
      },
      '962762e3668b',
    );
    expect(update.createdAt).toBe('2026-10-22T21:09:09.000Z');
    expect(formatBuildStamp({ platform: 'native', update })).toBe(
      [
        'updateId 1D4CF072-AAAA-BBBB-CCCC-DDDDEEEEFFFF',
        'createdAt 2026-10-22T21:09:09.000Z',
        'channel production',
        'runtimeVersion exposdk:58.0.0',
        'revision 962762e3668b',
        'shell —',
      ].join('\n'),
    );
  });

  it('keeps every field when expo-updates has nothing to report', () => {
    const update = factsFromUpdates({ updateId: null, createdAt: null, channel: '  ', runtimeVersion: null }, null);
    expect(formatBuildStamp({ platform: 'native', update })).toBe(
      ['updateId —', 'createdAt —', 'channel —', 'runtimeVersion —', 'revision —', 'shell —'].join('\n'),
    );
  });

  it('keeps a shell failure beside the build', () => {
    const update = factsFromUpdates({ updateId: 'abc' }, '962762e3668b', 'The saved page didn’t start.');
    expect(formatBuildStamp({ platform: 'native', update })).toContain('shell The saved page didn’t start.');
    expect(normalizeBuild({ failure: 'The page stopped.' })?.failure).toBe('The page stopped.');
  });

  it('reads a shell payload and ignores an empty one', () => {
    expect(normalizeBuild({ updateId: 'abc', createdAt: '2026-10-27T00:00:00.000Z', channel: null, revision: 'abc123abc123' })?.updateId).toBe('abc');
    expect(normalizeBuild({ updateId: '', channel: null })).toBeNull();
    expect(normalizeBuild({ failure: '  ' })).toBeNull();
    expect(normalizeBuild(null)).toBeNull();
  });

  it('matches the embedded-web manifest', () => {
    const manifest = readFileSync(new URL('../../embedded-web/manifest.js', import.meta.url), 'utf8');
    const revision = manifest.match(/revision: "([0-9a-f]+)"/);
    expect(revision?.[1]).toBe(PACK_REVISION);
  });
});
