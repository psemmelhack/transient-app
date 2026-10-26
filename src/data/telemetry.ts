import { isNativeShell } from '../native/shell';

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

/**
 * Readings Expo Go can take that a browser cannot.
 * Absent on the web, so the web lines stay the same.
 */
export interface PhoneTelemetry {
  /** Barometric pressure, hPa. */
  pressureHpa: number | null;
  /** iOS barometer relative altitude, meters. */
  relativeAltitudeM: number | null;
  /** Magnetometer field, microteslas. */
  magneticField: Axis3 | null;
  /** True heading from the location compass, degrees. */
  trueHeading: number | null;
  /** Magnetic heading from the location compass, degrees. */
  magneticHeading: number | null;
  /** Steps since local midnight, where the pedometer can answer. */
  stepsToday: number | null;
  /** Gravity vector, m/s². */
  gravity: Axis3 | null;
  /** Battery state word, such as charging. */
  batteryState: string | null;
  /** Screen brightness, 0–1. */
  brightness: number | null;
  /** Network type word, such as wifi. */
  networkType: string | null;
  /** Device model name. */
  deviceModel: string | null;
  /** Ambient light, lux. Android only. */
  illuminance: number | null;
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
  /** Extra phone sensors. The web sample leaves this off. */
  phone?: PhoneTelemetry | null;
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
  /** Present when a phone captured the extra Expo Go sensors. */
  phone?: PhoneTelemetry | null;
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
  const speedText = formatSpeed(source.speed);
  if (speedText) lines.push({ id: 'spd', label: 'SPD', values: [speedText] });
  const course = finite(source.course);
  if (course != null) lines.push({ id: 'crs', label: 'CRS', values: [formatHeading(course)] });
  const battery = readBatteryLevel(sensors?.battery);
  if (battery != null) lines.push({ id: 'bat', label: 'BAT', values: [formatBattery(battery)] });
  lines.push(...phoneLines(sensors?.phone));
  return lines;
}

/** Lines for sensors a phone can read. An empty phone sample adds nothing. */
export function phoneLines(phone: PhoneTelemetry | null | undefined): TelemetryLine[] {
  if (!phone) return [];
  const lines: TelemetryLine[] = [];
  const pressure = finite(phone.pressureHpa);
  if (pressure != null) lines.push({ id: 'baro', label: 'BARO', values: [`${pressure.toFixed(1)} hPa`] });
  const relative = finite(phone.relativeAltitudeM);
  if (relative != null) lines.push({ id: 'ralt', label: 'RALT', values: [`${signed(relative, 1)} m`] });
  if (phone.magneticField) {
    lines.push({
      id: 'mag',
      label: 'MAG',
      values: [signed(phone.magneticField.x, 1), signed(phone.magneticField.y, 1), signed(phone.magneticField.z, 1)],
    });
  }
  const truth = finite(phone.trueHeading);
  if (truth != null) lines.push({ id: 'true', label: 'TRUE', values: [formatHeading(truth)] });
  const magnetic = finite(phone.magneticHeading);
  if (magnetic != null) lines.push({ id: 'mhdg', label: 'MH', values: [formatHeading(magnetic)] });
  const steps = finite(phone.stepsToday);
  if (steps != null) lines.push({ id: 'steps', label: 'STEPS', values: [String(Math.round(steps))] });
  if (phone.gravity) {
    lines.push({
      id: 'grav',
      label: 'GRAV',
      values: [signed(phone.gravity.x, 2), signed(phone.gravity.y, 2), signed(phone.gravity.z, 2)],
    });
  }
  if (phone.batteryState) lines.push({ id: 'bstat', label: 'BSTAT', values: [phone.batteryState] });
  const brightness = finite(phone.brightness);
  if (brightness != null) lines.push({ id: 'bright', label: 'BRIGHT', values: [`${Math.round(brightness * 100)}%`] });
  if (phone.networkType) lines.push({ id: 'net', label: 'NET', values: [phone.networkType] });
  if (phone.deviceModel) lines.push({ id: 'model', label: 'MODEL', values: [phone.deviceModel] });
  const light = finite(phone.illuminance);
  if (light != null) lines.push({ id: 'light', label: 'LIGHT', values: [`${Math.round(light)} lx`] });
  return lines;
}

/** Poster lines stay in the small metadata block. The rest is kept for the PNG. */
export const POSTER_TELEMETRY_CAP = 8;

const POSTER_PRIORITY = [
  'baro',
  'hdg',
  'spd',
  'steps',
  'v-acc',
  'bat',
  'true',
  'crs',
  'h-acc',
  'acc',
  'gyro',
  'orient',
  'ralt',
  'bstat',
  'bright',
  'mhdg',
  'net',
  'model',
  'mag',
  'grav',
  'light',
];

/**
 * Lines drawn on the poster.
 * A browser sample is unchanged. A phone sample is capped so the block stays small.
 */
export function posterTelemetryLines(source: TelemetrySource): TelemetryLine[] {
  const lines = telemetryLines(source);
  if (!source.sensors?.phone) return lines;
  const rank = new Map(POSTER_PRIORITY.map((id, index) => [id, index]));
  return lines
    .filter((line) => rank.has(line.id))
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
    .slice(0, POSTER_TELEMETRY_CAP);
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
    speed: groundSpeed(source.speed),
    course: finite(source.course),
    battery: readBatteryLevel(sensors?.battery),
    ...(sensors?.phone ? { phone: sensors.phone } : {}),
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
  if (isNativeShell()) return 'granted';
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

/** Geolocation reports meters per second. 1 mph is 1609.344 m / 3600 s. */
const MPH_PER_MPS = 3600 / 1609.344;

/**
 * A usable ground speed, in m/s.
 * Browsers and phones often omit speed, or send −1 when the fix has none.
 */
function groundSpeed(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

/**
 * Speed joins the readout only above 1 mph, in miles per hour.
 * At or below that, and for a missing or invalid fix, the line is left out.
 */
function formatSpeed(value: number | null | undefined): string | null {
  const speed = groundSpeed(value);
  if (speed == null) return null;
  const shown = Number((speed * MPH_PER_MPS).toFixed(1));
  if (!(shown > 1)) return null;
  return `${shown.toFixed(1)} mph`;
}

function formatBattery(level: number): string {
  return `${Math.round(level * 100)}%`;
}
