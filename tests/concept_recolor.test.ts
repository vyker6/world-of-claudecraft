import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { recolorZone, tierStrip } from '../scripts/asset_pipeline/lib/concept_recolor.mjs';
import { hexToLab, TIER_LADDER } from '../scripts/asset_pipeline/lib/concept_tiers.mjs';
import { measureTintZones } from '../scripts/asset_pipeline/lib/concept_tint.mjs';
import { syntheticPlate } from './helpers/synthetic_plate';

const ZONES = { metal: '#8a8f96', fittings: '#5a3a24' };
// A blade in two shades of the metal base (lit and shadow) with a fittings grip below it.
const BLADE = [
  { x: 120, y: 20, w: 8, h: 160, fill: '#8a8f96' },
  { x: 128, y: 20, w: 8, h: 160, fill: '#6e737a' },
  { x: 116, y: 180, w: 24, h: 40, fill: '#5a3a24' },
];

async function rawOf(buf: Buffer) {
  return sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

describe('concept_recolor: recolorZone', () => {
  it('moves the zone centroid onto the tier hex and keeps the shading order', async () => {
    const path = await syntheticPlate('blade', 256, BLADE);
    const out = await recolorZone({ path, zones: ZONES, zone: 'metal', hex: '#d84c4c' });
    const dir = mkdtempSync(join(tmpdir(), 'recolor-'));
    const dest = join(dir, 'red.png');
    await sharp(out).toFile(dest);
    const m = await measureTintZones(dest, { metal: '#d84c4c', fittings: '#5a3a24' });
    expect(m.zones.metal.distanceToBase).toBeLessThan(30);
    expect(m.zones.metal.share).toBeCloseTo((160 * 16) / (160 * 16 + 24 * 40), 2);
    const { data, info } = await rawOf(out);
    const px = (x: number, y: number) => {
      const i = (y * info.width + x) * 4;
      return { r: data[i], g: data[i + 1], b: data[i + 2] };
    };
    const lit = hexToLab(
      `#${[px(122, 100).r, px(122, 100).g, px(122, 100).b].map((v) => v.toString(16).padStart(2, '0')).join('')}`,
    );
    const shadow = hexToLab(
      `#${[px(132, 100).r, px(132, 100).g, px(132, 100).b].map((v) => v.toString(16).padStart(2, '0')).join('')}`,
    );
    expect(lit.L).toBeGreaterThan(shadow.L); // the lit half stays lighter than the shadow half
    expect(lit.a).toBeGreaterThan(30); // and both are now red
    expect(shadow.a).toBeGreaterThan(30);
  });
  it('leaves every pixel outside the zone byte-identical', async () => {
    const path = await syntheticPlate('blade2', 256, BLADE);
    const before = await rawOf(await sharp(path).toBuffer());
    const after = await rawOf(
      await recolorZone({ path, zones: ZONES, zone: 'metal', hex: '#66f2ea' }),
    );
    for (let y = 180; y < 220; y++) {
      for (let x = 116; x < 140; x++) {
        const i = (y * 256 + x) * 4;
        expect(after.data.subarray(i, i + 4)).toEqual(before.data.subarray(i, i + 4));
      }
    }
    expect(after.data.subarray(0, 4)).toEqual(before.data.subarray(0, 4)); // transparent corner
  });
  it('refuses an undeclared zone and a zone with no pixels', async () => {
    const path = await syntheticPlate('blade3', 256, BLADE);
    await expect(recolorZone({ path, zones: ZONES, zone: 'wood', hex: '#d84c4c' })).rejects.toThrow(
      /zone wood is not declared/,
    );
    // Hide, not cloth: the shadow shade #6e737a sits nearer cloth #5c6a8a than metal, so a cloth
    // zone would collect the shadow pixels and the case would not inject the defect it names.
    await expect(
      recolorZone({ path, zones: { ...ZONES, hide: '#b09a80' }, zone: 'hide', hex: '#d84c4c' }),
    ).rejects.toThrow(/no pixels fell in zone hide/);
  });
});

describe('concept_recolor: tierStrip', () => {
  it('lays the eight tiers left to right at the cell size', async () => {
    const path = await syntheticPlate('blade4', 256, BLADE);
    const dir = mkdtempSync(join(tmpdir(), 'strip-'));
    const dest = await tierStrip({
      path,
      zones: ZONES,
      zone: 'metal',
      ladder: TIER_LADDER,
      dest: join(dir, 's.png'),
      cell: 64,
    });
    const meta = await sharp(dest).metadata();
    expect(meta.width).toBe(64 * 8);
    expect(meta.height).toBe(64 + 40);
  });
});
