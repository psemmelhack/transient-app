# Transient

A place, a time, and a few words. Transient records where and when you are, sets them in a type poster, and saves that poster as an image you can share.

## Run

```bash
npm install
npx expo start --web
```

Open the URL Expo prints. The first screen is the composition, a note, and Save / Share. The style you used last time is restored; a first visit starts on preset 01. Scroll, or tap the sliders icon, and the type, color, layout, and optional data lines come up underneath the preview. The preview stays pinned and updates as you change them.

`?fixture=1` freezes the sample place and time (Redondo Beach, 22 Oct 2026, 6:12 PM PDT) so the screen does not ask for location. `?proof=01` through `?proof=09` render one reference poster at export size.

Native projects are wired (`npm run ios`, `npm run android`) but image export and the map are built for the web.

## Site

https://psemmelhack.github.io/transient-app/

Pushes to `main` run `.github/workflows/pages.yml`, which installs dependencies, runs the tests, exports the web app with `npx expo export --platform web`, and deploys `dist/` to GitHub Pages. `experiments.baseUrl` in `app.json` is `/transient-app`, so the exported bundle and assets are requested under that path. Fonts, icons, the manifest, and the service worker use paths relative to the page, and `scripts/prepare-pages.mjs` adds `<base href="/transient-app/">` and copies `index.html` to `404.html` so a direct visit still loads the app. The manifest `start_url` and `scope` are `./`, which resolve to `/transient-app/` when the manifest is served from the project site.

The published site is HTTPS, so the browser can share your location. The page includes `<meta name="robots" content="noindex, nofollow">`, and `robots.txt` disallows all crawlers.

`npx expo start --web` still opens the app at `/` on the dev server. The base path applies to the export.

## Architecture

The on-screen preview and the saved PNG are the same DOM stage, drawn at the export pixel size and scaled with CSS for display. The app currently composes in Square (1080×1080). Story (1080×1920) and Feed (1080×1350) remain in the code; set `formatChoiceEnabled` in `src/composition/formats.ts` to show the Format control and honor those ratios again. Poster lines are fit to the width of that stage. Save stamps GPS, time, temperature, and sun position into PNG text metadata.

Last-used style lives in `localStorage`. Saved transients, including the PNG, live in IndexedDB on this device. There is no account and no backend.

Optional measurements are a small plugin list (`src/data/plugins.ts`): temperature from Open-Meteo (no key; the line is omitted if the request fails) and sun azimuth and altitude computed locally from time and coordinates. Both are off until turned on in the style controls. Accuracy is shown when a GPS fix includes it.

The map uses MapLibre and the OpenFreeMap Positron style. No API key.

The interface is set in Inter. The poster keeps its own display and mono faces, and the font list shows each of those names in its own face. Ledger uses the bundled Inter, with tabular figures, as its text face. Inter and the poster faces are bundled under `public/fonts` and licensed under the SIL Open Font License. The license texts are in `licenses/`.
