// Proportions across bodies, made visible. Every race shares the standard body, so the
// shoulder line (the widest row, the arms in a T-pose) and the crotch line (where the
// silhouette first splits into two legs from the bottom) must sit at the same fraction of
// the figure height on every plate. The contact sheet lays the plates at one figure height
// with those lines drawn, so drift is seen rather than inferred; proportionProblems turns
// the same numbers into a gate.
//
// Which lines to draw is the caller's choice. The crotch line is meaningless under a robe or
// a skirt, where the silhouette never splits and the reading lands on the hem, so callers
// pass `lines: ['shoulder']` for dressed plates and keep both for bare bodies.
//
// proportionProblems reads a group of rows, and the amended rule is that callers group them
// by gender (the female body is built to different proportions, so a mixed group reports a
// difference that is not drift) and leave tailed races out of the crotch reading (a tail
// hanging between the legs is opaque in the band the crotch scan walks). The 3% default
// tolerance is what the accepted twelve body plates actually hold to within a gender.
import sharp from 'sharp';
import { measurePose } from './concept_pose.mjs';
import { ALPHA_SUBJECT, readRaw } from './concept_silhouette.mjs';

export async function measureProportions(path) {
  const pose = await measurePose(path);
  if (!pose.bbox) return { bbox: null, shoulderFrac: null, crotchFrac: null };
  const { data, width } = await readRaw(path);
  const { left, top, right, bottom } = pose.bbox;
  const midX = Math.round((left + right) / 2);
  // Floored, not rounded: the band must stay inside the gap between the two legs. Rounding up
  // can put the band's edge on the first opaque leg column, which reads the whole figure as
  // solid at the very bottom row and reports a crotch line pinned to the feet.
  const halfBand = Math.max(1, Math.floor((right - left) * 0.02));
  let crotchRow = bottom;
  for (let y = bottom; y >= top; y--) {
    let solid = false;
    for (let x = midX - halfBand; x <= midX + halfBand; x++) {
      if (data[(y * width + x) * 4 + 3] >= ALPHA_SUBJECT) {
        solid = true;
        break;
      }
    }
    if (solid) {
      crotchRow = y;
      break;
    }
  }
  const h = bottom - top + 1;
  return { bbox: pose.bbox, shoulderFrac: pose.widestRowFrac, crotchFrac: (crotchRow - top) / h };
}

export function proportionProblems(rows, tolerance = 0.03) {
  const out = [];
  for (const key of ['shoulderFrac', 'crotchFrac']) {
    const vals = rows.filter((r) => r[key] != null).map((r) => r[key]);
    if (vals.length < 2) continue;
    const spread = Math.max(...vals) - Math.min(...vals);
    if (spread > tolerance) {
      const lo = rows.find((r) => r[key] === Math.min(...vals)).id;
      const hi = rows.find((r) => r[key] === Math.max(...vals)).id;
      const name = key === 'shoulderFrac' ? 'shoulder' : 'crotch';
      out.push(
        `${name} line drifts ${(spread * 100).toFixed(1)}% of figure height across bodies > ${tolerance * 100}% (${lo} lowest, ${hi} highest)`,
      );
    }
  }
  return out;
}

export async function buildContactSheet(
  plates,
  outPath,
  { columns = 6, cellHeight = 480, label = true, lines = ['shoulder', 'crotch'] } = {},
) {
  const rows = [];
  const cells = [];
  for (const plate of plates) {
    const m = await measureProportions(plate.path);
    rows.push({
      id: plate.id,
      path: plate.path,
      shoulderFrac: m.shoulderFrac,
      crotchFrac: m.crotchFrac,
    });
    if (!m.bbox) continue;
    const figureH = m.bbox.bottom - m.bbox.top + 1;
    const scale = cellHeight / figureH;
    const cut = await sharp(plate.path)
      .extract({
        left: m.bbox.left,
        top: m.bbox.top,
        width: m.bbox.right - m.bbox.left + 1,
        height: figureH,
      })
      .resize({ height: cellHeight })
      .png()
      .toBuffer();
    const meta = await sharp(cut).metadata();
    cells.push({
      id: plate.id,
      buffer: cut,
      width: meta.width,
      shoulderY: m.shoulderFrac * cellHeight,
      crotchY: m.crotchFrac * cellHeight,
      scale,
    });
  }
  const cellW = Math.max(...cells.map((c) => c.width)) + 32;
  const rowsN = Math.ceil(cells.length / columns);
  const sheetW = cellW * columns;
  const sheetH = (cellHeight + 64) * rowsN;
  const composites = [];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}">`;
  cells.forEach((c, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x0 = col * cellW + Math.round((cellW - c.width) / 2);
    const y0 = row * (cellHeight + 64) + 16;
    composites.push({ input: c.buffer, left: x0, top: y0 });
    const lx = col * cellW;
    if (lines.includes('shoulder'))
      svg += `<line x1="${lx}" y1="${y0 + c.shoulderY}" x2="${lx + cellW}" y2="${y0 + c.shoulderY}" stroke="#e2be6e" stroke-width="2"/>`;
    if (lines.includes('crotch'))
      svg += `<line x1="${lx}" y1="${y0 + c.crotchY}" x2="${lx + cellW}" y2="${y0 + c.crotchY}" stroke="#7fb8ff" stroke-width="2"/>`;
    if (label)
      svg += `<text x="${lx + 8}" y="${y0 + cellHeight + 36}" font-family="sans-serif" font-size="20" fill="#f0eadc">${c.id}</text>`;
  });
  svg += '</svg>';
  await sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 4,
      background: { r: 24, g: 22, b: 26, alpha: 1 },
    },
  })
    .composite([...composites, { input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(outPath);
  return { rows, outPath };
}
