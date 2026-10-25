import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureFileName, fileNameFor } from '../export/download';
import { isAndroidPlatform, isIosNonSafari, isIosPlatform, saveImage, sharePng, webSharePayload } from './share';

const filename = '38.261602_-122.048768_20261024T041839Z.png';
const captureName = 'transient-20261024-180203.png';

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

  it('downloads when file sharing exists but the sheet fails to open', async () => {
    const downloads: string[] = [];
    vi.stubGlobal('document', { title: 'Transient' });
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: async () => {
        throw new DOMException('denied', 'NotAllowedError');
      },
    });
    const result = await saveImage(new Blob(['png'], { type: 'image/png' }), filename, () => downloads.push(filename));
    expect(result).toBe('downloaded');
    expect(downloads).toEqual([filename]);
  });

  it('downloads when canShare throws while checking the file', async () => {
    const downloads: string[] = [];
    vi.stubGlobal('document', { title: 'Transient' });
    vi.stubGlobal('navigator', {
      canShare: () => {
        throw new TypeError('files are not shareable');
      },
      share: async () => {
        throw new Error('share should not be called');
      },
    });
    const result = await saveImage(new Blob(['png'], { type: 'image/png' }), filename, () => downloads.push(filename));
    expect(result).toBe('downloaded');
    expect(downloads).toEqual([filename]);
  });

  const firefoxIos =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/142.0 Mobile/15E148 Safari/605.1.15';

  it('on Firefox iOS shows the image when the file sheet rejects', async () => {
    const downloads: string[] = [];
    const presented: string[] = [];
    vi.stubGlobal('document', { title: 'Transient' });
    vi.stubGlobal('navigator', {
      userAgent: firefoxIos,
      canShare: () => true,
      share: async () => {
        throw new DOMException('denied', 'NotAllowedError');
      },
    });
    const result = await saveImage(
      new Blob(['png'], { type: 'image/png' }),
      captureName,
      () => downloads.push('no'),
      (_blob, name) => presented.push(name),
    );
    expect(result).toBe('opened');
    expect(presented).toEqual([captureName]);
    expect(downloads).toEqual([]);
  });

  it('on Firefox iOS shows the image when file sharing is unavailable', async () => {
    const presented: string[] = [];
    vi.stubGlobal('navigator', {
      userAgent: firefoxIos,
      share: async () => {
        throw new Error('share should not be called');
      },
    });
    const result = await saveImage(
      new Blob(['png'], { type: 'image/png' }),
      captureName,
      () => {
        throw new Error('download should not be called');
      },
      () => presented.push('yes'),
    );
    expect(result).toBe('opened');
    expect(presented).toEqual(['yes']);
  });

  it('on Firefox iOS leaves a cancelled sheet unrecorded', async () => {
    const presented: string[] = [];
    const downloads: string[] = [];
    vi.stubGlobal('document', { title: 'Transient' });
    vi.stubGlobal('navigator', {
      userAgent: firefoxIos,
      canShare: () => true,
      share: async () => {
        throw new DOMException('cancelled', 'AbortError');
      },
    });
    const result = await saveImage(
      new Blob(['png'], { type: 'image/png' }),
      captureName,
      () => downloads.push('no'),
      () => presented.push('no'),
    );
    expect(result).toBe('cancelled');
    expect(downloads).toEqual([]);
    expect(presented).toEqual([]);
  });

  it('on Android downloads the PNG and then opens the share sheet', async () => {
    const order: string[] = [];
    vi.stubGlobal('document', { title: 'Transient' });
    vi.stubGlobal('navigator', {
      userAgentData: { platform: 'Android' },
      userAgent: 'Mozilla/5.0',
      canShare: () => true,
      share: async () => {
        order.push('share');
      },
    });
    const result = await saveImage(new Blob(['png'], { type: 'image/png' }), captureName, (_blob, name) => {
      order.push(name);
    });
    expect(result).toBe('shared');
    expect(order).toEqual([captureName, 'share']);
  });

  it('on Android keeps the download when the share sheet is cancelled', async () => {
    const downloads: string[] = [];
    vi.stubGlobal('document', { title: 'Transient' });
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
      canShare: () => true,
      share: async () => {
        throw new DOMException('cancelled', 'AbortError');
      },
    });
    const result = await saveImage(new Blob(['png'], { type: 'image/png' }), captureName, (_blob, name) => {
      downloads.push(name);
    });
    expect(result).toBe('saved');
    expect(downloads).toEqual([captureName]);
  });

  it('on Android keeps the download when the share sheet fails to open', async () => {
    const downloads: string[] = [];
    vi.stubGlobal('document', { title: 'Transient' });
    vi.stubGlobal('navigator', {
      userAgentData: { platform: 'Android' },
      canShare: () => true,
      share: async () => {
        throw new DOMException('denied', 'NotAllowedError');
      },
    });
    const result = await saveImage(new Blob(['png'], { type: 'image/png' }), captureName, () => {
      downloads.push('yes');
    });
    expect(result).toBe('saved');
    expect(downloads).toEqual(['yes']);
  });

  it('on iOS leaves a cancelled sheet unrecorded and undownloaded', async () => {
    const downloads: string[] = [];
    vi.stubGlobal('document', { title: 'Transient' });
    vi.stubGlobal('navigator', {
      userAgentData: { platform: 'iOS' },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
      canShare: () => true,
      share: async () => {
        throw new DOMException('cancelled', 'AbortError');
      },
    });
    const result = await saveImage(new Blob(['png'], { type: 'image/png' }), captureName, () => {
      downloads.push('no');
    });
    expect(result).toBe('cancelled');
    expect(downloads).toEqual([]);
  });

  it('on desktop downloads the PNG and does not open a share sheet', async () => {
    const downloads: string[] = [];
    let shared = false;
    vi.stubGlobal('navigator', {
      userAgentData: { platform: 'Linux' },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      share: async () => {
        shared = true;
      },
    });
    const result = await saveImage(new Blob(['png'], { type: 'image/png' }), captureName, (_blob, name) => {
      downloads.push(name);
    });
    expect(result).toBe('downloaded');
    expect(downloads).toEqual([captureName]);
    expect(shared).toBe(false);
  });

});

describe('ios detection', () => {
  it('recognizes Firefox iOS and leaves Safari and desktop alone', () => {
    const firefox =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/142.0 Mobile/15E148 Safari/605.1.15';
    const safari =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
    expect(isIosNonSafari({ userAgent: firefox })).toBe(true);
    expect(isIosPlatform({ userAgent: firefox })).toBe(true);
    expect(isIosNonSafari({ userAgent: safari })).toBe(false);
    expect(isIosPlatform({ userAgent: safari })).toBe(true);
    expect(isIosPlatform({ userAgentData: { platform: 'iOS' }, userAgent: 'Mozilla/5.0' })).toBe(true);
    expect(
      isIosNonSafari({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
      }),
    ).toBe(true);
    expect(isIosPlatform({ userAgentData: { platform: 'Linux' }, userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0' })).toBe(
      false,
    );
    expect(isIosNonSafari({ userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0' })).toBe(false);
  });
});

describe('android detection', () => {
  it('trusts a userAgentData platform of Android', () => {
    expect(isAndroidPlatform({ userAgentData: { platform: 'Android' }, userAgent: 'Mozilla/5.0' })).toBe(true);
  });

  it('reads Android from the user agent when platform is missing or empty', () => {
    const userAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36';
    expect(isAndroidPlatform({ userAgent })).toBe(true);
    expect(isAndroidPlatform({ userAgentData: { platform: '' }, userAgent })).toBe(true);
  });

  it('does not treat iPhone or a desktop platform as Android', () => {
    expect(
      isAndroidPlatform({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
      }),
    ).toBe(false);
    expect(isAndroidPlatform({ userAgentData: { platform: 'Linux' }, userAgent: 'Android' })).toBe(false);
    expect(isAndroidPlatform({ userAgentData: { platform: 'macOS' }, userAgent: 'Android' })).toBe(false);
    expect(isAndroidPlatform({ userAgentData: { platform: 'Windows' }, userAgent: 'Android' })).toBe(false);
  });
});

describe('capture file name', () => {
  it('stamps local date and time as transient-YYYYMMDD-HHMMSS', () => {
    expect(captureFileName(new Date('2026-10-25T01:02:03Z'), 'America/Los_Angeles')).toBe('transient-20261024-180203.png');
    expect(captureFileName(new Date('2026-10-25T01:02:03Z'))).toBe('transient-20261025-010203.png');
    expect(captureFileName(new Date('2026-01-02T03:04:05Z'), 'UTC')).toBe('transient-20260102-030405.png');
    expect(captureFileName(new Date('2026-10-25T07:00:00Z'), 'America/Los_Angeles')).toBe('transient-20261025-000000.png');
  });
});
