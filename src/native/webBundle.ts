import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

export interface WebBundleManifest {
  revision: string;
  files: Record<string, number>;
}

/** The app tsconfig resolves the web filesystem stub. Native builds have these methods. */
interface CacheFile {
  exists: boolean;
  uri: string;
  text(): Promise<string>;
  delete(): void;
  create(): void;
  write(content: Uint8Array): Promise<void>;
}

interface CacheDirectory {
  exists: boolean;
  uri: string;
  create(options?: { intermediates?: boolean; idempotent?: boolean }): void;
}

const FileCtor = FileSystem.File as unknown as new (parent: unknown, name: string) => CacheFile;
const DirectoryCtor = FileSystem.Directory as unknown as new (parent: unknown, name?: string) => CacheDirectory;

function cacheFile(parent: unknown, name: string): CacheFile {
  return new FileCtor(parent, name);
}

function cacheDir(parent: unknown, name?: string): CacheDirectory {
  return new DirectoryCtor(parent, name);
}

/** Copy the shipped web export into the cache and return the HTML plus its base URL. */
export async function installWebBundle(manifest: WebBundleManifest): Promise<{ html: string; baseUrl: string }> {
  if (!manifest.revision || !Object.keys(manifest.files).length) {
    throw new Error('The web bundle is empty');
  }
  const root = cacheDir(FileSystem.Paths.cache, `transient-web-${manifest.revision}`);
  if (!root.exists) root.create({ intermediates: true, idempotent: true });
  const index = cacheFile(root, 'index.html');
  const stamp = cacheFile(root, '.revision');
  const ready = stamp.exists && index.exists && (await stamp.text()) === manifest.revision;
  if (!ready) {
    for (const [relative, moduleId] of Object.entries(manifest.files)) {
      const asset = Asset.fromModule(moduleId);
      await asset.downloadAsync();
      const sourceUri = asset.localUri ?? asset.uri;
      if (!sourceUri) throw new Error(`Missing ${relative}`);
      ensureParent(root, relative);
      const dest = cacheFile(root, relative);
      const response = await fetch(sourceUri);
      if (!response.ok) throw new Error(`Could not read ${relative}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (dest.exists) dest.delete();
      dest.create();
      await dest.write(bytes);
    }
    if (stamp.exists) stamp.delete();
    stamp.create();
    await stamp.write(new TextEncoder().encode(manifest.revision));
  }
  const baseUrl = root.uri.endsWith('/') ? root.uri : `${root.uri}/`;
  return { html: await index.text(), baseUrl };
}

function ensureParent(root: CacheDirectory, relative: string): void {
  const parts = relative.split('/').slice(0, -1);
  let current: CacheDirectory = root;
  for (const part of parts) {
    current = cacheDir(current, part);
    if (!current.exists) current.create();
  }
}
