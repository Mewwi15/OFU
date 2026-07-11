/**
 * Client-side image compression — the app shrinks photos before upload so the
 * user never has to think about file size (slips from phone cameras arrive at
 * 1–4 MB; storage quota is ours to protect, not theirs).
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export type CompressedImage = { uri: string; base64: string };

/**
 * Re-encode a local image as JPEG, capped at `maxDim` on its longest side.
 * Returns both a file uri (for previews) and base64 (for the upload path).
 * Never upscales — images already smaller than the cap only get re-encoded.
 */
export async function compressForUpload(
  asset: { uri: string; width?: number; height?: number },
  { maxDim = 1280, quality = 0.6 }: { maxDim?: number; quality?: number } = {},
): Promise<CompressedImage> {
  const context = ImageManipulator.manipulate(asset.uri);
  const w = asset.width ?? 0;
  const h = asset.height ?? 0;
  if (Math.max(w, h) > maxDim) {
    context.resize(w >= h ? { width: maxDim } : { height: maxDim });
  }
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: true });
  if (!result.base64) throw new Error('COMPRESS_NO_BASE64');
  return { uri: result.uri, base64: result.base64 };
}
