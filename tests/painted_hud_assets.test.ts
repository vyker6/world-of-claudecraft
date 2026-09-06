// The Painted HUD ships its chrome and type with the client: every file the theme
// stylesheet names exists, and the metrics JSON has a row for every class and grade.
import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import metrics from '../src/ui/painted/painted_hud.metrics.json';

const CHROME = [
  'bar_arknight', 'bar_bard', 'bar_blademaster', 'bar_chronomancer', 'bar_elementalist',
  'bar_hero', 'bar_reaver', 'bar_undying', 'bar_warpriest',
  'target_plain', 'target_elite', 'target_boss', 'minimap', 'ornament_rule', 'asc_star',
];
const FONTS = [
  'fira-sans-400.ttf', 'fira-sans-700.ttf',
  'barlow-semi-condensed-400.ttf', 'barlow-semi-condensed-700.ttf',
  'cinzel-400-700-latin.woff2', 'OFL-FiraSans.txt', 'OFL-BarlowSemiCondensed.txt',
];

describe('painted hud assets', () => {
  it('ships every chrome painting as webp', () => {
    for (const name of CHROME) {
      const path = `public/ui/painted/${name}.webp`;
      expect(existsSync(path), path).toBe(true);
      expect(statSync(path).size, path).toBeGreaterThan(1024);
    }
  });
  it('ships the three families with their licences', () => {
    for (const name of FONTS) expect(existsSync(`public/fonts/${name}`), name).toBe(true);
  });
  it('has metrics for every class chrome and target grade', () => {
    expect(Object.keys(metrics.classes).sort()).toEqual(CHROME.slice(0, 9).map((n) => n.slice(4)).sort());
    expect(Object.keys(metrics.targets).sort()).toEqual(['boss', 'elite', 'plain']);
    for (const row of Object.values(metrics.classes)) expect(row.wells).toHaveLength(8);
    expect(metrics.bar.width).toBe(992);
  });
});
