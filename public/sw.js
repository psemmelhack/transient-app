const CACHE = 'transient-static-v3';
const ASSETS = [
  'fonts.css',
  'manifest.webmanifest',
  'fonts/InterVariable.woff2',
  'fonts/Anton-Regular.ttf',
  'fonts/BigShouldersDisplay-wght.ttf',
  'fonts/BodoniModa-opsz-wght.ttf',
  'fonts/BodoniModa-Italic-opsz-wght.ttf',
  'fonts/InstrumentSerif-Regular.ttf',
  'fonts/InstrumentSerif-Italic.ttf',
  'fonts/Antonio-wght.ttf',
  'fonts/Fraunces-SOFT-WONK-opsz-wght.ttf',
  'fonts/Fraunces-Italic-SOFT-WONK-opsz-wght.ttf',
  'fonts/IBMPlexMono-Regular.ttf',
  'fonts/IBMPlexMono-Medium.ttf',
  'fonts/JetBrainsMono-wght.ttf',
  'fonts/SpaceMono-Regular.ttf',
  'fonts/SixCaps.ttf',
  'fonts/PlayfairDisplay-Italic-wght.ttf',
  'fonts/BebasNeue-Regular.ttf',
  'fonts/DMSerifDisplay-Regular.ttf',
  'fonts/Italiana-Regular.ttf',
  'fonts/LeagueGothic-wdth.ttf',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const fontsDir = new URL('fonts/', self.location.href);
  const fontsCss = new URL('fonts.css', self.location.href);
  const manifest = new URL('manifest.webmanifest', self.location.href);
  const cacheable =
    url.pathname.startsWith(fontsDir.pathname) ||
    url.pathname === fontsCss.pathname ||
    url.pathname === manifest.pathname;
  if (!cacheable) return;
  event.respondWith(caches.match(event.request).then((hit) => hit || fetch(event.request)));
});
