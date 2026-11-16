import { describe, expect, it } from 'vitest';
import { exampleMoment, EXAMPLE_INSTANT } from '../data/moment';
import { withLayout, withMeasurement } from '../style/edit';
import { defaultStyle } from '../style/presets';
import { capBand, capShift, crushText, jamFields, layoutCrush, layoutJam, wrapJam } from './jam';

const moment = exampleMoment(EXAMPLE_INSTANT);

function joined(advances: number[], layout: ReturnType<typeof layoutJam>): string {
  return layout.lines.map((line) => `${line.start}:${line.end}`).join('|');
}

describe('jam wrap', () => {
  it('breaks at any character once the next glyph does not fit', () => {
    const lines = wrapJam([1, 1, 1, 1], 4, 10);
    expect(lines.map((line) => [line.start, line.end])).toEqual([
      [0, 2],
      [2, 4],
    ]);
    const narrow = wrapJam([0.2, 0.2, 0.2, 0.2, 3], 4, 10);
    expect(narrow[0]?.end).toBe(4);
    expect(narrow[1]).toEqual({ start: 4, end: 5, width: 12 });
  });

  it('justifies every line to the width and keeps each row near full', () => {
    const advances = [1, 1, 1, 1, 1];
    const layout = layoutJam(advances, 10, 100);
    expect(layout.fontSize).toBeCloseTo(10, 1);
    expect(layout.lineHeight * layout.lines.length).toBeLessThanOrEqual(100 + 0.5);
    expect(layout.lines).toHaveLength(5);
    for (const line of layout.lines) {
      const used = advances.slice(line.start, line.end).reduce((sum, advance) => sum + advance, 0) * layout.fontSize;
      expect(used).toBeGreaterThanOrEqual(10 * 0.8 - 0.2);
      expect(used).toBeLessThanOrEqual(10 + 0.05);
      if (line.end - line.start > 1) {
        expect(used + line.gap * (line.end - line.start - 1)).toBeCloseTo(10, 3);
      }
    }
    expect(joined(advances, layout)).toBe('0:1|1:2|2:3|3:4|4:5');
  });

  it('prefers a dense break over a short row with a wide gap', () => {
    const advances = Array.from({ length: 23 }, () => 1);
    const layout = layoutJam(advances, 100, 400);
    const counts = layout.lines.map((line) => line.end - line.start);
    const average = 23 / counts.length;
    expect(layout.lineHeight * layout.lines.length).toBeLessThanOrEqual(400 + 0.5);
    for (const [index, count] of counts.entries()) {
      expect(count).toBeGreaterThanOrEqual(Math.round(average * 0.7));
      const used = count * layout.fontSize;
      expect(used).toBeGreaterThanOrEqual(80 - 0.2);
      expect(used).toBeLessThanOrEqual(100 + 0.2);
      const line = layout.lines[index];
      if (!line || count < 2) continue;
      expect(used + line.gap * (count - 1)).toBeCloseTo(100, 2);
    }
    expect(Math.min(...counts)).toBeGreaterThan(23 / counts.length * 0.5);
  });

  it('grows the type when there is less data', () => {
    const short = layoutJam([0.6, 0.6], 1080, 1080);
    const long = layoutJam(Array.from({ length: 180 }, () => 0.6), 1080, 1080);
    expect(short.fontSize).toBeGreaterThan(long.fontSize);
    expect(short.lines).toHaveLength(1);
    expect(long.lines.length).toBeGreaterThan(1);
    expect(long.lineHeight * long.lines.length).toBeLessThanOrEqual(1080 + 0.5);
    expect(short.lineHeight * short.lines.length).toBeLessThanOrEqual(1080 + 0.5);
    const covered = long.lines[long.lines.length - 1]?.end;
    expect(covered).toBe(180);
  });

  it('keeps proportional glyphs at one size and does not repeat them', () => {
    const advances = [0.3, 0.3, 0.3, 0.3, 1.4, 1.4, 0.25, 0.25, 0.25, 0.25];
    const layout = layoutJam(advances, 200, 200);
    expect(layout.fontSize).toBeGreaterThan(0);
    let cursor = 0;
    for (const line of layout.lines) {
      expect(line.start).toBe(cursor);
      expect(line.end).toBeGreaterThan(line.start);
      const used = advances.slice(line.start, line.end).reduce((sum, advance) => sum + advance * layout.fontSize, 0);
      expect(used).toBeLessThanOrEqual(200 + 0.05);
      if (line.end - line.start > 1) {
        expect(used + line.gap * (line.end - line.start - 1)).toBeCloseTo(200, 2);
      }
      cursor = line.end;
    }
    expect(cursor).toBe(advances.length);
  });
});

describe('crush packing', () => {
  it('makes the cap height the row and tiles the square', () => {
    const layout = layoutCrush([0.5, 0.5, 0.5, 0.5], 100, 100, 0.5);
    expect(layout.lines).toHaveLength(2);
    expect(layout.fontSize * 0.5).toBeCloseTo(layout.lineHeight, 4);
    expect(layout.lineHeight * layout.lines.length).toBeCloseTo(100, 2);
    expect(layout.lines.map((line) => [line.start, line.end])).toEqual([
      [0, 2],
      [2, 4],
    ]);
    for (const line of layout.lines) {
      const used = 0.5 * (line.end - line.start) * layout.fontSize;
      expect(used + line.gap * (line.end - line.start - 1)).toBeCloseTo(100, 3);
    }
  });

  it('grows by using fewer rows when there is less data', () => {
    const short = layoutCrush([0.4, 0.4], 200, 200, 0.8);
    const long = layoutCrush(Array.from({ length: 40 }, () => 0.4), 200, 200, 0.8);
    expect(short.fontSize).toBeGreaterThan(long.fontSize);
    expect(short.lineHeight * short.lines.length).toBeLessThanOrEqual(200 + 0.5);
    expect(long.lineHeight * long.lines.length).toBeLessThanOrEqual(200 + 0.5);
    expect(short.lineHeight).toBeCloseTo(short.fontSize * 0.8, 3);
    expect(long.lineHeight).toBeCloseTo(long.fontSize * 0.8, 3);
    expect(long.lines[long.lines.length - 1]?.end).toBe(40);
  });

  it('uppercases the same fields once', () => {
    const style = withLayout(defaultStyle(), 'crush');
    const text = crushText(style, moment, 'Here now');
    expect(text).toBe(jamFields(style, moment, 'Here now').join('').toLocaleUpperCase('en-US'));
    expect(text).toContain('HERE NOW'.replace(/\s/g, ''));
    expect(text).toContain('REDONDOBEACH,CALIFORNIA');
    expect(text.split('HERE').length - 1).toBe(1);
  });

  it('tucks a comma into the cap band and leaves an H on the cap', () => {
    const band = capBand({ fontSize: 200, capAscent: 172, capDescent: 0, fontAscent: 235, fontDescent: 66 });
    expect(band.ratio).toBeCloseTo(172 / 200, 5);
    const letter = capShift(band, { ascent: 172 / 200, descent: 0 }, 200);
    const comma = capShift(band, { ascent: 30 / 200, descent: 23 / 200 }, 200);
    const pipe = capShift(band, { ascent: 191 / 200, descent: 8 / 200 }, 200);
    expect(comma).toBeLessThan(letter);
    expect(letter + band.top * 200).toBeCloseTo(0, 4);
    const commaBottom = 172 + 23 + (comma - letter);
    expect(commaBottom).toBeCloseTo(172, 3);
    expect(pipe).not.toBe(letter);
  });
});

describe('jam fields', () => {
  it('jams the note, place, date, time, coordinates, and altitude without spaces', () => {
    const fields = jamFields(withLayout(defaultStyle(), 'jam'), moment, 'Here now');
    expect(fields[0]).toBe('Here now'.replace(/\s/g, ''));
    expect(fields).toContain('RedondoBeach,California');
    expect(fields).toContain('October22,2026');
    expect(fields).toContain('6:12PM');
    expect(fields).toContain('33.834452');
    expect(fields).toContain('-118.383318');
    expect(fields).toContain('alt18m');
    expect(fields.join('')).not.toContain(' ');
  });

  it('includes speed only above 1 mph and does not repeat it when telemetry is on', () => {
    const style = withMeasurement(withLayout(defaultStyle(), 'jam'), 'telemetry', true);
    const moving = jamFields(style, { ...moment, speed: 4.4704 }, 'Here');
    expect(moving.filter((field) => field === '10.0mph')).toEqual(['10.0mph']);
    const still = jamFields(style, { ...moment, speed: 0.2 }, 'Here');
    expect(still.some((field) => field.includes('mph'))).toBe(false);
  });

  it('adds extended values without their labels', () => {
    const style = withMeasurement(withLayout(defaultStyle(), 'jam'), 'extended', true);
    const fields = jamFields(
      style,
      {
        ...moment,
        sensors: {
          acceleration: null,
          rotationRate: null,
          orientation: null,
          heading: null,
          battery: null,
          phone: {
            pressureHpa: 1009.4,
            relativeAltitudeM: null,
            magneticField: null,
            trueHeading: null,
            magneticHeading: null,
            stepsToday: null,
            gravity: null,
            batteryState: null,
            brightness: null,
            networkType: null,
            deviceModel: null,
            illuminance: null,
          },
        },
      },
      '',
    );
    expect(fields).toContain('1009.4hPa');
    expect(fields.join('')).not.toContain('BARO');
  });
});
