import type { Moment } from '../data/moment';

export type Token =
  | 'lat'
  | 'lon'
  | 'lon-minus'
  | 'lon-endash'
  | 'lat-card'
  | 'lon-card'
  | 'alt-m'
  | 'coords-pair'
  | 'coords-alt'
  | 'date-compact'
  | 'date-long'
  | 'date-time-quiet'
  | 'date-time-compact'
  | 'time-zone'
  | 'time-short'
  | 'time-lower'
  | 'time-spoken'
  | 'weekday-comma'
  | 'place-city-upper'
  | 'place-full'
  | 'place-full-upper'
  | 'alt-lower'
  | 'utc'
  | 'message'
  | 'mark';

export const MARK = 'latlon.art';
const DOT = '\u00a0·\u00a0';

export type SignStyle = 'ascii' | 'minus' | 'endash' | 'abs';

export function formatCoord(value: number, sign: SignStyle): string {
  const abs = Math.abs(value).toFixed(6);
  if (sign === 'abs' || value >= 0) return abs;
  const glyph = sign === 'minus' ? '\u2212' : sign === 'endash' ? '\u2013' : '-';
  return glyph + abs;
}

export function latHemisphere(lat: number): 'N' | 'S' {
  return lat >= 0 ? 'N' : 'S';
}

export function lonHemisphere(lon: number): 'E' | 'W' {
  return lon >= 0 ? 'E' : 'W';
}

interface Parts {
  weekday: string;
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  dayPeriod: string;
  timeZoneName: string;
}

function bagOf(parts: { type: string; value: string }[]): Record<string, string> {
  const bag: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal' && bag[part.type] == null) bag[part.type] = part.value;
  }
  return bag;
}

function digits(value: string | undefined): string | null {
  const match = value?.match(/\d+/);
  return match ? match[0] : null;
}

function hour12From24(hour24: number, minute: string): { hour: string; minute: string; dayPeriod: string } {
  return {
    hour: String(hour24 % 12 || 12),
    minute: minute.padStart(2, '0'),
    dayPeriod: hour24 >= 12 ? 'PM' : 'AM',
  };
}

/**
 * iOS WKWebView drops the hour and minute from en-US formatToParts, and en-US with
 * hourCycle h23 can come back blank too. en-GB h23 is the reading that still prints
 * on that WebView (the UTC line already uses it). Try that before en-US.
 */
const CLOCK_LOCALES = ['en-GB', 'en-US'] as const;

function read24Hour(date: Date, timeZone: string, locale: string): { hour: string; minute: string } | null {
  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  };
  try {
    const bag = bagOf(new Intl.DateTimeFormat(locale, options).formatToParts(date));
    const hour = digits(bag.hour);
    const minute = digits(bag.minute);
    if (hour != null && minute != null) return { hour, minute };
  } catch {
    /* The formatted string is the other way to read the same clock. */
  }
  try {
    const text = new Intl.DateTimeFormat(locale, options).format(date);
    const match = text.match(/(\d{1,2})\D(\d{2})/);
    if (match) return { hour: match[1], minute: match[2] };
  } catch {
    return null;
  }
  return null;
}

function clockFrom24Hour(date: Date, timeZone: string): { hour: string; minute: string; dayPeriod: string } | null {
  for (const locale of CLOCK_LOCALES) {
    const reading = read24Hour(date, timeZone, locale);
    if (!reading) continue;
    const hour24 = Number(reading.hour);
    if (!Number.isFinite(hour24)) continue;
    return hour12From24(hour24, reading.minute);
  }
  return null;
}

function zoneName(date: Date, timeZone: string): string {
  for (const locale of CLOCK_LOCALES) {
    try {
      const fmt = new Intl.DateTimeFormat(locale, {
        timeZone,
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
        hourCycle: 'h23',
      });
      const fromParts = fmt.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value?.trim() ?? '';
      if (/[A-Za-z]/.test(fromParts)) return fromParts;
      const text = fmt.format(date);
      const match = text.match(/[A-Z]{2,5}|GMT[+-]\d{1,2}(?::?\d{2})?/);
      if (match) return match[0];
    } catch {
      /* Try the other locale. */
    }
  }
  return '';
}

function localParts(date: Date, timeZone: string): Parts {
  let parts: { type: string; value: string }[] = [];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).formatToParts(date);
  } catch {
    parts = [];
  }
  const bag = bagOf(parts);
  let hour = bag.hour ?? '';
  let minute = bag.minute ?? '';
  let dayPeriod = bag.dayPeriod ?? '';
  if (!digits(hour) || !digits(minute)) {
    const filled = clockFrom24Hour(date, timeZone);
    if (filled) {
      hour = filled.hour;
      minute = filled.minute;
      if (!dayPeriod.trim()) dayPeriod = filled.dayPeriod;
    }
  }
  let timeZoneName = bag.timeZoneName ?? '';
  if (!/[A-Za-z]/.test(timeZoneName)) timeZoneName = zoneName(date, timeZone);
  return {
    weekday: bag.weekday ?? '',
    year: bag.year ?? '',
    month: bag.month ?? '',
    day: bag.day ?? '',
    hour,
    minute,
    dayPeriod,
    timeZoneName,
  };
}

function hour24(hour12: string, dayPeriod: string): number {
  const h = Number(hour12);
  const pm = dayPeriod.toLowerCase() === 'pm';
  if (h === 12) return pm ? 12 : 0;
  return pm ? h + 12 : h;
}

function dayPart(hour: number): string {
  if (hour < 12) return 'in the morning';
  if (hour < 17) return 'in the afternoon';
  if (hour < 21) return 'in the evening';
  return 'at night';
}

export function formatUtc(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const g = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}:${g('second')} UTC`;
}

export function formatAlt(meters: number | null): string | null {
  if (meters == null || !Number.isFinite(meters)) return null;
  return `alt ${Math.round(meters)} m`;
}

export interface MomentText {
  lat: string;
  lon: string;
  lonMinus: string;
  lonEndash: string;
  dateCompact: string;
  dateLong: string;
  timeZone: string;
  timeShort: string;
  timeLower: string;
  timeSpoken: string;
  weekdayComma: string;
  utc: string;
  placeCityUpper: string | null;
  placeFull: string | null;
  placeFullUpper: string | null;
  alt: string | null;
}

export function momentText(moment: Moment): MomentText {
  const p = localParts(moment.at, moment.timezone);
  const monthShort = p.month.slice(0, 3).toUpperCase();
  const h24 = hour24(p.hour, p.dayPeriod);
  const clock = `${p.hour}:${p.minute}`;
  const city = moment.place?.city?.trim() || null;
  const full = moment.place?.full?.trim() || city;
  return {
    lat: formatCoord(moment.latitude, 'ascii'),
    lon: formatCoord(moment.longitude, 'ascii'),
    lonMinus: formatCoord(moment.longitude, 'minus'),
    lonEndash: formatCoord(moment.longitude, 'endash'),
    dateCompact: `${monthShort} ${p.day} ${p.year}`,
    dateLong: `${p.month} ${p.day}, ${p.year}`,
    timeZone: `${clock} ${p.dayPeriod}${p.timeZoneName ? ` ${p.timeZoneName}` : ''}`,
    timeShort: `${clock} ${p.dayPeriod}`,
    timeLower: `${clock} ${p.dayPeriod.toLowerCase()}`,
    timeSpoken: `${clock} ${dayPart(h24)}`,
    weekdayComma: p.weekday ? `${p.weekday},` : '',
    utc: formatUtc(moment.at),
    placeCityUpper: city ? city.toUpperCase() : null,
    placeFull: full,
    placeFullUpper: full ? full.toUpperCase() : null,
    alt: formatAlt(moment.altitude),
  };
}

export function renderToken(token: Token, moment: Moment, message: string): string | null {
  const t = momentText(moment);
  switch (token) {
    case 'lat':
      return t.lat;
    case 'lon':
      return t.lon;
    case 'lon-minus':
      return t.lonMinus;
    case 'lon-endash':
      return t.lonEndash;
    case 'lat-card':
      return `${formatCoord(moment.latitude, 'abs')}\u00b0 ${latHemisphere(moment.latitude)}`;
    case 'lon-card':
      return `${formatCoord(moment.longitude, 'abs')}\u00b0 ${lonHemisphere(moment.longitude)}`;
    case 'alt-m':
      return t.alt ? t.alt.replace(/^alt /, '') : null;
    case 'coords-pair':
      return `${t.lat}, ${t.lon}`;
    case 'coords-alt':
      return t.alt ? `${t.lat}, ${t.lon}${DOT}${t.alt}` : `${t.lat}, ${t.lon}`;
    case 'date-compact':
      return t.dateCompact;
    case 'date-long':
      return t.dateLong;
    case 'date-time-quiet':
      return `${t.dateLong}${DOT}${t.timeLower}`;
    case 'date-time-compact':
      return `${t.dateCompact}${DOT}${t.timeZone}`;
    case 'time-zone':
      return t.timeZone;
    case 'time-short':
      return t.timeShort;
    case 'time-lower':
      return t.timeLower;
    case 'time-spoken':
      return t.timeSpoken;
    case 'weekday-comma':
      return t.weekdayComma || null;
    case 'place-city-upper':
      return t.placeCityUpper;
    case 'place-full':
      return t.placeFull;
    case 'place-full-upper':
      return t.placeFullUpper;
    case 'alt-lower':
      return t.alt;
    case 'utc':
      return t.utc;
    case 'message': {
      const trimmed = message.trim();
      return trimmed ? message : null;
    }
    case 'mark':
      return MARK;
    default:
      return null;
  }
}

export function linesFor(tokens: Token[], moment: Moment, message: string, join = false): string[] {
  const parts = tokens
    .map((token) => renderToken(token, moment, message))
    .filter((line): line is string => Boolean(line));
  if (!join) return parts;
  return parts.length ? [parts.join(DOT)] : [];
}

export interface CoordLineModel {
  value: string;
  degree: boolean;
  suffix?: string;
}

export function coordLines(
  moment: Moment,
  opts: { sign: SignStyle; degree: boolean; hemisphere: boolean },
): CoordLineModel[] {
  const sign: SignStyle = opts.hemisphere ? 'abs' : opts.sign;
  return [
    {
      value: formatCoord(moment.latitude, sign),
      degree: opts.degree,
      suffix: opts.hemisphere ? latHemisphere(moment.latitude) : undefined,
    },
    {
      value: formatCoord(moment.longitude, sign),
      degree: opts.degree,
      suffix: opts.hemisphere ? lonHemisphere(moment.longitude) : undefined,
    },
  ];
}

export function clockLabel(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone);
  return `${p.hour}:${p.minute} ${p.dayPeriod}${p.timeZoneName ? ` ${p.timeZoneName}` : ''}`;
}
