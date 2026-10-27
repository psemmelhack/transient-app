import { describe, expect, it } from 'vitest';
import { installWebBundleWith, type BundleFileSystem, type PackAsset, type WebBundleManifest } from './webBundleInstall';

const revision = 'abc123abc123';

function manifest(): WebBundleManifest {
  return {
    revision,
    files: {
      'index.html': 1,
      'fonts/a.woff': 2,
      '_expo/static/js/web/app.js': 3,
    },
  };
}

function memory(): BundleFileSystem & { files: Map<string, string>; copies: string[]; downloads: string[]; made: string[] } {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const copies: string[] = [];
  const downloads: string[] = [];
  const made: string[] = [];
  const known = (uri: string) => files.has(uri) || dirs.has(uri) || dirs.has(uri.endsWith('/') ? uri.slice(0, -1) : `${uri}/`);
  return {
    cacheDirectory: 'file:///cache/',
    files,
    copies,
    downloads,
    made,
    async getInfoAsync(uri) {
      return { exists: known(uri) };
    },
    async readAsStringAsync(uri) {
      const value = files.get(uri);
      if (value == null) throw new Error('missing');
      return value;
    },
    async writeAsStringAsync(uri, contents) {
      files.set(uri, contents);
    },
    async deleteAsync(uri) {
      const prefix = uri.endsWith('/') ? uri : `${uri}/`;
      for (const key of [...files.keys()]) {
        if (key === uri || key.startsWith(prefix)) files.delete(key);
      }
      for (const key of [...dirs]) {
        if (key === uri || key.startsWith(prefix)) dirs.delete(key);
      }
    },
    async makeDirectoryAsync(uri) {
      made.push(uri);
      dirs.add(uri.endsWith('/') ? uri.slice(0, -1) : uri);
    },
    async copyAsync({ from, to }) {
      copies.push(to);
      files.set(to, `copied:${from}`);
    },
    async downloadAsync(uri, fileUri) {
      downloads.push(fileUri);
      if (uri.includes('fail')) return { status: 500 };
      files.set(fileUri, `downloaded:${uri}`);
      return { status: 200 };
    },
  };
}

function assets(sources: Record<number, string>): (moduleId: number) => PackAsset {
  return (moduleId) => ({
    async downloadAsync() {
      return undefined;
    },
    localUri: sources[moduleId] ?? null,
    uri: sources[moduleId] ?? null,
  });
}

describe('install web bundle', () => {
  it('copies local files in parallel, then writes the stamp', async () => {
    const fs = memory();
    let inFlight = 0;
    let maxInFlight = 0;
    const copy = fs.copyAsync.bind(fs);
    fs.copyAsync = async (options) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 15));
      inFlight -= 1;
      await copy(options);
    };
    const installed = await installWebBundleWith(
      manifest(),
      '8c02cd25',
      fs,
      assets({
        1: 'file:///pack/index.html',
        2: 'content://media/fonts/a.woff',
        3: '/var/pack/app.js',
      }),
    );
    expect(maxInFlight).toBe(3);
    expect(installed.indexUrl).toBe('file:///cache/transient-web-8c02cd25-abc123abc123/index.html');
    expect(installed.readAccessUrl).toBe('file:///cache/transient-web-8c02cd25-abc123abc123/');
    expect(fs.files.get(installed.indexUrl)).toBe('copied:file:///pack/index.html');
    expect(fs.files.get(`${installed.readAccessUrl}fonts/a.woff`)).toBe('copied:content://media/fonts/a.woff');
    expect(fs.files.get(`${installed.readAccessUrl}_expo/static/js/web/app.js`)).toBe('copied:file:///var/pack/app.js');
    expect(fs.files.get(`${installed.readAccessUrl}.revision`)).toBe(revision);
    expect(fs.downloads).toEqual([]);
    expect(fs.made.some((dir) => dir.endsWith('/fonts'))).toBe(true);
    expect(fs.made.some((dir) => dir.endsWith('/_expo/static/js/web'))).toBe(true);
  });

  it('skips the copy when this update’s stamp and index are already there', async () => {
    const fs = memory();
    const load = assets({ 1: 'file:///pack/index.html', 2: 'file:///pack/a.woff', 3: 'file:///pack/app.js' });
    await installWebBundleWith(manifest(), null, fs, load);
    const copies = fs.copies.length;
    const again = await installWebBundleWith(manifest(), null, fs, load);
    expect(again.indexUrl).toContain('transient-web-embedded-abc123abc123/index.html');
    expect(fs.copies.length).toBe(copies);
  });

  it('downloads an https asset and refuses a failed status', async () => {
    const fs = memory();
    await installWebBundleWith(manifest(), null, fs, (moduleId) => ({
      async downloadAsync() {
        return undefined;
      },
      localUri: null,
      uri: moduleId === 1 ? 'https://cdn.example/index.html' : 'file:///pack/file',
    }));
    expect(fs.downloads).toEqual(['file:///cache/transient-web-embedded-abc123abc123/index.html']);
    const failing = memory();
    await expect(
      installWebBundleWith(
        { revision, files: { 'index.html': 1 } },
        null,
        failing,
        () => ({
          async downloadAsync() {
            return undefined;
          },
          localUri: null,
          uri: 'https://cdn.example/fail.html',
        }),
      ),
    ).rejects.toThrow('Could not copy index.html (status 500)');
    expect(failing.files.has('file:///cache/transient-web-embedded-abc123abc123/.revision')).toBe(false);
  });

  it('does not stamp a copy that failed', async () => {
    const fs = memory();
    fs.copyAsync = async () => {
      throw new Error('EACCES');
    };
    await expect(installWebBundleWith({ revision, files: { 'index.html': 1 } }, null, fs, assets({ 1: 'file:///pack/index.html' }))).rejects.toThrow(
      'Could not copy index.html (EACCES)',
    );
    expect([...fs.files.keys()].some((uri) => uri.endsWith('.revision'))).toBe(false);
  });

  it('refuses an empty bundle or a missing cache', async () => {
    const fs = memory();
    await expect(installWebBundleWith({ revision: '', files: {} }, null, fs, assets({}))).rejects.toThrow('The web bundle is empty');
    fs.cacheDirectory = null;
    await expect(installWebBundleWith(manifest(), null, fs, assets({}))).rejects.toThrow('The cache is unavailable');
  });
});
