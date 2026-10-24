import { describe, expect, it } from 'vitest';
import { exampleMoment, EXAMPLE_INSTANT } from './moment';
import { dataLinePlugins, measurementLines } from './plugins';

describe('measurement lines', () => {
  const moment = { ...exampleMoment(EXAMPLE_INSTANT), temperatureC: 19.4, accuracy: 12.2 };

  it('omits temperature and sun until they are turned on', () => {
    const lines = measurementLines({ accuracy: true, temperature: false, sun: false }, 'F', moment);
    expect(lines.map((line) => line.id)).toEqual(['accuracy']);
    expect(lines[0].text).toBe('±12 m');
  });

  it('formats fahrenheit, celsius, and both', () => {
    const plugin = dataLinePlugins.find((item) => item.id === 'temperature')!;
    const ctx = { moment, temperatureC: 19.4, temperatureUnit: 'F' as const };
    expect(plugin.produce({ ...ctx, temperatureUnit: 'F' })).toBe('67°F');
    expect(plugin.produce({ ...ctx, temperatureUnit: 'C' })).toBe('19°C');
    expect(plugin.produce({ ...ctx, temperatureUnit: 'both' })).toBe('67°F · 19°C');
    expect(plugin.produce({ ...ctx, temperatureC: null })).toBeNull();
  });

  it('writes sun azimuth and elevation', () => {
    const lines = measurementLines({ accuracy: false, temperature: false, sun: true }, 'F', moment);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toMatch(/^sun \d+° az · −?\d+° el$/);
  });

  it('fails closed when the temperature is missing', () => {
    const lines = measurementLines(
      { temperature: true, sun: false, accuracy: false },
      'F',
      exampleMoment(EXAMPLE_INSTANT),
    );
    expect(lines).toEqual([]);
  });
});
