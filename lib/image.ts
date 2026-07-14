/**
 * Supabase Storage image transformation — grid/list thumbnails were requesting
 * full-original-resolution product photos (some 300-400KB+) for a ~150px
 * square card, multiplied by every product on screen. Supabase serves
 * resized/requantized variants at `/storage/v1/render/image/public/...`
 * (same bucket, same auth) instead of `/storage/v1/object/public/...`.
 * Only rewrites our own Supabase Storage URLs; anything else (the local
 * fallback banner asset, an external URL) passes through untouched.
 *
 * BOTH width and height are required, not just width: passing width alone
 * only resizes that axis and leaves the other at the ORIGINAL size (e.g. a
 * 768x768 source + `width=300` came back as an oddly-stretched 300x768 —
 * bigger than the untouched original, the opposite of the point). `resize:
 * cover` crop-fills the box instead of squashing, matching every call site's
 * own `contentFit="cover"`.
 */
export function productThumb(url: string | undefined, width: number, height = width): string | undefined {
  if (!url || !url.includes('/storage/v1/object/public/')) return url;
  const base = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}width=${width}&height=${height}&resize=cover&quality=75`;
}
