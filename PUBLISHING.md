# Publishing Expo Go

Node 22 or newer. `EXPO_TOKEN` must be an Expo access token that can publish to the `psemme` account.

The project is already linked. `eas update` reads these fields from `app.json`:

- `owner`: `psemme`
- `extra.eas.projectId`: `fc828c9a-1d94-4a4f-8b11-9156e69011b1`
- `updates.url`: `https://u.expo.dev/fc828c9a-1d94-4a4f-8b11-9156e69011b1`
- `runtimeVersion.policy`: `sdkVersion` (Expo Go matches the SDK, so leave this as it is)

From a checkout of `main`:

```bash
npx eas-cli update --branch production --environment production --non-interactive --message "Expo Go"
```

`npm run publish:expo-go` runs that same command. Do not commit `dist/`.

Expo Go on SDK 58 loads this update. The phone UI is the web app, packed into `embedded-web/` so it opens offline. That pack is the web export: `index.html`, the script as `app.webjs`, and the fonts and icons already in `public/`. If you change the web UI, regenerate the pack and commit it before publishing:

```bash
node scripts/embed-web.mjs
```

If the pack cannot be copied on the phone, the shell opens https://transient.notarist.art/ instead.
