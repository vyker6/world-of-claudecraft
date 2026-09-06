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
  px('--pt-bar-w', m.bar.width);
  px('--pt-bar-h', c.height);
  px('--pt-bar-bottom', m.frame.rail_bottom - (c.height - c.rail_foot));
  for (const [i, w] of c.wells.entries()) rect(`--pt-well-${i + 1}`, w);
  rect('--pt-medallion', c.medallion);
  rect('--pt-hp-orb', c.hp_orb);
  rect('--pt-res-orb', c.res_orb);
  px('--pt-strip-top', c.strip_top);
  px('--pt-strip-x0', (c.wells[0]?.[0] ?? 0) - m.frame.gap);
  px('--pt-strip-end', c.strip_end);
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
