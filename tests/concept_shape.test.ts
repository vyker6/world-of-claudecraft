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
