import { cardinal, readBatteryLevel, wrapDegrees, type SensorSample } from './telemetry';

export interface ExtendedRow {
  id: string;
  label: string;
  value: string;
}

const MINUS = '\u2212';

/**
 * Live rows for the phone's extra sensors.
 * A missing reading is left out. Numbers keep a fixed width so a tick does not shift the column.
 * These rows stay off the poster: a full set would crowd the longest styles.
 */
export function extendedRows(sensors: SensorSample | null | undefined): ExtendedRow[] {
  const phone = sensors?.phone;
  const rows: ExtendedRow[] = [];
  const pressure = finite(phone?.pressureHpa);
  if (pressure != null) rows.push({ id: 'baro', label: 'BARO', value: `${signedField(pressure, 4, 1)} hPa` });
  const relative = finite(phone?.relativeAltitudeM);
  if (relative != null) rows.push({ id: 'ralt', label: 'RALT', value: `${signedField(relative, 3, 1)} m` });
  if (phone?.magneticField) {
    const field = phone.magneticField;
    rows.push({
      id: 'mag',
      label: 'MAG',
      value: `${signedField(field.x, 3, 1)}  ${signedField(field.y, 3, 1)}  ${signedField(field.z, 3, 1)} µT`,
    });
  }
  const truth = finite(phone?.trueHeading);
  if (truth != null) rows.push({ id: 'true', label: 'TRUE', value: fixedHeading(truth) });
  const magnetic = finite(phone?.magneticHeading);
  if (magnetic != null) rows.push({ id: 'mhdg', label: 'MH', value: fixedHeading(magnetic) });
  if (phone?.gravity) {
    const gravity = phone.gravity;
    rows.push({
      id: 'grav',
      label: 'GRAV',
      value: `${signedField(gravity.x, 2, 2)}  ${signedField(gravity.y, 2, 2)}  ${signedField(gravity.z, 2, 2)} m/s²`,
    });
  }
  const light = finite(phone?.illuminance);
  if (light != null) rows.push({ id: 'light', label: 'LIGHT', value: `${whole(light, 6)} lx` });
  const battery = readBatteryLevel(sensors?.battery);
  if (battery != null) rows.push({ id: 'bat', label: 'BAT', value: percent(battery) });
  if (phone?.batteryState) rows.push({ id: 'bstat', label: 'BSTAT', value: phone.batteryState });
  const brightness = finite(phone?.brightness);
  if (brightness != null) rows.push({ id: 'bright', label: 'BRIGHT', value: percent(brightness) });
  if (phone?.networkType) rows.push({ id: 'net', label: 'NET', value: phone.networkType });
  const steps = finite(phone?.stepsToday);
  if (steps != null) rows.push({ id: 'steps', label: 'STEPS', value: whole(steps, 6) });
  if (phone?.deviceModel) rows.push({ id: 'model', label: 'MODEL', value: phone.deviceModel });
  return rows;
}

function signedField(value: number, intDigits: number, fracDigits: number): string {
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(fracDigits);
  const [wholePart, frac] = fixed.split('.');
  const body = fracDigits > 0 ? `${wholePart.padStart(intDigits, ' ')}.${frac}` : wholePart.padStart(intDigits, ' ');
  return `${negative ? MINUS : ' '}${body}`;
}

function fixedHeading(value: number): string {
  const wrapped = wrapDegrees(value);
  const rounded = Math.round(wrapped) % 360;
  return `${String(rounded).padStart(3, ' ')}° ${cardinal(wrapped).padEnd(2, ' ')}`;
}

function percent(level: number): string {
  return `${String(Math.round(level * 100)).padStart(3, ' ')}%`;
}

function whole(value: number, width: number): string {
  return String(Math.round(value)).padStart(width, ' ');
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
