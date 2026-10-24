/** Phone sensors and GPS extras, frozen with the transient. Missing readings stay null. */

export interface Axis3 {
  x: number;
  y: number;
  z: number;
}

export interface Orientation {
  alpha: number;
  beta: number;
  gamma: number;
}

export interface SensorSample {
  /** Acceleration including gravity, m/s². */
  acceleration: Axis3 | null;
  /** Rotation rate, °/s, alpha / beta / gamma. */
  rotationRate: Orientation | null;
  /** Device orientation, degrees. */
  orientation: Orientation | null;
  /** Compass heading, degrees clockwise from north. */
  heading: number | null;
  /** Battery level, 0–1, where the Battery API exists. */
  battery: number | null;
}

export interface TelemetryLine {
  id: string;
  label: string;
  values: string[];
}

export interface TelemetrySnapshot {
  acceleration: Axis3 | null;
  rotationRate: Orientation | null;
  orientation: Orientation | null;
  heading: number | null;
  horizontalAccuracy: number | null;
  altitudeAccuracy: number | null;
  speed: number | null;
  course: number | null;
  battery: number | null;
}

export interface TelemetrySource {
  accuracy: number | null;
  altitudeAccuracy: number | null;
  speed: number | null;
  course: number | null;
  sensors: SensorSample | null;
}

export interface TelemetryLocationOverride {
  accuracy?: number | null;
  altitudeAccuracy?: number | null;
  speed?: number | null;
  course?: number | null;
}

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
const MINUS = '\u2212';

export function blankSample(): SensorSample {
  return { acceleration: null, rotationRate: null, orientation: null, heading: null, battery: null };
}

export function wrapDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function cardinal(heading: number): string {
  const index = Math.round(wrapDegrees(heading) / 45) % 8;
  return CARDINALS[index] ?? 'N';
}

export function formatHeading(value: number): string {
  const wrapped = wrapDegrees(value);
  const rounded = Math.round(wrapped) % 360;
  return `${rounded}° ${cardinal(wrapped)}`;
}

export function headingFromOrientation(input: {
  alpha: number | null;
  absolute: boolean;
  webkitCompassHeading?: number | null;
}): number | null {
  const webkit = input.webkitCompassHeading;
  if (typeof webkit === 'number' && Number.isFinite(webkit)) return wrapDegrees(webkit);
  if (input.absolute && typeof input.alpha === 'number' && Number.isFinite(input.alpha)) {
    return wrapDegrees(360 - input.alpha);
  }
  return null;
}

export function readMotion(event: {
  accelerationIncludingGravity: { x: number | null; y: number | null; z: number | null } | null;
  rotationRate: { alpha: number | null; beta: number | null; gamma: number | null } | null;
}): { acceleration: Axis3 | null; rotationRate: Orientation | null } {
  const gravity = event.accelerationIncludingGravity;
  const rate = event.rotationRate;
  return {
    acceleration: gravity ? finiteAxis(gravity.x, gravity.y, gravity.z) : null,
    rotationRate: rate ? finiteOrientation(rate.alpha, rate.beta, rate.gamma) : null,
  };
}

export function readOrientation(event: {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  absolute: boolean;
  webkitCompassHeading?: number | null;
}): { orientation: Orientation | null; heading: number | null } {
  return {
    orientation: finiteOrientation(event.alpha, event.beta, event.gamma),
    heading: headingFromOrientation(event),
  };
}

export function readBatteryLevel(level: number | null | undefined): number | null {
  if (typeof level !== 'number' || !Number.isFinite(level)) return null;
  if (level < 0 || level > 1) return null;
  return level;
}

export function telemetryLines(source: TelemetrySource): TelemetryLine[] {
  const lines: TelemetryLine[] = [];
  const sensors = source.sensors;
  const acceleration = sensors?.acceleration ?? null;
  if (acceleration) {
    lines.push({
      id: 'acc',
      label: 'ACC',
      values: [signed(acceleration.x, 2), signed(acceleration.y, 2), signed(acceleration.z, 2)],
    });
  }
  const rotation = sensors?.rotationRate ?? null;
  if (rotation) {
    lines.push({
      id: 'gyro',
      label: 'GYRO',
      values: [signed(rotation.alpha, 1), signed(rotation.beta, 1), signed(rotation.gamma, 1)],
    });
  }
  const orientation = sensors?.orientation ?? null;
  if (orientation) {
    lines.push({
      id: 'orient',
      label: 'ORIENT',
      values: [formatDegrees(orientation.alpha), formatDegrees(orientation.beta), formatDegrees(orientation.gamma)],
    });
  }
  const heading = finite(sensors?.heading);
  if (heading != null) lines.push({ id: 'hdg', label: 'HDG', values: [formatHeading(heading)] });
  const accuracy = finite(source.accuracy);
  if (accuracy != null) lines.push({ id: 'h-acc', label: '±ACC', values: [formatMeters(accuracy)] });
  const altitudeAccuracy = finite(source.altitudeAccuracy);
  if (altitudeAccuracy != null) lines.push({ id: 'v-acc', label: '±ALT', values: [formatMeters(altitudeAccuracy)] });
  const speed = finite(source.speed);
  if (speed != null) lines.push({ id: 'spd', label: 'SPD', values: [formatSpeed(speed)] });
  const course = finite(source.course);
  if (course != null) lines.push({ id: 'crs', label: 'CRS', values: [formatHeading(course)] });
  const battery = readBatteryLevel(sensors?.battery);
  if (battery != null) lines.push({ id: 'bat', label: 'BAT', values: [formatBattery(battery)] });
  return lines;
}

export function telemetryLineText(line: TelemetryLine): string {
  return `${line.label}  ${line.values.join('  ')}`;
}

export function telemetrySnapshot(enabled: boolean, source: TelemetrySource): TelemetrySnapshot | null {
  if (!enabled) return null;
  const sensors = source.sensors;
  return {
    acceleration: sensors?.acceleration ?? null,
    rotationRate: sensors?.rotationRate ?? null,
    orientation: sensors?.orientation ?? null,
    heading: finite(sensors?.heading),
    horizontalAccuracy: finite(source.accuracy),
    altitudeAccuracy: finite(source.altitudeAccuracy),
    speed: finite(source.speed),
    course: finite(source.course),
    battery: readBatteryLevel(sensors?.battery),
  };
}

/** Drop the plain accuracy line once telemetry is already showing ±ACC. */
export function omitSupersededAccuracy<T extends { id: string }>(lines: T[], telemetry: TelemetryLine[]): T[] {
  if (!telemetry.some((line) => line.id === 'h-acc')) return lines;
  return lines.filter((line) => line.id !== 'accuracy');
}

export type MotionAccess = 'granted' | 'denied' | 'promptless';

type PermissionConstructor = { requestPermission?: () => Promise<string> };

/** iOS requires this inside the gesture that turns Telemetry on. Both prompts are started together. */
export async function requestMotionAccess(): Promise<MotionAccess> {
  const root = globalThis as typeof globalThis & {
    DeviceMotionEvent?: PermissionConstructor;
    DeviceOrientationEvent?: PermissionConstructor;
  };
  const motionAsk = ask(root.DeviceMotionEvent);
  const orientationAsk = ask(root.DeviceOrientationEvent);
  const pending = [motionAsk, orientationAsk].filter((item): item is Promise<string> => item != null);
  if (!pending.length) return 'promptless';
  const results = await Promise.all(pending.map((item) => item.then((value) => value === 'granted').catch(() => false)));
  return results.every(Boolean) ? 'granted' : 'denied';
}

function ask(ctor: PermissionConstructor | undefined): Promise<string> | null {
  if (typeof ctor?.requestPermission !== 'function') return null;
  return ctor.requestPermission();
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function finiteAxis(x: number | null, y: number | null, z: number | null): Axis3 | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return { x: x as number, y: y as number, z: z as number };
}

function finiteOrientation(alpha: number | null, beta: number | null, gamma: number | null): Orientation | null {
  if (!Number.isFinite(alpha) || !Number.isFinite(beta) || !Number.isFinite(gamma)) return null;
  return { alpha: alpha as number, beta: beta as number, gamma: gamma as number };
}

function signed(value: number, digits: number): string {
  const rounded = Number(value.toFixed(digits));
  const body = Math.abs(rounded).toFixed(digits);
  return rounded < 0 ? `${MINUS}${body}` : body;
}

function formatDegrees(value: number): string {
  const rounded = Math.round(value);
  if (rounded < 0) return `${MINUS}${Math.abs(rounded)}°`;
  return `${rounded}°`;
}

function formatMeters(value: number): string {
  return `\u00b1${Math.round(value)} m`;
}

function formatSpeed(value: number): string {
  return `${signed(value, 1)} m/s`;
}

function formatBattery(level: number): string {
  return `${Math.round(level * 100)}%`;
}
