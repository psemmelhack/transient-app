import { assetTransferKind, cacheFolderName, cacheRoot, directoryFor, isSafeRelative, normalizeLocalUri } from './webBundlePlan';

export interface WebBundleManifest {
  revision: string;
  files: Record<string, number>;
}

export interface InstalledWebBundle {
  indexUrl: string;
  readAccessUrl: string;
  revision: string;
}

export interface BundleFileSystem {
  cacheDirectory: string | null;
  getInfoAsync(uri: string): Promise<{ exists: boolean }>;
  readAsStringAsync(uri: string): Promise<string>;
  writeAsStringAsync(uri: string, contents: string): Promise<void>;
  deleteAsync(uri: string, options?: { idempotent?: boolean }): Promise<void>;
  makeDirectoryAsync(uri: string, options?: { intermediates?: boolean }): Promise<void>;
  copyAsync(options: { from: string; to: string }): Promise<void>;
  downloadAsync(uri: string, fileUri: string): Promise<{ status: number }>;
}

export interface PackAsset {
  downloadAsync(): Promise<unknown>;
  localUri: string | null;
  uri: string | null;
}

/**
 * Copy the shipped web export into the legacy cache and return the file URL of index.html.
 * The stamp is written last, so a partial copy is installed again next launch.
 */
export async function installWebBundleWith(
  manifest: WebBundleManifest,
  updateId: string | null,
  fs: BundleFileSystem,
  loadAsset: (moduleId: number) => PackAsset,
): Promise<InstalledWebBundle> {
  if (!manifest.revision || !Object.keys(manifest.files).length) {
    throw new Error('The web bundle is empty');
  }
  const cacheDirectory = fs.cacheDirectory;
  if (!cacheDirectory) throw new Error('The cache is unavailable');
  const root = cacheRoot(cacheDirectory, cacheFolderName(updateId, manifest.revision));
  const indexUrl = `${root}index.html`;
  const stampUrl = `${root}.revision`;
  if (await stampMatches(fs, stampUrl, indexUrl, manifest.revision)) {
    return { indexUrl, readAccessUrl: root, revision: manifest.revision };
  }
  await fs.deleteAsync(root, { idempotent: true });
  await fs.makeDirectoryAsync(root, { intermediates: true });
  const parents = [...new Set(Object.keys(manifest.files).map((relative) => directoryFor(root, relative)).filter((dir): dir is string => Boolean(dir)))].sort(
    (a, b) => a.length - b.length,
  );
  for (const dir of parents) {
    await fs.makeDirectoryAsync(dir, { intermediates: true });
  }
  await Promise.all(Object.entries(manifest.files).map((entry) => copyOne(root, entry, fs, loadAsset)));
  await fs.writeAsStringAsync(stampUrl, manifest.revision);
  return { indexUrl, readAccessUrl: root, revision: manifest.revision };
}

async function stampMatches(fs: BundleFileSystem, stampUrl: string, indexUrl: string, revision: string): Promise<boolean> {
  const [stampInfo, indexInfo] = await Promise.all([fs.getInfoAsync(stampUrl), fs.getInfoAsync(indexUrl)]);
  if (!stampInfo.exists || !indexInfo.exists) return false;
  return (await fs.readAsStringAsync(stampUrl)).trim() === revision;
}

async function copyOne(
  root: string,
  entry: [string, number],
  fs: BundleFileSystem,
  loadAsset: (moduleId: number) => PackAsset,
): Promise<void> {
  const [relative, moduleId] = entry;
  try {
    if (!isSafeRelative(relative)) throw new Error('unsafe path');
    const asset = loadAsset(moduleId);
    try {
      await asset.downloadAsync();
    } catch {
      // A published update already has the file. A missing uri still fails below.
    }
    const source = normalizeLocalUri(asset.localUri || asset.uri || '');
    if (!source) throw new Error('missing file');
    const dest = `${root}${relative}`;
    if (assetTransferKind(source) === 'download') {
      const result = await fs.downloadAsync(source, dest);
      if (result.status < 200 || result.status >= 300) throw new Error(`status ${result.status}`);
      return;
    }
    await fs.copyAsync({ from: source, to: dest });
  } catch (error) {
    const detail = error instanceof Error && error.message.trim() ? error.message.trim() : 'failed';
    if (detail.startsWith('Could not copy ')) throw error instanceof Error ? error : new Error(detail);
    throw new Error(`Could not copy ${relative} (${detail})`);
  }
}
