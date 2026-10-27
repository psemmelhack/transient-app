import { describe, expect, it } from 'vitest';
import { buildScene } from '../composition/scene';
import { exampleMoment, EXAMPLE_INSTANT } from './moment';
import { extendedRows } from './extended';
import { dataTogglePlugins, defaultMeasurements, isExtendedEnabled } from './plugins';
import { presetById, styleFromPreset } from '../style/presets';
import { sanitizeStyle } from '../style/persist';
import type { PhoneTelemetry, SensorSample } from './telemetry';

const phone: PhoneTelemetry = {
  pressureHpa: 1013.25,
  relativeAltitudeM: 1.2,
  magneticField: { x: 12.4, y: -3, z: 40 },
  trueHeading: 91,
  magneticHeading: 88.4,
  stepsToday: 2400,
  gravity: { x: 0.1, y: 9.81, z: -0.2 },
  batteryState: 'charging',
  brightness: 0.5,
  networkType: 'wifi',
  deviceModel: 'iPhone',
  illuminance: 320,
};

const sensors: SensorSample = {
  acceleration: { x: 0.12, y: 9.81, z: -0.04 },
  rotationRate: null,
  orientation: null,
  heading: 274,
  battery: 0.814,
  phone,
};

describe('extended data', () => {
  it('is off by default and stays off until it is saved on', () => {
    expect(defaultMeasurements().extended).toBe(false);
    expect(isExtendedEnabled(defaultMeasurements())).toBe(false);
    expect(isExtendedEnabled({ extended: true })).toBe(true);
    const saved = sanitizeStyle({ ...styleFromPreset(presetById('02')), measurements: { extended: true } });
    expect(saved.measurements.extended).toBe(true);
    expect(sanitizeStyle(styleFromPreset(presetById('04'))).measurements.extended).toBe(false);
  });

  it('shows the switch only inside the native shell, after Telemetry', () => {
    expect(dataTogglePlugins(false).map((plugin) => plugin.title)).toEqual(['Temperature', 'Sun', 'Telemetry']);
    expect(dataTogglePlugins(true).map((plugin) => plugin.title)).toEqual(['Temperature', 'Sun', 'Telemetry', 'Extended data']);
  });

  it('lists only the readings the phone actually has, at a fixed width', () => {
    const rows = extendedRows(sensors);
    expect(rows.map((row) => row.label)).toEqual(['BARO', 'RALT', 'MAG', 'TRUE', 'MH', 'GRAV', 'LIGHT', 'BAT', 'BSTAT', 'BRIGHT', 'NET', 'STEPS', 'MODEL']);
    expect(rows.find((row) => row.id === 'baro')?.value).toBe(' 1013.3 hPa');
    expect(rows.find((row) => row.id === 'ralt')?.value).toBe('   1.2 m');
    expect(rows.find((row) => row.id === 'mag')?.value).toBe('  12.4  −  3.0    40.0 µT');
    expect(rows.find((row) => row.id === 'true')?.value).toBe(' 91° E ');
    expect(rows.find((row) => row.id === 'grav')?.value).toBe('  0.10    9.81  − 0.20 m/s²');
    expect(rows.find((row) => row.id === 'bat')?.value).toBe(' 81%');
    expect(rows.find((row) => row.id === 'bright')?.value).toBe(' 50%');
    expect(rows.find((row) => row.id === 'light')?.value).toBe('   320 lx');
    expect(rows.find((row) => row.id === 'steps')?.value).toBe('  2400');

    const later = extendedRows({
      ...sensors,
      battery: 1,
      phone: { ...phone, pressureHpa: 999.94, relativeAltitudeM: -12.46, illuminance: 8, stepsToday: 9 },
    });
    for (const id of ['baro', 'ralt', 'light', 'steps', 'bat']) {
      expect(later.find((row) => row.id === id)?.value.length).toBe(rows.find((row) => row.id === id)?.value.length);
    }
  });

  it('drops a platform that has no reading instead of leaving a blank row', () => {
    expect(extendedRows(null)).toEqual([]);
    const partial = extendedRows({
      ...sensors,
      battery: null,
      phone: { ...phone, pressureHpa: null, relativeAltitudeM: null, illuminance: null, deviceModel: null },
    }).map((row) => row.id);
    expect(partial).not.toContain('baro');
    expect(partial).not.toContain('ralt');
    expect(partial).not.toContain('light');
    expect(partial).not.toContain('model');
    expect(partial).not.toContain('bat');
    expect(partial).toContain('mag');
    expect(extendedRows({ ...sensors, battery: 0.5, phone: null }).map((row) => row.id)).toEqual(['bat']);
  });

  it('stays off the poster for the longest styles', () => {
    const moment = { ...exampleMoment(EXAMPLE_INSTANT), sensors };
    for (const id of ['02', '04']) {
      const style = styleFromPreset(presetById(id));
      style.measurements = { ...style.measurements, extended: true, telemetry: false };
      const scene = buildScene(style, moment, styleFromPreset(presetById(id)).presetId === '02' ? 'The light on the water, right now.' : 'We were here.');
      const text = JSON.stringify(scene.nodes);
      expect(text).not.toContain('hPa');
      expect(text).not.toContain('µT');
      expect(text).not.toContain('m/s²');
      expect(scene.width).toBe(1080);
      expect(scene.height).toBe(1080);
    }
  });
});
