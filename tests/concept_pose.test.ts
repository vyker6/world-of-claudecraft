import { describe, expect, it } from 'vitest';
import { checkConceptPose, POSE_RULES } from '../scripts/asset_pipeline/lib/concept_pose.mjs';
import { armsDownFigure, syntheticPlate, tposeFigure } from './helpers/synthetic_plate';

const C = { skin: '#c8956b', hair: '#5a3a24', garment: '#404044', accent: '#7a6a3a' };

describe('concept_pose: the T-pose gate', () => {
  it('passes a clean T-posed figure (the control)', async () => {
    const path = await syntheticPlate('tpose', 256, tposeFigure(256, C));
    const r = await checkConceptPose(path);
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.measure.aspect).toBeGreaterThan(POSE_RULES.minAspect);
    expect(r.measure.widestRowFrac).toBeLessThan(POSE_RULES.maxWidestRowFrac);
  });
  it('fails a figure with its arms down: the arm span is too narrow for a T-pose', async () => {
    const path = await syntheticPlate('armsdown', 256, armsDownFigure(256, C));
    const r = await checkConceptPose(path);
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toMatch(/arm span .* not a T-pose/);
  });
  it('fails a figure whose widest line is at the hips', async () => {
    const rects = tposeFigure(256, C).filter((_, i) => i !== 4 && i !== 5);
    rects.push({ x: 4 * 8, y: 15 * 8, w: 24 * 8, h: 1.6 * 8, fill: C.skin }); // a wide bar at hip height
    const path = await syntheticPlate('hips', 256, rects);
    const r = await checkConceptPose(path);
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toMatch(/widest row/);
  });
  it('reports an empty plate as having no subject', async () => {
    const path = await syntheticPlate('empty', 64, []);
    const r = await checkConceptPose(path);
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toMatch(/no subject/);
  });
});
