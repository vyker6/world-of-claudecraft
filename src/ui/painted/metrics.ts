// The Painted HUD's measured geometry, as CSS custom properties. painted_hud.metrics.json is
// exported by simpleMMO's tools/artgen/export_painted_metrics.py, which reads every rect out
// of the paintings; nothing here is typed in by hand. hud.painted.css positions from these
// properties only, so a regenerated painting moves the HUD with it.
import metrics from './painted_hud.metrics.json';

export type PaintedChromeKey =
  | 'arknight'
  | 'bard'
  | 'blademaster'
  | 'chronomancer'
  | 'elementalist'
  | 'hero'
  | 'reaver'
  | 'undying'
  | 'warpriest';
export type PaintedGrade = 'plain' | 'elite' | 'boss';
export type Rect = [number, number, number, number];

export interface PaintedClassMetrics {
  height: number;
  wells: Rect[];
  well_frames: Rect[];
  medallion: Rect;
  hp_orb: Rect;
  res_orb: Rect;
  rail_foot: number;
  crest_top: number;
  strip_top: number;
  strip_end: number;
}
export interface PaintedTargetMetrics {
  width: number;
  height: number;
  field: Rect;
  seat: [number, number, number, number];
  rail_under: number;
}
export interface PaintedMetrics {
  version: number;
  frame: {
    width: number;
    height: number;
    safe: number;
    gap: number;
    rail_bottom: number;
    crest_room: number;
    frame_rise: number;
    strip_h: number;
    // Frame-wide, not per class: every plate seats the same chip well and cast bar.
    chip: number;
    cast_w: number;
    cast_h: number;
    // The zone header's row above the minimap chrome, and how far the tracker's feathered
    // field spreads past its column on every side. Both are the mock's own steps.
    zone_h: number;
    veil_spread: number;
  };
  bar: { width: number };
  classes: Record<PaintedChromeKey, PaintedClassMetrics>;
  targets: Record<PaintedGrade, PaintedTargetMetrics>;
  minimap: { width: number; height: number; window: Rect };
}

export const PAINTED_METRICS = metrics as PaintedMetrics;

/** Anything with a CSS setProperty: an element's style, or a test's map. */
export interface PropertySink {
  setProperty(name: string, value: string): void;
}

const GRADES: readonly PaintedGrade[] = ['plain', 'elite', 'boss'];

/** Write every --pt-* property the theme reads, for one class chrome. */
export function applyPaintedMetrics(sink: PropertySink, chrome: PaintedChromeKey): void {
  const m = PAINTED_METRICS;
  const c = m.classes[chrome];
  const px = (name: string, n: number): void => sink.setProperty(name, `${Math.round(n)}px`);
  const rect = (name: string, r: Rect): void => {
    px(`${name}-x`, r[0]);
    px(`${name}-y`, r[1]);
    px(`${name}-w`, r[2]);
    px(`${name}-h`, r[3]);
  };
  px('--pt-safe', m.frame.safe);
  px('--pt-gap', m.frame.gap);
  px('--pt-rail-bottom', m.frame.rail_bottom);
  px('--pt-crest-room', m.frame.crest_room);
  px('--pt-strip-h', m.frame.strip_h);
  px('--pt-chip', m.frame.chip);
  px('--pt-cast-w', m.frame.cast_w);
  px('--pt-cast-h', m.frame.cast_h);
  px('--pt-zone-h', m.frame.zone_h);
  px('--pt-veil-spread', m.frame.veil_spread);
  px('--pt-bar-w', m.bar.width);
  px('--pt-bar-h', c.height);
  px('--pt-bar-bottom', m.frame.rail_bottom - (c.height - c.rail_foot));
  for (const [i, w] of c.wells.entries()) rect(`--pt-well-${i + 1}`, w);
  // Reserved for the medallion plate (phase 2); no phase 1 CSS rule reads it.
  rect('--pt-medallion', c.medallion);
  rect('--pt-hp-orb', c.hp_orb);
  rect('--pt-res-orb', c.res_orb);
  px('--pt-strip-top', c.strip_top);
  px('--pt-strip-x0', (c.wells[0]?.[0] ?? 0) - m.frame.gap);
  px('--pt-strip-end', c.strip_end);
  // Reserved for the crest ornament (phase 2); no phase 1 CSS rule reads it.
  px('--pt-crest-top', c.crest_top);
  for (const g of GRADES) {
    const t = m.targets[g];
    px(`--pt-tf-${g}-w`, t.width);
    px(`--pt-tf-${g}-h`, t.height);
    rect(`--pt-tf-${g}-field`, t.field);
    px(`--pt-tf-${g}-seat-l`, t.seat[0]);
    px(`--pt-tf-${g}-seat-t`, t.seat[1]);
    px(`--pt-tf-${g}-seat-r`, t.seat[2]);
    px(`--pt-tf-${g}-seat-b`, t.seat[3]);
    px(`--pt-tf-${g}-rail`, t.rail_under);
  }
  px('--pt-map-w', m.minimap.width);
  px('--pt-map-h', m.minimap.height);
  rect('--pt-map-win', m.minimap.window);
}

/** Every custom property the theme is given, as literal text.
 *
 *  This is the theme's property contract: `applyPaintedMetrics` below writes all of it but the
 *  last two, which `armPaintedWidthProbes` measures off the rendered labels. It exists as
 *  quoted literals because `tests/css_token_resolution.test.ts` collects DECLARED names by
 *  scanning CSS, TS and HTML for `--name:` or `"--name"` text, and every name here is built at
 *  runtime from a template (`--pt-well-${i + 1}`, `${name}-x`, `--pt-tf-${g}-rail`), so the
 *  scan cannot see one of them. Without this list all 102 read as undeclared.
 *
 *  `tests/painted_hud_metrics.test.ts` asserts this equals what the applier and the probes
 *  actually write, so the list cannot drift away from the code it describes. */
export const PAINTED_PROPERTIES = [
  // the frame constants and the bar
  '--pt-safe',
  '--pt-gap',
  '--pt-rail-bottom',
  '--pt-crest-room',
  '--pt-strip-h',
  '--pt-chip',
  '--pt-cast-w',
  '--pt-cast-h',
  '--pt-zone-h',
  '--pt-veil-spread',
  '--pt-bar-w',
  '--pt-bar-h',
  '--pt-bar-bottom',
  // the eight wells
  '--pt-well-1-x',
  '--pt-well-1-y',
  '--pt-well-1-w',
  '--pt-well-1-h',
  '--pt-well-2-x',
  '--pt-well-2-y',
  '--pt-well-2-w',
  '--pt-well-2-h',
  '--pt-well-3-x',
  '--pt-well-3-y',
  '--pt-well-3-w',
  '--pt-well-3-h',
  '--pt-well-4-x',
  '--pt-well-4-y',
  '--pt-well-4-w',
  '--pt-well-4-h',
  '--pt-well-5-x',
  '--pt-well-5-y',
  '--pt-well-5-w',
  '--pt-well-5-h',
  '--pt-well-6-x',
  '--pt-well-6-y',
  '--pt-well-6-w',
  '--pt-well-6-h',
  '--pt-well-7-x',
  '--pt-well-7-y',
  '--pt-well-7-w',
  '--pt-well-7-h',
  '--pt-well-8-x',
  '--pt-well-8-y',
  '--pt-well-8-w',
  '--pt-well-8-h',
  // the medallion and the two orbs
  '--pt-medallion-x',
  '--pt-medallion-y',
  '--pt-medallion-w',
  '--pt-medallion-h',
  '--pt-hp-orb-x',
  '--pt-hp-orb-y',
  '--pt-hp-orb-w',
  '--pt-hp-orb-h',
  '--pt-res-orb-x',
  '--pt-res-orb-y',
  '--pt-res-orb-w',
  '--pt-res-orb-h',
  // the XP strip and the crest
  '--pt-strip-top',
  '--pt-strip-x0',
  '--pt-strip-end',
  '--pt-crest-top',
  // the three target grades
  '--pt-tf-plain-w',
  '--pt-tf-plain-h',
  '--pt-tf-plain-field-x',
  '--pt-tf-plain-field-y',
  '--pt-tf-plain-field-w',
  '--pt-tf-plain-field-h',
  '--pt-tf-plain-seat-l',
  '--pt-tf-plain-seat-t',
  '--pt-tf-plain-seat-r',
  '--pt-tf-plain-seat-b',
  '--pt-tf-plain-rail',
  '--pt-tf-elite-w',
  '--pt-tf-elite-h',
  '--pt-tf-elite-field-x',
  '--pt-tf-elite-field-y',
  '--pt-tf-elite-field-w',
  '--pt-tf-elite-field-h',
  '--pt-tf-elite-seat-l',
  '--pt-tf-elite-seat-t',
  '--pt-tf-elite-seat-r',
  '--pt-tf-elite-seat-b',
  '--pt-tf-elite-rail',
  '--pt-tf-boss-w',
  '--pt-tf-boss-h',
  '--pt-tf-boss-field-x',
  '--pt-tf-boss-field-y',
  '--pt-tf-boss-field-w',
  '--pt-tf-boss-field-h',
  '--pt-tf-boss-seat-l',
  '--pt-tf-boss-seat-t',
  '--pt-tf-boss-seat-r',
  '--pt-tf-boss-seat-b',
  '--pt-tf-boss-rail',
  // the minimap and its window
  '--pt-map-w',
  '--pt-map-h',
  '--pt-map-win-x',
  '--pt-map-win-y',
  '--pt-map-win-w',
  '--pt-map-win-h',
  // the two ResizeObserver probes (armPaintedWidthProbes)
  '--pt-level-plate-w',
  '--pt-tf-name-w',
] as const;

const PROBES: ReadonlyArray<readonly [id: string, property: string]> = [
  ['pf-level', '--pt-level-plate-w'],
  ['tf-name', '--pt-tf-name-w'],
];
const armed = new WeakSet<HTMLElement>();

/** The two widths the theme cannot know: the level plate's text and the target's name.
 *  Measured off the rendered label with a ResizeObserver, never typed in. Idempotent. */
export function armPaintedWidthProbes(root: HTMLElement | null): void {
  if (!root || armed.has(root) || typeof ResizeObserver === 'undefined') return;
  armed.add(root);
  for (const [id, property] of PROBES) {
    const el = document.getElementById(id);
    if (!el) continue;
    const write = (): void => root.style.setProperty(property, `${Math.ceil(el.offsetWidth)}px`);
    new ResizeObserver(write).observe(el);
    write();
  }
}
