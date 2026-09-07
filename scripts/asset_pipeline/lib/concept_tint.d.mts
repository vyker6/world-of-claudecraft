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
export const TINT_RULES: TintRules;
export function hexToRgb(hex: string): Rgb;
export function rgbToHsv(rgb: Rgb): Hsv;
export function hexToHsv(hex: string): Hsv;
export function zonesSeparable(hexA: string, hexB: string, rules?: TintRules): boolean;
