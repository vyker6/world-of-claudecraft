import { describe, expect, it } from 'vitest';
import {
  deltaE,
  hexToLab,
  labToRgb,
  TIER_LADDER,
  TIER_RULES,
  tierProblems,
} from '../scripts/asset_pipeline/lib/concept_tiers.mjs';

// The round-one hexes from SYS-items-economy.md section 3.3, which that document's own
// section H proves fail constraints 1 to 3. A real defect case, not an invented one.
const ROUND_ONE = [
  '#6B5F53',
  '#9CA3AA',
  '#4F7FB4',
  '#7B5FB4',
  '#4FA372',
  '#C0483C',
  '#E0A93B',
  '#DCE9F2',
].map((hex, i) => ({ tier: i + 1, hex, read: 'round one' }));

describe('concept_tiers: colour maths', () => {
  it('converts the sRGB extremes to L* 0 and 100 and round-trips a mid colour', () => {
    expect(hexToLab('#000000').L).toBeCloseTo(0, 1);
    expect(hexToLab('#ffffff').L).toBeCloseTo(100, 0);
    const back = labToRgb(hexToLab('#5cd450'));
    expect(back).toEqual({ r: 92, g: 212, b: 80 });
  });
  it('measures dE symmetrically and as zero against itself', () => {
    const a = hexToLab('#d84c4c');
    const b = hexToLab('#4a9ae0');
    expect(deltaE(a, a)).toBe(0);
    expect(deltaE(a, b)).toBeCloseTo(deltaE(b, a), 9);
    expect(deltaE(a, b)).toBeGreaterThan(50);
  });
});

describe('concept_tiers: the locked ladder', () => {
  it('is the eight hexes of SYS-items.md section 5 in order', () => {
    expect(TIER_LADDER.map((t) => t.hex)).toEqual([
      '#363432',
      '#676a6e',
      '#d84c4c',
      '#4a9ae0',
      '#e880e0',
      '#5cd450',
      '#f0c232',
      '#66f2ea',
    ]);
    expect(TIER_LADDER.map((t) => t.tier)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('passes all four legibility constraints (the control)', () => {
    expect(tierProblems()).toEqual([]);
  });
  it('rises in L* every step and keeps the closest pair past dE 20', () => {
    const L = TIER_LADDER.map((t) => hexToLab(t.hex).L);
    for (let i = 1; i < L.length; i++) expect(L[i]).toBeGreaterThan(L[i - 1]);
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 8; i++)
      for (let j = i + 1; j < 8; j++)
        min = Math.min(min, deltaE(hexToLab(TIER_LADDER[i].hex), hexToLab(TIER_LADDER[j].hex)));
    expect(min).toBeGreaterThan(TIER_RULES.minDeltaE);
  });
});

describe('concept_tiers: the injected defects', () => {
  it('fails the round-one ladder on constraints 1, 2 and 3, as section H reported', () => {
    const problems = tierProblems(ROUND_ONE);
    expect(problems.join(' ')).toMatch(/constraint 1: T2 to T3/);
    expect(problems.join(' ')).toMatch(/constraint 1: T3 to T4/);
    expect(problems.join(' ')).toMatch(/constraint 2: L\* does not rise from T2/);
    expect(problems.join(' ')).toMatch(/constraint 3: T8 saturation/);
  });
  it('fails a ladder with a near-duplicate pair on constraint 4', () => {
    const dup = TIER_LADDER.map((t) => (t.tier === 5 ? { ...t, hex: '#4c9ce2' } : t));
    expect(tierProblems(dup).join(' ')).toMatch(/constraint 4: T4 and T5/);
  });
  it('fails a ladder that is not eight tiers', () => {
    expect(tierProblems(TIER_LADDER.slice(0, 7)).join(' ')).toMatch(/7 tiers, not 8/);
  });
});
