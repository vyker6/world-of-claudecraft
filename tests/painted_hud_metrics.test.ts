// metrics.ts turns painted_hud.metrics.json into the --pt-* properties the theme reads, and
// class_chrome.ts is the one table mapping WoC classes and target ranks onto painted chrome.
import { describe, expect, it } from 'vitest';
import { paintedChromeFor, paintedGradeFor } from '../src/ui/painted/class_chrome';
import { applyPaintedMetrics, PAINTED_METRICS } from '../src/ui/painted/metrics';

function collect(chrome: 'reaver' | 'hero'): Map<string, string> {
  const out = new Map<string, string>();
  applyPaintedMetrics({ setProperty: (k, v) => out.set(k, v) }, chrome);
  return out;
}

describe('painted metrics properties', () => {
  it('writes the eight wells, the orbs and the medallion of the active chrome', () => {
    const props = collect('reaver');
    const row = PAINTED_METRICS.classes.reaver;
    for (const [i, well] of row.wells.entries()) {
      expect(props.get(`--pt-well-${i + 1}-x`)).toBe(`${well[0]}px`);
      expect(props.get(`--pt-well-${i + 1}-h`)).toBe(`${well[3]}px`);
    }
    expect(row.wells).toHaveLength(8);
    expect(props.get('--pt-hp-orb-w')).toBe(`${row.hp_orb[2]}px`);
    expect(props.get('--pt-medallion-y')).toBe(`${row.medallion[1]}px`);
    expect(props.get('--pt-bar-w')).toBe('992px');
    expect(props.get('--pt-bar-bottom')).toBe(`${72 - (row.height - row.rail_foot)}px`);
    expect(props.get('--pt-strip-x0')).toBe(`${row.wells[0][0] - 8}px`);
  });
  it('writes every target grade and the minimap window', () => {
    const props = collect('hero');
    for (const grade of ['plain', 'elite', 'boss'] as const) {
      const t = PAINTED_METRICS.targets[grade];
      expect(props.get(`--pt-tf-${grade}-w`)).toBe(`${t.width}px`);
      expect(props.get(`--pt-tf-${grade}-field-w`)).toBe(`${t.field[2]}px`);
      expect(props.get(`--pt-tf-${grade}-seat-l`)).toBe(`${t.seat[0]}px`);
      expect(props.get(`--pt-tf-${grade}-rail`)).toBe(`${t.rail_under}px`);
    }
    expect(props.get('--pt-map-win-w')).toBe(`${PAINTED_METRICS.minimap.window[2]}px`);
    // The cast bar and the chip well are frame-wide, not per class: the target plate and the
    // player plate both seat a cast bar of the same painted size.
    expect(props.get('--pt-chip')).toBe(`${PAINTED_METRICS.frame.chip}px`);
    expect(props.get('--pt-cast-w')).toBe(`${PAINTED_METRICS.frame.cast_w}px`);
    expect(props.get('--pt-cast-h')).toBe(`${PAINTED_METRICS.frame.cast_h}px`);
  });
  it('never writes a property without a px unit', () => {
    for (const [k, v] of collect('reaver')) expect(v, k).toMatch(/^-?\d+px$/);
  });
});

describe('class chrome table', () => {
  it('dresses the warrior as the Reaver and everyone else as the Hero', () => {
    expect(paintedChromeFor('warrior')).toBe('reaver');
    expect(paintedChromeFor('mage')).toBe('hero');
  });
  it('maps target ranks onto plate grades', () => {
    expect(paintedGradeFor('normal')).toBe('plain');
    expect(paintedGradeFor('elite')).toBe('elite');
    expect(paintedGradeFor('boss')).toBe('boss');
  });
});
