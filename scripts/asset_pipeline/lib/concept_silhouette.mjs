// The alpha silhouette read shared by every concept gate that measures a body plate: pose,
// tint, head-diff and the proportions contact tool all need the same raw RGBA pixels and the
// same opaque bounding box, so it lives here once instead of four times.
import sharp from 'sharp';

export const ALPHA_SUBJECT = 128;

/** Raw RGBA pixels of a plate: { data, width, height }. */
export async function readRaw(path) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Bounding box of the opaque silhouette, or null when nothing is opaque. */
export function alphaBbox(img) {
  let left = img.width;
  let right = -1;
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] >= ALPHA_SUBJECT) {
        if (top < 0) top = y;
        bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return bottom < 0 ? null : { left, top, right, bottom };
}
