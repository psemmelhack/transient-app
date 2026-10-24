import { afterEach, describe, expect, it, vi } from 'vitest';
import { fileNameFor } from '../export/download';
import { emailHref, sharePng, smsHref, webSharePayload } from './share';

describe('share payload', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('names the file from coordinates and UTC time', () => {
    const name = fileNameFor(new Date('2026-10-24T04:18:39.000Z'), 38.261602, -122.048768);
    expect(name).toBe('38.261602_-122.048768_20261024T041839Z.png');
    expect(name.toLowerCase().includes('transient')).toBe(false);
  });

  it('shares the image file and nothing else', async () => {
    const seen: unknown[] = [];
    const titles: string[] = [];
    vi.stubGlobal('document', {
      title: 'Transient',
    });
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async (data: unknown) => {
        titles.push(document.title);
        seen.push(data);
      },
    });

    const result = await sharePng(new Blob(['png'], { type: 'image/png' }), '38.261602_-122.048768_20261024T041839Z.png');

    expect(result).toBe('shared');
    expect(seen).toHaveLength(1);
    const payload = seen[0] as { files: File[]; title?: string; text?: string; url?: string };
    expect(Object.keys(payload)).toEqual(['files']);
    expect(payload.files).toHaveLength(1);
    expect(payload.files[0].name).toBe('38.261602_-122.048768_20261024T041839Z.png');
    expect(payload.files[0].type).toBe('image/png');
    expect(payload.title).toBeUndefined();
    expect(payload.text).toBeUndefined();
    expect(payload.url).toBeUndefined();
    expect(titles).toEqual(['']);
    expect(document.title).toBe('Transient');
  });

  it('builds a file-only payload', () => {
    const file = new File(['png'], '1.000000_2.000000_20261024T041839Z.png', { type: 'image/png' });
    expect(webSharePayload(file)).toEqual({ files: [file] });
  });

  it('opens a text with no message body', () => {
    expect(smsHref('+14155550123')).toBe('sms:%2B14155550123');
    expect(smsHref('')).toBe('sms:');
    expect(smsHref('+14155550123').includes('body')).toBe(false);
    expect(smsHref('+14155550123').toLowerCase().includes('transient')).toBe(false);
  });

  it('opens an email with no subject and no body', () => {
    expect(emailHref('a@example.com')).toBe('mailto:a%40example.com');
    expect(emailHref('')).toBe('mailto:');
    const href = emailHref('a@example.com');
    expect(href.includes('subject')).toBe(false);
    expect(href.includes('body')).toBe(false);
    expect(href.toLowerCase().includes('transient')).toBe(false);
  });
});