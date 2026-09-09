import type { TierRow } from './concept_tiers.d.mts';

export function recolorZone(args: {
  path: string;
  zones: Record<string, string>;
  zone: string;
  hex: string;
  assign?: 'rgb' | 'hsv';
}): Promise<Buffer>;
export function tierStrip(args: {
  path: string;
  zones: Record<string, string>;
  zone: string;
  ladder?: readonly TierRow[];
  dest: string;
  cell?: number;
  assign?: 'rgb' | 'hsv';
}): Promise<string>;
