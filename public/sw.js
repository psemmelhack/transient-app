const CACHE = 'transient-static-v1';
const ASSETS = [
  '/fonts.css',
  '/manifest.webmanifest',
  '/fonts/Anton-Regular.ttf',
  '/fonts/BigShouldersDisplay-wght.ttf',
  '/fonts/BodoniModa-opsz-wght.ttf',
  '/fonts/BodoniModa-Italic-opsz-wght.ttf',
  '/fonts/InstrumentSerif-Regular.ttf',
  '/fonts/InstrumentSerif-Italic.ttf',
  '/fonts/Antonio-wght.ttf',
  '/fonts/Fraunces-SOFT-WONK-opsz-wght.ttf',
  '/fonts/Fraunces-Italic-SOFT-WONK-opsz-wght.ttf',
  '/fonts/IBMPlexMono-Regular.ttf',
  '/fonts/IBMPlexMono-Medium.ttf',
  '/fonts/JetBrainsMono-wght.ttf',
  '/fonts/SpaceMono-Regular.ttf',
  '/fonts/SixCaps.ttf',
  '/fonts/PlayfairDisplay-Italic-wght.ttf',
  '/fonts/BebasNeue-Regular.ttf',
  '/fonts/DMSerifDisplay-Regular.ttf',
  '/fonts/Italiana-Regular.ttf',
  '/fonts/LeagueGothic-wdth.ttf',
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
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const cacheable = url.pathname.startsWith('/fonts/') || url.pathname === '/fonts.css' || url.pathname === '/manifest.webmanifest';
  if (!cacheable) return;
  event.respondWith(caches.match(event.request).then((hit) => hit || fetch(event.request)));
});
