import { describe, expect, it } from 'vitest';
import { parseWebMessage } from './protocol';

describe('native shell messages', () => {
  it('reads the messages the page posts', () => {
    expect(parseWebMessage(JSON.stringify({ source: 'transient-web', type: 'ready' }))).toEqual({
      source: 'transient-web',
      type: 'ready',
    });
    expect(parseWebMessage({ source: 'transient-web', type: 'telemetry', enabled: true })).toEqual({
      source: 'transient-web',
      type: 'telemetry',
      enabled: true,
    });
    expect(
      parseWebMessage({
        source: 'transient-web',
        type: 'capture',
        id: 'a',
        filename: 'transient.png',
        pngBase64: 'aaa',
      }),
    ).toMatchObject({ type: 'capture', id: 'a' });
  });

  it('ignores anything that is not the page', () => {
    expect(parseWebMessage('nope')).toBeNull();
    expect(parseWebMessage({ source: 'other', type: 'ready' })).toBeNull();
    expect(parseWebMessage({ source: 'transient-web', type: 'capture', id: 1 })).toBeNull();
  });
});
