import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Plain website — no PWA/service worker/install prompt. (Removed vite-plugin-pwa;
// a self-destroying SW was shipped first so already-installed clients clean up.)
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
});
