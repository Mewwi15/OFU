/**
 * Strip the broad READ_MEDIA_IMAGES / READ_MEDIA_VIDEO permissions that
 * expo-image-picker and expo-media-library inject. The app only PICKS images
 * (payment slip, avatar, chat) via launchImageLibraryAsync — which uses the
 * Android system Photo Picker on Android 13+ and needs no permission — and only
 * WRITES the PromptPay QR to the gallery (add-only, no read needed). Removing
 * these permissions avoids Google Play's Photos & Videos Permissions policy
 * declaration entirely.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const REMOVE = ['android.permission.READ_MEDIA_IMAGES', 'android.permission.READ_MEDIA_VIDEO'];

module.exports = function withCleanMediaPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';
    manifest['uses-permission'] = (manifest['uses-permission'] || []).filter(
      (p) => !REMOVE.includes(p.$?.['android:name']),
    );
    for (const name of REMOVE) {
      manifest['uses-permission'].push({ $: { 'android:name': name, 'tools:node': 'remove' } });
    }
    return cfg;
  });
};
