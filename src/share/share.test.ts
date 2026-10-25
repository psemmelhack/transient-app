import { afterEach, describe, expect, it, vi } from 'vitest';
import { fileNameFor } from '../export/download';
import { saveImage, sharePng, webSharePayload } from './share';

const filename = '38.261602_-122.048768_20261024T041839Z.png';

describe('share payload', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('names the file from coordinates and UTC time', () => {
    const name = fileNameFor(new Date('2026-10-24T04:18:39.000Z'), 38.261602, -122.048768);
    expect(name).toBe(filename);
    expect(name.toLowerCase().includes('transient')).toBe(false);
  });

  it('shares the image file and nothing else', async () => {
    const seen: unknown[] = [];
    const titles: string[] = [];
    vi.stubGlobal('document', { title: 'Transient' });
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async (data: unknown) => {
        titles.push(document.title);
        seen.push(data);
      },
    });

    const result = await sharePng(new Blob(['png'], { type: 'image/png' }), filename);

    expect(result).toBe('shared');
    expect(seen).toHaveLength(1);
    const payload = seen[0] as { files: File[]; title?: string; text?: string; url?: string };
    expect(Object.keys(payload)).toEqual(['files']);
    expect(payload.files).toHaveLength(1);
    expect(payload.files[0].name).toBe(filename);
    expect(payload.files[0].type).toBe('image/png');
    expect(payload.title).toBeUndefined();
    expect(payload.text).toBeUndefined();
    expect(payload.url).toBeUndefined();
    expect(titles).toEqual(['']);
    expect(document.title).toBe('Transient');
  });

  it('builds a file-only payload', () => {
    const file = new File(['png'], filename, { type: 'image/png' });
    expect(webSharePayload(file)).toEqual({ files: [file] });
  });

  it('saves through the system sheet with the image file alone', async () => {
    const downloads: string[] = [];
    const seen: unknown[] = [];
    vi.stubGlobal('document', { title: 'Transient' });
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async (data: unknown) => {
        seen.push(data);
      },
    });
    const result = await saveImage(new Blob(['png'], { type: 'image/png' }), filename, () => {
      downloads.push('no');
    });
    expect(result).toBe('shared');
    expect(downloads).toEqual([]);
    const payload = seen[0] as { files: File[]; title?: string; text?: string; url?: string };
    expect(Object.keys(payload)).toEqual(['files']);
    expect(payload.files[0].name).toBe(filename);
    expect(payload.files[0].type).toBe('image/png');
    expect(payload.title).toBeUndefined();
    expect(payload.text).toBeUndefined();
    expect(payload.url).toBeUndefined();
  });

  it('does not download or throw when Capture’s sheet is cancelled', async () => {
    const downloads: string[] = [];
    vi.stubGlobal('document', { title: 'Transient' });
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async () => {
        throw new DOMException('cancelled', 'AbortError');
      },
    });
    const result = await saveImage(new Blob(['png'], { type: 'image/png' }), filename, () => {
      downloads.push('no');
    });
    expect(result).toBe('cancelled');
    expect(downloads).toEqual([]);
  });

  it('downloads only when the browser cannot share files', async () => {
    const downloads: string[] = [];
    vi.stubGlobal('navigator', {});
    const result = await saveImage(new Blob(['png'], { type: 'image/png' }), filename, (_blob, name) => {
      downloads.push(name);
    });
    expect(result).toBe('downloaded');
    expect(downloads).toEqual([filename]);
  });

  it('does not download when file sharing exists but the sheet fails to open', async () => {
    const downloads: string[] = [];
    vi.stubGlobal('document', { title: 'Transient' });
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async () => {
        throw new DOMException('denied', 'NotAllowedError');
      },
    });
    await expect(saveImage(new Blob(['png'], { type: 'image/png' }), filename, () => downloads.push('no'))).rejects.toThrow(
      'Could not open the share sheet',
    );
    expect(downloads).toEqual([]);
  });

});
