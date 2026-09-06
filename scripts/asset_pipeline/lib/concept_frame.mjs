// Framing gate for image-to-model concept art.
//
// Tripo rebuilds exactly the silhouette it is shown: a figure whose skull sits
// on the top edge of the concept comes back as a mesh with a flat-topped head
// (verified on the reaver, whose gpt-image concept was cropped despite the
// prompt saying "no cropping"). Prompt wording is not a reliable gate, so the
// concept is MEASURED before any paid generation step runs.
//
// Pure sharp + arithmetic: the border ring of the image defines the background
// (transparent, or its median colour), every pixel that differs from it is
// subject, and the subject's bounding box has to clear all four edges by a
// margin and fill a sane share of the frame height.
import sharp from 'sharp';

export const FRAME_RULES = Object.freeze({
  /** Clearance required between the subject and each edge, as a fraction of that axis. */
  minMargin: 0.04,
  /** Subject height as a fraction of frame height; smaller reconstructs too little detail. */
  minFill: 0.45,
});

// Per-channel distance from the background colour above which a pixel is subject.
// Loose enough to absorb gpt-image's slight background gradients and PNG noise.
const BACKGROUND_TOLERANCE = 40;
// A row or column counts as subject only when this many of its pixels are, so a
// stray speck cannot stretch the bounding box to an edge.
const MIN_RUN_FRACTION = 0.002;

function ringSamples(data, width, height, channels, ring) {
  const samples = [];
  const push = (x, y) => {
    const i = (y * width + x) * channels;
    samples.push([data[i], data[i + 1], data[i + 2], data[i + 3]]);
  };
  for (let y = 0; y < height; y++) {
    const edgeRow = y < ring || y >= height - ring;
    for (let x = 0; x < width; x++) {
      if (edgeRow || x < ring || x >= width - ring) push(x, y);
    }
  }
  return samples;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** The background is whatever the border ring is: transparent when most of the
 *  ring is, otherwise the ring's per-channel median colour. */
function ringBackground(data, width, height, channels, ring) {
  const samples = ringSamples(data, width, height, channels, ring);
  const transparentCount = samples.filter((s) => s[3] < 128).length;
  if (transparentCount > samples.length / 2) return { transparent: true, rgb: null };
  const rgb = [0, 1, 2].map((c) => median(samples.map((s) => s[c])));
  return { transparent: false, rgb };
}

function subjectRuns(data, width, height, channels, bg) {
  const rows = new Uint32Array(height);
  const cols = new Uint32Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      let isSubject;
      if (bg.transparent) {
        isSubject = data[i + 3] >= 128;
      } else {
        const d = Math.max(
          Math.abs(data[i] - bg.rgb[0]),
          Math.abs(data[i + 1] - bg.rgb[1]),
          Math.abs(data[i + 2] - bg.rgb[2]),
        );
        isSubject = d > BACKGROUND_TOLERANCE;
      }
      if (isSubject) {
        rows[y]++;
        cols[x]++;
      }
    }
  }
  return { rows, cols };
}

function extent(counts, minRun) {
  let first = -1;
  let last = -1;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] >= minRun) {
      if (first < 0) first = i;
      last = i;
    }
  }
  return first < 0 ? null : { first, last };
}

/** Measure where the subject sits in a concept image.
 *  Returns {width, height, background, bbox, margins, fill}: `background` is
 *  'transparent' or '#rrggbb'; `bbox` is {left, top, right, bottom} in pixels
 *  (inclusive) or null when nothing differs from the background; `margins` are
 *  the four edge clearances as fractions of their axis; `fill` is the subject
 *  height over the frame height. */
export async function measureFraming(path) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const ring = Math.max(4, Math.round(Math.min(width, height) * 0.02));
  const bg = ringBackground(data, width, height, channels, ring);
  const { rows, cols } = subjectRuns(data, width, height, channels, bg);
  const rowExtent = extent(rows, Math.max(2, Math.round(width * MIN_RUN_FRACTION)));
  const colExtent = extent(cols, Math.max(2, Math.round(height * MIN_RUN_FRACTION)));
  const background = bg.transparent
    ? 'transparent'
    : `#${bg.rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  if (!rowExtent || !colExtent) {
    return { width, height, background, bbox: null, margins: null, fill: 0 };
  }
  const bbox = {
    left: colExtent.first,
    top: rowExtent.first,
    right: colExtent.last,
    bottom: rowExtent.last,
  };
  const margins = {
    left: bbox.left / width,
    top: bbox.top / height,
    right: (width - 1 - bbox.right) / width,
    bottom: (height - 1 - bbox.bottom) / height,
  };
  const fill = (bbox.bottom - bbox.top + 1) / height;
  return { width, height, background, bbox, margins, fill };
}

const pct = (v) => `${(v * 100).toFixed(1)}%`;

/** Human-readable problems with a measurement; empty when the framing passes. */
export function framingProblems(m, rules = FRAME_RULES) {
  if (!m.bbox) return ['no subject detected (the image is a flat colour)'];
  const problems = [];
  for (const edge of ['top', 'bottom', 'left', 'right']) {
    if (m.margins[edge] < rules.minMargin) {
      problems.push(
        `${edge} margin ${pct(m.margins[edge])} < ${pct(rules.minMargin)} ` +
          `(the subject touches the ${edge} edge and will be reconstructed cropped)`,
      );
    }
  }
  if (m.fill < rules.minFill) {
    problems.push(
      `subject fills ${pct(m.fill)} of the frame height < ${pct(rules.minFill)} ` +
        '(too small for a detailed reconstruction)',
    );
  }
  return problems;
}

/** One-line summary for job logs. */
export function describeFraming(m) {
  if (!m.bbox) return `no subject on ${m.background}`;
  const { margins } = m;
  return (
    `subject ${pct(m.fill)} of height; margins L ${pct(margins.left)} T ${pct(margins.top)} ` +
    `R ${pct(margins.right)} B ${pct(margins.bottom)}; background ${m.background}`
  );
}

/** Measure `path` and judge it. Returns {ok, problems, measure}. */
export async function checkConceptFraming(path, rules = FRAME_RULES) {
  const measure = await measureFraming(path);
  const problems = framingProblems(measure, rules);
  return { ok: problems.length === 0, problems, measure };
}
