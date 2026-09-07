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
