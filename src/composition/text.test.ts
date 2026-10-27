import { afterEach, describe, expect, it } from 'vitest';
import { exampleMoment } from '../data/moment';
import { renderToken } from './text';

const at = new Date('2026-10-26T17:29:00Z');
const originalParts = Intl.DateTimeFormat.prototype.formatToParts;

function quietLine(): string {
  const text = renderToken('date-time-quiet', exampleMoment(at), '');
  if (!text) throw new Error('missing date');
  return text;
}

describe('poster clock', () => {
  afterEach(() => {
    Intl.DateTimeFormat.prototype.formatToParts = originalParts;
  });

  it('keeps the hour and minute the desktop formatter already returns', () => {
    expect(quietLine()).toBe('October 26, 2026\u00a0·\u00a010:29 am');
    expect(renderToken('time-lower', exampleMoment(new Date('2026-10-26T07:00:00Z')), '')).toBe('12:00 am');
    expect(renderToken('time-lower', exampleMoment(new Date('2026-10-26T19:00:00Z')), '')).toBe('12:00 pm');
  });

  it('fills a blank hour and minute from a 24-hour reading', () => {
    const expected = quietLine();
    Intl.DateTimeFormat.prototype.formatToParts = function (date?: number | Date | undefined) {
      const parts = originalParts.call(this, date);
      if (this.resolvedOptions().hour12 !== true) return parts;
      return parts.filter((part) => part.type !== 'hour' && part.type !== 'minute' && part.type !== 'dayPeriod');
    };
    expect(quietLine()).toBe(expected);
    expect(renderToken('time-spoken', exampleMoment(at), '')).toBe('10:29 in the morning');
  });

  it('reads the formatted 24-hour string when those parts are empty too', () => {
    const expected = quietLine();
    Intl.DateTimeFormat.prototype.formatToParts = function (date?: number | Date) {
      const options = this.resolvedOptions();
      if (options.hourCycle === 'h23') {
        return [
          { type: 'hour', value: '' },
          { type: 'literal', value: ':' },
          { type: 'minute', value: '' },
        ];
      }
      return originalParts.call(this, date).filter((part) => part.type !== 'hour' && part.type !== 'minute');
    };
    expect(quietLine()).toBe(expected);
  });

  it('reads en-GB when the en-US 24-hour clock is blank', () => {
    const expected = quietLine();
    const Real = Intl.DateTimeFormat;
    function Wrapped(locale?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
      const fmt = new Real(locale, options);
      const format = fmt.format.bind(fmt);
      const parts = fmt.formatToParts.bind(fmt);
      return new Proxy(fmt, {
        get(target, prop, receiver) {
          if (prop === 'formatToParts') {
            return (date?: number | Date) => {
              const resolved = target.resolvedOptions();
              if (resolved.hourCycle === 'h23' && !resolved.timeZoneName) return [{ type: 'literal', value: ':' }];
              const all = parts(date);
              if (resolved.hour12) return all.filter((part) => part.type !== 'hour' && part.type !== 'minute' && part.type !== 'timeZoneName');
              return all;
            };
          }
          if (prop === 'format') {
            return (date?: number | Date) => {
              const resolved = target.resolvedOptions();
              if (resolved.hourCycle === 'h23' && !resolved.timeZoneName && String(resolved.locale).startsWith('en-US')) return '';
              return format(date);
            };
          }
          const value = Reflect.get(target, prop, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    }
    Intl.DateTimeFormat = Wrapped as unknown as typeof Intl.DateTimeFormat;
    try {
      expect(quietLine()).toBe(expected);
      expect(renderToken('time-zone', exampleMoment(at), '')).toMatch(/^10:29 AM (PDT|GMT-7)$/);
    } finally {
      Intl.DateTimeFormat = Real;
    }
  });
});
