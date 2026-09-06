import type { ConceptJob, ConceptStyle, SubjectKind } from './concept_matrix.mjs';

export type RegionView = 'vista' | 'settlement' | 'gameplay';

export interface RegionGround {
  /** The locked ground lightness (CIE L*) from the palette walk. */
  lstar: number;
  /** The locked ground hue in plain English. */
  hue: string;
}

export interface ConceptRegion {
  id: string;
  name: string;
  ground: RegionGround;
  /** Terrain, water, light and weather of the realm interior. */
  biome: string;
  /** Building tradition, trades and props, in plain English. */
  culture: string;
  /** What each view shows in this region. */
  views: Record<RegionView, string>;
}

export interface RegionJob extends ConceptJob {
  view: RegionView;
  kind: Extract<SubjectKind, 'environment' | 'combat'>;
  background: 'opaque';
}

export const REGION_VIEWS: readonly RegionView[];
export const CHOSEN_STYLE_ID: 'osrs_genshin';
export const REGIONS: readonly ConceptRegion[];
export function lightnessWord(lstar: number): string;
export function styleNamed(styleId: string): ConceptStyle;
export function regionPrompt(region: ConceptRegion, view: RegionView, style: ConceptStyle): string;
export function regionJobId(region: ConceptRegion, view: RegionView, style: ConceptStyle): string;
export function buildRegionJobs(styleId?: string): RegionJob[];
