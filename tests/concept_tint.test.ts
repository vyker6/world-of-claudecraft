import { describe, expect, it } from 'vitest';
import {
  checkConceptTint,
  hexToHsv,
  TINT_RULES,
  zonesSeparable,
} from '../scripts/asset_pipeline/lib/concept_tint.mjs';
import { syntheticPlate, tposeFigure } from './helpers/synthetic_plate';

const Z = { skin: '#c8956b', hair: '#5a3a24', garment: '#404044', accent: '#7a6a3a' };

describe('concept_tint: the separability rule', () => {
  it('converts hex to hsv', () => {
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv('#404044').s).toBeLessThan(0.1);
  });
  it('tells two zones apart by hue only when both are saturated enough', () => {
    expect(zonesSeparable('#c8956b', '#6b95c8')).toBe(true); // orange vs blue, both saturated
    expect(zonesSeparable('#7f8388', '#8b7f7f')).toBe(false); // two greys with a hue gap: not separable
  });
  it('tells two zones apart by value or saturation when the hues agree', () => {
    expect(zonesSeparable('#c8956b', '#5a3a24')).toBe(true); // same hue, value gap
    expect(zonesSeparable('#d9b98f', '#c9a256')).toBe(true); // same hue, saturation gap
    expect(zonesSeparable('#d9b98f', '#d9bb93')).toBe(false); // near-identical
  });
});

describe('concept_tint: the gate over a plate', () => {
  it('passes a plate painted in the declared base colours (the control)', async () => {
    const path = await syntheticPlate('tint-clean', 256, tposeFigure(256, Z));
    const r = await checkConceptTint(path, Z);
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.measure.zones.skin.share).toBeGreaterThan(TINT_RULES.minShare.skin);
    expect(r.measure.zones.hair.distanceToBase).toBeLessThan(5);
  });
  it('fails when the hair drifts into the skin band', async () => {
    const drifted = tposeFigure(256, { ...Z, hair: Z.skin });
    const path = await syntheticPlate('tint-drift', 256, drifted);
    const r = await checkConceptTint(path, Z);
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toMatch(/hair/);
  });
  it('fails when a zone is far from its declared base', async () => {
    // The garment paints at #101014, about 83 from its declared base #404044 by RGB
    // distance, and stays nearest to the garment base under nearest-zone assignment
    // (unlike a dark skin repaint, which nearest-zone sends to the hair base instead).
    const wrong = tposeFigure(256, { ...Z, garment: '#101014' });
    const path = await syntheticPlate('tint-far', 256, wrong);
    const r = await checkConceptTint(path, Z);
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toMatch(/garment .* from its base/);
  });
});
