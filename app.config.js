/**
 * Dynamic Expo config.
 *
 * Extends the static `app.json` and injects the Android Google Maps API key
 * from the environment, so the key never lands in git. Apple Maps (iOS) needs
 * no key, so iOS is unaffected.
 *
 * Where the key goes:
 *   1. Create a key in Google Cloud → enable "Maps SDK for Android".
 *   2. Copy `.env.example` to `.env.local` (gitignored) and paste the key:
 *        GOOGLE_MAPS_API_KEY=AIza...
 *   3. Rebuild the Android dev client (`npx expo run:android`).
 *
 * Expo CLI auto-loads `.env*` files, so `process.env.GOOGLE_MAPS_API_KEY` is
 * populated when the config is resolved.
 */
const withGradleJvmLocale = require('./plugins/withGradleJvmLocale');

module.exports = ({ config }) =>
  withGradleJvmLocale({
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
    },
  });
