const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// The Expo Go shell ships the web bundle as a file, not as a module.
for (const ext of ['fontcss', 'webjs', 'webmanifest']) {
  if (!config.resolver.assetExts.includes(ext)) config.resolver.assetExts.push(ext);
}
config.resolver.sourceExts = config.resolver.sourceExts.filter((ext) => ext !== 'css');
if (!config.resolver.assetExts.includes('css')) config.resolver.assetExts.push('css');

module.exports = config;
