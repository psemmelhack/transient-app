import { useCallback, useEffect, useRef, useState } from 'react';
import type { Moment } from '../data/moment';
import {
  blankSample,
  readBatteryLevel,
  readMotion,
  readOrientation,
  type SensorSample,
  type TelemetryLocationOverride,
} from '../data/telemetry';

const FLUSH_MS = 250;

export interface TelemetryLive {
  sensors: SensorSample | null;
  location: TelemetryLocationOverride | null;
  capture: () => { sensors: SensorSample | null; location: TelemetryLocationOverride | null };
}

interface TelemetryInjection {
  sensors: SensorSample;
  accuracy?: number | null;
  altitudeAccuracy?: number | null;
  speed?: number | null;
  course?: number | null;
}

const permissionListeners = new Set<() => void>();

/** Re-bind motion listeners after the iOS permission gesture resolves. */
export function notifyTelemetryPermission(): void {
  for (const listener of permissionListeners) listener();
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
  const [location, setLocation] = useState<TelemetryLocationOverride | null>(null);
  const [pass, setPass] = useState(0);

  useEffect(() => onTelemetryPermission(() => setPass((value) => value + 1)), []);

  const capture = useCallback(() => {
    if (!enabled) return { sensors: null, location: null };
    const injected = readInjection();
    if (injected) return { sensors: cloneSample(injected.sensors), location: locationOf(injected) };
    return { sensors: hasReading(latest.current) ? cloneSample(latest.current) : null, location: null };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      latest.current = blankSample();
      setSensors(null);
      setLocation(null);
      return;
    }

    let frame = blankSample();
    let stopped = false;
    latest.current = frame;

    const publish = () => {
      const injected = readInjection();
      if (injected) {
        frame = cloneSample(injected.sensors);
        latest.current = frame;
      }
      const nextSensors = hasReading(latest.current) ? quantize(latest.current) : null;
      const nextLocation = injected ? locationOf(injected) : null;
      setSensors((prev) => (same(prev, nextSensors) ? prev : nextSensors));
      setLocation((prev) => (same(prev, nextLocation) ? prev : nextLocation));
    };

    const onMotion = (event: DeviceMotionEvent) => {
      const read = readMotion(event);
      if (read.acceleration) frame = { ...frame, acceleration: read.acceleration };
      if (read.rotationRate) frame = { ...frame, rotationRate: read.rotationRate };
      latest.current = frame;
    };
    const onOrientation = (event: DeviceOrientationEvent) => {
      const read = readOrientation({
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
        absolute: event.absolute,
        webkitCompassHeading: (event as DeviceOrientationEvent & { webkitCompassHeading?: number | null }).webkitCompassHeading,
      });
      if (read.orientation) frame = { ...frame, orientation: read.orientation };
      if (read.heading != null) frame = { ...frame, heading: read.heading };
      latest.current = frame;
    };

    window.addEventListener('devicemotion', onMotion);
    window.addEventListener('deviceorientation', onOrientation);

    let battery: { level: number; removeEventListener: (type: string, listener: () => void) => void } | null = null;
    const onLevel = () => {
      const level = readBatteryLevel(battery?.level);
      if (level == null) return;
      frame = { ...frame, battery: level };
      latest.current = frame;
    };
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; addEventListener: (type: string, listener: () => void) => void; removeEventListener: (type: string, listener: () => void) => void }> };
    if (typeof nav.getBattery === 'function') {
      nav.getBattery().then((manager) => {
        if (stopped) return;
        battery = manager;
        onLevel();
        manager.addEventListener('levelchange', onLevel);
      }).catch(() => undefined);
    }

    publish();
    const id = window.setInterval(publish, FLUSH_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
      window.removeEventListener('devicemotion', onMotion);
      window.removeEventListener('deviceorientation', onOrientation);
      battery?.removeEventListener('levelchange', onLevel);
    };
  }, [enabled, pass]);

  return { sensors: enabled ? sensors : null, location: enabled ? location : null, capture };
}

function onTelemetryPermission(listener: () => void): () => void {
  permissionListeners.add(listener);
  return () => permissionListeners.delete(listener);
}

function readInjection(): TelemetryInjection | null {
  const value = (window as Window & { __transientTelemetry?: TelemetryInjection }).__transientTelemetry;
  if (!value || typeof value !== 'object' || !value.sensors) return null;
  return value;
}

function locationOf(injected: TelemetryInjection): TelemetryLocationOverride | null {
  const location: TelemetryLocationOverride = {};
  if (injected.accuracy !== undefined) location.accuracy = injected.accuracy;
  if (injected.altitudeAccuracy !== undefined) location.altitudeAccuracy = injected.altitudeAccuracy;
  if (injected.speed !== undefined) location.speed = injected.speed;
  if (injected.course !== undefined) location.course = injected.course;
  return Object.keys(location).length ? location : null;
}

function hasReading(sample: SensorSample): boolean {
  return Boolean(sample.acceleration || sample.rotationRate || sample.orientation || sample.heading != null || sample.battery != null);
}

function cloneSample(sample: SensorSample): SensorSample {
  return {
    acceleration: sample.acceleration ? { ...sample.acceleration } : null,
    rotationRate: sample.rotationRate ? { ...sample.rotationRate } : null,
    orientation: sample.orientation ? { ...sample.orientation } : null,
    heading: sample.heading,
    battery: sample.battery,
  };
}

function quantize(sample: SensorSample): SensorSample {
  return {
    acceleration: sample.acceleration
      ? { x: round(sample.acceleration.x, 2), y: round(sample.acceleration.y, 2), z: round(sample.acceleration.z, 2) }
      : null,
    rotationRate: sample.rotationRate
      ? {
          alpha: round(sample.rotationRate.alpha, 1),
          beta: round(sample.rotationRate.beta, 1),
          gamma: round(sample.rotationRate.gamma, 1),
        }
      : null,
    orientation: sample.orientation
      ? {
          alpha: Math.round(sample.orientation.alpha),
          beta: Math.round(sample.orientation.beta),
          gamma: Math.round(sample.orientation.gamma),
        }
      : null,
    heading: sample.heading == null ? null : Math.round(sample.heading),
    battery: sample.battery == null ? null : Math.round(sample.battery * 100) / 100,
  };
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
