// The dress editor promises to keep the identical character and change only the attire. This
// gate holds it to that: the head band of the source body plate (the top fifth of its figure)
// must match the dressed plate pixel for pixel within a small tolerance, and the figure must
// not have moved in the frame. A dressed plate whose face drifted cannot be cut into armour
// parts for the body it was meant for.
import { ALPHA_SUBJECT, alphaBbox, readRaw } from './concept_silhouette.mjs';

export const HEAD_RULES = Object.freeze({
  headFrac: 0.2, // the top fifth of the source figure is the head band
  maxMeanDiff: 0.08, // mean absolute RGBA difference over the band, 0 to 1
  maxTopShift: 0.02, // the dressed figure's top may move this fraction of the frame height
});

export async function measureHeadDiff(sourcePath, dressedPath) {
  const [src, out] = await Promise.all([readRaw(sourcePath), readRaw(dressedPath)]);
  if (src.width !== out.width || src.height !== out.height) {
    throw new Error(
      `head diff needs equal sizes; got ${src.width}x${src.height} and ${out.width}x${out.height}`,
    );
  }
  const sb = alphaBbox(src);
  const ob = alphaBbox(out);
  if (!sb || !ob) return { meanDiff: 1, topShift: 1, headBox: null };
  const headBox = {
    left: sb.left,
    top: sb.top,
    right: sb.right,
    bottom: sb.top + Math.round((sb.bottom - sb.top) * HEAD_RULES.headFrac),
  };
  let sum = 0;
  let n = 0;
  for (let y = headBox.top; y <= headBox.bottom; y++) {
    for (let x = headBox.left; x <= headBox.right; x++) {
      const i = (y * src.width + x) * 4;
      if (src.data[i + 3] < ALPHA_SUBJECT && out.data[i + 3] < ALPHA_SUBJECT) continue;
      for (let c = 0; c < 4; c++) sum += Math.abs(src.data[i + c] - out.data[i + c]) / 255;
      n += 4;
    }
  }
  return { meanDiff: n ? sum / n : 0, topShift: Math.abs(ob.top - sb.top) / src.height, headBox };
}

export function headProblems(m, rules = HEAD_RULES) {
  if (!m.headBox) return ['no subject detected in the source or the dressed plate'];
  const out = [];
  if (m.topShift > rules.maxTopShift) {
    out.push(
      `the figure moved ${(m.topShift * 100).toFixed(1)}% of the frame height > ${rules.maxTopShift * 100}% (camera or scale changed)`,
    );
  }
  if (m.meanDiff > rules.maxMeanDiff) {
    out.push(
      `head region differs by ${(m.meanDiff * 100).toFixed(1)}% > ${rules.maxMeanDiff * 100}% (the face or hair changed)`,
    );
  }
  return out;
}

export async function checkHeadDiff(sourcePath, dressedPath, rules = HEAD_RULES) {
  const measure = await measureHeadDiff(sourcePath, dressedPath);
  const problems = headProblems(measure, rules);
  return { ok: problems.length === 0, problems, measure };
}
