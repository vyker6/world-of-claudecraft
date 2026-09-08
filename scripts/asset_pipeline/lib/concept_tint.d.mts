export interface TintRules {
  minShare: Record<'skin' | 'hair' | 'garment' | 'accent', number>;
  maxBaseDistance: number;
  hueGap: number;
  satGap: number;
  valGap: number;
  minSatForHue: number;
}
export interface Rgb {
  r: number;
  g: number;
  b: number;
}
export interface Hsv {
  h: number;
  s: number;
  v: number;
}
export interface TintMeasure {
  opaque: number;
  zones: Record<
    string,
    { share: number; centroid: Rgb | null; hsv: Hsv | null; distanceToBase: number }
  >;
}
export const TINT_RULES: TintRules;
export function hexToRgb(hex: string): Rgb;
export function rgbToHsv(rgb: Rgb): Hsv;
export function hexToHsv(hex: string): Hsv;
export function hueDistance(a: number, b: number): number;
export function zonesSeparable(hexA: string, hexB: string, rules?: TintRules): boolean;
export function measureTintZones(path: string, zones: Record<string, string>): Promise<TintMeasure>;
export function tintProblems(
  measure: TintMeasure,
  zones: Record<string, string>,
  rules?: TintRules,
): string[];
export function rgbToHex(rgb: Rgb): string;
export function checkConceptTint(
  path: string,
  zones: Record<string, string>,
  rules?: TintRules,
): Promise<{ ok: boolean; problems: string[]; measure: TintMeasure }>;
