// The material tier ladder as code: the eight locked hexes of SYS-items.md section 5 and the
// four legibility constraints that section states, so a changed hex is a failing test and not
// a review opinion. Value is CIELAB L*, the space the dE rule already uses; hue is HSV hue,
// measured on every consecutive pair. Pure: no I/O.
import { hexToHsv, hexToRgb } from './concept_tint.mjs';

export const TIER_LADDER = Object.freeze([
  { tier: 1, hex: '#363432', read: 'dark iron grey' },
  { tier: 2, hex: '#676a6e', read: 'pale silver grey' },
  { tier: 3, hex: '#d84c4c', read: 'crimson' },
  { tier: 4, hex: '#4a9ae0', read: 'sky blue' },
  { tier: 5, hex: '#e880e0', read: 'orchid violet' },
  { tier: 6, hex: '#5cd450', read: 'leaf green' },
  { tier: 7, hex: '#f0c232', read: 'gold' },
  { tier: 8, hex: '#66f2ea', read: 'luminous ice cyan' },
]);

export const TIER_RULES = Object.freeze({
  hueGap: 60, // degrees between consecutive tiers, or
  lightnessGap: 20, // L* between consecutive tiers
  lowSatMax: 0.25, // tiers 1 to 2 are desaturated
  highSatMin: 0.55, // tiers 6 to 8 are saturated
  minDeltaE: 20, // every pair
});

const linear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const gamma = (v) => {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
};
const WHITE = { x: 0.95047, y: 1, z: 1.08883 };

export function rgbToLab({ r, g, b }) {
  const R = linear(r);
  const G = linear(g);
  const B = linear(b);
  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / WHITE.x;
  const y = (R * 0.2126729 + G * 0.7151522 + B * 0.072175) / WHITE.y;
  const z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / WHITE.z;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function hexToLab(hex) {
  return rgbToLab(hexToRgb(hex));
}

export function labToRgb({ L, a, b }) {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const x = inv(fx) * WHITE.x;
  const y = inv(fy) * WHITE.y;
  const z = inv(fz) * WHITE.z;
  return {
    r: gamma(x * 3.2404542 + y * -1.5371385 + z * -0.4985314),
    g: gamma(x * -0.969266 + y * 1.8760108 + z * 0.041556),
    b: gamma(x * 0.0556434 + y * -0.2040259 + z * 1.0572252),
  };
}

export function deltaE(p, q) {
  return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
}

function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Every constraint the ladder breaks, one line each; empty when it passes. */
export function tierProblems(ladder = TIER_LADDER, rules = TIER_RULES) {
  const out = [];
  if (ladder.length !== 8) out.push(`ladder has ${ladder.length} tiers, not 8`);
  const rows = ladder.map((t) => ({ ...t, hsv: hexToHsv(t.hex), lab: hexToLab(t.hex) }));
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    const dh = hueDistance(a.hsv.h, b.hsv.h);
    const dL = b.lab.L - a.lab.L;
    if (dh < rules.hueGap && Math.abs(dL) < rules.lightnessGap) {
      out.push(
        `constraint 1: T${a.tier} to T${b.tier} differ by ${dh.toFixed(0)} degrees of hue and ` +
          `${Math.abs(dL).toFixed(0)} of L*, need ${rules.hueGap} degrees or ${rules.lightnessGap} L*`,
      );
    }
    if (dL <= 0) {
      out.push(
        `constraint 2: L* does not rise from T${a.tier} (${a.lab.L.toFixed(1)}) to ` +
          `T${b.tier} (${b.lab.L.toFixed(1)})`,
      );
    }
  }
  for (const r of rows) {
    if (r.tier <= 2 && r.hsv.s > rules.lowSatMax)
      out.push(`constraint 3: T${r.tier} saturation ${r.hsv.s.toFixed(2)} > ${rules.lowSatMax}`);
    if (r.tier >= 6 && r.hsv.s < rules.highSatMin)
      out.push(`constraint 3: T${r.tier} saturation ${r.hsv.s.toFixed(2)} < ${rules.highSatMin}`);
  }
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const d = deltaE(rows[i].lab, rows[j].lab);
      if (d < rules.minDeltaE) {
        out.push(
          `constraint 4: T${rows[i].tier} and T${rows[j].tier} are dE ${d.toFixed(1)} apart ` +
            `< ${rules.minDeltaE}`,
        );
      }
    }
  }
  return out;
}
