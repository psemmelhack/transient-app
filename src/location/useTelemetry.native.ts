import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Battery from 'expo-battery';
import * as Brightness from 'expo-brightness';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import { Accelerometer, Barometer, DeviceMotion, Gyroscope, LightSensor, Magnetometer, Pedometer } from 'expo-sensors';
import type { Moment } from '../data/moment';
import {
  blankSample,
  readBatteryLevel,
  type Axis3,
  type Orientation,
  type PhoneTelemetry,
  type SensorSample,
  type TelemetryLocationOverride,
} from '../data/telemetry';

const FLUSH_MS = 400;

export interface TelemetryLive {
  sensors: SensorSample | null;
  location: TelemetryLocationOverride | null;
  capture: () => { sensors: SensorSample | null; location: TelemetryLocationOverride | null };
}

export function notifyTelemetryPermission(): void {
  /* Native permissions are requested from the toggle gesture. */
}

export function applyTelemetry(
  moment: Moment,
  sensors: SensorSample | null,
  location: TelemetryLocationOverride | null,
): Moment {
  const next: Moment = { ...moment, sensors };
  if (!location) return next;
  if (location.accuracy !== undefined) next.accuracy = location.accuracy;
  if (location.altitudeAccuracy !== undefined) next.altitudeAccuracy = location.altitudeAccuracy;
  if (location.speed !== undefined) next.speed = location.speed;
  if (location.course !== undefined) next.course = location.course;
  return next;
}

export function useTelemetry(enabled: boolean): TelemetryLive {
  const latest = useRef<SensorSample>(blankSample());
  const [sensors, setSensors] = useState<SensorSample | null>(null);

  const capture = useCallback(() => {
    if (!enabled) return { sensors: null, location: null };
    return { sensors: hasReading(latest.current) ? cloneSample(latest.current) : null, location: null };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      latest.current = blankSample();
      setSensors(null);
      return;
    }

    let frame = blankSample();
    let stopped = false;
    latest.current = frame;
    const stops: Array<() => void> = [];

    const publish = () => {
      if (stopped) return;
      const next = hasReading(frame) ? quantize(frame) : null;
      latest.current = frame;
      setSensors((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };

    const listen = (start: () => { remove: () => void } | null) => {
      try {
        const sub = start();
        if (sub) stops.push(() => sub.remove());
      } catch {
        /* This sensor is missing on the device. */
      }
    };

    listen(() =>
      Accelerometer.addListener((reading) => {
        const axis = axisOf(reading.x, reading.y, reading.z);
        if (!axis) return;
        frame = { ...frame, acceleration: axis };
      }),
    );
    listen(() =>
      Gyroscope.addListener((reading) => {
        const rate = orientationOf(toDegrees(reading.x), toDegrees(reading.y), toDegrees(reading.z));
        if (!rate) return;
        frame = { ...frame, rotationRate: rate };
      }),
    );
    listen(() =>
      DeviceMotion.addListener((reading) => {
        const rotation = reading.rotation
          ? orientationOf(reading.rotation.alpha, reading.rotation.beta, reading.rotation.gamma)
          : null;
        if (rotation) frame = { ...frame, orientation: rotation };
        const gravity = gravityOf(reading);
        if (gravity) frame = { ...frame, phone: { ...phoneOf(frame), gravity } };
      }),
    );
    listen(() =>
      Barometer.addListener((reading) => {
        const phone = phoneOf(frame);
        if (Number.isFinite(reading.pressure)) phone.pressureHpa = reading.pressure;
        if (Platform.OS === 'ios' && typeof reading.relativeAltitude === 'number' && Number.isFinite(reading.relativeAltitude)) {
          phone.relativeAltitudeM = reading.relativeAltitude;
        }
        frame = { ...frame, phone };
      }),
    );
    listen(() =>
      Magnetometer.addListener((reading) => {
        const field = axisOf(reading.x, reading.y, reading.z);
        if (!field) return;
        frame = { ...frame, phone: { ...phoneOf(frame), magneticField: field } };
      }),
    );
    if (Platform.OS === 'android') {
      listen(() =>
        LightSensor.addListener((reading) => {
          if (!Number.isFinite(reading.illuminance)) return;
          frame = { ...frame, phone: { ...phoneOf(frame), illuminance: reading.illuminance } };
        }),
      );
    }

    void (async () => {
      const model = Device.modelName;
      if (model) frame = { ...frame, phone: { ...phoneOf(frame), deviceModel: model } };
      await Promise.all([
        watchHeading(),
        readBattery(),
        readBrightness(),
        readNetwork(),
        readSteps(),
      ]);
      publish();
    })();

    const id = setInterval(publish, FLUSH_MS);
    publish();
    return () => {
      stopped = true;
      clearInterval(id);
      for (const stop of stops) stop();
    };

    function watchHeading(): Promise<void> {
      return Location.watchHeadingAsync((reading) => {
        const truth = usableHeading(reading.trueHeading);
        const magnetic = usableHeading(reading.magHeading);
        const phone = phoneOf(frame);
        phone.trueHeading = truth;
        phone.magneticHeading = magnetic;
        frame = { ...frame, heading: truth ?? magnetic, phone };
      })
        .then((sub) => {
          if (stopped) sub.remove();
          else stops.push(() => sub.remove());
        })
        .catch(() => undefined);
    }

    function readBattery(): Promise<void> {
      return Battery.getBatteryLevelAsync()
        .then(async (level) => {
          const state = await Battery.getBatteryStateAsync().catch(() => null);
          frame = {
            ...frame,
            battery: readBatteryLevel(level),
            phone: { ...phoneOf(frame), batteryState: state == null ? phoneOf(frame).batteryState : batteryWord(state) },
          };
        })
        .catch(() => undefined);
    }

    function readBrightness(): Promise<void> {
      return Brightness.getBrightnessAsync()
        .then((value) => {
          if (typeof value !== 'number' || value < 0 || value > 1) return;
          frame = { ...frame, phone: { ...phoneOf(frame), brightness: value } };
        })
        .catch(() => undefined);
    }

    function readNetwork(): Promise<void> {
      return Network.getNetworkStateAsync()
        .then((state) => {
          if (!state.type) return;
          frame = { ...frame, phone: { ...phoneOf(frame), networkType: String(state.type) } };
        })
        .catch(() => undefined);
    }

    async function readSteps(): Promise<void> {
      try {
        const available = await Pedometer.isAvailableAsync();
        if (!available || typeof Pedometer.getStepCountAsync !== 'function') return;
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const result = await Pedometer.getStepCountAsync(start, new Date());
        if (!Number.isFinite(result.steps)) return;
        frame = { ...frame, phone: { ...phoneOf(frame), stepsToday: result.steps } };
      } catch {
        /* Android and a denied motion prompt omit the step count. */
      }
    }
  }, [enabled]);

  return { sensors: enabled ? sensors : null, location: null, capture };
}

function phoneOf(sample: SensorSample): PhoneTelemetry {
  return {
    pressureHpa: null,
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
    ...(sample.phone ?? {}),
  };
}

function gravityOf(reading: {
  acceleration: { x: number; y: number; z: number } | null;
  accelerationIncludingGravity: { x: number; y: number; z: number };
}): Axis3 | null {
  const withGravity = reading.accelerationIncludingGravity;
  const linear = reading.acceleration;
  if (!linear) return null;
  return axisOf(withGravity.x - linear.x, withGravity.y - linear.y, withGravity.z - linear.z);
}

function axisOf(x: number, y: number, z: number): Axis3 | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return { x, y, z };
}

function orientationOf(alpha: number, beta: number, gamma: number): Orientation | null {
  if (!Number.isFinite(alpha) || !Number.isFinite(beta) || !Number.isFinite(gamma)) return null;
  return { alpha, beta, gamma };
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function usableHeading(value: number): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function batteryWord(state: Battery.BatteryState): string | null {
  if (state === Battery.BatteryState.CHARGING) return 'charging';
  if (state === Battery.BatteryState.FULL) return 'full';
  if (state === Battery.BatteryState.UNPLUGGED) return 'unplugged';
  if (state === Battery.BatteryState.NOT_CHARGING) return 'not charging';
  return null;
}

function hasReading(sample: SensorSample): boolean {
  return Boolean(
    sample.acceleration ||
      sample.rotationRate ||
      sample.orientation ||
      sample.heading != null ||
      sample.battery != null ||
      sample.phone,
  );
}

function cloneSample(sample: SensorSample): SensorSample {
  return {
    acceleration: sample.acceleration ? { ...sample.acceleration } : null,
    rotationRate: sample.rotationRate ? { ...sample.rotationRate } : null,
    orientation: sample.orientation ? { ...sample.orientation } : null,
    heading: sample.heading,
    battery: sample.battery,
    phone: sample.phone ? { ...sample.phone, magneticField: sample.phone.magneticField ? { ...sample.phone.magneticField } : null, gravity: sample.phone.gravity ? { ...sample.phone.gravity } : null } : null,
  };
}

function quantize(sample: SensorSample): SensorSample {
  const phone = sample.phone;
  return {
    acceleration: sample.acceleration ? roundAxis(sample.acceleration, 2) : null,
    rotationRate: sample.rotationRate ? roundOrientation(sample.rotationRate, 1) : null,
    orientation: sample.orientation ? roundOrientation(sample.orientation, 0) : null,
    heading: sample.heading == null ? null : Math.round(sample.heading),
    battery: sample.battery == null ? null : Math.round(sample.battery * 100) / 100,
    phone: phone
      ? {
          ...phone,
          pressureHpa: phone.pressureHpa == null ? null : round(phone.pressureHpa, 1),
          relativeAltitudeM: phone.relativeAltitudeM == null ? null : round(phone.relativeAltitudeM, 1),
          magneticField: phone.magneticField ? roundAxis(phone.magneticField, 1) : null,
          trueHeading: phone.trueHeading == null ? null : Math.round(phone.trueHeading),
          magneticHeading: phone.magneticHeading == null ? null : Math.round(phone.magneticHeading),
          stepsToday: phone.stepsToday == null ? null : Math.round(phone.stepsToday),
          gravity: phone.gravity ? roundAxis(phone.gravity, 2) : null,
          brightness: phone.brightness == null ? null : Math.round(phone.brightness * 100) / 100,
          illuminance: phone.illuminance == null ? null : Math.round(phone.illuminance),
        }
      : null,
  };
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function roundAxis(axis: Axis3, digits: number): Axis3 {
  return { x: round(axis.x, digits), y: round(axis.y, digits), z: round(axis.z, digits) };
}

function roundOrientation(value: Orientation, digits: number): Orientation {
  return { alpha: round(value.alpha, digits), beta: round(value.beta, digits), gamma: round(value.gamma, digits) };
}
