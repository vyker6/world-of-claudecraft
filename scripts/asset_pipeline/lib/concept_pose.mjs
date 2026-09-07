// The T-pose gate for body plates. The rig fitter derives its scale from the T-pose arm
// line, so a plate that is not a frontal T-pose is worthless to it however handsome. Three
// measures over the alpha silhouette catch the failure modes seen in practice: the arm span
// as a fraction of the figure height (arms down or bent read far narrower than a T), the
// widest row sitting in the upper third (the arms, not the hips or a wide stance), and that
// row spanning nearly the whole figure width (both arms out, not one).
import sharp from 'sharp';
import { ALPHA_SUBJECT } from './concept_silhouette.mjs';

export const POSE_RULES = Object.freeze({
  minAspect: 0.75, // arm span / figure height; a real T-pose is close to 1.0
  maxWidestRowFrac: 0.34, // the widest row must sit in the upper third of the figure
  minWidestSpan: 0.8, // and span at least this fraction of the figure width
});

export async function measurePose(path) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const rows = [];
  let left = width;
  let right = -1;
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    let first = -1;
    let last = -1;
    let count = 0;
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] >= ALPHA_SUBJECT) {
        count++;
        if (first < 0) first = x;
        last = x;
      }
    }
    rows.push({ count, first, last });
    if (count > 0) {
      if (top < 0) top = y;
      bottom = y;
      if (first < left) left = first;
      if (last > right) right = last;
    }
  }
  if (bottom < 0) {
    return {
      width,
      height,
      bbox: null,
      aspect: 0,
      widestRow: null,
      widestRowFrac: 0,
      widestSpan: 0,
    };
  }
  let widestRow = top;
  for (let y = top; y <= bottom; y++) if (rows[y].count > rows[widestRow].count) widestRow = y;
  const bboxW = right - left + 1;
  const bboxH = bottom - top + 1;
  const span = rows[widestRow].last - rows[widestRow].first + 1;
  return {
    width,
    height,
    bbox: { left, top, right, bottom },
    aspect: bboxW / bboxH,
    widestRow,
    widestRowFrac: (widestRow - top) / bboxH,
    widestSpan: span / bboxW,
  };
}

export function poseProblems(m, rules = POSE_RULES) {
  if (!m.bbox) return ['no subject detected (the plate is empty or fully transparent)'];
  const out = [];
  if (m.aspect < rules.minAspect) {
    out.push(
      `arm span ${(m.aspect * 100).toFixed(0)}% of the figure height < ${rules.minAspect * 100}%, ` +
        'not a T-pose (the arms are not straight out horizontally)',
    );
  }
  if (m.widestRowFrac > rules.maxWidestRowFrac) {
    out.push(
      `widest row at ${(m.widestRowFrac * 100).toFixed(0)}% of the figure height, below the upper ` +
        'third (the arms are not the widest line)',
    );
  }
  if (m.widestSpan < rules.minWidestSpan) {
    out.push(
      `widest row spans ${(m.widestSpan * 100).toFixed(0)}% of the figure width < ` +
        `${rules.minWidestSpan * 100}% (one arm is down or bent)`,
    );
  }
  return out;
}

export async function checkConceptPose(path, rules = POSE_RULES) {
  const measure = await measurePose(path);
  const problems = poseProblems(measure, rules);
  return { ok: problems.length === 0, problems, measure };
}
