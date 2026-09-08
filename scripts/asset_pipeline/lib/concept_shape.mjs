// The two silhouette gates for weapon plates. Aspect: the bounding box's height over width
// must sit in the type's band, which rejects a plate that came back as another type. Distinct:
// the silhouette is scaled to fit the 128 px icon square the weapon lane renders and reduced to
// two row profiles, width and absolute centroid offset, both normalised by the widest row so a
// thin weapon is not measured small; the mean difference over the rows either shape occupies is
// the distance. Scale, mirroring and position all cancel by construction: only form remains.
import sharp from 'sharp';
import { ALPHA_SUBJECT, readRaw } from './concept_silhouette.mjs';

export const ICON_SIZE = 128;
export const SHAPE_RULES = Object.freeze({
  /** Mean profile difference below which two shapes read the same at icon scale. */
  minDistance: 0.06,
});

function silhouetteBounds({ data, width, height }) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < ALPHA_SUBJECT) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return right < 0 ? null : { left, top, right, bottom };
}

/** Bounding box, aspect (height over width) and the two icon-scale row profiles of a plate. */
export async function measureShape(path) {
  const raw = await readRaw(path);
  const bbox = silhouetteBounds(raw);
  if (!bbox) return { bbox: null, aspect: 0, width: [], offset: [] };
  const w = bbox.right - bbox.left + 1;
  const h = bbox.bottom - bbox.top + 1;
  const scale = ICON_SIZE / Math.max(w, h);
  const iw = Math.max(1, Math.round(w * scale));
  const ih = Math.max(1, Math.round(h * scale));
  const alpha = await sharp(path)
    .ensureAlpha()
    .extract({ left: bbox.left, top: bbox.top, width: w, height: h })
    .resize(iw, ih, { fit: 'fill', kernel: 'nearest' })
    .extractChannel(3)
    .raw()
    .toBuffer();
  const rowWidth = new Array(ICON_SIZE).fill(0);
  const rowCentre = new Array(ICON_SIZE).fill(0);
  const top = ICON_SIZE - ih;
  let maxWidth = 0;
  for (let y = 0; y < ih; y++) {
    let n = 0;
    let sx = 0;
    for (let x = 0; x < iw; x++) {
      if (alpha[y * iw + x] < ALPHA_SUBJECT) continue;
      n++;
      sx += x;
    }
    rowWidth[top + y] = n;
    rowCentre[top + y] = n ? sx / n : 0;
    if (n > maxWidth) maxWidth = n;
  }
  const centre = (iw - 1) / 2;
  const width = rowWidth.map((n) => n / maxWidth);
  const offset = rowWidth.map((n, i) => (n ? Math.abs(rowCentre[i] - centre) / maxWidth : 0));
  return { bbox, aspect: h / w, width, offset };
}

/** Weight of the aspect term in shapeDistance: a tenth of the absolute log ratio of aspects. */
export const ASPECT_WEIGHT = 0.1;

/** Mean profile difference over the rows either shape occupies, plus the aspect term (two
 *  full-width columns of different proportion are not one form); 0 for identical form. */
export function shapeDistance(a, b) {
  let sum = 0;
  let rows = 0;
  for (let i = 0; i < ICON_SIZE; i++) {
    const aw = a.width[i] ?? 0;
    const bw = b.width[i] ?? 0;
    if (aw === 0 && bw === 0) continue;
    rows++;
    sum += (Math.abs(aw - bw) + Math.abs((a.offset[i] ?? 0) - (b.offset[i] ?? 0))) / 2;
  }
  const profile = rows ? sum / rows : 0;
  const aspect = a.aspect > 0 && b.aspect > 0 ? Math.abs(Math.log(a.aspect / b.aspect)) : 0;
  return profile + ASPECT_WEIGHT * aspect;
}

/** Problems with a plate's aspect against its type's band; empty when it passes. */
export function aspectProblems(m, [lo, hi], label) {
  if (!m.bbox) return ['no subject detected (the plate is empty or fully transparent)'];
  if (m.aspect < lo || m.aspect > hi) {
    return [
      `${label} aspect ${m.aspect.toFixed(2)} outside ${lo} to ${hi} ` +
        "(the silhouette is not this type's shape)",
    ];
  }
  return [];
}

export async function checkConceptAspect(path, band, label) {
  const measure = await measureShape(path);
  const problems = aspectProblems(measure, band, label);
  return { ok: problems.length === 0, problems, measure };
}

/** One line per pair of rows closer than the floor; empty when every pair is distinct. */
export function distinctnessProblems(rows, rules = SHAPE_RULES) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const d = shapeDistance(rows[i].measure, rows[j].measure);
      if (d < rules.minDistance) {
        out.push(
          `${rows[i].id} and ${rows[j].id} are ${d.toFixed(3)} apart at icon scale ` +
            `< ${rules.minDistance} (the two shapes read the same)`,
        );
      }
    }
  }
  return out;
}

/** For every row, the id of its closest other row and the distance to it. */
export function nearestNeighbours(rows) {
  return rows.map((row) => {
    let nearest = null;
    let distance = Number.POSITIVE_INFINITY;
    for (const other of rows) {
      if (other === row) continue;
      const d = shapeDistance(row.measure, other.measure);
      if (d < distance) {
        distance = d;
        nearest = other.id;
      }
    }
    return { id: row.id, nearest, distance };
  });
}
