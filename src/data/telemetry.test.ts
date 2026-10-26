import { afterEach, describe, expect, it, vi } from 'vitest';
import { exampleMoment, EXAMPLE_INSTANT } from './moment';
import { defaultMeasurements } from './plugins';
import {
  cardinal,
  formatHeading,
  headingFromOrientation,
  phoneLines,
  posterTelemetryLines,
  readBatteryLevel,
  readMotion,
  readOrientation,
  requestMotionAccess,
  telemetryLines,
  telemetryLineText,
  telemetrySnapshot,
  type PhoneTelemetry,
  type SensorSample,
} from './telemetry';

const sensors: SensorSample = {
  acceleration: { x: 0.12, y: 9.81, z: -0.04 },
  rotationRate: { alpha: 0.4, beta: -1.2, gamma: 0 },
  orientation: { alpha: 86, beta: 12, gamma: -3 },
  heading: 274,
  battery: 0.814,
};

describe('telemetry lines', () => {
  const moment = {
    ...exampleMoment(EXAMPLE_INSTANT),
    accuracy: 12.2,
    altitudeAccuracy: 3.6,
    speed: 1.36,
    course: 182,
    sensors,
  };

  it('stays off until the toggle is saved on', () => {
    expect(defaultMeasurements().telemetry).toBe(false);
  });

  it('formats the readings that are actually present', () => {
    const lines = telemetryLines(moment);
    expect(lines.map((line) => line.label)).toEqual(['ACC', 'GYRO', 'ORIENT', 'HDG', '±ACC', '±ALT', 'SPD', 'CRS', 'BAT']);
    expect(telemetryLineText(lines[0]!)).toBe('ACC  0.12  9.81  −0.04');
    expect(lines.find((line) => line.id === 'gyro')?.values).toEqual(['0.4', '−1.2', '0.0']);
    expect(lines.find((line) => line.id === 'orient')?.values).toEqual(['86°', '12°', '−3°']);
    expect(lines.find((line) => line.id === 'hdg')?.values).toEqual(['274° W']);
    expect(lines.find((line) => line.id === 'h-acc')?.values).toEqual(['±12 m']);
    expect(lines.find((line) => line.id === 'v-acc')?.values).toEqual(['±4 m']);
    expect(lines.find((line) => line.id === 'spd')?.values).toEqual(['1.4 m/s']);
    expect(lines.find((line) => line.id === 'crs')?.values).toEqual(['182° S']);
    expect(lines.find((line) => line.id === 'bat')?.values).toEqual(['81%']);
  });

  it('keeps a real zero and drops a vector with a missing axis', () => {
    const lines = telemetryLines({
      ...exampleMoment(EXAMPLE_INSTANT),
      sensors: {
        acceleration: { x: 0, y: 0, z: 0 },
        rotationRate: null,
        orientation: null,
        heading: null,
        battery: 0,
      },
    });
    expect(lines.map((line) => telemetryLineText(line))).toEqual(['ACC  0.00  0.00  0.00', 'BAT  0%']);
    expect(readMotion({ accelerationIncludingGravity: { x: 1, y: null, z: 0 }, rotationRate: null }).acceleration).toBeNull();
  });

  it('omits readings the browser did not provide', () => {
    expect(telemetryLines(exampleMoment(EXAMPLE_INSTANT))).toEqual([]);
    expect(readBatteryLevel(undefined)).toBeNull();
    expect(readBatteryLevel(1.2)).toBeNull();
  });

  it('adds phone readings only when the device reported them', () => {
    const phone: PhoneTelemetry = {
      pressureHpa: 1013.25,
      relativeAltitudeM: 1.2,
      magneticField: { x: 12.4, y: -3, z: 40 },
      trueHeading: 91,
      magneticHeading: 88,
      stepsToday: 2400,
      gravity: { x: 0.1, y: 9.8, z: 0.2 },
      batteryState: 'unplugged',
      brightness: 0.5,
      networkType: 'wifi',
      deviceModel: 'iPhone',
      illuminance: 320,
    };
    const withPhone = telemetryLines({ ...moment, sensors: { ...sensors, phone } });
    expect(withPhone.map((line) => line.label)).toEqual([
      'ACC',
      'GYRO',
      'ORIENT',
      'HDG',
      '±ACC',
      '±ALT',
      'SPD',
      'CRS',
      'BAT',
      'BARO',
      'RALT',
      'MAG',
      'TRUE',
      'MH',
      'STEPS',
      'GRAV',
      'BSTAT',
      'BRIGHT',
      'NET',
      'MODEL',
      'LIGHT',
    ]);
    expect(telemetryLineText(withPhone.find((line) => line.id === 'baro')!)).toBe('BARO  1013.3 hPa');
    expect(phoneLines({ ...phone, pressureHpa: null, relativeAltitudeM: null, magneticField: null, trueHeading: null, magneticHeading: null, stepsToday: null, gravity: null, batteryState: null, brightness: null, networkType: null, deviceModel: null, illuminance: null })).toEqual([]);
    expect(telemetryLines(moment).map((line) => line.label)).toEqual(['ACC', 'GYRO', 'ORIENT', 'HDG', '±ACC', '±ALT', 'SPD', 'CRS', 'BAT']);
    expect(telemetrySnapshot(true, { ...moment, sensors: { ...sensors, phone } })?.phone?.deviceModel).toBe('iPhone');
    expect(telemetrySnapshot(true, moment)?.phone).toBeUndefined();
    const poster = posterTelemetryLines({ ...moment, sensors: { ...sensors, phone } });
    expect(poster.length).toBeLessThanOrEqual(8);
    expect(poster.map((line) => line.label)).toEqual(['BARO', 'HDG', 'SPD', 'STEPS', '±ALT', 'BAT', 'TRUE', 'CRS']);
    expect(posterTelemetryLines(moment).map((line) => line.label)).toEqual(['ACC', 'GYRO', 'ORIENT', 'HDG', '±ACC', '±ALT', 'SPD', 'CRS', 'BAT']);
  });

  it('stores a snapshot only while telemetry is on', () => {
    expect(telemetrySnapshot(false, moment)).toBeNull();
    expect(telemetrySnapshot(true, moment)).toMatchObject({
      heading: 274,
      horizontalAccuracy: 12.2,
      altitudeAccuracy: 3.6,
      speed: 1.36,
      course: 182,
      battery: 0.814,
    });
  });
});

describe('compass', () => {
  it('names the eight cardinals', () => {
    expect(cardinal(0)).toBe('N');
    expect(cardinal(274)).toBe('W');
    expect(cardinal(359.6)).toBe('N');
    expect(formatHeading(274)).toBe('274° W');
    expect(formatHeading(359.6)).toBe('0° N');
  });

  it('prefers webkitCompassHeading and otherwise uses absolute alpha', () => {
    expect(headingFromOrientation({ alpha: 10, absolute: true, webkitCompassHeading: 274 })).toBe(274);
    expect(headingFromOrientation({ alpha: 86, absolute: true })).toBe(274);
    expect(headingFromOrientation({ alpha: 86, absolute: false })).toBeNull();
    const read = readOrientation({ alpha: 86, beta: 2, gamma: null, absolute: true, webkitCompassHeading: 274 });
    expect(read.orientation).toBeNull();
    expect(read.heading).toBe(274);
  });
});

describe('motion permission', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts both iOS prompts inside the gesture', async () => {
    const motion = vi.fn().mockResolvedValue('granted');
    const orientation = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('DeviceMotionEvent', { requestPermission: motion });
    vi.stubGlobal('DeviceOrientationEvent', { requestPermission: orientation });
    await expect(requestMotionAccess()).resolves.toBe('granted');
    expect(motion).toHaveBeenCalledOnce();
    expect(orientation).toHaveBeenCalledOnce();
  });

  it('reports denial without throwing', async () => {
    vi.stubGlobal('DeviceMotionEvent', { requestPermission: () => Promise.resolve('denied') });
    vi.stubGlobal('DeviceOrientationEvent', { requestPermission: () => Promise.reject(new Error('no')) });
    await expect(requestMotionAccess()).resolves.toBe('denied');
  });

  it('stays promptless where the browser has no permission API', async () => {
    vi.stubGlobal('DeviceMotionEvent', function DeviceMotionEvent() {});
    vi.stubGlobal('DeviceOrientationEvent', function DeviceOrientationEvent() {});
    await expect(requestMotionAccess()).resolves.toBe('promptless');
  });
});
