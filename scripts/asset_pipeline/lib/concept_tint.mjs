// The tint gate for body plates. The engine tints a baked texture by remapping hue,
// saturation and value zones (the armour dye layer) or by swapping a skin atlas, so a plate
// is tint-ready only if its skin, hair, garment and accent sit in separable colour windows
// AND the plate actually used the declared base colours. Both are checked here, on the flat
// fills the locked style produces, before any paid downstream step.
import sharp from 'sharp';
import { ALPHA_SUBJECT } from './concept_silhouette.mjs';

export const TINT_RULES = Object.freeze({
  // Of the opaque pixels. The accent is not share-gated: once the body prompt names the accent
  // for the eyes alone, it covers about 0.05% of a figure (measured: 39 px of 121841 on a
  // Faithless, 62 px of 142708 on a Horned), so any positive floor fails every attempt for a
  // race whose accent has no other home. The accent zone is still measured, and still takes
  // part in separability and base distance wherever it has pixels.
  minShare: { skin: 0.08, hair: 0.02, garment: 0.05, accent: 0 },
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

function rgbDistance(a, b) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

/** Assign every opaque pixel to the nearest declared zone and summarise each zone. */
export async function measureTintZones(path, zones) {
  const names = Object.keys(zones);
  const bases = names.map((n) => hexToRgb(zones[n]));
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sums = names.map(() => ({ n: 0, r: 0, g: 0, b: 0 }));
  let opaque = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    if (data[i * 4 + 3] < ALPHA_SUBJECT) continue;
    opaque++;
    const px = { r: data[i * 4], g: data[i * 4 + 1], b: data[i * 4 + 2] };
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let z = 0; z < bases.length; z++) {
      const d = rgbDistance(px, bases[z]);
      if (d < bestD) {
        bestD = d;
        best = z;
      }
    }
    const s = sums[best];
    s.n++;
    s.r += px.r;
    s.g += px.g;
    s.b += px.b;
  }
  const out = {};
  names.forEach((name, z) => {
    const s = sums[z];
    const centroid = s.n ? { r: s.r / s.n, g: s.g / s.n, b: s.b / s.n } : null;
    out[name] = {
      share: opaque ? s.n / opaque : 0,
      centroid,
      hsv: centroid ? rgbToHsv(centroid) : null,
      distanceToBase: centroid ? rgbDistance(centroid, bases[z]) : Number.POSITIVE_INFINITY,
    };
  });
  return { opaque, zones: out };
}

export function tintProblems(m, zones, rules = TINT_RULES) {
  if (!m.opaque) return ['no subject detected (the plate is empty or fully transparent)'];
  const out = [];
  for (const [name, need] of Object.entries(rules.minShare)) {
    const z = m.zones[name];
    if (!z) continue;
    if (z.share < need) {
      out.push(
        `${name} zone covers ${(z.share * 100).toFixed(1)}% of the figure < ${need * 100}% ` +
          `(the ${name} was not painted in its base colour)`,
      );
    } else if (z.distanceToBase > rules.maxBaseDistance) {
      out.push(
        `${name} zone sits ${z.distanceToBase.toFixed(0)} from its base ${zones[name]} > ` +
          `${rules.maxBaseDistance} (the plate did not use the declared colour)`,
      );
    }
  }
  const names = Object.keys(zones);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = m.zones[names[i]];
      const b = m.zones[names[j]];
      if (!a.centroid || !b.centroid) continue;
      const hexA = rgbToHex(a.centroid);
      const hexB = rgbToHex(b.centroid);
      if (!zonesSeparable(hexA, hexB, rules)) {
        out.push(
          `${names[i]} and ${names[j]} zones are not separable (${hexA} vs ${hexB}); ` +
            'a dye rule could not pick one without the other',
        );
      }
    }
  }
  return out;
}

export function rgbToHex({ r, g, b }) {
  const c = (n) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export async function checkConceptTint(path, zones, rules = TINT_RULES) {
  const measure = await measureTintZones(path, zones);
  const problems = tintProblems(measure, zones, rules);
  return { ok: problems.length === 0, problems, measure };
}
