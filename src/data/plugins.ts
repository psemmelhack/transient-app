import type { TempUnit } from '../style/types';
import type { Moment } from './moment';
import { sunPosition } from './solar';

export interface DataContext {
  moment: Moment;
  temperatureC: number | null;
  temperatureUnit: TempUnit;
}

export interface DataLinePlugin {
  id: string;
  title: string;
  /** Shown in the style sheet. Always-on lines stay out of the way. */
  toggle: boolean;
  defaultEnabled: boolean;
  produce(ctx: DataContext): string | null;
}

function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

function signedDegree(value: number): string {
  const rounded = Math.round(value);
  if (rounded < 0) return `\u2212${Math.abs(rounded)}`;
  return String(rounded);
}

export const dataLinePlugins: DataLinePlugin[] = [
  {
    id: 'accuracy',
    title: 'Accuracy',
    toggle: false,
    defaultEnabled: true,
    produce(ctx) {
      const meters = ctx.moment.accuracy;
      if (meters == null || !Number.isFinite(meters)) return null;
      return `\u00b1${Math.round(meters)} m`;
    },
  },
  {
    id: 'temperature',
    title: 'Temperature',
    toggle: true,
    defaultEnabled: false,
    produce(ctx) {
      if (ctx.temperatureC == null || !Number.isFinite(ctx.temperatureC)) return null;
      const c = Math.round(ctx.temperatureC);
      const f = Math.round(cToF(ctx.temperatureC));
      if (ctx.temperatureUnit === 'C') return `${c}\u00b0C`;
      if (ctx.temperatureUnit === 'both') return `${f}\u00b0F \u00b7 ${c}\u00b0C`;
      return `${f}\u00b0F`;
    },
  },
  {
    id: 'sun',
    title: 'Sun',
    toggle: true,
    defaultEnabled: false,
    produce(ctx) {
      const sun = sunPosition(ctx.moment.at, ctx.moment.latitude, ctx.moment.longitude);
      return `sun ${Math.round(sun.azimuth)}\u00b0 az \u00b7 ${signedDegree(sun.altitude)}\u00b0 el`;
    },
  },
  {
    id: 'telemetry',
    title: 'Telemetry',
    toggle: true,
    defaultEnabled: false,
    /** Each reading is its own line, composed in telemetry.ts. */
    produce() {
      return null;
    },
  },
  {
    id: 'extended',
    title: 'Extended data',
    toggle: true,
    defaultEnabled: false,
    /** Phone-only live readout. It is not a poster line. */
    produce() {
      return null;
    },
  },
];

export function isMeasurementEnabled(
  measurements: Record<string, boolean>,
  plugin: DataLinePlugin,
): boolean {
  const value = measurements[plugin.id];
  return value === undefined ? plugin.defaultEnabled : value;
}

export function measurementLines(
  measurements: Record<string, boolean>,
  unit: TempUnit,
  moment: Moment,
): { id: string; text: string }[] {
  const ctx: DataContext = {
    moment,
    temperatureC: moment.temperatureC,
    temperatureUnit: unit,
  };
  const lines: { id: string; text: string }[] = [];
  for (const plugin of dataLinePlugins) {
    if (!isMeasurementEnabled(measurements, plugin)) continue;
    const text = plugin.produce(ctx);
    if (text) lines.push({ id: plugin.id, text });
  }
  return lines;
}

export function isTelemetryEnabled(measurements: Record<string, boolean>): boolean {
  const plugin = dataLinePlugins.find((item) => item.id === 'telemetry');
  return plugin ? isMeasurementEnabled(measurements, plugin) : false;
}

export function isExtendedEnabled(measurements: Record<string, boolean>): boolean {
  const plugin = dataLinePlugins.find((item) => item.id === 'extended');
  return plugin ? isMeasurementEnabled(measurements, plugin) : false;
}

/** Extended data is a native-shell switch. A browser never sees it. */
export function dataTogglePlugins(shell: boolean): DataLinePlugin[] {
  return dataLinePlugins.filter((plugin) => plugin.toggle && (plugin.id !== 'extended' || shell));
}

export function defaultMeasurements(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const plugin of dataLinePlugins) out[plugin.id] = plugin.defaultEnabled;
  return out;
}
