import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { installWebBundleWith, type InstalledWebBundle, type WebBundleManifest } from './webBundleInstall';

export type { InstalledWebBundle, WebBundleManifest };

/**
 * Install the embedded page into the legacy cache directory.
 * That URI is the one Expo Go already grants to WKWebView. The new File API can
 * hand back `/var` while the cache Expo Go knows is `/private/var`, and the page
 * then cannot read its own scripts. Android also cannot read those files with fetch.
 */
export function installWebBundle(manifest: WebBundleManifest, updateId?: string | null): Promise<InstalledWebBundle> {
  return installWebBundleWith(
    manifest,
    updateId ?? null,
    {
      cacheDirectory: FileSystem.cacheDirectory,
      getInfoAsync: (uri) => FileSystem.getInfoAsync(uri),
      readAsStringAsync: (uri) => FileSystem.readAsStringAsync(uri),
      writeAsStringAsync: (uri, contents) => FileSystem.writeAsStringAsync(uri, contents),
      deleteAsync: (uri, options) => FileSystem.deleteAsync(uri, options),
      makeDirectoryAsync: (uri, options) => FileSystem.makeDirectoryAsync(uri, options),
      copyAsync: (options) => FileSystem.copyAsync(options),
      downloadAsync: async (uri, fileUri) => {
        const result = await FileSystem.downloadAsync(uri, fileUri);
        return { status: result.status };
      },
    },
    (moduleId) => {
      const asset = Asset.fromModule(moduleId);
      return {
        downloadAsync: () => asset.downloadAsync(),
        get localUri() {
          return asset.localUri;
        },
        get uri() {
          return asset.uri;
        },
      };
    },
  );
}
