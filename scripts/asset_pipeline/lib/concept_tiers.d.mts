export interface TierRow {
  tier: number;
  hex: string;
  read: string;
}
export interface Lab {
  L: number;
  a: number;
  b: number;
}
export interface Rgb {
  r: number;
  g: number;
  b: number;
}
export interface TierRules {
  hueGap: number;
  lightnessGap: number;
  lowSatMax: number;
  highSatMin: number;
  minDeltaE: number;
}
export const TIER_LADDER: readonly TierRow[];
export const TIER_RULES: TierRules;
export function rgbToLab(rgb: Rgb): Lab;
export function hexToLab(hex: string): Lab;
export function labToRgb(lab: Lab): Rgb;
export function deltaE(p: Lab, q: Lab): number;
export function tierProblems(ladder?: readonly TierRow[], rules?: TierRules): string[];
