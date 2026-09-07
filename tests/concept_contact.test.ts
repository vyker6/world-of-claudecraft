import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  buildContactSheet,
  measureProportions,
  proportionProblems,
} from '../scripts/asset_pipeline/lib/concept_contact.mjs';
import { syntheticPlate, tposeFigure } from './helpers/synthetic_plate';

const Z = { skin: '#c8956b', hair: '#5a3a24', garment: '#404044', accent: '#7a6a3a' };

// The crotch guide line's stroke, #7fb8ff. Counting exact RGB matches ignores the antialiased
// fringe and answers the only question the option raises: was the line drawn at all?
const CROTCH_BLUE = { r: 0x7f, g: 0xb8, b: 0xff };

async function countExact(path: string, c: { r: number; g: number; b: number }): Promise<number> {
  const { data } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] === c.r && data[i + 1] === c.g && data[i + 2] === c.b) n++;
  }
  return n;
}

describe('concept_contact: proportions across bodies', () => {
  it('measures the shoulder and crotch lines as fractions of the figure height', async () => {
    const path = await syntheticPlate('prop', 256, tposeFigure(256, Z));
    const m = await measureProportions(path);
    expect(m.shoulderFrac).toBeGreaterThan(0.15);
    expect(m.shoulderFrac).toBeLessThan(0.35);
    expect(m.crotchFrac).toBeGreaterThan(0.45);
    expect(m.crotchFrac).toBeLessThan(0.6);
  });
  it('accepts identical figures and rejects one whose lines drift past the tolerance', async () => {
    const a = await measureProportions(await syntheticPlate('p1', 256, tposeFigure(256, Z)));
    const b = await measureProportions(await syntheticPlate('p2', 256, tposeFigure(256, Z)));
    expect(
      proportionProblems([
        { id: 'a', ...a },
        { id: 'b', ...b },
      ]),
    ).toEqual([]);
    // Only the legs' height grows, past the figure's original bottom edge; keeping their top
    // in place (rather than also raising it) is what actually changes the alpha silhouette.
    // Raising the top by the same amount the legs are lengthened only extends them into
    // columns the torso rect already made opaque, so the two figures render pixel-identical
    // and no proportions measurement, alpha-based or otherwise, could ever tell them apart.
    const longLegs = tposeFigure(256, Z).map((r, i) => (i >= 6 ? { ...r, h: r.h + 24 } : r));
    const c = await measureProportions(await syntheticPlate('p3', 256, longLegs));
    const problems = proportionProblems([
      { id: 'a', ...a },
      { id: 'c', ...c },
    ]);
    expect(problems.join(' ')).toMatch(/crotch/);
  });
  it('lays plates into a grid with guide lines and returns the rows', async () => {
    const p1 = await syntheticPlate('c1', 256, tposeFigure(256, Z));
    const p2 = await syntheticPlate('c2', 256, tposeFigure(256, Z));
    const out = p1.replace(/c1\.png$/, 'contact.png');
    const r = await buildContactSheet(
      [
        { id: 'one', path: p1 },
        { id: 'two', path: p2 },
      ],
      out,
      { columns: 2, cellHeight: 200 },
    );
    expect(existsSync(out)).toBe(true);
    expect(r.rows.map((x) => x.id)).toEqual(['one', 'two']);
  });
  it('draws only the lines the caller asked for: no crotch line under lines: [shoulder]', async () => {
    const p1 = await syntheticPlate('l1', 256, tposeFigure(256, Z));
    const both = p1.replace(/l1\.png$/, 'both.png');
    const shoulderOnly = p1.replace(/l1\.png$/, 'shoulder.png');
    const plates = [{ id: 'one', path: p1 }];
    await buildContactSheet(plates, both, { columns: 1, cellHeight: 200 });
    await buildContactSheet(plates, shoulderOnly, {
      columns: 1,
      cellHeight: 200,
      lines: ['shoulder'],
    });
    expect(await countExact(both, CROTCH_BLUE)).toBeGreaterThan(0);
    expect(await countExact(shoulderOnly, CROTCH_BLUE)).toBe(0);
  });
});
