import { describe, expect, it } from 'vitest';
import type { TintRules } from '../scripts/asset_pipeline/lib/concept_tint.d.mts';
import {
  checkConceptTint,
  hexToHsv,
  measureTintZones,
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

describe('concept_tint: the hsv assignment keeps shading inside its zone', () => {
  // Wood at its base, its lit tone (x1.35) and its shadow tone (x0.62), beside fittings and hide.
  const W = { wood: '#8a6a48', fittings: '#3c4658', hide: '#b09a80' };
  const shaded = [
    { x: 40, y: 20, w: 40, h: 200, fill: '#8a6a48' }, // wood base
    { x: 80, y: 20, w: 40, h: 200, fill: '#bb8f61' }, // wood lit
    { x: 120, y: 20, w: 40, h: 200, fill: '#56422d' }, // wood shadow
    { x: 170, y: 20, w: 20, h: 200, fill: '#3c4658' }, // fittings
  ];
  it('assigns the lit and shadow tones of wood to wood, where rgb sends them to hide and fittings', async () => {
    const path = await syntheticPlate('tint-shaded', 256, shaded);
    const hsv = await measureTintZones(path, W, { ...TINT_RULES, assign: 'hsv' });
    const rgb = await measureTintZones(path, W, { ...TINT_RULES, assign: 'rgb' });
    expect(hsv.zones.wood.share).toBeCloseTo(120 / 140, 2);
    expect(hsv.zones.fittings.share).toBeCloseTo(20 / 140, 2);
    expect(hsv.zones.hide.share).toBe(0);
    expect(rgb.zones.wood.share).toBeLessThan(0.5); // the defect the rule exists to remove
    expect(rgb.zones.fittings.share + rgb.zones.hide.share).toBeGreaterThan(0.4);
  });
  it('keeps a grey shadow with the grey zone and never with a chromatic dark zone', async () => {
    const M = { metal: '#8a8f96', fittings: '#3c4658' };
    const rects = [
      { x: 40, y: 20, w: 60, h: 200, fill: '#8a8f96' },
      { x: 100, y: 20, w: 60, h: 200, fill: '#56595d' }, // metal shadow
      { x: 170, y: 20, w: 20, h: 200, fill: '#3c4658' },
    ];
    const path = await syntheticPlate('tint-grey', 256, rects);
    const hsv = await measureTintZones(path, M, { ...TINT_RULES, assign: 'hsv' });
    expect(hsv.zones.metal.share).toBeCloseTo(120 / 140, 2);
    const rgb = await measureTintZones(path, M, { ...TINT_RULES, assign: 'rgb' });
    expect(rgb.zones.metal.share).toBeCloseTo(60 / 140, 2);
  });
  it('leaves the default rule as rgb so the race gates measure what they measured', () => {
    expect(TINT_RULES.assign).toBe('rgb');
  });
  it('keeps a cool-shaded grey with the grey zone (cel-shaded metal picks up a blue tint in shadow)', async () => {
    const Z3 = { metal: '#8a8f96', wood: '#8a6a48', fittings: '#4f5a33' };
    const rects = [
      { x: 20, y: 20, w: 60, h: 200, fill: '#8a8f96' }, // metal
      { x: 80, y: 20, w: 60, h: 200, fill: '#5c6470' }, // metal shadow, cool tint
      { x: 140, y: 20, w: 40, h: 200, fill: '#8a6a48' }, // wood
      { x: 180, y: 20, w: 20, h: 200, fill: '#4f5a33' }, // fittings
    ];
    const path = await syntheticPlate('tint-cool-shadow', 256, rects);
    const hsv = await measureTintZones(path, Z3, { ...TINT_RULES, assign: 'hsv' });
    expect(hsv.zones.metal.share).toBeCloseTo(120 / 180, 2);
    expect(hsv.zones.fittings.share).toBeCloseTo(20 / 180, 2);
    expect(hsv.zones.wood.share).toBeCloseTo(40 / 180, 2);
  });
});

describe('concept_tint: gateBaseDistance', () => {
  // The grip is painted far from its declared hide base but still in the hide hue band; the blade
  // is on its base. Share floors: metal gated, hide not.
  const Z2 = { metal: '#8a8f96', hide: '#b09a80' };
  const rects = [
    { x: 60, y: 20, w: 80, h: 180, fill: '#8a8f96' },
    { x: 80, y: 200, w: 40, h: 40, fill: '#d8c8a8' }, // hide, 60 from its base
  ];
  it('under all, a far fixed zone fails the plate (the race behaviour)', async () => {
    const path = await syntheticPlate('gbd-all', 256, rects);
    const rules: TintRules = {
      ...TINT_RULES,
      assign: 'hsv',
      minShare: { metal: 0.3, hide: 0 },
      maxBaseDistance: 50,
    };
    const r = await checkConceptTint(path, Z2, rules);
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toMatch(/hide zone sits \d+ from its base/);
  });
  it('under floored, only zones with a share floor are held to their base', async () => {
    const path = await syntheticPlate('gbd-floored', 256, rects);
    const rules: TintRules = {
      ...TINT_RULES,
      assign: 'hsv',
      minShare: { metal: 0.3, hide: 0 },
      maxBaseDistance: 50,
      gateBaseDistance: 'floored',
    };
    const r = await checkConceptTint(path, Z2, rules);
    expect(r.ok).toBe(true);
    expect(r.measure.zones.hide.distanceToBase).toBeGreaterThan(50); // measured, not gated
  });
  it('under floored, the tier zone is still held to its base', async () => {
    const drifted = [{ ...rects[0], fill: '#b0b8c4' }, rects[1]]; // metal 60 from its base
    const path = await syntheticPlate('gbd-tier', 256, drifted);
    const rules: TintRules = {
      ...TINT_RULES,
      assign: 'hsv',
      minShare: { metal: 0.3, hide: 0 },
      maxBaseDistance: 50,
      gateBaseDistance: 'floored',
    };
    const r = await checkConceptTint(path, Z2, rules);
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toMatch(/metal zone sits \d+ from its base/);
  });
  it('defaults to all', () => {
    expect(TINT_RULES.gateBaseDistance).toBe('all');
  });
});
