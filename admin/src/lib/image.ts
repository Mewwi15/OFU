/**
 * Supabase Storage image transformation — admin was requesting full-original
 * product photos (some 300-400KB+) for 40-90px avatars/thumbnails and grid
 * tiles, multiplied by every product on screen (POS's grid alone can show 20+
 * at once). Supabase serves resized variants at
 * `/storage/v1/render/image/public/...` (same bucket, same auth) instead of
 * `/storage/v1/object/public/...`. Only rewrites our own Supabase Storage
 * URLs; anything else (a local blob: preview, an external URL) passes
 * through untouched. Mirrors the same fix already applied on the customer app
 * (lib/image.ts) — BOTH width and height are required, not just width: a
 * 768x768 source + `width=300` alone comes back an oddly-stretched 300x768.
 */
export function productThumb(url: string | undefined | null, width: number, height = width): string | undefined {
  if (!url || !url.includes('/storage/v1/object/public/')) return url ?? undefined;
  const base = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}width=${width}&height=${height}&resize=cover&quality=75`;
}
