import { describe, expect, it } from 'vitest';
import { joinedCapture, parseWebMessage, pushCaptureChunk, startCapture } from './protocol';

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
    expect(parseWebMessage({ source: 'transient-web', type: 'capture-begin', id: 'a', filename: 'a.png', count: 0 })).toBeNull();
    expect(parseWebMessage({ source: 'transient-web', type: 'capture-chunk', id: 'a', index: 1.5, data: 'aa' })).toBeNull();
  });

  it('reassembles a PNG that arrived in pieces', () => {
    expect(parseWebMessage({ source: 'transient-web', type: 'capture-begin', id: 'a', filename: 'shot.png', count: 2 })).toMatchObject({
      type: 'capture-begin',
      count: 2,
    });
    const started = startCapture('a', 'shot.png', 2);
    expect(started).not.toBeNull();
    if (!started) return;
    expect(joinedCapture(started)).toBeNull();
    const withFirst = pushCaptureChunk(started, 0, 'aaa');
    const done = pushCaptureChunk(withFirst, 1, 'bbb');
    expect(joinedCapture(done)).toBe('aaabbb');
    expect(joinedCapture(pushCaptureChunk(done, 9, 'nope'))).toBe('aaabbb');
    expect(startCapture('', 'shot.png', 1)).toBeNull();
  });
});
