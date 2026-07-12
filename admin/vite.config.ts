import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Plain website — no PWA/service worker/install prompt. (Removed vite-plugin-pwa;
// a self-destroying SW was shipped first so already-installed clients clean up.)
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // antd ships as one deliberate ~1.1 MB chunk (split below, cached across
    // deploys); the default 500 kB advisory would flag it forever, so the
    // limit sits just above antd's real size to stay meaningful for the rest.
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        // Split the heavyweight vendors out of the app chunk: antd dominates
        // the bundle and rarely changes, so separate chunks stay cacheable
        // across deploys and everything drops under the 500 kB size warning.
        codeSplitting: {
          groups: [
            { name: 'antd', test: /node_modules[\\/](antd|@ant-design)[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/](react|react-dom|react-router-dom)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
          ],
        },
      },
    },
  },
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
