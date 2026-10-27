import { describe, expect, it } from 'vitest';
import { noteTripleTap, tapWithinSlop } from './press';

describe('tapWithinSlop', () => {
  it('treats a steady finger as a tap', () => {
    expect(tapWithinSlop(0, 0)).toBe(true);
    expect(tapWithinSlop(8, -6)).toBe(true);
  });

  it('treats a drag as a scroll', () => {
    expect(tapWithinSlop(0, 40)).toBe(false);
    expect(tapWithinSlop(20, 20)).toBe(false);
  });
});

describe('noteTripleTap', () => {
  it('opens on the third tap', () => {
    let stamps: number[] = [];
    stamps = noteTripleTap(stamps, 1000).stamps;
    stamps = noteTripleTap(stamps, 1220).stamps;
    const third = noteTripleTap(stamps, 1440);
    expect(third.fired).toBe(true);
    expect(third.stamps).toEqual([]);
  });

  it('ignores the click that follows a touch', () => {
    const first = noteTripleTap([], 1000);
    const click = noteTripleTap(first.stamps, 1040);
    expect(click.fired).toBe(false);
    expect(click.stamps).toEqual(first.stamps);
  });

  it('forgets taps that are too far apart', () => {
    const first = noteTripleTap([], 1000);
    const second = noteTripleTap(first.stamps, 2000);
    expect(second.fired).toBe(false);
    expect(second.stamps).toEqual([2000]);
  });
});
