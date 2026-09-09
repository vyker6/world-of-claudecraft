import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  checkConceptAspect,
  distinctnessProblems,
  ICON_SIZE,
  measureShape,
  nearestNeighbours,
  SHAPE_RULES,
  shapeDistance,
} from '../scripts/asset_pipeline/lib/concept_shape.mjs';
import {
  barShape,
  crossguardShape,
  curvedShape,
  discShape,
  mirrorRects,
  scaleRects,
  squareShape,
  syntheticPlate,
} from './helpers/synthetic_plate';

const M = '#8a8f96';
const S = 512;
const measureOf = async (name: string, rects: ReturnType<typeof barShape>) =>
  measureShape(await syntheticPlate(name, S, rects));

// A silhouette 3px wide and 800px tall with its only two opaque pixels at the top-left and
// bottom-right corners: the bbox is real (left 0, top 0, right 2, bottom 799), but the icon-scale
// resize collapses the 3px width to a single sampled column that lands on the blank middle
// column, so every resized row measures zero width. This is the zero-maxWidth case
// measureShape's guard exists for, reproduced with raw pixels rather than relying on an SVG
// render's antialiasing.
async function collapsedSilhouette(): Promise<string> {
  const w = 3;
  const h = 800;
  const buf = Buffer.alloc(w * h * 4, 0);
  const setOpaque = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    buf[i] = 200;
    buf[i + 1] = 200;
    buf[i + 2] = 200;
    buf[i + 3] = 255;
  };
  setOpaque(0, 0);
  setOpaque(w - 1, h - 1);
  const dir = mkdtempSync(join(tmpdir(), 'collapsed-'));
  const path = join(dir, 'collapsed.png');
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(path);
  return path;
}

describe('concept_shape: the measure', () => {
  it('reports the bounding box, aspect and two 128-row profiles', async () => {
    const m = await measureOf('bar', barShape(S, M));
    expect(m.bbox).not.toBeNull();
    expect(m.aspect).toBeCloseTo(0.8 / 0.06, 0);
    expect(m.width).toHaveLength(ICON_SIZE);
    expect(m.offset).toHaveLength(ICON_SIZE);
    expect(Math.max(...m.width)).toBeCloseTo(1, 5); // normalised by the widest row
    expect(m.width[0]).toBeCloseTo(1, 5); // a thin bar scaled to fit is 128 tall: every row is filled
    expect(m.width[ICON_SIZE - 1]).toBeCloseTo(1, 5);
  });
  it('reports an empty plate as having no subject', async () => {
    const m = await measureOf('empty', []);
    expect(m.bbox).toBeNull();
    expect(m.width).toEqual([]);
  });
});

describe('concept_shape: the injected defects', () => {
  it('measures the same plate twice as identical (distance 0)', async () => {
    const a = await measureOf('same-a', crossguardShape(S, M));
    const b = await measureOf('same-b', crossguardShape(S, M));
    expect(shapeDistance(a, b)).toBe(0);
    expect(
      distinctnessProblems([
        { id: 'a', measure: a },
        { id: 'b', measure: b },
      ]).join(' '),
    ).toMatch(/a and b are 0\.000 apart/);
  });
  it('measures a copy scaled to 90 percent as the same shape', async () => {
    const a = await measureOf('scale-a', crossguardShape(S, M));
    const b = await measureOf('scale-b', scaleRects(S, crossguardShape(S, M), 0.9));
    expect(shapeDistance(a, b)).toBeLessThan(SHAPE_RULES.minDistance);
  });
  it('measures a mirrored copy as the same shape (the offset is absolute)', async () => {
    const a = await measureOf('mirror-a', curvedShape(S, M));
    const b = await measureOf('mirror-b', mirrorRects(S, curvedShape(S, M)));
    expect(shapeDistance(a, b)).toBeLessThan(SHAPE_RULES.minDistance);
    expect(Math.max(...a.offset)).toBeGreaterThan(0.5); // the curve is a real offset
  });
  it('tells a bar from the same bar with a crossguard', async () => {
    const a = await measureOf('bar-a', barShape(S, M));
    const b = await measureOf('guard-b', crossguardShape(S, M));
    expect(shapeDistance(a, b)).toBeGreaterThan(SHAPE_RULES.minDistance);
    expect(
      distinctnessProblems([
        { id: 'a', measure: a },
        { id: 'b', measure: b },
      ]),
    ).toEqual([]);
  });
  it('tells a straight bar from a curved one', async () => {
    const a = await measureOf('straight', barShape(S, M));
    const b = await measureOf('curved', curvedShape(S, M));
    expect(shapeDistance(a, b)).toBeGreaterThan(SHAPE_RULES.minDistance);
  });
  it('counts a change of aspect as a change of form, at a tenth of the log ratio', async () => {
    const a = await measureOf('asp-a', barShape(S, M, 0.06));
    const b = await measureOf('asp-b', barShape(S, M, 0.12));
    // Same relative profile (a full-width column), aspect halved: the distance is 0.1 * ln 2.
    expect(shapeDistance(a, b)).toBeCloseTo(0.1 * Math.LN2, 1);
  });
  it('passes three distinct shapes and names the nearest neighbour of each (the control)', async () => {
    const rows = [
      { id: 'bar', measure: await measureOf('c-bar', barShape(S, M)) },
      { id: 'guard', measure: await measureOf('c-guard', crossguardShape(S, M)) },
      { id: 'disc', measure: await measureOf('c-disc', discShape(S, M)) },
    ];
    expect(distinctnessProblems(rows)).toEqual([]);
    const nn = nearestNeighbours(rows);
    expect(nn).toHaveLength(3);
    for (const n of nn) {
      expect(['bar', 'guard', 'disc'].filter((id) => id !== n.id)).toContain(n.nearest);
      expect(n.distance).toBeGreaterThan(SHAPE_RULES.minDistance);
    }
  });
});

describe('concept_shape: the aspect band', () => {
  it('fails a square declared as a longblade and passes it as a round shield', async () => {
    const path = await syntheticPlate('square', S, squareShape(S, M));
    const blade = await checkConceptAspect(path, [5, 12], 'Longblade');
    expect(blade.ok).toBe(false);
    expect(blade.problems[0]).toMatch(/Longblade aspect 1\.00 outside 5 to 12/);
    const shield = await checkConceptAspect(path, [0.85, 1.2], 'Round Shield');
    expect(shield.ok).toBe(true);
    expect(shield.problems).toEqual([]);
  });
  it('reports an empty plate as having no subject', async () => {
    const r = await checkConceptAspect(await syntheticPlate('empty2', 64, []), [1, 2], 'Tome');
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toMatch(/no subject/);
  });
});

describe('concept_shape: the zero-maxWidth guard', () => {
  it('measures a real bbox with no measurable width instead of NaN profiles', async () => {
    const m = await measureShape(await collapsedSilhouette());
    expect(m.bbox).not.toBeNull();
    expect(Number.isNaN(m.aspect)).toBe(false);
    expect(m.width).toEqual([]);
    expect(m.offset).toEqual([]);
  });
  it('names the row instead of silently passing it, next to a shape that does measure', async () => {
    const empty = await measureShape(await collapsedSilhouette());
    const real = await measureOf('real-for-guard', barShape(S, M));
    expect(Number.isNaN(shapeDistance(empty, real))).toBe(false);
    const problems = distinctnessProblems([
      { id: 'empty', measure: empty },
      { id: 'real', measure: real },
    ]);
    expect(problems).toEqual(['empty has no measurable silhouette at icon scale']);
  });
  it('measures distance between two such rows as 0 (they read the same), not NaN', async () => {
    const path = await collapsedSilhouette();
    const a = await measureShape(path);
    const b = await measureShape(path);
    expect(shapeDistance(a, b)).toBe(0);
    const problems = distinctnessProblems([
      { id: 'a', measure: a },
      { id: 'b', measure: b },
    ]);
    expect(problems).toEqual([
      'a has no measurable silhouette at icon scale',
      'b has no measurable silhouette at icon scale',
      'a and b are 0.000 apart at icon scale < 0.07 (the two shapes read the same)',
    ]);
  });
});
