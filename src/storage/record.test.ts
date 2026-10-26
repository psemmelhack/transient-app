import { describe, expect, it } from 'vitest';
import { exampleMoment, EXAMPLE_INSTANT } from '../data/moment';
import type { SensorSample } from '../data/telemetry';
import { styleFromPreset, presetById } from '../style/presets';
import type { Scene } from '../composition/scene';
import { makeRecord, sharesForCapture } from './record';

const sensors: SensorSample = {
  acceleration: { x: 0.12, y: 9.81, z: -0.04 },
  rotationRate: null,
  orientation: null,
  heading: 274,
  battery: null,
};

const scene: Scene = { width: 1080, height: 1080, background: '#fff', nodes: [] };

describe('transient record', () => {
  it('keeps a recipient only when a name was given', () => {
    expect(sharesForCapture('   ')).toEqual([]);
    const named = sharesForCapture('  Ada  ', new Date('2026-10-25T01:00:00Z'));
    expect(named).toHaveLength(1);
    expect(named[0].recipient).toBe('Ada');
    expect(named[0].channel).toBe('share');
    expect(named[0].at).toBe('2026-10-25T01:00:00.000Z');
  });

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

  it('keeps a moving speed with the capture and leaves a slow one off the readout', () => {
    const style = styleFromPreset(presetById('07'));
    style.measurements = { ...style.measurements, telemetry: true };
    const moving = makeRecord({
      moment: { ...exampleMoment(EXAMPLE_INSTANT), speed: 4.4704, sensors },
      style,
      message: '',
      scene,
      png: new Blob(['png']),
      shares: [],
    });
    expect(moving.telemetry?.speed).toBe(4.4704);
    expect(moving.lines.map((line) => line.text)).toContain('SPD  10.0 mph');

    const still = makeRecord({
      moment: { ...exampleMoment(EXAMPLE_INSTANT), speed: 0.2, sensors },
      style,
      message: '',
      scene,
      png: new Blob(['png']),
      shares: [],
    });
    expect(still.telemetry?.speed).toBe(0.2);
    expect(still.lines.some((line) => line.id === 'spd')).toBe(false);

    const older = makeRecord({
      moment: { ...exampleMoment(EXAMPLE_INSTANT), sensors },
      style,
      message: '',
      scene,
      png: new Blob(['png']),
      shares: [],
    });
    expect(older.telemetry?.speed).toBeNull();
    expect(older.lines.some((line) => line.id === 'spd')).toBe(false);
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
