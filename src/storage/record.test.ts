import { describe, expect, it } from 'vitest';
import { exampleMoment, EXAMPLE_INSTANT } from '../data/moment';
import type { SensorSample } from '../data/telemetry';
import { styleFromPreset, presetById } from '../style/presets';
import type { Scene } from '../composition/scene';
import { makeRecord } from './record';

const sensors: SensorSample = {
  acceleration: { x: 0.12, y: 9.81, z: -0.04 },
  rotationRate: null,
  orientation: null,
  heading: 274,
  battery: null,
};

const scene: Scene = { width: 1080, height: 1080, background: '#fff', nodes: [] };

describe('transient record', () => {
  it('keeps the captured telemetry for the map', () => {
    const style = styleFromPreset(presetById('09'));
    style.measurements = { ...style.measurements, telemetry: true };
    const moment = { ...exampleMoment(EXAMPLE_INSTANT), accuracy: 12, sensors };
    const record = makeRecord({
      moment,
      style,
      message: 'Noted.',
      scene,
      png: new Blob(['png']),
      shares: [],
    });
    expect(record.telemetry).toMatchObject({
      heading: 274,
      horizontalAccuracy: 12,
      acceleration: sensors.acceleration,
      battery: null,
    });
    expect(record.lines.map((line) => line.text)).toContain('HDG  274° W');
    expect(record.lines.map((line) => line.text)).toContain('ACC  0.12  9.81  −0.04');
    expect(record.lines.some((line) => line.id === 'accuracy')).toBe(false);
    expect(record.lines.some((line) => line.text === '±12 m')).toBe(false);
  });

  it('leaves telemetry empty while the toggle is off', () => {
    const style = styleFromPreset(presetById('01'));
    const moment = { ...exampleMoment(EXAMPLE_INSTANT), accuracy: 12, sensors };
    const record = makeRecord({
      moment,
      style,
      message: '',
      scene,
      png: new Blob(['png']),
      shares: [],
    });
    expect(record.telemetry).toBeNull();
    expect(record.lines.map((line) => line.id)).toEqual(['accuracy']);
  });
});
