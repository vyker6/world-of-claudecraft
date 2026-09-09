// Builds small RGBA test plates with sharp so the gates can be proven against injected
// defects without spending an image generation. A "figure" is a set of flat rectangles.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}

export async function syntheticPlate(name: string, size: number, rects: Rect[]): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'concept-gates-'));
  const path = join(dir, `${name}.png`);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    rects
      .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.fill}"/>`)
      .join('') +
    '</svg>';
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(path);
  return path;
}

/** A T-posed stick figure in the given zone colours: head, hair cap, torso garment, arms and legs in skin. */
export function tposeFigure(
  size: number,
  c: { skin: string; hair: string; garment: string; accent: string },
): Rect[] {
  const u = size / 32;
  return [
    { x: 14 * u, y: 3 * u, w: 4 * u, h: 4 * u, fill: c.skin }, // head
    { x: 14 * u, y: 2 * u, w: 4 * u, h: 1.5 * u, fill: c.hair }, // hair cap
    { x: 15 * u, y: 4 * u, w: 0.6 * u, h: 0.6 * u, fill: c.accent }, // eye
    { x: 12 * u, y: 7 * u, w: 8 * u, h: 8 * u, fill: c.garment }, // torso garment
    { x: 4 * u, y: 7.5 * u, w: 8 * u, h: 1.6 * u, fill: c.skin }, // left arm out
    { x: 20 * u, y: 7.5 * u, w: 8 * u, h: 1.6 * u, fill: c.skin }, // right arm out
    { x: 12.5 * u, y: 15 * u, w: 3 * u, h: 12 * u, fill: c.skin }, // left leg
    { x: 16.5 * u, y: 15 * u, w: 3 * u, h: 12 * u, fill: c.skin }, // right leg
  ];
}

/** The same figure with the arms down at the sides: not a T-pose. */
export function armsDownFigure(
  size: number,
  c: { skin: string; hair: string; garment: string; accent: string },
): Rect[] {
  const u = size / 32;
  return tposeFigure(size, c)
    .filter((_, i) => i !== 4 && i !== 5)
    .concat([
      { x: 10.5 * u, y: 7 * u, w: 1.6 * u, h: 9 * u, fill: c.skin },
      { x: 19.9 * u, y: 7 * u, w: 1.6 * u, h: 9 * u, fill: c.skin },
    ]);
}

/** A thin vertical bar: a blade with no guard. Occupies rows 10% to 90% of the plate. */
export function barShape(size: number, fill: string, widthFrac = 0.06): Rect[] {
  const w = Math.round(size * widthFrac);
  return [
    {
      x: Math.round(size / 2 - w / 2),
      y: Math.round(size * 0.1),
      w,
      h: Math.round(size * 0.8),
      fill,
    },
  ];
}

/** The same bar with a wide crossguard a fifth of the way up from the bottom. */
export function crossguardShape(size: number, fill: string): Rect[] {
  const guardW = Math.round(size * 0.4);
  return barShape(size, fill).concat([
    {
      x: Math.round(size / 2 - guardW / 2),
      y: Math.round(size * 0.7),
      w: guardW,
      h: Math.round(size * 0.04),
      fill,
    },
  ]);
}

/** A bar bent to one side: its rows step right toward the tip, so the centroid offset varies. */
export function curvedShape(size: number, fill: string): Rect[] {
  const w = Math.round(size * 0.06);
  const rects: Rect[] = [];
  const steps = 32;
  const h = Math.round((size * 0.8) / steps);
  for (let i = 0; i < steps; i++) {
    const lean = Math.round((size * 0.18 * (steps - 1 - i)) / (steps - 1));
    rects.push({
      x: Math.round(size / 2 - w / 2) + lean,
      y: Math.round(size * 0.1) + i * h,
      w,
      h,
      fill,
    });
  }
  return rects;
}

/** A solid disc: a round shield face-on. */
export function discShape(size: number, fill: string): Rect[] {
  const r = Math.round(size * 0.4);
  const rects: Rect[] = [];
  const rows = 64;
  const step = (2 * r) / rows;
  for (let i = 0; i < rows; i++) {
    const y = -r + i * step + step / 2;
    const half = Math.sqrt(Math.max(0, r * r - y * y));
    rects.push({
      x: Math.round(size / 2 - half),
      y: Math.round(size / 2 + y - step / 2),
      w: Math.round(2 * half),
      h: Math.ceil(step),
      fill,
    });
  }
  return rects;
}

/** A filled square: the aspect-band defect (1:1 where a blade is expected). */
export function squareShape(size: number, fill: string): Rect[] {
  const s = Math.round(size * 0.8);
  return [{ x: Math.round(size / 2 - s / 2), y: Math.round(size / 2 - s / 2), w: s, h: s, fill }];
}

/** Mirror a rect list left to right inside the plate. */
export function mirrorRects(size: number, rects: Rect[]): Rect[] {
  return rects.map((r) => ({ ...r, x: size - r.x - r.w }));
}

/** Scale a rect list about the plate's bottom centre. */
export function scaleRects(size: number, rects: Rect[], k: number): Rect[] {
  return rects.map((r) => ({
    x: Math.round(size / 2 + (r.x - size / 2) * k),
    y: Math.round(size - (size - r.y) * k),
    w: Math.max(1, Math.round(r.w * k)),
    h: Math.max(1, Math.round(r.h * k)),
    fill: r.fill,
  }));
}
