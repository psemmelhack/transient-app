import { describe, expect, it } from 'vitest';
import { exampleMoment, EXAMPLE_INSTANT } from '../data/moment';
import { withLayout, withMeasurement } from '../style/edit';
import { defaultStyle } from '../style/presets';
import { JAM_SEPARATOR, jamFields, planJam, planJamGrid, weaveFields } from './jam';

const moment = exampleMoment(EXAMPLE_INSTANT);

function dataOf(glyphs: string, fields: string[]): string {
  let rest = glyphs;
  for (const field of fields) {
    const at = rest.indexOf(field);
    expect(at).toBeGreaterThanOrEqual(0);
    expect([...rest.slice(0, at)].every((glyph) => glyph === JAM_SEPARATOR)).toBe(true);
    rest = rest.slice(at + field.length);
  }
  expect([...rest].every((glyph) => glyph === JAM_SEPARATOR)).toBe(true);
  return fields.join('');
}

describe('jam grid', () => {
  it('uses one even square when the length is a square', () => {
    const text = 'ABCDEFGHIJKLMNOP';
    const plan = planJam([text], 1080, 1080);
    expect(plan.columns).toBe(4);
    expect(plan.rows).toBe(4);
    expect(plan.glyphs).toBe(text);
    expect(plan.fontSize).toBe(1080 / 4);
  });

  it('prefers an even split whose cells are near square', () => {
    const grid = planJamGrid(48, 1080, 1080);
    expect(grid.extra).toBe(0);
    expect(grid.columns * grid.rows).toBe(48);
    expect(grid.columns).toBe(6);
    expect(grid.rows).toBe(8);
  });

  it('pads a few cells with separators instead of repeating the data', () => {
    const fields = ['ABCDE', 'FGHIJ', 'KLMNO'];
    const plan = planJam(fields, 1080, 1080);
    expect(plan.glyphs).not.toContain(fields.join('').repeat(2));
    expect(dataOf(plan.glyphs, fields)).toBe(fields.join(''));
    expect(plan.glyphs.length).toBe(plan.columns * plan.rows);
    expect(plan.rows).toBe(plan.glyphs.length / plan.columns);
    expect(plan.columns).toBeGreaterThan(1);
    expect(plan.rows).toBeGreaterThan(1);
    const ratio = 1080 / plan.columns / (1080 / plan.rows);
    expect(ratio).toBeGreaterThan(1 / 1.5);
    expect(ratio).toBeLessThan(1.5 + 1e-6);
  });

  it('grows the type when there is less data', () => {
    const short = planJam(['AB'], 1080, 1080);
    const long = planJam(['A'.repeat(400)], 1080, 1080);
    expect(short.fontSize).toBeGreaterThan(long.fontSize);
    expect(short.glyphs.replaceAll(JAM_SEPARATOR, '')).toBe('AB');
    expect(long.glyphs).toBe('A'.repeat(400));
    expect(short.glyphs.length).toBe(short.columns * short.rows);
    expect(long.glyphs.length).toBe(long.columns * long.rows);
  });

  it('spreads separators between fields', () => {
    expect(weaveFields(['AB', 'CD', 'EF'], 2)).toBe(`AB${JAM_SEPARATOR}CD${JAM_SEPARATOR}EF`);
    expect(weaveFields(['ABCDE'], 4)).toBe(`A${JAM_SEPARATOR}B${JAM_SEPARATOR}C${JAM_SEPARATOR}D${JAM_SEPARATOR}E`);
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
