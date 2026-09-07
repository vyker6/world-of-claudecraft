import { describe, expect, it } from 'vitest';
import { checkHeadDiff } from '../scripts/asset_pipeline/lib/concept_headdiff.mjs';
import { syntheticPlate, tposeFigure } from './helpers/synthetic_plate';

const Z = { skin: '#c8956b', hair: '#5a3a24', garment: '#404044', accent: '#7a6a3a' };

describe('concept_headdiff: the dress editor must not change the head', () => {
  it('passes a dressed plate whose head matches the source (the control)', async () => {
    const source = await syntheticPlate('src', 256, tposeFigure(256, Z));
    const dressed = await syntheticPlate(
      'dressed',
      256,
      tposeFigure(256, { ...Z, garment: '#8a6a44' }),
    );
    const r = await checkHeadDiff(source, dressed);
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
  });
  it('fails when the head changed', async () => {
    const source = await syntheticPlate('src2', 256, tposeFigure(256, Z));
    const dressed = await syntheticPlate(
      'dressed2',
      256,
      tposeFigure(256, { ...Z, skin: '#4e3120', hair: '#e6e6ee' }),
    );
    const r = await checkHeadDiff(source, dressed);
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toMatch(/head region differs/);
  });
  it('fails when the figure moved in the frame', async () => {
    const source = await syntheticPlate('src3', 256, tposeFigure(256, Z));
    const shifted = tposeFigure(256, Z).map((r) => ({ ...r, y: r.y + 20 }));
    const dressed = await syntheticPlate('dressed3', 256, shifted);
    const r = await checkHeadDiff(source, dressed);
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toMatch(/moved/);
  });
});
