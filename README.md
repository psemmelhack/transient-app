# Transient

A place, a time, and a few words. Transient records where and when you are, sets them in a type poster, and saves that poster as an image you can share.

## Run

```bash
npm install
npx expo start --web
```

Open the URL Expo prints. The first screen is the composition, a note, and Capture. The style you used last time is restored; a first visit starts on preset 01. Scroll, or tap the sliders icon, and the type, color, layout, and optional data lines come up underneath the preview. The preview stays pinned and updates as you change them.

`?fixture=1` freezes the sample place and time (Redondo Beach, 22 Oct 2026, 6:12 PM PDT) so the screen does not ask for location. `?proof=01` through `?proof=09` render one reference poster at export size.

Native projects are wired (`npm run ios`, `npm run android`) but image export and the map are built for the web.

## Site

https://transient.notarist.art/

Pushes to `main` run `.github/workflows/pages.yml`, which installs dependencies, runs the tests, exports the web app with `npx expo export --platform web`, and deploys `dist/` to GitHub Pages. `experiments.baseUrl` in `app.json` is empty, so the bundle and assets are requested from the domain root. Fonts, icons, the manifest, and the service worker use paths relative to the page. `scripts/prepare-pages.mjs` adds `<base href="/">`, copies `index.html` to `404.html` so a direct visit still loads the app, and writes `CNAME` for `transient.notarist.art`. The manifest `start_url` and `scope` are `./`.

The published site is HTTPS, so the browser can share your location. The page includes `<meta name="robots" content="noindex, nofollow">`, and `robots.txt` disallows all crawlers.

`npx expo start --web` opens the app at `/` on the dev server.

## Architecture

The on-screen preview and the saved PNG are the same DOM stage, drawn at the export pixel size and scaled with CSS for display. The app currently composes in Square (1080×1080). Story (1080×1920) and Feed (1080×1350) remain in the code; set `formatChoiceEnabled` in `src/composition/formats.ts` to show the Format control and honor those ratios again. Poster lines are fit to the width of that stage. Capture stamps GPS, time, temperature, and sun position into PNG text metadata.

On the web, Capture names the PNG `transient-YYYYMMDD-HHMMSS` in the moment’s time zone. On iOS, Capture opens the system sheet with the image alone, so Save Image can put it in Photos or it can be sent on. On Android, Capture downloads the PNG into Downloads, where Gallery and Google Photos can show it, then opens the same sheet so the file can be sent. Dismissing the Android sheet still keeps that download, and the map reads Captured · not shared. A desktop browser that cannot share files downloads the PNG. Completing a capture stores the transient on this device. A name in Shared with is optional; without one the map reads Captured · not shared. Cancelling the iOS sheet stores nothing and shows no error. A native build asks for photo-library permission and writes the PNG with `expo-media-library`. The native preview does not yet render the export PNG, so that write runs once those bytes exist.

Last-used style lives in `localStorage`. Saved transients, including the PNG, live in IndexedDB on this device. There is no account and no backend.

Optional measurements are a small plugin list (`src/data/plugins.ts`): temperature from Open-Meteo (no key; the line is omitted if the request fails) and sun azimuth and altitude computed locally from time and coordinates. Both are off until turned on in the style controls. Accuracy is shown when a GPS fix includes it.

The map uses MapLibre and the OpenFreeMap Positron style. No API key.

The interface is set in Inter. The poster keeps its own display and mono faces, and the font list shows each of those names in its own face. IBM Plex Mono is selectable in Sans as well as in the mono row. A saved Italiana choice opens as DM Serif Display. Ledger uses the bundled Inter, with tabular figures, as its text face. Inter and the poster faces are bundled under `public/fonts` and licensed under the SIL Open Font License. The license texts are in `licenses/`.
