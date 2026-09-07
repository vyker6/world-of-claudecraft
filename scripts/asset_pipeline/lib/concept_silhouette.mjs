// The one alpha threshold, and the one raw RGBA read, that the concept gates over a body
// plate share. Pose and tint import ALPHA_SUBJECT and each does its own single pass over the
// pixels; contact imports readRaw as well, because measurePose hands it a bbox and it still
// has to walk the pixels itself to find the crotch row. Keeping the threshold in one place is
// the point: a gate that decided for itself what counts as opaque would measure a different
// silhouette from the one the gate beside it measured.
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
