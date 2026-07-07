import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Ship a self-unregistering SW: any client with the old cached service
      // worker will unregister it and purge its caches on next visit, so deploys
      // take effect immediately. (Offline/PWA isn't needed during active dev;
      // re-enable by removing this once the receipt/scan flow is signed off.)
      selfDestroying: true,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'อู้ฟู่ POS',
        short_name: 'อู้ฟู่',
        description: 'ระบบขายหน้าร้าน อู้ฟู่',
        theme_color: '#F15929',
        background_color: '#FBF2EC',
        display: 'standalone',
        start_url: '/pos',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\/rest\/v1\/.*$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-rest', expiration: { maxEntries: 64, maxAgeSeconds: 86400 } },
          },
        ],
      },
    }),
  ],
});
