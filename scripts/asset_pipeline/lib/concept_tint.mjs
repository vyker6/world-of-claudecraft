// The tint gate for body plates. The engine tints a baked texture by remapping hue,
// saturation and value zones (the armour dye layer) or by swapping a skin atlas, so a plate
// is tint-ready only if its skin, hair, garment and accent sit in separable colour windows
// AND the plate actually used the declared base colours. Both are checked here, on the flat
// fills the locked style produces, before any paid downstream step.
// biome-ignore lint/correctness/noUnusedImports: Task 2 appends the measuring functions that use it.
import sharp from 'sharp';

export const TINT_RULES = Object.freeze({
  minShare: { skin: 0.08, hair: 0.02, garment: 0.05, accent: 0.001 }, // of the opaque pixels
  maxBaseDistance: 70, // RGB distance from a zone's observed centroid to its declared base
  hueGap: 12, // degrees, only meaningful when both zones are saturated enough
  satGap: 0.12,
  valGap: 0.12,
  minSatForHue: 0.15,
});

export function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHsv({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hexToHsv(hex) {
  return rgbToHsv(hexToRgb(hex));
}

function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Two colours are separable when a dye rule can select one without the other. */
export function zonesSeparable(hexA, hexB, rules = TINT_RULES) {
  const a = hexToHsv(hexA);
  const b = hexToHsv(hexB);
  const bothSaturated = a.s >= rules.minSatForHue && b.s >= rules.minSatForHue;
  if (bothSaturated && hueDistance(a.h, b.h) >= rules.hueGap) return true;
  if (Math.abs(a.s - b.s) >= rules.satGap) return true;
  if (Math.abs(a.v - b.v) >= rules.valGap) return true;
  return false;
}
