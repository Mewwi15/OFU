import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Plain website — no PWA/service worker/install prompt. (Removed vite-plugin-pwa;
// a self-destroying SW was shipped first so already-installed clients clean up.)
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Build stamp shown in the sidebar footer — ends the "which version is this
    // till actually running?" guessing game (SPA tabs keep running stale code
    // until reloaded; deploys alone don't update an open tab).
    __BUILD_TIME__: JSON.stringify(
      new Date().toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    ),
  },
});
