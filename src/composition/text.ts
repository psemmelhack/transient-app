import type { Moment } from '../data/moment';

export type Token =
  | 'lat'
  | 'lon'
  | 'lon-minus'
  | 'lon-endash'
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

function localParts(date: Date, timeZone: string): Parts {
  const parts = new Intl.DateTimeFormat('en-US', {
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
  const bag: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') bag[p.type] = p.value;
  }
  return {
    weekday: bag.weekday ?? '',
    year: bag.year ?? '',
    month: bag.month ?? '',
    day: bag.day ?? '',
    hour: bag.hour ?? '',
    minute: bag.minute ?? '',
    dayPeriod: bag.dayPeriod ?? '',
    timeZoneName: bag.timeZoneName ?? '',
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
