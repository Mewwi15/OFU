// Self-destroying service worker (NOT a PWA). The admin used to ship a caching
// service worker; any machine that visited back then still has it registered and
// keeps serving stale files. This janitor SW replaces it, then unregisters itself
// and reloads the page — so previously-used machines clean up AUTOMATICALLY on
// their next visit, no manual "unregister" needed. New visitors never register a
// SW at all (the app no longer calls register), so this file is only ever fetched
// by browsers that still hold the old registration. Safe to delete once every
// till has been reloaded at least once.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        /* ignore */
      }
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => c.navigate(c.url));
    })(),
  );
});
